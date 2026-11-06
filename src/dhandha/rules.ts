// DhandhaKing — property tycoon rules ("Campus to Crorepati"). Pure functions run by the room host.
import { AUTO, type Rules, type Seat } from '../shared/room';
import {
  AUCTION_STEP, BAIL, BOARD, BUILD_LEVELS, CALENDAR, CARDS, CATCHUP, DEAL_MAX, MARKET, SEASONS, GIFT_STEP, LOAN, SETS_TO_WIN, CITY_FESTIVALS, CITY_SLUMPS, GROUPS, JAIL, MAX_BUILD, MAX_POWERS, MEHNGAI, PLACEMENT_ROUND, POWERS,
  CASH_CHOICES, RENT_MULT, SALARY, START_CASH, STREAK_BONUS, WHEEL, buildCost, fmt, type Card, type Power, type SeasonKind,
} from './data';

export type FxKind =
  | 'event' | 'eventEnd' | 'land' | 'setComplete' | 'villa' | 'cardSold' | 'pay' | 'earn' | 'buy' | 'build' | 'sell' | 'jail'
  | 'bankrupt' | 'pot' | 'salary' | 'mortgage' | 'unmort' | 'gift' | 'deal' | 'loan' | 'repay' | 'sets' | 'free' | 'shield' | 'double' | 'takeover' | 'streak'
  | 'spin' | 'auctionWin' | 'placement' | 'power' | 'tele' | 'sethNo' | 'season' | 'catchup' | 'market' | 'counter';
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
  phase: 'roll' | 'moving' | 'buy' | 'card' | 'end' | 'spin' | 'auction' | 'deal';
  move: DMove | null;
  card: Card | null;
  out: string[];
  round: number;
  maxRounds: number;
  /** quick: 15 rounds · classic: last one standing · sets: first to 3 complete colour sets. */
  mode?: 'quick' | 'classic' | 'sets';
  /** What each player owes Seth-ji (interest included). */
  debt?: Record<string, number>;
  /** A city deal waiting for its answer. */
  deal?: Deal | null;
  /** Resale market: each square's value as a multiple of its list price. */
  market?: number[];
  /** The Campus Calendar season running right now. */
  season?: { id: number; kind: SeasonKind; rounds: number } | null;
  lastSeason?: SeasonKind;
  /** Cities offered to Seth-ji this turn (he hears one offer per city per turn). */
  sethTried?: number[];
  /** Round each player last proposed a deal (bots wait a few rounds between offers). */
  lastOffer?: Record<string, number>;
  pot: number;
  events: CityEvent[];
  lastEventRound: number;
  hand: Record<string, Power[]>;
  dblArmed: Record<string, boolean>;
  streak: Record<string, number>;
  lastRentRound: Record<string, number>;
  spin: { id: number; idx: number } | null;
  auction: Auction | null;
  stats: { rent: Record<string, number>; bought: Record<string, number>; peak: Record<string, number>; built: Record<string, number>; potWins: Record<string, number>; minCash: Record<string, number>;
    /** Extra counters per player: deals closed, bolees won, cities sold to Seth-ji. */
    x?: Record<string, Record<string, number>> };
  fx: Fx[];
  note: string;
  /** What happened, for the in-game log every player can open (newest last). */
  log: LogLine[];
}
/** A proposed swap: `give` cities (and positive cash) go from → to, `get` cities (and negative cash) come back. */
export interface Deal { from: string; to: string; give: number[]; get: number[]; cash: number; back: 'roll' | 'end'; sale?: boolean; counter?: boolean }
export interface LogLine { id: number; r: number; t: string; pid?: string }

export type DAction =
  | { t: 'roll' } | { t: 'buy' } | { t: 'pass' } | { t: 'cardOk' } | { t: 'end' } | { t: 'skip' } | { t: 'advance' }
  | { t: 'bail' } | { t: 'jugaad' } | { t: 'spin' } | { t: 'bid' } | { t: 'out' }
  | { t: 'power'; p: 'double' } | { t: 'power'; p: 'tele'; sq: number }
  | { t: 'build'; sq: number } | { t: 'sell'; sq: number } | { t: 'sellSeth'; sq: number; price: number } | { t: 'offerCity'; sq: number; to: string; price: number } | { t: 'mortgage'; sq: number } | { t: 'unmortgage'; sq: number }
  | { t: 'gift'; to: string; amount: number }
  | { t: 'deal'; to: string; give: number[]; get: number[]; cash: number } | { t: 'dealYes' } | { t: 'dealNo' } | { t: 'dealCounter'; give: number[]; get: number[]; cash: number }
  | { t: 'loan'; amount: number } | { t: 'repay'; amount: number };

let seq = Date.now(); // from the clock: a restarted host never reuses an id guests already saw
const clone = (g: DGame): DGame => ({
  ...g, events: g.events.map((e) => ({ ...e })), cash: { ...g.cash }, pos: { ...g.pos }, owner: [...g.owner], build: [...g.build], mort: [...g.mort],
  jail: { ...g.jail }, jugaad: { ...g.jugaad }, out: [...g.out], fx: [], hand: Object.fromEntries(Object.entries(g.hand).map(([k, v]) => [k, [...v]])),
  dblArmed: { ...g.dblArmed }, streak: { ...g.streak }, lastRentRound: { ...g.lastRentRound }, debt: { ...(g.debt ?? {}) },
  deal: g.deal ? { ...g.deal, give: [...g.deal.give], get: [...g.deal.get] } : null, market: g.market ? [...g.market] : BOARD.map(() => 1), season: g.season ? { ...g.season } : null,
  sethTried: [...(g.sethTried ?? [])], lastOffer: { ...(g.lastOffer ?? {}) }, auction: g.auction ? { ...g.auction, queue: [...g.auction.queue] } : null,
  stats: { rent: { ...g.stats.rent }, bought: { ...g.stats.bought }, peak: { ...g.stats.peak }, built: { ...g.stats.built }, potWins: { ...g.stats.potWins }, minCash: { ...g.stats.minCash },
    x: Object.fromEntries(Object.entries(g.stats.x ?? {}).map(([k, v]) => [k, { ...v }])) },
});
const fx = (g: DGame, e: Omit<Fx, 'id'>) => g.fx.push({ ...e, id: seq++ });
const active = (g: DGame) => g.order.filter((id) => !g.out.includes(id));
const cur = (g: DGame) => g.order[g.turn];
const POWER_LIST: Power[] = ['shield', 'double', 'tele'];

export const groupSquares = (grp: number) => BOARD.map((s, i) => (s.group === grp && s.kind === 'city' ? i : -1)).filter((i) => i >= 0);
export const ownsGroup = (g: DGame, pid: string, grp: number) => groupSquares(grp).every((i) => g.owner[i] === pid);
export const placementStart = (g: DGame) => g.maxRounds - PLACEMENT_ROUND;
export const placementOn = (g: DGame) => PLACEMENT_ROUND > 0 && g.maxRounds > 0 && g.round >= placementStart(g);
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
    r = 250 * 2 ** (n - 1) * (g.season?.kind === 'fest' ? 2 : 1);
  } else if (s.kind === 'utility') {
    const n = BOARD.filter((b, i) => b.kind === 'utility' && g.owner[i] === o).length;
    r = g.season?.kind === 'strike' ? 0 : diceSum * (n === 2 ? 100 : 40);
  }
  return Math.round(r * rentBoost(g));
}

export const netWorth = (g: DGame, pid: string) =>
  g.cash[pid] - (g.debt?.[pid] ?? 0) + BOARD.reduce((sum, s, i) => (g.owner[i] === pid ? sum + s.price! * marketMult(g, i) - (g.mort[i] ? buyBackPrice(i) : 0) + builtCost(g, i) : sum), 0);

/** Resale market multiplier of a square (1 = list price). */
export const marketMult = (g: DGame, sq: number) => g.market?.[sq] ?? 1;
const r100 = (v: number) => Math.round(v / MARKET.STEP) * MARKET.STEP;
/** What everything built on a city cost. */
export function builtCost(g: DGame, sq: number) {
  let t = 0;
  for (let n = 1; n <= g.build[sq]; n++) t += buildCost(GROUPS[BOARD[sq].group ?? 0]?.build ?? 0, n);
  return t;
}
/** A city's open-market value right now: list price × market, buildings at half their cost, GIRVI less what it takes to free it. */
export function marketValue(g: DGame, sq: number) {
  const city = BOARD[sq].price! * marketMult(g, sq);
  return Math.max(0, r100((g.mort[sq] ? city - buyBackPrice(sq) : city) + builtCost(g, sq) / 2));
}
/** What Seth-ji charges for an unowned square (Sale Season: 20% off). */
export const buyPrice = (g: DGame, sq: number) => (g.season?.kind === 'sale' ? r100(BOARD[sq].price! * 0.8) : BOARD[sq].price!);

/** Seth-ji's private valuation of a card he is offered. Nobody sees this: part of it is his mood at the moment you ask. */
function sethLimit(g: DGame, pid: string, sq: number) {
  const s = BOARD[sq];
  let v = marketValue(g, sq);
  const ev = g.events.find((e) => e.sq === sq);
  if (ev) v *= ev.mult > 1 ? 1.15 : 0.85; // he likes what's trending
  const unowned = BOARD.filter((b, i) => b.price != null && !g.owner[i]).length;
  v *= unowned > 10 ? 0.88 : unowned < 4 ? 1.1 : 1; // a full godown makes him stingy
  if (s.kind === 'city' && groupSquares(s.group!).some((i) => i !== sq && !g.owner[i])) v *= 1.05; // he can sell the set again
  if (s.kind !== 'city') v *= 0.95;
  if (g.cash[pid] < 1000) v *= 0.92; // he smells desperation
  if (g.season?.kind === 'sale') v *= 0.9;
  return v * (0.85 + Math.random() * 0.27); // and his mood today
}

/** Principal Seth-ji will still lend `pid` (in ₹1,000 steps). */
export const loanRoom = (g: DGame, pid: string) =>
  Math.max(0, Math.floor((LOAN.LIMIT * (1 + LOAN.RATE) - (g.debt?.[pid] ?? 0)) / (1 + LOAN.RATE) / LOAN.STEP) * LOAN.STEP);
function takeLoan(g: DGame, pid: string, amount: number) {
  g.debt = g.debt ?? {};
  g.cash[pid] += amount;
  g.debt[pid] = (g.debt[pid] ?? 0) + Math.round(amount * (1 + LOAN.RATE));
  fx(g, { kind: 'loan', pid, amount });
}
/** Complete colour sets a player owns. */
export const fullSets = (g: DGame, pid: string) => GROUPS.filter((_, gi) => ownsGroup(g, pid, gi)).length;
/** Teen Set mode: whoever owns 3 complete sets. */
export const setsWinner = (g: DGame) => (g.mode === 'sets' ? active(g).find((id) => fullSets(g, id) >= SETS_TO_WIN) ?? null : null);

/** Borrow from Seth-ji first, then sell buildings, then mortgage, until `pid` has at least `need`. */
function raise(g: DGame, pid: string, need: number) {
  const short = need - g.cash[pid];
  if (short > 0) { const amt = Math.min(loanRoom(g, pid), Math.ceil(short / LOAN.STEP) * LOAN.STEP); if (amt > 0) takeLoan(g, pid, amt); }
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

/** At Payday: a player far behind gets the Backbencher Bonus, a runaway leader pays Topper Tax into the gullak. */
function catchUp(g: DGame, pid: string) {
  const live = active(g);
  if (live.length < 2) return;
  const worth = Object.fromEntries(live.map((id) => [id, netWorth(g, id)]));
  const sorted = [...live].sort((a, b) => worth[a] - worth[b]);
  const low = sorted[0], top = sorted[sorted.length - 1], second = sorted[sorted.length - 2];
  if (pid === low && worth[low] < worth[top] * CATCHUP.BONUS_BELOW) {
    g.cash[pid] += CATCHUP.BONUS;
    fx(g, { kind: 'catchup', pid, amount: CATCHUP.BONUS, text: 'bonus' });
  } else if (pid === top && worth[top] > worth[second] * CATCHUP.TAX_ABOVE && g.cash[pid] >= CATCHUP.TAX * 4) {
    g.cash[pid] -= CATCHUP.TAX; g.pot += CATCHUP.TAX;
    fx(g, { kind: 'catchup', pid, amount: CATCHUP.TAX, text: 'tax' });
  }
}

function startMove(g: DGame, pid: string, to: number, jump = false, salary = true) {
  const from = g.pos[pid];
  if (salary && to < from && !(to === JAIL && g.jail[pid])) {
    const pay = SALARY * (g.season?.kind === 'placement' ? 2 : 1);
    g.cash[pid] += pay; fx(g, { kind: 'salary', pid, amount: pay });
    catchUp(g, pid);
    const owe = g.debt?.[pid] ?? 0;
    if (owe > 0) { const r = Math.min(owe, LOAN.PAYDAY); g.cash[pid] -= r; g.debt![pid] = owe - r; fx(g, { kind: 'repay', pid, amount: r }); }
  }
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
  // With 2–3 players the one who passed can bid too (bids last), else a 2-player bolee is just a half-price sale.
  if (active(g).length <= 3) queue.push(cur(g));
  const open = Math.round((BOARD[sq].price! * (g.season?.kind === 'sale' ? 0.3 : 0.5)) / 100) * 100;
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
  if (PLACEMENT_ROUND > 0 && g.maxRounds > 0 && g.round === placementStart(g)) fx(g, { kind: 'placement', pid: g.order[0] });
  if (g.maxRounds === 0 && g.round >= MEHNGAI.START && (g.round - MEHNGAI.START) % MEHNGAI.EVERY === 0) fx(g, { kind: 'placement', pid: g.order[0], text: 'mehngai', amount: rentBoost(g) });
  tickSeason(g);
  tickMarket(g);
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

/** Campus Calendar: a season every few rounds, each lasting a few rounds. */
function tickSeason(g: DGame) {
  if (g.season) {
    g.season.rounds--;
    if (g.season.rounds <= 0) { fx(g, { kind: 'season', pid: g.order[0], text: g.season.kind, amount: 0 }); g.season = null; }
  }
  if (g.round % CALENDAR.EVERY !== 0) return;
  const kinds = (Object.keys(SEASONS) as SeasonKind[]).filter((k) => k !== g.lastSeason);
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  g.season = { id: seq++, kind, rounds: CALENDAR.LENGTH };
  g.lastSeason = kind;
  fx(g, { kind: 'season', pid: g.order[0], text: kind, amount: CALENDAR.LENGTH });
}

/** The resale market drifts: values creep up over a long game, trends pull them, and every city wobbles a little. */
function tickMarket(g: DGame) {
  if (!g.market) g.market = BOARD.map(() => 1);
  const target = Math.min(MARKET.GROW_CAP, 1 + MARKET.GROW * g.round);
  let up = { sq: -1, d: 0 }, down = { sq: -1, d: 0 };
  BOARD.forEach((s, i) => {
    if (s.price == null) return;
    const ev = g.events.find((e) => e.sq === i);
    const t = target * (ev ? (ev.mult > 1 ? 1.25 : 0.8) : 1) * (g.season?.kind === 'sale' ? 0.9 : 1);
    const old = g.market![i];
    const m = Math.round(Math.min(MARKET.MAX, Math.max(MARKET.MIN, old + (t - old) * 0.25 + (Math.random() - 0.5) * MARKET.SWING)) * 100) / 100;
    g.market![i] = m;
    const d = m / old - 1;
    if (d > up.d) up = { sq: i, d };
    if (d < down.d) down = { sq: i, d };
  });
  if (up.d >= 0.08 || down.d <= -0.08) {
    fx(g, { kind: 'market', pid: g.order[0], sq: up.d >= 0.08 ? up.sq : undefined, amount: Math.round(up.d * 100), text: down.d <= -0.08 ? `${down.sq}:${Math.round(down.d * 100)}` : undefined });
  }
}

function endTurn(g: DGame) {
  g.sethTried = [];
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
  return s.kind === 'city' && g.season?.kind !== 'exam' && g.owner[sq] === pid && ownsGroup(g, pid, s.group!) && groupSquares(s.group!).every((i) => !g.mort[i])
    && g.build[sq] < MAX_BUILD && g.cash[pid] >= nextBuildCost(g, sq);
};

/** Price of the next building on a city. */
export const nextBuildCost = (g: DGame, sq: number) => buildCost(GROUPS[BOARD[sq].group!].build, g.build[sq] + 1);


/** Cost of a hostile takeover of an opponent's mortgaged city (full price; the owner gets half). */
export const takeoverPrice = (sq: number) => BOARD[sq].price!;
/** What it costs the owner to buy a mortgaged (GIRVI) city back. */
export const buyBackPrice = (sq: number) => Math.round(BOARD[sq].price! * 0.55);

export const isOver = (g: DGame) => active(g).length <= 1 || (g.maxRounds > 0 && g.round > g.maxRounds) || setsWinner(g) != null;

/** Whose decision the game waits on (auction bidders take turns). */
const waiting = (g: DGame) => (isOver(g) || g.phase === 'moving' ? null : g.phase === 'auction' && g.auction ? g.auction.queue[0] : g.phase === 'deal' && g.deal ? g.deal.to : cur(g));

const completesFor = (g: DGame, pid: string, sq: number) => {
  const s = BOARD[sq];
  return s.kind === 'city' && groupSquares(s.group!).every((i) => i === sq || g.owner[i] === pid);
};

export const dhandhaRules: Rules<DGame, DAction> & { ranking(g: DGame): string[] } = {
  maxPlayers: 4,
  start(players: Seat[], options) {
    const order = players.map((p) => p.id);
    const z = <T,>(v: T) => Object.fromEntries(order.map((id) => [id, v])) as Record<string, T>;
    const money = CASH_CHOICES.includes(Number(options.cash)) ? Number(options.cash) : START_CASH; // host's pick in the lobby
    return {
      order, names: Object.fromEntries(players.map((p) => [p.id, p.name])), cash: z(money), pos: z(0),
      owner: BOARD.map(() => null), build: BOARD.map(() => 0), mort: BOARD.map(() => false), jail: z(0), jugaad: z(0),
      turn: Math.floor(Math.random() * order.length), dice: [1, 1], rollId: 0, doubles: 0, again: false, phase: 'roll',
      move: null, card: null, out: [], round: 1, maxRounds: options.rounds === 'classic' || options.rounds === 'sets' ? 0 : 15, pot: 0,
      mode: options.rounds === 'classic' ? 'classic' : options.rounds === 'sets' ? 'sets' : 'quick', debt: z(0), deal: null,
      events: [], lastEventRound: 0, hand: Object.fromEntries(order.map((id) => [id, [] as Power[]])), dblArmed: z(false), streak: z(0), lastRentRound: z(-9),
      spin: null, auction: null, market: BOARD.map(() => 1), season: null, sethTried: [], lastOffer: {},
      stats: { rent: z(0), bought: z(0), peak: z(money), built: z(0), potWins: z(0), minCash: z(money) },
      fx: [], note: 'Campus to Crorepati. Roll!', log: [{ id: seq++, r: 1, t: '🎬 Game on! Everyone starts with ' + fmt(money) }],
    };
  },
  waitingOn: waiting,
  turnKey: (g) => `${g.turn}:${g.phase}:${g.rollId}:${g.auction ? `${g.auction.queue[0]}:${g.auction.next}` : ''}:${g.deal ? g.deal.to : ''}`,
  over: isOver,
  ranking: (g) => [...active(g).sort((a, b) => (b === setsWinner(g) ? 1 : 0) - (a === setsWinner(g) ? 1 : 0) || (g.mode === 'sets' ? fullSets(g, b) - fullSets(g, a) : 0) || netWorth(g, b) - netWorth(g, a)), ...[...g.out].reverse()],
  botDelay: (g) => (g.phase === 'card' ? 2500 : g.phase === 'spin' || g.phase === 'deal' ? 1200 : 850),
  auto: (g) => (g.phase === 'moving' && g.move ? { a: { t: 'advance' }, delay: 700 + (g.move.jump ? 600 : ((g.move.to - g.move.from + 40) % 40) * 170) + 300 } : null),

  bot(g, pid) {
    const sq = g.pos[pid];
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
        const price = g.owner[sq] ? takeoverPrice(sq) : buyPrice(g, sq);
        if (g.owner[sq]) return (completesFor(g, pid, sq) && g.cash[pid] >= price) || g.cash[pid] - price >= 3000 ? { t: 'buy' } : { t: 'pass' };
        return g.cash[pid] - price >= 1200 ? { t: 'buy' } : { t: 'pass' };
      }
      case 'card': return { t: 'cardOk' };
      case 'spin': return { t: 'spin' };
      case 'deal': return botDeal(g, pid);
      case 'auction': {
        const a = g.auction!;
        const cap = BOARD[a.sq].price! * (completesFor(g, pid, a.sq) || (a.leader && completesFor(g, a.leader, a.sq)) ? 1.3 : 0.9);
        return a.next <= cap && g.cash[pid] - a.next >= 1200 ? { t: 'bid' } : { t: 'out' };
      }
      case 'end': {
        const owe = g.debt?.[pid] ?? 0;
        if (owe > 0 && g.cash[pid] - owe > 6000) return { t: 'repay', amount: owe };
        const redeem = BOARD.map((_, i) => i).find((i) => g.owner[i] === pid && g.mort[i] && g.cash[pid] - buyBackPrice(i) > 5000);
        if (redeem != null) return { t: 'unmortgage', sq: redeem };
        const offer = botPropose(g, pid);
        if (offer) return offer;
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
      case 'deal': return { t: 'dealNo' };
      default: return { t: 'skip' };
    }
  },

  act(g0, pid, a) {
    const g = actInner(g0, pid, a);
    if (g && !setsWinner(g0) && setsWinner(g)) { const w = setsWinner(g)!; fx(g, { kind: 'sets', pid: w }); g.note = `🏆 ${g.names[w]} owns ${SETS_TO_WIN} complete sets and wins!`; }
    if (g) writeLog(g0, g);
    if (g) for (const f of g.fx) {
      const bump = (k: string, id: string) => { const x = (g.stats.x ??= {}); x[k] = { ...(x[k] ?? {}), [id]: (x[k]?.[id] ?? 0) + 1 }; };
      if (f.kind === 'deal') { bump('deals', f.pid); if (f.other) bump('deals', f.other); }
      if (f.kind === 'auctionWin') bump('bolees', f.pid);
      if (f.kind === 'cardSold') bump('seth', f.pid);
    }
    if (g && g.out.includes(cur(g)) && g.phase !== 'moving' && g.phase !== 'auction' && !isOver(g)) { g.again = false; endTurn(g); }
    if (g) for (const id of g.order) {
      if (netWorth(g, id) > (g.stats.peak[id] ?? 0)) g.stats.peak[id] = netWorth(g, id);
      if (g.cash[id] < (g.stats.minCash[id] ?? START_CASH)) g.stats.minCash[id] = g.cash[id];
    }
    return g;
  },
};

/** Cities can change hands only without buildings, and both sides must still hold what they offered. */
function dealValid(g: DGame, d: Deal) {
  const ok = (id: string) => g.order.includes(id) && !g.out.includes(id);
  const free = (sq: number, who: string) => BOARD[sq]?.price != null && g.owner[sq] === who && !g.build[sq];
  return ok(d.from) && ok(d.to) && d.from !== d.to && d.give.every((sq) => free(sq, d.from)) && d.get.every((sq) => free(sq, d.to))
    && (d.cash <= 0 || g.cash[d.from] >= d.cash) && (d.cash >= 0 || g.cash[d.to] >= -d.cash);
}

/** Deal terms anyone may propose: both sides give something, at most DEAL_MAX cities a side, cash in ₹500 steps (₹100 for a single-city sale). */
function termsOk(g: DGame, d: Deal) {
  const step = d.sale ? MARKET.STEP : GIFT_STEP;
  return dealValid(g, d) && d.give.length <= DEAL_MAX && d.get.length <= DEAL_MAX && !(d.cash % step)
    && (d.give.length > 0 || d.cash > 0) && (d.get.length > 0 || d.cash < 0);
}

/** How much `owner` values a city in a deal: market price, plus a lot more for one that finishes (or breaks) a colour set. */
function dealWorth(g: DGame, sq: number, owner: string, gaining: boolean) {
  const s = BOARD[sq];
  let v = s.price! * marketMult(g, sq) * (g.mort[sq] ? 0.5 : 1);
  if (s.kind === 'city') {
    const sqs = groupSquares(s.group!), mineCount = sqs.filter((i) => g.owner[i] === owner).length;
    if (gaining && mineCount === sqs.length - 1) v *= 2.5;
    else if (!gaining && mineCount === sqs.length) v *= 3;
    else if (mineCount > (gaining ? 0 : 1)) v *= 1.4;
  }
  return v;
}

/** A bot says yes to a fair deal, and once per deal it may counter by asking for the cash it would take. */
function botDeal(g: DGame, pid: string): DAction {
  const d = g.deal!;
  const citiesIn = d.give.reduce((t, sq) => t + dealWorth(g, sq, pid, true), 0);
  const citiesOut = d.get.reduce((t, sq) => t + dealWorth(g, sq, pid, false), 0);
  const fair = (t: number) => citiesIn + Math.max(0, t) >= (citiesOut + Math.max(0, -t)) * 1.1; // t: cash the bot receives
  const keeps = (t: number) => t >= 0 || g.cash[pid] + t >= 1500;
  if (dealValid(g, d) && fair(d.cash) && keeps(d.cash)) return { t: 'dealYes' };
  if (d.counter || !dealValid(g, d)) return { t: 'dealNo' };
  // The cash that would make it fair for the bot, rounded in the deal's steps.
  const step = d.sale ? MARKET.STEP : GIFT_STEP;
  const raw = citiesIn >= citiesOut * 1.1 ? -(citiesIn / 1.1 - citiesOut) : citiesOut * 1.1 - citiesIn;
  const want = raw >= 0 ? Math.ceil(raw / step) * step : -Math.floor(-raw / step) * step;
  const gap = Math.abs(want - d.cash);
  if (want === d.cash || !fair(want) || !keeps(want) || (want > 0 && g.cash[d.from] < want) || gap > Math.max(2000, (citiesIn + citiesOut) * 0.6)) return { t: 'dealNo' };
  const c: Deal = { from: pid, to: d.from, give: [...d.get], get: [...d.give], cash: -want, back: d.back, counter: true, sale: d.sale };
  return termsOk(g, c) ? { t: 'dealCounter', give: c.give, get: c.get, cash: c.cash } : { t: 'dealNo' };
}

/** A bot one city short of a colour set offers the owner of that city a fair swap (every few rounds at most). */
function botPropose(g: DGame, pid: string): DAction | null {
  if ((g.lastOffer?.[pid] ?? -9) > g.round - 3) return null;
  const mineFree = BOARD.map((_, i) => i).filter((i) => g.owner[i] === pid && !g.build[i]);
  for (let gi = 0; gi < GROUPS.length; gi++) {
    const sqs = groupSquares(gi);
    if (sqs.filter((i) => g.owner[i] === pid).length !== sqs.length - 1) continue;
    const miss = sqs.find((i) => g.owner[i] !== pid)!, other = g.owner[miss];
    if (!other || g.out.includes(other) || g.build[miss]) continue;
    const theirLoss = dealWorth(g, miss, other, false);
    // Offer the city they would like most that isn't part of a set the bot is chasing.
    const chasing = (sq: number) => BOARD[sq].kind === 'city' && groupSquares(BOARD[sq].group!).filter((i) => g.owner[i] === pid).length >= groupSquares(BOARD[sq].group!).length - 1;
    const cand = mineFree.filter((sq) => !sqs.includes(sq) && !chasing(sq)).sort((a, b) => dealWorth(g, b, other, true) - dealWorth(g, a, other, true))[0];
    const gain = cand != null ? dealWorth(g, cand, other, true) : 0;
    const cash = Math.max(0, Math.ceil((theirLoss * 1.15 - gain) / GIFT_STEP) * GIFT_STEP);
    if (g.cash[pid] - cash < 2000 || cash + (cand != null ? BOARD[cand].price! : 0) > dealWorth(g, miss, pid, true)) continue;
    const d: Deal = { from: pid, to: other, give: cand != null ? [cand] : [], get: [miss], cash, back: 'end' };
    if (termsOk(g, d)) return { t: 'deal', to: other, give: d.give, get: d.get, cash };
  }
  return null;
}

const LOG_MAX = 80;
/** Lines for effects a turn's note doesn't already say. */
function fxLine(g: DGame, f: Fx): string | null {
  const who = g.names[f.pid] ?? '';
  switch (f.kind) {
    case 'salary': return `💸 ${who} collected ${fmt(f.amount ?? 0)} on Payday`;
    case 'gift': return `💝 ${who} sent ${fmt(f.amount ?? 0)} to ${g.names[f.other!] ?? ''}`;
    case 'repay': return f.amount ? `🏦 ${who} repaid ${fmt(f.amount)} to Seth-ji` : null;
    case 'loan': return `🏦 ${who} took a ${fmt(f.amount ?? 0)} loan from Seth-ji`;
    case 'mortgage': return `🏦 ${who} put ${BOARD[f.sq!].name} on GIRVI${f.amount ? ` for ${fmt(f.amount)}` : ''}`;
    case 'unmort': return `💰 ${who} bought ${BOARD[f.sq!].name} back from GIRVI for ${fmt(f.amount ?? 0)}`;
    case 'streak': return `🔥 ${who} got a ${fmt(f.amount ?? 0)} rent-streak bonus`;
    case 'shield': return `🛡️ ${who}'s Rent Shield blocked ${fmt(f.amount ?? 0)} rent`;
    case 'setComplete': return `👑 ${who} owns the full ${GROUPS[BOARD[f.sq!].group!].name} set — can build now`;
    case 'power': return f.text && f.text !== 'double-armed' ? `⚡ ${who} got a power-up: ${POWERS[f.text as Power]?.name ?? f.text}` : null;
    case 'eventEnd': return `${BOARD[f.sq!].name} is back to normal rent`;
    case 'season': {
      const s = SEASONS[f.text as SeasonKind];
      return s ? (f.amount ? `${s.emoji} ${s.name}! ${s.text} for ${f.amount} rounds` : `${s.emoji} ${s.name} is over`) : null;
    }
    case 'catchup': return f.text === 'bonus' ? `🎒 Backbencher Bonus: ${who} gets ${fmt(f.amount ?? 0)} to catch up` : `🎓 Topper Tax: ${who} pays ${fmt(f.amount ?? 0)} into the gullak`;
    case 'market': {
      const parts: string[] = [];
      if (f.sq != null) parts.push(`${BOARD[f.sq].name} +${f.amount}%`);
      if (f.text) { const [sq, d] = f.text.split(':').map(Number); parts.push(`${BOARD[sq].name} ${d}%`); }
      return `📊 Market moves: ${parts.join(' · ')}`;
    }
    case 'placement': return f.text === 'mehngai' ? `📈 Mehngai! Every rent is now ×${+(f.amount ?? 1).toFixed(1)}` : '🎓 Placement Season: every rent ×1.5 till the end';
    case 'event': {
      const e = g.events.find((x) => x.id === f.amount);
      return e ? `${e.emoji} ${e.title} in ${BOARD[e.sq].name}: rent ×${e.mult} for ${e.rounds} rounds` : null;
    }
    default: return null;
  }
}
function writeLog(g0: DGame, g: DGame) {
  const add: LogLine[] = [];
  const who = cur(g0);
  // A loan or repayment the player chose already has its own note; only automatic ones need a line.
  const bankNote = g.note !== g0.note && g.note.startsWith('🏦');
  for (const f of g.fx) {
    if (bankNote && (f.kind === 'loan' || f.kind === 'repay')) continue;
    const t = fxLine(g, f);
    if (t) add.push({ id: seq++, r: g.round, t, pid: f.pid });
  }
  // Plain dice rolls and "for sale" prompts would flood the log; what they led to gets its own line.
  if (g.note && g.note !== g0.note && !/ rolled \d+ ?\+ ?\d+$| is for sale /.test(g.note)) add.push({ id: seq++, r: g.round, t: g.note, pid: who });
  if (add.length) g.log = [...(g0.log ?? []), ...add].slice(-LOG_MAX);
}

function actInner(g0: DGame, pid: string, a: DAction): DGame | null {
  const g = clone(g0);
  const me = cur(g);
  if (a.t === 'advance') {
    if (pid !== AUTO || g.phase !== 'moving') return null;
    g.move = null; land(g);
    return g;
  }
  // A gift can be sent by any player still in the game, at any time, in steps of ₹500, up to the cash they hold.
  if (a.t === 'gift') {
    const amt = Math.floor(Number(a.amount));
    const ok = (id: string) => g.order.includes(id) && !g.out.includes(id);
    if (!ok(pid) || !ok(a.to) || a.to === pid || !(amt > 0) || amt % GIFT_STEP || amt > g.cash[pid] || isOver(g)) return null;
    g.cash[pid] -= amt; g.cash[a.to] += amt;
    fx(g, { kind: 'gift', pid, other: a.to, amount: amt });
    return g;
  }
  // A deal is answered by the player it was offered to.
  if (g.phase === 'deal' && g.deal) {
    const d = g.deal;
    if (pid !== d.to || (a.t !== 'dealYes' && a.t !== 'dealNo' && a.t !== 'dealCounter')) return null;
    if (a.t === 'dealCounter') {
      // One counter-offer per deal: the answer comes back with new terms, and then it's yes or no.
      if (d.counter) return null;
      const c: Deal = { from: d.to, to: d.from, give: [...new Set(a.give ?? [])], get: [...new Set(a.get ?? [])], cash: Math.round(Number(a.cash) || 0), back: d.back, counter: true, sale: d.sale };
      if (!termsOk(g, c)) return null;
      g.deal = c;
      fx(g, { kind: 'counter', pid: c.from, other: c.to });
      g.note = `🔁 ${g.names[c.from]} sends ${g.names[c.to]} a counter-offer`;
      return g;
    }
    g.deal = null; g.phase = d.back;
    if (a.t === 'dealNo') { g.note = `🙅 ${g.names[d.to]} said no to ${g.names[d.from]}'s deal`; return g; }
    if (!dealValid(g, d)) { g.note = 'That deal no longer adds up'; return g; }
    for (const sq of d.give) g.owner[sq] = d.to;
    for (const sq of d.get) g.owner[sq] = d.from;
    if (d.cash > 0) { g.cash[d.from] -= d.cash; g.cash[d.to] += d.cash; }
    if (d.cash < 0) { g.cash[d.to] += d.cash; g.cash[d.from] -= d.cash; }
    fx(g, { kind: 'deal', pid: d.from, other: d.to, amount: d.cash, text: `${d.give.join(',')}|${d.get.join(',')}` });
    for (const [who, list] of [[d.to, d.give], [d.from, d.get]] as const) {
      for (const sq of list) if (BOARD[sq].kind === 'city' && ownsGroup(g, who, BOARD[sq].group!)) fx(g, { kind: 'setComplete', pid: who, sq });
    }
    const sold = d.give.length + d.get.length === 1 ? (d.give[0] ?? d.get[0]) : null;
    g.note = sold != null && d.cash ? `🏷️ ${g.names[g.owner[sold]!]} bought ${BOARD[sold].name} for ${fmt(Math.abs(d.cash))}` : `🤝 Deal done: ${g.names[d.from]} ⇄ ${g.names[d.to]}`;
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
  if (a.t === 'deal') {
    const d: Deal = { from: me, to: a.to, give: [...new Set(a.give ?? [])], get: [...new Set(a.get ?? [])], cash: Math.round(Number(a.cash) || 0), back: g.phase === 'end' ? 'end' : 'roll' };
    if (!canManage || !termsOk(g, d)) return null;
    g.deal = d; g.phase = 'deal'; g.lastOffer![me] = g.round;
    g.note = `🤝 ${g.names[me]} offers ${g.names[a.to]} a deal`;
    return g;
  }
  // Sell one city to another player at your own price (they can accept, refuse or counter).
  if (a.t === 'offerCity') {
    const price = Math.round(Number(a.price) || 0);
    const d: Deal = { from: me, to: a.to, give: [a.sq], get: [], cash: -price, back: g.phase === 'end' ? 'end' : 'roll', sale: true };
    if (!canManage || price <= 0 || !termsOk(g, d)) return null;
    g.deal = d; g.phase = 'deal'; g.lastOffer![me] = g.round;
    g.note = `🏷️ ${g.names[me]} offers ${BOARD[a.sq].name} to ${g.names[a.to]} for ${fmt(price)}`;
    return g;
  }
  // Offer a city back to Seth-ji at your own price. He decides by his own private sums.
  if (a.t === 'sellSeth') {
    const price = Math.round(Number(a.price) || 0);
    if (!canManage || g.owner[a.sq] !== me || price <= 0 || price % MARKET.STEP || g.sethTried!.includes(a.sq)) return null;
    g.sethTried!.push(a.sq);
    const mv = marketValue(g, a.sq), limit = sethLimit(g, me, a.sq);
    const yes = price <= mv * 0.6 || (price <= mv * 1.4 && price <= limit);
    if (!yes) {
      fx(g, { kind: 'sethNo', pid: me, sq: a.sq, amount: price, text: price <= limit * 1.15 ? 'close' : 'far' });
      g.note = `🙅 Seth-ji turned down ${g.names[me]}'s ${fmt(price)} for ${BOARD[a.sq].name}`;
      return g;
    }
    g.cash[me] += price; g.owner[a.sq] = null; g.build[a.sq] = 0; g.mort[a.sq] = false;
    fx(g, { kind: 'cardSold', pid: me, sq: a.sq, amount: price });
    g.note = `🤝 Seth-ji bought ${BOARD[a.sq].name} from ${g.names[me]} for ${fmt(price)}`;
    return g;
  }
  if (a.t === 'loan') {
    const amt = Math.floor(Number(a.amount) || 0);
    if (!canManage || amt <= 0 || amt % LOAN.STEP || amt > loanRoom(g, me)) return null;
    takeLoan(g, me, amt);
    g.note = `🏦 ${g.names[me]} borrowed ${fmt(amt)} from Seth-ji`;
    return g;
  }
  if (a.t === 'repay') {
    const amt = Math.floor(Number(a.amount) || 0), owe = g.debt?.[me] ?? 0;
    if (!canManage || amt <= 0 || amt > owe || amt > g.cash[me]) return null;
    g.cash[me] -= amt; g.debt![me] = owe - amt;
    fx(g, { kind: 'repay', pid: me, amount: amt });
    g.note = `🏦 ${g.names[me]} repaid ${fmt(amt)} to Seth-ji${owe - amt ? '' : ' — all clear!'}`;
    return g;
  }
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
      const cost = buyPrice(g, sq);
      if (g.cash[me] < cost) return null;
      g.cash[me] -= cost; g.owner[sq] = me; g.phase = 'end';
      fx(g, { kind: 'buy', pid: me, sq, amount: cost });
      g.stats.bought[me]++;
      if (s.kind === 'city' && ownsGroup(g, me, s.group!)) fx(g, { kind: 'setComplete', pid: me, sq });
      g.note = `🏷️ ${g.names[me]} bought ${s.name}${cost < s.price! ? ` at ${fmt(cost)} (sale!)` : ''}!`;
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
    case 'mortgage': {
      if (!canManage || g.owner[a.sq] !== me || g.mort[a.sq] || g.build[a.sq]) return null;
      g.mort[a.sq] = true; g.cash[me] += BOARD[a.sq].price! / 2; fx(g, { kind: 'mortgage', pid: me, sq: a.sq, amount: BOARD[a.sq].price! / 2 }); return g;
    }
    case 'unmortgage': {
      const cost = buyBackPrice(a.sq);
      if (!canManage || g.owner[a.sq] !== me || !g.mort[a.sq] || g.cash[me] < cost) return null;
      g.mort[a.sq] = false; g.cash[me] -= cost; fx(g, { kind: 'unmort', pid: me, sq: a.sq, amount: cost }); return g;
    }
  }
  return null;
}

export { canBuild };
