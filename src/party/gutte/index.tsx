import { useEffect, useRef } from 'react';
import { sfx } from '../../game/sound';
import { GameShell, type GameProps, type ShellConfig } from '../../shared/GameShell';
import { Banner, Chips, Hero } from '../common';
import { ggRules, type GAction, type GGame } from './rules';

function GutteBoard(p: GameProps<GGame, GAction>) {
  const { game: g, me, color, act, setMood, confetti } = p;
  const cur = g.order[g.turn], mine = cur === me && !g.winner && !g.draw;
  const lastDrop = useRef(g.drops), lastFlip = useRef(g.flips);
  useEffect(() => {
    if (g.drops !== lastDrop.current) { lastDrop.current = g.drops; sfx.step(); }
    if (g.flips !== lastFlip.current) { lastFlip.current = g.flips; sfx.pop(); }
  }, [g.drops, g.flips]);
  useEffect(() => {
    if (!g.winner) return;
    sfx.win(); setMood(g.winner, 'cool', 5000);
    confetti(innerWidth / 2, innerHeight / 3, [color(g.winner), '#ffd23f', '#fff']);
  }, [g.winner]); // eslint-disable-line react-hooks/exhaustive-deps
  const W = g.cols, H = g.rows, winSet = new Set((g.line ?? []).map(([c, r]) => `${c},${r}`));
  return (
    <div className="party">
      <Chips p={p} cols={g.order.length} active={(id) => id === cur && !g.winner} extra={(id) => <span>{g.wins[id] ? '🏆' : ''}{id === cur && !g.winner ? 'dropping…' : ''}</span>} />
      <Banner tone={g.winner ? (g.winner === me ? 'good' : 'bad') : 'info'}>
        {g.winner ? `${g.names[g.winner]} wins!` : g.draw ? 'A draw!' : mine ? 'Your turn: tap a column' : `${g.names[cur]} is thinking…`}
        <small>{g.note}{g.flipEvery ? ` · 🔄 flip in ${g.flipEvery - (g.drops % g.flipEvery)}` : ''}</small>
      </Banner>
      <div className="party-fill">
        <div className="party-square" style={{ width: `min(100cqw, 100cqh * ${W / (H + 0.8)})`, height: `min(100cqh, 100cqw * ${(H + 0.8) / W})` }}>
          <svg className={`gg-board ${g.last === null && g.flips ? 'gg-flip' : ''}`} key={g.flips} viewBox={`-0.2 -0.6 ${W + 0.4} ${H + 0.8}`}>
            <defs>
              <radialGradient id="gg-shine" cx="0.35" cy="0.3" r="0.7"><stop offset="0" stopColor="#fff" stopOpacity="0.7" /><stop offset="0.4" stopColor="#fff" stopOpacity="0" /></radialGradient>
            </defs>
            <rect x="-0.2" y="-0.1" width={W + 0.4} height={H + 0.3} rx="0.35" fill="#8a4b22" />
            <rect x="-0.08" y="0" width={W + 0.16} height={H + 0.08} rx="0.25" fill="#a85f2e" />
            {Array.from({ length: W }, (_, c) => (
              <g key={c} className="gg-col" onClick={() => { if (mine && g.grid[c].length < H) { act({ t: 'drop', c }); } }}>
                <rect x={c} y="-0.6" width="1" height={H + 0.7} fill="transparent" />
                <rect className="gg-hl" x={c + 0.05} y="0" width="0.9" height={H} rx="0.4" fill="#fff" />
                {mine && g.grid[c].length < H && <circle cx={c + 0.5} cy="-0.3" r="0.2" fill={color(me)} opacity="0.7" />}
                {Array.from({ length: H }, (_, r) => <circle key={r} cx={c + 0.5} cy={H - r - 0.5} r="0.38" fill="#5c2f12" />)}
              </g>
            ))}
            {g.grid.map((col, c) => col.map((pid, r) => {
              const isLast = g.last?.c === c && g.last.r === r, win = winSet.has(`${c},${r}`);
              return (
                <g key={`${c}-${r}-${g.flips}`} className={isLast ? 'gg-piece' : ''} style={{ ['--from' as string]: `${-(H - r)}px` }} pointerEvents="none">
                  <circle cx={c + 0.5} cy={H - r - 0.5} r="0.38" fill={color(pid)} stroke={win ? '#fff' : 'rgba(0,0,0,.35)'} strokeWidth={win ? 0.1 : 0.04} className={win ? 'gg-win' : ''} />
                  <circle cx={c + 0.5} cy={H - r - 0.5} r="0.36" fill="url(#gg-shine)" />
                  <circle cx={c + 0.5} cy={H - r - 0.5} r="0.2" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="0.04" />
                </g>
              );
            }))}
          </svg>
        </div>
      </div>
    </div>
  );
}

const cfg: ShellConfig<GGame, GAction> = {
  slug: 'gutteghar', name: 'Gutte Ghar', kind: 'Four in a row', prefix: 'gutteghar-v1-',
  tagline: 'Drop your gutte, line up four. Watch out when the board flips!',
  rules: ggRules, Board: GutteBoard,
  hero: <Hero emoji="🔴" a="#a85f2e" b="#ffb347"><circle cx="30" cy="30" r="9" fill="#2f7bff" /><circle cx="70" cy="76" r="9" fill="#ffd23f" /></Hero>,
  options: [
    { key: 'size', label: 'Board', choices: [{ value: '7x6', label: 'Classic 7×6' }, { value: '9x7', label: 'Big 9×7' }] },
    { key: 'flip', label: 'Board flip', choices: [{ value: 'off', label: 'Off' }, { value: 'on', label: '🔄 Every 7 drops', hint: 'The board turns upside down and pieces fall again' }] },
  ],
  progress: (g, pid) => ({ stats: { gg_wins: g.winner === pid ? 1 : 0 } }),
};
export default function GutteApp() { return <GameShell cfg={cfg} />; }
