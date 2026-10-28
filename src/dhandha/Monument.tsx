// Little landmark drawings for each DhandhaKing city (40×40 box).
const K = '#1b1035';
const S = { stroke: K, strokeWidth: 1.6, strokeLinejoin: 'round' as const };

type Draw = (c: string) => JSX.Element;

const SHAPES: Record<string, Draw> = {
  gateway: (c) => (<g {...S}><rect x="6" y="14" width="28" height="22" fill={c} /><path d="M15 36 V24 a5 5 0 0 1 10 0 V36" fill="#fff" />
    {[6, 13, 24, 31].map((x) => <rect key={x} x={x} y="8" width="3" height="8" fill={c} />)}<rect x="6" y="12" width="28" height="3" fill="#fff" /></g>),
  dome: (c) => (<g {...S}><path d="M6 36 Q6 8 20 8 Q34 8 34 36 Z" fill={c} /><path d="M20 8 L20 4" /><rect x="17" y="28" width="6" height="8" fill="#fff" /></g>),
  mosque: (c) => (<g {...S}><rect x="10" y="22" width="20" height="14" fill={c} /><path d="M12 22 Q12 10 20 10 Q28 10 28 22 Z" fill={c} />
    <rect x="3" y="12" width="4" height="24" fill={c} /><rect x="33" y="12" width="4" height="24" fill={c} /><path d="M5 12 L5 8 M35 12 L35 8 M20 10 L20 6" /><path d="M17 36 V30 a3 3 0 0 1 6 0 V36" fill="#fff" /></g>),
  fort: (c) => (<g {...S}><path d="M4 36 V16 h4 v-4 h4 v4 h4 v-4 h4 v4 h4 v-4 h4 v4 h4 v-4 h4 v24 Z" fill={c} /><path d="M17 36 V27 a3 3 0 0 1 6 0 V36" fill="#fff" />
    <rect x="9" y="21" width="3" height="4" fill="#fff" /><rect x="28" y="21" width="3" height="4" fill="#fff" /></g>),
  hawamahal: (c) => (<g {...S}><path d="M4 36 V22 L10 16 L14 8 L20 4 L26 8 L30 16 L36 22 V36 Z" fill={c} />
    {[[10, 24], [16, 24], [22, 24], [28, 24], [13, 17], [19, 17], [25, 17], [19, 10]].map(([x, y]) => <rect key={`${x}${y}`} x={x - 1} y={y} width="4" height="5" rx="2" fill="#fff" />)}</g>),
  lakepalace: (c) => (<g {...S}><rect x="8" y="16" width="24" height="14" fill={c} /><path d="M10 16 Q10 10 14 10 Q18 10 18 16 M22 16 Q22 10 26 10 Q30 10 30 16" fill={c} />
    {[11, 17, 23, 28].map((x) => <rect key={x} x={x} y="20" width="3" height="6" fill="#fff" />)}<path d="M2 33 q4 -3 8 0 t8 0 t8 0 t8 0 t8 0" fill="none" stroke="#2b7bff" strokeWidth="2" /></g>),
  temple: (c) => (<g {...S}><path d="M10 36 V24 Q10 10 20 4 Q30 10 30 24 V36 Z" fill={c} /><path d="M14 24 H26 M13 18 H27 M15 12 H25" /><path d="M20 4 V1" /><path d="M17 36 V30 h6 V36" fill="#fff" /></g>),
  gopuram: (c) => (<g {...S}><path d="M6 36 L10 8 H30 L34 36 Z" fill={c} /><path d="M8 28 H32 M9 21 H31 M10 14 H30" /><rect x="14" y="4" width="12" height="4" fill={c} /><path d="M17 36 V30 h6 V36" fill="#fff" /></g>),
  bridge: (c) => (<g {...S} fill="none"><path d="M2 30 H38" strokeWidth="2.4" /><path d="M6 30 V10 M34 30 V10" strokeWidth="3" stroke={c} /><path d="M6 12 Q20 26 34 12" stroke={c} strokeWidth="2.4" />
    <path d="M10 30 L6 12 M14 30 L10 16 M30 30 L34 12 M26 30 L30 16 M18 30 V22 M22 30 V22" strokeWidth="1" /><path d="M2 35 q4 -2 8 0 t8 0 t8 0 t8 0 t8 0" stroke="#2b7bff" /></g>),
  charminar: (c) => (<g {...S}><rect x="9" y="16" width="22" height="20" fill={c} />{[5, 31].map((x) => <rect key={x} x={x} y="6" width="4" height="30" fill={c} />)}
    <path d="M7 6 V2 M33 6 V2" /><path d="M14 36 V27 a6 6 0 0 1 12 0 V36" fill="#fff" /><path d="M9 20 H31" /></g>),
  arch: (c) => (<g {...S}><path d="M6 36 V12 Q20 0 34 12 V36 H26 V22 a6 6 0 0 0 -12 0 V36 Z" fill={c} /><path d="M20 6 V2" /><circle cx="20" cy="13" r="2" fill="#fff" /></g>),
  pillar: (c) => (<g {...S}><rect x="15" y="8" width="10" height="24" fill={c} /><rect x="11" y="32" width="18" height="4" fill={c} /><path d="M14 8 L20 3 L26 8 Z" fill={c} /><path d="M15 16 H25 M15 24 H25" /></g>),
  ghats: (c) => (<g {...S}><path d="M2 36 H38 V32 H34 V28 H30 V24 H10 V28 H6 V32 H2 Z" fill="#e6c79a" /><path d="M14 24 V16 Q14 8 20 4 Q26 8 26 16 V24 Z" fill={c} /><path d="M20 4 V1" /></g>),
  minarets: (c) => (<g {...S}><rect x="9" y="8" width="5" height="28" fill={c} /><rect x="26" y="8" width="5" height="28" fill={c} /><rect x="12" y="24" width="16" height="12" fill={c} />
    <path d="M11.5 8 V3 M28.5 8 V3 M9 14 H14 M26 14 H31 M9 20 H14 M26 20 H31" /><path d="M17 36 V30 a3 3 0 0 1 6 0 V36" fill="#fff" /></g>),
  nets: (c) => (<g {...S} fill="none"><path d="M6 34 L20 6 L34 34" stroke="#8b5a2b" strokeWidth="2" /><path d="M10 18 Q20 30 30 18" stroke={c} strokeWidth="2" />
    <path d="M12 20 L28 20 M14 24 L26 24 M16 22 L20 28 L24 22" stroke={c} strokeWidth="1" /><path d="M2 36 q4 -2 8 0 t8 0 t8 0 t8 0 t8 0" stroke="#2b7bff" /></g>),
  vidhana: (c) => (<g {...S}><rect x="4" y="20" width="32" height="16" fill={c} /><path d="M14 20 Q14 10 20 10 Q26 10 26 20 Z" fill={c} /><path d="M20 10 V5" />
    {[8, 13, 18, 23, 28].map((x) => <rect key={x} x={x} y="24" width="2.5" height="12" fill="#fff" />)}</g>),
  diamond: (c) => (<g {...S}><path d="M8 14 L14 6 H26 L32 14 L20 34 Z" fill={c} /><path d="M8 14 H32 M14 6 L18 14 L20 34 M26 6 L22 14 L20 34" fill="none" /><path d="M24 9 l3 0" stroke="#fff" strokeWidth="2" /></g>),
  palace: (c) => (<g {...S}><rect x="4" y="18" width="32" height="18" fill={c} /><path d="M4 18 L8 12 H32 L36 18 Z" fill={c} /><path d="M18 12 Q18 6 20 4 Q22 6 22 12" fill={c} />
    {[8, 14, 24, 30].map((x) => <rect key={x} x={x} y="22" width="3" height="5" rx="1.5" fill="#fff" />)}<path d="M17 36 V29 a3 3 0 0 1 6 0 V36" fill="#fff" /></g>),
};

export const MONUMENTS: Record<string, { shape: keyof typeof SHAPES; label: string }> = {
  Patna: { shape: 'dome', label: 'Golghar' },
  Ranchi: { shape: 'temple', label: 'Pahari Mandir' },
  Bhopal: { shape: 'mosque', label: 'Taj-ul-Masajid' },
  Gwalior: { shape: 'fort', label: 'Gwalior Fort' },
  Nagpur: { shape: 'pillar', label: 'Zero Mile' },
  Jodhpur: { shape: 'fort', label: 'Mehrangarh Fort' },
  Udaipur: { shape: 'lakepalace', label: 'Lake Palace' },
  Jaipur: { shape: 'hawamahal', label: 'Hawa Mahal' },
  Varanasi: { shape: 'ghats', label: 'Dashashwamedh Ghat' },
  Kanpur: { shape: 'temple', label: 'JK Temple' },
  Lucknow: { shape: 'arch', label: 'Rumi Darwaza' },
  Guwahati: { shape: 'temple', label: 'Kamakhya Temple' },
  Bhubaneswar: { shape: 'temple', label: 'Lingaraj Temple' },
  Kolkata: { shape: 'bridge', label: 'Howrah Bridge' },
  Vadodara: { shape: 'palace', label: 'Laxmi Vilas Palace' },
  Surat: { shape: 'diamond', label: 'Diamond City' },
  Ahmedabad: { shape: 'minarets', label: 'Jhulta Minar' },
  Kochi: { shape: 'nets', label: 'Chinese Fishing Nets' },
  Chennai: { shape: 'gopuram', label: 'Kapaleeshwarar' },
  Hyderabad: { shape: 'charminar', label: 'Charminar' },
  Bengaluru: { shape: 'vidhana', label: 'Vidhana Soudha' },
  Mumbai: { shape: 'gateway', label: 'Gateway of India' },
};

export function Monument({ city, color, className = '' }: { city: string; color: string; className?: string }) {
  const m = MONUMENTS[city];
  if (!m) return null;
  return <svg viewBox="0 0 40 40" className={`monument ${className}`} aria-label={m.label}>{SHAPES[m.shape](color)}</svg>;
}

// ---- Pictures for the non-city tiles ----
const PICS: Record<string, () => JSX.Element> = {
  train: () => (<g {...S}><rect x="6" y="12" width="26" height="16" rx="4" fill="#5b6cff" /><rect x="10" y="15" width="7" height="6" fill="#cfe3ff" /><rect x="20" y="15" width="7" height="6" fill="#cfe3ff" />
    <path d="M32 16 L37 20 V28 H32 Z" fill="#ff8c42" /><circle cx="12" cy="31" r="3" fill="#333" /><circle cx="26" cy="31" r="3" fill="#333" /><path d="M2 35 H38" strokeWidth="2" /><rect x="9" y="8" width="5" height="4" fill="#333" /></g>),
  bijli: () => (<g {...S}><path d="M20 3 L12 21 H19 L15 37 L29 15 H21 L26 3 Z" fill="#ffd23f" /></g>),
  jal: () => (<g {...S}><path d="M8 12 H24 V18 H14 V22 H8 Z" fill="#9aa7b8" /><rect x="22" y="8" width="6" height="14" rx="2" fill="#9aa7b8" /><rect x="20" y="6" width="10" height="3" rx="1.5" fill="#ff2d55" />
    <path d="M11 26 Q11 30 13 33 Q15 30 15 26 Q13 23 11 26 Z" fill="#5ec8ff" /><path d="M11 36 Q13 34 15 36" stroke="#5ec8ff" /></g>),
  tax: () => (<g {...S}><path d="M8 4 H32 V36 L28 33 L24 36 L20 33 L16 36 L12 33 L8 36 Z" fill="#fff6e0" /><path d="M13 11 H27 M13 16 H27 M13 21 H22" />
    <circle cx="27" cy="26" r="6" fill="#ff2d55" /><text x="27" y="29" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff" stroke="none">₹</text></g>),
  kismat: () => (<g {...S}><rect x="6" y="10" width="18" height="18" rx="4" fill="#fff" transform="rotate(-12 15 19)" /><rect x="16" y="14" width="18" height="18" rx="4" fill="#ffd23f" transform="rotate(10 25 23)" />
    <circle cx="11" cy="16" r="1.8" fill={K} /><circle cx="18" cy="22" r="1.8" fill={K} /><circle cx="22" cy="19" r="1.8" fill={K} /><circle cx="28" cy="25" r="1.8" fill={K} /><circle cx="25" cy="22" r="1.8" fill={K} /><circle cx="25" cy="28" r="1.8" fill={K} />
    <path d="M33 6 l1.5 3 3 1.5 -3 1.5 -1.5 3 -1.5 -3 -3 -1.5 3 -1.5 Z" fill="#ff4fd8" strokeWidth="1" /></g>),
  mohalla: () => (<g {...S}><path d="M3 22 L11 14 L19 22 V36 H3 Z" fill="#ff8c42" /><path d="M17 18 L27 8 L37 18 V36 H17 Z" fill="#5ec8ff" /><rect x="8" y="28" width="5" height="8" fill="#fff" /><rect x="24" y="26" width="6" height="10" fill="#fff" />
    <rect x="21" y="17" width="4" height="4" fill="#fff" /><rect x="30" y="17" width="4" height="4" fill="#fff" /><path d="M2 36 H38" strokeWidth="2" /></g>),
  chai: () => (<g {...S}><path d="M8 14 H28 V26 Q28 34 18 34 Q8 34 8 26 Z" fill="#fff" /><path d="M10 18 H26 V26 Q26 31 18 31 Q10 31 10 26 Z" fill="#b8742f" /><path d="M28 17 Q35 17 35 22 Q35 27 28 26" fill="none" />
    <path d="M13 10 Q11 7 13 4 M18 10 Q16 7 18 4 M23 10 Q21 7 23 4" fill="none" stroke="#9aa7b8" /><path d="M5 36 H31" strokeWidth="2" /></g>),
  start: () => (<g {...S}><path d="M10 4 V37" strokeWidth="2.4" /><path d="M10 5 H32 L27 12 L32 19 H10 Z" fill="#ff2d55" /><path d="M14 25 H30 L27 22 M30 25 L27 28" stroke="#00c97a" strokeWidth="2.4" fill="none" />
    <text x="20" y="35" textAnchor="middle" fontSize="7" fontWeight="900" fill="#00c97a" stroke="none">+₹2000</text></g>),
  sasural: () => (<g {...S}><path d="M4 18 L20 5 L36 18 V36 H4 Z" fill="#ffb3c8" /><rect x="16" y="24" width="8" height="12" fill="#8b5a2b" /><circle cx="20" cy="15" r="4" fill="#fff" />
    <circle cx="12" cy="24" r="4" fill="#fff" /><circle cx="11" cy="23" r="0.8" fill={K} /><circle cx="13.5" cy="23" r="0.8" fill={K} /><path d="M9 20 Q12 17 15 20" fill="#d8d8d8" /><path d="M10.5 26 q1.5 1 3 0" fill="none" strokeWidth="1" />
    <rect x="27" y="22" width="5" height="5" fill="#fff" /></g>),
  shaadi: () => (<g {...S}><rect x="4" y="10" width="32" height="22" rx="3" fill="#fff0c2" /><path d="M4 12 L20 24 L36 12" fill="none" /><path d="M20 30 C14 25 12 21 15 18.5 C17 17 19 18 20 20 C21 18 23 17 25 18.5 C28 21 26 25 20 30 Z" fill="#ff2d55" />
    <path d="M30 5 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1 Z" fill="#ffd23f" strokeWidth="1" /></g>),
};

/** Picture for any tile: a monument for cities, a drawing for everything else. */
export function TilePic({ kind, name, color, className = '' }: { kind: string; name: string; color: string; className?: string }) {
  if (kind === 'city') return <Monument city={name} color={color} className={className} />;
  const key = kind === 'utility' ? (name.startsWith('Bijli') ? 'bijli' : 'jal') : kind === 'parivaar' ? 'mohalla' : kind === 'jail' ? 'sasural' : kind === 'police' ? 'shaadi' : kind;
  const draw = PICS[key];
  return draw ? <svg viewBox="0 0 40 40" className={`monument ${className}`}>{draw()}</svg> : null;
}

/** Seth-ji, the banker who sits in the middle of the board. */
export function Banker({ mood = 'idle' }: { mood?: 'idle' | 'happy' | 'paying' }) {
  return (
    <svg viewBox="0 0 80 80" className={`banker b-${mood}`} aria-label="Seth-ji the banker">
      <rect x="10" y="56" width="60" height="18" rx="4" fill="#8b5a2b" stroke={K} strokeWidth="2" />
      <rect x="10" y="56" width="60" height="5" fill="#a0693a" />
      <path d="M22 58 Q22 36 40 36 Q58 36 58 58 Z" fill="#fff6e0" stroke={K} strokeWidth="2" />
      <circle cx="40" cy="28" r="15" fill="#f1b98a" stroke={K} strokeWidth="2" />
      <path d="M25 22 Q40 2 55 22 Q40 15 25 22 Z" fill="#ff8c42" stroke={K} strokeWidth="2" />
      <circle cx="48" cy="8" r="3" fill="#ffd23f" stroke={K} strokeWidth="1.5" />
      <circle cx="34" cy="28" r="4.5" fill="none" stroke={K} strokeWidth="1.8" /><circle cx="46" cy="28" r="4.5" fill="none" stroke={K} strokeWidth="1.8" /><path d="M38.5 28 H41.5" stroke={K} strokeWidth="1.8" />
      <circle cx="34" cy="28" r="1.6" fill={K} /><circle cx="46" cy="28" r="1.6" fill={K} />
      <path d="M31 36 Q35 33 40 36 Q45 33 49 36" fill="#4a2c12" stroke={K} strokeWidth="1.5" />
      {mood === 'happy' ? <path d="M35 39 Q40 43 45 39" fill="none" stroke={K} strokeWidth="1.8" /> : <path d="M36 40 H44" stroke={K} strokeWidth="1.8" />}
      <g className="banker-coins"><ellipse cx="62" cy="54" rx="7" ry="2.5" fill="#ffd23f" stroke={K} strokeWidth="1.5" /><ellipse cx="62" cy="51" rx="7" ry="2.5" fill="#ffd23f" stroke={K} strokeWidth="1.5" /><ellipse cx="62" cy="48" rx="7" ry="2.5" fill="#ffe08a" stroke={K} strokeWidth="1.5" /></g>
      <rect x="14" y="46" width="12" height="9" rx="1.5" fill="#00c97a" stroke={K} strokeWidth="1.5" /><text x="20" y="53" textAnchor="middle" fontSize="6" fontWeight="900" fill="#fff">₹</text>
    </svg>
  );
}
