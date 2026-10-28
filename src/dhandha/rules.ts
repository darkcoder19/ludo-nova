// DhandhaKing — property tycoon rules. Pure functions run by the room host.
import { AUTO, type Rules, type Seat } from '../shared/room';
import { BAIL, BOARD, BUILD_LEVELS, CARDS, CITY_FESTIVALS, CITY_SLUMPS, GROUPS, JAIL, MAX_BUILD, RENT_MULT, SALARY, SELL_RATE, START_CASH, buildCost, fmt, type Card } from './data';

export type FxKind = 'event' | 'eventEnd' | 'land' | 'setComplete' | 'villa' | 'cardSold' | 'pay' | 'earn' | 'buy' | 'build' | 'sell' | 'jail' | 'bankrupt' | 'pot' | 'salary' | 'trend';
export interface Fx { id: number; kind: FxKind; pid: string; other?: string; amount?: number; sq?: number }
export interface DMove { id: number; pid: string; from: number; to: number; jump: boolean }

export interface DGame {
  order: string[];
  names: Record<string, string>;
  cash: Record<string, number>;
  pos: Record<string, number>;
  owner: (string | null)[];
  build: number[];
  mort: boolean[];
  jail: Record<string, number>;
  jugaad: Record<string, number>;
  turn: number;
  dice: [number, number];
  rollId: number;
  doubles: number;
  again: boolean;
  phase: 'roll' | 'moving' | 'buy' | 'card' | 'end';
  move: DMove | null;
  card: Card | null;
  out: string[];
  round: number;
  maxRounds: number;
  pot: number;
  /** Active city events (festival boom or slump). */
  events: CityEvent[];
  stats: { rent: Record<string, number>; bought: Record<string, number>; peak: Record<string, number>; built: Record<string, number> };
  fx: Fx[];
  note: string;
}

export interface CityEvent { id: number; sq: number; title: string; reason: string; emoji: string; mult: number; rounds: number }

export type DAction =
  | { t: 'roll' } | { t: 'buy' } | { t: 'pass' } | { t: 'cardOk' } | { t: 'end' } | { t: 'skip' } | { t: 'advance' }
  | { t: 'bail' } | { t: 'jugaad' }
  | { t: 'build'; sq: number } | { t: 'sell'; sq: number } | { t: 'sellCity'; sq: number } | { t: 'mortgage'; sq: number } | { t: 'unmortgage'; sq: number };

let seq = 1;
const clone = (g: DGame): DGame => ({ ...g, events: g.events.map((e) => ({ ...e })), stats: { rent: { ...g.stats.rent }, bought: { ...g.stats.bought }, peak: { ...g.stats.peak }, built: { ...g.stats.built } }, cash: { ...g.cash }, pos: { ...g.pos }, owner: [...g.owner], build: [...g.build], mort: [...g.mort], jail: { ...g.jail }, jugaad: { ...g.jugaad }, out: [...g.out], fx: [] });
const fx = (g: DGame, e: Omit<Fx, 'id'>) => g.fx.push({ ...e, id: seq++ });
const active = (g: DGame) => g.order.filter((id) => !g.out.includes(id));
const cur = (g: DGame) => g.order[g.turn];

export const groupSquares = (grp: number) => BOARD.map((s, i) => (s.group === grp && s.kind === 'city' ? i : -1)).filter((i) => i >= 0);
export const ownsGroup = (g: DGame, pid: string, grp: number) => groupSquares(grp).every((i) => g.owner[i] === pid);

export function rentFor(g: DGame, sq: number, diceSum: number): number {
  const s = BOARD[sq], o = g.owner[sq];
  if (!o || g.mort[sq]) return 0;
  let r = 0;
  if (s.kind === 'city') {
    r = s.rent! * RENT_MULT[g.build[sq]];
    if (g.build[sq] === 0 && ownsGroup(g, o, s.group!)) r *= 2;
    for (const e of g.events) if (e.sq === sq) r *= e.mult;
    r = Math.round(r);
  } else if (s.kind === 'train') {
    const n = BOARD.filter((b, i) => b.kind === 'train' && g.owner[i] === o).length;
    r = 250 * 2 ** (n - 1);
  } else if (s.kind === 'utility') {
    const n = BOARD.filter((b, i) => b.kind === 'utility' && g.owner[i] === o).length;
    r = diceSum * (n === 2 ? 100 : 40);
  }
  return r;
}

export const netWorth = (g: DGame, pid: string) =>
  g.cash[pid] + BOARD.reduce((sum, s, i) => (g.owner[i] === pid ? sum + (g.mort[i] ? s.price! / 2 : s.price!) + g.build[i] * (s.group != null ? GROUPS[s.group].build : 0) : sum), 0);

/** Sell buildings, then mortgage, until `pid` has at least `need`. */
function raise(g: DGame, pid: string, need: number) {
  const mine = BOARD.map((_, i) => i).filter((i) => g.owner[i] === pid);
  for (const i of [...mine].sort((a, b) => g.build[b] - g.build[a])) {
    while (g.cash[pid] < need && g.build[i] > 0) { g.cash[pid] += Math.round(buildCost(GROUPS[BOARD[i].group!].build, g.build[i]) / 2); g.build[i]--; }
  }
  for (const i of mine) if (g.cash[pid] < need && !g.mort[i] && g.build[i] === 0) { g.mort[i] = true; g.cash[pid] += BOARD[i].price! / 2; }
}

/** Move money; `to` null = bank, 'pot' = Chai Break pot. Handles bankruptcy. */
function pay(g: DGame, from: string, to: string | null | 'pot', amount: number) {
  if (amount <= 0) return;
  if (g.cash[from] < amount) raise(g, from, amount);
  const paid = Math.min(amount, Math.max(0, g.cash[from]));
  g.cash[from] -= paid;
  if (to === 'pot') g.pot += paid;
  else if (to) g.cash[to] += paid;
  fx(g, { kind: 'pay', pid: from, other: to && to !== 'pot' ? to : undefined, amount: paid });
  if (to && to !== 'pot') fx(g, { kind: 'earn', pid: to, other: from, amount: paid });
  if (paid < amount) bankrupt(g, from, to && to !== 'pot' ? to : null);
}

function bankrupt(g: DGame, pid: string, creditor: string | null) {
  g.out.push(pid);
  BOARD.forEach((_, i) => {
    if (g.owner[i] !== pid) return;
    g.build[i] = 0;
    if (creditor) g.owner[i] = creditor; else { g.owner[i] = null; g.mort[i] = false; }
  });
  g.cash[pid] = 0;
  g.again = false;
  fx(g, { kind: 'bankrupt', pid, other: creditor ?? undefined });
  g.note = `💥 ${g.names[pid]} is bankrupt!`;
}

function toJail(g: DGame, pid: string) {
  g.pos[pid] = JAIL; g.jail[pid] = 3; g.doubles = 0; g.again = false; g.phase = 'end';
  fx(g, { kind: 'jail', pid });
  g.note = `💍 Rishta pakka! ${g.names[pid]} is off to Sasural 👵`;
}

function startMove(g: DGame, pid: string, to: number, jump = false, salary = true) {
  const from = g.pos[pid];
  if (salary && to < from && !(to === JAIL && g.jail[pid])) { g.cash[pid] += SALARY; fx(g, { kind: 'salary', pid, amount: SALARY }); }
  g.pos[pid] = to;
  g.move = { id: seq++, pid, from, to, jump };
  g.phase = 'moving';
}

/** What happens on the square the current player just reached. */
function land(g: DGame) {
  const pid = cur(g), sq = g.pos[pid], s = BOARD[sq];
  g.phase = 'end';
  switch (s.kind) {
    case 'city': case 'train': case 'utility': {
      const o = g.owner[sq];
      if (!o) { g.phase = 'buy'; g.note = `${s.name} is for sale · ${fmt(s.price!)}`; return; }
      if (o === pid) { g.note = `${g.names[pid]} visits their own ${s.name}`; return; }
      const r = rentFor(g, sq, g.dice[0] + g.dice[1]);
      const ev = g.events.find((e) => e.sq === sq);
      if (r) { pay(g, pid, o, r); g.stats.rent[o] = (g.stats.rent[o] ?? 0) + r; g.note = `${g.names[pid]} paid ${fmt(r)} rent to ${g.names[o]}${ev ? ` (${ev.emoji} ${ev.title} ×${ev.mult})` : ''}`; }
      else g.note = `${s.name} is mortgaged — no rent`;
      return;
    }
    case 'tax': fx(g, { kind: 'land', pid, sq, amount: s.tax }); pay(g, pid, 'pot', s.tax!); g.note = `${g.names[pid]} paid ${fmt(s.tax!)} ${s.name} into the Chai pot`; return;
    case 'kismat': case 'parivaar': {
      const deck = CARDS.filter((c) => c.deck === s.kind);
      g.card = deck[Math.floor(Math.random() * deck.length)];
      g.phase = 'card';
      return;
    }
    case 'police': fx(g, { kind: 'land', pid, sq }); toJail(g, pid); return;
    case 'chai':
      fx(g, { kind: 'land', pid, sq, amount: g.pot });
      if (g.pot > 0) { g.cash[pid] += g.pot; fx(g, { kind: 'pot', pid, amount: g.pot }); g.note = `☕ ${g.names[pid]} grabbed the Chai pot: ${fmt(g.pot)}!`; g.pot = 0; }
      else g.note = `☕ ${g.names[pid]} takes a chai break`;
      return;
    case 'jail': fx(g, { kind: 'land', pid, sq }); g.note = `${g.names[pid]} is just visiting Sasural`; return;
    default: g.note = `${g.names[pid]} is at Shuruaat`;
  }
}

function applyCard(g: DGame) {
  const pid = cur(g), c = g.card!;
  g.card = null;
  g.phase = 'end';
  const f = c.fx;
  switch (f.t) {
    case 'cash': if (f.amount > 0) { g.cash[pid] += f.amount; fx(g, { kind: 'earn', pid, amount: f.amount }); } else pay(g, pid, 'pot', -f.amount); break;
    case 'each':
      for (const o of active(g)) if (o !== pid) { if (f.amount > 0) pay(g, o, pid, f.amount); else pay(g, pid, o, -f.amount); }
      break;
    case 'goto': startMove(g, pid, f.sq, true); break;
    case 'back': startMove(g, pid, (g.pos[pid] + 40 - f.n) % 40, true, false); break;
    case 'jail': toJail(g, pid); break;
    case 'free': g.jugaad[pid]++; break;
    case 'repairs': {
      let total = 0;
      g.build.forEach((b, i) => { if (g.owner[i] === pid) total += b >= 4 ? f.perMall + 3 * f.perHouse : b * f.perHouse; });
      pay(g, pid, 'pot', total);
      break;
    }
  }
}

/** Once per round: age events, and now and then start a new festival or slump somewhere. */
function tickEvents(g: DGame) {
  for (const e of g.events) e.rounds--;
  for (const e of g.events.filter((x) => x.rounds <= 0)) fx(g, { kind: 'eventEnd', pid: g.order[0], sq: e.sq });
  g.events = g.events.filter((e) => e.rounds > 0);
  if (g.round < 3 || g.events.length >= 2 || Math.random() > 0.25) return;
  const cities = BOARD.map((b, i) => (b.kind === 'city' && !g.events.some((e) => e.sq === i) ? i : -1)).filter((i) => i >= 0);
  const sq = cities[Math.floor(Math.random() * cities.length)];
  const def = Math.random() < 0.75 ? CITY_FESTIVALS[BOARD[sq].name] : CITY_SLUMPS[Math.floor(Math.random() * CITY_SLUMPS.length)];
  if (!def) return;
  const e: CityEvent = { id: seq++, sq, ...def, rounds: 2 + Math.floor(Math.random() * 3) };
  g.events.push(e);
  fx(g, { kind: 'event', pid: g.order[0], sq, amount: e.id });
}

function endTurn(g: DGame) {
  if (g.again && !g.out.includes(cur(g))) { g.phase = 'roll'; g.again = false; return; }
  const n = g.order.length;
  let t = g.turn;
  for (let i = 0; i < n; i++) {
    t = (t + 1) % n;
    if (t === 0) {
      g.round++;
      tickEvents(g);
    }
    if (!g.out.includes(g.order[t])) break;
  }
  g.turn = t; g.doubles = 0; g.again = false; g.phase = 'roll';
}

const canBuild = (g: DGame, pid: string, sq: number) => {
  const s = BOARD[sq];
  return s.kind === 'city' && g.owner[sq] === pid && ownsGroup(g, pid, s.group!) && groupSquares(s.group!).every((i) => !g.mort[i])
    && g.build[sq] < MAX_BUILD && g.cash[pid] >= nextBuildCost(g, sq);
};

/** Price of the next building on a city. */
export const nextBuildCost = (g: DGame, sq: number) => buildCost(GROUPS[BOARD[sq].group!].build, g.build[sq] + 1);

/** What the bank pays for a city card (and everything built on it). */
export function sellValue(g: DGame, sq: number) {
  const s = BOARD[sq];
  let built = 0;
  for (let n = 1; n <= g.build[sq]; n++) built += buildCost(GROUPS[s.group ?? 0]?.build ?? 0, n);
  return Math.round(s.price! * (g.mort[sq] ? 0.2 : SELL_RATE) + built / 2);
}

export const isOver = (g: DGame) => active(g).length <= 1 || (g.maxRounds > 0 && g.round > g.maxRounds);

export const dhandhaRules: Rules<DGame, DAction> & { ranking(g: DGame): string[] } = {
  maxPlayers: 4,
  start(players: Seat[], options) {
    const order = players.map((p) => p.id);
    const z = <T,>(v: T) => Object.fromEntries(order.map((id) => [id, v])) as Record<string, T>;
    return {
      order, names: Object.fromEntries(players.map((p) => [p.id, p.name])), cash: z(START_CASH), pos: z(0),
      owner: BOARD.map(() => null), build: BOARD.map(() => 0), mort: BOARD.map(() => false), jail: z(0), jugaad: z(0),
      turn: Math.floor(Math.random() * order.length), dice: [1, 1], rollId: 0, doubles: 0, again: false, phase: 'roll',
      move: null, card: null, out: [], round: 1, maxRounds: options.rounds === 'classic' ? 0 : 15, pot: 0,
      events: [], stats: { rent: z(0), bought: z(0), peak: z(START_CASH), built: z(0) }, fx: [], note: 'Har dhandha ka ek raja hota hai. Roll!',
    };
  },
  waitingOn: (g) => (isOver(g) || g.phase === 'moving' ? null : cur(g)),
  turnKey: (g) => `${g.turn}:${g.phase}:${g.rollId}`,
  over: isOver,
  ranking: (g) => [...active(g).sort((a, b) => netWorth(g, b) - netWorth(g, a)), ...[...g.out].reverse()],
  botDelay: (g) => (g.phase === 'card' ? 3500 : 1100),
  auto: (g) => (g.phase === 'moving' && g.move ? { a: { t: 'advance' }, delay: 700 + (g.move.jump ? 600 : ((g.move.to - g.move.from + 40) % 40) * 170) + 300 } : null),

  bot(g, pid) {
    const sq = g.pos[pid], s = BOARD[sq];
    switch (g.phase) {
      case 'roll': return g.jail[pid] && g.jugaad[pid] ? { t: 'jugaad' } : g.jail[pid] && g.cash[pid] > 4000 ? { t: 'bail' } : { t: 'roll' };
      case 'buy': return g.cash[pid] - s.price! >= 1200 ? { t: 'buy' } : { t: 'pass' };
      case 'card': return { t: 'cardOk' };
      case 'end': {
        const target = BOARD.map((_, i) => i).filter((i) => canBuild(g, pid, i) && g.cash[pid] - nextBuildCost(g, i) > 3000)
          .sort((a, b) => g.build[a] - g.build[b])[0];
        return target != null ? { t: 'build', sq: target } : { t: 'end' };
      }
    }
    return null;
  },
  timeout(g) {
    return g.phase === 'buy' ? { t: 'pass' } : g.phase === 'card' ? { t: 'cardOk' } : g.phase === 'end' ? { t: 'end' } : { t: 'skip' };
  },

  act(g0, pid, a) {
    const g = actInner(g0, pid, a);
    // A player who went bankrupt on their own turn hands the turn on.
    if (g && g.out.includes(cur(g)) && g.phase !== 'moving' && !isOver(g)) { g.again = false; endTurn(g); }
    if (g) for (const id of g.order) if (netWorth(g, id) > (g.stats.peak[id] ?? 0)) g.stats.peak[id] = netWorth(g, id);
    return g;
  },
};

function actInner(g0: DGame, pid: string, a: DAction): DGame | null {
    const g = clone(g0);
    const me = cur(g);
    if (a.t === 'advance') {
      if (pid !== AUTO || g.phase !== 'moving') return null;
      g.move = null; land(g);
      return g;
    }
    if (pid !== me || isOver(g)) return null;
    const sq = g.pos[me];
    switch (a.t) {
      case 'skip': if (g.phase !== 'roll') return null; g.note = `⏰ ${g.names[me]} ran out of time`; g.again = false; endTurn(g); g.rollId++; return g;
      case 'bail':
        if (g.phase !== 'roll' || !g.jail[me] || g.cash[me] < BAIL) return null;
        g.cash[me] -= BAIL; g.pot += BAIL; g.jail[me] = 0; fx(g, { kind: 'pay', pid: me, amount: BAIL }); g.note = `${g.names[me]} gave Saasu-ma shagun and escaped Sasural`; return g;
      case 'jugaad':
        if (g.phase !== 'roll' || !g.jail[me] || !g.jugaad[me]) return null;
        g.jugaad[me]--; g.jail[me] = 0; g.note = `${g.names[me]} used a Jugaad card 😎`; return g;
      case 'roll': {
        if (g.phase !== 'roll') return null;
        const d: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        const dbl = d[0] === d[1];
        g.dice = d; g.rollId++;
        if (g.jail[me]) {
          if (dbl) g.jail[me] = 0;
          else if (--g.jail[me] === 0) pay(g, me, 'pot', BAIL);
          else { g.phase = 'end'; g.note = `${g.names[me]} rolled ${d[0]}+${d[1]} — still stuck at Sasural 👵`; return g; }
          g.again = false;
        } else if (dbl) {
          g.doubles++;
          if (g.doubles === 3) { toJail(g, me); g.note = `Three doubles! Rishta pakka — ${g.names[me]} is off to Sasural 💍`; return g; }
          g.again = true;
        } else g.again = false;
        g.note = `${g.names[me]} rolled ${d[0]} + ${d[1]}${dbl ? ' — doubles!' : ''}`;
        startMove(g, me, (sq + d[0] + d[1]) % 40);
        return g;
      }
      case 'buy': {
        const s = BOARD[sq];
        if (g.phase !== 'buy' || g.cash[me] < s.price!) return null;
        g.cash[me] -= s.price!; g.owner[sq] = me; g.phase = 'end';
        fx(g, { kind: 'buy', pid: me, sq, amount: s.price });
        g.stats.bought[me]++;
        if (s.kind === 'city' && ownsGroup(g, me, s.group!)) fx(g, { kind: 'setComplete', pid: me, sq });
        g.note = `🏷️ ${g.names[me]} bought ${s.name}!`;
        return g;
      }
      case 'pass': if (g.phase !== 'buy') return null; g.phase = 'end'; g.note = `${g.names[me]} passed on ${BOARD[sq].name}`; return g;
      case 'cardOk': if (g.phase !== 'card' || !g.card) return null; applyCard(g); return g;
      case 'end': if (g.phase !== 'end') return null; endTurn(g); return g;
      case 'build': {
        if ((g.phase !== 'end' && g.phase !== 'roll') || !canBuild(g, me, a.sq)) return null;
        const cost = nextBuildCost(g, a.sq);
        g.cash[me] -= cost; g.build[a.sq]++;
        fx(g, { kind: 'build', pid: me, sq: a.sq, amount: cost });
        g.stats.built[me]++;
        if (g.build[a.sq] === 5) fx(g, { kind: 'villa', pid: me, sq: a.sq });
        g.note = `${g.names[me]} built ${g.build[a.sq] === 5 ? 'a VILLA 🏰' : g.build[a.sq] === 4 ? 'a HOTEL 🏨' : 'a house 🏠'} in ${BOARD[a.sq].name}`;
        return g;
      }
      case 'sell': {
        if ((g.phase !== 'end' && g.phase !== 'roll') || g.owner[a.sq] !== me || !g.build[a.sq]) return null;
        g.cash[me] += Math.round(buildCost(GROUPS[BOARD[a.sq].group!].build, g.build[a.sq]) / 2); g.build[a.sq]--; fx(g, { kind: 'sell', pid: me, sq: a.sq });
        g.note = `${g.names[me]} sold a building in ${BOARD[a.sq].name} (now ${BUILD_LEVELS[g.build[a.sq]]})`;
        return g;
      }
      case 'sellCity': {
        if ((g.phase !== 'end' && g.phase !== 'roll') || g.owner[a.sq] !== me) return null;
        const v = sellValue(g, a.sq);
        g.cash[me] += v; g.owner[a.sq] = null; g.build[a.sq] = 0; g.mort[a.sq] = false;
        fx(g, { kind: 'cardSold', pid: me, sq: a.sq, amount: v });
        g.note = `🃏 ${g.names[me]} sold the ${BOARD[a.sq].name} card to the bank for ${fmt(v)}`;
        return g;
      }
      case 'mortgage': {
        if ((g.phase !== 'end' && g.phase !== 'roll') || g.owner[a.sq] !== me || g.mort[a.sq] || g.build[a.sq]) return null;
        g.mort[a.sq] = true; g.cash[me] += BOARD[a.sq].price! / 2; return g;
      }
      case 'unmortgage': {
        const cost = Math.round(BOARD[a.sq].price! * 0.55);
        if ((g.phase !== 'end' && g.phase !== 'roll') || g.owner[a.sq] !== me || !g.mort[a.sq] || g.cash[me] < cost) return null;
        g.mort[a.sq] = false; g.cash[me] -= cost; return g;
      }
    }
    return null;
}

export { canBuild };
