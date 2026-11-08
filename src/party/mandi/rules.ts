// Mandi Wars: a live market. Prices move every second, rumours hint at what's coming, and big trades move prices.
// Buy low, sell high; richest trader when the bell rings wins.
import { AUTO, type Rules, type Seat } from '../../shared/room';
import { pick, seats } from '../common';

export const CROPS = [
  { k: 'onion', name: 'Onion', emoji: '🧅', base: 40 }, { k: 'tomato', name: 'Tomato', emoji: '🍅', base: 30 }, { k: 'potato', name: 'Potato', emoji: '🥔', base: 20 },
  { k: 'mango', name: 'Mango', emoji: '🥭', base: 90 }, { k: 'chilli', name: 'Chilli', emoji: '🌶️', base: 60 },
];
const PLACES = ['Nashik', 'Kolar', 'Agra', 'Ratnagiri', 'Guntur', 'Indore', 'Pune', 'Jaipur'];
const UP = ['Heavy rain hits {p} {c} fields', 'Truck strike: no {c} reaching the mandi', 'Export order for {c} from Dubai', 'Wedding season: {c} demand shoots up', 'Pests attack {c} crop in {p}'];
const DOWN = ['Bumper {c} harvest in {p}', 'Government releases {c} stock', 'Cold storage full of {c} in {p}', '{c} imports arrive at the port', 'Buyers skip {c} this week'];
export interface MCrop { k: string; price: number; hist: number[] }
export interface MNews { id: number; k: string; pct: number; in: number; real: boolean; text: string }
export interface MGame {
  order: string[]; names: Record<string, string>; bots: string[];
  clock: number; total: number; crops: MCrop[]; cash: Record<string, number>; hold: Record<string, Record<string, number>>;
  news: MNews[]; ticker: string[]; seq: number; done: boolean; trades: Record<string, number>; flash: Record<string, number>;
}
export type MAction = { t: 'trade'; k: string; n: number } | { t: 'tick' };
const START_CASH = 1000;
let nid = Date.now();

export const worth = (g: MGame, pid: string) => Math.round(g.cash[pid] + CROPS.reduce((s, c) => s + (g.hold[pid][c.k] ?? 0) * price(g, c.k), 0));
export const price = (g: MGame, k: string) => g.crops.find((c) => c.k === k)!.price;
const baseOf = (k: string) => CROPS.find((c) => c.k === k)!.base;

function trade(g: MGame, pid: string, k: string, n: number): MGame | null {
  const crop = g.crops.find((c) => c.k === k); if (!crop || !n) return null;
  const have = g.hold[pid][k] ?? 0;
  if (n < 0) n = -Math.min(have, -n);
  if (n > 0) n = Math.min(n, Math.floor(g.cash[pid] / crop.price));
  if (!n) return null;
  const cost = Math.round(n * crop.price * 100) / 100;
  const p2 = Math.max(2, crop.price * (1 + 0.006 * n)); // big orders move the price
  return {
    ...g, cash: { ...g.cash, [pid]: Math.round((g.cash[pid] - cost) * 100) / 100 }, hold: { ...g.hold, [pid]: { ...g.hold[pid], [k]: have + n } },
    crops: g.crops.map((c) => (c.k === k ? { ...c, price: Math.round(p2 * 100) / 100 } : c)), trades: { ...g.trades, [pid]: g.trades[pid] + 1 }, flash: { ...g.flash, [k]: (g.flash[k] ?? 0) + 1 },
  };
}

export const mwRules: Rules<MGame, MAction> & { ranking(g: MGame): string[] } = {
  maxPlayers: 4,
  start(players: Seat[], o) {
    const s = seats(players), total = Number(o.time) || 150;
    return {
      ...s, clock: total, total, crops: CROPS.map((c) => ({ k: c.k, price: c.base, hist: Array(30).fill(c.base) })),
      cash: Object.fromEntries(s.order.map((id) => [id, START_CASH])), hold: Object.fromEntries(s.order.map((id) => [id, {}])),
      news: [], ticker: ['🔔 Mandi is open! Watch the rumours.'], seq: 1, done: false, trades: Object.fromEntries(s.order.map((id) => [id, 0])), flash: {},
    };
  },
  waitingOn: () => null,
  turnKey: (g) => `${g.done}`,
  over: (g) => g.done,
  ranking: (g) => [...g.order].sort((a, b) => worth(g, b) - worth(g, a)),
  auto: (g) => (g.done ? null : { a: { t: 'tick' }, delay: 1000 }),
  bot: () => null,
  timeout: () => null,
  act(g, pid, a) {
    if (g.done) return null;
    if (a.t === 'trade') {
      if (!g.order.includes(pid)) return null;
      return trade(g, pid, String(a.k), Math.max(-50, Math.min(50, Math.round(Number(a.n) || 0))));
    }
    if (a.t !== 'tick' || pid !== AUTO) return null;
    let n: MGame = { ...g, clock: g.clock - 1, seq: g.seq + 1 };
    // news lands
    let ticker = n.ticker;
    const landed = n.news.filter((x) => x.in <= 1);
    n.news = n.news.filter((x) => x.in > 1).map((x) => ({ ...x, in: x.in - 1 }));
    // prices drift back toward normal, with noise
    n.crops = n.crops.map((c) => {
      let p = c.price + (baseOf(c.k) - c.price) * 0.03 + c.price * (Math.random() - 0.5) * 0.05;
      for (const x of landed) if (x.k === c.k && x.real) p *= 1 + x.pct;
      p = Math.max(3, Math.round(p * 100) / 100);
      return { ...c, price: p, hist: [...c.hist.slice(1), p] };
    });
    for (const x of landed) {
      const c = CROPS.find((q) => q.k === x.k)!;
      ticker = [...ticker, x.real ? `📢 CONFIRMED: ${c.emoji} ${c.name} ${x.pct > 0 ? 'up' : 'down'} ${Math.round(Math.abs(x.pct) * 100)}%!` : `🤥 Fake news! ${c.emoji} ${c.name} rumour was false`].slice(-4);
    }
    // a new rumour every ~12 s
    if (Math.random() < 0.09 && n.news.length < 2 && n.clock > 8) {
      const c = pick(CROPS), up = Math.random() < 0.5, pct = (up ? 1 : -1) * (0.25 + Math.random() * 0.35);
      const text = pick(up ? UP : DOWN).replace('{c}', c.name.toLowerCase()).replace('{p}', pick(PLACES));
      n.news = [...n.news, { id: nid++, k: c.k, pct, in: 6 + Math.floor(Math.random() * 4), real: Math.random() < 0.8, text: `${c.emoji} Rumour: ${text}` }];
      ticker = [...ticker, `${c.emoji} Rumour: ${text}`].slice(-4);
    }
    n.ticker = ticker;
    // bots trade
    for (const b of n.bots) {
      if (Math.random() > 0.45) continue;
      const rumour = n.news.find((x) => Math.random() < 0.7 && x.in < 6);
      let t: MGame | null = null;
      if (rumour) t = trade(n, b, rumour.k, rumour.pct > 0 ? 4 + Math.floor(Math.random() * 6) : -10);
      else {
        const c = pick(n.crops), r = c.price / baseOf(c.k);
        t = r < 0.88 ? trade(n, b, c.k, 5) : r > 1.12 ? trade(n, b, c.k, -10) : null;
      }
      if (t) n = t;
    }
    if (n.clock <= 0) n = { ...n, done: true, ticker: [...n.ticker, '🔔 Market closed!'].slice(-4) };
    return n;
  },
};
