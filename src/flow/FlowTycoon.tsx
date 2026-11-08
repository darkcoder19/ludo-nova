// A shared animated "flow" tycoon: customers (or dabbas) arrive, move through a line of stages, wait their turn,
// get served (with a progress ring), and pay at every stage. Tap a stage: add more, make it faster, or earn more.
// Used by Tapri Tycoon and Dabba Express; each game supplies its stages, look and wording.
import { useEffect, useRef, useState } from 'react';
import { Backdrop } from '../components/Home';
import { loadProfile, recordGame, saveProfile } from '../game/profile';
import { recordProgress } from '../game/progress';
import { isMuted, setMuted, sfx } from '../game/sound';
import '../atc/atc.css';
import './flow.css';

export interface Stage { key: string; name: string; icon: string; base: number; svc: number; fee: number; per: number; maxN: number; unlock: number; optional?: boolean; color: string; add: string; spd: string; inc: string; text: string }
export interface FlowConfig {
  slug: string; name: string; accent: string; tag: string; logo: string; intro: { icon: string; text: string }[];
  stages: Stage[]; source: { name: string; icon: string; base: number; rate: number; text: string };
  entity: 'person' | 'box'; colors: string[]; floor: [string, string]; unitLabel: string; patience: number; finalFee: number;
  levels: [number, string][];
}
interface Lvl { n: number; spd: number; inc: number }
interface Save { v: 1; cash: number; rating: number; served: number; earned: number; st: Record<string, Lvl>; seen: number; perMin: number }
interface Ent { id: number; x: number; y: number; path: { x: number; y: number }[]; stage: number; st: 'walk' | 'queue' | 'svc' | 'gone'; t: number; tt: number; slot: number; age: number; color: string; vip: boolean }
interface Sim { t: number; ents: Ent[]; queues: Record<number, number[]>; busy: Record<number, (number | null)[]>; pops: { x: number; y: number; text: string; t: number; bad?: boolean }[]; spawnIn: number; seq: number; income: number[] }

const LW = 1200, LH = 560;
const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const short = (n: number) => (n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(1)}L` : n >= 1000 ? `₹${+(n / 1000).toFixed(1)}k` : `₹${Math.round(n)}`);
const costAdd = (b: number, l: Lvl) => Math.round(b * (l.n === 0 ? 1 : 1.8 ** l.n));
const costSpd = (b: number, l: Lvl) => Math.round(b * 0.8 * 1.6 ** l.spd);
const costInc = (b: number, l: Lvl) => Math.round(b * 0.9 * 1.7 ** l.inc);

export default function FlowTycoon({ cfg }: { cfg: FlowConfig }) {
  const KEY = `${cfg.slug}-v1`;
  const all = [{ key: 'source', name: cfg.source.name, icon: cfg.source.icon, base: cfg.source.base, svc: 0, fee: 0, per: 1, maxN: 1, unlock: 0, color: '#9aa7b3', add: '', spd: 'More arrivals', inc: '', text: cfg.source.text } as Stage, ...cfg.stages];
  const fresh = (): Save => ({ v: 1, cash: 300, rating: 3, served: 0, earned: 0, seen: Date.now(), perMin: 0, st: Object.fromEntries(all.map((s) => [s.key, { n: s.optional ? 0 : 1, spd: 1, inc: 1 }])) });
  const load = (): Save => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s?.v === 1) { for (const a of all) s.st[a.key] ??= { n: a.optional ? 0 : 1, spd: 1, inc: 1 }; return s; } } catch { /* fresh */ } return fresh(); };
  const store = (s: Save) => { try { localStorage.setItem(KEY, JSON.stringify({ ...s, seen: Date.now() })); } catch { /* full */ } };

  const [s, setS] = useState<Save>(load);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sel, setSel] = useState<string | null>(null);
  const [away, setAway] = useState('');
  const [muted, setMute] = useState(isMuted());
  const [, force] = useState(0);
  const ref = useRef(s); ref.current = s;
  const sim = useRef<Sim>({ t: 0, ents: [], queues: {}, busy: {}, pops: [], spawnIn: 1, seq: 1, income: [] });
  const cv = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null);
  const view = useRef({ w: 300, h: 300, k: 0.3, ox: 0, oy: 0, rot: false });
  const selRef = useRef(sel); selRef.current = sel;
  const speedRef = useRef(speed); speedRef.current = speed;

  const stageX = (i: number) => 150 + (i * (LW - 240)) / Math.max(1, cfg.stages.length - 1 + 0.6);
  const unitY = (i: number, n: number) => LH / 2 + (i - (n - 1) / 2) * Math.min(70, 380 / Math.max(1, n));
  const svcOf = (st: Stage, l: Lvl) => st.svc / (1 + 0.32 * (l.spd - 1));
  const feeOf = (st: Stage, l: Lvl) => st.fee * (1 + 0.45 * (l.inc - 1));

  useEffect(() => {
    const st = ref.current, mins = Math.min(120, (Date.now() - st.seen) / 60000);
    if (st.perMin > 0 && mins > 2) { const gain = Math.round(st.perMin * mins * 0.5); const n = { ...st, cash: st.cash + gain, earned: st.earned + gain }; setS(n); store(n); setAway(`While you were away you earned ${fmt(gain)}`); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function step(st: Save, m: Sim, dt: number) {
    m.t += dt;
    const src = st.st.source;
    m.spawnIn -= dt;
    if (m.spawnIn <= 0) {
      m.spawnIn = (cfg.source.rate / (1 + 0.3 * (src.spd - 1))) * (0.7 + Math.random() * 0.6) * (1.3 - st.rating * 0.08);
      const vip = Math.random() < 0.12;
      m.ents.push({ id: m.seq++, x: 20, y: LH / 2 + (Math.random() - 0.5) * 80, path: [], stage: -1, st: 'walk', t: 0, tt: 0, slot: -1, age: 0, color: vip ? '#f0b400' : cfg.colors[Math.floor(Math.random() * cfg.colors.length)], vip });
      next(st, m, m.ents[m.ents.length - 1]);
    }
    const sp = 60 * dt;
    cfg.stages.forEach((stg, i) => {
      const l = st.st[stg.key]; if (!l.n) return;
      const busy = (m.busy[i] ??= []); busy.length = l.n * stg.per;
      const q = (m.queues[i] ??= []);
      for (let u = 0; u < busy.length; u++) {
        if (busy[u] != null && !m.ents.some((e) => e.id === busy[u] && e.st === 'svc')) busy[u] = null;
        if (busy[u] != null) continue;
        const id = q.find((x) => m.ents.find((e) => e.id === x)?.st === 'queue'); if (id == null) continue;
        busy[u] = id; q.splice(q.indexOf(id), 1);
        const e = m.ents.find((x) => x.id === id)!;
        e.st = 'svc'; e.slot = u; e.tt = e.t = svcOf(stg, l) * (0.8 + Math.random() * 0.4);
        const uy = unitY(Math.floor(u / stg.per), l.n) + ((u % stg.per) - (stg.per - 1) / 2) * 14;
        e.path = [{ x: stageX(i) - 18, y: uy }];
      }
    });
    for (const e of m.ents) {
      e.age += dt;
      if (e.path.length) {
        const t = e.path[0], dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
        if (d <= sp) { e.x = t.x; e.y = t.y; e.path.shift(); } else { e.x += (dx / d) * sp; e.y += (dy / d) * sp; }
        if (e.path.length) continue;
        if (e.st === 'walk') { if (e.stage >= cfg.stages.length) { e.st = 'gone'; continue; } e.st = 'queue'; }
      }
      if (e.st === 'queue') {
        const q = m.queues[e.stage] ?? [], pos = q.indexOf(e.id);
        const tx = stageX(e.stage) - 50 - (pos % 10) * 12, ty = LH / 2 + (Math.floor(pos / 10) - 0.5) * 16;
        e.x += (tx - e.x) * Math.min(1, dt * 3); e.y += (ty - e.y) * Math.min(1, dt * 3);
        // waiting too long: they give up and leave
        if (e.age > cfg.patience) { e.st = 'gone'; st.rating = Math.max(0.5, st.rating - 0.04); m.pops.push({ x: e.x, y: e.y - 14, text: '😤 left', t: 0, bad: true }); }
        continue;
      }
      if (e.st === 'svc') {
        e.t -= dt; if (e.t > 0) continue;
        const stg = cfg.stages[e.stage], amt = feeOf(stg, st.st[stg.key]) * (e.vip ? 3 : 1);
        st.cash += amt; st.earned += amt; m.income.push(amt);
        m.pops.push({ x: e.x, y: e.y - 16, text: `+${short(amt)}`, t: 0 });
        next(st, m, e);
      }
    }
    m.ents = m.ents.filter((e) => e.st !== 'gone');
    const alive = new Set(m.ents.map((e) => e.id));
    for (const k in m.queues) m.queues[k] = m.queues[k].filter((x) => alive.has(x));
    for (const p of m.pops) p.t += dt;
    m.pops = m.pops.filter((p) => p.t < 1.6);
  }
  function next(st: Save, m: Sim, e: Ent) {
    let i = e.stage + 1;
    while (i < cfg.stages.length && st.st[cfg.stages[i].key].n === 0) i++; // skip stages not built yet
    e.stage = i; e.st = 'walk'; e.age = 0;
    if (i >= cfg.stages.length) {
      // done: a happy customer / a delivered dabba
      st.served++; st.rating = Math.min(5, st.rating + 0.01);
      const bonus = cfg.finalFee * (e.vip ? 3 : 1); st.cash += bonus; st.earned += bonus; m.income.push(bonus);
      e.path = [{ x: LW + 30, y: e.y }];
      return;
    }
    (m.queues[i] ??= []).push(e.id);
    e.path = [{ x: stageX(i) - 60, y: LH / 2 + (Math.random() - 0.5) * 40 }];
  }

  function render(x: CanvasRenderingContext2D, st: Save, m: Sim) {
    const v = view.current, dpr = Math.min(2, devicePixelRatio || 1);
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, v.w * dpr, v.h * dpr);
    x.setTransform(dpr * v.k, 0, 0, dpr * v.k, dpr * v.ox, dpr * v.oy);
    if (v.rot) { x.translate(LH, 0); x.rotate(Math.PI / 2); }
    const F = Math.min(2.4, Math.max(1, 1 / v.k));
    const up = (lx: number, ly: number, f: () => void) => { x.save(); x.translate(lx, ly); if (v.rot) x.rotate(-Math.PI / 2); f(); x.restore(); };
    const txt = (t: string, lx: number, ly: number) => up(lx, ly, () => x.fillText(t, 0, 0));
    const g = x.createLinearGradient(0, 0, LW, 0); g.addColorStop(0, cfg.floor[0]); g.addColorStop(1, cfg.floor[1]);
    x.fillStyle = g; x.fillRect(0, 0, LW, LH);
    x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, LH / 2 - 44, LW, 88);
    x.fillStyle = '#1b1035'; x.textAlign = 'center'; x.font = `900 ${14 * F}px system-ui`;
    txt(`${cfg.source.icon} ${cfg.source.name}`, 50, 40);
    cfg.stages.forEach((stg, i) => {
      const l = st.st[stg.key], cx = stageX(i), on = l.n > 0, locked = st.served < stg.unlock, isSel = selRef.current === stg.key;
      x.fillStyle = isSel ? 'rgba(255,210,63,.35)' : on ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.35)';
      x.strokeStyle = isSel ? '#ffb400' : on ? stg.color : '#9aa7b3'; x.lineWidth = isSel ? 3 : 2; if (!on) x.setLineDash([6, 5]);
      x.beginPath(); x.roundRect?.(cx - 40, 50, 90, LH - 100, 14); x.fill(); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#1b1035'; x.font = `900 ${13 * F}px system-ui`; txt(`${stg.icon} ${stg.name}`, cx + 5, 40);
      if (!on) { x.font = `800 ${12 * F}px system-ui`; x.fillStyle = locked ? '#7d8a96' : '#00a35c'; txt(locked ? `🔒 ${stg.unlock} ${cfg.unitLabel}` : `+ ${short(costAdd(stg.base, l))}`, cx + 5, LH / 2); return; }
      for (let u = 0; u < l.n; u++) {
        const uy = unitY(u, l.n);
        x.fillStyle = stg.color; x.beginPath(); x.roundRect?.(cx + 13 - 17 * F, uy - 16 * F, 34 * F, 32 * F, 8); x.fill();
        x.font = `${18 * F}px system-ui`; txt(stg.icon, cx + 13, uy + 7);
      }
      x.font = `800 ${11 * F}px system-ui`; x.fillStyle = '#3a4a5a';
      txt(`×${l.n} · ⚡${l.spd} (${svcOf(stg, l).toFixed(1)}s) · 💰${l.inc}`, cx + 5, LH - 60);
    });
    x.fillStyle = '#1b1035'; x.font = `900 ${14 * F}px system-ui`; txt('🏁', LW - 30, 40);
    for (const e of m.ents) {
      up(e.x, e.y, () => {
        x.scale(F * 0.9, F * 0.9);
        x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(0, 7, 6, 2, 0, 0, Math.PI * 2); x.fill();
        if (cfg.entity === 'person') {
          x.fillStyle = e.color; x.beginPath(); x.ellipse(0, 1.5, 4.5, 5.5, 0, 0, Math.PI * 2); x.fill();
          x.fillStyle = '#ffd9b3'; x.beginPath(); x.arc(0, -5.5, 3.3, 0, Math.PI * 2); x.fill();
        } else {
          x.fillStyle = '#c0c8d0'; x.fillRect(-6, -6, 12, 12); x.fillStyle = e.color; x.fillRect(-6, -2, 12, 3); x.fillStyle = '#7d8a96'; x.fillRect(-2, -9, 4, 3);
        }
        if (e.st === 'svc' && !e.path.length && e.tt > 0) {
          x.lineWidth = 2.5; x.strokeStyle = 'rgba(27,16,53,.25)'; x.beginPath(); x.arc(0, -16, 5, 0, Math.PI * 2); x.stroke();
          x.strokeStyle = '#00c97a'; x.beginPath(); x.arc(0, -16, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - e.t / e.tt)); x.stroke();
        }
      });
    }
    for (const p of m.pops) {
      x.globalAlpha = 1 - p.t / 1.6; x.font = `900 ${12 * F}px system-ui`; x.fillStyle = p.bad ? '#e5304f' : '#00a35c';
      txt(p.text, p.x, p.y - p.t * 26); x.globalAlpha = 1;
    }
  }

  useEffect(() => {
    if (!started) return;
    const el = box.current!, c = cv.current!, x = c.getContext('2d')!;
    const fit = () => {
      const r = el.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      c.width = r.width * dpr; c.height = r.height * dpr; c.style.width = `${r.width}px`; c.style.height = `${r.height}px`;
      const rot = r.height > r.width * 1.1, cw = rot ? LH : LW, ch = rot ? LW : LH;
      const k = Math.min(r.width / cw, r.height / ch);
      view.current = { w: r.width, h: r.height, k, ox: (r.width - cw * k) / 2, oy: (r.height - ch * k) / 2, rot };
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    let raf = 0, last = performance.now(), ui = 0, sv = 0, mt = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      for (let i = 0; i < speedRef.current; i++) step(ref.current, sim.current, dt);
      render(x, ref.current, sim.current);
      ui += dt; sv += dt; mt += dt;
      if (ui > 0.25) { ui = 0; force((n) => n + 1); }
      if (mt > 30) { mt = 0; ref.current.perMin = sim.current.income.reduce((a, b) => a + b, 0) * 2; sim.current.income = []; }
      if (sv > 5) { sv = 0; store(ref.current); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); store(ref.current); };
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect(), v = view.current;
    const sx = (e.clientX - r.left - v.ox) / v.k, sy = (e.clientY - r.top - v.oy) / v.k;
    const lx = v.rot ? sy : sx;
    if (lx < 110) { setSel('source'); sfx.tap(); return; }
    const i = cfg.stages.findIndex((_, k) => Math.abs(lx - (stageX(k) + 5)) < 50);
    setSel(i >= 0 ? cfg.stages[i].key : null); if (i >= 0) sfx.tap();
  };
  const buy = (key: string, w: 'add' | 'spd' | 'inc') => {
    const st = ref.current, stg = all.find((a) => a.key === key)!, l = st.st[key];
    const cost = w === 'add' ? costAdd(stg.base, l) : w === 'spd' ? costSpd(stg.base, l) : costInc(stg.base, l);
    if (st.cash < cost || (w === 'add' && l.n >= stg.maxN) || (w !== 'add' && (l.n === 0 || l[w] >= 10)) || st.served < stg.unlock) { sfx.captured(); return; }
    st.cash -= cost; if (w === 'add') l.n++; else l[w]++;
    store(st); setS({ ...st }); sfx.win();
  };
  const leave = () => {
    store(ref.current);
    if (ref.current.served > 0) { const p0 = recordGame(loadProfile(), 0, 1, 0).profile; saveProfile(recordProgress(p0, cfg.slug, 0, 1, {}).profile); }
    location.href = import.meta.env.BASE_URL;
  };
  const level = cfg.levels.reduce((n, [p, name]) => (s.served >= p ? name : n), cfg.levels[0][1]);

  if (!started) return (
    <div className="screen home ha-home">
      <Backdrop />
      <div className="topbar"><a className="btn ghost sm" href={import.meta.env.BASE_URL}>← All games</a></div>
      <header className="rr-hero">
        <div className="rr-logo" style={{ background: cfg.accent }}>{cfg.logo}</div>
        <small>{cfg.tag}</small>
        <h1>{cfg.name}</h1>
      </header>
      {away && <div className="banner ok">{away}</div>}
      <section className="card rr-how">{cfg.intro.map((i) => <div key={i.text}><span>{i.icon}</span><p>{i.text}</p></div>)}</section>
      <section className="card ha-save"><b>{level}</b><small>{fmt(s.cash)} · ⭐{s.rating.toFixed(1)} · {s.served.toLocaleString('en-IN')} {cfg.unitLabel}</small></section>
      <section className="actions">
        <button className="btn primary big" onClick={() => { sfx.turn(); setStarted(true); }}><span className="ic">▶</span> {s.served ? 'Continue' : 'Start'}</button>
        {s.served > 0 && <button className="btn ghost" onClick={() => { if (confirm('Start over from scratch?')) { const n = fresh(); ref.current = n; setS(n); store(n); } }}>Start over</button>}
      </section>
    </div>
  );

  const st = ref.current, cur = sel ? all.find((a) => a.key === sel) : null, l = sel ? st.st[sel] : null;
  const opts: ('add' | 'spd' | 'inc')[] = sel === 'source' ? ['spd'] : ['add', 'spd', 'inc'];
  return (
    <div className="screen ha2 flow-game">
      <div className="ha2-hud">
        <button className="btn ghost sm" onClick={leave}>✕</button>
        <b className="cash">{fmt(st.cash)}</b>
        <span className="rate">⭐{st.rating.toFixed(1)}</span>
        <span className="pax">{cfg.source.icon} {st.served.toLocaleString('en-IN')}</span>
        <div className="seg ha-speed">{[1, 2, 4].map((v) => <button key={v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>{v}×</button>)}</div>
        <button className="btn ghost sm" onClick={() => { setMuted(!muted); setMute(!muted); }}>{muted ? '🔇' : '🔊'}</button>
      </div>
      <div className="ha2-sub"><span>{level}</span></div>
      <div className="ha2-stage" ref={box}>
        <canvas ref={cv} onPointerDown={tap} />
        {!sel && <div className="ha2-hint">👆 Tap a stage to upgrade it</div>}
      </div>
      {cur && l && (
        <div className="ha2-panel">
          <div className="row-between"><b>{cur.icon} {cur.name}</b><button className="btn ghost xs" onClick={() => setSel(null)}>✕</button></div>
          <small className="dim">{cur.text}</small>
          {st.served < cur.unlock ? <div className="ha2-lock">🔒 Unlocks at {cur.unlock} {cfg.unitLabel}</div> : (
            <div className="ha2-opts" style={{ gridTemplateColumns: `repeat(${opts.length}, 1fr)` }}>
              {opts.map((w) => {
                const cost = w === 'add' ? costAdd(cur.base, l) : w === 'spd' ? costSpd(cur.base, l) : costInc(cur.base, l);
                const maxed = w === 'add' ? l.n >= cur.maxN : l[w] >= 10, off = maxed || (w !== 'add' && l.n === 0) || st.cash < cost;
                const label = w === 'add' ? (l.n ? cur.add : `Open ${cur.name}`) : w === 'spd' ? cur.spd : cur.inc;
                const eff = sel === 'source' ? 'more arrive every minute' : w === 'add' ? `${l.n}/${cur.maxN}` : w === 'spd' ? `${svcOf(cur, l).toFixed(1)}s → ${svcOf(cur, { ...l, spd: l.spd + 1 }).toFixed(1)}s` : `${fmt(feeOf(cur, l))} → ${fmt(feeOf(cur, { ...l, inc: l.inc + 1 }))}`;
                return (
                  <button key={w} className={`ha2-opt ${w}`} disabled={off} onClick={() => buy(sel!, w)}>
                    <span className="ic">{w === 'add' ? '➕' : w === 'spd' ? '⚡' : '💰'}</span><b>{label}</b><small>{w !== 'add' ? `Lv ${l[w]}/10 · ` : ''}{eff}</small><em>{maxed ? 'MAX' : fmt(cost)}</em>
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
