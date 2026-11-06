// DhandhaKing — property tycoon rules ("Campus to Crorepati"). Pure functions run by the room host.
import { AUTO, type Rules, type Seat } from '../shared/room';
import {
  AUCTION_STEP, BAIL, BOARD, BUILD_LEVELS, CARDS, CITY_FESTIVALS, CITY_SLUMPS, GROUPS, JAIL, MAX_BUILD, MAX_POWERS, MEHNGAI, PLACEMENT_ROUND,
  RENT_MULT, SALARY, SELL_RATE, START_CASH, STREAK_BONUS, WHEEL, buildCost, fmt, type Card, type Power,
} from './data';

export type FxKind =
  | 'event' | 'eventEnd' | 'land' | 'setComplete' | 'villa' | 'cardSold' | 'pay' | 'earn' | 'buy' | 'build' | 'sell' | 'jail'
  | 'bankrupt' | 'pot' | 'salary' | 'mortgage' | 'unmort' | 'free' | 'shield' | 'double' | 'takeover' | 'streak'
  | 'spin' | 'auctionWin' | 'placement' | 'power' | 'tele';
export interface Fx { id: number; kind: FxKind; pid: string; other?: string; amount?: number; sq?: number; text?: string }
export interface DMove { id: number; pid: string; from: number; to: number; jump: boolean }
export interface CityEvent { id: number; sq: number; title: string; reason: string; emoji: string; mult: number; rounds: number }
export interface Auction { sq: number; price: number; leader: string | null; next: number; queue: string[] }

export interface DGame {
  order: string[];
  names: Record<string, string>;
  cash: Record<string, number>;
  pos: Record<string, number>;
  owner: (string | null)[];
  build: number[];
  mort: boolean[];
  jail: Record<string, number>;
  jugaad: Record<string, number>; // Doctor's Notes held
  turn: number;
  dice: [number, number];
  rollId: number;
  doubles: number;
  again: boolean;
  phase: 'roll' | 'moving' | 'buy' | 'card' | 'end' | 'spin' | 'auction';
  move: DMove | null;
  card: Card | null;
  out: string[];
  round: number;
  maxRounds: number;
  pot: number;
  events: CityEvent[];
  lastEventRound: number;
  hand: Record<string, Power[]>;
  dblArmed: Record<string, boolean>;
  streak: Record<string, number>;
  lastRentRound: Record<string, number>;
  spin: { id: number; idx: number } | null;
  auction: Auction | null;
  stats: { rent: Record<string, number>; bought: Record<string, number>; peak: Record<string, number>; built: Record<string, number>; potWins: Record<string, number>; minCash: Record<string, number> };
  fx: Fx[];
  note: string;
}

export type DAction =
  | { t: 'roll' } | { t: 'buy' } | { t: 'pass' } | { t: 'cardOk' } | { t: 'end' } | { t: 'skip' } | { t: 'advance' }
  | { t: 'bail' } | { t: 'jugaad' } | { t: 'spin' } | { t: 'bid' } | { t: 'out' }
  | { t: 'power'; p: 'double' } | { t: 'power'; p: 'tele'; sq: number }
  | { t: 'build'; sq: number } | { t: 'sell'; sq: number } | { t: 'sellCity'; sq: number } | { t: 'mortgage'; sq: number } | { t: 'unmortgage'; sq: number };

let seq = 1;
const clone = (g: DGame): DGame => ({
  ...g, events: g.events.map((e) => ({ ...e })), cash: { ...g.cash }, pos: { ...g.pos }, owner: [...g.owner], build: [...g.build], mort: [...g.mort],
  jail: { ...g.jail }, jugaad: { ...g.jugaad }, out: [...g.out], fx: [], hand: Object.fromEntries(Object.entries(g.hand).map(([k, v]) => [k, [...v]])),
  dblArmed: { ...g.dblArmed }, streak: { ...g.streak }, lastRentRound: { ...g.lastRentRound }, auction: g.auction ? { ...g.auction, queue: [...g.auction.queue] } : null,
  stats: { rent: { ...g.stats.rent }, bought: { ...g.stats.bought }, peak: { ...g.stats.peak }, built: { ...g.stats.built }, potWins: { ...g.stats.potWins }, minCash: { ...g.stats.minCash } },
});
const fx = (g: DGame, e: Omit<Fx, 'id'>) => g.fx.push({ ...e, id: seq++ });
const active = (g: DGame) => g.order.filter((id) => !g.out.includes(id));
const cur = (g: DGame) => g.order[g.turn];
const POWER_LIST: Power[] = ['shield', 'double', 'tele'];

export const groupSquares = (grp: number) => BOARD.map((s, i) => (s.group === grp && s.kind === 'city' ? i : -1)).filter((i) => i >= 0);
export const ownsGroup = (g: DGame, pid: string, grp: number) => groupSquares(grp).every((i) => g.owner[i] === pid);
export const placementStart = (g: DGame) => g.maxRounds - PLACEMENT_ROUND;
export const placementOn = (g: DGame) => g.maxRounds > 0 && g.round >= placementStart(g);
/** Classic (no round limit): how many Mehngai steps have kicked in. */
export const mehngaiLevel = (g: DGame) => (g.maxRounds > 0 || g.round < MEHNGAI.START ? 0 : 1 + Math.floor((g.round - MEHNGAI.START) / MEHNGAI.EVERY));
/** Everything that scales rent with time: Placement Season (quick) or Mehngai (classic). */
export const rentBoost = (g: DGame) => (placementOn(g) ? 1.5 : MEHNGAI.STEP ** mehngaiLevel(g));

export function rentFor(g: DGame, sq: number, diceSum: number): number {
  const s = BOARD[sq], o = g.owner[sq];
  if (!o || g.mort[sq]) return 0;
  let r = 0;
  if (s.kind === 'city') {
    r = s.rent! * RENT_MULT[g.build[sq]];
    if (g.build[sq] === 0 && ownsGroup(g, o, s.group!)) r *= 2;
    for (const e of g.events) if (e.sq === sq) r *= e.mult;
  } else if (s.kind === 'train') {
    const n = BOARD.filter((b, i) => b.kind === 'train' && g.owner[i] === o).length;
    r = 250 * 2 ** (n - 1);
  } else if (s.kind === 'utility') {
    const n = BOARD.filter((b, i) => b.kind === 'utility' && g.owner[i] === o).length;
    r = diceSum * (n === 2 ? 100 : 40);
  }
  return Math.round(r * rentBoost(g));
}

export const netWorth = (g: DGame, pid: string) =>
  g.cash[pid] + BOARD.reduce((sum, s, i) => (g.owner[i] === pid ? sum + (g.mort[i] ? s.price! / 2 : s.price!) + g.build[i] * (s.group != null ? GROUPS[s.group].build : 0) : sum), 0);

/** Sell buildings, then mortgage, until `pid` has at least `need`. */
function raise(g: DGame, pid: string, need: number) {
  const mine = BOARD.map((_, i) => i).filter((i) => g.owner[i] === pid);
  for (const i of [...mine].sort((a, b) => g.build[b] - g.build[a])) {
    while (g.cash[pid] < need && g.build[i] > 0) { g.cash[pid] += Math.round(buildCost(GROUPS[BOARD[i].group!].build, g.build[i]) / 2); g.build[i]--; }
  }
  for (const i of mine) if (g.cash[pid] < need && !g.mort[i] && g.build[i] === 0) { g.mort[i] = true; g.cash[pid] += BOARD[i].price! / 2; fx(g, { kind: 'mortgage', pid, sq: i }); }
}

/** Move money; `to` null = bank, 'pot' = Tapri gullak. Handles bankruptcy. */
function pay(g: DGame, from: string, to: string | null | 'pot', amount: number) {
  if (amount <= 0) return;
  if (g.cash[from] < amount) raise(g, from, amount);
  const paid = Math.min(amount, Math.max(0, g.cash[from]));
  g.cash[from] -= paid;
  if (to === 'pot') g.pot += paid;
  else if (to) g.cash[to] += paid;
  fx(g, { kind: 'pay', pid: from, other: to && to !== 'pot' ? to : undefined, amount: paid, text: to === 'pot' ? 'pot' : to ? 'player' : 'bank' });
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
  g.hand[pid] = [];
  fx(g, { kind: 'bankrupt', pid, other: creditor ?? undefined });
  g.note = `💥 ${g.names[pid]} is bankrupt! Startup shut down.`;
}

function toJail(g: DGame, pid: string, why = 'Proxy pakdi gayi!') {
  g.pos[pid] = JAIL; g.jail[pid] = 3; g.doubles = 0; g.again = false; g.phase = 'end';
  fx(g, { kind: 'jail', pid });
  g.note = `🚨 ${why} ${g.names[pid]} is sent to Detention`;
}

function grantPower(g: DGame, pid: string): Power | null {
  if (g.hand[pid].length >= MAX_POWERS) return null;
  const p = POWER_LIST[Math.floor(Math.random() * POWER_LIST.length)];
  g.hand[pid].push(p);
  fx(g, { kind: 'power', pid, text: p });
  return p;
}

function startMove(g: DGame, pid: string, to: number, jump = false, salary = true) {
  const from = g.pos[pid];
  if (salary && to < from && !(to === JAIL && g.jail[pid])) { g.cash[pid] += SALARY; fx(g, { kind: 'salary', pid, amount: SALARY }); }
  g.pos[pid] = to;
  g.move = { id: seq++, pid, from, to, jump };
  g.phase = 'moving';
}

function collectRent(g: DGame, payer: string, owner: string, sq: number, r: number) {
  const s = BOARD[sq];
  if (g.hand[payer].includes('shield')) {
    g.hand[payer].splice(g.hand[payer].indexOf('shield'), 1);
    fx(g, { kind: 'shield', pid: payer, other: owner, sq, amount: r });
    g.note = `🛡️ ${g.names[payer]}'s Rent Shield blocked ${fmt(r)} rent on ${s.name}!`;
    return;
  }
  let amount = r;
  if (g.dblArmed[owner]) { amount *= 2; g.dblArmed[owner] = false; fx(g, { kind: 'double', pid: owner, sq, amount }); }
  pay(g, payer, owner, amount);
  g.stats.rent[owner] = (g.stats.rent[owner] ?? 0) + amount;
  const ev = g.events.find((e) => e.sq === sq);
  g.note = `${g.names[payer]} paid ${fmt(amount)} rent to ${g.names[owner]}${ev ? ` (${ev.emoji} ${ev.title} ×${ev.mult})` : ''}`;
  // rent streak: collecting rent on 3 consecutive rounds
  g.streak[payer] = 0;
  if (g.lastRentRound[owner] !== g.round) {
    g.streak[owner] = g.lastRentRound[owner] === g.round - 1 ? g.streak[owner] + 1 : 1;
    g.lastRentRound[owner] = g.round;
    if (g.streak[owner] > 0 && g.streak[owner] % 3 === 0 && !g.out.includes(owner)) {
      g.cash[owner] += STREAK_BONUS;
      fx(g, { kind: 'streak', pid: owner, amount: STREAK_BONUS });
    }
  }
}

/** What happens on the square the current player just reached. */
function land(g: DGame) {
  const pid = cur(g), sq = g.pos[pid], s = BOARD[sq];
  g.phase = 'end';
  switch (s.kind) {
    case 'city': case 'train': case 'utility': {
      const o = g.owner[sq];
      if (!o) { g.phase = 'buy'; g.note = `${s.name} is for sale · ${fmt(s.price!)}`; return; }
      if (o === pid) { g.note = `${g.names[pid]} chills at their own ${s.name}`; return; }
      if (g.mort[sq]) { g.phase = 'buy'; g.note = `${s.name} is mortgaged — hostile takeover possible!`; return; }
      collectRent(g, pid, o, sq, rentFor(g, sq, g.dice[0] + g.dice[1]));
      return;
    }
    case 'tax': fx(g, { kind: 'land', pid, sq, amount: s.tax }); pay(g, pid, 'pot', s.tax!); g.note = `${g.names[pid]} paid ${fmt(s.tax!)} ${s.name} into the Tapri gullak`; return;
    case 'kismat': case 'parivaar': {
      const deck = CARDS.filter((c) => c.deck === s.kind);
      g.card = deck[Math.floor(Math.random() * deck.length)];
      g.phase = 'card';
      return;
    }
    case 'police': fx(g, { kind: 'land', pid, sq }); toJail(g, pid); return;
    case 'chai': g.phase = 'spin'; g.note = `☕ ${g.names[pid]} reached the Tapri — spin the wheel!`; return;
    case 'jail': fx(g, { kind: 'land', pid, sq }); g.note = `${g.names[pid]} walks past Detention, waving`; return;
    default: g.note = `${g.names[pid]} is at Payday`;
  }
}

function applyCard(g: DGame) {
  const pid = cur(g), c = g.card!;
  g.card = null;
  g.phase = 'end';
  const f = c.fx;
  if (c.power) grantPower(g, pid);
  switch (f.t) {
    case 'cash': if (f.amount > 0) { g.cash[pid] += f.amount; fx(g, { kind: 'earn', pid, amount: f.amount, text: 'bank' }); } else pay(g, pid, 'pot', -f.amount); break;
    case 'each':
      for (const o of active(g)) if (o !== pid) { if (f.amount > 0) pay(g, o, pid, f.amount); else pay(g, pid, o, -f.amount); }
      break;
    case 'goto': startMove(g, pid, f.sq, true); break;
    case 'back': startMove(g, pid, (g.pos[pid] + 40 - f.n) % 40, true, false); break;
    case 'jail': toJail(g, pid, c.title + '!'); break;
    case 'free': g.jugaad[pid]++; break;
    case 'repairs': {
      let total = 0;
      g.build.forEach((b, i) => { if (g.owner[i] === pid) total += b >= 4 ? f.perMall + 3 * f.perHouse : b * f.perHouse; });
      pay(g, pid, 'pot', total);
      break;
    }
  }
}

function spinWheel(g: DGame) {
  const pid = cur(g);
  const idx = Math.floor(Math.random() * WHEEL.length);
  g.spin = { id: seq++, idx };
  const prize = WHEEL[idx].prize;
  const give = (amt: number, from: 'pot' | 'bank') => {
    if (amt <= 0) return;
    g.cash[pid] += amt;
    if (from === 'pot') { g.pot -= amt; g.stats.potWins[pid] = (g.stats.potWins[pid] ?? 0) + 1; }
    fx(g, { kind: 'pot', pid, amount: amt, text: from });
  };
  const freeHouse = BOARD.map((_, i) => i).find((i) => BOARD[i].kind === 'city' && g.owner[i] === pid && ownsGroup(g, pid, BOARD[i].group!)
    && groupSquares(BOARD[i].group!).every((k) => !g.mort[k]) && g.build[i] < MAX_BUILD);
  switch (prize) {
    case 'pot': give(g.pot, 'pot'); g.note = g.pot === 0 ? `☕ ${g.names[pid]} wins the FULL gullak!` : ''; break;
    case 'half': give(Math.floor(g.pot / 2), 'pot'); break;
    case 'cash': give(500, 'bank'); break;
    case 'power': if (!grantPower(g, pid)) give(500, 'bank'); break;
    case 'house':
      if (freeHouse != null) { g.build[freeHouse]++; fx(g, { kind: 'build', pid, sq: freeHouse, amount: 0 }); if (g.build[freeHouse] === 5) fx(g, { kind: 'villa', pid, sq: freeHouse }); }
      else give(500, 'bank');
      break;
    case 'none': break;
  }
  fx(g, { kind: 'spin', pid, amount: idx });
  g.note = `🎡 Tapri wheel: ${WHEEL[idx].label}${prize === 'none' ? ' — Seth-ji keeps the gullak 😏' : '!'}`;
  g.phase = 'end';
}

/** A passed-on property goes under the hammer: other players bid in turn order. */
function startAuction(g: DGame, sq: number) {
  const n = g.order.length;
  const queue: string[] = [];
  for (let k = 1; k < n; k++) { const id = g.order[(g.turn + k) % n]; if (!g.out.includes(id)) queue.push(id); }
  const open = Math.round((BOARD[sq].price! * 0.5) / 100) * 100;
  const able = queue.filter((id) => g.cash[id] >= open);
  if (!able.length) { g.phase = 'end'; return; }
  g.auction = { sq, price: 0, leader: null, next: open, queue: able };
  g.phase = 'auction';
  g.note = `🔨 Bolee! Seth-ji auctions ${BOARD[sq].name}, opening at ${fmt(open)}`;
}

function settleAuction(g: DGame) {
  const a = g.auction!;
  g.auction = null;
  g.phase = 'end';
  if (!a.leader) { g.note = `Nobody bid on ${BOARD[a.sq].name}`; return; }
  const w = a.leader;
  g.cash[w] -= a.price; g.owner[a.sq] = w;
  fx(g, { kind: 'auctionWin', pid: w, sq: a.sq, amount: a.price });
  fx(g, { kind: 'buy', pid: w, sq: a.sq, amount: a.price });
  g.stats.bought[w]++;
  if (BOARD[a.sq].kind === 'city' && ownsGroup(g, w, BOARD[a.sq].group!)) fx(g, { kind: 'setComplete', pid: w, sq: a.sq });
  g.note = `🔨 Sold to ${g.names[w]} for ${fmt(a.price)}!`;
}

/** Once per round: age events, maybe start a new festival or slump, and start Placement Season. */
function tickRound(g: DGame) {
  for (const e of g.events) e.rounds--;
  for (const e of g.events.filter((x) => x.rounds <= 0)) fx(g, { kind: 'eventEnd', pid: g.order[0], sq: e.sq });
  g.events = g.events.filter((e) => e.rounds > 0);
  if (g.maxRounds > 0 && g.round === placementStart(g)) fx(g, { kind: 'placement', pid: g.order[0] });
  if (g.maxRounds === 0 && g.round >= MEHNGAI.START && (g.round - MEHNGAI.START) % MEHNGAI.EVERY === 0) fx(g, { kind: 'placement', pid: g.order[0], text: 'mehngai', amount: rentBoost(g) });
  if (g.round < 3 || g.events.length >= 2 || g.round - g.lastEventRound < 2 || Math.random() > 0.35) return;
  const cities = BOARD.map((b, i) => (b.kind === 'city' && !g.events.some((e) => e.sq === i) ? i : -1)).filter((i) => i >= 0);
  const sq = cities[Math.floor(Math.random() * cities.length)];
  const def = Math.random() < 0.75 ? CITY_FESTIVALS[BOARD[sq].name] : CITY_SLUMPS[Math.floor(Math.random() * CITY_SLUMPS.length)];
  if (!def) return;
  const e: CityEvent = { id: seq++, sq, ...def, rounds: 2 + Math.floor(Math.random() * 3) };
  g.events.push(e);
  g.lastEventRound = g.round;
  fx(g, { kind: 'event', pid: g.order[0], sq, amount: e.id });
}

function endTurn(g: DGame) {
  if (g.again && !g.out.includes(cur(g))) { g.phase = 'roll'; g.again = false; return; }
  const n = g.order.length;
  let t = g.turn;
  for (let i = 0; i < n; i++) {
    t = (t + 1) % n;
    if (t === 0) { g.round++; tickRound(g); }
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

/** Cost of a hostile takeover of an opponent's mortgaged city (full price; the owner gets half). */
export const takeoverPrice = (sq: number) => BOARD[sq].price!;

export const isOver = (g: DGame) => active(g).length <= 1 || (g.maxRounds > 0 && g.round > g.maxRounds);

/** Whose decision the game waits on (auction bidders take turns). */
const waiting = (g: DGame) => (isOver(g) || g.phase === 'moving' ? null : g.phase === 'auction' && g.auction ? g.auction.queue[0] : cur(g));

const completesFor = (g: DGame, pid: string, sq: number) => {
  const s = BOARD[sq];
  return s.kind === 'city' && groupSquares(s.group!).every((i) => i === sq || g.owner[i] === pid);
};

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
      events: [], lastEventRound: 0, hand: Object.fromEntries(order.map((id) => [id, [] as Power[]])), dblArmed: z(false), streak: z(0), lastRentRound: z(-9),
      spin: null, auction: null,
      stats: { rent: z(0), bought: z(0), peak: z(START_CASH), built: z(0), potWins: z(0), minCash: z(START_CASH) },
      fx: [], note: 'Campus to Crorepati. Roll!',
    };
  },
  waitingOn: waiting,
  turnKey: (g) => `${g.turn}:${g.phase}:${g.rollId}:${g.auction ? `${g.auction.queue[0]}:${g.auction.next}` : ''}`,
  over: isOver,
  ranking: (g) => [...active(g).sort((a, b) => netWorth(g, b) - netWorth(g, a)), ...[...g.out].reverse()],
  botDelay: (g) => (g.phase === 'card' ? 2500 : g.phase === 'spin' ? 1200 : 850),
  auto: (g) => (g.phase === 'moving' && g.move ? { a: { t: 'advance' }, delay: 700 + (g.move.jump ? 600 : ((g.move.to - g.move.from + 40) % 40) * 170) + 300 } : null),

  bot(g, pid) {
    const sq = g.pos[pid], s = BOARD[sq];
    switch (g.phase) {
      case 'roll': {
        if (g.jail[pid] && g.jugaad[pid]) return { t: 'jugaad' };
        if (g.jail[pid] && g.cash[pid] > 4000) return { t: 'bail' };
        if (g.hand[pid].includes('double') && !g.dblArmed[pid] && BOARD.some((b, i) => b.kind === 'city' && g.owner[i] === pid && ownsGroup(g, pid, b.group!))) return { t: 'power', p: 'double' };
        if (g.hand[pid].includes('tele') && !g.jail[pid]) {
          const target = BOARD.map((_, i) => i).find((i) => BOARD[i].price && !g.owner[i] && completesFor(g, pid, i) && g.cash[pid] >= BOARD[i].price!);
          if (target != null) return { t: 'power', p: 'tele', sq: target };
        }
        return { t: 'roll' };
      }
      case 'buy': {
        const price = g.owner[sq] ? takeoverPrice(sq) : s.price!;
        if (g.owner[sq]) return (completesFor(g, pid, sq) && g.cash[pid] >= price) || g.cash[pid] - price >= 3000 ? { t: 'buy' } : { t: 'pass' };
        return g.cash[pid] - price >= 1200 ? { t: 'buy' } : { t: 'pass' };
      }
      case 'card': return { t: 'cardOk' };
      case 'spin': return { t: 'spin' };
      case 'auction': {
        const a = g.auction!;
        const cap = BOARD[a.sq].price! * (completesFor(g, pid, a.sq) || (a.leader && completesFor(g, a.leader, a.sq)) ? 1.3 : 0.9);
        return a.next <= cap && g.cash[pid] - a.next >= 1200 ? { t: 'bid' } : { t: 'out' };
      }
      case 'end': {
        const target = BOARD.map((_, i) => i).filter((i) => canBuild(g, pid, i) && g.cash[pid] - nextBuildCost(g, i) > 3000)
          .sort((a, b) => g.build[a] - g.build[b])[0];
        return target != null ? { t: 'build', sq: target } : { t: 'end' };
      }
    }
    return null;
  },
  timeout(g) {
    switch (g.phase) {
      case 'buy': return { t: 'pass' };
      case 'card': return { t: 'cardOk' };
      case 'end': return { t: 'end' };
      case 'spin': return { t: 'spin' };
      case 'auction': return { t: 'out' };
      default: return { t: 'skip' };
    }
  },

  act(g0, pid, a) {
    const g = actInner(g0, pid, a);
    if (g && g.out.includes(cur(g)) && g.phase !== 'moving' && g.phase !== 'auction' && !isOver(g)) { g.again = false; endTurn(g); }
    if (g) for (const id of g.order) {
      if (netWorth(g, id) > (g.stats.peak[id] ?? 0)) g.stats.peak[id] = netWorth(g, id);
      if (g.cash[id] < (g.stats.minCash[id] ?? START_CASH)) g.stats.minCash[id] = g.cash[id];
    }
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
  // Auction bids come from whoever is at the head of the bidding queue.
  if (g.phase === 'auction' && g.auction) {
    const au = g.auction;
    if (pid !== au.queue[0] || (a.t !== 'bid' && a.t !== 'out')) return null;
    if (a.t === 'bid') {
      if (g.cash[pid] < au.next) return null;
      au.leader = pid; au.price = au.next; au.next = au.price + AUCTION_STEP;
      au.queue = [...au.queue.slice(1), pid];
      g.note = `🔨 ${g.names[pid]} bids ${fmt(au.price)} for ${BOARD[au.sq].name}`;
    } else {
      au.queue = au.queue.slice(1);
      g.note = `${g.names[pid]} is out of the bolee`;
    }
    au.queue = au.queue.filter((id) => id === au.leader || g.cash[id] >= au.next);
    if (!au.queue.length || (au.queue.length === 1 && au.queue[0] === au.leader)) settleAuction(g);
    return g;
  }
  if (pid !== me || isOver(g)) return null;
  const sq = g.pos[me];
  const canManage = g.phase === 'end' || g.phase === 'roll';
  switch (a.t) {
    case 'skip': if (g.phase !== 'roll') return null; g.note = `⏰ ${g.names[me]} ran out of time`; g.again = false; endTurn(g); g.rollId++; return g;
    case 'bail':
      if (g.phase !== 'roll' || !g.jail[me] || g.cash[me] < BAIL) return null;
      g.cash[me] -= BAIL; g.pot += BAIL; g.jail[me] = 0; fx(g, { kind: 'pay', pid: me, amount: BAIL, text: 'pot' }); fx(g, { kind: 'free', pid: me });
      g.note = `${g.names[me]} paid the ${fmt(BAIL)} late fine and left Detention`; return g;
    case 'jugaad':
      if (g.phase !== 'roll' || !g.jail[me] || !g.jugaad[me]) return null;
      g.jugaad[me]--; g.jail[me] = 0; fx(g, { kind: 'free', pid: me }); g.note = `${g.names[me]} flashed a Doctor's Note 🩺 and walked out`; return g;
    case 'power': {
      const i = g.hand[me].indexOf(a.p);
      if (i < 0) return null;
      if (a.p === 'double') {
        if (!canManage || g.dblArmed[me]) return null;
        g.hand[me].splice(i, 1); g.dblArmed[me] = true;
        fx(g, { kind: 'power', pid: me, text: 'double-armed' });
        g.note = `💥 ${g.names[me]} armed Double Dhamaka — next rent collected is ×2`;
        return g;
      }
      // teleport replaces your roll
      if (g.phase !== 'roll' || g.jail[me] || !BOARD[a.sq]?.price || g.owner[a.sq]) return null;
      g.hand[me].splice(i, 1);
      fx(g, { kind: 'tele', pid: me, sq: a.sq });
      g.again = false;
      g.note = `🌀 ${g.names[me]} teleported to ${BOARD[a.sq].name}!`;
      startMove(g, me, a.sq, true, false);
      g.rollId++;
      return g;
    }
    case 'roll': {
      if (g.phase !== 'roll') return null;
      const d: [number, number] = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      const dbl = d[0] === d[1];
      g.dice = d; g.rollId++;
      if (g.jail[me]) {
        if (dbl) { g.jail[me] = 0; fx(g, { kind: 'free', pid: me }); }
        else if (--g.jail[me] === 0) pay(g, me, 'pot', BAIL);
        else { g.phase = 'end'; g.note = `${g.names[me]} rolled ${d[0]}+${d[1]} — still in Detention 📚`; return g; }
        g.again = false;
      } else if (dbl) {
        g.doubles++;
        if (g.doubles === 3) { toJail(g, me, 'Three doubles? Too lucky. Suspicious.'); return g; }
        g.again = true;
      } else g.again = false;
      g.note = `${g.names[me]} rolled ${d[0]} + ${d[1]}${dbl ? ' — DOUBLES!' : ''}`;
      startMove(g, me, (sq + d[0] + d[1]) % 40);
      return g;
    }
    case 'buy': {
      if (g.phase !== 'buy') return null;
      const s = BOARD[sq], owner = g.owner[sq];
      if (owner) {
        // hostile takeover of a mortgaged city
        const price = takeoverPrice(sq);
        if (!g.mort[sq] || owner === me || g.cash[me] < price) return null;
        g.cash[me] -= price; g.cash[owner] += Math.round(price / 2); g.owner[sq] = me; g.mort[sq] = false; g.phase = 'end';
        fx(g, { kind: 'takeover', pid: me, other: owner, sq, amount: price });
        fx(g, { kind: 'earn', pid: owner, amount: Math.round(price / 2) });
        g.stats.bought[me]++;
        if (s.kind === 'city' && ownsGroup(g, me, s.group!)) fx(g, { kind: 'setComplete', pid: me, sq });
        g.note = `😈 Hostile takeover! ${g.names[me]} grabbed ${s.name} from ${g.names[owner]}`;
        return g;
      }
      if (g.cash[me] < s.price!) return null;
      g.cash[me] -= s.price!; g.owner[sq] = me; g.phase = 'end';
      fx(g, { kind: 'buy', pid: me, sq, amount: s.price });
      g.stats.bought[me]++;
      if (s.kind === 'city' && ownsGroup(g, me, s.group!)) fx(g, { kind: 'setComplete', pid: me, sq });
      g.note = `🏷️ ${g.names[me]} bought ${s.name}!`;
      return g;
    }
    case 'pass':
      if (g.phase !== 'buy') return null;
      if (g.owner[sq]) { g.phase = 'end'; g.note = `${g.names[me]} skipped the takeover`; return g; }
      g.note = `${g.names[me]} passed on ${BOARD[sq].name}`;
      startAuction(g, sq);
      return g;
    case 'cardOk': if (g.phase !== 'card' || !g.card) return null; applyCard(g); return g;
    case 'spin': if (g.phase !== 'spin') return null; spinWheel(g); return g;
    case 'end': if (g.phase !== 'end') return null; endTurn(g); return g;
    case 'build': {
      if (!canManage || !canBuild(g, me, a.sq)) return null;
      const cost = nextBuildCost(g, a.sq);
      g.cash[me] -= cost; g.build[a.sq]++;
      fx(g, { kind: 'build', pid: me, sq: a.sq, amount: cost });
      g.stats.built[me]++;
      if (g.build[a.sq] === 5) fx(g, { kind: 'villa', pid: me, sq: a.sq });
      g.note = `${g.names[me]} built ${g.build[a.sq] === 5 ? 'a VILLA 🏰' : g.build[a.sq] === 4 ? 'a HOTEL 🏨' : 'a house 🏠'} in ${BOARD[a.sq].name}`;
      return g;
    }
    case 'sell': {
      if (!canManage || g.owner[a.sq] !== me || !g.build[a.sq]) return null;
      g.cash[me] += Math.round(buildCost(GROUPS[BOARD[a.sq].group!].build, g.build[a.sq]) / 2); g.build[a.sq]--;
      fx(g, { kind: 'sell', pid: me, sq: a.sq });
      g.note = `${g.names[me]} sold a building in ${BOARD[a.sq].name} (now ${BUILD_LEVELS[g.build[a.sq]]})`;
      return g;
    }
    case 'sellCity': {
      if (!canManage || g.owner[a.sq] !== me) return null;
      const v = sellValue(g, a.sq);
      g.cash[me] += v; g.owner[a.sq] = null; g.build[a.sq] = 0; g.mort[a.sq] = false;
      fx(g, { kind: 'cardSold', pid: me, sq: a.sq, amount: v });
      g.note = `🃏 ${g.names[me]} sold the ${BOARD[a.sq].name} card to Seth-ji for ${fmt(v)}`;
      return g;
    }
    case 'mortgage': {
      if (!canManage || g.owner[a.sq] !== me || g.mort[a.sq] || g.build[a.sq]) return null;
      g.mort[a.sq] = true; g.cash[me] += BOARD[a.sq].price! / 2; fx(g, { kind: 'mortgage', pid: me, sq: a.sq, amount: BOARD[a.sq].price! / 2 }); return g;
    }
    case 'unmortgage': {
      const cost = Math.round(BOARD[a.sq].price! * 0.55);
      if (!canManage || g.owner[a.sq] !== me || !g.mort[a.sq] || g.cash[me] < cost) return null;
      g.mort[a.sq] = false; g.cash[me] -= cost; fx(g, { kind: 'unmort', pid: me, sq: a.sq, amount: cost }); return g;
    }
  }
  return null;
}

export { canBuild };
