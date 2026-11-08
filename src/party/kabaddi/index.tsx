import { useEffect, useState } from 'react';
import { buzz, sfx } from '../../game/sound';
import { GameShell, type GameProps, type ShellConfig } from '../../shared/GameShell';
import { Banner, Chips, Hero } from '../common';
import { defenderOf, DEPTHS, kbRules, LANES, raiderOf, TACKLES, type KAction, type KGame } from './rules';

function Court({ g, color }: { g: KGame; color(id: string): string }) {
  const r = raiderOf(g), d = defenderOf(g), l = g.phase === 'show' ? g.last : null;
  const [stage, setStage] = useState(0);
  useEffect(() => { if (!l) { setStage(0); return; } setStage(1); const t1 = setTimeout(() => setStage(2), 1100); return () => clearTimeout(t1); }, [l?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const laneY = (k: number) => 22 + k * 28;
  // raider goes from own half (left) into the right half, then back unless tackled
  const rx = !l ? 22 : stage === 1 ? 52 + l.depth * 12 : l.tackled ? 52 + l.depth * 12 : 22;
  const ry = !l ? 50 : laneY(l.lane);
  const defs = Array.from({ length: g.men[d] }, (_, k) => ({ x: 66 + (k % 3) * 11, y: 14 + Math.floor(k / 3) * 30 + (k % 3) * 6 }));
  return (
    <svg className="ck-field" viewBox="0 0 100 100">
      <rect x="2" y="6" width="96" height="88" rx="3" fill="#d4874a" />
      <rect x="4" y="8" width="92" height="84" fill="#e39a5c" stroke="#fff" strokeWidth="0.6" />
      <line x1="50" y1="8" x2="50" y2="92" stroke="#fff" strokeWidth="1" />
      {[30, 70].map((x) => <line key={x} x1={x} y1="8" x2={x} y2="92" stroke="rgba(255,255,255,.6)" strokeWidth="0.4" strokeDasharray="2 2" />)}
      {[0, 1, 2].map((k) => <text key={k} x="97" y={laneY(k) + 1} fontSize="3" fill="rgba(255,255,255,.7)" textAnchor="end">{LANES[k]}</text>)}
      {Array.from({ length: g.men[r] - 1 }, (_, k) => <circle key={`o${k}`} cx={10 + (k % 2) * 7} cy={18 + k * 11} r="2.6" fill={color(r)} opacity="0.75" />)}
      {defs.map((p, k) => {
        const tackle = l && stage >= 1 && l.dl === Math.floor(k / 3) % 3;
        const tx = tackle ? rx + (k % 2 ? 3 : -3) : p.x, ty = tackle ? ry + (k % 3) - 1 : l && stage >= 1 ? laneY(l.dl) + (k % 3) * 5 - 5 : p.y;
        return <circle key={`d${k}`} className="kb-def" cx="0" cy="0" r="2.8" fill={color(d)} stroke="#fff" strokeWidth="0.5" style={{ transform: `translate(${tx}px, ${ty}px)` }} />;
      })}
      <g className="kb-raider" style={{ transform: `translate(${rx}px, ${ry}px)` }}>
        <circle r="4" fill={color(r)} stroke="#fff" strokeWidth="0.8" />
        <text y="1.4" fontSize="4.5" textAnchor="middle">{l?.tackled && stage === 2 ? '😵' : '🏃'}</text>
      </g>
      {l && stage === 2 && <text x="50" y="52" textAnchor="middle" fontSize="9" fontWeight="900" fill={l.tackled ? '#e5304f' : '#fff'} stroke="#1b1035" strokeWidth="0.5" paintOrder="stroke">{l.tackled ? 'TACKLE!' : `+${l.pts}`}</text>}
    </svg>
  );
}

function KabaddiBoard(p: GameProps<KGame, KAction>) {
  const { game: g, me, act, color, setMood } = p;
  const r = raiderOf(g), d = defenderOf(g), amR = r === me, amD = d === me;
  const [lane, setLane] = useState<number | null>(null);
  useEffect(() => { setLane(null); }, [g.seq]);
  useEffect(() => {
    if (g.phase !== 'show' || !g.last) return;
    const t = setTimeout(() => {
      if (g.last!.tackled) { sfx.captured(); setMood(d, 'cool', 2500); setMood(r, 'sad', 2500); if (amR) buzz([80, 40, 120]); }
      else { sfx.win(); setMood(r, 'cool', 2500); }
    }, 1100);
    return () => clearTimeout(t);
  }, [g.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  const picked = amR ? g.picks.lane != null : amD ? g.picks.dl != null : true;
  return (
    <div className="party">
      <Chips p={p} cols={2} active={(id) => (id === r && g.picks.lane == null) || (id === d && g.picks.lane != null && g.picks.dl == null)} extra={(id) => <><b>{g.score[id]}</b><span>{id === r ? '🏃 raiding' : '🛡️ defending'} · 👥{g.men[id]}</span></>} />
      <div className="party-fill"><div className="party-square"><Court g={g} color={color} /></div></div>
      <Banner tone={g.winner ? (g.winner === me ? 'good' : 'bad') : g.phase === 'show' ? (g.last?.tackled ? 'bad' : 'good') : 'info'}>
        {g.winner ? `${g.names[g.winner]} wins! 🏆` : g.tie ? 'A tie!' : g.phase === 'show' ? g.note : picked ? 'Waiting for the other side…' : amR ? (lane == null ? 'Pick a lane to raid' : 'How deep do you go?') : (lane == null ? 'Which lane will they come?' : 'Pick your tackle')}
        <small>Raid {g.raid + 1}/{g.total}</small>
      </Banner>
      {g.phase === 'pick' && !picked && !g.winner && (lane == null ? (
        <div className="p-pick" style={{ ['--n' as string]: 3 }}>{LANES.map((n, k) => <button key={n} onClick={() => { sfx.tap(); setLane(k); }}><span className="e">{['⬅️', '⬆️', '➡️'][k]}</span>{n}</button>)}</div>
      ) : amR ? (
        <div className="p-pick" style={{ ['--n' as string]: 3 }}>{DEPTHS.map((o) => <button key={o.d} onClick={() => act({ t: "raid", lane: lane!, depth: o.d })}><span className="e">{o.e}</span>{o.name}<small>{o.hint}</small></button>)}</div>
      ) : (
        <div className="p-pick" style={{ ['--n' as string]: 2 }}>{TACKLES.map((o) => <button key={o.k} onClick={() => act({ t: "defend", lane: lane!, tk: o.k })}><span className="e">{o.e}</span>{o.name}<small>{o.hint}</small></button>)}</div>
      ))}
    </div>
  );
}

const cfg: ShellConfig<KGame, KAction> = {
  slug: 'kabaddiraid', name: 'Kabaddi Raid', kind: 'Kabaddi duel', prefix: 'kabaddiraid-v1-',
  tagline: 'Raid deep or play safe. Guess the lane, time the tackle, wipe out the side.',
  rules: kbRules, Board: KabaddiBoard,
  hero: <Hero emoji="🤼" a="#e39a5c" b="#ff4f6d" />,
  options: [{ key: 'raids', label: 'Match', initial: '12', choices: [{ value: '8', label: '8 raids' }, { value: '12', label: '12 raids' }, { value: '20', label: '20 raids' }] }],
  progress: (g, pid) => ({ stats: { kb_supers: g.supers[pid] ?? 0 } }),
};
export default function KabaddiApp() { return <GameShell cfg={cfg} />; }
