import { useEffect, useRef, useState } from 'react';
import { COLORS, HOME, type Color, type GameState, type Player } from '../game/engine';
import type { Emote, Session, Status } from '../game/net';
import { recordGame, type Profile } from '../game/profile';
import { buzz, isMuted, setMuted, sfx } from '../game/sound';
import { Board } from './Board';
import { Confetti, type ConfettiHandle } from './Confetti';
import { Dice } from './Dice';
import { Backdrop } from './Home';
import { Avatar, type Mood } from './Avatar';
import { TrollOverlay, TrollPicker, trollIndex, trollTarget } from './Trolls';

const HEX: Record<Color, string> = { red: '#ff3d6e', green: '#2ee59d', yellow: '#ffc93c', blue: '#3d8bff' };
const CORNERS = ['tl', 'tr', 'br', 'bl'] as const;

interface Props {
  session: Session;
  state: GameState;
  status: { st: Status; msg?: string };
  emotes: Emote[];
  profile: Profile;
  onProfile(p: Profile): void;
  onLeave(): void;
}

export function GameView({ session, state, status, emotes, profile, onProfile, onLeave }: Props) {
  const me = state.players.find((p) => p.id === session.myId) ?? null;
  const cur = state.players[state.turn];
  const myTurn = state.phase === 'playing' && cur?.id === session.myId;
  const myIdx = me ? COLORS.indexOf(me.color) : 3;
  const rotation = (3 - myIdx + 4) % 4; // put my yard bottom-left
  const cornerOf = (c: Color) => CORNERS[(COLORS.indexOf(c) + rotation) % 4];

  const [muted, setMute] = useState(isMuted());
  const [shake, setShake] = useState(0);
  const [toast, setToast] = useState<{ id: number; text: string; color: Color } | null>(null);
  const [diceSettled, setDiceSettled] = useState(true);
  const [burst, setBurst] = useState<{ id: number; color: Color; done: number; total: number } | null>(null);
  const [splash, setSplash] = useState<{ id: number; p: Player; place: number } | null>(null);
  const left = useCountdown(state);
  const [picker, setPicker] = useState(false);
  const [moods, setMoods] = useState<Partial<Record<Color, { mood: Mood; id: number }>>>({});
  const setMood = (c: Color, mood: Mood) => {
    const id = Date.now() + Math.random();
    setMoods((m) => ({ ...m, [c]: { mood, id } }));
    pending.current.push(setTimeout(() => setMoods((m) => (m[c]?.id === id ? { ...m, [c]: undefined } : m)), 4000));
  };
  const [troll, setTroll] = useState<Emote | null>(null);
  const lastTroll = useRef(0);
  const urgent = state.phase === 'playing' && state.turnMs > 0 && !cur?.bot && cur?.connected && left > 0 && left <= 5000;
  const secs = Math.ceil(left / 1000);

  // Tick-tock for the last five seconds of any human's turn.
  useEffect(() => { if (urgent) sfx.tick(myTurn); }, [urgent, secs, myTurn]);

  // Show the newest troll full-screen.
  useEffect(() => {
    const e = emotes.at(-1);
    if (!e || e.id === lastTroll.current || trollIndex(e.emoji) < 0) return;
    lastTroll.current = e.id;
    setTroll(e);
    sfx.troll();
    if (trollTarget(e.emoji) === session.myId) buzz([60, 40, 60]);
    const t = setTimeout(() => setTroll((cur) => (cur?.id === e.id ? null : cur)), 2800);
    return () => clearTimeout(t);
  }, [emotes]);
  const [result, setResult] = useState<{ place: number; xp: number } | null>(null);
  const confetti = useRef<ConfettiHandle>(null);
  const arena = useRef<HTMLDivElement>(null);
  const lastEvent = useRef(state.event?.id ?? 0);
  const lastRoll = useRef(state.rollId);
  const recorded = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => pending.current.forEach(clearTimeout), []);

  // Sound, haptics and juice for each new game event.
  useEffect(() => {
    if (state.rollId !== lastRoll.current) { lastRoll.current = state.rollId; setDiceSettled(false); sfx.roll(); }
    const e = state.event;
    if (!e || e.id === lastEvent.current) return;
    lastEvent.current = e.id;
    // Home/win wait for the piece to finish walking (150ms per square).
    const delay = e.kind === 'roll' || e.kind === 'six' || e.kind === 'triple' ? 700 : e.kind === 'home' || e.kind === 'win' ? 150 * state.dice + 250 : 150;
    const t = setTimeout(() => {
      if (e.kind !== 'move') setToast({ id: e.id, text: e.text, color: e.color });
      if (e.kind === 'six') sfx.six();
      if (e.kind === 'capture') {
        buzz(e.victim === me?.color ? 200 : [40, 30, 80]); // sound: Board plays a single hiss
        if (e.victim) setMood(e.victim, 'sad');
        setShake((n) => n + 1);
        confetti.current?.burst(innerWidth / 2, innerHeight / 2, [HEX[e.color], '#fff'], 40);
      }
      if (e.kind === 'home' || e.kind === 'win') {
        sfx.home();
        setMood(e.color, 'cool');
        const done = (state.tokens[e.color] ?? []).filter((t) => t === HOME).length;
        setBurst({ id: e.id, color: e.color, done, total: state.tokens[e.color]?.length ?? 4 });
        confetti.current?.burst(innerWidth / 2, innerHeight * 0.45, [HEX[e.color], '#fff', '#ffe08a'], 70);
      }
      if (e.kind === 'win') {
        const p = state.players.find((x) => x.color === e.color);
        if (p) pending.current.push(setTimeout(() => {
          setSplash({ id: e.id, p, place: state.winners.indexOf(p.id) + 1 });
          sfx.win();
          const c = HEX[e.color];
          [0, 400, 800].forEach((d) => setTimeout(() => confetti.current?.burst(innerWidth * (0.2 + Math.random() * 0.6), innerHeight * 0.35, [c, '#fff', '#ffe08a'], 120), d));
        }, 1300));
      }
      if (e.kind === 'timeout') sfx.pop();
    }, delay);
    pending.current.push(t); // not cleared on re-run: a later roll must not cancel this effect
  }, [state.event, state.rollId, me?.color]);

  useEffect(() => {
    if (!shake) return;
    arena.current?.animate(
      [0, -8, 7, -5, 4, 0].map((x, i) => ({ transform: `translate(${x}px, ${i % 2 ? 3 : -3}px)` })),
      { duration: 380, easing: 'ease-out' },
    );
  }, [shake]);

  useEffect(() => { if (myTurn && !state.rolled) sfx.turn(); }, [myTurn, state.rolled, state.turn]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 1900);
    return () => clearTimeout(t);
  }, [burst]);
  useEffect(() => {
    if (!splash) return;
    const t = setTimeout(() => setSplash(null), 3400);
    return () => clearTimeout(t);
  }, [splash]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Record XP once when the game ends.
  useEffect(() => {
    if (state.phase !== 'over') { recorded.current = false; setResult(null); return; }
    if (recorded.current || !me) return;
    recorded.current = true;
    const place = state.winners.indexOf(me.id) + 1;
    const { profile: p, xp } = recordGame(profile, place, state.players.length, state.stats[me.id]?.captures ?? 0);
    onProfile(p);
    setTimeout(() => {
      setResult({ place, xp });
      if (place === 1) { sfx.win(); confetti.current?.burst(innerWidth / 2, innerHeight * 0.3, Object.values(HEX), 200); }
      else sfx.lose();
    }, 5200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const toggleMute = () => { setMuted(!muted); setMute(!muted); };
  const canRoll = myTurn && !state.rolled && diceSettled;
  const canMove = myTurn && state.rolled && diceSettled;
  const curColor = cur ? HEX[cur.color] : '#fff';

  return (
    <div className={`screen game turn-${cur?.color}`} style={{ ['--turn' as string]: curColor }}>
      <Backdrop />
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => { if (state.phase === 'over' || confirm('Leave this game?')) onLeave(); }}>✕</button>
        <div className="room-chip">{session.local ? 'Practice' : `Room ${session.code}`}{state.mode === 'quick' && ' · ⚡'}</div>
        <button className="btn ghost sm" onClick={toggleMute} aria-label="Sound">{muted ? '🔇' : '🔊'}</button>
      </div>
      {status.st === 'reconnecting' && <div className="banner warn">{status.msg}</div>}

      <div className="arena" ref={arena}>
        {urgent && <div className={`big-count ${myTurn ? 'mine' : ''}`} key={secs}>{secs}</div>}
        {state.players.map((p) => (
          <PlayerCard key={p.id} p={p} state={state} corner={cornerOf(p.color)} isMe={p.id === session.myId} left={left} mood={moods[p.color]?.mood ?? null}
            hyped={!!troll && (troll.from === p.id || trollTarget(troll.emoji) === p.id)} />
        ))}
        <Board state={state} myColor={me?.color ?? null} rotation={rotation} canMove={canMove}
          onPick={(idx) => { sfx.tap(); session.act({ t: 'move', idx }); }} />
      </div>

      <div className="dock">
        <div className="turn-label">
          {state.phase === 'over' ? 'Game over' : myTurn
            ? (state.rolled ? (state.movable.length > 1 && diceSettled ? 'Pick a token' : '…') : 'Your turn!')
            : `${cur?.name}'s turn`}
          {state.phase === 'playing' && state.turnMs > 0 && !cur?.bot && (
            <> <span className={`clock ${left < 5000 ? 'low' : ''}`}>{Math.ceil(left / 1000)}s</span></>
          )}
        </div>
        <Dice value={state.dice} rollId={state.rollId} color={curColor} ready={canRoll}
          onRoll={() => session.act({ t: 'roll' })} onSettled={() => setDiceSettled(true)} />
        <div className="emotes">
          <button className="troll-open" onClick={() => { sfx.tap(); setPicker(true); }}>😈<small>Troll</small></button>
        </div>
      </div>

      {toast && <div key={toast.id} className="toast" style={{ ['--tc' as string]: HEX[toast.color] }}>{toast.text}</div>}

      {state.phase === 'over' && result && (
        <Results state={state} myId={session.myId} result={result}
          onRematch={state.hostId === session.myId ? () => session.act({ t: 'rematch' }) : undefined} onLeave={onLeave} />
      )}
      {burst && (
        <div className="home-burst" key={burst.id} style={{ ['--hc' as string]: HEX[burst.color] }}>
          <i className="ring" /><i className="ring" /><i className="ring" />
          {Array.from({ length: 10 }, (_, k) => <i key={k} className="ray" style={{ ['--k' as string]: k }} />)}
          <div className="chip">
            <svg viewBox="-0.5 -0.5 1 1"><PawnIcon color={HEX[burst.color]} /></svg>
            <b>PIECE HOME!</b>
            <div className="meter">{Array.from({ length: burst.total }, (_, i) => <i key={i} className={`${i < burst.done ? 'on' : ''} ${i === burst.done - 1 ? 'new' : ''}`} />)}</div>
            <small>{burst.done}/{burst.total} safe</small>
          </div>
        </div>
      )}
      {splash && (
        <div className="splash" key={splash.id} style={{ ['--wc' as string]: HEX[splash.p.color] }}>
          <div className="rays" />
          <div className="who">
            {splash.place === 1 && <div className="crown2">👑</div>}
            <div className="big-av"><Avatar id={splash.p.avatar} size={130} className="dance" mood="cool" /></div>
            <h2>{splash.p.id === session.myId ? (splash.place === 1 ? 'YOU WIN!' : 'YOU FINISHED!') : `${splash.p.name}${splash.place === 1 ? ' WINS!' : ' finished!'}`}</h2>
            <p>{['🥇 Champion', '🥈 2nd place', '🥉 3rd place', '4th place'][splash.place - 1]}{state.phase === 'playing' ? ' · game continues…' : ''}</p>
          </div>
        </div>
      )}
      {picker && (
        <TrollPicker
          targets={state.players.filter((p) => p.id !== session.myId).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: HEX[p.color] }))}
          onClose={() => setPicker(false)}
          onPick={(msg) => { setPicker(false); sfx.tap(); session.emote(msg); }} />
      )}
      {troll && (() => {
        const from = state.players.find((x) => x.id === troll.from);
        const victim = state.players.find((x) => x.id === trollTarget(troll.emoji)) ?? from;
        if (!from || !victim) return null;
        return <TrollOverlay key={troll.id} troll={trollIndex(troll.emoji)} avatar={victim.avatar}
          name={victim.id === session.myId ? 'YOU' : victim.name} by={from.id === session.myId ? 'You' : from.name} color={HEX[victim.color]} />;
      })()}
      <Confetti ref={confetti} />
    </div>
  );
}

function PlayerCard({ p, state, corner, isMe, hyped, left, mood }: { p: Player; state: GameState; corner: string; isMe: boolean; hyped: boolean; left: number; mood: Mood }) {
  const turn = state.phase === 'playing' && state.players[state.turn]?.id === p.id;
  const tokens = state.tokens[p.color] ?? [];
  const home = tokens.filter((t) => t === HOME).length;
  const place = state.winners.indexOf(p.id);
  return (
    <div className={`pcard ${corner} ${p.color} ${turn ? 'turn' : ''} ${p.connected || p.bot ? '' : 'offline'}`}>
      <div className="pav">
        {turn && !p.bot && state.turnMs > 0 && (
          <svg className="timer" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" style={{ strokeDashoffset: 113 * (1 - left / state.turnMs), stroke: left < 5000 ? 'var(--red)' : '#fff' }} />
          </svg>
        )}
        <Avatar id={p.avatar} size={40} hyped={turn || hyped} mood={mood} />
      </div>
      <div className="pinfo">
        <div className="pname">{p.name}{isMe && <em> you</em>}</div>
        <div className="pmeta">
          {place >= 0 ? <b className="placed">#{place + 1}</b>
            : <span className="pips">{tokens.map((t, i) => <i key={i} className={t === HOME ? 'done' : t >= 0 ? 'out' : ''} />)}</span>}
          {!p.connected && !p.bot && <small>offline</small>}
          {home > 0 && place < 0 && <small>{home} home</small>}
        </div>
      </div>
    </div>
  );
}

function Results({ state, myId, result, onRematch, onLeave }: {
  state: GameState; myId: string; result: { place: number; xp: number }; onRematch?(): void; onLeave(): void;
}) {
  const medal = ['🥇', '🥈', '🥉', '4️⃣'];
  const title = result.place === 1 ? 'Victory!' : result.place === 2 ? 'So close!' : 'Good game!';
  return (
    <div className="overlay">
      <div className="results card">
        <div className="crown">{result.place === 1 ? '👑' : '🎲'}</div>
        <h2>{title}</h2>
        <div className="xp-gain">+{result.xp} XP</div>
        <ol className="podium">
          {state.winners.map((id, i) => {
            const p = state.players.find((x) => x.id === id)!;
            return (
              <li key={id} className={`${p.color} ${id === myId ? 'me' : ''}`} style={{ animationDelay: `${i * 120}ms` }}>
                <span>{medal[i]}</span><span className="av"><Avatar id={p.avatar} size={34} /></span><b>{p.name}</b>
                <small>⚔ {state.stats[id]?.captures ?? 0}</small>
              </li>
            );
          })}
        </ol>
        <div className="row">
          {onRematch ? <button className="btn primary" onClick={onRematch}>↻ Rematch</button>
            : <div className="dim small">Waiting for host to rematch…</div>}
          <button className="btn glass" onClick={onLeave}>Home</button>
        </div>
      </div>
    </div>
  );
}

function PawnIcon({ color }: { color: string }) {
  return (
    <g>
      <path d="M0 0.44 C-0.06 0.3 -0.36 0.08 -0.36 -0.12 A0.36 0.36 0 1 1 0.36 -0.12 C0.36 0.08 0.06 0.3 0 0.44 Z" fill={color} stroke="#1b1035" strokeWidth="0.04" />
      <circle cx="0" cy="-0.12" r="0.18" fill="#fff" />
      <circle cx="0" cy="-0.12" r="0.1" fill={color} />
      <ellipse cx="-0.14" cy="-0.3" rx="0.08" ry="0.05" fill="#fff" opacity="0.7" />
    </g>
  );
}

/** Seconds left in the current chance, ticking locally between host updates. */
function useCountdown(state: GameState) {
  const [left, setLeft] = useState(state.turnLeftMs);
  useEffect(() => {
    const deadline = Date.now() + state.turnLeftMs;
    setLeft(state.turnLeftMs);
    const t = setInterval(() => setLeft(Math.max(0, deadline - Date.now())), 250);
    return () => clearInterval(t);
  }, [state.turnLeftMs, state.turn, state.rolled]);
  return left;
}
