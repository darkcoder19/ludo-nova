import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Dice } from '../components/Dice';
import { buzz, sfx } from '../game/sound';
import type { GameProps } from '../shared/GameShell';
import { BAIL, BOARD, BUILD_LEVELS, GROUPS, MAX_BUILD, RENT_MULT, buildIcon, fmt } from './data';
import { canBuild, groupSquares, netWorth, nextBuildCost, ownsGroup, rentFor, sellValue, type DAction, type DGame } from './rules';

// Board is a 12×12-unit square: 1.5-unit corners, 1-unit edge squares.
const C = 1.5, S = 12;
/** Grid placement (1-based row/col in an 11×11 CSS grid) for square i. */
function cell(i: number): { r: number; c: number; side: 'b' | 'l' | 't' | 'r' | 'corner' } {
  if (i === 0) return { r: 11, c: 11, side: 'corner' };
  if (i < 10) return { r: 11, c: 11 - i, side: 'b' };
  if (i === 10) return { r: 11, c: 1, side: 'corner' };
  if (i < 20) return { r: 11 - (i - 10), c: 1, side: 'l' };
  if (i === 20) return { r: 1, c: 1, side: 'corner' };
  if (i < 30) return { r: 1, c: 1 + (i - 20), side: 't' };
  if (i === 30) return { r: 1, c: 11, side: 'corner' };
  return { r: 1 + (i - 30), c: 11, side: 'r' };
}
const unit = (k: number) => (k === 1 ? C / 2 : k === 11 ? S - C / 2 : C + (k - 2) + 0.5);
/** Centre of square i in % of the board. */
const centre = (i: number): [number, number] => { const { r, c } = cell(i); return [(unit(c) / S) * 100, (unit(r) / S) * 100]; };
/** Where tokens park: on the tile's inner edge, so its name and price stay readable. */
function park(i: number, k: number, n: number): [number, number] {
  const [x, y] = centre(i), { side } = cell(i), u = 100 / S;
  const spread = (k - (n - 1) / 2) * 1.9;
  if (side === 'b') return [x + spread, y - 0.78 * u];
  if (side === 't') return [x + spread, y + 0.78 * u];
  if (side === 'l') return [x + 0.82 * u, y + spread];
  if (side === 'r') return [x - 0.82 * u, y + spread];
  return [x + (x < 50 ? 1 : -1) * 0.8 * u + spread, y + (y < 50 ? 1 : -1) * 0.8 * u];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Floater { id: number; pid: string; text: string; good: boolean }

export function DhandhaBoard({ room, game, me, color, mood, setMood, confetti, act }: GameProps<DGame, DAction>) {
  const [shown, setShown] = useState<Record<string, number>>(() => ({ ...game.pos }));
  const [zoom, setZoom] = useState(false);
  const [peek, setPeek] = useState<number | null>(null);
  const [manage, setManage] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [flash, setFlash] = useState<{ sq: number; kind: string; id: number } | null>(null);
  const [settled, setSettled] = useState(true);
  const lastMove = useRef(game.move?.id ?? 0);
  const seenFx = useRef(new Set<number>());
  const scroller = useRef<HTMLDivElement>(null);

  const cur = game.order[game.turn];
  const mine = cur === me;
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '?';
  const avatarOf = (pid: string) => room.players.find((p) => p.id === pid)?.avatar ?? 'c0';

  // Walk tokens square by square.
  useEffect(() => {
    const m = game.move;
    if (!m) { setShown({ ...game.pos }); return; }
    if (m.id === lastMove.current) return;
    lastMove.current = m.id;
    let alive = true;
    (async () => {
      await sleep(650);
      if (m.jump) { sfx.pop(); setShown((s) => ({ ...s, [m.pid]: m.to })); return; }
      const steps = (m.to - m.from + 40) % 40;
      for (let k = 1; k <= steps && alive; k++) { setShown((s) => ({ ...s, [m.pid]: (m.from + k) % 40 })); sfx.step(); await sleep(170); }
    })();
    return () => { alive = false; };
  }, [game.move, game.pos]);

  // Money, buying, building, jail and bankruptcy effects.
  useEffect(() => {
    const fresh = game.fx.filter((f) => !seenFx.current.has(f.id));
    if (!fresh.length) return;
    fresh.forEach((f) => seenFx.current.add(f.id));
    const t = setTimeout(() => {
      const add: Floater[] = [];
      for (const f of fresh) {
        if (f.kind === 'pay' && f.amount) { add.push({ id: f.id, pid: f.pid, text: `−${fmt(f.amount)}`, good: false }); if (f.amount >= 800) setMood(f.pid, 'sad'); if (f.pid === me) buzz(60); sfx.capture(); }
        if (f.kind === 'earn' && f.amount) { add.push({ id: f.id, pid: f.pid, text: `+${fmt(f.amount)}`, good: true }); if (f.amount >= 500) setMood(f.pid, 'cool'); }
        if (f.kind === 'salary') { add.push({ id: f.id, pid: f.pid, text: `+${fmt(f.amount!)} salary`, good: true }); sfx.six(); }
        if (f.kind === 'buy') { setFlash({ sq: f.sq!, kind: 'sold', id: f.id }); setMood(f.pid, 'cool'); sfx.home(); confetti(innerWidth / 2, innerHeight / 2, [color(f.pid), '#ffd23f'], 40); }
        if (f.kind === 'build') { setFlash({ sq: f.sq!, kind: 'build', id: f.id }); sfx.home(); }
        if (f.kind === 'pot') { add.push({ id: f.id, pid: f.pid, text: `☕ +${fmt(f.amount!)}`, good: true }); setMood(f.pid, 'cool'); confetti(innerWidth / 2, innerHeight / 2, ['#ffd23f', '#ffb400', '#fff'], 120); sfx.win(); }
        if (f.kind === 'jail') { setMood(f.pid, 'sad', 5000); sfx.captured(); }
        if (f.kind === 'bankrupt') { setMood(f.pid, 'sad', 8000); sfx.lose(); buzz([100, 60, 200]); }
        if (f.kind === 'trend') sfx.turn();
        if (f.kind === 'cardSold') { add.push({ id: f.id, pid: f.pid, text: `🏦 +${fmt(f.amount!)}`, good: true }); sfx.pop(); }
      }
      if (add.length) {
        setFloaters((l) => [...l, ...add]);
        setTimeout(() => setFloaters((l) => l.filter((x) => !add.includes(x))), 1800);
      }
    }, game.move ? 0 : 400);
    return () => clearTimeout(t);
  }, [game.fx]); // eslint-disable-line react-hooks/exhaustive-deps

  // In zoom mode keep the moving token in view.
  useEffect(() => {
    if (!zoom || !scroller.current) return;
    const [x, y] = centre(shown[cur] ?? 0), el = scroller.current;
    el.scrollTo({ left: (x / 100) * el.scrollWidth - el.clientWidth / 2, top: (y / 100) * el.scrollHeight - el.clientHeight / 2, behavior: 'smooth' });
  }, [shown, zoom, cur]);

  const here = game.pos[cur];
  const sq = BOARD[here];
  const jailed = game.jail[cur] > 0;
  const myProps = BOARD.map((_, i) => i).filter((i) => game.owner[i] === me);
  const ready = mine && settled;

  // Tokens per square, fanned out when shared.
  const bySq = new Map<number, string[]>();
  game.order.filter((id) => !game.out.includes(id)).forEach((id) => { const s = shown[id] ?? 0; bySq.set(s, [...(bySq.get(s) ?? []), id]); });

  return (
    <div className="dk">
      <div className="dk-players">
        {room.players.map((p) => {
          const out = game.out.includes(p.id);
          return (
            <div key={p.id} className={`dk-p ${cur === p.id ? 'turn' : ''} ${out ? 'out' : ''}`} style={{ ['--c' as string]: color(p.id) }}>
              <div className="pav"><Avatar id={p.avatar} size={34} mood={out ? 'sad' : mood(p.id)} hyped={cur === p.id} />{game.jail[p.id] > 0 && <i className="bars" />}</div>
              <div className="dk-pinfo">
                <b>{p.name}</b>
                <span className="cash">{out ? 'Bankrupt' : fmt(game.cash[p.id])}</span>
              </div>
              {floaters.filter((f) => f.pid === p.id).map((f) => <span key={f.id} className={`floater ${f.good ? 'good' : 'bad'}`}>{f.text}</span>)}
            </div>
          );
        })}
      </div>

      <div className={`dk-scroll ${zoom ? 'zoomed' : ''}`} ref={scroller}>
        <div className="dk-board">
          {BOARD.map((s, i) => {
            const { r, c, side } = cell(i);
            const o = game.owner[i];
            const g = s.group != null ? GROUPS[s.group] : null;
            const trending = s.group === game.trending;
            return (
              <button key={i} className={`dk-sq ${side} k-${s.kind} ${o ? 'owned' : ''} ${game.mort[i] ? 'mort' : ''} ${trending ? 'trend' : ''} ${flash?.sq === i ? `flash-${flash.kind}` : ''} ${here === i ? 'here' : ''}`}
                style={{ gridRow: r, gridColumn: c, ['--g' as string]: g?.color ?? 'transparent', ['--o' as string]: o ? color(o) : 'transparent' }}
                onClick={() => { sfx.tap(); setPeek(i); }}>
                {g && <i className="bar">{game.build[i] > 0 && <em className={game.build[i] >= 4 ? 'mall' : ''}>{buildIcon(game.build[i])}</em>}</i>}
                {s.icon && <span className="ic">{s.icon}</span>}
                <span className="nm">{s.short}</span>
                {s.price && !o && <span className="pr">{fmt(s.price)}</span>}
                {o && <span className="own" title={name(o)} />}
                {trending && <span className="fire">🔥</span>}
              </button>
            );
          })}

          {/* centre */}
          <div className="dk-centre">
            <div className="dk-brand"><b>Dhandha<em>King</em></b><small>Round {game.round}{game.maxRounds ? ` / ${game.maxRounds}` : ''}</small></div>
            <div className="dk-pills">
              <span className="pill trend" style={{ ['--g' as string]: GROUPS[game.trending].color }}>🔥 {GROUPS[game.trending].name} rent ×2</span>
              <span className="pill pot">☕ Chai pot {fmt(game.pot)}</span>
            </div>
            <div className="dk-dice">
              <Dice value={game.dice[0]} rollId={game.rollId} color={color(cur)} ready={ready && game.phase === 'roll'} onRoll={() => { setSettled(false); act({ t: 'roll' }); }} onSettled={() => setSettled(true)} />
              <Dice value={game.dice[1]} rollId={game.rollId} color={color(cur)} ready={ready && game.phase === 'roll'} onRoll={() => { setSettled(false); act({ t: 'roll' }); }} />
            </div>
            <div className="dk-note" key={game.note}>{game.note}</div>

            <div className="dk-actions">
              {!mine && <span className="dim">{name(cur)} is thinking…</span>}
              {mine && game.phase === 'roll' && (<>
                {myProps.length > 0 && <button className="btn glass sm" onClick={() => setManage(true)}>🃏 Cards ({myProps.length})</button>}
                {jailed && game.jugaad[me] > 0 && <button className="btn glass sm" onClick={() => act({ t: 'jugaad' })}>😎 Jugaad card</button>}
                {jailed && <button className="btn glass sm" disabled={game.cash[me] < BAIL} onClick={() => act({ t: 'bail' })}>Pay bail {fmt(BAIL)}</button>}
                <button className="btn primary sm" disabled={!settled} onClick={() => { setSettled(false); act({ t: 'roll' }); }}>🎲 Roll{jailed ? ' for doubles' : ''}</button>
              </>)}
              {mine && game.phase === 'end' && (<>
                {myProps.length > 0 && <button className="btn glass sm" onClick={() => setManage(true)}>🃏 My cards ({myProps.length})</button>}
                <button className="btn primary sm" onClick={() => act({ t: 'end' })}>{game.again ? '🎲 Roll again' : 'End turn ›'}</button>
              </>)}
              {mine && game.phase === 'moving' && <span className="dim">Moving…</span>}
            </div>
          </div>

          {/* tokens */}
          {[...bySq.entries()].flatMap(([s, ids]) => ids.map((id, k) => {
            const [x, y] = park(s, k, ids.length);
            return (
              <div key={id} className={`dk-tok ${cur === id ? 'cur' : ''}`} style={{ left: `${x}%`, top: `${y}%`, ['--c' as string]: color(id) }}>
                <Avatar id={avatarOf(id)} size={28} mood={mood(id)} hyped={cur === id} />
              </div>
            );
          }))}
        </div>
      </div>

      <button className="zoom-btn" onClick={() => setZoom(!zoom)}>{zoom ? '⤡ Fit' : '🔍 Zoom'}</button>

      {mine && game.phase === 'buy' && sq.price && (
        <div className="dk-sheet">
          <Deed i={here} game={game} name={name} />
          <div className="row">
            <button className="btn glass" onClick={() => act({ t: 'pass' })}>Pass</button>
            <button className="btn primary" disabled={game.cash[me] < sq.price} onClick={() => act({ t: 'buy' })}>Buy for {fmt(sq.price)}</button>
          </div>
          {game.cash[me] < sq.price && <small className="dim">Not enough cash — you have {fmt(game.cash[me])}</small>}
        </div>
      )}

      {game.phase === 'card' && game.card && (
        <div className="dk-card-ov">
          <div className={`dk-card ${game.card.deck}`}>
            <small>{game.card.deck === 'kismat' ? '🎲 KISMAT' : '👪 PARIVAAR'}</small>
            <h3>{game.card.title}</h3>
            <p>{game.card.text}</p>
            {mine ? <button className="btn primary" onClick={() => act({ t: 'cardOk' })}>OK</button> : <span className="dim">{name(cur)} drew this</span>}
          </div>
        </div>
      )}

      {flash?.kind === 'sold' && <div className="sold-stamp" key={flash.id}>SOLD!</div>}

      {peek !== null && !manage && (
        <div className="dk-sheet peek" onClick={() => setPeek(null)}>
          <Deed i={peek} game={game} name={name} />
          <small className="dim">Tap anywhere to close</small>
        </div>
      )}

      {manage && (
        <div className="dk-manage" onClick={() => setManage(false)}>
          <div className="card hand" onClick={(e) => e.stopPropagation()}>
            <div className="row-between"><b>🃏 My city cards · {fmt(game.cash[me])}</b><button className="btn ghost xs" onClick={() => setManage(false)}>✕</button></div>
            <small className="dim">Own every city in a colour to build: 3 houses → hotel → villa. Net worth {fmt(netWorth(game, me))}</small>
            <div className="hand-row">
              {myProps.map((i) => {
                const s = BOARD[i], g = s.group != null ? GROUPS[s.group] : null;
                const full = g && ownsGroup(game, me, s.group!);
                const can = mine && (game.phase === 'end' || game.phase === 'roll');
                return (
                  <div key={i} className={`hcard ${game.mort[i] ? 'mort' : ''}`} style={{ ['--g' as string]: g?.color ?? '#9b6bff' }}>
                    <div className="hc-top">{s.icon ?? '🏙️'}<b>{s.name}</b><small>{g?.name ?? (s.kind === 'train' ? 'Railway' : 'Utility')}</small></div>
                    <div className="hc-mid">
                      {g && <div className="hc-build">{game.build[i] ? buildIcon(game.build[i]) : '🟫'}<small>{BUILD_LEVELS[game.build[i]]}</small></div>}
                      <div className="hc-rent">Rent now <b>{fmt(rentFor(game, i, 7))}</b></div>
                      {g && !full && <small className="dim">Collect all {groupSquares(s.group!).length} {g.name} cities to build</small>}
                      {game.mort[i] && <small className="girvi">GIRVI · mortgaged</small>}
                    </div>
                    <div className="hc-actions">
                      {g && game.build[i] < MAX_BUILD && <button className="btn primary xs" disabled={!can || !canBuild(game, me, i)} onClick={() => act({ t: 'build', sq: i })}>+ {BUILD_LEVELS[game.build[i] + 1].replace(/^d /, '')} {fmt(nextBuildCost(game, i))}</button>}
                      {game.build[i] > 0 && <button className="btn glass xs" disabled={!can} onClick={() => act({ t: 'sell', sq: i })}>Sell building</button>}
                      {!game.build[i] && (game.mort[i]
                        ? <button className="btn glass xs" disabled={!can} onClick={() => act({ t: 'unmortgage', sq: i })}>Unmortgage</button>
                        : <button className="btn ghost xs" disabled={!can} onClick={() => act({ t: 'mortgage', sq: i })}>Mortgage +{fmt(s.price! / 2)}</button>)}
                      <button className="btn sell xs" disabled={!can} onClick={() => { if (confirm(`Sell the ${s.name} card to the bank for ${fmt(sellValue(game, i))}?`)) act({ t: 'sellCity', sq: i }); }}>🏦 Sell card {fmt(sellValue(game, i))}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Deed({ i, game, name }: { i: number; game: DGame; name(pid: string): string }) {
  const s = BOARD[i], g = s.group != null ? GROUPS[s.group] : null, o = game.owner[i];
  const base = s.rent ?? 0;
  return (
    <div className="deed" style={{ ['--g' as string]: g?.color ?? '#9b6bff' }}>
      <div className="deed-top">{s.icon && <span>{s.icon}</span>}<b>{s.name}</b>{g && <small>{g.name}</small>}</div>
      {s.kind === 'city' && (
        <table>
          <tbody>
            <tr><td>Rent</td><td>{fmt(base)}</td></tr>
            <tr><td>Full colour set</td><td>{fmt(base * 2)}</td></tr>
            {[1, 2, 3, 4, 5].map((n) => <tr key={n}><td>{buildIcon(n)} {BUILD_LEVELS[n]}</td><td>{fmt(base * RENT_MULT[n])}</td></tr>)}
            <tr><td>House · Hotel · Villa cost</td><td>{fmt(g!.build)} · {fmt(g!.build * 1.5)} · {fmt(g!.build * 2)}</td></tr>
          </tbody>
        </table>
      )}
      {s.kind === 'train' && <p>Rent {fmt(250)} · {fmt(500)} · {fmt(1000)} · {fmt(2000)} for 1–4 trains owned.</p>}
      {s.kind === 'utility' && <p>Rent is 40× the dice, or 100× if you own both boards.</p>}
      {s.tax && <p>Pay {fmt(s.tax)} into the Chai pot.</p>}
      {s.kind === 'chai' && <p>Land here to grab every rupee in the Chai pot: {fmt(game.pot)}.</p>}
      {s.kind === 'police' && <p>Straight to Tihar. Do not pass Shuruaat.</p>}
      {(s.kind === 'kismat' || s.kind === 'parivaar') && <p>Draw a {s.name} card. Could be shagun, could be a challan.</p>}
      {s.kind === 'start' && <p>Collect ₹2,000 salary every time you pass.</p>}
      {s.kind === 'jail' && <p>Roll doubles, pay ₹500 bail, or use a Jugaad card to get out.</p>}
      {s.price && <div className="deed-foot">{o ? <>Owned by <b>{name(o)}</b>{game.mort[i] && ' · mortgaged'}</> : <>Price <b>{fmt(s.price)}</b></>}{g && s.group === game.trending && <span className="fire"> 🔥 trending</span>}</div>}
      {g && <div className="deed-set">{groupSquares(s.group!).map((k) => <span key={k} style={{ background: game.owner[k] ? '#fff' : 'transparent' }}>{BOARD[k].short}</span>)}</div>}
    </div>
  );
}
