// Hawai Adda: a single-player airport tycoon. Build on a grid, sign airlines, keep flights on time and passengers
// happy, and grow a village airstrip into an international hub. Saves on the device; earns a little while you're away.
import { useEffect, useRef, useState } from 'react';
import { Backdrop } from '../components/Home';
import { festivalOn } from '../game/festivals';
import { loadProfile, recordGame, saveProfile } from '../game/profile';
import { recordProgress } from '../game/progress';
import { isMuted, setMuted, sfx } from '../game/sound';
import './tycoon.css';

type BKey = 'tower' | 'runway' | 'gate' | 'terminal' | 'security' | 'chai' | 'food' | 'parking' | 'shops' | 'lounge' | 'cargo';
interface BDef { name: string; icon: string; cost: number; upkeep: number; unlock: number; text: string }
const B: Record<BKey, BDef> = {
  tower: { name: 'ATC Tower', icon: '🗼', cost: 8000, upkeep: 200, unlock: 1, text: 'Needed to run any flight. Upgrades speed up the runways.' },
  runway: { name: 'Runway', icon: '🛬', cost: 15000, upkeep: 400, unlock: 1, text: 'One take-off or landing every 20 min. Level 2: takes Large jets.' },
  gate: { name: 'Gate', icon: '🚪', cost: 4000, upkeep: 100, unlock: 1, text: 'Parks one flight at a time.' },
  terminal: { name: 'Terminal', icon: '🏢', cost: 6000, upkeep: 150, unlock: 1, text: 'Handles 150 passengers a flight (more per level).' },
  security: { name: 'Security', icon: '🛂', cost: 3000, upkeep: 120, unlock: 1, text: 'Checks 120 passengers a flight. Short of it means queues and angry flyers.' },
  chai: { name: 'Chai Stall', icon: '☕', cost: 1500, upkeep: 30, unlock: 1, text: '+₹2 from every passenger.' },
  food: { name: 'Food Court', icon: '🍛', cost: 4000, upkeep: 80, unlock: 2, text: '+₹4 from every passenger.' },
  parking: { name: 'Parking', icon: '🅿️', cost: 2500, upkeep: 40, unlock: 2, text: '+₹2 from every passenger.' },
  shops: { name: 'Duty Free', icon: '🛍️', cost: 8000, upkeep: 160, unlock: 3, text: '+₹7 a passenger, only when the airport is ⭐3 or more.' },
  lounge: { name: 'Lounge', icon: '🛋️', cost: 7000, upkeep: 140, unlock: 3, text: 'Happier passengers: rating grows faster.' },
  cargo: { name: 'Cargo Shed', icon: '📦', cost: 10000, upkeep: 200, unlock: 4, text: 'Unlocks cargo airlines (no passengers, big fees).' },
};
const ORDER: BKey[] = ['tower', 'runway', 'gate', 'terminal', 'security', 'chai', 'food', 'parking', 'shops', 'lounge', 'cargo'];
const LEVELS = [
  { name: 'Hawai Patti', pax: 0 }, { name: 'Small Town Airport', pax: 3000 }, { name: 'Regional Airport', pax: 15000 }, { name: 'Metro Airport', pax: 50000 }, { name: 'International Hub', pax: 150000 },
];
const AIRLINES = [
  { name: 'Udaan Air', color: '#2b7bff' }, { name: 'Chai Jet', color: '#ff8c42' }, { name: 'Monsoon Express', color: '#12d6b4' }, { name: 'Maharaja Wings', color: '#b8860b' },
  { name: 'Patang Airways', color: '#ff4fd8' }, { name: 'Desi Hop', color: '#00c97a' }, { name: 'Sitara Air', color: '#7a5cff' }, { name: 'Bharat Cargo', color: '#8d6e63' },
];
type Size = 'S' | 'M' | 'L' | 'C';
const SIZE: Record<Size, { pax: number; fee: number; label: string }> = { S: { pax: 60, fee: 1200, label: 'Small' }, M: { pax: 150, fee: 3000, label: 'Medium' }, L: { pax: 300, fee: 7000, label: 'Large' }, C: { pax: 0, fee: 6000, label: 'Cargo' } };
interface Contract { id: number; airline: number; size: Size; perDay: number; fee: number; minRep: number; days: number }
interface Flight { id: number; c: number; at: number; state: 'due' | 'late' | 'gate' | 'done'; gate?: number; until?: number; code: string }
interface Save {
  v: 1; cash: number; rep: number; day: number; min: number; grid: (BKey | null)[]; lvl: number[]; contracts: Contract[]; offers: Contract[];
  flights: Flight[]; runwayFree: number[]; pax: number; flown: number; earned: number; goals: string[]; event: string; seq: number; lastSeen: number; log: string[];
}
const N = 7; // 7×7 grid
const KEY = 'hawaiadda-v1';
const DAY_SECONDS = 90; // one airport day lasts 90 seconds at 1×
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const levelOfPax = (pax: number) => LEVELS.reduce((l, x, i) => (pax >= x.pax ? i : l), 0);

const GOALS: { id: string; text: string; reward: number; done(s: Save): boolean }[] = [
  { id: 'tower', text: 'Build an ATC Tower', reward: 2000, done: (s) => s.grid.includes('tower') },
  { id: 'runway', text: 'Build a Runway', reward: 3000, done: (s) => s.grid.includes('runway') },
  { id: 'basics', text: 'Build a Gate, a Terminal and Security', reward: 3000, done: (s) => (['gate', 'terminal', 'security'] as BKey[]).every((k) => s.grid.includes(k)) },
  { id: 'airline', text: 'Sign your first airline (📋 Airlines)', reward: 4000, done: (s) => s.contracts.length > 0 },
  { id: 'pax1k', text: 'Serve 1,000 passengers', reward: 6000, done: (s) => s.pax >= 1000 },
  { id: 'chai', text: 'Open a Chai Stall', reward: 1500, done: (s) => s.grid.includes('chai') },
  { id: 'rep3', text: 'Reach a ⭐3 rating', reward: 10000, done: (s) => s.rep >= 3 },
  { id: 'gates3', text: 'Run 3 gates', reward: 8000, done: (s) => s.grid.filter((b) => b === 'gate').length >= 3 },
  { id: 'lakh', text: 'Earn ₹1 lakh in total', reward: 15000, done: (s) => s.earned >= 100000 },
  { id: 'long', text: 'Upgrade a runway to take Large jets', reward: 15000, done: (s) => s.grid.some((b, i) => b === 'runway' && s.lvl[i] >= 2) },
  { id: 'pax50k', text: 'Become a Metro Airport (50,000 passengers)', reward: 50000, done: (s) => s.pax >= 50000 },
  { id: 'hub', text: 'Become an International Hub', reward: 150000, done: (s) => s.pax >= 150000 },
];

function fresh(): Save {
  return { v: 1, cash: 50000, rep: 2.5, day: 1, min: 6 * 60, grid: Array(N * N).fill(null), lvl: Array(N * N).fill(0), contracts: [], offers: [], flights: [], runwayFree: [],
    pax: 0, flown: 0, earned: 0, goals: [], event: '', seq: 1, lastSeen: Date.now(), log: ['🛬 Welcome to your airstrip! Start with an ATC Tower and a Runway.'] };
}
function load(): Save { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s?.v === 1) return s; } catch { /* fresh */ } return fresh(); }
const store = (s: Save) => { try { localStorage.setItem(KEY, JSON.stringify({ ...s, lastSeen: Date.now() })); } catch { /* full */ } };

const count = (s: Save, k: BKey) => s.grid.reduce((n, b, i) => n + (b === k ? 1 + Math.max(0, s.lvl[i] - 1) * 0.5 : 0), 0); // a level-2 building counts 1.5
const has = (s: Save, k: BKey) => s.grid.includes(k);
const log = (s: Save, t: string) => { s.log = [t, ...s.log].slice(0, 40); };

function makeOffer(s: Save): Contract {
  const lvl = levelOfPax(s.pax), cargo = has(s, 'cargo') && Math.random() < 0.25;
  const size: Size = cargo ? 'C' : lvl >= 3 && Math.random() < 0.35 ? 'L' : lvl >= 1 && Math.random() < 0.55 ? 'M' : 'S';
  const airline = cargo ? 7 : Math.floor(Math.random() * 7);
  const perDay = 1 + Math.floor(Math.random() * (2 + lvl));
  return { id: s.seq++, airline, size, perDay, fee: Math.round(SIZE[size].fee * (0.85 + Math.random() * 0.4) / 100) * 100, minRep: Math.max(0, Math.min(4.5, (size === 'L' ? 3.2 : size === 'M' ? 2 : 0.5) + Math.random() - 0.5)), days: 5 + Math.floor(Math.random() * 6) };
}

/** Each new day: contracts age, flights get scheduled, upkeep is paid, a daily event may happen. */
function newDay(s: Save) {
  s.day++; s.min = 6 * 60;
  const upkeep = s.grid.reduce((t, b, i) => t + (b ? B[b].upkeep * (1 + s.lvl[i] * 0.3) : 0), 0);
  s.cash -= upkeep;
  log(s, `🌅 Day ${s.day}: upkeep ${fmt(upkeep)}`);
  for (const c of s.contracts) c.days--;
  const ended = s.contracts.filter((c) => c.days <= 0);
  for (const c of ended) log(s, `📋 ${AIRLINES[c.airline].name}'s contract ended. Sign them again from Airlines!`);
  s.contracts = s.contracts.filter((c) => c.days > 0 && s.rep >= c.minRep - 0.8);
  while (s.offers.length < 3) s.offers.push(makeOffer(s));
  if (Math.random() < 0.4) s.offers[Math.floor(Math.random() * s.offers.length)] = makeOffer(s);
  const fest = festivalOn();
  const r = Math.random();
  s.event = fest ? 'festival' : r < 0.18 ? 'monsoon' : r < 0.3 ? 'vip' : '';
  if (s.event === 'monsoon') log(s, '🌧️ Monsoon day: runways take twice as long');
  if (s.event === 'festival') log(s, `${fest!.emoji} ${fest!.name} rush: 50% more passengers today!`);
  scheduleDay(s);
  if (s.event === 'vip') { s.flights.push({ id: s.seq++, c: -1, at: 10 * 60 + Math.random() * 600, state: 'due', code: 'VIP1' }); log(s, '🕴️ A VIP charter is coming today: ₹15,000 if it lands on time'); }
  if (s.cash < 0) log(s, '⚠️ You are in the red. Cut costs or sign more airlines!');
}
function scheduleDay(s: Save) {
  for (const c of s.contracts) for (let k = 0; k < c.perDay; k++) {
    const at = 6 * 60 + 30 + (k + Math.random() * 0.8) * ((17 * 60) / c.perDay);
    s.flights.push({ id: s.seq++, c: c.id, at, state: 'due', code: `${AIRLINES[c.airline].name.split(' ').map((w) => w[0]).join('')}${100 + Math.floor(Math.random() * 900)}` });
  }
}

interface Pop { id: number; tile: number; text: string; good: boolean }

/** Advance the airport by `mins` game minutes; returns floating texts for the screen. */
function tick(s: Save, mins: number): Pop[] {
  const pops: Pop[] = [];
  s.min += mins;
  if (s.min >= 24 * 60) newDay(s);
  const ready = has(s, 'tower');
  const runways = s.grid.map((b, i) => (b === 'runway' ? i : -1)).filter((i) => i >= 0);
  const gates = s.grid.map((b, i) => (b === 'gate' ? i : -1)).filter((i) => i >= 0);
  const towerLvl = Math.max(0, ...s.grid.map((b, i) => (b === 'tower' ? s.lvl[i] : 0)));
  const rwyTime = (s.event === 'monsoon' ? 40 : 20) * (towerLvl >= 2 ? 0.7 : 1);
  // free the gates whose flights are done
  for (const f of s.flights) if (f.state === 'gate' && s.min >= (f.until ?? 0)) f.state = 'done';
  for (const f of s.flights) {
    if ((f.state !== 'due' && f.state !== 'late') || s.min < f.at) continue;
    const c = s.contracts.find((x) => x.id === f.c);
    const size: Size = f.c === -1 ? 'M' : c?.size ?? 'S';
    if (f.c !== -1 && !c) { f.state = 'done'; continue; }
    const busyGates = new Set(s.flights.filter((x) => x.state === 'gate').map((x) => x.gate));
    const gate = gates.find((g) => !busyGates.has(g));
    const rwy = runways.find((r) => (s.runwayFree[r] ?? 0) <= s.min && (size !== 'L' || s.lvl[r] >= 2));
    if (ready && gate != null && rwy != null && (size === 'C' ? has(s, 'cargo') : has(s, 'terminal') && has(s, 'security'))) {
      s.runwayFree[rwy] = s.min + rwyTime;
      f.state = 'gate'; f.gate = gate; f.until = s.min + 50;
      // passengers flow through the terminal and security; whatever doesn't fit waits and grumbles
      let pax = Math.round(SIZE[size].pax * (s.event === 'festival' ? 1.5 : 1));
      const cap = Math.min(count(s, 'terminal') * 150, count(s, 'security') * 120);
      const over = size === 'C' ? 0 : Math.max(0, pax - cap);
      pax -= over;
      const spend = Math.min(3, count(s, 'chai')) * 2 + Math.min(3, count(s, 'food')) * 4 + Math.min(3, count(s, 'parking')) * 2 + (s.rep >= 3 ? Math.min(3, count(s, 'shops')) * 7 : 0);
      const late = s.min - f.at > 20;
      const fee = f.c === -1 ? (late ? 4000 : 15000) : (c!.fee * (late ? 0.7 : 1));
      const money = fee + pax * spend;
      s.cash += money; s.earned += money; s.pax += pax; s.flown++;
      s.rep = Math.max(0, Math.min(5, s.rep + (late ? -0.04 : 0.03 + Math.min(3, count(s, 'lounge')) * 0.01) - (over > 0 ? Math.min(0.15, over / 600) : 0)));
      pops.push({ id: f.id, tile: gate, text: `+${fmt(money)}`, good: true });
      if (over > 0) pops.push({ id: f.id + 0.5, tile: gate, text: `😤 ${over} stuck`, good: false });
      if (late) log(s, `⏰ ${f.code} landed late at ${hhmm(s.min)}`);
    } else {
      if (s.min - f.at > 20) f.state = 'late';
      if (s.min - f.at > 120) {
        f.state = 'done'; s.rep = Math.max(0, s.rep - 0.15);
        log(s, `❌ ${f.code} cancelled: ${!ready ? 'no ATC tower' : !runways.length ? 'no runway' : gate == null ? 'no free gate' : 'no runway slot'} (rating −0.15)`);
        if (gates.length) pops.push({ id: f.id, tile: gates[0], text: '❌ cancelled', good: false });
      }
    }
  }
  s.flights = s.flights.filter((f) => f.state !== 'done' || f.at > s.min - 1);
  for (const g of GOALS) if (!s.goals.includes(g.id) && g.done(s)) { s.goals.push(g.id); s.cash += g.reward; log(s, `🎯 Goal: ${g.text} · +${fmt(g.reward)}`); pops.push({ id: Math.random(), tile: -1, text: `🎯 ${g.text}! +${fmt(g.reward)}`, good: true }); sfx.win(); }
  return pops;
}

// ---------------- app ----------------
export default function HawaiAdda() {
  const [s, setS] = useState<Save>(load);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<'build' | 'air' | 'log'>('build');
  const [pick, setPick] = useState<BKey | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [pops, setPops] = useState<(Pop & { at: number })[]>([]);
  const [away, setAway] = useState<string>('');
  const [muted, setMute] = useState(isMuted());
  const ref = useRef(s); ref.current = s;
  const [started, setStarted] = useState(false);

  // earnings while away: half of an average day's takings per missed day, at most 1 day
  useEffect(() => {
    const st = ref.current, gone = (Date.now() - st.lastSeen) / 1000;
    if (st.flown > 0 && gone > 120) {
      const perDay = st.earned / Math.max(1, st.day), days = Math.min(1, gone / (DAY_SECONDS * 4));
      const gain = Math.round(perDay * 0.5 * days);
      if (gain > 0) { const n = { ...st, cash: st.cash + gain }; setS(n); store(n); setAway(`While you were away your airport earned ${fmt(gain)} ✈️`); }
    }
  }, []);

  useEffect(() => {
    if (!started || !speed) return;
    const t = setInterval(() => {
      const n: Save = structuredClone(ref.current);
      const out = tick(n, (24 * 60 / DAY_SECONDS) * 0.25 * speed);
      setS(n);
      if (out.length) { const now = Date.now(); setPops((l) => [...l.filter((p) => now - p.at < 1800), ...out.map((p) => ({ ...p, at: now }))]); if (out.some((p) => p.good && p.tile >= 0)) sfx.tink(1); }
    }, 250);
    const save = setInterval(() => store(ref.current), 4000);
    return () => { clearInterval(t); clearInterval(save); store(ref.current); };
  }, [started, speed]);

  const lvl = levelOfPax(s.pax);
  const place = (i: number) => {
    if (s.grid[i]) { setSel(i); setPick(null); return; }
    if (!pick) { setSel(null); return; }
    const d = B[pick];
    if (s.cash < d.cost) { sfx.captured(); return; }
    const n = structuredClone(s); n.grid[i] = pick; n.lvl[i] = 1; n.cash -= d.cost;
    if (pick === 'runway' || pick === 'gate') n.flights.filter((f) => f.state === 'late').forEach((f) => (f.at = n.min));
    log(n, `🏗️ Built ${d.name} for ${fmt(d.cost)}`);
    setS(n); store(n); sfx.home();
  };
  const upgrade = (i: number) => {
    const k = s.grid[i]!, cost = B[k].cost * (s.lvl[i] + 0.5);
    if (s.cash < cost || s.lvl[i] >= 3) return;
    const n = structuredClone(s); n.cash -= cost; n.lvl[i]++; log(n, `⬆️ ${B[k].name} upgraded to level ${n.lvl[i]}`); setS(n); store(n); sfx.win();
  };
  const sell = (i: number) => {
    const k = s.grid[i]!, back = B[k].cost * 0.5 * s.lvl[i];
    const n = structuredClone(s); n.cash += back; n.grid[i] = null; n.lvl[i] = 0; log(n, `💸 Sold ${B[k].name} for ${fmt(back)}`); setS(n); store(n); setSel(null);
  };
  const sign = (c: Contract) => {
    if (s.rep < c.minRep) return;
    const n = structuredClone(s); n.offers = n.offers.filter((o) => o.id !== c.id); n.contracts.push(c);
    // today's remaining flights for the new airline
    for (let k = 0; k < c.perDay; k++) { const at = Math.max(n.min + 30, 6 * 60 + 30 + (k + 0.5) * ((17 * 60) / c.perDay)); if (at < 23.5 * 60) n.flights.push({ id: n.seq++, c: c.id, at, state: 'due', code: `${AIRLINES[c.airline].name.split(' ').map((w) => w[0]).join('')}${100 + Math.floor(Math.random() * 900)}` }); }
    log(n, `✍️ Signed ${AIRLINES[c.airline].name}: ${c.perDay} ${SIZE[c.size].label} flights a day for ${c.days} days`);
    setS(n); store(n); sfx.home();
  };
  const reset = () => { if (!confirm('Start a brand-new airport? Your current one will be gone.')) return; const n = fresh(); setS(n); store(n); };
  const leave = () => {
    store(ref.current);
    // a session counts as a game for XP and daily quests once some flights have flown
    if (ref.current.flown > 0) { const p0 = recordGame(loadProfile(), 0, 1, 0).profile; saveProfile(recordProgress(p0, 'hawaiadda', 0, 1, { ha_pax: ref.current.pax }).profile); }
    location.href = import.meta.env.BASE_URL;
  };

  useEffect(() => { if (s.offers.length === 0) { const n = structuredClone(s); while (n.offers.length < 3) n.offers.push(makeOffer(n)); setS(n); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!started) return (
    <div className="screen home ha-home">
      <Backdrop />
      <div className="topbar"><a className="btn ghost sm" href={import.meta.env.BASE_URL}>← All games</a></div>
      <header className="rr-hero">
        <div className="rr-logo ha">🛫</div>
        <small>SOLO · AIRPORT TYCOON</small>
        <h1>Hawai <em className="ha">Adda</em></h1>
        <p>Turn a dusty airstrip into an international hub.</p>
      </header>
      {away && <div className="banner ok">{away}</div>}
      <section className="card rr-how">
        <div><span>🏗️</span><p><b>Build</b> an ATC tower, runway, gates, terminal and security. Then shops to earn from every passenger.</p></div>
        <div><span>✍️</span><p><b>Sign airlines.</b> Bigger jets pay more but want a better ⭐ rating and longer runways.</p></div>
        <div><span>⏰</span><p><b>Keep flights on time.</b> No free gate or runway means delays, angry flyers and a lower rating.</p></div>
        <div><span>🌧️</span><p>Monsoon days, VIP charters and festival rushes keep every day different.</p></div>
      </section>
      <section className="card ha-save"><b>{LEVELS[lvl].name}</b><small>Day {s.day} · {fmt(s.cash)} · ⭐{s.rep.toFixed(1)} · {s.pax.toLocaleString('en-IN')} passengers</small></section>
      <section className="actions">
        <button className="btn primary big" onClick={() => { sfx.turn(); setStarted(true); }}><span className="ic">▶</span> {s.flown || s.grid.some(Boolean) ? 'Open the airport' : 'Start building'}</button>
        {(s.flown > 0 || s.grid.some(Boolean)) && <button className="btn ghost" onClick={reset}>New airport</button>}
      </section>
    </div>
  );

  const goal = GOALS.find((g) => !s.goals.includes(g.id));
  const busyGate = new Map(s.flights.filter((f) => f.state === 'gate').map((f) => [f.gate, f]));
  const runwayBusy = (i: number) => (s.runwayFree[i] ?? 0) > s.min;
  const waiting = s.flights.filter((f) => (f.state === 'due' || f.state === 'late') && f.at <= s.min).length;
  const next = s.flights.filter((f) => f.state === 'due' && f.at > s.min).sort((a, b) => a.at - b.at)[0];
  const night = s.min < 6 * 60 + 30 || s.min > 20 * 60;

  return (
    <div className={`screen ha-game ${night ? 'night' : ''}`}>
      <div className="ha-hud">
        <button className="btn ghost sm" onClick={leave}>✕</button>
        <div className="ha-stats">
          <b className={s.cash < 0 ? 'neg' : ''}>{fmt(s.cash)}</b>
          <span title="Rating">⭐{s.rep.toFixed(1)}</span>
          <span>D{s.day} {hhmm(s.min)}{s.event === 'monsoon' ? ' 🌧️' : s.event === 'festival' ? ` ${festivalOn()?.emoji ?? '🎉'}` : s.event === 'vip' ? ' 🕴️' : ''}</span>
        </div>
        <div className="seg ha-speed">{[0, 1, 2, 4].map((v) => <button key={v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>{v ? `${v}×` : '⏸'}</button>)}</div>
        <button className="btn ghost sm" onClick={() => { setMuted(!muted); setMute(!muted); }}>{muted ? '🔇' : '🔊'}</button>
      </div>
      <div className="ha-sub">
        <span className="lvl">{LEVELS[lvl].name}{lvl < 4 && ` · ${s.pax.toLocaleString('en-IN')}/${LEVELS[lvl + 1].pax.toLocaleString('en-IN')} pax`}</span>
        {goal && <span className="goal">🎯 {goal.text} · {fmt(goal.reward)}</span>}
      </div>
      <div className="ha-main">
        <div className="ha-gridwrap">
          <div className="ha-grid" style={{ ['--n' as string]: N }}>
            {s.grid.map((b, i) => {
              const f = b === 'gate' ? busyGate.get(i) : undefined;
              return (
                <button key={i} className={`ha-tile ${b ?? 'empty'} ${pick && !b ? 'can' : ''} ${sel === i ? 'sel' : ''} ${b === 'runway' && runwayBusy(i) ? 'busy' : ''}`} onClick={() => place(i)}>
                  {b && <span className="ic">{B[b].icon}</span>}
                  {b && s.lvl[i] > 1 && <i className="lv">{'★'.repeat(s.lvl[i] - 1)}</i>}
                  {b === 'runway' && runwayBusy(i) && <span className="rw-plane">✈️</span>}
                  {f && <span className="parked" title={f.code}>✈️</span>}
                  {pops.filter((p) => p.tile === i).map((p) => <em key={p.id} className={`pop ${p.good ? 'good' : 'bad'}`}>{p.text}</em>)}
                </button>
              );
            })}
          </div>
          {pops.filter((p) => p.tile === -1).map((p) => <div key={p.id} className="ha-goalpop">{p.text}</div>)}
        </div>
        <div className="ha-panel">
          <div className="seg ha-tabs">
            <button className={tab === 'build' ? 'on' : ''} onClick={() => setTab('build')}>🏗️ Build</button>
            <button className={tab === 'air' ? 'on' : ''} onClick={() => setTab('air')}>📋 Airlines{s.offers.some((o) => s.rep >= o.minRep) ? ' •' : ''}</button>
            <button className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>📜 Ops</button>
          </div>
          {sel != null && s.grid[sel] && (() => {
            const k = s.grid[sel]!, cost = B[k].cost * (s.lvl[sel] + 0.5);
            return (
              <div className="ha-sel">
                <b>{B[k].icon} {B[k].name} · level {s.lvl[sel]}</b><small>{B[k].text}</small>
                <div className="row">
                  {s.lvl[sel] < 3 && <button className="btn primary sm" disabled={s.cash < cost} onClick={() => upgrade(sel)}>⬆️ Upgrade {fmt(cost)}</button>}
                  <button className="btn glass sm" onClick={() => sell(sel)}>Sell {fmt(B[k].cost * 0.5 * s.lvl[sel])}</button>
                  <button className="btn ghost sm" onClick={() => setSel(null)}>✕</button>
                </div>
              </div>
            );
          })()}
          {tab === 'build' && (
            <div className="ha-build">
              {ORDER.map((k) => {
                const d = B[k], locked = lvl + 1 < d.unlock;
                return (
                  <button key={k} className={`ha-card ${pick === k ? 'on' : ''}`} disabled={locked} onClick={() => { setPick(pick === k ? null : k); setSel(null); sfx.tap(); }} title={d.text}>
                    <span className="ic">{d.icon}</span><b>{d.name}</b>
                    <small>{locked ? `🔒 ${LEVELS[d.unlock - 1].name}` : fmt(d.cost)}</small>
                  </button>
                );
              })}
              <small className="dim ha-hint">{pick ? `Tap an empty square to build a ${B[pick].name}. ${B[pick].text}` : 'Pick a building, then tap an empty square. Tap a building to upgrade or sell it.'}</small>
            </div>
          )}
          {tab === 'air' && (
            <div className="ha-air">
              <small className="dim">Flights today: {waiting > 0 ? `⏳ ${waiting} waiting · ` : ''}{next ? `next ${next.code} at ${hhmm(next.at)}` : 'none left'}</small>
              {s.contracts.map((c) => <div key={c.id} className="ha-con mine" style={{ ['--ac' as string]: AIRLINES[c.airline].color }}><b>{AIRLINES[c.airline].name}</b><small>{c.perDay}× {SIZE[c.size].label} a day · {fmt(c.fee)}/flight · {c.days} days left</small></div>)}
              <h4>Offers</h4>
              {s.offers.map((c) => (
                <div key={c.id} className="ha-con" style={{ ['--ac' as string]: AIRLINES[c.airline].color }}>
                  <div><b>{AIRLINES[c.airline].name}</b><small>{c.perDay}× {SIZE[c.size].label}{c.size === 'L' ? ' (needs runway ★)' : c.size === 'C' ? ' (needs cargo shed)' : ''} a day · {fmt(c.fee)}/flight · {c.days} days · needs ⭐{c.minRep.toFixed(1)}</small></div>
                  <button className="btn premium sm" disabled={s.rep < c.minRep} onClick={() => sign(c)}>Sign</button>
                </div>
              ))}
            </div>
          )}
          {tab === 'log' && (
            <div className="ha-log">
              <small className="dim">{s.pax.toLocaleString('en-IN')} passengers · {s.flown} flights · earned {fmt(s.earned)}</small>
              <ol>{s.log.map((l, i) => <li key={i}>{l}</li>)}</ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
