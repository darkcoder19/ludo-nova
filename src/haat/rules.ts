// Haat Hustle rules. Pure functions run by the host; everyone else renders the state.
import type { Rules, Seat } from '../shared/room';
import {
  BUY_RISE, BUY_SPREAD, COLS, COSTS, GOOD_INFO, GOODS, LEVEL_IZZAT, LEVEL_NAME, LEVEL_YIELD, MANDI, MAX_ROUNDS, MONSOON,
  OPEN_ORDERS, ORDERS, PRICE_BASE, PRICE_MAX, PRICE_MIN, ROWS, SELL_DROP, START_CASH, type Cost, type Good, type Terrain,
} from './data';

export interface Plot { t: Terrain; owner: string | null; level: number }
export type Bundle = Partial<Record<Good, number>>;
export interface Trade { from: string; to: string; give: Bundle; get: Bundle }
export type FxKind = 'harvest' | 'monsoon' | 'place' | 'build' | 'upgrade' | 'sell' | 'buy' | 'order' | 'trade' | 'win';
export interface Fx { id: number; kind: FxKind; pid: string; sq?: number; good?: Good; n?: number; other?: string; text?: string }
export interface LogLine { id: number; r: number; t: string; pid?: string }

export interface HGame {
  order: string[];
  names: Record<string, string>;
  turn: number;
  round: number;
  target: number;
  phase: 'setup' | 'draw' | 'act' | 'trade';
  /** Who still places a free starting stall (snake order). */
  setup: string[];
  plots: Plot[];
  goods: Record<string, Record<Good, number>>;
  cash: Record<string, number>;
  orderPts: Record<string, number>;
  filled: Record<string, number>;
  prices: Record<Good, number>;
  orders: number[];
  orderDeck: number[];
  deck: number[];
  card: number | null;
  cardId: number;
  trade: Trade | null;
  acts: number;
  winner: string | null;
  fx: Fx[];
  note: string;
  log: LogLine[];
}

export type HAction =
  | { t: 'place'; sq: number } | { t: 'draw' } | { t: 'end' }
  | { t: 'build'; sq: number } | { t: 'upgrade'; sq: number }
  | { t: 'sell'; good: Good } | { t: 'buy'; good: Good } | { t: 'fill'; i: number }
  | { t: 'offer'; to: string; give: Bundle; get: Bundle } | { t: 'accept' } | { t: 'decline' };

let seq = Date.now(); // from the clock: a restarted host never reuses an id guests already saw
const fx = (g: HGame, e: Omit<Fx, 'id'>) => g.fx.push({ ...e, id: seq++ });
const cur = (g: HGame) => g.order[g.turn];
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const clone = (g: HGame): HGame => ({
  ...g, plots: g.plots.map((p) => ({ ...p })), goods: Object.fromEntries(Object.entries(g.goods).map(([k, v]) => [k, { ...v }])),
  cash: { ...g.cash }, orderPts: { ...g.orderPts }, filled: { ...g.filled }, prices: { ...g.prices }, orders: [...g.orders],
  orderDeck: [...g.orderDeck], deck: [...g.deck], setup: [...g.setup], trade: g.trade ? { ...g.trade, give: { ...g.trade.give }, get: { ...g.trade.get } } : null, fx: [],
});

// ---------- board helpers ----------
export const neighbours = (sq: number) => {
  const x = sq % COLS, y = Math.floor(sq / COLS), out: number[] = [];
  if (x > 0) out.push(sq - 1); if (x < COLS - 1) out.push(sq + 1);
  if (y > 0) out.push(sq - COLS); if (y < ROWS - 1) out.push(sq + COLS);
  return out;
};
const isGood = (t: Terrain): t is Good => (GOODS as string[]).includes(t);
export const izzat = (g: HGame, pid: string) => g.plots.reduce((s, p) => s + (p.owner === pid ? LEVEL_IZZAT[p.level] : 0), 0) + (g.orderPts[pid] ?? 0);
export const goodsCount = (g: HGame, pid: string) => GOODS.reduce((s, k) => s + (g.goods[pid]?.[k] ?? 0), 0);
export const has = (g: HGame, pid: string, b: Bundle) => GOODS.every((k) => (g.goods[pid]?.[k] ?? 0) >= (b[k] ?? 0));
export const afford = (g: HGame, pid: string, c: Cost) => has(g, pid, c.goods) && g.cash[pid] >= c.cash;
const take = (g: HGame, pid: string, b: Bundle) => { for (const k of GOODS) g.goods[pid][k] -= b[k] ?? 0; };
const give = (g: HGame, pid: string, b: Bundle) => { for (const k of GOODS) g.goods[pid][k] += b[k] ?? 0; };
export const bundleText = (b: Bundle) => GOODS.filter((k) => b[k]).map((k) => `${b[k]} ${GOOD_INFO[k].hindi}`).join(' + ') || 'nothing';

/** A new stall goes on a free crop plot next to one of yours, or next to the Mandi. */
export const canPlace = (g: HGame, pid: string, sq: number) => {
  const p = g.plots[sq];
  if (!p || p.owner || !isGood(p.t)) return false;
  return neighbours(sq).some((n) => n === MANDI || g.plots[n].owner === pid);
};
export const canBuild = (g: HGame, pid: string, sq: number) => canPlace(g, pid, sq) && afford(g, pid, COSTS.stall);
export const upgradeCost = (level: number) => (level === 1 ? COSTS.godown : COSTS.haveli);
export const canUpgrade = (g: HGame, pid: string, sq: number) => {
  const p = g.plots[sq];
  return !!p && p.owner === pid && (p.level === 1 || p.level === 2) && afford(g, pid, upgradeCost(p.level));
};
export const canFill = (g: HGame, pid: string, i: number) => i >= 0 && i < g.orders.length && has(g, pid, ORDERS[g.orders[i]].need);
export const buyPrice = (g: HGame, k: Good) => g.prices[k] + BUY_SPREAD;
const setupSpot = (g: HGame, sq: number) => { const p = g.plots[sq]; return !!p && !p.owner && isGood(p.t); };

function drawOrder(g: HGame): number {
  if (!g.orderDeck.length) g.orderDeck = shuffle(ORDERS.map((_, i) => i).filter((i) => !g.orders.includes(i)));
  return g.orderDeck.pop()!;
}

function endTurn(g: HGame) {
  for (const k of GOODS) g.prices[k] += Math.sign(PRICE_BASE - g.prices[k]) * Math.min(2, Math.abs(PRICE_BASE - g.prices[k]));
  g.turn = (g.turn + 1) % g.order.length;
  if (g.turn === 0) g.round++;
  g.phase = 'draw';
  g.acts = 0;
  if (g.round > MAX_ROUNDS && !g.winner) {
    g.winner = [...g.order].sort((a, b) => izzat(g, b) - izzat(g, a) || g.cash[b] - g.cash[a])[0];
    fx(g, { kind: 'win', pid: g.winner });
    g.note = `⏳ Season over! ${g.names[g.winner]} has the most Izzat`;
  }
}

function checkWin(g: HGame, pid: string) {
  if (!g.winner && izzat(g, pid) >= g.target) {
    g.winner = pid;
    fx(g, { kind: 'win', pid });
    g.note = `👑 ${g.names[pid]} reached ${g.target} Izzat and rules the Haat!`;
  }
}

function harvest(g: HGame, pid: string) {
  if (!g.deck.length) g.deck = shuffle(MONSOON.map((_, i) => i));
  const c = g.deck.pop()!;
  const m = MONSOON[c];
  g.card = c; g.cardId = seq++;
  fx(g, { kind: 'monsoon', pid, n: c });
  if (m.kind === 'drought') {
    for (const k of GOODS) g.prices[k] = Math.min(PRICE_MAX, g.prices[k] + 8);
    g.note = `☀️ ${m.title}: nothing grows, prices rise`;
    return;
  }
  const mult = m.kind === 'bumper' ? 2 : 1;
  g.plots.forEach((p, sq) => {
    if (!p.owner || !isGood(p.t) || !m.goods.includes(p.t)) return;
    const n = LEVEL_YIELD[p.level] * mult;
    g.goods[p.owner][p.t] += n;
    fx(g, { kind: 'harvest', pid: p.owner, sq, good: p.t, n });
  });
  for (const k of m.goods) g.prices[k] = Math.max(PRICE_MIN, g.prices[k] - (m.kind === 'mela' ? 2 : 3)); // a glut of what just grew
  g.note = m.kind === 'mela' ? '🎉 Kisan Mela! Every plot yields' : `🌧️ ${m.title}: ${m.goods.map((k) => GOOD_INFO[k].hindi).join(' + ')}${m.kind === 'bumper' ? ' ×2' : ''}`;
}

function actInner(g0: HGame, pid: string, a: HAction): HGame | null {
  if (g0.winner) return null;
  const g = clone(g0);
  const me = cur(g);

  if (g.phase === 'setup') {
    if (a.t !== 'place' || pid !== g.setup[0] || !setupSpot(g, a.sq)) return null;
    g.setup.shift();
    g.plots[a.sq] = { ...g.plots[a.sq], owner: pid, level: 1 };
    const t = g.plots[a.sq].t as Good;
    // Your second starting stall also hands you one of its goods.
    if (!g.setup.includes(pid)) g.goods[pid][t] += 1;
    fx(g, { kind: 'place', pid, sq: a.sq });
    g.note = `${g.names[pid]} set up a stall on ${GOOD_INFO[t].hindi} land`;
    if (!g.setup.length) { g.phase = 'draw'; g.turn = 0; g.note = `Setup done. ${g.names[g.order[0]]}, call the monsoon!`; }
    return g;
  }

  if (g.phase === 'trade') {
    const tr = g.trade!;
    if (pid !== tr.to || (a.t !== 'accept' && a.t !== 'decline')) return null;
    g.trade = null; g.phase = 'act';
    if (a.t === 'accept') {
      if (!has(g, tr.from, tr.give) || !has(g, tr.to, tr.get)) { g.note = 'That deal no longer adds up'; return g; }
      take(g, tr.from, tr.give); give(g, tr.to, tr.give);
      take(g, tr.to, tr.get); give(g, tr.from, tr.get);
      fx(g, { kind: 'trade', pid: tr.from, other: tr.to });
      g.note = `🤝 ${g.names[tr.to]} took ${g.names[tr.from]}'s deal: ${bundleText(tr.give)} for ${bundleText(tr.get)}`;
    } else g.note = `🙅 ${g.names[tr.to]} said no to ${g.names[tr.from]}'s deal`;
    return g;
  }

  if (pid !== me) return null;
  if (g.phase === 'draw') {
    if (a.t !== 'draw') return null;
    harvest(g, me);
    g.phase = 'act';
    return g;
  }

  // phase 'act'
  g.acts++;
  switch (a.t) {
    case 'end': endTurn(g); return g;
    case 'build': {
      if (!canBuild(g, me, a.sq)) return null;
      take(g, me, COSTS.stall.goods); g.cash[me] -= COSTS.stall.cash;
      g.plots[a.sq] = { ...g.plots[a.sq], owner: me, level: 1 };
      fx(g, { kind: 'build', pid: me, sq: a.sq });
      g.note = `🏪 ${g.names[me]} opened a stall on ${GOOD_INFO[g.plots[a.sq].t as Good].hindi} land`;
      break;
    }
    case 'upgrade': {
      if (!canUpgrade(g, me, a.sq)) return null;
      const p = g.plots[a.sq], c = upgradeCost(p.level);
      take(g, me, c.goods); g.cash[me] -= c.cash; p.level++;
      fx(g, { kind: 'upgrade', pid: me, sq: a.sq, n: p.level });
      g.note = `${p.level === 3 ? '🏰' : '🏚️'} ${g.names[me]} built a ${LEVEL_NAME[p.level]} on ${GOOD_INFO[p.t as Good].hindi} land`;
      break;
    }
    case 'sell': {
      if (!GOODS.includes(a.good) || g.goods[me][a.good] < 1) return null;
      const price = g.prices[a.good];
      g.goods[me][a.good]--; g.cash[me] += price;
      g.prices[a.good] = Math.max(PRICE_MIN, price - SELL_DROP);
      fx(g, { kind: 'sell', pid: me, good: a.good, n: price });
      g.note = `${g.names[me]} sold ${GOOD_INFO[a.good].hindi} for ₹${price}`;
      break;
    }
    case 'buy': {
      if (!GOODS.includes(a.good)) return null;
      const price = buyPrice(g, a.good);
      if (g.cash[me] < price) return null;
      g.cash[me] -= price; g.goods[me][a.good]++;
      g.prices[a.good] = Math.min(PRICE_MAX, g.prices[a.good] + BUY_RISE);
      fx(g, { kind: 'buy', pid: me, good: a.good, n: price });
      g.note = `${g.names[me]} bought ${GOOD_INFO[a.good].hindi} for ₹${price}`;
      break;
    }
    case 'fill': {
      if (!canFill(g, me, a.i)) return null;
      const o = ORDERS[g.orders[a.i]];
      take(g, me, o.need); g.cash[me] += o.cash;
      g.orderPts[me] = (g.orderPts[me] ?? 0) + o.izzat; g.filled[me] = (g.filled[me] ?? 0) + 1;
      fx(g, { kind: 'order', pid: me, n: g.orders[a.i] });
      g.note = `📦 ${g.names[me]} delivered "${o.title}": +${o.izzat} Izzat, +₹${o.cash}`;
      g.orders[a.i] = drawOrder(g);
      break;
    }
    case 'offer': {
      const ok = a.to !== me && g.order.includes(a.to);
      const clean = (b: Bundle) => Object.fromEntries(GOODS.filter((k) => (b[k] ?? 0) > 0).map((k) => [k, Math.min(5, Math.floor(b[k]!))])) as Bundle;
      const giveB = clean(a.give ?? {}), getB = clean(a.get ?? {});
      if (!ok || !Object.keys(giveB).length || !Object.keys(getB).length || !has(g, me, giveB)) return null;
      g.trade = { from: me, to: a.to, give: giveB, get: getB };
      g.phase = 'trade';
      g.note = `🤝 ${g.names[me]} offers ${g.names[a.to]} ${bundleText(giveB)} for ${bundleText(getB)}`;
      return g;
    }
    default: return null;
  }
  checkWin(g, me);
  return g;
}

// ---------- log ----------
const LOG_MAX = 80;
function writeLog(g0: HGame, g: HGame) {
  const add: LogLine[] = [];
  const harvests = new Map<string, string[]>();
  for (const f of g.fx) if (f.kind === 'harvest') harvests.set(f.pid, [...(harvests.get(f.pid) ?? []), `${f.n} ${GOOD_INFO[f.good!].hindi}`]);
  if (g.note && g.note !== g0.note && !/ sold | bought /.test(g.note)) add.push({ id: seq++, r: g.round, t: g.note, pid: cur(g0) });
  harvests.forEach((list, pid) => add.push({ id: seq++, r: g.round, t: `🧺 ${g.names[pid]} harvested ${list.join(', ')}`, pid }));
  const trades = g.fx.filter((f) => f.kind === 'sell' || f.kind === 'buy');
  for (const f of trades) add.push({ id: seq++, r: g.round, t: `${f.kind === 'sell' ? '💰' : '🛒'} ${g.names[f.pid]} ${f.kind === 'sell' ? 'sold' : 'bought'} ${GOOD_INFO[f.good!].hindi} at ₹${f.n}`, pid: f.pid });
  if (add.length) g.log = [...(g0.log ?? []), ...add].slice(-LOG_MAX);
}

// ---------- bots ----------
/** How useful each good is to `pid` right now: what its next goals are short of. */
function wants(g: HGame, pid: string): Record<Good, number> {
  const w = Object.fromEntries(GOODS.map((k) => [k, 0])) as Record<Good, number>;
  const add = (b: Bundle, weight: number) => { for (const k of GOODS) { const short = (b[k] ?? 0) - g.goods[pid][k]; if (short > 0) w[k] += short * weight; } };
  g.orders.forEach((o) => add(ORDERS[o].need, ORDERS[o].izzat));
  add(COSTS.stall.goods, 2);
  if (g.plots.some((p) => p.owner === pid && p.level === 2)) add(COSTS.haveli.goods, 3);
  if (g.plots.some((p) => p.owner === pid && p.level === 1)) add(COSTS.godown.goods, 1.5);
  return w;
}

function plotScore(g: HGame, pid: string, sq: number) {
  const t = g.plots[sq].t as Good;
  const mine = g.plots.filter((p) => p.owner === pid && p.t === t).length;
  return 10 - mine * 3 + (neighbours(sq).includes(MANDI) ? 2 : 0) + neighbours(sq).filter((n) => !g.plots[n].owner && isGood(g.plots[n].t)).length + Math.random();
}

function botAct(g: HGame, pid: string): HAction {
  if (g.acts > 14) return { t: 'end' };
  const fill = g.orders.map((_, i) => i).filter((i) => canFill(g, pid, i)).sort((a, b) => ORDERS[g.orders[b]].izzat - ORDERS[g.orders[a]].izzat)[0];
  if (fill != null) return { t: 'fill', i: fill };
  const mine = g.plots.map((p, i) => (p.owner === pid ? i : -1)).filter((i) => i >= 0);
  const haveli = mine.find((i) => g.plots[i].level === 2 && canUpgrade(g, pid, i));
  if (haveli != null) return { t: 'upgrade', sq: haveli };
  const spots = g.plots.map((_, i) => i).filter((i) => canBuild(g, pid, i)).sort((a, b) => plotScore(g, pid, b) - plotScore(g, pid, a));
  if (spots.length) return { t: 'build', sq: spots[0] };
  const godown = mine.find((i) => g.plots[i].level === 1 && canUpgrade(g, pid, i) && g.cash[pid] > 70);
  if (godown != null) return { t: 'upgrade', sq: godown };
  const w = wants(g, pid);
  // Sell a surplus good nobody's goals need, then buy the most-needed one if the purse allows.
  const surplus = GOODS.filter((k) => g.goods[pid][k] > 2 && w[k] === 0 && g.prices[k] >= 18).sort((a, b) => g.prices[b] - g.prices[a])[0];
  if (surplus) return { t: 'sell', good: surplus };
  const need = GOODS.filter((k) => w[k] > 0).sort((a, b) => w[b] - w[a])[0];
  if (need && g.cash[pid] - buyPrice(g, need) >= 30 && g.acts < 8) return { t: 'buy', good: need };
  return { t: 'end' };
}

function botTrade(g: HGame, pid: string): HAction {
  const tr = g.trade!;
  const value = (b: Bundle) => GOODS.reduce((s, k) => s + (b[k] ?? 0) * g.prices[k], 0);
  const w = wants(g, pid);
  const useful = GOODS.reduce((s, k) => s + Math.min(tr.give[k] ?? 0, Math.ceil(w[k])) * 15, 0);
  return has(g, pid, tr.get) && value(tr.give) + useful >= value(tr.get) ? { t: 'accept' } : { t: 'decline' };
}

const bestSetup = (g: HGame, pid: string) => g.plots.map((_, i) => i).filter((i) => setupSpot(g, i)).sort((a, b) => plotScore(g, pid, b) - plotScore(g, pid, a))[0];

// ---------- rules ----------
export const haatRules: Rules<HGame, HAction> & { ranking(g: HGame): string[] } = {
  maxPlayers: 4,
  start(players: Seat[], options) {
    const order = players.map((p) => p.id);
    const z = <T,>(v: () => T) => Object.fromEntries(order.map((id) => [id, v()])) as Record<string, T>;
    // 32 crop plots around the Mandi plus 2 banjar plots, shuffled every game.
    const crops: Terrain[] = shuffle([...Array(7).fill('cotton'), ...Array(7).fill('rice'), ...Array(6).fill('spice'), ...Array(6).fill('tea'), ...Array(6).fill('brick'), 'banjar', 'banjar']);
    const plots: Plot[] = Array.from({ length: COLS * ROWS }, (_, i) => ({ t: i === MANDI ? 'mandi' : crops.pop()!, owner: null, level: 0 }));
    const target = [10, 12, 15].includes(Number(options.target)) ? Number(options.target) : 12;
    const orderDeck = shuffle(ORDERS.map((_, i) => i));
    return {
      order, names: Object.fromEntries(players.map((p) => [p.id, p.name])), turn: 0, round: 1, target,
      phase: 'setup', setup: [...order, ...[...order].reverse()], plots,
      goods: z(() => ({ cotton: 0, spice: 0, tea: 0, brick: 1, rice: 1 })), cash: z(() => START_CASH),
      orderPts: z(() => 0), filled: z(() => 0),
      prices: Object.fromEntries(GOODS.map((k) => [k, PRICE_BASE])) as Record<Good, number>,
      orders: orderDeck.splice(0, OPEN_ORDERS), orderDeck, deck: shuffle(MONSOON.map((_, i) => i)), card: null, cardId: 0,
      trade: null, acts: 0, winner: null, fx: [], note: 'Pick a plot for your first stall', log: [{ id: seq++, r: 1, t: `🎪 The haat opens! First to ${target} Izzat wins.` }],
    };
  },
  act(g0, pid, a) {
    const g = actInner(g0, pid, a);
    if (g) writeLog(g0, g);
    return g;
  },
  waitingOn: (g) => (g.winner ? null : g.phase === 'setup' ? g.setup[0] : g.phase === 'trade' ? g.trade!.to : cur(g)),
  turnKey: (g) => `${g.round}:${g.turn}:${g.phase}:${g.setup.length}:${g.trade?.to ?? ''}`,
  bot(g, pid) {
    if (g.phase === 'setup') { const sq = bestSetup(g, pid); return sq != null ? { t: 'place', sq } : null; }
    if (g.phase === 'trade') return botTrade(g, pid);
    if (g.phase === 'draw') return { t: 'draw' };
    return botAct(g, pid);
  },
  timeout(g, pid) {
    if (g.phase === 'setup') { const sq = bestSetup(g, pid); return sq != null ? { t: 'place', sq } : null; }
    if (g.phase === 'trade') return { t: 'decline' };
    if (g.phase === 'draw') return { t: 'draw' };
    return { t: 'end' };
  },
  over: (g) => !!g.winner,
  botDelay: (g) => (g.phase === 'draw' ? 900 : g.phase === 'setup' ? 800 : 650),
  ranking: (g) => [...g.order].sort((a, b) => (b === g.winner ? 1 : 0) - (a === g.winner ? 1 : 0) || izzat(g, b) - izzat(g, a) || g.cash[b] - g.cash[a]),
};
