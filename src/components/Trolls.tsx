// 15 animated "trolls" players can fire at each other. Sent over the wire as "t0".."t14".
import { useState, type ReactNode } from 'react';
import { Avatar } from './Avatar';

const INK = '#1b1035';
const S = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const Hand = () => (
  <svg viewBox="0 0 100 100"><path d="M30 92 L26 50 Q24 40 32 40 Q38 40 38 50 L38 22 Q38 12 46 12 Q54 12 54 22 L54 16 Q54 8 62 8 Q70 8 70 18 L70 26 Q72 18 79 20 Q86 22 84 32 L80 70 Q76 92 56 94 Z" fill="#ffcf9e" {...S} /></svg>
);
const Snail = () => (
  <svg viewBox="0 0 100 70"><path d="M8 62 Q20 46 40 52 L88 54 Q96 60 88 64 Z" fill="#b5e48c" {...S} /><circle cx="56" cy="36" r="24" fill="#f4a261" {...S} />
    <path d="M56 36 m-10 0 a10 10 0 1 0 10 -10 a6 6 0 1 0 6 6" fill="none" {...S} strokeWidth={3} />
    <path d="M16 50 L10 30 M22 50 L22 30" {...S} strokeWidth={3} /><circle cx="10" cy="28" r="4" fill={INK} /><circle cx="22" cy="28" r="4" fill={INK} /></svg>
);
const Bomb = () => (
  <svg viewBox="0 0 100 100"><circle cx="46" cy="60" r="32" fill="#2b2b3a" {...S} /><rect x="54" y="20" width="16" height="14" rx="3" fill="#555" {...S} transform="rotate(30 62 27)" />
    <path d="M68 22 Q76 8 88 12" fill="none" stroke="#a0785a" strokeWidth={4} /><circle className="spark" cx="88" cy="12" r="7" fill="#ffd23f" />
    <circle cx="34" cy="48" r="7" fill="#fff" opacity="0.35" /></svg>
);
const Bolt = () => (<svg viewBox="0 0 60 100"><path d="M36 2 L6 56 L28 56 L18 98 L54 38 L32 38 L44 2 Z" fill="#ffe04a" {...S} /></svg>);
const Shades = () => (
  <svg viewBox="0 0 100 30"><rect x="4" y="4" width="92" height="6" fill="#111" /><rect x="8" y="8" width="36" height="18" fill="#111" /><rect x="56" y="8" width="36" height="18" fill="#111" />
    <rect x="12" y="11" width="8" height="4" fill="#fff" /><rect x="60" y="11" width="8" height="4" fill="#fff" /></svg>
);
const Heart = ({ c = '#ff4d6d' }: { c?: string }) => (<svg viewBox="0 0 100 90"><path d="M50 86 L12 48 Q-4 28 14 12 Q34 -2 50 22 Q66 -2 86 12 Q104 28 88 48 Z" fill={c} {...S} /></svg>);
const Poop = () => (
  <svg viewBox="0 0 100 90"><ellipse cx="50" cy="74" rx="40" ry="14" fill="#8b5a2b" {...S} /><ellipse cx="50" cy="52" rx="30" ry="13" fill="#9c6634" {...S} />
    <ellipse cx="50" cy="32" rx="19" ry="11" fill="#a9713c" {...S} /><path d="M50 22 Q46 8 58 6" fill="#a9713c" {...S} />
    <circle cx="42" cy="52" r="5" fill="#fff" /><circle cx="58" cy="52" r="5" fill="#fff" /><circle cx="43" cy="53" r="2.5" fill={INK} /><circle cx="57" cy="53" r="2.5" fill={INK} /></svg>
);
const Disco = () => (
  <svg viewBox="0 0 100 100"><path d="M50 0 L50 14" {...S} /><circle cx="50" cy="56" r="40" fill="#c9d2e3" {...S} />
    {[-24, -8, 8, 24].map((d) => <path key={d} d={`M${50 + d} 18 Q${50 + d * 1.6} 56 ${50 + d} 94`} fill="none" stroke="#8a94a8" strokeWidth={2} />)}
    {[32, 46, 60, 74].map((y) => <path key={y} d={`M12 ${y} L88 ${y}`} stroke="#8a94a8" strokeWidth={2} />)}
    <circle cx="36" cy="40" r="8" fill="#fff" opacity="0.8" /></svg>
);
const Clock = () => (
  <svg viewBox="0 0 100 100"><circle cx="24" cy="20" r="12" fill="#ffd23f" {...S} /><circle cx="76" cy="20" r="12" fill="#ffd23f" {...S} />
    <circle cx="50" cy="56" r="36" fill="#ff4d6d" {...S} /><circle cx="50" cy="56" r="27" fill="#fff" {...S} strokeWidth={3} />
    <path d="M50 56 L50 38 M50 56 L62 62" {...S} /></svg>
);
const Tear = () => (<svg viewBox="0 0 40 60"><path d="M20 2 Q36 30 34 42 Q32 58 20 58 Q8 58 6 42 Q4 30 20 2 Z" fill="#5ec8ff" {...S} strokeWidth={3} /></svg>);
const Nose = () => (<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" fill="#ff2d55" {...S} /><circle cx="22" cy="22" r="7" fill="#fff" opacity="0.7" /></svg>);
const Puff = () => (<svg viewBox="0 0 60 50"><path d="M12 40 Q0 40 4 28 Q2 14 18 16 Q22 2 36 8 Q52 4 52 20 Q62 30 50 40 Z" fill="#eef" {...S} strokeWidth={3} /></svg>);
const Stamp = ({ text }: { text: string }) => <div className="stamp">{text}</div>;

export interface Troll { name: string; caption: string; icon: ReactNode; props: ReactNode }

export const TROLLS: Troll[] = [
  { name: 'LOL', caption: 'HAHAHA', icon: <span className="ti-text">LOL</span>,
    props: <>{'HAHAHA'.split('').map((c, i) => <b key={i} className="ha" style={{ ['--i' as string]: i }}>{c}</b>)}</> },
  { name: 'Cry', caption: 'CRY MORE', icon: <Tear />,
    props: <><i className="tear l"><Tear /></i><i className="tear r"><Tear /></i><i className="tear l d2"><Tear /></i><i className="tear r d2"><Tear /></i></> },
  { name: 'Too slow', caption: 'TOO SLOW…', icon: <Snail />, props: <i className="snail"><Snail /></i> },
  { name: 'Boom', caption: 'BOOM!', icon: <Bomb />, props: <><i className="bomb"><Bomb /></i><i className="blast" /></> },
  { name: 'Bye', caption: 'BYE BYE', icon: <Hand />, props: <i className="wave"><Hand /></i> },
  { name: 'Honk', caption: 'HONK HONK', icon: <Nose />, props: <><i className="nose"><Nose /></i><i className="honk-ring" /><i className="honk-ring d2" /></> },
  { name: 'Rage', caption: 'RAAAGE', icon: <Puff />, props: <><i className="puff l"><Puff /></i><i className="puff r"><Puff /></i><i className="puff l d2"><Puff /></i><i className="puff r d2"><Puff /></i></> },
  { name: 'GG EZ', caption: '', icon: <span className="ti-text">GG</span>, props: <Stamp text="GG EZ" /> },
  { name: 'Rekt', caption: 'REKT', icon: <Bolt />, props: <><i className="bolt"><Bolt /></i><i className="flash" /></> },
  { name: 'Thug', caption: 'DEAL WITH IT', icon: <Shades />, props: <i className="shades"><Shades /></i> },
  { name: 'Slap', caption: 'SLAP!', icon: <Hand />, props: <i className="slap"><Hand /></i> },
  { name: 'Wake up', caption: 'WAKE UP!', icon: <Clock />, props: <><i className="clock"><Clock /></i>{[0, 1, 2].map((i) => <b key={i} className="zz" style={{ ['--i' as string]: i }}>Z</b>)}</> },
  { name: 'Mwah', caption: 'MWAH', icon: <Heart />, props: <>{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className="heart" style={{ ['--i' as string]: i }}><Heart c={i % 2 ? '#ff7ad9' : '#ff4d6d'} /></i>)}</> },
  { name: 'Stinky', caption: 'STINKY', icon: <Poop />, props: <><i className="poop"><Poop /></i>{[0, 1, 2].map((i) => <i key={i} className="fly" style={{ ['--i' as string]: i }} />)}</> },
  { name: 'Dance', caption: 'DANCE OFF', icon: <Disco />, props: <><i className="disco"><Disco /></i><i className="lights" /></> },
];

/** Troll messages look like "t3:<targetPlayerId>". */
export const trollIndex = (msg: string) => (msg?.startsWith('t') ? parseInt(msg.slice(1), 10) : -1);
export const trollTarget = (msg: string) => msg?.split(':').slice(1).join(':') || '';

export function TrollOverlay({ troll, avatar, name, color, by }: { troll: number; avatar: string; name: string; color: string; by: string }) {
  const t = TROLLS[troll];
  if (!t) return null;
  return (
    <div className={`troll-ov tr-${troll}`} style={{ ['--pc' as string]: color }}>
      <div className="troll-stage">
        <div className="troll-char"><Avatar id={avatar} size={130} hyped /></div>
        {t.props}
      </div>
      {t.caption && <div className="troll-cap">{t.caption}</div>}
      <div className="troll-from"><b>{by}</b> trolled <b>{name}</b></div>
    </div>
  );
}

export interface Target { id: string; name: string; avatar: string; color: string }

/** Step 1: pick a troll. Step 2: pick who gets it (skipped when there's only one rival). */
export function TrollPicker({ targets, onPick, onClose }: { targets: Target[]; onPick(msg: string): void; onClose(): void }) {
  const [troll, setTroll] = useState<number | null>(null);
  const choose = (i: number) => {
    if (targets.length === 1) onPick(`t${i}:${targets[0].id}`);
    else setTroll(i);
  };
  return (
    <div className="troll-sheet" onClick={onClose}>
      {troll === null ? (
        <div className="troll-grid" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-title">Pick a troll</div>
          {TROLLS.map((t, i) => (
            <button key={i} className="troll-btn" onClick={() => choose(i)}>
              <span className="ti">{t.icon}</span><small>{t.name}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="troll-grid targets" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-title">
            <button className="back" onClick={() => setTroll(null)}>←</button>
            Who gets <span className="ti mini">{TROLLS[troll].icon}</span> {TROLLS[troll].name}?
          </div>
          {targets.map((p) => (
            <button key={p.id} className="target-btn" style={{ ['--pc' as string]: p.color }} onClick={() => onPick(`t${troll}:${p.id}`)}>
              <Avatar id={p.avatar} size={56} hyped />
              <b>{p.name}</b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
