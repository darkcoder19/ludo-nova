import { useEffect } from 'react';
import { buzz, sfx } from '../../game/sound';
import { GameShell, type GameProps, type ShellConfig } from '../../shared/GameShell';
import { Banner, Chips, Hero } from '../common';
import { BALLS, batter, bowler, ckRules, SHOTS, type CGame, type KAction } from './rules';

function Field({ g }: { g: CGame }) {
  const l = g.phase === 'show' ? g.last : null;
  const dir = l ? (l.runs >= 4 ? { x: (l.id % 2 ? 1 : -1) * 38, y: -40 } : l.out ? { x: 0, y: 18 } : { x: (l.id % 2 ? 1 : -1) * 18, y: -14 }) : { x: 0, y: 0 };
  return (
    <svg className="ck-field" viewBox="-50 -50 100 100">
      <circle r="49" fill="#3f9b4a" /><circle r="49" fill="none" stroke="#fff" strokeWidth="0.6" strokeDasharray="2 2" />
      <circle r="30" fill="#48a853" /><circle r="30" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="0.4" />
      <rect x="-4" y="-18" width="8" height="36" rx="1" fill="#d9c58d" />
      {[-1, 0, 1].map((k) => <rect key={k} x={k * 1.4 - 0.4} y="12" width="0.8" height="4" fill={l?.out ? '#e5304f' : '#fff'} style={l?.out ? { transform: `rotate(${k * 30}deg)`, transformOrigin: '0 16px', transition: 'transform .3s .6s' } : undefined} />)}
      <circle cy="-15" r="2.6" fill="#2f7bff" /><text y="-14" fontSize="3" textAnchor="middle" dominantBaseline="middle">🧢</text>
      <circle cy="10" r="2.6" fill="#ffd23f" /><text x="2.5" y="8" fontSize="4">🏏</text>
      {[[-30, -20], [32, -12], [-20, 28], [26, 30], [0, -40], [-40, 6]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="#2f7bff" stroke="#fff" strokeWidth="0.4" />)}
      {l && <circle key={l.id} className="ck-ball" cy="10" r="1.2" fill="#c8102e" stroke="#fff" strokeWidth="0.3" style={{ ['--bx' as string]: `${dir.x}px`, ['--by' as string]: `${dir.y}px` }} />}
    </svg>
  );
}

function CricketBoard(p: GameProps<CGame, KAction>) {
  const { game: g, me, act, setMood, confetti, color } = p;
  const bat = batter(g), bowl = bowler(g), i = g.inn, amBat = bat === me, amBowl = bowl === me;
  const myPick = amBat ? g.picks.shot : amBowl ? g.picks.ball : 'x';
  useEffect(() => {
    if (g.phase !== 'show' || !g.last) return;
    if (g.last.out) { sfx.captured(); setMood(bowl, 'cool', 2500); setMood(bat, 'sad', 2500); if (amBat) buzz([80, 40, 160]); }
    else if (g.last.runs >= 4) { sfx.win(); setMood(bat, 'cool', 2500); confetti(innerWidth / 2, innerHeight / 2.5, [color(bat), '#ffd23f'], 30); }
    else sfx.tap();
  }, [g.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (g.winner) sfx.win(); }, [g.winner]);
  const need = i === 1 ? g.runs[0] + 1 - g.runs[1] : 0, left = g.overs * 6 - g.balls[i];
  return (
    <div className="party">
      <Chips p={p} cols={2} active={(id) => (id === bat && !g.picks.shot) || (id === bowl && !!g.picks.shot && !g.picks.ball)} extra={(id) => <span>{id === bat ? '🏏 batting' : '🎯 bowling'}{g.sixes[id] ? ` · ${g.sixes[id]}×6` : ''}</span>} />
      <div className="ck-score">
        <div><small>{g.names[bat]} · innings {i + 1}</small><span className="big">{g.runs[i]}/{g.wk[i]}</span> <small style={{ display: 'inline' }}>({Math.floor(g.balls[i] / 6)}.{g.balls[i] % 6} / {g.overs} ov)</small></div>
        <div style={{ textAlign: 'right' }}><small>{i === 1 ? `Need ${Math.max(0, need)} off ${left}` : `${g.maxW} wickets`}</small><div className="ck-balls">{g.over.map((b, k) => <i key={k} className={b === 'W' ? 'w' : b === '4' ? 'f' : b === '6' ? 's' : ''}>{b}</i>)}</div></div>
      </div>
      <div className="party-fill">
        <div className="party-square"><Field g={g} /></div>
        {g.phase === 'show' && g.last && <div className="ck-result" key={g.last.id} style={{ color: g.last.out ? '#ff5470' : g.last.runs >= 4 ? '#ffd23f' : '#fff' }}>{g.last.out ? 'OUT!' : g.last.runs === 6 ? 'SIX!' : g.last.runs === 4 ? 'FOUR!' : g.last.runs ? `${g.last.runs}` : '•'}</div>}
      </div>
      <Banner tone={g.winner ? (g.winner === me ? 'good' : 'bad') : 'info'}>
        {g.winner ? `${g.names[g.winner]} wins the match! 🏆` : g.tie ? "It's a tie!" : g.phase === 'show' && g.last ? `${SHOTS.find((s) => s.k === g.last!.shot)!.e} ${SHOTS.find((s) => s.k === g.last!.shot)!.name} vs ${BALLS.find((b) => b.k === g.last!.ball)!.e} ${BALLS.find((b) => b.k === g.last!.ball)!.name}` : g.phase === 'break' ? 'Innings break' : myPick ? 'Waiting for the other captain…' : amBat ? 'Pick your shot' : 'Pick your delivery'}
        <small>{g.note}</small>
      </Banner>
      {g.phase === 'pick' && !myPick && !g.winner && (
        <div className="p-pick" style={{ ['--n' as string]: 5 }}>
          {(amBat ? SHOTS : BALLS).map((o) => <button key={o.k} onClick={() => { sfx.tap(); act(amBat ? { t: 'shot', k: o.k } : { t: 'ball', k: o.k }); }}><span className="e">{o.e}</span>{o.name}</button>)}
        </div>
      )}
    </div>
  );
}

const cfg: ShellConfig<CGame, KAction> = {
  slug: 'cricketcaptain', name: 'Cricket Captain', kind: 'Cricket duel', prefix: 'cricketcaptain-v1-',
  tagline: 'Pick your shot, pick your ball. Outthink your friend, one delivery at a time.',
  rules: ckRules, Board: CricketBoard,
  hero: <Hero emoji="🏏" a="#1f7a4d" b="#9fe870"><circle cx="72" cy="30" r="7" fill="#c8102e" stroke="#fff" strokeWidth="1.5" /></Hero>,
  options: [{ key: 'overs', label: 'Match', initial: '3', choices: [{ value: '2', label: '2 overs' }, { value: '3', label: '3 overs' }, { value: '5', label: '5 overs' }] }],
  podiumExtra: (g, pid) => <span>{g.order.indexOf(pid) === (g.bat) ? `${g.runs[0]}/${g.wk[0]}` : `${g.runs[1]}/${g.wk[1]}`}</span>,
  progress: (g, pid) => ({ stats: { ck_sixes: g.sixes[pid] ?? 0 } }),
};
export default function CricketApp() { return <GameShell cfg={cfg} />; }
