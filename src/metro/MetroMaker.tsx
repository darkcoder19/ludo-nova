// Metro Maker: new stations pop up across the city. Pick a line, tap stations to extend it, and trains carry
// passengers to a station of the kind they want (office, college, market, temple). Overcrowded stations end the run.
import { useEffect, useRef, useState } from 'react';
import { Backdrop } from '../components/Home';
import { loadProfile, recordGame, saveProfile } from '../game/profile';
import { recordProgress } from '../game/progress';
import { isMuted, setMuted, sfx } from '../game/sound';
import '../atc/atc.css';
import '../tycoon/tycoon.css';
import '../rail/rail.css';

type Diff = 'easy' | 'medium' | 'hard';
export const MDIFFS: Record<Diff, { name: string; emoji: string; spawn: number; newStn: number; text: string }> = {
  easy: { name: 'Easy', emoji: '🟢', spawn: 2.6, newStn: 22, text: 'Calm city, slow growth' },
  medium: { name: 'Medium', emoji: '🟡', spawn: 1.8, newStn: 17, text: 'Busy city' },
  hard: { name: 'Hard', emoji: '🔴', spawn: 1.3, newStn: 13, text: 'Mega city rush' },
};
const KINDS = ['🏢', '🎓', '🛒', '🛕'];
const LINE_COLORS = ['#e5304f', '#2f7bff', '#00a35c', '#ffb400', '#7d5cff', '#ff6fb1'];
const LINE_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Pink'];
const CAP = 8, OVER = 22, TRAIN_CAP = 6;
interface Stn { id: number; x: number; y: number; kind: number; wait: number[]; over: number }
interface Train { line: number; pos: number; dir: 1 | -1; load: number[]; dwell: number }
export interface MWorld { t: number; stns: Stn[]; lines: number[][]; trains: Train[]; maxLines: number; spareTrains: number; delivered: number; spawnIn: number; stnIn: number; week: number; pick: boolean; over: boolean; rush: number; rain: number; seq: number; pops: { x: number; y: number; t: number }[] }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
function addStation(w: MWorld, kind?: number) {
  for (let tries = 0; tries < 60; tries++) {
    const x = rnd(0.08, 0.92), y = rnd(0.1, 0.9);
    if (w.stns.every((s) => Math.hypot(s.x - x, (s.y - y) * 0.7) > 0.14)) { w.stns.push({ id: w.seq++, x, y, kind: kind ?? Math.floor(Math.random() * KINDS.length), wait: [], over: 0 }); return; }
  }
}
export function newWorld(): MWorld {
  const w: MWorld = { t: 0, stns: [], lines: [[]], trains: [], maxLines: 3, spareTrains: 0, delivered: 0, spawnIn: 2, stnIn: 15, week: 60, pick: false, over: false, rush: 0, rain: 0, seq: 1, pops: [] };
  addStation(w, 0); addStation(w, 1); addStation(w, 2);
  return w;
}
/** Extend a line with a station: from either end, never twice. Returns false if not allowed. */
export function extend(w: MWorld, line: number, id: number) {
  while (w.lines.length <= line) w.lines.push([]);
  const L = w.lines[line];
  if (L.includes(id)) return false;
  if (L.length === 0) { L.push(id); return true; }
  const a = w.stns.find((s) => s.id === L[0])!, b = w.stns.find((s) => s.id === L[L.length - 1])!, s = w.stns.find((x) => x.id === id)!;
  if (Math.hypot(a.x - s.x, a.y - s.y) < Math.hypot(b.x - s.x, b.y - s.y) && L.length > 1) L.unshift(id); else L.push(id);
  if (L.length === 2 && !w.trains.some((t) => t.line === line)) w.trains.push({ line, pos: 0, dir: 1, load: [], dwell: 0 });
  return true;
}
const kindsOn = (w: MWorld, line: number) => new Set(w.lines[line].map((id) => w.stns.find((s) => s.id === id)!.kind));
export function stepMetro(w: MWorld, d: Diff, dt: number) {
  if (w.over || w.pick) return;
  const D = MDIFFS[d];
  w.t += dt; w.spawnIn -= dt; w.stnIn -= dt; w.week -= dt;
  w.rush = Math.max(0, w.rush - dt); w.rain = Math.max(0, w.rain - dt);
  if (w.week <= 0) { w.week = 60; w.pick = true; if (Math.random() < 0.5) w.rush = 20; else w.rain = 20; return; }
  if (w.stnIn <= 0) { w.stnIn = D.newStn; addStation(w); }
  if (w.spawnIn <= 0) {
    w.spawnIn = (D.spawn / (w.rush ? 2 : 1)) * rnd(0.6, 1.4) * Math.max(0.5, 1 - w.t / 900);
    const s = w.stns[Math.floor(Math.random() * w.stns.length)];
    const wants = [...new Set(w.stns.map((x) => x.kind))].filter((k) => k !== s.kind);
    if (wants.length) s.wait.push(wants[Math.floor(Math.random() * wants.length)]);
  }
  for (const s of w.stns) {
    if (s.wait.length > CAP) { s.over += dt; if (s.over > OVER) w.over = true; } else s.over = Math.max(0, s.over - dt * 2);
  }
  const speed = (w.rain ? 0.55 : 1) * 0.9;
  for (const tr of w.trains) {
    const L = w.lines[tr.line]; if (L.length < 2) continue;
    if (tr.dwell > 0) { tr.dwell -= dt; continue; }
    const i = Math.floor(tr.pos), j = Math.min(L.length - 1, i + 1);
    const a = w.stns.find((s) => s.id === L[i])!, b = w.stns.find((s) => s.id === L[j])!;
    const segLen = Math.max(0.05, Math.hypot(a.x - b.x, a.y - b.y));
    const before = tr.pos;
    tr.pos += (tr.dir * speed * 0.18 * dt) / segLen;
    const crossed = tr.dir > 0 ? Math.floor(tr.pos) > Math.floor(before) || tr.pos >= L.length - 1 : Math.ceil(tr.pos) < Math.ceil(before) || tr.pos <= 0;
    if (!crossed) continue;
    tr.pos = Math.max(0, Math.min(L.length - 1, Math.round(tr.pos)));
    if (tr.pos === L.length - 1) tr.dir = -1; else if (tr.pos === 0) tr.dir = 1;
    // stop: drop off, then pick up anyone this line can take where they want
    const s = w.stns.find((x) => x.id === L[tr.pos])!;
    const before2 = tr.load.length;
    tr.load = tr.load.filter((k) => k !== s.kind);
    const off = before2 - tr.load.length;
    if (off) { w.delivered += off; w.pops.push({ x: s.x, y: s.y, t: 0 }); sfx.tap(); }
    const kinds = kindsOn(w, tr.line);
    const keep: number[] = [];
    for (const k of s.wait) { if (tr.load.length < TRAIN_CAP && kinds.has(k)) tr.load.push(k); else keep.push(k); }
    const on = s.wait.length - keep.length;
    s.wait = keep;
    if (off || on) tr.dwell = 0.35;
  }
  for (const p of w.pops) p.t += dt;
  w.pops = w.pops.filter((p) => p.t < 1);
}

export default function MetroMaker() {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [run, setRun] = useState(0);
  const [line, setLine] = useState(0);
  const [muted, setMute] = useState(isMuted());
  const [, force] = useState(0);
  const w = useRef<MWorld>(newWorld());
  const cv = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null);
  const view = useRef({ w: 300, h: 300 });
  const lineRef = useRef(line); lineRef.current = line;
  const best = (d: Diff) => { try { return +(localStorage.getItem(`metromaker-${d}`) || 0); } catch { return 0; } };
  const map = (x: number, y: number) => ({ X: x * view.current.w, Y: y * view.current.h });

  useEffect(() => {
    if (!diff) return;
    (window as unknown as { __metro: unknown }).__metro = w;
    const el = box.current!, c = cv.current!, x = c.getContext('2d')!;
    const fit = () => { const r = el.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); c.width = r.width * dpr; c.height = r.height * dpr; c.style.width = `${r.width}px`; c.style.height = `${r.height}px`; view.current = { w: r.width, h: r.height }; };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el);
    let raf = 0, last = performance.now(), ui = 0, ended = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      stepMetro(w.current, diff, dt); draw(x); ui += dt;
      if (ui > 0.2) { ui = 0; force((n) => n + 1); }
      if (w.current.over && !ended) {
        ended = true; sfx.captured();
        try { if (w.current.delivered > best(diff)) localStorage.setItem(`metromaker-${diff}`, String(w.current.delivered)); } catch { /* private mode */ }
        const p0 = recordGame(loadProfile(), 0, 1, 0).profile;
        saveProfile(recordProgress(p0, 'metromaker', 0, 1, {}).profile);
        force((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [diff, run]); // eslint-disable-line react-hooks/exhaustive-deps

  function draw(x: CanvasRenderingContext2D) {
    const v = view.current, dpr = Math.min(2, devicePixelRatio || 1), W = w.current, u = Math.min(v.w, v.h) / 32;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = W.rain ? '#cfd8dc' : '#f4ecdf'; x.fillRect(0, 0, v.w, v.h);
    // the river, the sea and a few city blocks
    x.fillStyle = '#9fd3f0'; x.beginPath(); x.moveTo(0, v.h * 0.62); x.bezierCurveTo(v.w * 0.3, v.h * 0.5, v.w * 0.6, v.h * 0.8, v.w, v.h * 0.66); x.lineTo(v.w, v.h * 0.72); x.bezierCurveTo(v.w * 0.6, v.h * 0.86, v.w * 0.3, v.h * 0.56, 0, v.h * 0.68); x.fill();
    x.fillStyle = 'rgba(27,16,53,.04)'; for (let i = 0; i < 24; i++) x.fillRect((i * 137) % v.w, (i * 71) % v.h, u * 3, u * 2);
    // lines
    W.lines.forEach((L, li) => {
      if (L.length < 2) return;
      x.strokeStyle = LINE_COLORS[li]; x.lineWidth = u * 0.55; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); L.forEach((id, k) => { const s = W.stns.find((q) => q.id === id)!, p = map(s.x, s.y); if (k) x.lineTo(p.X, p.Y); else x.moveTo(p.X, p.Y); }); x.stroke();
    });
    // trains
    for (const tr of W.trains) {
      const L = W.lines[tr.line]; if (L.length < 2) continue;
      const i = Math.min(L.length - 2, Math.floor(tr.pos)), f = tr.pos - i;
      const a = W.stns.find((s) => s.id === L[i])!, b = W.stns.find((s) => s.id === L[i + 1])!, pa = map(a.x, a.y), pb = map(b.x, b.y);
      x.save(); x.translate(pa.X + (pb.X - pa.X) * f, pa.Y + (pb.Y - pa.Y) * f); x.rotate(Math.atan2(pb.Y - pa.Y, pb.X - pa.X));
      x.fillStyle = LINE_COLORS[tr.line]; x.strokeStyle = '#1b1035'; x.lineWidth = 1.5;
      x.beginPath(); x.roundRect?.(-u * 1.3, -u * 0.6, u * 2.6, u * 1.2, u * 0.3); x.fill(); x.stroke();
      x.fillStyle = '#fff'; for (let k = 0; k < tr.load.length; k++) x.fillRect(-u * 1.1 + k * u * 0.37, -u * 0.25, u * 0.28, u * 0.5);
      x.restore();
    }
    // stations
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const sel = W.lines[lineRef.current] ?? [];
    for (const s of W.stns) {
      const p = map(s.x, s.y), r = u * 1.15;
      if (s.over > 0) { x.strokeStyle = '#e5304f'; x.lineWidth = u * 0.35; x.beginPath(); x.arc(p.X, p.Y, r + u * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (s.over / OVER)); x.stroke(); }
      x.fillStyle = '#fff'; x.strokeStyle = sel.includes(s.id) ? LINE_COLORS[lineRef.current] : '#1b1035'; x.lineWidth = u * 0.3;
      x.beginPath(); x.arc(p.X, p.Y, r, 0, Math.PI * 2); x.fill(); x.stroke();
      x.font = `${u * 1.2}px system-ui`; x.fillText(KINDS[s.kind], p.X, p.Y + u * 0.08);
      x.font = `${u * 0.7}px system-ui`;
      s.wait.slice(0, 12).forEach((k, i) => x.fillText(KINDS[k], p.X + r + u * 0.5 + (i % 6) * u * 0.75, p.Y - u * 0.4 + Math.floor(i / 6) * u * 0.8));
    }
    for (const p of W.pops) { const q = map(p.x, p.y); x.globalAlpha = 1 - p.t; x.font = `900 ${u}px system-ui`; x.fillStyle = '#00a35c'; x.fillText('✓', q.X, q.Y - u * 2 - p.t * u * 2); x.globalAlpha = 1; }
    if (W.rain) { x.strokeStyle = 'rgba(47,123,255,.35)'; x.lineWidth = 1; const o = (W.t * 300) % 40; for (let i = 0; i < 70; i++) { const rx = (i * 61) % v.w, ry = ((i * 37) % v.h + o * 3) % v.h; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 4, ry + 12); x.stroke(); } }
  }

  const tap = (e: React.PointerEvent) => {
    const W = w.current; if (!diff || W.over || W.pick) return;
    const r = cv.current!.getBoundingClientRect(), X = e.clientX - r.left, Y = e.clientY - r.top, u = Math.min(view.current.w, view.current.h) / 32;
    const s = W.stns.find((q) => { const p = map(q.x, q.y); return Math.hypot(p.X - X, p.Y - Y) < u * 2.4; });
    if (!s) return;
    if (extend(W, line, s.id)) sfx.tap(); else sfx.captured();
    force((n) => n + 1);
  };
  const start = (d: Diff) => { w.current = newWorld(); setLine(0); sfx.turn(); setDiff(d); setRun((n) => n + 1); };
  const reward = (k: 'line' | 'train') => {
    const W = w.current;
    if (k === 'line') { W.maxLines = Math.min(LINE_COLORS.length, W.maxLines + 1); }
    else { const li = W.lines.findIndex((L) => L.length >= 2); if (li >= 0) W.trains.push({ line: lineRef.current < W.lines.length && W.lines[lineRef.current].length >= 2 ? lineRef.current : li, pos: 0, dir: 1, load: [], dwell: 0 }); }
    W.pick = false; sfx.win(); force((n) => n + 1);
  };

  if (!diff) return (
    <div className="screen home ha-home">
      <Backdrop />
      <div className="topbar"><a className="btn ghost sm" href={import.meta.env.BASE_URL}>← All games</a><button className="btn ghost sm" onClick={() => { setMuted(!muted); setMute(!muted); }}>{muted ? '🔇' : '🔊'}</button></div>
      <header className="rr-hero"><div className="rr-logo" style={{ background: 'linear-gradient(135deg,#2f7bff,#00c97a)' }}>🚇</div><small>Build the city's metro</small><h1>Metro Maker</h1></header>
      <section className="card rr-how">
        <div><span>👆</span><p>Pick a line colour, then tap stations one by one to extend it. Trains start on their own.</p></div>
        <div><span>🏢</span><p>People wait for a kind of place: 🏢 office, 🎓 college, 🛒 market, 🛕 temple. A line takes them if it reaches one.</p></div>
        <div><span>⛈️</span><p>Rush hour and monsoon hit every week. A station with more than {CAP} waiting for too long closes the metro.</p></div>
      </section>
      <section className="rr-levels">
        {(Object.keys(MDIFFS) as Diff[]).map((d) => (
          <button key={d} className={`rr-level ${d}`} onClick={() => start(d)}>
            <b>{MDIFFS[d].emoji} {MDIFFS[d].name}</b><small>{MDIFFS[d].text}</small>{best(d) > 0 && <small>Best {best(d)}</small>}
          </button>
        ))}
      </section>
    </div>
  );
  const W = w.current, D = MDIFFS[diff];
  return (
    <div className="screen ha2 metro-game">
      <div className="ha2-hud">
        <button className="btn ghost sm" onClick={() => setDiff(null)}>✕</button>
        <b className="cash">🧍 {W.delivered}</b>
        <span className="rate">{W.rush ? '⏰ Rush hour' : W.rain ? '⛈️ Monsoon' : `📅 ${Math.ceil(W.week)}s`}</span>
        <span className="pax">{D.emoji} {D.name}</span>
      </div>
      <div className="metro-lines">
        {Array.from({ length: W.maxLines }, (_, i) => (
          <button key={i} className={line === i ? 'on' : ''} style={{ background: LINE_COLORS[i] }} onClick={() => { setLine(i); sfx.tap(); }}>{LINE_NAMES[i]} {(W.lines[i]?.length ?? 0) || ''}</button>
        ))}
        <small>👆 Tap stations</small>
      </div>
      <div className="metro-stage" ref={box}><canvas ref={cv} onPointerDown={tap} /></div>
      {W.pick && !W.over && (
        <div className="metro-pick"><div className="card">
          <h2>📅 New week!</h2><p>{W.rush ? '⏰ Rush hour is coming: twice the passengers.' : '⛈️ Monsoon is coming: trains run slower.'} Pick a reward.</p>
          <div className="opts"><button className="btn primary" disabled={W.maxLines >= LINE_COLORS.length} onClick={() => reward('line')}>🛤️ New line</button><button className="btn primary" onClick={() => reward('train')}>🚇 Extra train</button></div>
        </div></div>
      )}
      {W.over && (
        <div className="rail-over"><div className="card">
          <h2>🚧 Station overcrowded!</h2><p>Your metro carried {W.delivered} passengers.</p>
          <div className="row-between"><button className="btn ghost" onClick={() => setDiff(null)}>Levels</button><button className="btn primary" onClick={() => start(diff)}>Play again</button></div>
        </div></div>
      )}
    </div>
  );
}
