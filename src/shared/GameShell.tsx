// Everything around a game board that every Sarvimo game shares: home screen (name + character),
// rooms, lobby, ads, trolls, the last-five-seconds countdown and the results screen.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { InterstitialAd, BannerStrip, randomInterstitial, type Interstitial } from '../ads/AdViews';
import { adsEnabled } from '../ads/premium';
import { useAccount } from '../account/account';
import { AccountBar } from '../account/AccountViews';
import { Avatar, charOf, type Mood } from '../components/Avatar';
import { Confetti, type ConfettiHandle } from '../components/Confetti';
import { Backdrop } from '../components/Home';
import { TrollOverlay, TrollPicker, trollIndex, trollTarget } from '../components/Trolls';
import { AVATARS, loadProfile, recordGame, saveProfile, type Profile } from '../game/profile';
import { buzz, isMuted, setMuted, sfx } from '../game/sound';
import { hostRoom, joinRoom, soloRoom, TIMER_CHOICES, type Emote, type RoomSession, type RoomState, type Rules, type Status } from './room';

export const SEAT_COLORS = ['#ff2d55', '#2b7bff', '#00c97a', '#ffb400'];

export interface GameProps<G, A> {
  session: RoomSession<A>;
  room: RoomState<G>;
  game: G;
  me: string;
  color(pid: string): string;
  mood(pid: string): Mood;
  setMood(pid: string, m: Mood, ms?: number): void;
  confetti(x: number, y: number, colors: string[], n?: number): void;
  act(a: A): void;
  left: number; // ms left in the current turn
}

export interface ShellConfig<G, A> {
  slug: string;
  name: string;
  kind: string;
  tagline: string;
  prefix: string;
  rules: Rules<G, A> & { ranking(g: G): string[] };
  hero: ReactNode;
  options?: { key: string; label: string; choices: { value: string; label: string; hint?: string }[] }[];
  Board(props: GameProps<G, A>): ReactNode;
}

type Screen = 'home' | 'room';

export function GameShell<G, A>({ cfg }: { cfg: ShellConfig<G, A> }) {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [session, setSession] = useState<RoomSession<A> | null>(null);
  const [room, setRoom] = useState<RoomState<G> | null>(null);
  const [status, setStatus] = useState<{ st: Status; msg?: string }>({ st: 'closed' });
  const [code, setCode] = useState('');
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [error, setError] = useState('');
  const [ad, setAd] = useState<{ ad: Interstitial; then: () => void } | null>(null);
  const ref = useRef<RoomSession<A> | null>(null);
  useAccount(); // re-render on plan change (ads on/off)

  const withAd = useCallback((then: () => void) => {
    if (!adsEnabled()) { then(); return; }
    setAd({ ad: randomInterstitial(), then });
  }, []);
  const updateProfile = (p: Profile) => { setProfile(p); saveProfile(p); };

  const leave = () => {
    ref.current?.leave(); ref.current = null;
    setSession(null); setRoom(null); setCode(''); setEmotes([]);
    const u = new URL(location.href); u.searchParams.delete('room'); history.replaceState(null, '', u);
  };
  useEffect(() => () => ref.current?.leave(), []);

  const start = (kind: 'host' | 'join' | 'solo', arg?: string | number, options: Record<string, string> = {}) => {
    setError('');
    const me = { id: profile.id, name: profile.name.trim(), avatar: profile.avatar };
    const h = {
      onState: (s: RoomState<G>) => setRoom(s),
      onEmote: (e: Emote) => setEmotes((l) => [...l.slice(-6), e]),
      onStatus: (st: Status, msg?: string) => { setStatus({ st, msg }); if (st === 'closed' && msg) { setError(msg); leave(); } },
    };
    let s: RoomSession<A>;
    if (kind === 'solo') s = soloRoom(cfg.rules, me, Number(arg), options, h);
    else if (kind === 'host') s = hostRoom(cfg.prefix, cfg.rules, me, h, setCode);
    else {
      s = joinRoom(cfg.prefix, String(arg), me, h);
      setCode(String(arg).toUpperCase());
      const u = new URL(location.href); u.searchParams.set('room', String(arg).toUpperCase()); history.replaceState(null, '', u);
    }
    ref.current = s; setSession(s);
  };

  const screen: Screen = session ? 'room' : 'home';
  const adLayer = ad && <InterstitialAd ad={ad.ad} onDone={() => { const t = ad.then; setAd(null); t(); }} />;

  return (
    <>
      {adLayer}
      {screen === 'home' && <ShellHome cfg={cfg} profile={profile} onProfile={updateProfile} error={error}
        onStart={(k, arg, o) => withAd(() => start(k, arg, o))} />}
      {screen === 'room' && session && (!room || room.phase === 'lobby') && (
        <ShellLobby cfg={cfg} session={session} room={room} code={code} status={status} onLeave={leave} />
      )}
      {screen === 'room' && session && room && room.phase !== 'lobby' && room.game && (
        <ShellGame cfg={cfg} session={session} room={room} game={room.game} status={status} emotes={emotes}
          profile={profile} onProfile={updateProfile} onLeave={() => withAd(leave)} withAd={withAd} />
      )}
    </>
  );
}

// ---------------- home ----------------
function ShellHome<G, A>({ cfg, profile, onProfile, onStart, error }: {
  cfg: ShellConfig<G, A>; profile: Profile; onProfile(p: Profile): void; error: string;
  onStart(kind: 'host' | 'join' | 'solo', arg?: string | number, options?: Record<string, string>): void;
}) {
  const [panel, setPanel] = useState<null | 'join' | 'solo'>(() => (new URLSearchParams(location.search).get('room') ? 'join' : null));
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '');
  const [bots, setBots] = useState(1);
  const [opts, setOpts] = useState<Record<string, string>>(() => Object.fromEntries((cfg.options ?? []).map((o) => [o.key, o.choices[0].value])));
  const [nameErr, setNameErr] = useState(false);
  const install = useInstallPrompt();

  const go = (k: 'host' | 'join' | 'solo', arg?: string | number) => {
    if (!profile.name.trim()) { setNameErr(true); sfx.pop(); return; }
    sfx.tap(); onStart(k, arg, opts);
  };

  return (
    <div className="screen home shell-home">
      <Backdrop />
      <div className="topbar"><a className="btn ghost sm" href={import.meta.env.BASE_URL}>← All games</a>{install && <button className="btn glass sm" onClick={install}>⬇ Install</button>}</div>
      <header className="shell-hero">
        <div className="shell-art">{cfg.hero}</div>
        <small>{cfg.kind}</small>
        <h1>{cfg.name}</h1>
        <p>{cfg.tagline}</p>
      </header>
      <AccountBar onAdmin={() => (location.href = import.meta.env.BASE_URL + '?admin=1')} />
      <section className="card profile">
        <div className="avatar-row">
          {AVATARS.map((a) => (
            <button key={a} className={`av ${a === profile.avatar ? 'on' : ''}`} onClick={() => { sfx.tap(); onProfile({ ...profile, avatar: a }); }}>
              <Avatar id={a} size={46} /><small>{charOf(a).name}</small>
            </button>
          ))}
        </div>
        <input className={`name ${nameErr ? 'err' : ''}`} placeholder="Your name" maxLength={14} value={profile.name}
          onChange={(e) => { setNameErr(false); onProfile({ ...profile, name: e.target.value }); }} />
      </section>
      {error && <div className="banner err">{error}</div>}
      <section className="actions">
        <button className="btn primary big" onClick={() => go('host')}><span className="ic">✦</span> Create Room</button>
        <button className={`btn glass big ${panel === 'join' ? 'active' : ''}`} onClick={() => setPanel(panel === 'join' ? null : 'join')}><span className="ic">⇥</span> Join Room</button>
        {panel === 'join' && (
          <form className="card drawer" onSubmit={(e) => { e.preventDefault(); if (code.length >= 5) go('join', code); }}>
            <input className="code-input" placeholder="CODE" maxLength={5} autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
            <button className="btn primary" disabled={code.length < 5}>Join</button>
          </form>
        )}
        <button className={`btn glass big ${panel === 'solo' ? 'active' : ''}`} onClick={() => setPanel(panel === 'solo' ? null : 'solo')}><span className="ic">🤖</span> Play vs Bots</button>
        {panel === 'solo' && (
          <div className="card drawer col">
            <div className="seg">{[1, 2, 3].map((n) => <button key={n} className={bots === n ? 'on' : ''} onClick={() => setBots(n)}>{n} bot{n > 1 ? 's' : ''}</button>)}</div>
            <OptionPickers cfg={cfg} values={opts} onChange={(k, v) => setOpts({ ...opts, [k]: v })} />
            <button className="btn primary" onClick={() => go('solo', bots)}>Start</button>
          </div>
        )}
      </section>
      {adsEnabled() && <BannerStrip />}
      <footer className="foot">© Sarvimo · Free to play</footer>
    </div>
  );
}

function OptionPickers<G, A>({ cfg, values, onChange, disabled }: { cfg: ShellConfig<G, A>; values: Record<string, string>; onChange(k: string, v: string): void; disabled?: boolean }) {
  return (
    <>
      {(cfg.options ?? []).map((o) => (
        <div key={o.key} className="timer-pick">
          <span>{o.label}</span>
          <div className="modes">
            {o.choices.map((c) => (
              <button key={c.value} disabled={disabled} className={`mode ${values[o.key] === c.value ? 'on' : ''}`} onClick={() => { sfx.tap(); onChange(o.key, c.value); }}>
                <b>{c.label}</b>{c.hint && <small>{c.hint}</small>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

// ---------------- lobby ----------------
function ShellLobby<G, A>({ cfg, session, room, code, status, onLeave }: {
  cfg: ShellConfig<G, A>; session: RoomSession<A>; room: RoomState<G> | null; code: string; status: { st: Status; msg?: string }; onLeave(): void;
}) {
  const [copied, setCopied] = useState(false);
  const isHost = room?.hostId === session.myId;
  const players = room?.players ?? [];
  const link = `${location.origin}${import.meta.env.BASE_URL}${cfg.slug}?room=${code}`;
  const copy = async () => { try { await navigator.clipboard.writeText(code); } catch { /* blocked */ } sfx.pop(); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const share = async () => {
    const text = `Play ${cfg.name} with me! Code: ${code}`;
    if (navigator.share) { try { await navigator.share({ title: cfg.name, text, url: link }); } catch { /* cancelled */ } }
    else window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`, '_blank');
  };
  const max = cfg.rules.maxPlayers;
  return (
    <div className="screen lobby">
      <Backdrop />
      <div className="topbar">
        <button className="btn ghost sm" onClick={onLeave}>← Leave</button>
        <span className={`dot ${status.st}`}>{status.st === 'online' ? 'Live' : status.st === 'connecting' ? 'Connecting…' : status.msg ?? status.st}</span>
      </div>
      <section className="room-code card">
        <small>{cfg.name.toUpperCase()} · ROOM CODE</small>
        {code ? <button className="code" onClick={copy}>{code.split('').map((ch, i) => <span key={i} style={{ animationDelay: `${i * 70}ms` }}>{ch}</span>)}</button>
          : <div className="code loading"><span className="spinner" /></div>}
        <div className="row">
          <button className="btn glass sm" onClick={copy} disabled={!code}>{copied ? '✓ Copied' : '⧉ Copy'}</button>
          <button className="btn primary sm" onClick={share} disabled={!code}>↗ Invite friends</button>
        </div>
      </section>
      <section className="seats">
        {Array.from({ length: max }, (_, i) => {
          const p = players[i];
          return (
            <div key={i} className={`seat ${p ? 'filled' : ''}`} style={{ ['--c' as string]: SEAT_COLORS[i] }}>
              {p ? (<>
                <div className="seat-av"><Avatar id={p.avatar} size={52} /></div>
                <div className="seat-name">{p.name}{p.id === session.myId && <em> (you)</em>}</div>
                <div className="seat-tag">{p.id === room?.hostId ? '👑 Host' : p.bot ? 'Bot' : 'Ready'}</div>
                {isHost && p.id !== room?.hostId && <button className="kick" onClick={() => session.act({ t: 'kick', id: p.id })}>✕</button>}
              </>) : (<>
                <div className="seat-av empty">?</div><div className="seat-name dim">Waiting…</div>
                {isHost && <button className="btn ghost xs" onClick={() => session.act({ t: 'addBot' })}>+ Add bot</button>}
              </>)}
            </div>
          );
        })}
      </section>
      {room && (
        <section className="card lobby-mode">
          <OptionPickers cfg={cfg} values={room.options} disabled={!isHost} onChange={(k, v) => session.act({ t: 'opt', key: k, value: v })} />
          <div className="timer-pick">
            <span>⏱ Time per turn</span>
            <div className="seg">{TIMER_CHOICES.map((ms) => <button key={ms} disabled={!isHost} className={room.turnMs === ms ? 'on' : ''} onClick={() => session.act({ t: 'timer', ms })}>{ms / 1000}s</button>)}</div>
          </div>
        </section>
      )}
      {isHost
        ? <button className="btn primary big start" disabled={players.length < 2} onClick={() => { sfx.turn(); session.act({ t: 'start' }); }}>{players.length < 2 ? 'Waiting for players…' : `Start game · ${players.length} players`}</button>
        : <div className="waiting-host"><span className="spinner" /> Waiting for host to start</div>}
      {adsEnabled() && <BannerStrip />}
    </div>
  );
}

// ---------------- game ----------------
function ShellGame<G, A>({ cfg, session, room, game, status, emotes, profile, onProfile, onLeave, withAd }: {
  cfg: ShellConfig<G, A>; session: RoomSession<A>; room: RoomState<G>; game: G; status: { st: Status; msg?: string }; emotes: Emote[];
  profile: Profile; onProfile(p: Profile): void; onLeave(): void; withAd(then: () => void): void;
}) {
  const me = session.myId;
  const confettiRef = useRef<ConfettiHandle>(null);
  const [muted, setMute] = useState(isMuted());
  const [picker, setPicker] = useState(false);
  const [troll, setTroll] = useState<Emote | null>(null);
  const [moods, setMoods] = useState<Record<string, { m: Mood; id: number }>>({});
  const lastTroll = useRef(0);
  const left = useCountdown(room, cfg.rules.turnKey(game));
  const waiting = cfg.rules.waitingOn(game);
  const waitingP = room.players.find((p) => p.id === waiting);
  const urgent = room.phase === 'playing' && !!waitingP && !waitingP.bot && waitingP.connected && left > 0 && left <= 5000;
  const secs = Math.ceil(left / 1000);
  const mine = waiting === me;
  const color = (pid: string) => SEAT_COLORS[Math.max(0, room.players.findIndex((p) => p.id === pid))];

  useEffect(() => { if (urgent) sfx.tick(mine); }, [urgent, secs, mine]);
  useEffect(() => { if (mine && room.phase === 'playing') sfx.turn(); }, [mine, cfg.rules.turnKey(game)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const e = emotes.at(-1);
    if (!e || e.id === lastTroll.current || trollIndex(e.emoji) < 0) return;
    lastTroll.current = e.id; setTroll(e); sfx.troll();
    if (trollTarget(e.emoji) === me) buzz([60, 40, 60]);
    const t = setTimeout(() => setTroll((c) => (c?.id === e.id ? null : c)), 2800);
    return () => clearTimeout(t);
  }, [emotes, me]);

  const setMood = useCallback((pid: string, m: Mood, ms = 3800) => {
    const id = Date.now() + Math.random();
    setMoods((s) => ({ ...s, [pid]: { m, id } }));
    setTimeout(() => setMoods((s) => (s[pid]?.id === id ? { ...s, [pid]: { m: null, id } } : s)), ms);
  }, []);

  // Results + XP once per game.
  const [result, setResult] = useState<string[] | null>(null);
  useEffect(() => {
    if (room.phase !== 'over') { setResult(null); return; }
    const t = setTimeout(() => {
      const rank = cfg.rules.ranking(game);
      setResult(rank);
      const place = rank.indexOf(me) + 1;
      if (place) onProfile(recordGame(profile, place, rank.length, 0).profile);
      if (place === 1) { sfx.win(); [0, 400, 800].forEach((d) => setTimeout(() => confettiRef.current?.burst(innerWidth / 2, innerHeight * 0.35, SEAT_COLORS, 150), d)); } else sfx.lose();
    }, 1600);
    return () => clearTimeout(t);
  }, [room.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const props: GameProps<G, A> = {
    session, room, game, me, color, left,
    mood: (pid) => moods[pid]?.m ?? null, setMood,
    confetti: (x, y, c, n) => confettiRef.current?.burst(x, y, c, n),
    act: (a) => session.act({ t: 'game', a }),
  };

  return (
    <div className="screen game shell-game" style={{ ['--turn' as string]: waiting ? color(waiting) : '#fff' }}>
      <Backdrop />
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => { if (room.phase === 'over' || confirm('Leave this game?')) onLeave(); }}>✕</button>
        <div className="room-chip">{session.local ? `${cfg.name} · Practice` : `${cfg.name} · ${session.code}`}</div>
        <button className="btn ghost sm" onClick={() => { setMuted(!muted); setMute(!muted); }}>{muted ? '🔇' : '🔊'}</button>
      </div>
      {status.st === 'reconnecting' && <div className="banner warn">{status.msg}</div>}
      {adsEnabled() && <BannerStrip />}
      <div className="shell-board">
        {urgent && <div className={`big-count ${mine ? 'mine' : ''}`} key={secs}>{secs}</div>}
        <cfg.Board {...props} />
      </div>
      <button className="troll-open floating" onClick={() => { sfx.tap(); setPicker(true); }}>😈<small>Troll</small></button>
      {picker && <TrollPicker targets={room.players.filter((p) => p.id !== me).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: color(p.id) }))}
        onClose={() => setPicker(false)} onPick={(m) => { setPicker(false); session.emote(m); }} />}
      {troll && (() => {
        const from = room.players.find((x) => x.id === troll.from);
        const victim = room.players.find((x) => x.id === trollTarget(troll.emoji)) ?? from;
        return from && victim ? <TrollOverlay key={troll.id} troll={trollIndex(troll.emoji)} avatar={victim.avatar}
          name={victim.id === me ? 'YOU' : victim.name} by={from.id === me ? 'You' : from.name} color={color(victim.id)} /> : null;
      })()}
      {result && (
        <div className="overlay">
          <div className="results card">
            <div className="crown">{result[0] === me ? '👑' : '🎲'}</div>
            <h2>{result[0] === me ? 'Victory!' : `${room.players.find((p) => p.id === result[0])?.name} wins!`}</h2>
            <ol className="podium">
              {result.map((id, i) => {
                const p = room.players.find((x) => x.id === id);
                return p ? <li key={id} className={id === me ? 'me' : ''} style={{ ['--c' as string]: color(id), animationDelay: `${i * 120}ms` }}>
                  <span>{['🥇', '🥈', '🥉', '4️⃣'][i]}</span><span className="av"><Avatar id={p.avatar} size={34} mood={i === 0 ? 'cool' : null} /></span><b>{p.name}</b>
                </li> : null;
              })}
            </ol>
            <div className="row">
              {room.hostId === me ? <button className="btn primary" onClick={() => withAd(() => session.act({ t: 'rematch' }))}>↻ Rematch</button> : <div className="dim small">Waiting for host…</div>}
              <button className="btn glass" onClick={onLeave}>Home</button>
            </div>
          </div>
        </div>
      )}
      <Confetti ref={confettiRef} />
    </div>
  );
}

function useCountdown<G>(room: RoomState<G>, key: string) {
  const [left, setLeft] = useState(room.turnLeftMs);
  useEffect(() => {
    const deadline = Date.now() + room.turnLeftMs;
    setLeft(room.turnLeftMs);
    const t = setInterval(() => setLeft(Math.max(0, deadline - Date.now())), 250);
    return () => clearInterval(t);
  }, [room.turnLeftMs, key]);
  return left;
}

interface BIPEvent extends Event { prompt(): Promise<void> }
export function useInstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    addEventListener('beforeinstallprompt', h);
    return () => removeEventListener('beforeinstallprompt', h);
  }, []);
  return evt ? () => { evt.prompt(); setEvt(null); } : null;
}

/** Small player chip used on boards. */
export function PlayerChip({ name, avatar, color, active, mood, children }: { name: string; avatar: string; color: string; active: boolean; mood: Mood; children?: ReactNode }) {
  return (
    <div className={`pchip ${active ? 'turn' : ''}`} style={{ ['--c' as string]: color }}>
      <div className="pav"><Avatar id={avatar} size={34} hyped={active} mood={mood} /></div>
      <div className="pinfo"><div className="pname">{name}</div><div className="pmeta">{children}</div></div>
    </div>
  );
}
