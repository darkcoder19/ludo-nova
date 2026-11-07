// Runway Raja: a single-player air traffic control game. Tap a plane, then tap a command (or a runway):
// arrivals circle at holding fixes until you clear them to land, departures wait at the gates for take-off.
// Easy / Medium / Hard set how busy the sky gets. Top-down airport drawn on a canvas.
import { useEffect, useRef, useState } from 'react';
import { Backdrop } from '../components/Home';
import { loadProfile, recordGame, saveProfile } from '../game/profile';
import { recordProgress } from '../game/progress';
import { buzz, isMuted, setMuted, sfx } from '../game/sound';
import { onRadioCaption, radio, radioReset, setRadio, type Line } from './radio';
import './atc.css';

type Kind = 'prop' | 'jet' | 'heavy' | 'heli';
type St = 'inbound' | 'hold' | 'approach' | 'roll' | 'lineup' | 'depart' | 'climb' | 'gone';
type Diff = 'easy' | 'medium' | 'hard';
interface Pt { x: number; y: number }
interface Plane {
  id: number; kind: Kind; code: string; x: number; y: number; hdg: number; speed: number; st: St; route: Pt[]; rwy: number | null;
  hold: Pt | null; orbit: number; lane: number; cleared?: number; fuel: number; fuelMax: number; called: boolean; mayday: boolean; alt: number; tail: string; fix: number;
}
interface Runway { id: number; a: Pt; b: Pt; heavy: boolean; names: [string, string] }
interface Gate { at: Pt; plane: { kind: Kind; code: string; wait: number; tail: string } | null }
interface Storm { x: number; y: number; r: number; vx: number; vy: number; life: number }
interface Pop { x: number; y: number; text: string; t: number; good: boolean }
interface World {
  w: number; h: number; u: number; t: number; diff: Diff; planes: Plane[]; runways: Runway[]; pad: Pt; gates: Gate[]; fixes: (Pt & { name: string })[];
  storms: Storm[]; pops: Pop[]; wind: 1 | -1; nextWind: number; spawnIn: number; departIn: number; lives: number; handled: number; score: number;
  over: boolean; won: boolean; crash: Pt | null; seq: number; streak: number; lastHandled: number;
}

export const DIFFS: Record<Diff, { name: string; emoji: string; text: string; goal: number; spawn: [number, number]; max: number; speed: number; wind: number; storms: boolean; depart: number; wait: number; fuel: number; heavy: number; spacing: boolean }> = {
  easy: { name: 'Easy', emoji: '🟢', text: 'Light traffic, steady wind, planes keep their distance on final', goal: 12, spawn: [15, 10], max: 4, speed: 0.8, wind: 0, storms: false, depart: 36, wait: 100, fuel: 180, heavy: 0.1, spacing: true },
  medium: { name: 'Medium', emoji: '🟡', text: 'Busier sky, the wind shifts, monsoon storms roll in', goal: 18, spawn: [11, 6.5], max: 6, speed: 1, wind: 100, storms: true, depart: 30, wait: 110, fuel: 140, heavy: 0.18, spacing: false },
  hard: { name: 'Hard', emoji: '🔴', text: 'Rush hour: lots of heavies, quick wind shifts, little fuel', goal: 25, spawn: [8, 4.5], max: 9, speed: 1.15, wind: 70, storms: true, depart: 22, wait: 85, fuel: 110, heavy: 0.26, spacing: false },
};
const KINDS: Record<Kind, { speed: number; label: string; pts: number; size: number }> = {
  prop: { speed: 3.6, label: 'Prop', pts: 10, size: 1.9 }, jet: { speed: 5.4, label: 'Jet', pts: 10, size: 2.4 },
  heavy: { speed: 6, label: 'Heavy', pts: 15, size: 3 }, heli: { speed: 3, label: 'Heli', pts: 10, size: 1.8 },
};
const AIRLINES: [string, string][] = [['UD', '#2b7bff'], ['MW', '#c9302c'], ['CJ', '#ff8c42'], ['MX', '#12a88f'], ['DK', '#7a5cff'], ['SR', '#00a35c'], ['HH', '#d9a400'], ['GO', '#e04fb5']];
const bestKey = (d: Diff) => `runwayraja-best-${d}`;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// ---------------- airport ----------------
function layout(w: number, h: number) {
  const u = Math.min(w / 82, h / 100), cx = w / 2, cy = h / 2; // phones: the airport fills the width
  const runways: Runway[] = [
    { id: 0, a: { x: cx - 20 * u, y: cy + 16 * u }, b: { x: cx + 32 * u, y: cy + 16 * u }, heavy: true, names: ['09', '27'] },
    { id: 1, a: { x: cx - 33 * u, y: cy + 6 * u }, b: { x: cx - 33 * u, y: cy - 24 * u }, heavy: false, names: ['36', '18'] },
  ];
  const ex = Math.min(w / 2 - 7 * u, 40 * u), ey = Math.min(h / 2 - 7 * u, 44 * u);
  const fixes = [{ name: 'ALFA', x: cx - ex, y: cy - ey }, { name: 'BRAVO', x: cx + ex, y: cy - ey }, { name: 'CHARLIE', x: cx + ex, y: cy + ey }, { name: 'DELTA', x: cx - ex, y: cy + ey }];
  return { u, runways, fixes, pad: { x: cx + 26 * u, y: cy - 16 * u }, gates: [0, 1, 2].map((k) => ({ at: { x: cx - 10 * u + k * 10 * u, y: cy + 1 * u }, plane: null })) as Gate[] };
}
export function newWorld(w: number, h: number, diff: Diff): World {
  const l = layout(w, h);
  return { w, h, u: l.u, t: 0, diff, planes: [], runways: l.runways, pad: l.pad, gates: l.gates, fixes: l.fixes, storms: [], pops: [], wind: 1, nextWind: DIFFS[diff].wind || 1e9,
    spawnIn: 1.5, departIn: 14, lives: 3, handled: 0, score: 0, over: false, won: false, crash: null, seq: 1, streak: 0, lastHandled: -99 };
}
/** The landing end in use (into the wind), the far end, roll direction and the runway number pilots say. */
export function active(W: World, r: Runway) {
  const from = W.wind === 1 ? r.a : r.b, to = W.wind === 1 ? r.b : r.a, len = dist(from, to);
  return { from, to, len, d: { x: (to.x - from.x) / len, y: (to.y - from.y) / len }, name: r.names[W.wind === 1 ? 0 : 1] };
}
const fits = (k: Kind, r: Runway) => k !== 'heli' && (k !== 'heavy' || r.heavy);
const onRunway = (W: World, r: Runway, except?: Plane) => W.planes.filter((p) => p !== except && p.rwy === r.id && (p.st === 'roll' || p.st === 'depart' || p.st === 'lineup'));
const airborne = (p: Plane) => p.st === 'inbound' || p.st === 'hold' || p.st === 'approach' || p.st === 'climb';
const pop = (W: World, at: Pt, text: string, good: boolean) => W.pops.push({ x: at.x, y: at.y, text, t: 0, good });
const newCode = () => { const a = AIRLINES[Math.floor(Math.random() * AIRLINES.length)]; return { code: `${a[0]}${1000 + Math.floor(Math.random() * 9000)}`, tail: a[1] }; };

function spawn(W: World) {
  const D = DIFFS[W.diff], r = Math.random();
  const kind: Kind = r < 0.1 ? 'heli' : r < 0.1 + D.heavy ? 'heavy' : r < 0.5 ? 'prop' : 'jet';
  const fix = Math.floor(Math.random() * W.fixes.length), f = W.fixes[fix];
  // enter from the screen edge nearest the holding fix
  const ex = f.x < W.w / 2 ? -3 * W.u : W.w + 3 * W.u, ey = f.y + (Math.random() - 0.5) * 20 * W.u;
  const { code, tail } = newCode();
  const fuel = D.fuel * (0.8 + Math.random() * 0.4);
  W.planes.push({ id: W.seq++, kind, code, tail, x: ex, y: ey, hdg: Math.atan2(f.y - ey, f.x - ex), speed: KINDS[kind].speed * D.speed * W.u, st: 'inbound',
    route: [f], rwy: null, hold: null, orbit: 0, lane: -1, fuel, fuelMax: fuel, called: false, mayday: false, alt: 1, fix });
}

function loseLife(W: World, at: Pt, why: string) {
  W.lives--; W.streak = 0; pop(W, at, why, false); sfx.captured(); buzz(120);
  if (W.lives <= 0) W.over = true;
}

// ---------------- commands ----------------
export function cmdLand(W: World, p: Plane, r: Runway | null): string | null {
  if (!airborne(p) || p.st === 'climb') return null;
  if (p.kind === 'heli') {
    if (r) return 'Helicopters land on the H pad';
    p.route = [W.pad]; p.st = 'approach'; p.rwy = null; p.hold = null; radio.land(p.code, null); return null;
  }
  if (!r) return 'Pick a runway for this plane';
  if (!fits(p.kind, r)) return 'Heavies need the long runway (09/27)';
  const A = active(W, r), u = W.u, n = { x: -A.d.y, y: A.d.x };
  const faf = { x: A.from.x - A.d.x * 18 * u, y: A.from.y - A.d.y * 18 * u };
  const along = (p.x - A.from.x) * A.d.x + (p.y - A.from.y) * A.d.y, side = Math.sign((p.x - A.from.x) * n.x + (p.y - A.from.y) * n.y) || 1;
  const route: Pt[] = [];
  // coming from the wrong side: fly a downwind leg and a base turn before the final approach
  if (along > -12 * u) {
    if (along > 0) route.push({ x: A.from.x + n.x * side * 16 * u + A.d.x * Math.min(along, A.len), y: A.from.y + n.y * side * 16 * u + A.d.y * Math.min(along, A.len) });
    route.push({ x: faf.x + n.x * side * 14 * u, y: faf.y + n.y * side * 14 * u });
  }
  route.push(faf, A.from);
  p.route = route; p.st = 'approach'; p.rwy = r.id; p.lane = r.id; p.hold = null; p.cleared = W.t;
  radio.land(p.code, A.name);
  return null;
}
export function cmdHold(W: World, p: Plane) {
  if (!airborne(p) || p.st === 'climb') return;
  p.st = 'hold'; p.route = []; p.rwy = null; p.hold = { x: p.x, y: p.y }; p.orbit = p.hdg - Math.PI / 2;
  radio.hold(p.code);
}
function goAround(W: World, p: Plane, why: string) {
  const f = W.fixes.reduce((b, x) => (dist(x, p) < dist(b, p) ? x : b), W.fixes[0]);
  p.st = 'inbound'; p.rwy = null; p.route = [f]; p.hold = null;
  radio.goAround(p.code, why);
}
export function cmdTakeoff(W: World, gi: number, r: Runway): string | null {
  const g = W.gates[gi];
  if (!g.plane) return null;
  if (!fits(g.plane.kind, r)) return 'Heavies need the long runway (09/27)';
  if (onRunway(W, r).some((p) => p.st === 'lineup')) return 'Someone is already lined up there';
  const A = active(W, r), D = DIFFS[W.diff];
  W.planes.push({ id: W.seq++, kind: g.plane.kind, code: g.plane.code, tail: g.plane.tail, x: A.from.x, y: A.from.y, hdg: Math.atan2(A.d.y, A.d.x), speed: 0, st: 'lineup',
    route: [], rwy: r.id, hold: null, orbit: 0, lane: r.id, fuel: 999, fuelMax: 999, called: true, mayday: false, alt: 0, fix: -1 });
  void D;
  g.plane = null;
  const busy = onRunway(W, r).length > 1 || W.planes.some((p) => p.st === 'approach' && p.rwy === r.id && dist(p, A.from) < 16 * W.u);
  if (busy) radio.lineUp(W.planes[W.planes.length - 1].code, A.name); else radio.takeoff(W.planes[W.planes.length - 1].code, A.name);
  sfx.roll();
  return null;
}

// ---------------- simulation ----------------
/** The nearest plane cleared to the same runway earlier than this one. */
function o0(W: World, p: Plane): Pt {
  const left = (q: Plane) => q.route.reduce((t, pt, i) => t + dist(i ? q.route[i - 1] : q, pt), 0);
  const mine = left(p), ahead = W.planes.filter((o) => o !== p && ((o.st === 'approach' && o.rwy === p.rwy && left(o) < mine) || (o.st === 'roll' && o.rwy === p.rwy)));
  return ahead.reduce<Pt>((b, o) => (dist(o, p) < dist(b, p) ? o : b), { x: 1e9, y: 1e9 });
}
function steer(p: Plane, t: Pt, dt: number, turn: number) {
  const want = Math.atan2(t.y - p.y, t.x - p.x), d = angDiff(p.hdg, want);
  p.hdg += Math.max(-turn * dt, Math.min(turn * dt, d));
}
function handled(W: World, at: Pt, pts: number, what: string) {
  W.streak = W.t - W.lastHandled < 12 ? W.streak + 1 : 1; W.lastHandled = W.t;
  const bonus = W.streak >= 3 ? 5 : 0;
  W.handled++; W.score += pts + bonus;
  pop(W, at, `${what} +${pts + bonus}${bonus ? ' 🔥' : ''}`, true);
  sfx.home();
  if (W.handled >= DIFFS[W.diff].goal) { W.over = true; W.won = true; }
}

export function step(W: World, dt: number) {
  if (W.over) return;
  const D = DIFFS[W.diff], u = W.u;
  W.t += dt;
  // wind shifts flip which end every runway lands from
  W.nextWind -= dt;
  if (W.nextWind <= 0) {
    W.wind = W.wind === 1 ? -1 : 1; W.nextWind = D.wind;
    pop(W, { x: W.w / 2, y: W.h * 0.18 }, '🌬️ Wind change! Runways flipped', true); sfx.turn();
    radio.wind(W.runways.map((r) => active(W, r).name).join(' and '));
  }
  W.spawnIn -= dt;
  const flying = W.planes.filter((p) => p.st !== 'depart' && p.st !== 'climb' && p.st !== 'lineup').length;
  if (W.spawnIn <= 0 && flying < D.max) { spawn(W); const k = Math.min(1, W.t / 240); W.spawnIn = (D.spawn[0] + (D.spawn[1] - D.spawn[0]) * k) * (0.8 + Math.random() * 0.4); }
  W.departIn -= dt;
  if (W.departIn <= 0) {
    const free = W.gates.filter((g) => !g.plane);
    if (free.length) {
      const g = free[Math.floor(Math.random() * free.length)], r = Math.random(), { code, tail } = newCode();
      g.plane = { kind: r < 0.4 ? 'prop' : r < 0.85 ? 'jet' : 'heavy', code, tail, wait: 0 };
      radio.ready(code, W.gates.indexOf(g) + 1); sfx.pop();
    }
    W.departIn = D.depart * (0.8 + Math.random() * 0.4);
  }
  for (const g of W.gates) if (g.plane) { g.plane.wait += dt; if (g.plane.wait > D.wait) { g.plane = null; loseLife(W, g.at, '😡 Departure cancelled'); } }
  if (D.storms && W.t > 60 && W.storms.length < (W.diff === 'hard' ? 2 : 1) && Math.random() < dt / 30) {
    const left = Math.random() < 0.5;
    W.storms.push({ x: left ? -12 * u : W.w + 12 * u, y: W.h * (0.2 + Math.random() * 0.6), r: (9 + Math.random() * 5) * u, vx: (left ? 1 : -1) * (1 + Math.random()) * u, vy: (Math.random() - 0.5) * u, life: 70 });
  }
  for (const s of W.storms) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; }
  W.storms = W.storms.filter((s) => s.life > 0);

  for (const p of W.planes) {
    const slow = W.storms.some((s) => dist(s, p) < s.r) && airborne(p) ? 0.6 : 1;
    if (p.st !== 'depart' && p.st !== 'climb' && p.st !== 'lineup' && p.st !== 'roll') {
      p.fuel -= dt;
      if (!p.mayday && p.fuel < p.fuelMax * 0.25) { p.mayday = true; radio.mayday(p.code); }
      if (p.fuel <= 0) { p.st = 'gone'; loseLife(W, p, '⛽ Diverted, out of fuel'); continue; }
    }
    const turn = p.kind === 'heli' ? 3.5 : 2.2;
    switch (p.st) {
      case 'inbound': {
        const t = p.route[0];
        steer(p, t, dt, turn);
        if (dist(p, t) < 4 * u) { p.st = 'hold'; p.hold = { x: t.x, y: t.y }; p.orbit = Math.atan2(p.y - t.y, p.x - t.x); if (!p.called) { p.called = true; radio.inbound(p.code, W.fixes[p.fix]?.name ?? 'the fix', p.kind === 'heli'); } }
        break;
      }
      case 'hold': {
        const c = p.hold!, R = 5 * u;
        p.orbit += (p.speed * slow / R) * dt;
        steer(p, { x: c.x + Math.cos(p.orbit + 0.7) * R, y: c.y + Math.sin(p.orbit + 0.7) * R }, dt, turn * 1.5);
        break;
      }
      case 'approach': {
        const t = p.route[0];
        steer(p, t, dt, turn);
        let sp = p.speed * slow;
        const r = p.rwy != null ? W.runways[p.rwy] : null;
        if (r) {
          const A = active(W, r);
          // Easy: planes on the same final keep their distance
          // pilots keep their distance behind the plane ahead on the same final (wider gaps on Easy)
          // pilots keep their distance from anyone cleared to the same runway before them (wider gaps on Easy)
          // whoever has further to fly gives way to the plane ahead on the same runway (wider gaps on Easy)
          const lead = o0(W, p);
          if (dist(lead, p) < (D.spacing ? 20 : 17) * u) sp = Math.min(sp, (dist(lead, p) < 9 * u ? 0.3 : 0.6) * KINDS.prop.speed * D.speed * u);
          if (p.route.length === 1 && dist(p, A.from) < 8 * u && onRunway(W, r, p).length) {
            goAround(W, p, 'runway occupied');
            if (W.diff === 'hard') loseLife(W, p, '⚠️ Runway occupied: go around'); else { pop(W, p, '↩️ Go around!', false); sfx.captured(); }
            break;
          }
          p.alt = Math.min(1, dist(p, A.from) / (20 * u));
        } else p.alt = Math.min(1, dist(p, W.pad) / (15 * u));
        if (dist(p, t) <= Math.max(1.2 * u, sp * dt * 1.5)) {
          p.route.shift();
          if (!p.route.length) {
            if (!r) { p.st = 'gone'; handled(W, p, KINDS[p.kind].pts, '🚁 Landed'); break; }
            const A = active(W, r);
            p.st = 'roll'; p.alt = 0; p.hdg = Math.atan2(A.d.y, A.d.x);
            p.route = [{ x: A.from.x + A.d.x * A.len * 0.32, y: A.from.y + A.d.y * A.len * 0.32 }];
            break;
          }
        }
        p.x += Math.cos(p.hdg) * sp * dt; p.y += Math.sin(p.hdg) * sp * dt;
        continue;
      }
      case 'roll': {
        p.speed = Math.max(3.2 * u, p.speed - 2.4 * u * dt); // a quick roll so the runway frees up
        const t = p.route[0];
        if (dist(p, t) < p.speed * dt * 1.5) { p.st = 'gone'; handled(W, p, KINDS[p.kind].pts, '🛬 Landed'); if (Math.random() < 0.35) radio.landed(p.code); break; }
        p.x += Math.cos(p.hdg) * p.speed * dt; p.y += Math.sin(p.hdg) * p.speed * dt;
        continue;
      }
      case 'lineup': {
        const r = W.runways[p.rwy!], A = active(W, r);
        p.hdg = Math.atan2(A.d.y, A.d.x);
        const clear = !onRunway(W, r, p).some((o) => o.st === 'roll' || o.st === 'depart') && !W.planes.some((o) => o.st === 'approach' && o.rwy === r.id && dist(o, A.from) < 14 * u);
        if (clear) { p.st = 'depart'; p.speed = 0.5 * u; }
        continue;
      }
      case 'depart': {
        const r = W.runways[p.rwy!], A = active(W, r);
        p.speed = Math.min(KINDS[p.kind].speed * 2.2 * u, p.speed + 4.5 * u * dt);
        p.x += Math.cos(p.hdg) * p.speed * dt; p.y += Math.sin(p.hdg) * p.speed * dt;
        if (dist(p, A.from) > A.len * 0.7) { p.st = 'climb'; p.rwy = null; }
        continue;
      }
      case 'climb': {
        p.alt = Math.min(1, p.alt + dt * 0.5);
        p.x += Math.cos(p.hdg) * p.speed * dt; p.y += Math.sin(p.hdg) * p.speed * dt;
        if (p.x < -6 * u || p.y < -6 * u || p.x > W.w + 6 * u || p.y > W.h + 6 * u) { p.st = 'gone'; handled(W, { x: Math.min(W.w - 40, Math.max(40, p.x)), y: Math.min(W.h - 40, Math.max(40, p.y)) }, 10, '🛫 Departed'); }
        continue;
      }
    }
    if (p.st === 'inbound' || p.st === 'hold') { const sp = p.speed * slow; p.x += Math.cos(p.hdg) * sp * dt; p.y += Math.sin(p.hdg) * sp * dt; }
  }
  W.planes = W.planes.filter((p) => p.st !== 'gone');
  // separation: moving traffic must stay apart (holding stacks are at different levels)
  // arrivals flying in and holding are stacked high; only traffic on approach or near the runways can meet
  const low = (p: Plane) => p.st === 'approach' || p.st === 'roll' || p.st === 'depart' || (p.st === 'climb' && p.alt < 0.6);
  const live = W.planes.filter(low);
  const ground = (p: Plane) => p.st === 'roll' || p.st === 'depart';
  for (let i = 0; i < live.length; i++) for (let k = i + 1; k < live.length; k++) {
    const a = live[i], b = live[k];
    if ((a.kind === 'heli') !== (b.kind === 'heli')) continue;
    // different runways: separated by altitude until both are low near the field (never on Easy)
    if (a.lane !== b.lane && (D.spacing || ground(a) || ground(b) || a.alt > 0.45 || b.alt > 0.45)) continue;
    if (ground(a) !== ground(b) && Math.max(a.alt, b.alt) > 0.35) continue; // one on the runway, the other still well above it
    if (dist(a, b) < 2.6 * u) { W.over = true; W.crash = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; sfx.lose(); buzz([200, 80, 300]); return; }
  }
  for (const q of W.pops) q.t += dt;
  W.pops = W.pops.filter((q) => q.t < 1.8);
}

// ---------------- drawing ----------------
function planeShape(x: CanvasRenderingContext2D, s: number, heavy: boolean) {
  x.beginPath();
  x.moveTo(s * 1.25, 0); x.quadraticCurveTo(s * 1.1, s * 0.16, s * 0.8, s * 0.17);
  x.lineTo(s * 0.15, s * 0.18); x.lineTo(-s * 0.25, s * (heavy ? 1.15 : 1)); x.lineTo(-s * 0.48, s * (heavy ? 1.15 : 1)); x.lineTo(-s * 0.3, s * 0.18);
  x.lineTo(-s * 0.95, s * 0.15); x.lineTo(-s * 1.15, s * 0.48); x.lineTo(-s * 1.3, s * 0.48); x.lineTo(-s * 1.22, 0);
  x.lineTo(-s * 1.3, -s * 0.48); x.lineTo(-s * 1.15, -s * 0.48); x.lineTo(-s * 0.95, -s * 0.15); x.lineTo(-s * 0.3, -s * 0.18);
  x.lineTo(-s * 0.48, -s * (heavy ? 1.15 : 1)); x.lineTo(-s * 0.25, -s * (heavy ? 1.15 : 1)); x.lineTo(s * 0.15, -s * 0.18); x.lineTo(s * 0.8, -s * 0.17);
  x.quadraticCurveTo(s * 1.1, -s * 0.16, s * 1.25, 0); x.closePath();
}
function drawPlane(x: CanvasRenderingContext2D, W: World, p: Pick<Plane, 'x' | 'y' | 'hdg' | 'kind' | 'alt' | 'tail' | 'st'>, sel: boolean, warn: boolean, mayday: boolean) {
  const u = W.u, s = KINDS[p.kind].size * u * (0.8 + 0.25 * p.alt);
  // shadow drops away from the plane the higher it flies
  const sh = 0.5 * u + p.alt * 3 * u;
  x.save(); x.translate(p.x + sh, p.y + sh); x.rotate(p.hdg); x.fillStyle = 'rgba(0,0,0,.28)';
  if (p.kind === 'heli') { x.beginPath(); x.ellipse(0, 0, s * 0.75, s * 0.45, 0, 0, Math.PI * 2); x.fill(); } else { planeShape(x, s, p.kind === 'heavy'); x.fill(); }
  x.restore();
  x.save(); x.translate(p.x, p.y);
  if (sel) { x.strokeStyle = '#ffd23f'; x.lineWidth = 2.5; x.beginPath(); x.arc(0, 0, s * 1.9 + Math.sin(W.t * 6) * 1.5, 0, Math.PI * 2); x.stroke(); }
  if (warn) { x.strokeStyle = 'rgba(255,45,85,.9)'; x.lineWidth = 2; x.setLineDash([4, 3]); x.beginPath(); x.arc(0, 0, 4.5 * u, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); }
  x.rotate(p.hdg);
  if (p.kind === 'heli') {
    x.fillStyle = p.tail; x.strokeStyle = '#1b1035'; x.lineWidth = 1.2;
    x.beginPath(); x.ellipse(0, 0, s * 0.75, s * 0.45, 0, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillRect(-s * 1.4, -s * 0.1, s * 0.8, s * 0.2);
    x.rotate(W.t * 20); x.strokeStyle = 'rgba(30,30,40,.7)'; x.lineWidth = 2; x.beginPath(); x.moveTo(-s * 1.3, 0); x.lineTo(s * 1.3, 0); x.moveTo(0, -s * 1.3); x.lineTo(0, s * 1.3); x.stroke();
  } else {
    planeShape(x, s, p.kind === 'heavy');
    x.fillStyle = mayday && Math.floor(W.t * 4) % 2 ? '#ff5c7a' : '#f7f9fc'; x.fill();
    x.strokeStyle = 'rgba(27,16,53,.75)'; x.lineWidth = 1; x.stroke();
    // airline tail and nose colour
    x.fillStyle = p.tail; x.beginPath(); x.moveTo(-s * 0.95, 0); x.lineTo(-s * 1.15, s * 0.46); x.lineTo(-s * 1.3, s * 0.46); x.lineTo(-s * 1.22, 0); x.lineTo(-s * 1.3, -s * 0.46); x.lineTo(-s * 1.15, -s * 0.46); x.closePath(); x.fill();
    x.fillRect(-s * 0.9, -s * 0.06, s * 1.6, s * 0.12);
  }
  x.restore();
}

function render(x: CanvasRenderingContext2D, W: World, selId: number | null, selGate: number | null) {
  const { w, h, u } = W;
  // grass with mowing stripes
  x.fillStyle = '#4b8a43'; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.035)'; for (let i = -h; i < w; i += 8 * u) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 4 * u, 0); x.lineTo(i + 4 * u + h, h); x.lineTo(i + h, h); x.fill(); }
  const cx = w / 2, cy = h / 2;
  // apron, taxiways
  x.fillStyle = '#8f969c'; x.fillRect(cx - 17 * u, cy - 9 * u, 36 * u, 15 * u);
  x.strokeStyle = '#a7adb2'; x.lineWidth = 3 * u;
  x.beginPath(); x.moveTo(cx - 17 * u, cy + 3 * u); x.lineTo(cx - 33 * u, cy + 3 * u); x.moveTo(cx, cy + 6 * u); x.lineTo(cx, cy + 16 * u); x.moveTo(cx + 19 * u, cy - 2 * u); x.lineTo(cx + 26 * u, cy - 12 * u); x.stroke();
  x.strokeStyle = '#ffd23f'; x.lineWidth = 0.3 * u; x.setLineDash([u, u]);
  x.beginPath(); x.moveTo(cx - 17 * u, cy + 3 * u); x.lineTo(cx - 33 * u, cy + 3 * u); x.moveTo(cx, cy + 6 * u); x.lineTo(cx, cy + 16 * u); x.stroke(); x.setLineDash([]);
  // terminal building
  x.fillStyle = '#dfe7ee'; x.strokeStyle = '#5b6b7a'; x.lineWidth = 1.5;
  x.beginPath(); x.roundRect?.(cx - 15 * u, cy - 8 * u, 32 * u, 6 * u, 1.5 * u); x.fill(); x.stroke();
  x.fillStyle = '#6ec6ff'; for (let k = 0; k < 6; k++) x.fillRect(cx - 13 * u + k * 5 * u, cy - 7 * u, 3 * u, 1.4 * u);
  x.fillStyle = '#1b1035'; x.font = `900 ${Math.max(8, 1.7 * u)}px system-ui`; x.textAlign = 'center'; x.fillText('RAJA INTL', cx + u, cy - 3.2 * u);
  // control tower
  x.fillStyle = '#c9d3dc'; x.beginPath(); x.arc(cx + 22 * u, cy - 6 * u, 2.6 * u, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = '#6ec6ff'; x.beginPath(); x.arc(cx + 22 * u, cy - 6 * u, 1.5 * u, 0, Math.PI * 2); x.fill();
  // gates with waiting departures
  W.gates.forEach((g, i) => {
    x.strokeStyle = '#ffd23f'; x.lineWidth = 1; x.beginPath(); x.moveTo(g.at.x, g.at.y - 2 * u); x.lineTo(g.at.x, g.at.y + 4 * u); x.stroke();
    x.fillStyle = '#5b6b7a'; x.fillRect(g.at.x - 0.6 * u, cy - 2 * u, 1.2 * u, 2.5 * u); // jet bridge
    x.fillStyle = '#1b1035'; x.font = `800 ${Math.max(7, 1.4 * u)}px system-ui`; x.fillText(`G${i + 1}`, g.at.x, g.at.y + 6.2 * u);
    if (g.plane) {
      const frac = g.plane.wait / DIFFS[W.diff].wait;
      x.strokeStyle = frac > 0.7 ? '#ff2d55' : '#ffd23f'; x.lineWidth = 3;
      x.beginPath(); x.arc(g.at.x, g.at.y + u, 4 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - frac)); x.stroke();
      drawPlane(x, W, { x: g.at.x, y: g.at.y + u, hdg: Math.PI / 2, kind: g.plane.kind, alt: 0, tail: g.plane.tail, st: 'lineup' }, selGate === i, false, false);
      if (selGate !== i && Math.floor(W.t * 2) % 2) { x.fillStyle = '#fff'; x.font = `900 ${2 * u}px system-ui`; x.fillText('📻', g.at.x + 4 * u, g.at.y - 2 * u); }
    }
  });
  // runways
  for (const r of W.runways) {
    const A = active(W, r), len = dist(r.a, r.b), ang = Math.atan2(r.b.y - r.a.y, r.b.x - r.a.x), busy = onRunway(W, r).length > 0;
    x.save(); x.translate(r.a.x, r.a.y); x.rotate(ang);
    x.fillStyle = '#2d3238'; x.fillRect(-2 * u, -3 * u, len + 4 * u, 6 * u);
    x.strokeStyle = busy ? '#ff5c7a' : 'rgba(255,255,255,.85)'; x.lineWidth = busy ? 2.5 : 1.2; x.strokeRect(-2 * u, -2.6 * u, len + 4 * u, 5.2 * u);
    x.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { x.fillRect(-1.2 * u, -2 * u + k * 1.1 * u, 2.6 * u, 0.6 * u); x.fillRect(len - 1.4 * u, -2 * u + k * 1.1 * u, 2.6 * u, 0.6 * u); }
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 0.4 * u; x.setLineDash([2 * u, 1.6 * u]); x.beginPath(); x.moveTo(6 * u, 0); x.lineTo(len - 6 * u, 0); x.stroke(); x.setLineDash([]);
    // numbers painted at each end
    x.fillStyle = '#fff'; x.font = `900 ${2.2 * u}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.save(); x.translate(3.6 * u, 0); x.rotate(Math.PI / 2); x.fillText(r.names[0], 0, 0); x.restore();
    x.save(); x.translate(len - 3.6 * u, 0); x.rotate(-Math.PI / 2); x.fillText(r.names[1], 0, 0); x.restore();
    x.textBaseline = 'alphabetic';
    x.restore();
    // approach lights strobing in towards the active threshold
    for (let k = 0; k < 5; k++) {
      const on = Math.floor(W.t * 8) % 5 === 4 - k, px = A.from.x - A.d.x * (3 + k * 2.4) * u, py = A.from.y - A.d.y * (3 + k * 2.4) * u;
      x.fillStyle = on ? '#fff' : 'rgba(93,255,180,.85)'; x.beginPath(); x.arc(px, py, on ? 0.9 * u : 0.6 * u, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = r.heavy ? '#ffe1e7' : '#e6f3ff'; x.font = `800 ${Math.max(8, 1.6 * u)}px system-ui`; x.textAlign = 'center';
    if (r.heavy) x.fillText(`RWY ${A.name} · all jets`, (r.a.x + r.b.x) / 2, r.a.y + 5.6 * u); else x.fillText(`RWY ${A.name} · no heavies`, r.b.x, r.b.y - 4 * u);
  }
  // helipad
  x.fillStyle = '#2d3238'; x.beginPath(); x.arc(W.pad.x, W.pad.y, 4.2 * u, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#ffd23f'; x.lineWidth = 1.5; x.beginPath(); x.arc(W.pad.x, W.pad.y, 3.4 * u, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#fff'; x.font = `900 ${3.2 * u}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', W.pad.x, W.pad.y + 0.2 * u); x.textBaseline = 'alphabetic';
  // windsock
  const wsx = cx + 32 * u, wsy = cy + 8 * u, wd = W.wind === 1 ? Math.PI : 0;
  x.strokeStyle = '#ddd'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(wsx, wsy); x.lineTo(wsx, wsy - 3 * u); x.stroke();
  x.save(); x.translate(wsx, wsy - 3 * u); x.rotate(wd + Math.sin(W.t * 3) * 0.08);
  x.fillStyle = '#ff8c42'; x.beginPath(); x.moveTo(0, -0.8 * u); x.lineTo(4 * u, -0.4 * u); x.lineTo(4 * u, 0.4 * u); x.lineTo(0, 0.8 * u); x.closePath(); x.fill();
  x.fillStyle = '#fff'; x.fillRect(1.3 * u, -0.7 * u, 0.8 * u, 1.4 * u); x.restore();
  // holding fixes
  for (const f of W.fixes) {
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1; x.setLineDash([3, 4]); x.beginPath(); x.arc(f.x, f.y, 5 * u, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(255,255,255,.8)'; x.font = `800 ${Math.max(7, 1.4 * u)}px system-ui`; x.textAlign = 'center'; x.fillText(f.name, f.x, f.y + 7.4 * u);
  }
  // storms
  for (const s of W.storms) {
    const g = x.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r); g.addColorStop(0, 'rgba(40,40,70,.55)'); g.addColorStop(1, 'rgba(40,40,70,0)');
    x.fillStyle = g; x.beginPath(); x.arc(s.x, s.y, s.r, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(180,200,255,.5)'; x.lineWidth = 1;
    for (let k = 0; k < 8; k++) { const rx = s.x + Math.cos(k * 2.3) * s.r * 0.6, ry = s.y + Math.sin(k * 1.7) * s.r * 0.5 + ((W.t * 30 + k * 13) % (2 * u)); x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 0.5 * u, ry + 1.5 * u); x.stroke(); }
    if (Math.floor(W.t * 3 + s.x) % 9 === 0) { x.fillStyle = 'rgba(255,255,220,.25)'; x.beginPath(); x.arc(s.x, s.y, s.r, 0, Math.PI * 2); x.fill(); }
  }
  // routes of planes cleared to land
  for (const p of W.planes) if (p.st === 'approach' && p.route.length) {
    x.strokeStyle = p.id === selId ? 'rgba(255,210,63,.9)' : 'rgba(255,255,255,.5)'; x.lineWidth = 1.5; x.setLineDash([4, 4]);
    x.beginPath(); x.moveTo(p.x, p.y); for (const q of p.route) x.lineTo(q.x, q.y); x.stroke(); x.setLineDash([]);
  }
  // planes, lowest first
  const order = [...W.planes].sort((a, b) => a.alt - b.alt);
  for (const p of order) {
    const near = (q: Plane) => q.st === 'approach' || q.st === 'roll' || q.st === 'depart' || (q.st === 'climb' && q.alt < 0.6);
    const warn = near(p) && W.planes.some((o) => o !== p && near(o) && (o.kind === 'heli') === (p.kind === 'heli') && dist(o, p) < 8 * u);
    drawPlane(x, W, p, p.id === selId, warn, p.mayday);
    if (airborne(p) && p.st !== 'climb') {
      // data tag: callsign, what it's doing, fuel
      const tx = p.x + 3.4 * u, ty = p.y - 3 * u, tw = 11 * u;
      x.fillStyle = p.id === selId ? 'rgba(255,210,63,.95)' : 'rgba(10,20,30,.7)'; x.beginPath(); x.roundRect?.(tx, ty - 2.4 * u, tw, 3.4 * u, 0.8 * u); x.fill();
      x.fillStyle = p.id === selId ? '#1b1035' : '#fff'; x.font = `800 ${Math.max(8, 1.5 * u)}px system-ui`; x.textAlign = 'left';
      x.fillText(`${p.code} ${p.st === 'approach' ? (p.rwy != null ? '🛬' + active(W, W.runways[p.rwy]).name : '🛬H') : p.st === 'hold' ? '⏳' : '→'}`, tx + 0.7 * u, ty - 0.2 * u);
      const f = Math.max(0, p.fuel / p.fuelMax);
      x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(tx + 0.7 * u, ty + 0.3 * u, tw - 1.4 * u, 0.45 * u);
      x.fillStyle = f < 0.25 ? '#ff2d55' : f < 0.5 ? '#ffd23f' : '#5dffb4'; x.fillRect(tx + 0.7 * u, ty + 0.3 * u, (tw - 1.4 * u) * f, 0.45 * u);
      if (p.mayday) { x.fillStyle = '#ff2d55'; x.font = `900 ${Math.max(8, 1.4 * u)}px system-ui`; x.fillText('MAYDAY', tx, ty - 3 * u); }
    }
  }
  for (const q of W.pops) {
    x.globalAlpha = 1 - q.t / 1.8; x.fillStyle = q.good ? '#fff' : '#ffd0d8'; x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 3;
    x.font = `900 ${Math.max(11, 2.3 * u)}px system-ui`; x.textAlign = 'center';
    x.strokeText(q.text, q.x, q.y - q.t * 6 * u); x.fillText(q.text, q.x, q.y - q.t * 6 * u); x.globalAlpha = 1;
  }
  if (W.crash) { x.font = `${10 * u}px system-ui`; x.textAlign = 'center'; x.fillText('💥', W.crash.x, W.crash.y + 3 * u); }
}

// ---------------- app ----------------
type Sel = { kind: 'plane'; id: number } | { kind: 'gate'; i: number } | null;
export default function RunwayRaja() {
  const [screen, setScreen] = useState<'home' | 'play' | 'over'>('home');
  const [diff, setDiff] = useState<Diff>(() => (localStorage.getItem('runwayraja-diff') as Diff) || 'easy');
  const [hud, setHud] = useState({ score: 0, lives: 3, handled: 0, wind: 1 as 1 | -1, nextWind: 0 });
  const [sel, setSel] = useState<Sel>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMute] = useState(isMuted());
  const [radioOn, setRadioOn] = useState(() => localStorage.getItem('runwayraja-radio') !== 'off');
  const [caption, setCaption] = useState<Line | null>(null);
  const [tip, setTip] = useState('');
  const [result, setResult] = useState<{ won: boolean; score: number; handled: number; stars: number; xp: number; best: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null), W = useRef<World | null>(null);
  const pausedRef = useRef(false); pausedRef.current = paused;
  const selRef = useRef<Sel>(null); selRef.current = sel;
  const [, force] = useState(0);

  useEffect(() => { setRadio(radioOn && !muted); onRadioCaption(setCaption); return () => { onRadioCaption(null); }; }, [radioOn, muted]);
  useEffect(() => () => radioReset(), []);

  useEffect(() => {
    if (screen !== 'play') return;
    const el = box.current!, c = cv.current!, x = c.getContext('2d')!;
    const fit = () => {
      const r = el.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      c.width = r.width * dpr; c.height = r.height * dpr; c.style.width = `${r.width}px`; c.style.height = `${r.height}px`;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!W.current) W.current = newWorld(r.width, r.height, diff);
      else { const l = layout(r.width, r.height); Object.assign(W.current, { w: r.width, h: r.height, u: l.u, runways: l.runways, pad: l.pad, fixes: l.fixes, gates: l.gates.map((g, i) => ({ ...g, plane: W.current!.gates[i]?.plane ?? null })) }); }
    };
    fit();
    if (import.meta.env.DEV) (window as unknown as { __rr?: unknown }).__rr = W; // dev-only handle for testing
    const ro = new ResizeObserver(fit); ro.observe(el);
    let raf = 0, last = performance.now(), hudT = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const w = W.current!;
      if (!pausedRef.current && !w.over) step(w, dt);
      const s = selRef.current;
      if (s?.kind === 'plane' && !w.planes.some((p) => p.id === s.id && airborne(p) && p.st !== 'climb')) setSel(null);
      if (s?.kind === 'gate' && !w.gates[s.i]?.plane) setSel(null);
      render(x, w, s?.kind === 'plane' ? s.id : null, s?.kind === 'gate' ? s.i : null);
      hudT += dt;
      if (hudT > 0.2) { hudT = 0; setHud({ score: w.score, lives: w.lives, handled: w.handled, wind: w.wind, nextWind: w.nextWind }); force((n) => n + 1); }
      if (w.over) { finish(w); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (w: World) => {
    setTimeout(() => {
      const stars = w.won ? Math.max(1, w.lives) : 0;
      const prev = Number(localStorage.getItem(bestKey(w.diff)) || 0), best = w.score > prev;
      if (best) localStorage.setItem(bestKey(w.diff), String(w.score));
      if (w.won) localStorage.setItem(`runwayraja-stars-${w.diff}`, String(Math.max(stars, Number(localStorage.getItem(`runwayraja-stars-${w.diff}`) || 0))));
      const p0 = recordGame(loadProfile(), w.won ? 1 : 0, 1, 0).profile;
      const bonus = Math.min(150, Math.round(w.score / 2)) + (w.won ? { easy: 20, medium: 40, hard: 70 }[w.diff] : 0);
      const pr = recordProgress({ ...p0, xp: p0.xp + bonus }, 'runwayraja', w.won ? 1 : 0, 1, { rr_handled: w.handled });
      saveProfile(pr.profile);
      setResult({ won: w.won, score: w.score, handled: w.handled, stars, xp: bonus + pr.xp + 20, best });
      radioReset(); setSel(null); setScreen('over');
    }, w.won ? 600 : 1500);
  };

  const start = (d: Diff) => { localStorage.setItem('runwayraja-diff', d); setDiff(d); radioReset(); W.current = null; setResult(null); setPaused(false); setSel(null); setScreen('play'); sfx.turn(); };
  const say = (t: string | null) => { if (!t) return; setTip(t); sfx.captured(); setTimeout(() => setTip(''), 2200); };

  const tap = (e: React.PointerEvent) => {
    const w = W.current; if (!w || w.over || paused) return;
    const r = cv.current!.getBoundingClientRect(), p = { x: e.clientX - r.left, y: e.clientY - r.top }, u = w.u;
    const plane = w.planes.filter((q) => airborne(q) && q.st !== 'climb' && dist(q, p) < 8 * u).sort((a, b) => dist(a, p) - dist(b, p))[0];
    if (plane) { setSel({ kind: 'plane', id: plane.id }); sfx.tap(); return; }
    const gi = w.gates.findIndex((g) => g.plane && dist(g.at, p) < 6 * u);
    if (gi >= 0) { setSel({ kind: 'gate', i: gi }); sfx.tap(); return; }
    // tapping a runway or the pad gives the selected plane its clearance
    const s = selRef.current;
    const rw = w.runways.find((q) => { const len = dist(q.a, q.b), t = ((p.x - q.a.x) * (q.b.x - q.a.x) + (p.y - q.a.y) * (q.b.y - q.a.y)) / (len * len); const cx = q.a.x + (q.b.x - q.a.x) * t, cy = q.a.y + (q.b.y - q.a.y) * t; return t > -0.1 && t < 1.1 && Math.hypot(p.x - cx, p.y - cy) < 5 * u; });
    const onPad = dist(p, w.pad) < 6 * u;
    if (s?.kind === 'plane' && (rw || onPad)) { const pl = w.planes.find((q) => q.id === s.id); if (pl) say(cmdLand(w, pl, onPad ? null : rw!)); setSel(null); return; }
    if (s?.kind === 'gate' && rw) { say(cmdTakeoff(w, s.i, rw)); setSel(null); return; }
    setSel(null);
  };

  const D = DIFFS[diff];
  if (screen !== 'play') return (
    <div className="screen home rr-home">
      <Backdrop />
      <div className="topbar"><a className="btn ghost sm" href={import.meta.env.BASE_URL}>← All games</a></div>
      <header className="rr-hero">
        <div className="rr-logo">🛫</div>
        <small>SOLO · AIR TRAFFIC CONTROL</small>
        <h1>Runway <em>Raja</em></h1>
        <p>You're the tower at Raja International. Tap a plane, tap a command.</p>
      </header>
      {screen === 'over' && result && (
        <section className={`card rr-result ${result.won ? 'won' : 'lost'}`}>
          <b>{result.won ? `✅ ${DIFFS[diff].name} shift complete!` : W.current?.crash ? '💥 Collision! Shift over' : '❌ Shift over'}</b>
          {result.won && <div className="stars">{[1, 2, 3].map((k) => <span key={k} className={k <= result.stars ? 'on' : ''}>★</span>)}</div>}
          <div className="big">{result.score}{result.best && <small> new best!</small>}</div>
          <small>{result.handled}/{DIFFS[diff].goal} flights handled · +{result.xp} XP</small>
        </section>
      )}
      <section className="rr-levels">
        {(Object.keys(DIFFS) as Diff[]).map((d) => {
          const stars = Number(localStorage.getItem(`runwayraja-stars-${d}`) || 0), best = Number(localStorage.getItem(bestKey(d)) || 0);
          return (
            <button key={d} className={`rr-level ${d} ${diff === d ? 'on' : ''}`} onClick={() => { sfx.tap(); setDiff(d); }}>
              <b>{DIFFS[d].emoji} {DIFFS[d].name}</b>
              <small>{DIFFS[d].text}</small>
              <span>{DIFFS[d].goal} flights · {[1, 2, 3].map((k) => (k <= stars ? '★' : '☆')).join('')}{best ? ` · best ${best}` : ''}</span>
            </button>
          );
        })}
      </section>
      <section className="card rr-how">
        <div><span>👆</span><p><b>Tap a plane</b>, then tap <b>Land</b> (or tap the runway). It flies the approach by itself.</p></div>
        <div><span>⏳</span><p>New arrivals circle at a <b>holding fix</b> until you clear them. Watch their fuel bar.</p></div>
        <div><span>🛫</span><p><b>Tap a plane at a gate</b> (📻) and pick a runway for take-off.</p></div>
        <div><span>🌬️</span><p>Planes land toward the <b>green lights</b>. On Medium and Hard the wind flips the runways.</p></div>
      </section>
      <section className="actions"><button className="btn primary big" onClick={() => start(diff)}><span className="ic">▶</span> {screen === 'over' ? 'Play again' : 'Start'} · {D.name}</button></section>
    </div>
  );

  const w = W.current;
  const sp = sel?.kind === 'plane' ? w?.planes.find((q) => q.id === sel.id) : null;
  const sg = sel?.kind === 'gate' && w ? w.gates[sel.i].plane : null;
  return (
    <div className="screen rr-game">
      <div className="rr-hud">
        <button className="btn ghost sm" onClick={() => { if (confirm('End this shift?') && W.current) W.current.over = true; }}>✕</button>
        <span className={`rr-diff ${diff}`}>{D.emoji}</span>
        <span className="rr-prog"><b>{hud.handled}</b>/{D.goal}<i style={{ width: `${(hud.handled / D.goal) * 100}%` }} /></span>
        <span className="rr-lives">{'❤️'.repeat(Math.max(0, hud.lives))}{'🖤'.repeat(Math.max(0, 3 - hud.lives))}</span>
        {D.wind > 0 && <span className={`rr-wind ${hud.nextWind < 10 ? 'warn' : ''}`}>🌬️{Math.ceil(hud.nextWind)}s</span>}
        <button className={`btn ghost sm ${radioOn ? '' : 'off'}`} title="Pilot radio" onClick={() => { const v = !radioOn; setRadioOn(v); localStorage.setItem('runwayraja-radio', v ? 'on' : 'off'); }}>{radioOn ? '📻' : '📴'}</button>
        <button className="btn ghost sm" onClick={() => setPaused(!paused)}>{paused ? '▶' : '⏸'}</button>
        <button className="btn ghost sm" onClick={() => { setMuted(!muted); setMute(!muted); }}>{muted ? '🔇' : '🔊'}</button>
      </div>
      <div className="rr-stage" ref={box}>
        <canvas ref={cv} onPointerDown={tap} />
        {tip && <div className="rr-tip">{tip}</div>}
        {caption && radioOn && <div className={`rr-radio ${caption.who}`} key={caption.caption}><i />📻 {caption.caption}</div>}
        {paused && <div className="rr-paused" onClick={() => setPaused(false)}>⏸ Paused · tap to resume</div>}
      </div>
      {w && (sp || sg) && (
        <div className="rr-cmds">
          {sp && (<>
            <div className="rr-who"><b>{sp.code}</b><small>{KINDS[sp.kind].label} · fuel {Math.round((sp.fuel / sp.fuelMax) * 100)}%{sp.mayday ? ' · MAYDAY' : ''}</small></div>
            {sp.kind === 'heli'
              ? <button className="btn primary sm" onClick={() => { say(cmdLand(w, sp, null)); setSel(null); }}>🚁 Land on pad</button>
              : w.runways.map((r) => (
                <button key={r.id} className="btn primary sm" disabled={!fits(sp.kind, r)} onClick={() => { say(cmdLand(w, sp, r)); setSel(null); }}>🛬 Land {active(w, r).name}</button>
              ))}
            {sp.st !== 'hold' && <button className="btn glass sm" onClick={() => { cmdHold(w, sp); setSel(null); }}>⏳ Hold</button>}
          </>)}
          {sg && sel?.kind === 'gate' && (<>
            <div className="rr-who"><b>{sg.code}</b><small>{KINDS[sg.kind].label} · gate {sel.i + 1} · ready</small></div>
            {w.runways.map((r) => (
              <button key={r.id} className="btn primary sm" disabled={!fits(sg.kind, r)} onClick={() => { say(cmdTakeoff(w, sel.i, r)); setSel(null); }}>🛫 Take off {active(w, r).name}</button>
            ))}
          </>)}
          <button className="btn ghost sm" onClick={() => setSel(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
