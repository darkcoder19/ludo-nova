import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { buzz, sfx } from '../game/sound';
import type { GameProps } from '../shared/GameShell';
import { BuildingArt, GoodIcon, PlotArt } from './Art';
import { COLS, COSTS, GOOD_INFO, GOODS, LEVEL_IZZAT, LEVEL_NAME, LEVEL_YIELD, MONSOON, ORDERS, ROWS, TERRAIN_NAME, type Cost, type Good } from './data';
import { HaatGuide } from './Guide';
import {
  buyPrice, canBuild, canFill, canPlace, canUpgrade, goodsCount, haatRules, izzat, upgradeCost,
  type Bundle, type HAction, type HGame,
} from './rules';

type Sheet = { k: 'plot'; sq: number } | { k: 'mandi' } | { k: 'orders' } | { k: 'trade' } | { k: 'log' } | null;

/** Board fit: wide 7×5 on PC and landscape, turned to 5×7 on tall phone screens; square plots, no scrolling. */
function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ tall: false, cell: 60 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const tall = h > w * 1.05;
      const cols = tall ? ROWS : COLS, rows = tall ? COLS : ROWS;
      // Leave room for the board's padding (2 × 6px) and the 3px gaps between plots.
      const fitW = (w - 12 - 3 * (cols - 1)) / cols, fitH = (h - 12 - 3 * (rows - 1)) / rows;
      setFit({ tall, cell: Math.max(24, Math.floor(Math.min(fitW, fitH))) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...fit };
}

/** Flies a little chip from one element to another (harvests, coins). */
function fly(from: Element | null, to: Element | null, html: string, delay = 0) {
  if (!from || !to || document.hidden) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'hh-flyer';
  el.innerHTML = html;
  document.body.appendChild(el);
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const anim = el.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: 0 },
    { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 40}px) scale(1.2)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${x1}px, ${y1}px) scale(.7)`, opacity: 0.8 },
  ], { duration: 750, delay, easing: 'cubic-bezier(.33,0,.67,1)', fill: 'backwards' });
  anim.onfinish = anim.oncancel = () => el.remove();
}

export function CostRow({ cost, have }: { cost: Cost | Bundle; have?: Record<Good, number> & { cash?: number } }) {
  const goods = 'goods' in cost ? (cost as Cost).goods : (cost as Bundle);
  const cash = 'cash' in cost ? (cost as Cost).cash : 0;
  return (
    <span className="hh-cost">
      {GOODS.filter((k) => goods[k]).map((k) => (
        <span key={k} className={have && have[k] < (goods[k] ?? 0) ? 'short' : ''}><GoodIcon g={k} size={16} />{goods[k]}</span>
      ))}
      {cash > 0 && <span className={have?.cash != null && have.cash < cash ? 'short' : ''}>₹{cash}</span>}
    </span>
  );
}

export function HaatBoard({ room, game, me, color, mood, setMood, confetti, act, left }: GameProps<HGame, HAction>) {
  const fit = useFit();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [rules, setRules] = useState(false);
  const [card, setCard] = useState<{ id: number; c: number } | null>(null);
  const [rain, setRain] = useState<Good[]>([]);
  const [pops, setPops] = useState<{ id: number; t: string; gold?: boolean }[]>([]);
  const seenFx = useRef(new Set(game.fx.map((f) => f.id)));
  const root = useRef<HTMLDivElement>(null);

  const cur = game.order[game.turn];
  const waiting = haatRules.waitingOn(game);
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '?';
  const avatarOf = (pid: string) => room.players.find((p) => p.id === pid)?.avatar ?? 'c0';
  const myGoods = game.goods[me] ?? { cotton: 0, spice: 0, tea: 0, brick: 0, rice: 0 };
  const inGame = game.order.includes(me);
  const myAct = !game.winner && cur === me && game.phase === 'act';
  const mySetup = game.phase === 'setup' && game.setup[0] === me;
  const seat = room.players.find((p) => p.id === waiting);
  const timed = room.turnMs > 0 && !!seat && !seat.bot && seat.connected && !game.winner;
  const secs = Math.ceil(left / 1000);
  const fillable = myAct ? game.orders.map((_, i) => i).filter((i) => canFill(game, me, i)) : [];
  const q = (sel: string) => root.current?.querySelector(sel) ?? null;

  const toast = (t: string, gold = false) => {
    const id = Date.now() + Math.random();
    setPops((l) => [...l.slice(-2), { id, t, gold }]);
    setTimeout(() => setPops((l) => l.filter((x) => x.id !== id)), 2600);
  };

  // Every game effect becomes an animation: monsoon card, rain, harvests flying to their owners, builds, deliveries.
  useEffect(() => {
    const fresh = game.fx.filter((f) => !seenFx.current.has(f.id));
    if (!fresh.length) return;
    fresh.forEach((f) => seenFx.current.add(f.id));
    const monsoon = fresh.find((f) => f.kind === 'monsoon');
    const delay = monsoon ? 1300 : 0;
    if (monsoon) {
      const m = MONSOON[monsoon.n!];
      setCard({ id: monsoon.id, c: monsoon.n! });
      setTimeout(() => setCard((c) => (c?.id === monsoon.id ? null : c)), 2000);
      setRain(m.goods);
      setTimeout(() => setRain([]), 2600);
      if (m.kind === 'drought') sfx.lose(); else sfx.roll();
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    fresh.forEach((f, k) => timers.push(setTimeout(() => {
      switch (f.kind) {
        case 'harvest':
          fly(q(`[data-sq="${f.sq}"]`), q(`[data-pid="${f.pid}"]`), `<span class="g-${f.good}">+${f.n}</span>`, (k % 8) * 60);
          if (f.pid === me) sfx.step();
          break;
        case 'place': case 'build': sfx.pop(); break;
        case 'upgrade': sfx.home(); if (f.n === 3) { confetti(innerWidth / 2, innerHeight / 2, [color(f.pid), '#ffd23f', '#fff'], 70); toast(`🏰 ${name(f.pid)} built a Haveli!`, true); } break;
        case 'order': sfx.six(); toast(`📦 ${name(f.pid)} delivered ${ORDERS[f.n!].title}! +${ORDERS[f.n!].izzat} Izzat`, true); confetti(innerWidth / 2, innerHeight * 0.4, [color(f.pid), '#fff'], 50); setMood(f.pid, 'cool'); break;
        case 'trade': sfx.pop(); toast(`🤝 Deal done between ${name(f.pid)} and ${name(f.other!)}`); break;
        case 'sell': case 'buy': fly(q('[data-mandi]'), q(`[data-pid="${f.pid}"]`), '<span class="g-coin">₹</span>'); sfx.tap(); break;
        case 'win': sfx.win(); setMood(f.pid, 'cool', 6000); buzz([60, 40, 120]); break;
      }
    }, delay + (f.kind === 'harvest' ? 0 : 200))));
    return () => timers.forEach(clearTimeout);
  }, [game.fx]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapPlot = (sq: number) => {
    sfx.tap();
    // During setup a tap on a free crop plot places the free stall straight away.
    if (mySetup && !game.plots[sq].owner && GOODS.includes(game.plots[sq].t as Good)) {
      act({ t: 'place', sq });
      return;
    }
    setSheet({ k: 'plot', sq });
  };

  const cols = fit.tall ? ROWS : COLS, rows = fit.tall ? COLS : ROWS;
  const wide = !fit.tall;

  return (
    <div className={`hh ${wide ? 'wide' : 'tall'}`} ref={root}>
      <div className="hh-players">
        {room.players.filter((p) => game.order.includes(p.id)).map((p) => {
          const turn = waiting === p.id;
          return (
            <div key={p.id} data-pid={p.id} className={`hh-p ${turn ? 'turn' : ''} ${game.winner === p.id ? 'won' : ''}`} style={{ ['--c' as string]: color(p.id) }}>
              {turn && <span className="hh-turn">{p.id === me ? 'YOU' : 'TURN'}{timed && ` · ${secs}s`}</span>}
              {turn && timed && <i className={`tbar ${secs <= 5 ? 'low' : ''}`} style={{ ['--t' as string]: Math.max(0, Math.min(1, left / room.turnMs)) }} />}
              <Avatar id={p.avatar} size={32} mood={mood(p.id)} hyped={turn} />
              <div className="hh-pinfo">
                <b>{p.name}</b>
                <span><em className="iz">⭐ {izzat(game, p.id)}/{game.target}</em> <em>₹{game.cash[p.id]}</em> <em>🧺 {goodsCount(game, p.id)}</em></span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hh-main">
        <div className="hh-stage" ref={fit.ref}>
          <div className="hh-board" style={{ gridTemplateColumns: `repeat(${cols}, ${fit.cell}px)`, gridTemplateRows: `repeat(${rows}, ${fit.cell}px)`, ['--cell' as string]: `${fit.cell}px` }}>
            {game.plots.map((p, sq) => {
              const x = sq % COLS, y = Math.floor(sq / COLS);
              const col = fit.tall ? y + 1 : x + 1, row = fit.tall ? x + 1 : y + 1;
              const crop = GOODS.includes(p.t as Good);
              const glow = (mySetup && !p.owner && crop) || (myAct && canBuild(game, me, sq)) ? 'can' : myAct && canUpgrade(game, me, sq) ? 'up' : '';
              const open = myAct && !glow && canPlace(game, me, sq);
              return (
                <button key={sq} data-sq={sq} {...(p.t === 'mandi' ? { 'data-mandi': true } : {})}
                  className={`hh-plot t-${p.t} ${p.owner ? 'owned' : ''} ${p.owner === me ? 'mine' : ''} ${glow} ${open ? 'open' : ''} ${crop && rain.includes(p.t as Good) ? 'rain' : ''}`}
                  style={{ gridColumn: col, gridRow: row, ['--o' as string]: p.owner ? color(p.owner) : 'transparent' }}
                  onClick={() => (p.t === 'mandi' ? setSheet({ k: 'mandi' }) : tapPlot(sq))}>
                  <PlotArt t={p.t} />
                  {crop && <span className="hh-tag"><GoodIcon g={p.t as Good} size={Math.max(12, fit.cell * 0.22)} /></span>}
                  {p.owner && <BuildingArt level={p.level} color={color(p.owner)} />}
                  {p.owner && <span className="hh-own"><Avatar id={avatarOf(p.owner)} size={16} /></span>}
                </button>
              );
            })}
          </div>
        </div>
        {wide && (
          <aside className="hh-side">
            <OrdersPanel game={game} me={me} myAct={myAct} act={act} />
            <MandiPanel game={game} me={me} myAct={myAct} act={act} />
          </aside>
        )}
      </div>

      <div className="hh-dock">
        <div className="hh-hand">
          {GOODS.map((k) => <span key={k} className={`g-${k}`} title={GOOD_INFO[k].name}><GoodIcon g={k} size={22} /><b>{myGoods[k]}</b></span>)}
          <span className="cash">₹{game.cash[me] ?? 0}</span>
        </div>
        <div className="hh-note" key={game.note}>{game.note}</div>
        <div className="hh-actions">
          {!inGame ? <span className="dim">Watching</span>
            : game.winner ? <span className="dim">👑 {name(game.winner)} wins the haat!</span>
            : mySetup ? <span className="hint">👆 Tap a glowing plot for your free stall</span>
            : game.phase === 'setup' ? <span className="dim">{name(game.setup[0])} is picking a plot…</span>
            : game.phase === 'trade' ? (game.trade?.from === me ? <span className="dim">Waiting for {name(game.trade.to)}…</span> : <span className="dim">{name(game.trade!.to)} is considering a deal…</span>)
            : cur !== me ? <span className="dim">{name(cur)} is playing…</span>
            : game.phase === 'draw' ? <button className="btn roll-btn" onClick={() => act({ t: 'draw' })}>🌧️ Call the monsoon</button>
            : (<>
              {!wide && <button className="btn glass sm" onClick={() => setSheet({ k: 'mandi' })}>⚖️ Mandi</button>}
              {!wide && <button className={`btn sm ${fillable.length ? 'build-btn' : 'glass'}`} onClick={() => setSheet({ k: 'orders' })}>📦 Orders{fillable.length ? ` (${fillable.length})` : ''}</button>}
              <button className="btn glass sm" onClick={() => setSheet({ k: 'trade' })}>🤝 Trade</button>
              <button className="btn roll-btn sm" onClick={() => act({ t: 'end' })}>End turn ›</button>
            </>)}
          <button className="pill-btn" onClick={() => setSheet({ k: 'log' })}>📜 Log</button>
          <button className="pill-btn" onClick={() => setRules(true)}>📖 Rules</button>
          {!myAct && !wide && <button className="pill-btn" onClick={() => setSheet({ k: 'orders' })}>📦 Orders</button>}
        </div>
        {myAct && <small className="hh-hint">Tap a glowing plot to build a stall (<CostRow cost={COSTS.stall} />) or a gold one to upgrade.</small>}
      </div>

      {card && (() => {
        const m = MONSOON[card.c];
        return (
          <div className="hh-card-ov" key={card.id}>
            <div className={`hh-card k-${m.kind}`}>
              <small>{m.kind === 'drought' ? '☀️' : m.kind === 'mela' ? '🎉' : '🌧️'} MONSOON</small>
              <b>{m.title}</b>
              <div className="goods">{m.goods.length ? m.goods.map((k) => <GoodIcon key={k} g={k} size={44} />) : <span className="sun">☀️</span>}</div>
              <p>{m.text}</p>
            </div>
          </div>
        );
      })()}

      <div className="hh-toasts">{pops.map((p) => <div key={p.id} className={`hh-toast ${p.gold ? 'gold' : ''}`}>{p.t}</div>)}</div>

      {game.phase === 'trade' && game.trade?.to === me && (
        <div className="dk-manage hh-sheet-ov">
          <div className="card hh-sheet">
            <b>🤝 {name(game.trade.from)} offers you a deal</b>
            <div className="hh-deal"><div><small>You get</small><CostRow cost={game.trade.give} /></div><span>⇄</span><div><small>You give</small><CostRow cost={game.trade.get} have={myGoods} /></div></div>
            {timed && <small className="dim">⏱ {secs}s</small>}
            <div className="row">
              <button className="btn glass" onClick={() => act({ t: 'decline' })}>No thanks</button>
              <button className="btn premium" disabled={GOODS.some((k) => myGoods[k] < (game.trade!.get[k] ?? 0))} onClick={() => act({ t: 'accept' })}>Deal ✓</button>
            </div>
          </div>
        </div>
      )}

      {sheet && (
        <div className="dk-manage hh-sheet-ov" onClick={() => setSheet(null)}>
          <div className="card hh-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row-between">
              <b>{sheet.k === 'plot' ? TERRAIN_NAME[game.plots[sheet.sq].t] : sheet.k === 'mandi' ? '⚖️ Mandi' : sheet.k === 'orders' ? '📦 Orders' : sheet.k === 'trade' ? '🤝 Make a deal' : '📜 Game log'}</b>
              <button className="btn ghost xs" onClick={() => setSheet(null)}>✕</button>
            </div>
            {sheet.k === 'plot' && <PlotSheet sq={sheet.sq} game={game} me={me} myAct={myAct} mySetup={mySetup} name={name} color={color} act={(a) => { act(a); setSheet(null); }} />}
            {sheet.k === 'mandi' && <MandiPanel game={game} me={me} myAct={myAct} act={act} />}
            {sheet.k === 'orders' && <OrdersPanel game={game} me={me} myAct={myAct} act={act} />}
            {sheet.k === 'trade' && <TradeSheet game={game} me={me} room={room} color={color} onSend={(a) => { act(a); setSheet(null); }} />}
            {sheet.k === 'log' && (
              <ol className="hh-log">
                {[...game.log].reverse().map((l, k, arr) => (
                  <li key={l.id} style={{ ['--c' as string]: l.pid && game.order.includes(l.pid) ? color(l.pid) : 'rgba(255,255,255,.25)' }}>
                    {(k === 0 || arr[k - 1].r !== l.r) && <small className="round">Round {l.r}</small>}
                    <span>{l.t}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {rules && <HaatGuide start="rules" onClose={() => setRules(false)} />}
    </div>
  );
}

function PlotSheet({ sq, game, me, myAct, mySetup, name, color, act }: { sq: number; game: HGame; me: string; myAct: boolean; mySetup: boolean; name(id: string): string; color(id: string): string; act(a: HAction): void }) {
  const p = game.plots[sq];
  const crop = GOODS.includes(p.t as Good) ? (p.t as Good) : null;
  const have = { ...(game.goods[me] ?? {}), cash: game.cash[me] } as Record<Good, number> & { cash: number };
  return (
    <div className="hh-plot-sheet">
      <div className="art"><PlotArt t={p.t} />{p.owner && <BuildingArt level={p.level} color={color(p.owner)} />}</div>
      <div className="info">
        {crop ? <p>Grows <b><GoodIcon g={crop} size={16} /> {GOOD_INFO[crop].hindi}</b> ({GOOD_INFO[crop].name}). When the monsoon favours it, a stall here yields 1, a godown or haveli 2.</p>
          : p.t === 'mandi' ? <p>The market. Sell and buy goods here; every plot next to it is open to everyone.</p>
          : <p>Dry, barren land. Nothing grows and nobody can build here.</p>}
        {p.owner ? <p><b style={{ color: color(p.owner) }}>{p.owner === me ? 'Yours' : name(p.owner)}</b>: {LEVEL_NAME[p.level]} · {LEVEL_IZZAT[p.level]} Izzat · yields {LEVEL_YIELD[p.level]}</p>
          : crop && <p className="dim">Free plot. You can build here if it touches one of your plots or the Mandi.</p>}
        {mySetup && !p.owner && crop && <button className="btn premium" onClick={() => act({ t: 'place', sq })}>Place my free stall here</button>}
        {myAct && !p.owner && crop && canPlace(game, me, sq) && (
          <button className="btn premium" disabled={!canBuild(game, me, sq)} onClick={() => act({ t: 'build', sq })}>🏪 Build a stall · <CostRow cost={COSTS.stall} have={have} /></button>
        )}
        {myAct && p.owner === me && p.level < 3 && (
          <button className="btn premium" disabled={!canUpgrade(game, me, sq)} onClick={() => act({ t: 'upgrade', sq })}>
            {p.level === 1 ? '🏚️ Upgrade to Godown' : '🏰 Build a Haveli'} · <CostRow cost={upgradeCost(p.level)} have={have} />
          </button>
        )}
      </div>
    </div>
  );
}

function OrdersPanel({ game, me, myAct, act }: { game: HGame; me: string; myAct: boolean; act(a: HAction): void }) {
  const have = game.goods[me];
  return (
    <div className="hh-orders">
      <small className="dim">Deliver an order for Izzat ⭐ and cash. A new one replaces it.</small>
      {game.orders.map((o, i) => {
        const od = ORDERS[o];
        const ok = myAct && canFill(game, me, i);
        return (
          <div key={`${o}-${i}`} className={`hh-order ${ok ? 'ready' : ''}`}>
            <div><b>{od.title}</b><span className="reward">+{od.izzat} ⭐ · +₹{od.cash}</span></div>
            <CostRow cost={od.need} have={have} />
            {myAct && <button className="btn xs premium" disabled={!ok} onClick={() => act({ t: 'fill', i })}>Deliver</button>}
          </div>
        );
      })}
    </div>
  );
}

function MandiPanel({ game, me, myAct, act }: { game: HGame; me: string; myAct: boolean; act(a: HAction): void }) {
  return (
    <div className="hh-mandi">
      <small className="dim">Selling drops a price, buying raises it. Prices drift back to ₹30 every turn.</small>
      {GOODS.map((k) => (
        <div key={k} className="row-m">
          <GoodIcon g={k} size={22} />
          <span className="nm">{GOOD_INFO[k].hindi}<small>you have {game.goods[me]?.[k] ?? 0}</small></span>
          <span className="pr">₹{game.prices[k]}</span>
          {myAct && <>
            <button className="btn xs glass" disabled={!(game.goods[me]?.[k] > 0)} onClick={() => act({ t: 'sell', good: k })}>Sell ₹{game.prices[k]}</button>
            <button className="btn xs glass" disabled={(game.cash[me] ?? 0) < buyPrice(game, k)} onClick={() => act({ t: 'buy', good: k })}>Buy ₹{buyPrice(game, k)}</button>
          </>}
        </div>
      ))}
    </div>
  );
}

function TradeSheet({ game, me, room, color, onSend }: { game: HGame; me: string; room: GameProps<HGame, HAction>['room']; color(id: string): string; onSend(a: HAction): void }) {
  const others = room.players.filter((p) => p.id !== me && game.order.includes(p.id));
  const [to, setTo] = useState(others[0]?.id ?? '');
  const [giveB, setGive] = useState<Bundle>({});
  const [getB, setGet] = useState<Bundle>({});
  const step = (b: Bundle, set: (b: Bundle) => void, k: Good, d: number, max: number) => set({ ...b, [k]: Math.max(0, Math.min(max, (b[k] ?? 0) + d)) });
  const any = (b: Bundle) => GOODS.some((k) => (b[k] ?? 0) > 0);
  return (
    <div className="hh-trade">
      <div className="gift-to">
        {others.map((p) => (
          <button key={p.id} className={to === p.id ? 'on' : ''} style={{ ['--c' as string]: color(p.id) }} onClick={() => setTo(p.id)}>
            <Avatar id={p.avatar} size={30} /><b>{p.name}</b><small>🧺 {goodsCount(game, p.id)}</small>
          </button>
        ))}
      </div>
      <div className="hh-trade-cols">
        {([['You give', giveB, setGive, true], ['You want', getB, setGet, false]] as const).map(([label, b, set, mine]) => (
          <div key={label}>
            <small>{label}</small>
            {GOODS.map((k) => (
              <div key={k} className="stepper">
                <GoodIcon g={k} size={18} />
                <button onClick={() => step(b, set, k, -1, 5)}>−</button>
                <b>{b[k] ?? 0}</b>
                <button disabled={mine && (b[k] ?? 0) >= (game.goods[me]?.[k] ?? 0)} onClick={() => step(b, set, k, 1, mine ? Math.min(5, game.goods[me]?.[k] ?? 0) : 5)}>+</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <button className="btn premium" disabled={!to || !any(giveB) || !any(getB)} onClick={() => onSend({ t: 'offer', to, give: giveB, get: getB })}>Offer the deal</button>
    </div>
  );
}
