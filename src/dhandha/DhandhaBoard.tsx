import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Dice } from '../components/Dice';
import { buzz, sfx } from '../game/sound';
import type { GameProps } from '../shared/GameShell';
import { BAIL, BOARD, BUILD_LEVELS, GROUPS, MAX_BUILD, RENT_MULT, buildIcon, fmt } from './data';
import { MONUMENTS, Monument } from './Monument';
import { canBuild, groupSquares, netWorth, nextBuildCost, ownsGroup, rentFor, sellValue, type DAction, type DGame } from './rules';

// The 40 squares run round the edge of a grid: n squares along top/bottom, m down each side.
// Square boards (PC) use 9/9; tall phone screens use 6/12 so tiles stay big with no scrolling.
export interface Geo { n: number; m: number; K: number }
const SQUARE: Geo = { n: 9, m: 9, K: 1.5 };
const TALL: Geo = { n: 6, m: 12, K: 1.6 };
type Side = 'b' | 'l' | 't' | 'r' | 'corner';

/** Grid placement (1-based row/col) for square i. */
function cell(i: number, { n, m }: Geo): { r: number; c: number; side: Side } {
  const R = m + 2, C = n + 2, c1 = n + 1, c2 = n + m + 2, c3 = 2 * n + m + 3;
  if (i === 0) return { r: R, c: C, side: 'corner' };
  if (i < c1) return { r: R, c: C - i, side: 'b' };
  if (i === c1) return { r: R, c: 1, side: 'corner' };
  if (i < c2) return { r: R - (i - c1), c: 1, side: 'l' };
  if (i === c2) return { r: 1, c: 1, side: 'corner' };
  if (i < c3) return { r: 1, c: 1 + (i - c2), side: 't' };
  if (i === c3) return { r: 1, c: C, side: 'corner' };
  return { r: 1 + (i - c3), c: C, side: 'r' };
}
/** Centre of grid track k (1-based) as a fraction, given 1fr tracks between two K-fr corners. */
const track = (k: number, count: number, K: number) => {
  const total = 2 * K + count;
  return (k === 1 ? K / 2 : k === count + 2 ? total - K / 2 : K + (k - 2) + 0.5) / total;
};
const centre = (i: number, g: Geo): [number, number] => { const { r, c } = cell(i, g); return [track(c, g.n, g.K) * 100, track(r, g.m, g.K) * 100]; };
/** Where tokens park: on the tile's inner edge, so its name and price stay readable. */
function park(i: number, k: number, cnt: number, g: Geo): [number, number] {
  const [x, y] = centre(i, g), { side } = cell(i, g);
  const ux = 100 / (2 * g.K + g.n), uy = 100 / (2 * g.K + g.m);
  const spreadX = (k - (cnt - 1) / 2) * ux * 0.32, spreadY = (k - (cnt - 1) / 2) * uy * 0.32;
  if (side === 'b') return [x + spreadX, y - 0.55 * g.K * uy];
  if (side === 't') return [x + spreadX, y + 0.55 * g.K * uy];
  if (side === 'l') return [x + 0.55 * g.K * ux, y + spreadY];
  if (side === 'r') return [x - 0.55 * g.K * ux, y + spreadY];
  return [x + (x < 50 ? 1 : -1) * 0.5 * g.K * ux + spreadX, y + (y < 50 ? 1 : -1) * 0.5 * g.K * uy];
}

/** Picks the layout and pixel size that fill the space without scrolling. */
function useBoardFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ geo: Geo; w: number; h: number }>({ geo: SQUARE, w: 300, h: 300 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (h / w > 1.3) {
        // Tall screen: fill the width and as much height as keeps tiles at most 1.6× taller than wide.
        const geo = TALL, unitW = w / (2 * geo.K + geo.n);
        setFit({ geo, w, h: Math.min(h, unitW * 1.6 * (2 * geo.K + geo.m)) });
      } else {
        const side = Math.min(w, h);
        setFit({ geo: SQUARE, w: side, h: side });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...fit };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Floater { id: number; pid: string; text: string; good: boolean }

export function DhandhaBoard({ room, game, me, color, mood, setMood, confetti, act }: GameProps<DGame, DAction>) {
  const [shown, setShown] = useState<Record<string, number>>(() => ({ ...game.pos }));
  const fit = useBoardFit();
  const geo = fit.geo;
  const [peek, setPeek] = useState<number | null>(null);
  const [manage, setManage] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [flash, setFlash] = useState<{ sq: number; kind: string; id: number } | null>(null);
  const [settled, setSettled] = useState(true);
  const lastMove = useRef(game.move?.id ?? 0);
  const seenFx = useRef(new Set<number>());

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

  const here = game.pos[cur];
  const sq = BOARD[here];
  const jailed = game.jail[cur] > 0;
  const myProps = BOARD.map((_, i) => i).filter((i) => game.owner[i] === me);
  const ready = mine && settled;

  // Tokens per square, fanned out when shared.
  const bySq = new Map<number, string[]>();
  game.order.filter((id) => !game.out.includes(id)).forEach((id) => { const s = shown[id] ?? 0; bySq.set(s, [...(bySq.get(s) ?? []), id]); });

  const controls = (
    <>
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
          {jailed && <button className="btn glass sm" disabled={game.cash[me] < BAIL} onClick={() => act({ t: 'bail' })}>Shagun to Saasu-ma {fmt(BAIL)}</button>}
          <button className="btn primary sm" disabled={!settled} onClick={() => { setSettled(false); act({ t: 'roll' }); }}>🎲 Roll{jailed ? ' for doubles' : ''}</button>
        </>)}
        {mine && game.phase === 'end' && (<>
          {myProps.length > 0 && <button className="btn glass sm" onClick={() => setManage(true)}>🃏 My cards ({myProps.length})</button>}
          <button className="btn primary sm" onClick={() => act({ t: 'end' })}>{game.again ? '🎲 Roll again' : 'End turn ›'}</button>
        </>)}
        {mine && game.phase === 'moving' && <span className="dim">Moving…</span>}
      </div>
    </>
  );

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

      <div className="dk-stage">
      <div className="dk-scroll" ref={fit.ref}>
        <div className="dk-board" style={{ width: fit.w, height: fit.h, ['--u' as string]: `${fit.w / (2 * geo.K + geo.n)}px`, gridTemplateColumns: `${geo.K}fr repeat(${geo.n}, 1fr) ${geo.K}fr`, gridTemplateRows: `${geo.K}fr repeat(${geo.m}, 1fr) ${geo.K}fr` }}>
          {BOARD.map((s, i) => {
            const { r, c, side } = cell(i, geo);
            const o = game.owner[i];
            const g = s.group != null ? GROUPS[s.group] : null;
            const trending = s.group === game.trending;
            return (
              <button key={i} className={`dk-sq ${side} k-${s.kind} ${o ? 'owned' : ''} ${game.mort[i] ? 'mort' : ''} ${trending ? 'trend' : ''} ${flash?.sq === i ? `flash-${flash.kind}` : ''} ${here === i ? 'here' : ''}`}
                style={{ gridRow: r, gridColumn: c, ['--g' as string]: g?.color ?? 'transparent', ['--o' as string]: o ? color(o) : 'transparent' }}
                onClick={() => { sfx.tap(); setPeek(i); }}>
                {g && <i className="bar">{game.build[i] > 0 && <em className={game.build[i] >= 4 ? 'mall' : ''}>{buildIcon(game.build[i])}</em>}</i>}
                {s.kind === 'city' ? <Monument city={s.name} color={g!.color} className="tile-mon" /> : s.icon && <span className="ic">{s.icon}</span>}
                <span className="tx"><span className="nm">{s.short}</span>
                {s.price && !o && <span className="pr">{fmt(s.price)}</span>}</span>
                {o && <span className="own" title={name(o)} />}
                {trending && <span className="fire">🔥</span>}
              </button>
            );
          })}

          {/* centre */}
          <div className="dk-centre" style={{ gridRow: `2 / ${geo.m + 2}`, gridColumn: `2 / ${geo.n + 2}` }}>
            <div className="dk-brand"><b>Dhandha<em>King</em></b><small>Round {game.round}{game.maxRounds ? ` / ${game.maxRounds}` : ''}</small></div>
            <div className="dk-pills">
              <span className="pill trend" style={{ ['--g' as string]: GROUPS[game.trending].color }}>🔥 {GROUPS[game.trending].name} rent ×2</span>
              <span className="pill pot">☕ Chai pot {fmt(game.pot)}</span>
            </div>
            {controls}
          </div>

          {/* tokens */}
          {[...bySq.entries()].flatMap(([s, ids]) => ids.map((id, k) => {
            const [x, y] = park(s, k, ids.length, geo);
            return (
              <div key={id} className={`dk-tok ${cur === id ? 'cur' : ''}`} style={{ left: `${x}%`, top: `${y}%`, ['--c' as string]: color(id) }}>
                <Avatar id={avatarOf(id)} size={28} mood={mood(id)} hyped={cur === id} />
              </div>
            );
          }))}
        </div>
      </div>

      </div>

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
                    <div className="hc-top">{s.kind === 'city' ? <Monument city={s.name} color="#fff" className="hc-mon" /> : <span>{s.icon}</span>}<b>{s.name}</b><small>{s.kind === 'city' ? MONUMENTS[s.name]?.label : s.kind === 'train' ? 'Railway' : 'Utility'}</small></div>
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
      <div className="deed-top">{s.kind === 'city' ? <Monument city={s.name} color="#fff" className="deed-mon" /> : s.icon && <span>{s.icon}</span>}<b>{s.name}</b>{g && <small>{MONUMENTS[s.name]?.label} · {g.name}</small>}</div>
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
      {s.kind === 'police' && <p>Your rishta is fixed! Go straight to Sasural. Do not pass Shuruaat.</p>}
      {(s.kind === 'kismat' || s.kind === 'parivaar') && <p>Draw a {s.name} card. Could be shagun, could be a challan.</p>}
      {s.kind === 'start' && <p>Collect ₹2,000 salary every time you pass.</p>}
      {s.kind === 'jail' && <p>Stuck with the in-laws! Roll doubles, give Saasu-ma ₹500 shagun, or use a Jugaad card to escape.</p>}
      {s.price && <div className="deed-foot">{o ? <>Owned by <b>{name(o)}</b>{game.mort[i] && ' · mortgaged'}</> : <>Price <b>{fmt(s.price)}</b></>}{g && s.group === game.trending && <span className="fire"> 🔥 trending</span>}</div>}
      {g && <div className="deed-set">{groupSquares(s.group!).map((k) => <span key={k} style={{ background: game.owner[k] ? '#fff' : 'transparent' }}>{BOARD[k].short}</span>)}</div>}
    </div>
  );
}
