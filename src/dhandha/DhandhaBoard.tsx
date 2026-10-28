import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Dice } from '../components/Dice';
import { buzz, sfx } from '../game/sound';
import type { GameProps } from '../shared/GameShell';
import { BAIL, BOARD, BUILD_LEVELS, GROUPS, MAX_BUILD, RENT_MULT, buildIcon, fmt, type Card } from './data';
import { Banker, MONUMENTS, TilePic } from './Monument';
import { canBuild, groupSquares, netWorth, nextBuildCost, ownsGroup, rentFor, sellValue, type CityEvent, type DAction, type DGame, type Fx } from './rules';

// ---------------- geometry ----------------
// The 40 squares run round the edge of a grid: n along top/bottom, m down each side.
export interface Geo { n: number; m: number; K: number }
const SQUARE: Geo = { n: 9, m: 9, K: 1.5 };
const TALL: Geo = { n: 6, m: 12, K: 1.6 };  // phones
const WIDE: Geo = { n: 12, m: 6, K: 1.6 };  // PC / landscape
type Side = 'b' | 'l' | 't' | 'r' | 'corner';

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
const track = (k: number, count: number, K: number) => {
  const total = 2 * K + count;
  return (k === 1 ? K / 2 : k === count + 2 ? total - K / 2 : K + (k - 2) + 0.5) / total;
};
const centre = (i: number, g: Geo): [number, number] => { const { r, c } = cell(i, g); return [track(c, g.n, g.K) * 100, track(r, g.m, g.K) * 100]; };
/** Tokens park on the tile's inner edge so its name and price stay readable. */
function park(i: number, k: number, cnt: number, g: Geo): [number, number] {
  const [x, y] = centre(i, g), { side } = cell(i, g);
  const ux = 100 / (2 * g.K + g.n), uy = 100 / (2 * g.K + g.m);
  const sx = (k - (cnt - 1) / 2) * ux * 0.32, sy = (k - (cnt - 1) / 2) * uy * 0.32;
  if (side === 'b') return [x + sx, y - 0.55 * g.K * uy];
  if (side === 't') return [x + sx, y + 0.55 * g.K * uy];
  if (side === 'l') return [x + 0.55 * g.K * ux, y + sy];
  if (side === 'r') return [x - 0.55 * g.K * ux, y + sy];
  return [x + (x < 50 ? 1 : -1) * 0.5 * g.K * ux + sx, y + (y < 50 ? 1 : -1) * 0.5 * g.K * uy];
}

/** Picks the layout that fills the space without any scrolling: tall on phones, wide on PC. */
function useBoardFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ geo: Geo; w: number; h: number }>({ geo: SQUARE, w: 300, h: 300 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (h / w > 1.3) { const u = w / (2 * TALL.K + TALL.n); setFit({ geo: TALL, w, h: Math.min(h, u * 1.6 * (2 * TALL.K + TALL.m)) }); }
      else if (w / h > 1.3) { const u = h / (2 * WIDE.K + WIDE.m); setFit({ geo: WIDE, w: Math.min(w, u * 1.6 * (2 * WIDE.K + WIDE.n)), h }); }
      else { const s = Math.min(w, h); setFit({ geo: SQUARE, w: s, h: s }); }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...fit };
}

// ---------------- flying coins & cards ----------------
/** Animates a little chip (coins, a card…) from one element to another. */
function fly(from: Element | null, to: Element | null, html: string, delay = 0, n = 1) {
  if (!from || !to) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  for (let k = 0; k < n; k++) {
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = html;
    document.body.appendChild(el);
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    const lift = -60 - Math.random() * 40, jitter = (Math.random() - 0.5) * 30;
    el.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0 },
      { transform: `translate(${(x0 + x1) / 2 + jitter}px, ${(y0 + y1) / 2 + lift}px) scale(1.15)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${x1}px, ${y1}px) scale(0.7)`, opacity: 0.9 },
    ], { duration: 850, delay: delay + k * 90, easing: 'cubic-bezier(0.4, 0, 0.3, 1)', fill: 'backwards' }).finished.then(() => el.remove());
  }
}
const COIN = '<span class="fly-coin">₹</span>';
const CARD = (name: string, color: string) => `<span class="fly-card" style="--g:${color}">${name}</span>`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
interface Floater { id: number; pid: string; text: string; good: boolean }
type Pop = { id: number; kind: 'event' | 'land' | 'set' | 'villa' | 'eventEnd'; sq: number; pid: string; amount?: number; ev?: CityEvent };

export function DhandhaBoard({ room, game, me, color, mood, setMood, confetti, act }: GameProps<DGame, DAction>) {
  const [shown, setShown] = useState<Record<string, number>>(() => ({ ...game.pos }));
  const fit = useBoardFit();
  const geo = fit.geo;
  const [peek, setPeek] = useState<number | null>(null);
  const [manage, setManage] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [flash, setFlash] = useState<{ sq: number; kind: string; id: number } | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [bankerMood, setBankerMood] = useState<'idle' | 'happy' | 'paying'>('idle');
  const [settled, setSettled] = useState(true);
  const lastMove = useRef(game.move?.id ?? 0);
  const seenFx = useRef(new Set<number>(game.fx.map((f) => f.id)));
  const root = useRef<HTMLDivElement>(null);

  const cur = game.order[game.turn];
  const mine = cur === me;
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '?';
  const avatarOf = (pid: string) => room.players.find((p) => p.id === pid)?.avatar ?? 'c0';
  const q = (sel: string) => root.current?.querySelector(sel) ?? null;
  const chip = (pid: string) => q(`[data-pid="${pid}"]`);

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

  const pop = (p: Omit<Pop, 'id'>, ms = 3600) => {
    const id = Date.now() + Math.random();
    setPops((l) => [...l, { ...p, id }]);
    setTimeout(() => setPops((l) => l.filter((x) => x.id !== id)), ms);
  };
  const cheer = (m: 'happy' | 'paying') => { setBankerMood(m); setTimeout(() => setBankerMood('idle'), 1400); };

  // Every game effect: money, banker animations, pop-ups, moods.
  useEffect(() => {
    const fresh = game.fx.filter((f) => !seenFx.current.has(f.id));
    if (!fresh.length) return;
    fresh.forEach((f) => seenFx.current.add(f.id));
    const t = setTimeout(() => {
      const add: Floater[] = [];
      const float = (f: Fx, text: string, good: boolean) => add.push({ id: f.id, pid: f.pid, text, good });
      for (const f of fresh) {
        const sqName = f.sq != null ? BOARD[f.sq]?.name : '';
        const gcol = f.sq != null && BOARD[f.sq]?.group != null ? GROUPS[BOARD[f.sq].group!].color : '#9b6bff';
        switch (f.kind) {
          case 'pay':
            if (!f.amount) break;
            float(f, `−${fmt(f.amount)}`, false);
            if (f.other) fly(chip(f.pid), chip(f.other), COIN, 0, 4); else fly(chip(f.pid), q('[data-anchor="pot"]'), COIN, 0, 4);
            if (f.amount >= 800) setMood(f.pid, 'sad');
            if (f.pid === me) buzz(60);
            sfx.capture();
            break;
          case 'earn': if (f.amount) { float(f, `+${fmt(f.amount)}`, true); if (f.amount >= 500) setMood(f.pid, 'cool'); } break;
          case 'salary': float(f, `+${fmt(f.amount!)} salary`, true); fly(q('[data-anchor="banker"]'), chip(f.pid), COIN, 0, 5); cheer('paying'); sfx.six(); break;
          case 'buy':
            fly(chip(f.pid), q('[data-anchor="banker"]'), COIN, 0, 5);
            fly(q('[data-anchor="banker"]'), chip(f.pid), CARD(sqName, gcol), 650);
            cheer('happy');
            setTimeout(() => { setFlash({ sq: f.sq!, kind: 'sold', id: f.id }); setMood(f.pid, 'cool'); sfx.home(); }, 600);
            break;
          case 'build': fly(chip(f.pid), q('[data-anchor="banker"]'), COIN, 0, 3); setFlash({ sq: f.sq!, kind: 'build', id: f.id }); sfx.home(); cheer('happy'); break;
          case 'cardSold':
            fly(chip(f.pid), q('[data-anchor="banker"]'), CARD(sqName, gcol));
            fly(q('[data-anchor="banker"]'), chip(f.pid), COIN, 600, 5);
            float(f, `🏦 +${fmt(f.amount!)}`, true); cheer('paying'); sfx.pop();
            break;
          case 'pot':
            fly(q('[data-anchor="pot"]'), chip(f.pid), COIN, 0, 8);
            float(f, `☕ +${fmt(f.amount!)}`, true); setMood(f.pid, 'cool');
            confetti(innerWidth / 2, innerHeight / 2, ['#ffd23f', '#ffb400', '#fff'], 120); sfx.win();
            break;
          case 'jail': setMood(f.pid, 'sad', 5000); sfx.captured(); break;
          case 'bankrupt': setMood(f.pid, 'sad', 8000); sfx.lose(); buzz([100, 60, 200]); break;
          case 'land': pop({ kind: 'land', sq: f.sq!, pid: f.pid, amount: f.amount }, 2600); break;
          case 'setComplete': pop({ kind: 'set', sq: f.sq!, pid: f.pid }, 3400); confetti(innerWidth / 2, innerHeight * 0.4, [gcol, '#ffd23f', '#fff'], 160); sfx.win(); setMood(f.pid, 'cool', 5000); break;
          case 'villa': pop({ kind: 'villa', sq: f.sq!, pid: f.pid }, 3000); confetti(innerWidth / 2, innerHeight * 0.4, [gcol, '#fff'], 100); break;
          case 'event': { const ev = game.events.find((e) => e.id === f.amount); if (ev) { pop({ kind: 'event', sq: ev.sq, pid: f.pid, ev }, 5200); sfx.turn(); } break; }
          case 'eventEnd': pop({ kind: 'eventEnd', sq: f.sq!, pid: f.pid }, 2200); break;
        }
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
  const evOf = (i: number) => game.events.find((e) => e.sq === i);

  const bySq = new Map<number, string[]>();
  game.order.filter((id) => !game.out.includes(id)).forEach((id) => { const s = shown[id] ?? 0; bySq.set(s, [...(bySq.get(s) ?? []), id]); });

  const roll = () => { setSettled(false); act({ t: 'roll' }); };

  return (
    <div className="dk" ref={root}>
      <div className="dk-players">
        {room.players.map((p) => {
          const out = game.out.includes(p.id);
          return (
            <div key={p.id} data-pid={p.id} className={`dk-p ${cur === p.id ? 'turn' : ''} ${out ? 'out' : ''}`} style={{ ['--c' as string]: color(p.id) }}>
              <div className="pav"><Avatar id={p.avatar} size={34} mood={out ? 'sad' : mood(p.id)} hyped={cur === p.id} />{game.jail[p.id] > 0 && <i className="bars" />}</div>
              <div className="dk-pinfo"><b>{p.name}</b><span className="cash">{out ? 'Bankrupt' : fmt(game.cash[p.id])}</span></div>
              {floaters.filter((f) => f.pid === p.id).map((f) => <span key={f.id} className={`floater ${f.good ? 'good' : 'bad'}`}>{f.text}</span>)}
            </div>
          );
        })}
      </div>

      <div className="dk-stage">
        <div className="dk-scroll" ref={fit.ref}>
          <div className={`dk-board geo-${geo.n}x${geo.m}`} style={{ width: fit.w, height: fit.h, ['--u' as string]: `${fit.w / (2 * geo.K + geo.n)}px`, gridTemplateColumns: `${geo.K}fr repeat(${geo.n}, 1fr) ${geo.K}fr`, gridTemplateRows: `${geo.K}fr repeat(${geo.m}, 1fr) ${geo.K}fr` }}>
            {BOARD.map((s, i) => {
              const { r, c, side } = cell(i, geo);
              const o = game.owner[i];
              const g = s.group != null ? GROUPS[s.group] : null;
              const ev = evOf(i);
              return (
                <button key={i} className={`dk-sq ${side} k-${s.kind} ${o ? 'owned' : ''} ${game.mort[i] ? 'mort' : ''} ${ev ? (ev.mult > 1 ? 'boom' : 'slump') : ''} ${flash?.sq === i ? `flash-${flash.kind}` : ''} ${here === i ? 'here' : ''}`}
                  style={{ gridRow: r, gridColumn: c, ['--g' as string]: g?.color ?? 'transparent', ['--o' as string]: o ? color(o) : 'transparent' }}
                  onClick={() => { sfx.tap(); setPeek(i); }}>
                  {g && <i className="bar">{game.build[i] > 0 && <em className={game.build[i] >= 4 ? 'mall' : ''}>{buildIcon(game.build[i])}</em>}</i>}
                  <TilePic kind={s.kind} name={s.name} color={g?.color ?? '#9b6bff'} className="tile-mon" />
                  <span className="tx"><span className="nm">{s.short}</span>{s.price && !o && <span className="pr">{fmt(s.price)}</span>}</span>
                  {o && <span className="own" />}
                  {ev && <span className="evb">{ev.emoji}<b>×{ev.mult}</b></span>}
                </button>
              );
            })}

            <div className="dk-centre" style={{ gridRow: `2 / ${geo.m + 2}`, gridColumn: `2 / ${geo.n + 2}` }}>
              <div className="dk-top">
                <div className="dk-brand"><b>Dhandha<em>King</em></b><small>Round {game.round}{game.maxRounds ? ` / ${game.maxRounds}` : ''}</small></div>
                <div className="dk-bank" data-anchor="banker"><Banker mood={bankerMood} /><small>Seth-ji · Bank</small></div>
              </div>
              <div className="dk-pills">
                <span className="pill pot" data-anchor="pot">☕ Chai pot {fmt(game.pot)}</span>
                {game.events.map((e) => (
                  <button key={e.id} className={`pill ev ${e.mult > 1 ? 'boom' : 'slump'}`} onClick={() => setPeek(e.sq)}>{e.emoji} {BOARD[e.sq].short} ×{e.mult} · {e.rounds}r</button>
                ))}
              </div>
              <div className="dk-dice">
                <Dice value={game.dice[0]} rollId={game.rollId} color={color(cur)} ready={ready && game.phase === 'roll'} onRoll={roll} onSettled={() => setSettled(true)} />
                <Dice value={game.dice[1]} rollId={game.rollId} color={color(cur)} ready={ready && game.phase === 'roll'} onRoll={roll} />
              </div>
              <div className="dk-note" key={game.note}>{game.note}</div>
              <div className="dk-actions">
                {!mine && <span className="dim">{name(cur)} is thinking…</span>}
                {mine && game.phase === 'roll' && (<>
                  {myProps.length > 0 && <button className="btn glass sm" onClick={() => setManage(true)}>🃏 Cards ({myProps.length})</button>}
                  {jailed && game.jugaad[me] > 0 && <button className="btn glass sm" onClick={() => act({ t: 'jugaad' })}>😎 Jugaad</button>}
                  {jailed && <button className="btn glass sm" disabled={game.cash[me] < BAIL} onClick={() => act({ t: 'bail' })}>Shagun {fmt(BAIL)}</button>}
                  <button className="btn primary sm" disabled={!settled} onClick={roll}>🎲 Roll{jailed ? ' for doubles' : ''}</button>
                </>)}
                {mine && game.phase === 'end' && (<>
                  {myProps.length > 0 && <button className="btn glass sm" onClick={() => setManage(true)}>🃏 My cards ({myProps.length})</button>}
                  <button className="btn primary sm" onClick={() => act({ t: 'end' })}>{game.again ? '🎲 Roll again' : 'End turn ›'}</button>
                </>)}
                {mine && game.phase === 'moving' && <span className="dim">Moving…</span>}
              </div>
            </div>

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
            <button className="btn premium" disabled={game.cash[me] < sq.price} onClick={() => act({ t: 'buy' })}>🏷️ Buy for {fmt(sq.price)}</button>
          </div>
          {game.cash[me] < sq.price && <small className="dim">Not enough cash — you have {fmt(game.cash[me])}</small>}
        </div>
      )}

      {game.phase === 'card' && game.card && <FortuneCard card={game.card} mine={mine} who={name(cur)} onOk={() => act({ t: 'cardOk' })} />}

      {flash?.kind === 'sold' && <div className="sold-stamp" key={flash.id}>SOLD!</div>}

      {pops.map((p) => <PopUp key={p.id} p={p} name={name} color={color} game={game} onClose={() => setPops((l) => l.filter((x) => x.id !== p.id))} />)}

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
                    <div className="hc-top"><TilePic kind={s.kind} name={s.name} color="#fff" className="hc-mon" /><b>{s.name}</b><small>{s.kind === 'city' ? MONUMENTS[s.name]?.label : s.kind === 'train' ? 'Railway' : 'Utility'}</small></div>
                    <div className="hc-mid">
                      {g && <div className="hc-build">{game.build[i] ? buildIcon(game.build[i]) : '🟫'}<small>{BUILD_LEVELS[game.build[i]]}</small></div>}
                      <div className="hc-rent">Rent now <b>{fmt(rentFor(game, i, 7))}</b></div>
                      {g && !full && <small className="dim">Collect all {groupSquares(s.group!).length} {g.name} cities to build</small>}
                      {game.mort[i] && <small className="girvi">GIRVI · mortgaged</small>}
                    </div>
                    <div className="hc-actions">
                      {g && game.build[i] < MAX_BUILD && <button className="btn primary xs" disabled={!can || !canBuild(game, me, i)} onClick={() => act({ t: 'build', sq: i })}>+ {BUILD_LEVELS[game.build[i] + 1].replace(/^\d /, '')} {fmt(nextBuildCost(game, i))}</button>}
                      {game.build[i] > 0 && <button className="btn glass xs" disabled={!can} onClick={() => act({ t: 'sell', sq: i })}>Sell building</button>}
                      {!game.build[i] && (game.mort[i]
                        ? <button className="btn glass xs" disabled={!can} onClick={() => act({ t: 'unmortgage', sq: i })}>Unmortgage</button>
                        : <button className="btn ghost xs" disabled={!can} onClick={() => act({ t: 'mortgage', sq: i })}>Mortgage +{fmt(s.price! / 2)}</button>)}
                      <button className="btn sell xs" disabled={!can} onClick={() => { if (confirm(`Sell the ${s.name} card to Seth-ji for ${fmt(sellValue(game, i))}?`)) act({ t: 'sellCity', sq: i }); }}>🏦 Sell card {fmt(sellValue(game, i))}</button>
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

// ---------------- Kismat / Mohalla card ----------------
function cardArt(c: Card): { pic: string; tone: 'good' | 'bad' | 'move' } {
  const f = c.fx;
  if (f.t === 'cash') return f.amount > 0 ? { pic: '💰', tone: 'good' } : { pic: '🧾', tone: 'bad' };
  if (f.t === 'each') return f.amount > 0 ? { pic: '🎁', tone: 'good' } : { pic: '💸', tone: 'bad' };
  if (f.t === 'goto' || f.t === 'back') return { pic: f.t === 'back' ? '↩️' : '🚆', tone: 'move' };
  if (f.t === 'jail') return { pic: '💌', tone: 'bad' };
  if (f.t === 'free') return { pic: '🗝️', tone: 'good' };
  return { pic: '🛠️', tone: 'bad' };
}

function FortuneCard({ card, mine, who, onOk }: { card: Card; mine: boolean; who: string; onOk(): void }) {
  const { pic, tone } = cardArt(card);
  const f = card.fx;
  const amount = f.t === 'cash' ? f.amount : f.t === 'each' ? f.amount : null;
  return (
    <div className="dk-card-ov">
      <div className="deck-stack"><i /><i /><i /></div>
      <div className={`fcard ${card.deck} t-${tone}`}>
        <div className="fc-inner">
          <div className="fc-head">
            <span className="fc-deck">{card.deck === 'kismat' ? '✨ KISMAT' : '🏘️ MOHALLA'}</span>
            <span className="fc-corner">{card.deck === 'kismat' ? '🎲' : '🏘️'}</span>
          </div>
          <div className="fc-art"><span>{pic}</span></div>
          <h3>{card.title}</h3>
          <p>{card.text}</p>
          {amount != null && <div className={`fc-amt ${amount > 0 ? 'up' : 'down'}`}>{amount > 0 ? '+' : '−'}{fmt(Math.abs(amount))}{f.t === 'each' ? ' each' : ''}</div>}
          {mine ? <button className="btn primary" onClick={onOk}>{tone === 'good' ? 'Collect 🤑' : tone === 'bad' ? 'Okay 😩' : 'Let’s go 🚀'}</button> : <span className="dim">{who} drew this</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------- pop-ups ----------------
function PopUp({ p, name, color, game, onClose }: { p: Pop; name(id: string): string; color(id: string): string; game: DGame; onClose(): void }) {
  const s = BOARD[p.sq];
  const g = s?.group != null ? GROUPS[s.group] : null;
  if (p.kind === 'event' && p.ev) {
    const boom = p.ev.mult > 1;
    return (
      <div className={`evpop ${boom ? 'boom' : 'slump'}`} onClick={onClose} style={{ ['--g' as string]: g?.color ?? '#ff8c42' }}>
        <div className="evp-card">
          <small>{boom ? '📈 CITY TRENDING' : '📉 CITY SLUMP'}</small>
          <div className="evp-art"><TilePic kind="city" name={s.name} color={g?.color ?? '#ff8c42'} className="evp-mon" /><span className="evp-emoji">{p.ev.emoji}</span></div>
          <h3>{p.ev.title} in {s.name}!</h3>
          <p>{p.ev.reason}.</p>
          <div className="evp-rule">Rent here is <b>×{p.ev.mult}</b> for the next <b>{p.ev.rounds} rounds</b>{game.owner[p.sq] ? <> — great news for <b>{name(game.owner[p.sq]!)}</b></> : <> — still for sale!</>}</div>
          <small className="dim">Tap to continue</small>
        </div>
      </div>
    );
  }
  if (p.kind === 'eventEnd') return <div className="toast-pop">The buzz in {s?.name} is over — rent back to normal</div>;
  if (p.kind === 'set') return (
    <div className="evpop boom set" onClick={onClose} style={{ ['--g' as string]: g?.color ?? '#ffd23f' }}>
      <div className="evp-card"><small>👑 FULL SET</small><h3>{name(p.pid)} is the {g?.name} ka Raja!</h3>
        <div className="set-row">{groupSquares(s.group!).map((k) => <TilePic key={k} kind="city" name={BOARD[k].name} color={g!.color} className="set-mon" />)}</div>
        <p>Rent on these cities is now doubled, and houses, hotels and villas can be built.</p></div>
    </div>
  );
  if (p.kind === 'villa') return <div className="toast-pop gold">🏰 {name(p.pid)} built a VILLA in {s.name}! Rent ×90</div>;
  // landing on a special tile
  const msg: Record<string, string> = {
    tax: `${s.name}! ${fmt(p.amount ?? 0)} goes into the Chai pot ☕`,
    chai: p.amount ? `Chai Break! ${name(p.pid)} grabs the pot: ${fmt(p.amount)}` : 'Chai Break — the pot is empty, enjoy the chai',
    police: 'Shaadi Invite! Pack your bags — straight to Sasural 👵',
    jail: 'Just visiting Sasural — Saasu-ma offers you laddoos',
  };
  return (
    <div className="landpop" style={{ ['--c' as string]: color(p.pid) }}>
      <TilePic kind={s.kind} name={s.name} color="#9b6bff" className="lp-pic" />
      <span>{msg[s.kind] ?? s.name}</span>
    </div>
  );
}

// ---------------- deed ----------------
function Deed({ i, game, name }: { i: number; game: DGame; name(pid: string): string }) {
  const s = BOARD[i], g = s.group != null ? GROUPS[s.group] : null, o = game.owner[i];
  const base = s.rent ?? 0;
  const ev = game.events.find((e) => e.sq === i);
  return (
    <div className="deed v2" style={{ ['--g' as string]: g?.color ?? '#9b6bff' }}>
      <div className="deed-top">
        <TilePic kind={s.kind} name={s.name} color="#fff" className="deed-mon" />
        <b>{s.name}</b>
        <small>{s.kind === 'city' ? `${MONUMENTS[s.name]?.label} · ${g!.name}` : s.kind === 'train' ? 'Indian Railways' : s.kind === 'utility' ? 'Public utility' : 'Special tile'}</small>
        {s.price && <span className="deed-price">{fmt(s.price)}</span>}
      </div>
      {ev && <div className={`deed-ev ${ev.mult > 1 ? 'boom' : 'slump'}`}>{ev.emoji} {ev.title}: rent ×{ev.mult} for {ev.rounds} more round{ev.rounds > 1 ? 's' : ''}</div>}
      {s.kind === 'city' && (
        <div className="ladder">
          <div><span>🟫 Empty plot</span><b>{fmt(base)}</b></div>
          <div><span>👑 Full colour set</span><b>{fmt(base * 2)}</b></div>
          {[1, 2, 3, 4, 5].map((n) => <div key={n} className={game.build[i] === n ? 'now' : ''}><span>{buildIcon(n)} {BUILD_LEVELS[n]}</span><b>{fmt(base * RENT_MULT[n])}</b></div>)}
          <div className="cost"><span>Build: house · hotel · villa</span><b>{fmt(g!.build)} · {fmt(g!.build * 1.5)} · {fmt(g!.build * 2)}</b></div>
        </div>
      )}
      {s.kind === 'train' && <p>Rent {fmt(250)} · {fmt(500)} · {fmt(1000)} · {fmt(2000)} if the owner has 1–4 trains.</p>}
      {s.kind === 'utility' && <p>Rent is 40× your dice roll — or 100× if the owner has both Bijli and Jal boards.</p>}
      {s.tax && <p>Pay {fmt(s.tax)} into the Chai pot. Whoever lands on Chai Break wins it all.</p>}
      {s.kind === 'chai' && <p>Land here to grab every rupee in the Chai pot: <b>{fmt(game.pot)}</b>.</p>}
      {s.kind === 'police' && <p>A shaadi invite! Go straight to Sasural. You don’t pass START or collect salary.</p>}
      {(s.kind === 'kismat' || s.kind === 'parivaar') && <p>Draw a {s.name} card — maybe shagun, maybe a challan.</p>}
      {s.kind === 'start' && <p>Collect ₹2,000 salary from Seth-ji every time you pass.</p>}
      {s.kind === 'jail' && <p>Stuck with the in-laws: roll doubles, give Saasu-ma ₹500 shagun, or use a Jugaad card. After 3 tries you pay and leave.</p>}
      {s.price && <div className="deed-foot">{o ? <>Owned by <b>{name(o)}</b>{game.mort[i] && ' · GIRVI (mortgaged)'}</> : <>For sale from Seth-ji</>}</div>}
      {g && <div className="deed-set">{groupSquares(s.group!).map((k) => <span key={k} className={game.owner[k] ? 'own' : ''}>{BOARD[k].short}</span>)}</div>}
    </div>
  );
}
