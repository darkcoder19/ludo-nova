import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Dice } from '../components/Dice';
import { buzz, sfx } from '../game/sound';
import { PlayerChip, type GameProps } from '../shared/GameShell';
import { LADDERS, SNAKES, type SAction, type SGame } from './rules';

type P = [number, number];
/** Square n (1..100) → centre in a 10×10 board, boustrophedon from bottom-left. */
const xy = (n: number): P => {
  const k = Math.max(1, n) - 1;
  const row = Math.floor(k / 10);
  const col = row % 2 === 0 ? k % 10 : 9 - (k % 10);
  return [col + 0.5, 9 - row + 0.5];
};

const SNAKE_COLORS = ['#00c97a', '#ff2d55', '#9b6bff', '#ff8c42', '#2b7bff', '#ffb400', '#ff4fd8', '#2ee5c5', '#e63946', '#7cb518'];

/** Gentle S-curve between head and tail. */
function snakeCurve(head: number, tail: number): [P, P, P, P] {
  const a = xy(head), d = xy(tail);
  const dx = d[0] - a[0], dy = d[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const w = Math.min(1.6, 0.5 + len * 0.18);
  return [a, [a[0] + dx * 0.33 + nx * w, a[1] + dy * 0.33 + ny * w], [a[0] + dx * 0.66 - nx * w, a[1] + dy * 0.66 - ny * w], d];
}
const bez = ([a, b, c, d]: [P, P, P, P], t: number): P => {
  const u = 1 - t;
  return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
};
const pathOf = (c: [P, P, P, P]) => `M${c[0]} C${c[1]} ${c[2]} ${c[3]}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function SeedhiBoard({ room, game, me, color, mood, setMood, confetti, act }: GameProps<SGame, SAction>) {
  // Where each token is drawn right now (board units), animated toward game.pos.
  const [shown, setShown] = useState<Record<string, P>>(() => Object.fromEntries(game.order.map((id) => [id, xy(game.pos[id])])));
  const [sliding, setSliding] = useState<string | null>(null);
  const [fed, setFed] = useState<number | null>(null);
  const [settled, setSettled] = useState(true);
  const lastMove = useRef(game.move?.id ?? 0);

  useEffect(() => {
    const m = game.move;
    if (!m || m.id === lastMove.current) return;
    lastMove.current = m.id;
    let alive = true;
    const put = (p: P) => alive && setShown((s) => ({ ...s, [m.pid]: p }));
    (async () => {
      await sleep(650); // let the dice land
      if (m.kind === 'bounce') { sfx.pop(); return; }
      for (let n = m.from + 1; n <= m.via; n++) { put(xy(n)); sfx.step(); await sleep(190); }
      if (m.kind === 'snake') {
        const curve = snakeCurve(m.via, m.to);
        setFed(m.via); setSliding(m.pid);
        sfx.hiss(); buzz(m.pid === me ? [80, 40, 160] : 40);
        setMood(m.pid, 'sad', 4500);
        for (let i = 1; i <= 14; i++) { put(bez(curve, i / 14)); await sleep(90); }
        setSliding(null);
        setTimeout(() => alive && setFed((f) => (f === m.via ? null : f)), 3500);
      } else if (m.kind === 'ladder') {
        setSliding(m.pid);
        sfx.home(); setMood(m.pid, 'cool', 4000);
        const a = xy(m.via), b = xy(m.to);
        for (let i = 1; i <= 10; i++) { put([a[0] + ((b[0] - a[0]) * i) / 10, a[1] + ((b[1] - a[1]) * i) / 10]); await sleep(90); }
        setSliding(null);
      }
      put(xy(m.to));
      if (m.to === 100) { sfx.win(); confetti(innerWidth / 2, innerHeight * 0.4, [color(m.pid), '#fff', '#ffe08a'], 160); setMood(m.pid, 'cool', 6000); }
    })();
    return () => { alive = false; };
  }, [game.move]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = game.order[game.turn];
  const myTurn = cur === me && game.phase === 'roll' && !game.winner;

  // Tokens on the same spot fan out a little.
  const spots = new Map<string, string[]>();
  game.order.forEach((id) => { const k = shown[id].map((v) => v.toFixed(2)).join(); spots.set(k, [...(spots.get(k) ?? []), id]); });

  return (
    <div className="seedhi">
      <div className="pchips">
        {room.players.map((p) => (
          <PlayerChip key={p.id} name={p.name} avatar={p.avatar} color={color(p.id)} active={cur === p.id && !game.winner} mood={mood(p.id)}>
            <b>{game.pos[p.id] || '—'}</b><span>🐍{game.bites[p.id]} ⬆{game.climbs[p.id]}</span>
          </PlayerChip>
        ))}
      </div>

      <div className="seedhi-wrap">
        <svg className="seedhi-board" viewBox="-0.15 -0.15 10.3 10.3">
          <defs>
            <linearGradient id="rail" x1="0" x2="1"><stop offset="0" stopColor="#c68642" /><stop offset="1" stopColor="#8b5a2b" /></linearGradient>
            <filter id="sh"><feDropShadow dx="0.04" dy="0.08" stdDeviation="0.06" floodOpacity="0.45" /></filter>
          </defs>
          <rect x="-0.15" y="-0.15" width="10.3" height="10.3" rx="0.4" fill="#2a1b6b" />
          {Array.from({ length: 100 }, (_, i) => {
            const n = i + 1, [x, y] = xy(n);
            const tint = ['#ffe8a3', '#ffd6e0', '#cdf5e1', '#d6e6ff', '#efe0ff'][(Math.floor(i / 10) + i) % 5];
            return (
              <g key={n}>
                <rect x={x - 0.48} y={y - 0.48} width="0.96" height="0.96" rx="0.12" fill={n === 100 ? '#ffd23f' : tint} />
                <text x={x - 0.4} y={y - 0.24} className="sq-num">{n}</text>
              </g>
            );
          })}
          <text {...{ x: xy(100)[0], y: xy(100)[1] + 0.2 }} className="sq-crown">👑</text>

          {Object.entries(LADDERS).map(([f, t]) => {
            const a = xy(+f), b = xy(+t);
            const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), nx = (-dy / len) * 0.17, ny = (dx / len) * 0.17;
            const rungs = Math.max(2, Math.round(len * 2.2));
            return (
              <g key={f} filter="url(#sh)" className="ladder">
                <line x1={a[0] + nx} y1={a[1] + ny} x2={b[0] + nx} y2={b[1] + ny} stroke="url(#rail)" strokeWidth="0.09" strokeLinecap="round" />
                <line x1={a[0] - nx} y1={a[1] - ny} x2={b[0] - nx} y2={b[1] - ny} stroke="url(#rail)" strokeWidth="0.09" strokeLinecap="round" />
                {Array.from({ length: rungs }, (_, i) => {
                  const t = (i + 0.5) / rungs, cx = a[0] + dx * t, cy = a[1] + dy * t;
                  return <line key={i} x1={cx + nx} y1={cy + ny} x2={cx - nx} y2={cy - ny} stroke="#a0693a" strokeWidth="0.06" />;
                })}
              </g>
            );
          })}

          {Object.entries(SNAKES).map(([h, t], i) => {
            const curve = snakeCurve(+h, +t), c = SNAKE_COLORS[i % SNAKE_COLORS.length];
            const head = curve[0], tangent = bez(curve, 0.04), ang = Math.atan2(head[1] - tangent[1], head[0] - tangent[0]) * 180 / Math.PI;
            const isFed = fed === +h;
            const belly = bez(curve, 0.55);
            return (
              <g key={h} className={`snake ${isFed ? 'fed' : ''}`} filter="url(#sh)">
                <path d={pathOf(curve)} fill="none" stroke={c} strokeWidth="0.24" strokeLinecap="round" />
                <path d={pathOf(curve)} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.1" strokeDasharray="0.12 0.16" strokeLinecap="round" />
                {isFed && <ellipse cx={belly[0]} cy={belly[1]} rx="0.34" ry="0.3" fill={c} className="belly" />}
                <g transform={`translate(${head[0]} ${head[1]}) rotate(${ang}) scale(${isFed ? 1.45 : 1})`}>
                  <ellipse cx="0.05" cy="0" rx="0.32" ry="0.24" fill={c} stroke="#1b1035" strokeWidth="0.03" />
                  {isFed ? (<>
                    <path d="M0.06 -0.14 q0.06 -0.06 0.12 0 M0.06 0.08 q0.06 -0.06 0.12 0" stroke="#1b1035" strokeWidth="0.035" fill="none" />
                    <ellipse cx="0.12" cy="-0.02" rx="0.05" ry="0.03" fill="#ff7ab0" opacity="0.8" />
                  </>) : (<>
                    <circle cx="0.12" cy="-0.11" r="0.07" fill="#fff" /><circle cx="0.14" cy="-0.11" r="0.035" fill="#1b1035" />
                    <circle cx="0.12" cy="0.11" r="0.07" fill="#fff" /><circle cx="0.14" cy="0.11" r="0.035" fill="#1b1035" />
                  </>)}
                  <path className="tongue" d="M0.34 0 L0.52 0 M0.52 0 l0.06 -0.05 M0.52 0 l0.06 0.05" stroke="#ff2d55" strokeWidth="0.03" />
                </g>
                {isFed && <text x={head[0]} y={head[1] - 0.45} className="yum">Yum! 😋</text>}
              </g>
            );
          })}

          {game.order.map((id) => {
            const p = room.players.find((x) => x.id === id)!;
            const k = shown[id].map((v) => v.toFixed(2)).join();
            const group = spots.get(k)!, idx = group.indexOf(id), n = group.length;
            const off = n > 1 ? [(idx % 2 ? 0.2 : -0.2), (idx > 1 ? 0.2 : -0.2) * (n > 2 ? 1 : 0)] : [0, 0];
            const s = n > 1 ? 0.62 : 0.86;
            const [x, y] = shown[id];
            return (
              <g key={id} className={`stok ${sliding === id ? 'sliding' : ''} ${cur === id ? 'cur' : ''} ${game.pos[id] === 0 ? 'off' : ''}`}
                style={{ transform: `translate(${x + off[0] - s / 2}px, ${y + off[1] - s / 2 - 0.08}px)` }}>
                <circle cx={s / 2} cy={s / 2 + 0.06} r={s / 2.1} fill={color(id)} stroke="#fff" strokeWidth="0.05" />
                <Avatar id={p.avatar} size={s} mood={mood(id)} hyped={cur === id} />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="dock">
        <div className="turn-label">{game.winner ? 'Game over' : myTurn ? (settled ? 'Your turn!' : '…') : `${room.players.find((p) => p.id === cur)?.name}'s turn`}</div>
        <Dice value={game.dice} rollId={game.rollId} color={color(cur)} ready={myTurn && settled}
          onRoll={() => { setSettled(false); act({ t: 'roll' }); }} onSettled={() => setSettled(true)} />
        <div className="note">{game.note}</div>
      </div>
    </div>
  );
}
