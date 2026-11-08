// Railway Raja: trains roll into a junction; tap the switches so each train reaches the station of its colour.
import { useEffect, useRef, useState } from 'react';
import { Backdrop } from '../components/Home';
import { loadProfile, recordGame, saveProfile } from '../game/profile';
import { recordProgress } from '../game/progress';
import { isMuted, setMuted, sfx } from '../game/sound';
import '../atc/atc.css';
import '../tycoon/tycoon.css';
import './rail.css';

type Diff = 'easy' | 'medium' | 'hard';
export const RDIFFS: Record<Diff, { name: string; emoji: string; depth: number; gap: number; speed: number; goal: number; text: string }> = {
  easy: { name: 'Easy', emoji: '🟢', depth: 2, gap: 6.5, speed: 0.1, goal: 15, text: '4 stations, relaxed trains' },
  medium: { name: 'Medium', emoji: '🟡', depth: 2, gap: 4.2, speed: 0.14, goal: 25, text: '4 stations, busy line' },
  hard: { name: 'Hard', emoji: '🔴', depth: 3, gap: 3.8, speed: 0.15, goal: 35, text: '8 stations, rush hour' },
};
const COLORS = ['#e5304f', '#2f7bff', '#00a35c', '#ffb400', '#7d5cff', '#ff6fb1', '#00b8c4', '#8a5a2b'];
const NAMES = ['Dadar', 'Thane', 'Kurla', 'Andheri', 'Borivali', 'Vashi', 'Panvel', 'Colaba'];
interface Node { id: number; x: number; y: number; px: number; py: number }
interface Train { id: number; dest: number; node: number; t: number; done?: boolean }
export interface RWorld { t: number; trains: Train[]; sw: number[]; next: number; seq: number; score: number; lives: number; over: boolean; won: boolean; crash: boolean; flash: { x: number; y: number; ok: boolean; t: number }[] }

// Heap-style tree: node 1 is the first switch, children are 2n and 2n+1; nodes from 2^depth up are stations.
const posX = (lvl: number, depth: number) => 0.14 + (0.78 * lvl) / depth;
export function nodes(depth: number): Node[] {
  const out: Node[] = [];
  for (let id = 1; id < 2 ** (depth + 1); id++) {
    const lvl = Math.floor(Math.log2(id)), pid = id >> 1;
    const y = (id - 2 ** lvl + 0.5) / 2 ** lvl;
    out[id] = { id, x: posX(lvl, depth), y, px: pid ? posX(lvl - 1, depth) : 0, py: pid ? (pid - 2 ** (lvl - 1) + 0.5) / 2 ** (lvl - 1) : 0.5 };
  }
  return out;
}
export function newWorld(d: Diff): RWorld { return { t: 0, trains: [], sw: Array(2 ** RDIFFS[d].depth).fill(0), next: 1.5, seq: 1, score: 0, lives: 3, over: false, won: false, crash: false, flash: [] }; }
export function stepRail(w: RWorld, d: Diff, dt: number) {
  if (w.over) return;
  const D = RDIFFS[d], N = nodes(D.depth), leaves = 2 ** D.depth;
  w.t += dt; w.next -= dt;
  if (w.next <= 0) {
    w.next = D.gap * (0.8 + Math.random() * 0.4) * Math.max(0.65, 1 - w.score * 0.01);
    w.trains.push({ id: w.seq++, dest: Math.floor(Math.random() * leaves), node: 1, t: 0 });
  }
  for (const tr of w.trains) {
    const n = N[tr.node], len = Math.hypot(n.x - n.px, (n.y - n.py) * 0.6);
    tr.t += (D.speed * dt) / Math.max(0.05, len);
    if (tr.t < 1) continue;
    if (tr.node >= leaves) {
      tr.done = true;
      const ok = tr.node - leaves === tr.dest;
      w.flash.push({ x: n.x, y: n.y, ok, t: 0 });
      if (ok) { w.score++; sfx.win(); } else { w.lives--; sfx.captured(); }
      continue;
    }
    tr.t = 0; tr.node = tr.node * 2 + w.sw[tr.node];
  }
  w.trains = w.trains.filter((t) => !t.done);
  // Two trains bunched up on one piece of track crash.
  for (const a of w.trains) for (const b of w.trains) if (a.id < b.id && a.node === b.node && Math.abs(a.t - b.t) < 0.05) { w.lives = 0; w.crash = true; w.flash.push({ x: N[a.node].x, y: N[a.node].y, ok: false, t: 0 }); }
  for (const f of w.flash) f.t += dt;
  w.flash = w.flash.filter((f) => f.t < 1.2);
  if (w.lives <= 0) w.over = true;
  if (w.score >= D.goal) { w.over = true; w.won = true; }
}
/** A switch can't be thrown while a train is just leaving it. */
export function canFlip(w: RWorld, id: number) { return !w.trains.some((t) => t.node >> 1 === id && t.t < 0.12); }

export default function RailwayRaja() {
  const [diff, setDiff] = useState<Diff | null>(null);
  const [run, setRun] = useState(0);
  const [muted, setMute] = useState(isMuted());
  const [, force] = useState(0);
  const w = useRef<RWorld>(newWorld('easy'));
  const cv = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null);
  const view = useRef({ w: 300, h: 300, rot: false });
  const best = (d: Diff) => { try { return +(localStorage.getItem(`railwayraja-${d}`) || 0); } catch { return 0; } };
  // Landscape: trains run left to right. Portrait: top to bottom.
  const map = (x: number, y: number) => { const v = view.current; return v.rot ? { X: v.w * 0.06 + (1 - y) * v.w * 0.88, Y: x * v.h } : { X: x * v.w, Y: v.h * 0.06 + y * v.h * 0.88 }; };

  useEffect(() => {
    if (!diff) return;
    (window as unknown as { __rail: unknown }).__rail = w;
    const el = box.current!, c = cv.current!, x = c.getContext('2d')!;
    const fit = () => { const r = el.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); c.width = r.width * dpr; c.height = r.height * dpr; c.style.width = `${r.width}px`; c.style.height = `${r.height}px`; view.current = { w: r.width, h: r.height, rot: r.height > r.width * 1.1 }; };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el);
    let raf = 0, last = performance.now(), ui = 0, ended = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      stepRail(w.current, diff, dt);
      draw(x); ui += dt;
      if (ui > 0.2) { ui = 0; force((n) => n + 1); }
      if (w.current.over && !ended) {
        ended = true;
        try { if (w.current.score > best(diff)) localStorage.setItem(`railwayraja-${diff}`, String(w.current.score)); } catch { /* private mode */ }
        const p0 = recordGame(loadProfile(), w.current.won ? 1 : 0, 1, 0).profile;
        saveProfile(recordProgress(p0, 'railwayraja', w.current.won ? 0 : 1, 2, {}).profile);
        force((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [diff, run]); // eslint-disable-line react-hooks/exhaustive-deps

  function draw(x: CanvasRenderingContext2D) {
    const v = view.current, dpr = Math.min(2, devicePixelRatio || 1), D = RDIFFS[diff!], N = nodes(D.depth), leaves = 2 ** D.depth, W = w.current;
    const u = Math.min(v.w, v.h) / (D.depth === 3 ? 34 : 28);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#86b86f'; x.fillRect(0, 0, v.w, v.h);
    x.fillStyle = 'rgba(40,80,30,.18)'; for (let i = 0; i < 60; i++) { x.beginPath(); x.arc((i * 97.3) % v.w, (i * 53.7) % v.h, 2 + (i % 4), 0, Math.PI * 2); x.fill(); }
    const seg = (n: Node, active: boolean) => {
      const a = map(n.px, n.py), b = map(n.x, n.y), L = Math.hypot(b.X - a.X, b.Y - a.Y), nx = (b.Y - a.Y) / L, ny = -(b.X - a.X) / L;
      x.lineCap = 'round'; x.strokeStyle = '#b3a996'; x.lineWidth = u * 1.6; x.beginPath(); x.moveTo(a.X, a.Y); x.lineTo(b.X, b.Y); x.stroke();
      x.strokeStyle = '#6b4f35'; x.lineWidth = u * 0.26;
      for (let s = u * 0.6; s < L; s += u * 0.85) { const px = a.X + ((b.X - a.X) * s) / L, py = a.Y + ((b.Y - a.Y) * s) / L; x.beginPath(); x.moveTo(px + nx * u * 0.6, py + ny * u * 0.6); x.lineTo(px - nx * u * 0.6, py - ny * u * 0.6); x.stroke(); }
      x.strokeStyle = active ? '#eef3f7' : '#7f8890'; x.lineWidth = u * 0.17;
      for (const o of [0.36, -0.36]) { x.beginPath(); x.moveTo(a.X + nx * u * o, a.Y + ny * u * o); x.lineTo(b.X + nx * u * o, b.Y + ny * u * o); x.stroke(); }
    };
    for (let id = 1; id < N.length; id++) { const p = id >> 1; seg(N[id], !p || W.sw[p] === (id & 1)); }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < leaves; i++) {
      const p = map(N[leaves + i].x, N[leaves + i].y);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.roundRect?.(p.X - u * 2.1, p.Y - u * 1.1, u * 4.4, u * 2.4, u * 0.5); x.fill();
      x.fillStyle = COLORS[i]; x.beginPath(); x.roundRect?.(p.X - u * 2.2, p.Y - u * 1.2, u * 4.4, u * 2.4, u * 0.5); x.fill();
      x.fillStyle = '#fff'; x.font = `900 ${u * 0.8}px system-ui`; x.fillText(NAMES[i], p.X, p.Y);
    }
    for (let id = 1; id < leaves; id++) {
      const p = map(N[id].x, N[id].y), lock = !canFlip(W, id), to = N[id * 2 + W.sw[id]], t = map(to.x, to.y), ang = Math.atan2(t.Y - p.Y, t.X - p.X);
      x.fillStyle = lock ? '#9aa7b3' : '#ffd23f'; x.strokeStyle = '#1b1035'; x.lineWidth = 2.5;
      x.beginPath(); x.arc(p.X, p.Y, u * 1.15, 0, Math.PI * 2); x.fill(); x.stroke();
      x.strokeStyle = '#1b1035'; x.lineWidth = u * 0.32; x.beginPath(); x.moveTo(p.X - Math.cos(ang) * u * 0.5, p.Y - Math.sin(ang) * u * 0.5); x.lineTo(p.X + Math.cos(ang) * u * 0.7, p.Y + Math.sin(ang) * u * 0.7); x.stroke();
    }
    for (const tr of W.trains) {
      const n = N[tr.node], a = map(n.px, n.py), b = map(n.x, n.y), ang = Math.atan2(b.Y - a.Y, b.X - a.X);
      x.save(); x.translate(a.X + (b.X - a.X) * tr.t, a.Y + (b.Y - a.Y) * tr.t); x.rotate(ang);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(-u * 1.3, -u * 0.45, u * 2.9, u * 1.2);
      x.fillStyle = COLORS[tr.dest]; x.beginPath(); x.roundRect?.(-u * 1.5, -u * 0.62, u * 3, u * 1.24, u * 0.45); x.fill();
      x.fillStyle = 'rgba(255,255,255,.85)'; for (const k of [-0.9, -0.2]) x.fillRect(k * u, -u * 0.38, u * 0.5, u * 0.76);
      x.fillStyle = '#1b1035'; x.fillRect(u * 0.65, -u * 0.42, u * 0.5, u * 0.84);
      x.fillStyle = '#ffe066'; x.beginPath(); x.arc(u * 1.5, 0, u * 0.2, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    for (const f of W.flash) { const p = map(f.x, f.y); x.globalAlpha = 1 - f.t / 1.2; x.font = `900 ${u * 1.3}px system-ui`; x.fillStyle = f.ok ? '#fff' : '#e5304f'; x.fillText(f.ok ? '✓ +1' : '✗', p.X, p.Y - u * 1.8 - f.t * u * 2); x.globalAlpha = 1; }
  }

  const tap = (e: React.PointerEvent) => {
    if (!diff) return;
    const r = cv.current!.getBoundingClientRect(), X = e.clientX - r.left, Y = e.clientY - r.top, D = RDIFFS[diff], N = nodes(D.depth);
    const u = Math.min(view.current.w, view.current.h) / 28;
    let id0 = 0, bd = 1e9;
    for (let id = 1; id < 2 ** D.depth; id++) { const p = map(N[id].x, N[id].y), d = Math.hypot(p.X - X, p.Y - Y); if (d < bd) { bd = d; id0 = id; } }
    if (id0 && bd < u * 3.5) { if (canFlip(w.current, id0)) { w.current.sw[id0] ^= 1; sfx.tap(); } else sfx.captured(); }
  };
  const start = (d: Diff) => { w.current = newWorld(d); sfx.turn(); setDiff(d); setRun((n) => n + 1); };

  if (!diff) return (
    <div className="screen home ha-home">
      <Backdrop />
      <div className="topbar"><a className="btn ghost sm" href={import.meta.env.BASE_URL}>← All games</a><button className="btn ghost sm" onClick={() => { setMuted(!muted); setMute(!muted); }}>{muted ? '🔇' : '🔊'}</button></div>
      <header className="rr-hero"><div className="rr-logo" style={{ background: 'linear-gradient(135deg,#e5304f,#ffb400)' }}>🚆</div><small>Junction master</small><h1>Railway Raja</h1></header>
      <section className="card rr-how">
        <div><span>🎨</span><p>Every train is the colour of the station it wants.</p></div>
        <div><span>👆</span><p>Tap a yellow switch to flip its track. Grey means a train is passing.</p></div>
        <div><span>💥</span><p>Wrong station costs a life. Two trains bunched on one track crash.</p></div>
      </section>
      <section className="rr-levels">
        {(Object.keys(RDIFFS) as Diff[]).map((d) => (
          <button key={d} className={`rr-level ${d}`} onClick={() => start(d)}>
            <b>{RDIFFS[d].emoji} {RDIFFS[d].name}</b><small>{RDIFFS[d].text} · goal {RDIFFS[d].goal}</small>{best(d) > 0 && <small>Best {best(d)}</small>}
          </button>
        ))}
      </section>
    </div>
  );
  const W = w.current, D = RDIFFS[diff];
  return (
    <div className="screen ha2 rail-game">
      <div className="ha2-hud">
        <button className="btn ghost sm" onClick={() => setDiff(null)}>✕</button>
        <b className="cash">🚆 {W.score}/{D.goal}</b>
        <span className="rate">{'❤️'.repeat(Math.max(0, W.lives)) || '💔'}</span>
        <span className="pax">{D.emoji} {D.name}</span>
      </div>
      <div className="rail-stage" ref={box}><canvas ref={cv} onPointerDown={tap} /></div>
      {W.over && (
        <div className="rail-over"><div className="card">
          <h2>{W.won ? '🏆 Junction cleared!' : W.crash ? '💥 Trains crashed!' : '🚧 Line closed'}</h2>
          <p>{W.score} trains reached the right station.</p>
          <div className="row-between"><button className="btn ghost" onClick={() => setDiff(null)}>Levels</button><button className="btn primary" onClick={() => start(diff)}>Play again</button></div>
        </div></div>
      )}
    </div>
  );
}
