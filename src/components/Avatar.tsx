// 15 hand-drawn SVG characters. Avatars are stored as "c0".."c14".
import type { ReactNode } from 'react';

const INK = '#1b1035';
const S = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Eye({ x, y, r = 10, px = 0, py = 0, pr }: { x: number; y: number; r?: number; px?: number; py?: number; pr?: number }) {
  return (
    <g className="eye">
      <circle cx={x} cy={y} r={r} fill="#fff" {...S} strokeWidth={3.5} />
      <circle cx={x + px} cy={y + py} r={pr ?? r * 0.48} fill={INK} />
      <circle cx={x + px - r * 0.18} cy={y + py - r * 0.2} r={r * 0.16} fill="#fff" />
    </g>
  );
}
const Shut = ({ x, y, w = 9 }: { x: number; y: number; w?: number }) => (
  <path d={`M${x - w} ${y} Q${x} ${y + 7} ${x + w} ${y}`} fill="none" {...S} />
);
const Blush = ({ x, y }: { x: number; y: number }) => <ellipse cx={x} cy={y} rx="7" ry="4" fill="#ff5c8a" opacity="0.55" />;

export type Anim = 'bounce' | 'wobble' | 'float' | 'jelly' | 'hop' | 'shake' | 'sway';
export interface Character { name: string; bg: string; anim: Anim; draw: () => ReactNode }

export const CHARACTERS: Character[] = [
  { name: 'Bonko', bg: '#ff9a3c', anim: 'jelly', draw: () => (<>
    <circle cx="50" cy="54" r="38" fill="#ff9a3c" {...S} />
    <Eye x={36} y={44} r={12} px={3} py={2} /><Eye x={64} y={42} r={9} px={-2} py={3} />
    <path d="M30 64 Q50 84 70 64 Z" fill={INK} {...S} />
    <rect x="44" y="64" width="6" height="7" fill="#fff" /><rect x="53" y="64" width="6" height="6" fill="#fff" />
    <Blush x={26} y={60} /><Blush x={74} y={60} />
  </>) },
  { name: 'Glorp', bg: '#6ee85a', anim: 'float', draw: () => (<>
    <path d="M14 58 Q14 16 50 16 Q86 16 86 58 L86 80 Q80 90 74 80 Q68 92 60 80 Q52 94 44 80 Q36 92 28 80 Q20 90 14 80 Z" fill="#6ee85a" {...S} />
    <Eye x={50} y={44} r={17} px={4} py={2} pr={8} />
    <path d="M36 66 Q50 76 64 66" fill="none" {...S} />
    <path d="M48 70 Q50 84 56 70" fill="#ff5c8a" {...S} strokeWidth={3} />
  </>) },
  { name: 'Fizz', bg: '#ff7ad9', anim: 'hop', draw: () => (<>
    <path d="M50 22 L50 8" {...S} /><circle cx="50" cy="8" r="6" fill="#ffe04a" {...S} strokeWidth={3} />
    <rect x="14" y="22" width="72" height="66" rx="26" fill="#ff7ad9" {...S} />
    <Shut x={36} y={50} /><Shut x={64} y={50} />
    <ellipse cx="50" cy="70" rx="6" ry="7" fill={INK} />
    <Blush x={27} y={62} /><Blush x={73} y={62} />
  </>) },
  { name: 'Grumbo', bg: '#9b6bff', anim: 'shake', draw: () => (<>
    <path d="M24 30 L14 8 L36 22 Z" fill="#fff4c4" {...S} /><path d="M76 30 L86 8 L64 22 Z" fill="#fff4c4" {...S} />
    <circle cx="50" cy="56" r="36" fill="#9b6bff" {...S} />
    <Eye x={37} y={50} r={9} px={2} py={2} /><Eye x={63} y={50} r={9} px={-2} py={2} />
    <path d="M26 36 L44 44 M74 36 L56 44" {...S} strokeWidth={5} />
    <path d="M34 72 Q50 64 66 72" fill="none" {...S} />
    <path d="M38 70 L41 78 L44 69 M56 69 L59 78 L62 70" fill="#fff" {...S} strokeWidth={2.5} />
  </>) },
  { name: 'Puddle', bg: '#4fb3ff', anim: 'float', draw: () => (<>
    <path d="M16 54 Q16 14 50 14 Q84 14 84 54 L84 88 L74 80 L64 88 L54 80 L44 88 L34 80 L24 88 L16 82 Z" fill="#4fb3ff" {...S} />
    <Eye x={36} y={46} r={13} py={-3} /><Eye x={64} y={46} r={13} py={-3} />
    <path d="M34 70 Q40 64 46 70 Q52 76 58 70 Q64 64 68 70" fill="none" {...S} />
  </>) },
  { name: 'Nugget', bg: '#ffd23f', anim: 'wobble', draw: () => (<>
    <circle cx="50" cy="52" r="38" fill="#ffd23f" {...S} />
    <circle cx="35" cy="44" r="11" fill="#fff" {...S} /><circle cx="65" cy="44" r="11" fill="#fff" {...S} />
    <path d="M46 44 L54 44" {...S} />
    <circle cx="37" cy="45" r="4.5" fill={INK} /><circle cx="63" cy="45" r="4.5" fill={INK} />
    <path d="M28 66 Q38 58 50 64 Q62 58 72 66 Q62 70 50 66 Q38 70 28 66 Z" fill="#7a4a1e" {...S} strokeWidth={3} />
    <path d="M42 76 Q50 81 58 76" fill="none" {...S} strokeWidth={3} />
  </>) },
  { name: 'Zappy', bg: '#2ee5c5', anim: 'shake', draw: () => (<>
    <path d="M18 34 L22 8 L34 26 L42 4 L52 24 L62 4 L68 26 L80 8 L82 34" fill="#ffe04a" {...S} />
    <circle cx="50" cy="56" r="34" fill="#2ee5c5" {...S} />
    <Eye x={36} y={50} r={13} px={-4} py={3} /><Eye x={65} y={52} r={7} px={2} py={-2} />
    <path d="M32 70 Q50 86 68 68" fill="#fff" {...S} /><path d="M40 72 L40 78 M50 74 L50 80 M60 72 L60 77" {...S} strokeWidth={2} />
  </>) },
  { name: 'Moomoo', bg: '#f2f2f7', anim: 'sway', draw: () => (<>
    <ellipse cx="18" cy="34" rx="12" ry="7" fill="#f2f2f7" {...S} transform="rotate(-25 18 34)" />
    <ellipse cx="82" cy="34" rx="12" ry="7" fill="#f2f2f7" {...S} transform="rotate(25 82 34)" />
    <rect x="18" y="20" width="64" height="70" rx="30" fill="#f2f2f7" {...S} />
    <path d="M24 30 Q34 26 38 36 Q30 42 24 38 Z" fill={INK} /><path d="M66 24 Q76 28 72 36 Q64 34 66 24 Z" fill={INK} />
    <Eye x={38} y={46} r={8} /><Eye x={62} y={46} r={8} />
    <ellipse cx="50" cy="72" rx="22" ry="14" fill="#ffb3c8" {...S} />
    <ellipse cx="42" cy="72" rx="3.5" ry="5" fill={INK} /><ellipse cx="58" cy="72" rx="3.5" ry="5" fill={INK} />
  </>) },
  { name: 'Chompy', bg: '#ff4d6d', anim: 'bounce', draw: () => (<>
    <circle cx="50" cy="52" r="38" fill="#ff4d6d" {...S} />
    <circle cx="38" cy="28" r="6" fill="#fff" {...S} strokeWidth={3} /><circle cx="39" cy="29" r="2.5" fill={INK} />
    <circle cx="62" cy="28" r="6" fill="#fff" {...S} strokeWidth={3} /><circle cx="61" cy="29" r="2.5" fill={INK} />
    <path d="M20 46 Q50 40 80 46 Q76 84 50 84 Q24 84 20 46 Z" fill={INK} {...S} />
    <path d="M24 47 L30 56 L36 46 L42 56 L48 45 L54 56 L60 45 L66 56 L72 46 L77 55" fill="#fff" stroke="#fff" strokeWidth={1} />
    <path d="M34 82 L40 74 L46 83 M54 83 L60 74 L66 82" fill="#fff" stroke="#fff" strokeWidth={1} />
    <ellipse cx="50" cy="70" rx="12" ry="6" fill="#ff8fa8" />
  </>) },
  { name: 'Snooze', bg: '#b9a6ff', anim: 'sway', draw: () => (<>
    <ellipse cx="50" cy="56" rx="38" ry="34" fill="#b9a6ff" {...S} />
    <path d="M28 50 Q36 56 44 50 M56 50 Q64 56 72 50" fill="none" {...S} />
    <ellipse cx="50" cy="70" rx="7" ry="5" fill={INK} />
    <path d="M56 72 Q60 80 58 86" fill="none" stroke="#7fd8ff" strokeWidth={4} strokeLinecap="round" />
    <text x="72" y="26" fontSize="18" fontWeight="900" fill={INK} fontFamily="sans-serif">z</text>
    <text x="82" y="14" fontSize="13" fontWeight="900" fill={INK} fontFamily="sans-serif">z</text>
  </>) },
  { name: 'Bloop', bg: '#3dd6ff', anim: 'float', draw: () => (<>
    <path d="M80 54 L96 40 L96 70 Z" fill="#ffb13d" {...S} />
    <ellipse cx="46" cy="54" rx="38" ry="32" fill="#3dd6ff" {...S} />
    <path d="M40 24 Q50 10 60 24" fill="#ffb13d" {...S} />
    <Eye x={32} y={46} r={12} px={-3} />
    <ellipse cx="22" cy="66" rx="6" ry="5" fill={INK} />
    <circle cx="10" cy="40" r="4" fill="none" stroke="#fff" strokeWidth={2.5} /><circle cx="6" cy="28" r="2.5" fill="none" stroke="#fff" strokeWidth={2} />
    <path d="M52 66 Q60 60 68 66 M54 76 Q62 70 70 76" fill="none" {...S} strokeWidth={2.5} opacity="0.5" />
  </>) },
  { name: 'Party Pip', bg: '#ff8c42', anim: 'hop', draw: () => (<>
    <path d="M50 4 L64 32 L36 32 Z" fill="#7a5cff" {...S} strokeWidth={3} />
    <circle cx="50" cy="4" r="5" fill="#ffe04a" {...S} strokeWidth={2.5} />
    <path d="M42 18 L46 22 M54 14 L56 20 M50 26 L52 30" stroke="#ffe04a" strokeWidth={3} strokeLinecap="round" />
    <circle cx="50" cy="60" r="32" fill="#ff8c42" {...S} />
    <Eye x={38} y={54} r={8} py={-2} /><Eye x={62} y={54} r={8} py={-2} />
    <path d="M40 70 Q50 80 60 70" fill="none" {...S} />
    <path d="M60 72 L82 64" stroke={INK} strokeWidth={3} /><path d="M82 64 L92 58 L90 70 Z" fill="#ff4d6d" {...S} strokeWidth={2.5} />
  </>) },
  { name: 'Pickle', bg: '#8bd450', anim: 'wobble', draw: () => (<>
    <rect x="26" y="8" width="48" height="86" rx="24" fill="#8bd450" {...S} />
    <circle cx="34" cy="70" r="3" fill="#5a9a2a" /><circle cx="64" cy="76" r="3" fill="#5a9a2a" /><circle cx="60" cy="20" r="3" fill="#5a9a2a" />
    <Eye x={40} y={40} r={9} py={-3} /><Eye x={60} y={40} r={9} py={-3} />
    <path d="M32 28 L44 32 M68 28 L56 32" {...S} strokeWidth={3} />
    <path d="M40 60 Q45 55 50 60 Q55 65 60 60" fill="none" {...S} />
    <path d="M70 46 Q74 52 70 56 Q66 52 70 46 Z" fill="#7fd8ff" />
  </>) },
  { name: 'Sir Wobbles', bg: '#a7b4c8', anim: 'sway', draw: () => (<>
    <ellipse cx="50" cy="62" rx="36" ry="30" fill="#a7b4c8" {...S} />
    <rect x="30" y="6" width="40" height="28" rx="3" fill={INK} /><rect x="22" y="30" width="56" height="8" rx="4" fill={INK} />
    <rect x="30" y="24" width="40" height="5" fill="#ff4d6d" />
    <Eye x={36} y={56} r={7} />
    <circle cx="64" cy="56" r="11" fill="#fff" {...S} /><circle cx="64" cy="56" r="4.5" fill={INK} />
    <path d="M75 58 Q82 72 78 86" fill="none" stroke="#d4a017" strokeWidth={2.5} />
    <path d="M34 76 Q42 70 50 76 Q58 70 66 76" fill="none" {...S} />
  </>) },
  { name: 'Rocko', bg: '#a0785a', anim: 'jelly', draw: () => (<>
    <path d="M14 66 L20 30 L42 16 L70 20 L88 44 L84 78 L60 90 L30 88 Z" fill="#a0785a" {...S} />
    <path d="M64 30 L72 36 M24 70 L30 74" stroke="#6e4f38" strokeWidth={3} strokeLinecap="round" />
    <path d="M28 40 Q50 32 72 40" {...S} strokeWidth={7} />
    <Eye x={38} y={50} r={7} /><Eye x={62} y={50} r={7} />
    <path d="M38 74 Q50 66 62 74" fill="none" {...S} />
  </>) },
];

export const CHARACTER_IDS = CHARACTERS.map((_, i) => `c${i}`);
export const charOf = (avatar: string) => {
  const n = Number(avatar?.slice(1));
  return avatar?.startsWith('c') && CHARACTERS[n] ? CHARACTERS[n] : CHARACTERS[0];
};

/** live: idle loop + blinking; hyped: bigger personality move (e.g. on your turn). */
export type Mood = 'sad' | 'cool' | null;

/** live: idle loop + blinking; hyped: bigger personality move; mood: tears (sad) or show-off shades (cool). */
export function Avatar({ id, size = 40, className = '', live = true, hyped = false, mood = null }: { id: string; size?: number; className?: string; live?: boolean; hyped?: boolean; mood?: Mood }) {
  const c = charOf(id);
  return (
    <svg className={`avatar-svg ${live ? 'live' : ''} ${className}`} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={c.name}>
      <g className={`mood-wrap ${mood ?? ''}`}>
        <g className={`char anim-${c.anim} ${hyped ? 'hyped' : ''}`} style={{ animationDelay: `-${(id.charCodeAt(1) % 7) * 0.3}s` }}>{c.draw()}</g>
        {mood === 'sad' && (
          <g className="tears">
            <path d="M24 40 Q36 30 44 40" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
            <path d="M56 40 Q64 30 76 40" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
            {[0, 1, 2].map((k) => (
              <g key={k} style={{ animationDelay: `${k * 0.33}s` }} className="drop-pair">
                <path d="M34 54 Q40 64 37 68 Q32 70 31 65 Q31 60 34 54 Z" fill="#5ec8ff" stroke={INK} strokeWidth={2} />
                <path d="M64 54 Q70 64 67 68 Q62 70 61 65 Q61 60 64 54 Z" fill="#5ec8ff" stroke={INK} strokeWidth={2} />
              </g>
            ))}
          </g>
        )}
        {mood === 'cool' && (
          <g className="shades-on">
            <rect x="14" y="38" width="72" height="5" rx="2" fill="#111" />
            <path d="M18 40 L46 40 L44 56 Q32 62 22 56 Z" fill="#111" stroke="#fff" strokeWidth={1.5} />
            <path d="M54 40 L82 40 L78 56 Q68 62 56 56 Z" fill="#111" stroke="#fff" strokeWidth={1.5} />
            <path d="M24 44 L32 44" stroke="#fff" strokeWidth={3} strokeLinecap="round" className="glint" />
            <path d="M60 44 L68 44" stroke="#fff" strokeWidth={3} strokeLinecap="round" className="glint" />
          </g>
        )}
      </g>
    </svg>
  );
}
