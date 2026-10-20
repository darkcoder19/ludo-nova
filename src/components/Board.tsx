import { useEffect, useRef, useState } from 'react';
import { HOME_COLUMN, PATH, tokenXY, YARD } from '../game/board';
import { COLORS, HOME, SAFE, START, type Color, type GameState } from '../game/engine';
import { sfx } from '../game/sound';

type Tokens = GameState['tokens'];

/** Walks tokens forward one square at a time so moves read as hops, not teleports. */
function useAnimatedTokens(target: Tokens): Tokens {
  const [shown, setShown] = useState<Tokens>(target);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const cur = shownRef.current;
      let moved = false, stepped = false;
      const next: Tokens = {};
      for (const c of Object.keys(target) as Color[]) {
        const want = target[c]!;
        const have = cur[c] ?? want;
        next[c] = want.map((w, i) => {
          const h = have[i] ?? w;
          if (h === w) return h;
          moved = true;
          if (w > h && h >= 0) { stepped = true; return h + 1; }
          return w; // leaving the yard or being captured: jump straight there
        });
      }
      if (!moved) return;
      if (stepped) sfx.step();
      shownRef.current = next;
      setShown(next);
      timer = setTimeout(step, 150);
    };
    step();
    return () => clearTimeout(timer);
  }, [target]);

  return shown;
}

/** Short-lived ring bursts on a colour's start square whenever one of its pieces leaves the yard. */
function useUnlockBursts(tokens: Tokens) {
  const prev = useRef(tokens);
  const [bursts, setBursts] = useState<{ id: number; color: Color }[]>([]);
  useEffect(() => {
    const fresh: { id: number; color: Color }[] = [];
    for (const c of Object.keys(tokens) as Color[]) {
      tokens[c]!.forEach((p, i) => {
        if (p >= 0 && (prev.current[c]?.[i] ?? -1) < 0 && prev.current[c]) fresh.push({ id: Date.now() + Math.random(), color: c });
      });
    }
    prev.current = tokens;
    if (!fresh.length) return;
    sfx.six();
    setBursts((b) => [...b, ...fresh]);
    const t = setTimeout(() => setBursts((b) => b.filter((x) => !fresh.includes(x))), 1000);
    return () => clearTimeout(t);
  }, [tokens]);
  return bursts;
}

const FILL: Record<Color, string> = { red: 'var(--red)', green: 'var(--green)', yellow: 'var(--yellow)', blue: 'var(--blue)' };

// How pieces sharing one square are arranged: [dx, dy] offsets and a scale, by count.
const STACK: Record<number, { at: [number, number][]; s: number }> = {
  1: { at: [[0, 0]], s: 1 },
  2: { at: [[-0.21, 0], [0.21, 0]], s: 0.72 },
  3: { at: [[-0.21, 0.14], [0.21, 0.14], [0, -0.2]], s: 0.62 },
  4: { at: [[-0.21, -0.2], [0.21, -0.2], [-0.21, 0.18], [0.21, 0.18]], s: 0.58 },
};

interface Piece { color: Color; idx: number; x: number; y: number; prog: number; key: string }

interface Props {
  state: GameState;
  myColor: Color | null;
  rotation: number; // quarter turns clockwise
  canMove: boolean;
  onPick(idx: number): void;
}

export function Board({ state, myColor, rotation, canMove, onPick }: Props) {
  const shown = useAnimatedTokens(state.tokens);
  const turnColor = state.players[state.turn]?.color;
  const active = new Set(state.players.map((p) => p.color));
  const [hover, setHover] = useState<number | null>(null);
  const bursts = useUnlockBursts(state.tokens);

  const pieces: Piece[] = [];
  for (const c of COLORS) {
    if (!active.has(c)) continue;
    (shown[c] ?? []).forEach((p, idx) => {
      const [x, y] = tokenXY(c, START[c], p, idx);
      pieces.push({ color: c, idx, x, y, prog: p, key: `${c}${idx}` });
    });
  }

  // Group pieces on the same square so they can be fanned out and badged.
  const groups = new Map<string, Piece[]>();
  for (const p of pieces) {
    if (p.prog < 0 || p.prog === HOME) continue;
    const k = `${p.x},${p.y}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const layout = new Map<string, { dx: number; dy: number; s: number }>();
  const badges: { x: number; y: number; n: number; color: Color }[] = [];
  groups.forEach((g) => {
    const lay = STACK[Math.min(g.length, 4)];
    g.forEach((p, i) => {
      const [dx, dy] = lay.at[i % lay.at.length];
      layout.set(p.key, { dx, dy, s: lay.s });
    });
    if (g.length > 1) badges.push({ x: g[0].x, y: g[0].y, n: g.length, color: g.every((p) => p.color === g[0].color) ? g[0].color : g[g.length - 1].color });
  });

  // Where each movable piece of mine would land.
  const targets = canMove && myColor
    ? state.movable.map((i) => {
        const from = state.tokens[myColor]![i];
        const to = from < 0 ? 0 : from + state.dice;
        const [x, y] = tokenXY(myColor, START[myColor], to, i);
        return { i, x, y };
      })
    : [];

  // Pickable pieces render last so they sit on top and stay tappable.
  const ordered = [...pieces].sort((a, b) => {
    const pa = canMove && a.color === myColor && state.movable.includes(a.idx) ? 1 : 0;
    const pb = canMove && b.color === myColor && state.movable.includes(b.idx) ? 1 : 0;
    return pa - pb;
  });

  return (
    <div className="board-wrap">
      <svg className="board" viewBox="-0.15 -0.15 15.3 15.3">
        <defs>
          {COLORS.map((c) => (
            <linearGradient key={c} id={`pawn-${c}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="35%" stopColor={FILL[c]} />
              <stop offset="100%" stopColor={FILL[c]} stopOpacity="0.7" />
            </linearGradient>
          ))}
          {COLORS.map((c) => (
            <linearGradient key={c} id={`yard-${c}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={FILL[c]} />
              <stop offset="100%" stopColor={FILL[c]} stopOpacity="0.85" />
            </linearGradient>
          ))}
          <radialGradient id="cell-sheen" cx="30%" cy="25%" r="90%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.06" />
          </radialGradient>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.12" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g transform={`rotate(${rotation * 90} 7.5 7.5)`}>
          <rect x="-0.15" y="-0.15" width="15.3" height="15.3" rx="0.7" className="board-bg" />

          {COLORS.map((c) => {
            const [r, col] = YARD[c];
            return (
              <g key={c} className={`yard ${c} ${turnColor === c ? 'turn' : ''} ${active.has(c) ? '' : 'off'}`}>
                <rect x={col + 0.1} y={r + 0.1} width="5.8" height="5.8" rx="0.8" fill={`url(#yard-${c})`} className="yard-outer" />
                <rect x={col + 0.8} y={r + 0.8} width="4.4" height="4.4" rx="0.6" className="yard-inner" />
                {[[1.8, 1.8], [4.2, 1.8], [1.8, 4.2], [4.2, 4.2]].map(([sx, sy], i) => (
                  <circle key={i} cx={col + sx} cy={r + sy} r="0.55" className="spot" style={{ stroke: FILL[c] }} />
                ))}
              </g>
            );
          })}

          {PATH.map(([r, c], i) => {
            const startOf = COLORS.find((k) => START[k] === i);
            return (
              <g key={i}>
                <rect x={c + 0.04} y={r + 0.04} width="0.92" height="0.92" rx="0.18"
                  className={`cell ${startOf ? 'start' : ''}`} style={startOf ? { fill: FILL[startOf] } : undefined} />
                {SAFE.has(i) && <text x={c + 0.5} y={r + 0.55} className={`star ${startOf ? 'on-start' : ''}`}>★</text>}
              </g>
            );
          })}

          {COLORS.map((c) => HOME_COLUMN[c].map(([r, col], i) => (
            <rect key={c + i} x={col + 0.04} y={r + 0.04} width="0.92" height="0.92" rx="0.18"
              fill={FILL[c]} opacity={0.45 + i * 0.11} className="home-cell" />
          )))}

          <g className="center">
            <polygon points="6,6 6,9 7.5,7.5" fill="var(--red)" />
            <polygon points="6,6 9,6 7.5,7.5" fill="var(--green)" />
            <polygon points="9,6 9,9 7.5,7.5" fill="var(--yellow)" />
            <polygon points="6,9 9,9 7.5,7.5" fill="var(--blue)" />
            <g className="core-spin"><polygon points="7.5,6.85 7.68,7.32 8.15,7.5 7.68,7.68 7.5,8.15 7.32,7.68 6.85,7.5 7.32,7.32" className="core" /></g>
          </g>

          {targets.map((t) => (
            <g key={`t${t.i}`} className={`target ${hover === t.i ? 'hot' : ''}`} style={{ transform: `translate(${t.x}px, ${t.y}px)` }}>
              <circle r="0.44" stroke={FILL[myColor!]} />
              <circle r="0.12" fill={FILL[myColor!]} />
            </g>
          ))}

          {ordered.map((p) => {
            const { dx, dy, s } = layout.get(p.key) ?? { dx: 0, dy: 0, s: 1 };
            const pickable = canMove && p.color === myColor && state.movable.includes(p.idx);
            const done = p.prog === HOME;
            return (
              <g key={p.key} className={`token ${pickable ? 'pickable' : ''} ${done ? 'done' : ''}`}
                style={{ transform: `translate(${p.x + dx}px, ${p.y + dy}px) scale(${done ? 0.6 : s})` }}
                onClick={pickable ? () => onPick(p.idx) : undefined}
                onPointerEnter={pickable ? () => setHover(p.idx) : undefined}
                onPointerLeave={pickable ? () => setHover(null) : undefined}>
                <g transform={`rotate(${-rotation * 90})`}>
                  {pickable && <circle r="0.6" className="pick-ring" stroke={FILL[p.color]} />}
                  <ellipse cx="0" cy="0.36" rx="0.26" ry="0.08" className="shadow" />
                  <g className="hop" key={p.prog}>
                    <Pawn color={p.color} />
                  </g>
                  {pickable && <circle r="0.75" fill="transparent" />}
                </g>
              </g>
            );
          })}

          {bursts.map((b) => {
            const [x, y] = tokenXY(b.color, START[b.color], 0, 0);
            return (
              <g key={b.id} className="unlock" style={{ transform: `translate(${x}px, ${y}px)` }}>
                <circle r="0.5" stroke={FILL[b.color]} />
                <circle r="0.5" stroke={FILL[b.color]} />
                {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
                  <g key={k} transform={`rotate(${k * 45})`}><line x1="0" y1="-0.55" x2="0" y2="-0.85" stroke={FILL[b.color]} /></g>
                ))}
              </g>
            );
          })}

          {badges.map((b) => (
            <g key={`${b.x},${b.y}`} className="stack-badge" transform={`translate(${b.x + 0.36} ${b.y - 0.36}) rotate(${-rotation * 90})`}>
              <circle r="0.2" fill={FILL[b.color]} />
              <text y="0.02">{b.n}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

/** Classic map-pin Ludo piece, tip at the bottom. */
function Pawn({ color }: { color: Color }) {
  return (
    <g transform="translate(0 -0.1) scale(1.15)">
      <path d="M0 0.42 C-0.06 0.28 -0.34 0.06 -0.34 -0.14 A0.34 0.34 0 1 1 0.34 -0.14 C0.34 0.06 0.06 0.28 0 0.42 Z"
        fill={`url(#pawn-${color})`} className="pin" />
      <circle cx="0" cy="-0.14" r="0.17" fill="#fff" />
      <circle cx="0" cy="-0.14" r="0.09" fill={FILL[color]} />
      <ellipse cx="-0.13" cy="-0.3" rx="0.08" ry="0.05" fill="#fff" opacity="0.7" />
    </g>
  );
}
