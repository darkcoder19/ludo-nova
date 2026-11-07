// Hawai Adda: an idle airport tycoon. Passengers walk in, check in, clear security, wait in the hall (or eat, shop,
// relax in the lounge) until their plane lands, line up in the boarding area and board one by one, walking down the
// aisle to their seat. You earn at every step. Tap any area to add counters, speed them up or earn more per passenger.
import { useEffect, useRef, useState } from 'react';
import { Backdrop } from '../components/Home';
import { festivalOn } from '../game/festivals';
import { loadProfile, recordGame, saveProfile } from '../game/profile';
import { recordProgress } from '../game/progress';
import { isMuted, setMuted, sfx } from '../game/sound';
import '../atc/atc.css'; // shared hero / how-to card styles
import './tycoon.css';

// ---------------- data ----------------
type SKey = 'checkin' | 'security' | 'seats' | 'food' | 'shop' | 'lounge' | 'gate' | 'walk';
interface SDef { name: string; icon: string; base: number; svc: number; fee: number; unlock: number; maxN: number; text: string; add: string; spd: string; inc: string }
const S: Record<SKey, SDef> = {
  checkin: { name: 'Check-in', icon: '🧾', base: 300, svc: 4, fee: 9, unlock: 0, maxN: 8, text: 'Every passenger checks in first.', add: 'Add a counter', spd: 'Faster check-in', inc: 'Higher check-in fee' },
  security: { name: 'Security', icon: '🛂', base: 400, svc: 5, fee: 8, unlock: 0, maxN: 8, text: 'Scanners and frisking. Long queues make people miss flights.', add: 'Add a lane', spd: 'Faster scanners', inc: 'Security fee' },
  seats: { name: 'Waiting Hall', icon: '💺', base: 250, svc: 0, fee: 2, unlock: 0, maxN: 8, text: 'Passengers wait here until their plane lands. Standing passengers get grumpy.', add: 'Add a row of seats', spd: 'Comfier seats (rating)', inc: 'Paid WiFi' },
  food: { name: 'Food Court', icon: '🍛', base: 1500, svc: 6, fee: 18, unlock: 120, maxN: 6, text: 'Hungry flyers eat while they wait for their plane.', add: 'Add a stall', spd: 'Faster service', inc: 'Pricier menu' },
  shop: { name: 'Duty Free', icon: '🛍️', base: 4000, svc: 7, fee: 32, unlock: 700, maxN: 6, text: 'Perfume, chocolates, souvenirs.', add: 'Add a shop', spd: 'Quicker billing', inc: 'Premium brands' },
  lounge: { name: 'Lounge', icon: '🛋️', base: 6000, svc: 10, fee: 70, unlock: 1500, maxN: 4, text: 'Business and first class relax here instead of the hall, and pay well for it.', add: 'Add lounge seats', spd: 'Faster service', inc: 'Fancier buffet' },
  gate: { name: 'Gates', icon: '🛫', base: 1200, svc: 2.5, fee: 14, unlock: 0, maxN: 4, text: 'Each gate has its own stand and boarding area. A new gate means more planes.', add: 'Open a new gate', spd: 'Faster boarding', inc: 'Boarding fee' },
  walk: { name: 'Walkways', icon: '🚶', base: 500, svc: 0, fee: 0, unlock: 0, maxN: 1, text: 'Travelators and signboards: passengers walk faster everywhere.', add: '', spd: 'Faster walking', inc: '' },
};
const AREAS: SKey[] = ['checkin', 'security', 'seats', 'food', 'shop', 'lounge', 'gate'];
type Cls = 0 | 1 | 2; // economy, business, first
const CLS = [{ name: 'Economy', color: '#2b9bff', mult: 1 }, { name: 'Business', color: '#9b6bff', mult: 3 }, { name: 'First', color: '#f0b400', mult: 6 }];
const PLANES = [
  { id: 'atr', name: 'ATR 72', seats: [70, 0, 0], unlock: 0, L: 250, W: 26, span: 104, tail: '#2b7bff' },
  { id: 'a320', name: 'A320', seats: [168, 12, 0], unlock: 350, L: 320, W: 30, span: 118, tail: '#ff8c42' },
  { id: 'b787', name: '787 Dreamliner', seats: [220, 28, 8], unlock: 2500, L: 390, W: 36, span: 128, tail: '#12a88f' },
  { id: 'a380', name: 'A380 Superjumbo', seats: [430, 70, 14], unlock: 9000, L: 450, W: 42, span: 134, tail: '#c9302c' },
];
const AIRLINES = ['UD', 'CJ', 'MX', 'MW', 'PA', 'SA'];
const KEY = 'hawaiadda-v2';
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const short = (n: number) => (n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(1)}L` : n >= 1000 ? `₹${+(n / 1000).toFixed(1)}k` : `₹${Math.round(n)}`);
const LEVEL_NAMES = [[0, 'Hawai Patti'], [500, 'Small Town Airport'], [3000, 'Regional Airport'], [12000, 'Metro Airport'], [40000, 'International Hub']] as const;
const levelName = (pax: number) => LEVEL_NAMES.reduce((n, [p, name]) => (pax >= p ? name : n), LEVEL_NAMES[0][1] as string);

interface Lvl { n: number; spd: number; inc: number }
interface Save { v: 2; cash: number; rating: number; served: number; flights: number; earned: number; st: Record<SKey, Lvl>; seen: number; perMin: number }
export const fresh = (): Save => ({ v: 2, cash: 2500, rating: 3, served: 0, flights: 0, earned: 0, seen: Date.now(), perMin: 0,
  st: { checkin: { n: 1, spd: 1, inc: 1 }, security: { n: 1, spd: 1, inc: 1 }, seats: { n: 1, spd: 1, inc: 1 }, food: { n: 0, spd: 1, inc: 1 }, shop: { n: 0, spd: 1, inc: 1 },
    lounge: { n: 0, spd: 1, inc: 1 }, gate: { n: 1, spd: 1, inc: 1 }, walk: { n: 1, spd: 1, inc: 1 } } });
const load = (): Save => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s?.v === 2) { s.st.walk ??= { n: 1, spd: 1, inc: 1 }; s.st.gate.n = Math.min(4, s.st.gate.n); s.st.seats.n = Math.min(8, s.st.seats.n); s.st.lounge.n = Math.min(4, s.st.lounge.n); return s; }
  } catch { /* fresh */ }
  return fresh();
};
const store = (s: Save) => { try { localStorage.setItem(KEY, JSON.stringify({ ...s, seen: Date.now() })); } catch { /* full */ } };

// costs grow with each step
export const costAdd = (k: SKey, l: Lvl) => Math.round(S[k].base * (l.n === 0 ? 1 : (k === 'gate' ? 2.6 : 1.75) ** l.n));
export const costSpd = (k: SKey, l: Lvl) => Math.round(S[k].base * 0.8 * 1.6 ** l.spd);
export const costInc = (k: SKey, l: Lvl) => Math.round(S[k].base * 0.9 * 1.7 ** l.inc);
const svcTime = (k: SKey, l: Lvl) => S[k].svc / (1 + 0.32 * (l.spd - 1));
const feeOf = (k: SKey, l: Lvl) => S[k].fee * (1 + 0.45 * (l.inc - 1));
const capOf = (k: SKey, l: Lvl) => (k === 'seats' ? l.n * 8 : k === 'food' || k === 'shop' ? l.n * 3 : k === 'lounge' ? l.n * 4 : l.n);
/** Walking speed in floor-plan units a second: slow to start, faster with every Walkways upgrade. */
const walkSpeed = (s: Save) => 34 * (1 + 0.28 * (s.st.walk.spd - 1));

// ---------------- floor plan (1400×620, landscape; turned upright on phones) ----------------
interface Pt { x: number; y: number }
const LW = 1400, LH = 620;
const ENTRY: Pt = { x: 40, y: 310 };
const SLOT = 145; // each gate owns a horizontal band of the apron: planes never overlap
const slotY = (i: number) => 30 + i * SLOT + SLOT / 2;
const AREA: Record<Exclude<SKey, 'walk'>, { x: number; y: number; w: number; h: number }> = {
  checkin: { x: 110, y: 60, w: 130, h: 500 }, security: { x: 275, y: 60, w: 130, h: 500 },
  food: { x: 440, y: 30, w: 220, h: 105 }, seats: { x: 440, y: 160, w: 140, h: 300 }, lounge: { x: 590, y: 160, w: 70, h: 300 }, shop: { x: 440, y: 485, w: 220, h: 105 },
  gate: { x: 690, y: 30, w: 170, h: 4 * SLOT },
};
const boardArea = (i: number) => ({ x: 695, y: slotY(i) - SLOT / 2 + 8, w: 140, h: SLOT - 16 });
const counter = (k: 'checkin' | 'security', i: number, n: number): Pt => ({ x: k === 'checkin' ? 200 : 365, y: 310 + (i - (n - 1) / 2) * Math.min(62, 440 / Math.max(1, n)) });
const seatAt = (k: SKey, i: number): Pt => {
  if (k === 'food') return { x: 460 + (i % 6) * 34, y: 75 + Math.floor(i / 6) * 28 };
  if (k === 'shop') return { x: 460 + (i % 6) * 34, y: 530 + Math.floor(i / 6) * 28 };
  if (k === 'lounge') return { x: 610 + (i % 2) * 30, y: 195 + Math.floor(i / 2) * 32 };
  return { x: 458 + (i % 5) * 26, y: 195 + Math.floor(i / 5) * 21 }; // hall seats
};
const NOSE = 905; // planes park nose-in to the jet bridges
const planeX0 = NOSE;
/** Seat positions inside the cabin for a flight with `n` passenger groups (two seats a row, either side of the aisle). */
const cabinSeat = (plane: number, n: number, i: number): Pt => {
  const P = PLANES[plane], rows = Math.ceil(n / 2), x0 = planeX0 + 40, x1 = planeX0 + P.L - 60;
  const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
  return { x: x0 + (rows > 1 ? (row * (x1 - x0)) / (rows - 1) : 0), y: side * P.W * 0.24 };
};

// ---------------- simulation ----------------
type GState = 'walk' | 'queue' | 'svc' | 'wait' | 'line' | 'boarding' | 'seated' | 'gone';
interface Group { id: number; cls: Cls; size: number; flight: number; x: number; y: number; path: Pt[]; st: GState; at: SKey | 'entry' | null; stage: number; t: number; tt: number; slot: number; extras: SKey[]; seat: number; color: string }
interface Flight { id: number; plane: number; gate: number; code: string; groups: number; total: number; spawned: number; seated: number; land: number; parkedAt: number; leaveBy: number; state: 'due' | 'in' | 'parked' | 'out'; t: number; boarding: number | null }
interface Pop { x: number; y: number; text: string; t: number; big?: boolean }
interface Sim { t: number; groups: Group[]; flights: Flight[]; queues: Record<string, number[]>; busy: Record<string, (number | null)[]>; pops: Pop[]; gateNext: number[]; seq: number; income: number[] }
export function newSim(): Sim { return { t: 0, groups: [], flights: [], queues: {}, busy: {}, pops: [], gateNext: [3, 20, 35, 50], seq: 1, income: [] }; }

function earn(s: Save, sim: Sim, at: Pt, amount: number) {
  s.cash += amount; s.earned += amount; sim.income.push(amount);
  sim.pops.push({ x: at.x, y: at.y - 16, text: `+${short(amount)}`, t: 0 });
}
const walkTo = (g: Group, ...pts: Pt[]) => { g.path = pts; g.st = 'walk'; };

/** Next stop after the previous one is done: check-in → security → (food / shop) → hall or lounge. */
function advance(s: Save, sim: Sim, g: Group) {
  const route: SKey[] = ['checkin', 'security', ...g.extras, g.cls > 0 && s.st.lounge.n ? 'lounge' : 'seats'];
  g.stage++;
  const next = route[g.stage];
  if (!next) { g.st = 'wait'; return; }
  g.at = next;
  if (next === 'checkin' || next === 'security') {
    (sim.queues[next] ??= []).push(g.id);
    const a = AREA[next]; walkTo(g, { x: a.x - 14, y: 310 + (Math.random() - 0.5) * 50 });
    return;
  }
  // take a free seat / table, or stand at the side of the area
  const used = new Set(sim.groups.filter((o) => o !== g && o.at === next && o.st !== 'gone' && o.st !== 'line' && o.st !== 'boarding' && o.st !== 'seated').map((o) => o.slot));
  let slot = -1; for (let i = 0; i < capOf(next, s.st[next]); i++) if (!used.has(i)) { slot = i; break; }
  g.slot = slot;
  const a = AREA[next as Exclude<SKey, 'walk'>], p = slot >= 0 ? seatAt(next, slot) : { x: a.x + 15 + Math.random() * (a.w - 30), y: a.y + a.h - 14 };
  walkTo(g, { x: Math.max(g.x, a.x - 12), y: p.y }, p);
}

/** Time the next plane lands at a free gate; its passengers start arriving well before it does. */
function scheduleFlight(s: Save, sim: Sim, gate: number) {
  const pool = PLANES.map((p, i) => ({ p, i })).filter(({ p }) => s.served >= p.unlock);
  const pick = pool[Math.min(pool.length - 1, Math.floor(Math.random() ** 0.7 * pool.length))];
  const seats = pick.p.seats, fill = Math.min(1, 0.6 + 0.08 * s.rating + (festivalOn() ? 0.15 : 0));
  const total = Math.max(10, Math.round((seats[0] + seats[1] + seats[2]) * fill));
  const groups = Math.min(18, Math.max(5, Math.round(total / 12)));
  const land = sim.t + 30 + Math.random() * 30; // lands 30–60 s from now
  sim.flights.push({ id: sim.seq++, plane: pick.i, gate, code: `${AIRLINES[Math.floor(Math.random() * AIRLINES.length)]}${100 + Math.floor(Math.random() * 900)}`, groups, total, spawned: 0, seated: 0,
    land, parkedAt: 0, leaveBy: 0, state: 'due', t: sim.t, boarding: null });
}

export function stepSim(s: Save, sim: Sim, dt: number) {
  sim.t += dt;
  const sp = walkSpeed(s) * dt;
  // each open gate gets a plane, then the next one 30–60 s after the last took off
  for (let gi = 0; gi < s.st.gate.n; gi++) {
    if (!sim.flights.some((f) => f.gate === gi && f.state !== 'out') && sim.t >= (sim.gateNext[gi] ?? 0)) scheduleFlight(s, sim, gi);
  }
  for (const f of sim.flights) {
    const P = PLANES[f.plane];
    // passengers arrive at the entrance from the moment the flight is scheduled, over ~35 s
    const due = Math.min(f.groups, Math.floor(((sim.t - f.t) / 35) * f.groups) + 1);
    while (f.spawned < due) {
      const seats = P.seats, tot = seats[0] + seats[1] + seats[2], r = Math.random() * tot;
      const cls: Cls = r < seats[2] ? 2 : r < seats[2] + seats[1] ? 1 : 0;
      const extras: SKey[] = [];
      if (s.st.food.n && Math.random() < 0.45) extras.push('food');
      if (s.st.shop.n && Math.random() < (cls ? 0.5 : 0.25)) extras.push('shop');
      const g: Group = { id: sim.seq++, cls, size: Math.max(1, Math.round(f.total / f.groups)), flight: f.id, x: ENTRY.x - 30, y: ENTRY.y + (Math.random() - 0.5) * 50, path: [], st: 'walk', at: 'entry', stage: -1, t: 0, tt: 0, slot: -1, extras, seat: -1, color: CLS[cls].color };
      g.path = [{ x: ENTRY.x + 10, y: g.y }];
      sim.groups.push(g); f.spawned++;
    }
    if (f.state === 'due' && sim.t >= f.land - 6) f.state = 'in';
    if (f.state === 'in' && sim.t >= f.land) {
      f.state = 'parked'; f.parkedAt = sim.t; f.leaveBy = sim.t + 40 + f.groups * 9;
      sim.pops.push({ x: NOSE + 120, y: slotY(f.gate) - 40, text: `🛬 ${f.code} landed`, t: 0, big: true });
    }
    if (f.state === 'parked') {
      const allIn = f.spawned === f.groups && f.seated === f.groups;
      if ((allIn && sim.t > f.parkedAt + 3) || sim.t >= f.leaveBy) {
        f.state = 'out'; f.t = sim.t;
        const missed = sim.groups.filter((g) => g.flight === f.id && g.st !== 'seated' && g.st !== 'gone');
        for (const g of missed) g.st = 'gone';
        for (const g of sim.groups) if (g.flight === f.id && g.st === 'seated') g.st = 'gone';
        s.flights++;
        sim.gateNext[f.gate] = sim.t + 6; // the next flight for this gate gets scheduled shortly (and lands 30–60 s later)
        const pax = Math.round(missed.length * (f.total / f.groups));
        if (missed.length) { s.rating = Math.max(0.5, s.rating - 0.05 * missed.length); sim.pops.push({ x: NOSE + 120, y: slotY(f.gate) - 40, text: `😡 ${pax} missed the flight`, t: 0, big: true }); }
        else { s.rating = Math.min(5, s.rating + 0.06 + s.st.seats.spd * 0.005); sim.pops.push({ x: NOSE + 120, y: slotY(f.gate) - 40, text: '✈️ Full and on time!', t: 0, big: true }); sfx.home(); }
      }
    }
  }
  sim.flights = sim.flights.filter((f) => !(f.state === 'out' && sim.t - f.t > 7));

  // counters serve their queues
  for (const k of ['checkin', 'security'] as const) {
    const l = s.st[k], busy = (sim.busy[k] ??= []); busy.length = l.n;
    const q = (sim.queues[k] ??= []);
    for (let i = 0; i < l.n; i++) {
      if (busy[i] != null && !sim.groups.some((x) => x.id === busy[i] && x.st === 'svc')) busy[i] = null;
      if (busy[i] != null) continue;
      const gid = q.find((id) => sim.groups.find((x) => x.id === id)?.st === 'queue');
      if (gid == null) continue;
      busy[i] = gid; q.splice(q.indexOf(gid), 1);
      const g = sim.groups.find((x) => x.id === gid)!, p = counter(k, i, l.n);
      g.st = 'svc'; g.tt = g.t = svcTime(k, l) * (0.85 + Math.random() * 0.3); g.path = [{ x: p.x - 16, y: p.y }];
    }
  }
  // each parked plane boards one passenger group at a time: the next waits until the last is in their seat
  for (const f of sim.flights) {
    if (f.state !== 'parked' || f.boarding != null) continue;
    const line = sim.groups.filter((g) => g.flight === f.id && g.st === 'line').sort((a, b) => a.slot - b.slot);
    const g = line[0];
    if (!g || g.path.length) continue;
    const y = slotY(f.gate), seat = cabinSeat(f.plane, f.groups, f.seated);
    f.boarding = g.id; g.st = 'boarding'; g.seat = f.seated; g.tt = g.t = svcTime('gate', s.st.gate);
    g.path = [{ x: 845, y: y - 22 }, { x: NOSE + 22, y: y - 22 }, { x: NOSE + 22, y }, { x: seat.x, y }, { x: seat.x, y: y + seat.y }];
    for (const o of line.slice(1)) o.slot--; // everyone steps up one place
  }

  for (const g of sim.groups) {
    if (g.st === 'gone' || g.st === 'seated') continue;
    const f = sim.flights.find((x) => x.id === g.flight);
    if (g.st === 'boarding') {
      // a short ticket check at the gate, then down the jet bridge and the aisle at walking pace
      if (g.t > 0) { g.t -= dt; continue; }
      if (move(g, sp * 1.6)) continue; // people walk briskly down the aisle
      g.st = 'seated';
      if (f) { f.seated++; f.boarding = null; s.served += g.size; earn(s, sim, g, feeOf('gate', s.st.gate) * CLS[g.cls].mult * g.size); }
      continue;
    }
    if (g.path.length && move(g, sp)) continue;
    if (g.st === 'walk') {
      if (g.at === 'entry') { advance(s, sim, g); continue; }
      if (g.at === 'checkin' || g.at === 'security') { g.st = 'queue'; continue; }
      if (g.at === 'seats') { g.st = 'wait'; continue; }
      if (g.at === 'food' || g.at === 'shop' || g.at === 'lounge') { g.st = 'svc'; g.tt = g.t = svcTime(g.at, s.st[g.at]) * (1.4 + Math.random() * 0.6); continue; }
    }
    if (g.st === 'queue' && (g.at === 'checkin' || g.at === 'security')) {
      const q = sim.queues[g.at] ?? [], pos = q.indexOf(g.id), a = AREA[g.at];
      const target = { x: a.x - 16 - (pos % 9) * 12, y: 310 + (Math.floor(pos / 9) - 1) * 16 };
      g.x += (target.x - g.x) * Math.min(1, dt * 3); g.y += (target.y - g.y) * Math.min(1, dt * 3);
      continue;
    }
    if (g.st === 'svc') {
      g.t -= dt;
      if (g.t > 0) continue;
      const k = g.at as SKey;
      if (k === 'checkin' || k === 'security') { const b = sim.busy[k], i = b.indexOf(g.id); if (i >= 0) b[i] = null; }
      earn(s, sim, g, feeOf(k, s.st[k]) * CLS[g.cls].mult * g.size);
      if (k === 'lounge') { g.st = 'wait'; continue; }
      advance(s, sim, g); continue;
    }
    if (g.st === 'wait') {
      if (g.at === 'seats' && g.slot < 0) s.rating = Math.max(0.5, s.rating - 0.0005 * dt);
      if (g.at === 'seats' && g.slot >= 0 && s.st.seats.inc > 1 && Math.random() < dt / 25) earn(s, sim, g, feeOf('seats', s.st.seats) * g.size);
      // the plane is in: head for its boarding area and join the line
      if (f && f.state === 'parked') {
        const n = sim.groups.filter((o) => o.flight === f.id && (o.st === 'line')).length;
        const b = boardArea(f.gate), col = n % 6, row = Math.floor(n / 6);
        g.st = 'line'; g.slot = n; g.at = null;
        g.path = [{ x: 675, y: g.y }, { x: 675, y: b.y + b.h / 2 }, { x: b.x + b.w - 18 - col * 22, y: b.y + 24 + row * 22 }];
      }
    }
    if (g.st === 'line' && !g.path.length) {
      // shuffle forward as the line moves
      const b = f ? boardArea(f.gate) : null;
      if (b) { const col = g.slot % 6, row = Math.floor(g.slot / 6); const tx = b.x + b.w - 18 - col * 22, ty = b.y + 24 + row * 22; g.x += (tx - g.x) * Math.min(1, dt * 3); g.y += (ty - g.y) * Math.min(1, dt * 3); }
    }
  }
  sim.groups = sim.groups.filter((g) => g.st !== 'gone');
  const alive = new Set(sim.groups.map((g) => g.id));
  for (const k in sim.queues) sim.queues[k] = sim.queues[k].filter((id) => alive.has(id));
  for (const f of sim.flights) if (f.boarding != null && !alive.has(f.boarding)) f.boarding = null;
  for (const p of sim.pops) p.t += dt;
  sim.pops = sim.pops.filter((p) => p.t < 1.8);
}
/** Walk along the path; true while still walking. */
function move(g: Group, sp: number) {
  const t = g.path[0]; if (!t) return false;
  const dx = t.x - g.x, dy = t.y - g.y, d = Math.hypot(dx, dy);
  if (d <= sp) { g.x = t.x; g.y = t.y; g.path.shift(); } else { g.x += (dx / d) * sp; g.y += (dy / d) * sp; }
  return g.path.length > 0;
}

// ---------------- drawing ----------------
/** Portrait phones see the floor plan turned a quarter (entry at the top, planes at the bottom); text and people stay upright. */
let ROT = false;
function up(x: CanvasRenderingContext2D, lx: number, ly: number, draw: () => void) { x.save(); x.translate(lx, ly); if (ROT) x.rotate(-Math.PI / 2); draw(); x.restore(); }
const txt = (x: CanvasRenderingContext2D, t: string, lx: number, ly: number) => up(x, lx, ly, () => x.fillText(t, 0, 0));

function person(x: CanvasRenderingContext2D, g: { x: number; y: number }, color: string, s: number, progress: number | null) {
  up(x, g.x, g.y, () => {
    x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(0, 6 * s, 5 * s, 2 * s, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = color; x.beginPath(); x.ellipse(0, 1.5 * s, 4 * s, 5 * s, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#ffd9b3'; x.beginPath(); x.arc(0, -5 * s, 3 * s, 0, Math.PI * 2); x.fill();
    if (progress != null) {
      // processing time ring over the passenger's head
      x.lineWidth = 2.5; x.strokeStyle = 'rgba(27,16,53,.25)'; x.beginPath(); x.arc(0, -14 * s, 5, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = '#00c97a'; x.beginPath(); x.arc(0, -14 * s, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); x.stroke();
    }
  });
}

function plane(x: CanvasRenderingContext2D, f: Flight, sim: Sim, groups: Group[]) {
  const P = PLANES[f.plane], y = slotY(f.gate);
  let dx = 0, dy = 0, a = 1;
  if (f.state === 'in') { const k = Math.max(0, (f.land - sim.t) / 6); dx = k * k * 380; dy = -k * 30; a = 1 - k * 0.6; }
  if (f.state === 'out') { const t = sim.t - f.t; dx = t * t * 30 + t * 20; dy = -t * t * 4; a = Math.max(0, 1 - t / 7); }
  const x0 = planeX0 + dx, L = P.L, W = P.W, span = P.span;
  x.save(); x.globalAlpha = a; x.translate(0, y + dy);
  // shadow, wings, tail, fuselage
  x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(x0 + L / 2 + 8, 10, L / 2, span / 2.4, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#dfe6ec'; x.strokeStyle = '#7d8a96'; x.lineWidth = 1.5;
  const wx = x0 + L * 0.38;
  x.beginPath(); x.moveTo(wx, -W / 2); x.lineTo(wx + L * 0.22, -span / 2); x.lineTo(wx + L * 0.3, -span / 2); x.lineTo(wx + L * 0.2, -W / 2); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(wx, W / 2); x.lineTo(wx + L * 0.22, span / 2); x.lineTo(wx + L * 0.3, span / 2); x.lineTo(wx + L * 0.2, W / 2); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = P.tail;
  x.beginPath(); x.moveTo(x0 + L - 40, -W / 2); x.lineTo(x0 + L - 8, -W * 1.4); x.lineTo(x0 + L + 2, -W * 1.4); x.lineTo(x0 + L - 6, 0); x.lineTo(x0 + L + 2, W * 1.4); x.lineTo(x0 + L - 8, W * 1.4); x.lineTo(x0 + L - 40, W / 2); x.closePath(); x.fill();
  x.fillStyle = '#f7f9fc'; x.beginPath();
  x.moveTo(x0, 0); x.quadraticCurveTo(x0, -W / 2, x0 + 30, -W / 2); x.lineTo(x0 + L - 20, -W / 2); x.quadraticCurveTo(x0 + L + 6, -W / 4, x0 + L + 6, 0); x.quadraticCurveTo(x0 + L + 6, W / 4, x0 + L - 20, W / 2); x.lineTo(x0 + 30, W / 2); x.quadraticCurveTo(x0, W / 2, x0, 0);
  x.fill(); x.stroke();
  x.fillStyle = '#1b3a6b'; x.beginPath(); x.ellipse(x0 + 10, 0, 5, W * 0.3, 0, 0, Math.PI * 2); x.fill(); // cockpit
  // cabin: seats in class colours, filled as passengers sit down
  for (let i = 0; i < f.groups; i++) {
    const p = cabinSeat(f.plane, f.groups, i);
    x.fillStyle = 'rgba(27,16,53,.15)'; x.fillRect(p.x + dx - 5, p.y - 4, 10, 8);
  }
  x.restore();
  // seated and boarding passengers move with the plane
  for (const g of groups) if (g.flight === f.id && (g.st === 'seated' || g.st === 'boarding')) person(x, { x: g.x + dx, y: g.y + dy }, g.color, 0.85, g.st === 'boarding' && g.t > 0 ? 1 - g.t / g.tt : null);
  x.globalAlpha = 1;
  // label: capacity filling up
  if (f.state === 'parked' || f.state === 'in' || f.state === 'due') {
    const pax = Math.round(f.seated * (f.total / f.groups)), cap = P.seats[0] + P.seats[1] + P.seats[2];
    up(x, ROT ? planeX0 + 150 : planeX0 + 60, ROT ? y + 70 : y - P.span / 2 - 2, () => {
      x.fillStyle = 'rgba(10,20,30,.8)'; x.beginPath(); x.roundRect?.(0, -18, 150, 32, 8); x.fill();
      x.fillStyle = '#fff'; x.font = '800 11px system-ui'; x.textAlign = 'left';
      x.fillText(`${f.code} · ${P.name}`, 6, -5);
      x.fillStyle = f.state === 'parked' ? '#5dffb4' : '#ffd23f';
      x.fillText(f.state === 'parked' ? `💺 ${pax}/${cap} · ⏱ ${Math.max(0, Math.ceil(f.leaveBy - sim.t))}s` : `🛬 lands in ${Math.max(0, Math.ceil(f.land - sim.t))}s · ${f.total} pax`, 6, 9);
    });
  }
}

function render(x: CanvasRenderingContext2D, s: Save, sim: Sim, view: View, sel: SKey | null) {
  const { w, h, k, ox, oy } = view, dpr = Math.min(2, devicePixelRatio || 1);
  ROT = view.rot;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w * dpr, h * dpr);
  x.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
  if (ROT) { x.translate(LH, 0); x.rotate(Math.PI / 2); }
  // apron and terminal floor
  x.fillStyle = '#8a959f'; x.fillRect(870, 0, LW - 870, LH);
  for (let i = 0; i < 4; i++) { x.strokeStyle = i < s.st.gate.n ? '#ffd23f' : 'rgba(255,255,255,.25)'; x.lineWidth = 2; x.setLineDash([14, 10]); x.beginPath(); x.moveTo(890, slotY(i)); x.lineTo(LW - 10, slotY(i)); x.stroke(); x.setLineDash([]); }
  x.fillStyle = '#eef2f6'; x.fillRect(0, 10, 870, LH - 20);
  x.fillStyle = 'rgba(0,0,0,.03)'; for (let i = 0; i < 870; i += 40) for (let j = 10; j < LH - 10; j += 40) if (((i + j) / 40) % 2 === 0) x.fillRect(i, j, 40, 40);
  x.strokeStyle = '#c7d0d8'; x.lineWidth = 3; x.strokeRect(0, 10, 870, LH - 20);
  x.fillStyle = '#6ec6ff'; x.fillRect(-4, 260, 12, 100);
  x.fillStyle = '#1b1035'; x.font = '900 13px system-ui'; x.textAlign = 'center'; txt(x, '🚪 ENTRY', 48, 250);
  // areas
  for (const key of AREAS) {
    const a = AREA[key as Exclude<SKey, 'walk'>], l = s.st[key], built = l.n > 0, locked = s.served < S[key].unlock;
    if (key === 'gate') continue;
    x.fillStyle = sel === key ? 'rgba(255,210,63,.3)' : built ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.3)';
    x.strokeStyle = sel === key ? '#ffb400' : built ? '#b9c4ce' : '#9aa7b3'; x.lineWidth = sel === key ? 3 : 1.5;
    if (!built) x.setLineDash([6, 5]);
    x.beginPath(); x.roundRect?.(a.x, a.y, a.w, a.h, 12); x.fill(); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#1b1035'; x.font = '900 13px system-ui'; x.textAlign = 'center';
    txt(x, `${S[key].icon} ${S[key].name}`, ROT ? a.x + 16 : a.x + a.w / 2, ROT ? a.y + a.h / 2 : a.y + 18);
    x.font = '800 11px system-ui';
    if (built) { x.fillStyle = '#5b6b7a'; txt(x, `×${l.n} · ⚡${l.spd}${S[key].svc ? ` (${svcTime(key, l).toFixed(1)}s)` : ''} · 💰${l.inc}`, ROT ? a.x + a.w - 8 : a.x + a.w / 2, ROT ? a.y + a.h / 2 : a.y + a.h - 7); }
    else { x.fillStyle = locked ? '#7d8a96' : '#00a35c'; txt(x, locked ? `🔒 ${S[key].unlock.toLocaleString('en-IN')} pax` : `+ Build ${short(costAdd(key, l))}`, a.x + a.w / 2, a.y + a.h / 2 + 4); }
  }
  // counters and scanners with their service time bars
  for (const key of ['checkin', 'security'] as const) {
    const l = s.st[key];
    for (let i = 0; i < l.n; i++) {
      const p = counter(key, i, l.n), gid = sim.busy[key]?.[i], g = gid != null ? sim.groups.find((o) => o.id === gid) : null;
      if (key === 'checkin') { x.fillStyle = '#2b7bff'; x.fillRect(p.x, p.y - 14, 26, 28); x.fillStyle = '#fff'; x.fillRect(p.x + 3, p.y - 10, 20, 6); }
      else { x.strokeStyle = '#5b6b7a'; x.lineWidth = 4; x.strokeRect(p.x - 2, p.y - 16, 22, 32); x.fillStyle = g ? 'rgba(0,201,122,.5)' : 'rgba(255,45,85,.2)'; x.fillRect(p.x, p.y - 14, 18, 28); x.fillStyle = '#3a4a5a'; x.fillRect(p.x + 22, p.y - 5, 26, 10); }
      person(x, { x: p.x + (key === 'checkin' ? 38 : 56), y: p.y }, key === 'checkin' ? '#ff8c42' : '#1b3a6b', 1, null);
    }
  }
  for (let i = 0; i < capOf('seats', s.st.seats); i++) { const p = seatAt('seats', i); x.fillStyle = s.st.seats.spd > 2 ? '#7a5cff' : '#9aa7b3'; x.beginPath(); x.roundRect?.(p.x - 9, p.y - 1, 18, 11, 3); x.fill(); }
  for (const key of ['food', 'shop', 'lounge'] as const) {
    const l = s.st[key]; if (!l.n) continue;
    for (let i = 0; i < capOf(key, l); i++) { const p = seatAt(key, i); x.fillStyle = key === 'food' ? '#ff8c42' : key === 'shop' ? '#ff4fd8' : '#b388ff'; x.beginPath(); x.arc(p.x, p.y + 6, 8, 0, Math.PI * 2); x.fill(); }
  }
  // gates: a boarding area, a desk and a jet bridge for each; locked slots show the price of the next gate
  for (let i = 0; i < 4; i++) {
    const b = boardArea(i), open = i < s.st.gate.n, y = slotY(i);
    x.fillStyle = sel === 'gate' ? 'rgba(255,210,63,.3)' : open ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.3)';
    x.strokeStyle = sel === 'gate' ? '#ffb400' : open ? '#b9c4ce' : '#9aa7b3'; x.lineWidth = sel === 'gate' ? 3 : 1.5; if (!open) x.setLineDash([6, 5]);
    x.beginPath(); x.roundRect?.(b.x, b.y, b.w, b.h, 10); x.fill(); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#1b1035'; x.font = '900 12px system-ui'; x.textAlign = 'center';
    if (open) {
      txt(x, `🛫 Gate ${i + 1} · boarding`, ROT ? b.x + 14 : b.x + b.w / 2, ROT ? b.y + b.h / 2 : b.y + 14);
      x.fillStyle = '#2b7bff'; x.fillRect(838, y - 34, 14, 24); // gate desk
      x.fillStyle = '#9aa7b3'; x.fillRect(852, y - 27, NOSE + 26 - 852, 10); // jet bridge
      if (i === 0) { x.fillStyle = '#5b6b7a'; x.font = '800 11px system-ui'; txt(x, `⚡${s.st.gate.spd} (${svcTime('gate', s.st.gate).toFixed(1)}s) · 💰${s.st.gate.inc}`, ROT ? b.x + b.w - 8 : b.x + b.w / 2, ROT ? b.y + b.h / 2 : b.y + b.h - 6); }
    } else if (i === s.st.gate.n) { x.fillStyle = '#00a35c'; txt(x, `+ Gate ${i + 1} · ${short(costAdd('gate', s.st.gate))}`, b.x + b.w / 2, b.y + b.h / 2); }
  }
  for (const f of sim.flights) plane(x, f, sim, sim.groups);
  // passengers in the terminal (with a ring while being served)
  for (const g of sim.groups) {
    if (g.st === 'seated' || g.st === 'boarding') continue;
    person(x, g, g.color, g.cls ? 1.15 : 1, g.st === 'svc' && g.tt > 0 ? Math.min(1, 1 - g.t / g.tt) : null);
  }
  for (const q of sim.pops) {
    x.globalAlpha = 1 - q.t / 1.8; x.font = `900 ${q.big ? 16 : 12}px system-ui`; x.textAlign = 'center';
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 3;
    up(x, q.x, q.y - q.t * 30, () => { x.strokeText(q.text, 0, 0); x.fillStyle = q.text.startsWith('+') ? '#00a35c' : q.text.startsWith('😡') ? '#e5304f' : '#2b7bff'; x.fillText(q.text, 0, 0); });
    x.globalAlpha = 1;
  }
}

// ---------------- app ----------------
interface View { w: number; h: number; k: number; ox: number; oy: number; rot: boolean }
export default function HawaiAdda() {
  const [s, setS] = useState<Save>(load);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sel, setSel] = useState<SKey | null>(null);
  const [away, setAway] = useState('');
  const [muted, setMute] = useState(isMuted());
  const [, force] = useState(0);
  const ref = useRef(s); ref.current = s;
  const sim = useRef<Sim>(newSim()), cv = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ w: 300, h: 300, k: 0.3, ox: 0, oy: 0, rot: false }), selRef = useRef(sel); selRef.current = sel;
  const speedRef = useRef(speed); speedRef.current = speed;

  // earnings while away: half your recent income rate, up to two hours
  useEffect(() => {
    const st = ref.current, mins = Math.min(120, (Date.now() - st.seen) / 60000);
    if (st.perMin > 0 && mins > 2) { const gain = Math.round(st.perMin * mins * 0.5); const n = { ...st, cash: st.cash + gain, earned: st.earned + gain }; setS(n); store(n); setAway(`While you were away your airport earned ${fmt(gain)} ✈️`); }
  }, []);

  useEffect(() => {
    if (!started) return;
    const el = box.current!, c = cv.current!, x = c.getContext('2d')!;
    const fit = () => {
      const r = el.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      c.width = r.width * dpr; c.height = r.height * dpr; c.style.width = `${r.width}px`; c.style.height = `${r.height}px`;
      const rot = r.height > r.width * 1.1, cw = rot ? LH : LW, ch = rot ? LW : LH;
      const k = Math.min(r.width / (cw + 10), r.height / (ch + 10));
      view.current = { w: r.width, h: r.height, k, ox: (r.width - cw * k) / 2, oy: (r.height - ch * k) / 2, rot };
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    let raf = 0, last = performance.now(), uiT = 0, saveT = 0, minT = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const st = ref.current;
      for (let i = 0; i < speedRef.current; i++) stepSim(st, sim.current, dt);
      render(x, st, sim.current, view.current, selRef.current);
      uiT += dt; saveT += dt; minT += dt;
      if (uiT > 0.25) { uiT = 0; force((n) => n + 1); }
      if (minT > 30) { minT = 0; st.perMin = sim.current.income.reduce((a, b) => a + b, 0) * 2; sim.current.income = []; }
      if (saveT > 5) { saveT = 0; store(st); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) (window as unknown as { __ha?: unknown }).__ha = { s: ref, sim };
    return () => { cancelAnimationFrame(raf); ro.disconnect(); store(ref.current); };
  }, [started]);

  const tap = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect(), v = view.current;
    const sx = (e.clientX - r.left - v.ox) / v.k, sy = (e.clientY - r.top - v.oy) / v.k;
    const lx = v.rot ? sy : sx, ly = v.rot ? LH - sx : sy;
    const inside = (a: { x: number; y: number; w: number; h: number }) => lx >= a.x && lx <= a.x + a.w && ly >= a.y && ly <= a.y + a.h;
    const hit = lx > 680 ? 'gate' : AREAS.find((k) => k !== 'gate' && inside(AREA[k as Exclude<SKey, 'walk'>]));
    setSel((hit as SKey) ?? null); if (hit) sfx.tap();
  };
  const buy = (k: SKey, what: 'add' | 'spd' | 'inc') => {
    const st = ref.current, l = st.st[k];
    const cost = what === 'add' ? costAdd(k, l) : what === 'spd' ? costSpd(k, l) : costInc(k, l);
    if (st.cash < cost || (what === 'add' && l.n >= S[k].maxN) || (what !== 'add' && (l.n === 0 || l[what] >= 10)) || st.served < S[k].unlock) { sfx.captured(); return; }
    st.cash -= cost;
    if (what === 'add') { l.n++; if (k === 'gate') sim.current.gateNext[l.n - 1] = sim.current.t; } else l[what]++;
    store(st); setS({ ...st }); sfx.win();
  };
  const leave = () => {
    store(ref.current);
    if (ref.current.flights > 0) { const p0 = recordGame(loadProfile(), 0, 1, 0).profile; saveProfile(recordProgress(p0, 'hawaiadda', 0, 1, { ha_pax: ref.current.served }).profile); }
    location.href = import.meta.env.BASE_URL;
  };
  const reset = () => { if (!confirm('Start a brand-new airport? Your current one will be gone.')) return; const n = fresh(); ref.current = n; setS(n); store(n); sim.current = newSim(); };

  if (!started) return (
    <div className="screen home ha-home">
      <Backdrop />
      <div className="topbar"><a className="btn ghost sm" href={import.meta.env.BASE_URL}>← All games</a></div>
      <header className="rr-hero">
        <div className="rr-logo ha">🛫</div>
        <small>SOLO · AIRPORT TYCOON</small>
        <h1>Hawai <em className="ha">Adda</em></h1>
        <p>Run the busiest airport in India, one passenger at a time.</p>
      </header>
      {away && <div className="banner ok">{away}</div>}
      <section className="card rr-how">
        <div><span>🚶</span><p>Passengers check in, clear security and wait in the hall until their plane lands. Then they line up at the gate and board one by one.</p></div>
        <div><span>👆</span><p><b>Tap any area</b> to add counters, make it faster, or earn more per passenger. <b>🚶 Walkways</b> make everyone walk faster.</p></div>
        <div><span>💺</span><p>Business and first class pay 3× and 6×. Build a <b>Lounge</b> for them.</p></div>
        <div><span>✈️</span><p>Planes come and go every 30–60 s at each gate. Open more gates for more planes; bigger jets unlock as you grow.</p></div>
      </section>
      <section className="card ha-save"><b>{levelName(s.served)}</b><small>{fmt(s.cash)} · ⭐{s.rating.toFixed(1)} · {s.served.toLocaleString('en-IN')} passengers flown</small></section>
      <section className="actions">
        <button className="btn primary big" onClick={() => { sfx.turn(); setStarted(true); }}><span className="ic">▶</span> {s.flights ? 'Open the airport' : 'Open for business'}</button>
        {s.flights > 0 && <button className="btn ghost" onClick={reset}>New airport</button>}
      </section>
    </div>
  );

  const st = ref.current, nextPlane = PLANES.find((p) => st.served < p.unlock);
  const l = sel ? st.st[sel] : null;
  const opts: ('add' | 'spd' | 'inc')[] = sel === 'walk' ? ['spd'] : ['add', 'spd', 'inc'];
  return (
    <div className="screen ha2">
      <div className="ha2-hud">
        <button className="btn ghost sm" onClick={leave}>✕</button>
        <b className="cash">{fmt(st.cash)}</b>
        <span className="rate">⭐{st.rating.toFixed(1)}</span>
        <span className="pax">🚶{st.served.toLocaleString('en-IN')}</span>
        <div className="seg ha-speed">{[1, 2, 4].map((v) => <button key={v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>{v}×</button>)}</div>
        <button className="btn ghost sm" onClick={() => { setMuted(!muted); setMute(!muted); }}>{muted ? '🔇' : '🔊'}</button>
      </div>
      <div className="ha2-sub">
        <button className={`walk ${sel === 'walk' ? 'on' : ''}`} onClick={() => { sfx.tap(); setSel(sel === 'walk' ? null : 'walk'); }}>🚶 Walk Lv{st.st.walk.spd}</button>
        <span>{levelName(st.served)}</span>
        {nextPlane && <span className="next">Next: {nextPlane.name} at {nextPlane.unlock.toLocaleString('en-IN')} pax</span>}
        {festivalOn() && <span className="fest">{festivalOn()!.emoji} {festivalOn()!.name} rush</span>}
      </div>
      <div className="ha2-stage" ref={box}>
        <canvas ref={cv} onPointerDown={tap} />
        {!sel && <div className="ha2-hint">👆 Tap Check-in, Security, the Hall, Gates… to upgrade</div>}
      </div>
      {sel && l && (
        <div className="ha2-panel">
          <div className="row-between"><b>{S[sel].icon} {S[sel].name}</b><button className="btn ghost xs" onClick={() => setSel(null)}>✕</button></div>
          <small className="dim">{S[sel].text}</small>
          {st.served < S[sel].unlock ? <div className="ha2-lock">🔒 Unlocks at {S[sel].unlock.toLocaleString('en-IN')} passengers flown</div> : (
            <div className="ha2-opts" style={{ gridTemplateColumns: `repeat(${opts.length}, 1fr)` }}>
              {opts.map((w) => {
                const cost = w === 'add' ? costAdd(sel, l) : w === 'spd' ? costSpd(sel, l) : costInc(sel, l);
                const maxed = w === 'add' ? l.n >= S[sel].maxN : l[w] >= 10;
                const off = maxed || (w !== 'add' && l.n === 0) || st.cash < cost;
                const label = w === 'add' ? (l.n === 0 ? `Build ${S[sel].name}` : S[sel].add) : w === 'spd' ? S[sel].spd : S[sel].inc;
                const now = w === 'add' ? `${l.n}/${S[sel].maxN}` : `Lv ${l[w]}/10`;
                const effect = sel === 'walk' ? `${Math.round(walkSpeed(st))} → ${Math.round(34 * (1 + 0.28 * l.spd))} steps/s`
                  : w === 'add' ? (sel === 'gate' ? 'a new stand + boarding area' : `${capOf(sel, l)} → ${capOf(sel, { ...l, n: l.n + 1 })} ${sel === 'seats' || sel === 'lounge' ? 'seats' : 'at once'}`)
                  : w === 'spd' ? (sel === 'seats' ? 'better rating' : `${svcTime(sel, l).toFixed(1)}s → ${svcTime(sel, { ...l, spd: l.spd + 1 }).toFixed(1)}s each`)
                  : `${fmt(feeOf(sel, l))} → ${fmt(feeOf(sel, { ...l, inc: l.inc + 1 }))} /pax`;
                return (
                  <button key={w} className={`ha2-opt ${w}`} disabled={off} onClick={() => buy(sel, w)}>
                    <span className="ic">{w === 'add' ? '➕' : w === 'spd' ? '⚡' : '💰'}</span>
                    <b>{label}</b><small>{now} · {effect}</small>
                    <em>{maxed ? 'MAX' : fmt(cost)}</em>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
