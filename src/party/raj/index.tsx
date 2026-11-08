import { useEffect, useMemo, useState } from 'react';
import { sfx } from '../../game/sound';
import { GameShell, type GameProps, type ShellConfig } from '../../shared/GameShell';
import { Banner, Chips, Hero } from '../common';
import { CENTRES, EDGES, rmRules, rotate, value, type RAction, type RGame, type Tile } from './rules';

/** One tile drawn in a 1×1 box at (x, y). */
function TileArt({ t, x = 0, y = 0, owner }: { t: Tile; x?: number; y?: number; owner?: string }) {
  const tri = [`${x},${y} ${x + 1},${y} ${x + 0.5},${y + 0.5}`, `${x + 1},${y} ${x + 1},${y + 1} ${x + 0.5},${y + 0.5}`, `${x + 1},${y + 1} ${x},${y + 1} ${x + 0.5},${y + 0.5}`, `${x},${y + 1} ${x},${y} ${x + 0.5},${y + 0.5}`];
  return (
    <g>
      {tri.map((pts, d) => <polygon key={d} points={pts} fill={EDGES[t.e[d]]} />)}
      {t.e.map((e, d) => e === 1 && <polygon key={`w${d}`} points={tri[d]} fill="url(#rm-water)" opacity="0.5" />)}
      <circle cx={x + 0.5} cy={y + 0.5} r="0.3" fill={CENTRES[t.c].bg} stroke={owner ?? 'rgba(0,0,0,.25)'} strokeWidth={owner ? 0.07 : 0.03} />
      <text x={x + 0.5} y={y + 0.53} fontSize="0.34" textAnchor="middle" dominantBaseline="middle">{CENTRES[t.c].e}</text>
      <rect x={x + 0.01} y={y + 0.01} width="0.98" height="0.98" fill="none" stroke="rgba(0,0,0,.2)" strokeWidth="0.02" />
    </g>
  );
}
const Defs = () => <defs><pattern id="rm-water" width="0.2" height="0.2" patternUnits="userSpaceOnUse"><path d="M0 0.1 q0.05 -0.05 0.1 0 t0.1 0" stroke="#fff" strokeWidth="0.02" fill="none" /></pattern></defs>;

function RajBoard(p: GameProps<RGame, RAction>) {
  const { game: g, me, act, color } = p;
  const [sel, setSel] = useState(0);
  const [rot, setRot] = useState(0);
  const cur = g.order[g.turn], mine = cur === me && g.moves < g.total;
  useEffect(() => { if (g.last) sfx.step(); }, [g.moves]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRot(0); }, [g.moves]);
  const hand = g.hands[me] ?? [];
  const tile = hand[sel] ? rotate(hand[sel], rot) : null;
  const spots = useMemo(() => (mine && tile ? g.board.map((_, at) => value(g, tile, at)) : []), [g, mine, tile]);
  const anyFit = mine && hand.some((t) => [0, 1, 2, 3].some((r) => g.board.some((_, at) => value(g, rotate(t, r), at) >= 0)));
  return (
    <div className="party">
      <Chips p={p} active={(id) => id === cur} extra={(id) => <b>{g.score[id]} pts</b>} />
      <Banner tone={g.last?.pid === me ? 'good' : 'info'}>{mine ? (anyFit ? 'Pick a tile, rotate it, tap a glowing spot' : 'Nothing fits. Swap your tiles.') : `${g.names[cur] ?? ''} is building…`}<small>{g.note} · {g.total - g.moves} turns left</small></Banner>
      <div className="party-fill">
        <div className="party-square">
          <svg className="rm-board" viewBox={`-0.15 -0.15 ${g.n + 0.3} ${g.n + 0.3}`}>
            <Defs />
            <rect x="-0.15" y="-0.15" width={g.n + 0.3} height={g.n + 0.3} rx="0.3" fill="#6b4a2b" />
            <rect x="0" y="0" width={g.n} height={g.n} fill="#e9dcc0" />
            {g.board.map((t, at) => {
              const x = at % g.n, y = Math.floor(at / g.n);
              if (t) return <g key={at} className={g.last?.at === at ? 'rm-new' : ''}><TileArt t={t} x={x} y={y} owner={g.owner[at] ? color(g.owner[at]!) : undefined} /></g>;
              const v = spots[at] ?? -1;
              if (v < 0) return <rect key={at} x={x + 0.04} y={y + 0.04} width="0.92" height="0.92" rx="0.08" fill="rgba(0,0,0,.05)" />;
              return (
                <g key={at} className="rm-spot" onClick={() => { act({ t: 'place', i: sel, at, rot }); sfx.tap(); }}>
                  <rect x={x + 0.04} y={y + 0.04} width="0.92" height="0.92" rx="0.1" fill="#ffd23f" opacity="0.9" />
                  <text x={x + 0.5} y={y + 0.56} fontSize="0.32" textAnchor="middle" fontWeight="900" fill="#1b1035">+{v}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div className="rm-hand">
        {hand.map((t, i) => (
          <button key={i} className={`tile ${sel === i ? 'on' : ''}`} onClick={() => { setSel(i); sfx.tap(); }} disabled={!mine}>
            <svg viewBox="0 0 1 1"><Defs /><TileArt t={sel === i ? rotate(t, rot) : t} /></svg>
          </button>
        ))}
        <button className="btn ghost" disabled={!mine} onClick={() => { setRot((r) => (r + 1) % 4); sfx.tap(); }}>🔄</button>
        {mine && !anyFit && <button className="btn primary" onClick={() => act({ t: 'swap' })}>Swap</button>}
      </div>
    </div>
  );
}

const cfg: ShellConfig<RGame, RAction> = {
  slug: 'rajmahal', name: 'Rajmahal', kind: 'Tile builder', prefix: 'rajmahal-v1-',
  tagline: 'Lay palace, garden, bazaar and temple tiles. Match the edges, build the best kingdom.',
  rules: rmRules, Board: RajBoard,
  hero: <Hero emoji="🏰" a="#f6c27a" b="#4aa8e8" />,
  options: [{ key: 'size', label: 'Map', choices: [{ value: '7', label: '7×7' }, { value: '9', label: 'Big 9×9' }] }],
  progress: (g, pid) => ({ stats: { rm_points: g.score[pid] ?? 0 } }),
};
export default function RajApp() { return <GameShell cfg={cfg} />; }
