import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../game/sound';
import { GameShell, type GameProps, type ShellConfig } from '../../shared/GameShell';
import { Banner, Chips, Clock, Hero } from '../common';
import { ccRules, DRAW_SECS, drawerOf, hint, type CAction, type CGame, type CLine } from './rules';

const INKS = ['#1b1035', '#e5304f', '#2f7bff', '#00a35c', '#ffb400', '#8a5a2b', '#ff6fb1', '#ffffff'];

function ChitraBoard(p: GameProps<CGame, CAction>) {
  const { game: g, me, act } = p;
  const drawer = drawerOf(g), drawing = drawer === me && g.phase === 'draw', over = g.turns >= g.total;
  const botDraws = g.bots.includes(drawer);
  const cv = useRef<HTMLCanvasElement>(null);
  const live = useRef<CLine | null>(null);
  const lastSend = useRef(0);
  const [ink, setInk] = useState(INKS[0]);
  const [size, setSize] = useState(6);
  const [text, setText] = useState('');
  const seq = useRef(g.seq), feedN = useRef(0);

  useEffect(() => {
    if (g.seq !== seq.current) { seq.current = g.seq; if (g.phase === 'reveal') sfx.win(); else sfx.turn(); }
  }, [g.seq, g.phase]);
  useEffect(() => { const okNow = g.feed.filter((f) => f.ok).length; if (okNow > feedN.current) sfx.pop(); feedN.current = okNow; }, [g.feed]);

  const paint = () => {
    const c = cv.current; if (!c) return;
    const r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
    const x = c.getContext('2d')!; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    const sx = c.width / 1000, sy = c.height / 800;
    const all = live.current && !g.lines.some((l) => l.id === live.current!.id && l.pts.length >= live.current!.pts.length) ? [...g.lines.filter((l) => l.id !== live.current!.id), live.current] : g.lines;
    for (const l of all) {
      x.strokeStyle = l.c; x.lineWidth = l.w * sx; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath();
      for (let i = 0; i < l.pts.length; i += 2) { const px = l.pts[i] * sx, py = l.pts[i + 1] * sy; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
      if (l.pts.length === 2) x.lineTo(l.pts[0] * sx + 0.1, l.pts[1] * sy);
      x.stroke();
    }
  };
  useEffect(paint);
  useEffect(() => { const ro = new ResizeObserver(paint); if (cv.current) ro.observe(cv.current); return () => ro.disconnect(); });

  const at = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 800)]; };
  const send = (force = false) => { const l = live.current; if (!l) return; const now = Date.now(); if (force || now - lastSend.current > 220) { lastSend.current = now; act({ t: 'line', ...l, pts: [...l.pts] }); } };
  const down = (e: React.PointerEvent) => { if (!drawing) return; (e.target as Element).setPointerCapture(e.pointerId); live.current = { id: `${Date.now() % 1e9}`, c: ink, w: size, pts: at(e) }; paint(); };
  const move = (e: React.PointerEvent) => { const l = live.current; if (!l || !drawing) return; const [x, y] = at(e); const n = l.pts.length; if (Math.abs(l.pts[n - 2] - x) + Math.abs(l.pts[n - 1] - y) < 6) return; l.pts.push(x, y); paint(); send(); };
  const up = () => { if (live.current) { send(true); live.current = null; } };

  const blur = botDraws && g.phase === 'draw' ? Math.max(0, (g.clock / DRAW_SECS) * 26 - 2) : 0;
  return (
    <div className="party">
      <Chips p={p} active={(id) => id === drawer} extra={(id) => <><b>{g.score[id]}</b><span>{id === drawer ? '✏️ drawing' : g.guessed[id] != null ? `✅ +${g.guessed[id]}` : ''}</span></>} />
      <div className="party-row">
        <Banner tone={g.phase === 'reveal' ? 'good' : 'info'}>
          {over ? 'Game over!' : g.phase === 'reveal' ? <>It was <b>{g.word}</b> {g.emoji}</> : drawing ? <>Draw: <b>{g.word}</b> {g.emoji}</> : <span className="cc-hint">{hint(g)}</span>}
          <small>{g.phase === 'draw' ? (drawing ? 'No letters or numbers!' : `${g.names[drawer]} is drawing · turn ${g.turns + 1}/${g.total}`) : 'Next artist coming up…'}</small>
        </Banner>
        {g.phase === 'draw' && <Clock s={g.clock} of={DRAW_SECS} />}
      </div>
      <div className="party-fill">
        <canvas ref={cv} className="cc-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ cursor: drawing ? 'crosshair' : 'default' }} />
        {botDraws && (g.phase === 'draw' || g.phase === 'reveal') && <div className="cc-emoji" style={{ filter: `blur(${blur}px)` }}>{g.emoji}</div>}
        <div className="cc-feed">{g.feed.map((f) => <span key={f.id} className={f.ok ? 'ok' : ''}><b>{g.names[f.pid]}:</b> {f.text}</span>)}</div>
      </div>
      <div className="party-dock">
        {drawing ? (
          <div className="cc-tools">
            {INKS.map((c) => <button key={c} className={ink === c ? 'on' : ''} style={{ background: c, boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #999' : undefined }} onClick={() => setInk(c)} aria-label={c === '#ffffff' ? 'Eraser' : 'Ink'} />)}
            <button className="txt" onClick={() => setSize((s) => (s === 6 ? 14 : s === 14 ? 28 : 6))}>{size === 6 ? '✏️ Thin' : size === 14 ? '🖍️ Thick' : '🖌️ Fat'}</button>
            <button className="txt" onClick={() => act({ t: 'undo' })}>↩️ Undo</button>
            <button className="txt" onClick={() => act({ t: 'clear' })}>🗑️</button>
          </div>
        ) : g.phase === 'draw' && g.guessed[me] == null && !over ? (
          <form className="party-row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { act({ t: 'guess', text }); setText(''); } }}>
            <input className="p-input" value={text} maxLength={30} placeholder="Type your guess…" onChange={(e) => setText(e.target.value)} />
            <button className="btn primary">Guess</button>
          </form>
        ) : g.guessed[me] != null && g.phase === 'draw' ? <Banner tone="good">You got it! +{g.guessed[me]}</Banner> : null}
      </div>
    </div>
  );
}

const cfg: ShellConfig<CGame, CAction> = {
  slug: 'chitrachor', name: 'Chitra Chor', kind: 'Draw & guess', prefix: 'chitrachor-v1-',
  tagline: 'One draws, everyone guesses. The faster you guess, the more you score.',
  rules: ccRules, Board: ChitraBoard,
  hero: <Hero emoji="🎨" a="#ff6fb1" b="#ffd23f"><path d="M18 80 Q40 50 60 70 T88 40" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" /></Hero>,
  options: [{ key: 'laps', label: 'Turns each', initial: '', choices: [{ value: '', label: 'Auto' }, { value: '1', label: '1 each' }, { value: '2', label: '2 each' }, { value: '3', label: '3 each' }] }],
  progress: (g, pid) => ({ stats: { cc_points: g.score[pid] ?? 0 } }),
};
export default function ChitraApp() { return <GameShell cfg={cfg} />; }
