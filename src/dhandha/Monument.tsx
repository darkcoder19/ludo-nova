// DhandhaKing art: "postcard vignette" tiles (sky + sun + landmark on ground/water), building symbols and Seth-ji.
// Every drawing uses a 48×56 viewBox; shared gradients live in <ArtDefs/> (render it once per page).
import type { ReactNode } from 'react';

const K = '#1b1035';
const O = { stroke: K, strokeWidth: 1.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
// lit / shade material pairs
const SAND = ['#f4d29a', '#c99a5c'], RED = ['#e87a5d', '#b04a3a'], MARBLE = ['#fffaf0', '#d8cde6'], PINK = ['#ff9d8a', '#d4664f'];
const LAT = ['#d9a066', '#9e6a3c'], STEEL = ['#8ea0c8', '#56658f'], GREEN = ['#4caf50', '#2e7d32'];

// sky + ground per colour group
const SKIES: Record<string, [string, string, string?]> = {
  g0: ['#ffe3b8', '#ffb98a'], g1: ['#8fe0ff', '#e6f9ff'], g2: ['#ffb3e6', '#ffe7c2'], g3: ['#ffb36b', '#ffe4a8'],
  g4: ['#ff6b8a', '#ffc0a0'], g5: ['#ffe36e', '#fff8d6'], g6: ['#6fe3b4', '#e6fff4'], g7: ['#2c2f9e', '#ffb08a', '#8a6cf0'],
  train: ['#c9c2ff', '#efeaff'], kismat: ['#ff4fd8', '#9b6bff'], parivaar: ['#2ee5c5', '#2bb3c9'], tax: ['#ffb3c1', '#ffe8ec'],
  util: ['#fff3a6', '#fffbe0'], start: ['#7dffb6', '#d9fff0'], jail: ['#ffd29a', '#fff1d9'], police: ['#ff8fa3', '#ffe0e6'], chai: ['#ffcf8f', '#fff0d6'],
};
const SUNS: Record<string, string> = { g0: '#fff1c9', g1: '#fff6b0', g2: '#fff0a8', g3: '#fff2c0', g4: '#ffe1b0', g5: '#ffffff', g6: '#fff7b8', g7: '#ffd9a0' };
const GROUND: Record<string, [string, string]> = {
  g0: ['#a8703f', '#c98d55'], g1: ['#7cc46a', '#9fdc84'], g2: ['#f0b26a', '#ffcf8f'], g3: ['#e7a35b', '#f2bd7a'],
  g4: ['#3fa36b', '#5cc184'], g5: ['#e0b04a', '#f2cc6a'], g6: ['#2fae6a', '#4fd08a'], g7: ['#3b3f7a', '#5a5fa0'],
};

/** Hidden gradient sprite shared by every tile. */
export function ArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {Object.entries(SKIES).map(([k, [a, b, mid]]) => (
          <linearGradient key={k} id={`dk-sky-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={a} />{mid && <stop offset=".55" stopColor={mid} />}<stop offset="1" stopColor={b} />
          </linearGradient>
        ))}
        <linearGradient id="dk-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a8de0" /><stop offset="1" stopColor="#2b4fa8" /></linearGradient>
        <linearGradient id="dk-sea-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d5bff" /><stop offset="1" stopColor="#1b1f6e" /></linearGradient>
        <linearGradient id="dk-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1a8" /><stop offset=".5" stopColor="#ffd23f" /><stop offset="1" stopColor="#d4a017" /></linearGradient>
      </defs>
    </svg>
  );
}

/** Shared postcard frame: sky, sun, birds, ground strip, then the landmark. */
function Scene({ sky, sun = true, ground = true, water, children }: { sky: string; sun?: boolean; ground?: boolean; water?: 'day' | 'night'; children: ReactNode }) {
  const gr = GROUND[sky];
  return (
    <>
      <rect width="48" height="56" fill={`url(#dk-sky-${sky})`} />
      {sun && <circle cx="37" cy="14" r="6" fill={SUNS[sky] ?? '#fff7c2'} opacity=".95" />}
      <path d="M6 12l2 1.5 2-1.5M12 8l1.5 1 1.5-1" fill="none" stroke="#fff" strokeWidth=".9" strokeLinecap="round" opacity=".9" />
      {ground && gr && <><rect y="46" width="48" height="10" fill={gr[0]} /><path d="M3 47.5h8M18 48.5h6M31 47.5h9" stroke={gr[1]} strokeWidth="1" strokeLinecap="round" /></>}
      {children}
      {water && <><rect y="47" width="48" height="9" fill={water === 'night' ? 'url(#dk-sea-night)' : 'url(#dk-water)'} /><path d="M6 50h6M20 52.5h7M33 49.5h6" stroke="#cfe0ff" strokeWidth=".9" strokeLinecap="round" /></>}
    </>
  );
}

const LANDMARKS: Record<string, () => ReactNode> = {
  Patna: () => (<Scene sky="g0"><g {...O}>
    <path d="M7 46Q7 17 24 15Q41 17 41 46Z" fill={SAND[0]} /><path d="M31 17.5Q41 22 41 46H33Z" fill={SAND[1]} stroke="none" />
    <path d="M10 42Q22 33 34 19" fill="none" stroke={SAND[1]} strokeWidth="2.2" /><rect x="21.5" y="40" width="5" height="6" rx="2.5" fill="#7a4b2a" />
  </g></Scene>),
  Ranchi: () => (<Scene sky="g0" ground={false}><g {...O}>
    <path d="M0 56V44Q24 26 48 44V56Z" fill={GREEN[0]} /><path d="M30 34Q40 38 48 44V56H34Z" fill={GREEN[1]} stroke="none" />
    <path d="M19 37V30Q24 22 29 30V37Z" fill={MARBLE[0]} /><path d="M24 23V5" /><path d="M24 5h10v2.5H24Z" fill="#ff9933" strokeWidth=".8" /><path d="M24 7.5h10V10H24Z" fill="#fff" strokeWidth=".8" /><path d="M24 10h10v2.5H24Z" fill="#138808" strokeWidth=".8" />
  </g></Scene>),
  Bhopal: () => (<Scene sky="g1" ground={false} water="day"><g {...O}>
    <rect x="10" y="30" width="28" height="17" fill={PINK[0]} /><path d="M29 30h9v17h-9Z" fill={PINK[1]} stroke="none" />
    <path d="M17 30Q17 20 24 18Q31 20 31 30Z" fill={MARBLE[0]} /><path d="M11 30Q11 25 14.5 24Q18 25 18 30Z" fill={MARBLE[0]} /><path d="M30 30Q30 25 33.5 24Q37 25 37 30Z" fill={MARBLE[0]} />
    <rect x="5" y="20" width="3.5" height="27" fill={PINK[0]} /><rect x="39.5" y="20" width="3.5" height="27" fill={PINK[1]} /><circle cx="6.75" cy="19" r="2" fill={MARBLE[0]} /><circle cx="41.25" cy="19" r="2" fill={MARBLE[0]} />
    <path d="M21 47v-7a3 3 0 0 1 6 0v7Z" fill="#7a3fa8" />
  </g></Scene>),
  Gwalior: () => (<Scene sky="g1" ground={false}><g {...O}>
    <path d="M0 56V40L4 33H44L48 40V56Z" fill={LAT[1]} /><rect x="3" y="24" width="42" height="10" fill={LAT[0]} />
    <path d="M3 24v-2h3v2h3v-2h3v2h3v-2h3v2h3v-2h3v2h3v-2h3v2h3v-2h3v2h3v-2h3v2" fill="none" />
    <rect x="3" y="28" width="42" height="1.6" fill="#2bb3c9" stroke="none" />
    {[10, 24, 38].map((x) => <g key={x}><rect x={x - 3.5} y="18" width="7" height="8" fill={LAT[0]} /><path d={`M${x - 3.5} 18Q${x} 12 ${x + 3.5} 18Z`} fill={SAND[0]} /></g>)}
  </g></Scene>),
  Nagpur: () => (<Scene sky="g1"><g {...O}>
    <rect x="13" y="40" width="22" height="6" fill={SAND[1]} /><path d="M18 40L20 16H28L30 40Z" fill={SAND[0]} /><path d="M25 16H28L30 40H26Z" fill={SAND[1]} stroke="none" />
    <path d="M17 16h14l-2-3H19Z" fill={SAND[0]} /><circle cx="24" cy="27" r="3.4" fill="#fffaf0" /><text x="24" y="29.2" textAnchor="middle" fontSize="5" fontWeight="900" fill={K} stroke="none">0</text>
    <path d="M5 46l1-5 3-1 1-2 2 1 1 3 1 4M37 46l1-4 1-3 2-1 1 2 3 1 1 5" fill="#6b4a2a" strokeWidth=".9" />
  </g></Scene>),
  Jodhpur: () => (<Scene sky="g2" ground={false}><g {...O}>
    <path d="M0 56V38L7 33L13 36L19 30L30 32L37 28L48 35V56Z" fill={RED[1]} />
    <rect x="9" y="20" width="30" height="13" fill={RED[0]} /><rect x="15" y="12" width="18" height="9" fill={RED[0]} /><path d="M33 12h6v21h-6Z" fill={RED[1]} stroke="none" opacity=".6" />
    <path d="M15 12v-2h3v2h3v-2h3v2h3v-2h3v2h3v-2" fill="none" />
    {[[4, 46], [10, 49], [34, 47], [40, 50]].map(([x, y]) => <rect key={x} x={x} y={y} width="5" height="5" fill="#5ec8ff" strokeWidth=".9" />)}
  </g></Scene>),
  Udaipur: () => (<Scene sky="g2" ground={false} water="day"><g {...O}>
    <path d="M0 34Q12 24 24 32Q36 22 48 32V47H0Z" fill="#c98d55" opacity=".55" stroke="none" />
    <rect x="7" y="32" width="34" height="15" fill={MARBLE[0]} /><path d="M33 32h8v15h-8Z" fill={MARBLE[1]} stroke="none" />
    {[10, 16, 22, 28, 34].map((x) => <path key={x} d={`M${x} 47v-6a2 2 0 0 1 4 0v6`} fill="#9bb7e6" strokeWidth=".9" />)}
    <path d="M10 32Q10 25 14 25Q18 25 18 32M30 32Q30 25 34 25Q38 25 38 32" fill={MARBLE[0]} />
  </g><rect x="7" y="50" width="34" height="3" fill="#fff" opacity=".35" /></Scene>),
  Jaipur: () => (<Scene sky="g2"><g {...O}>
    <path d="M5 46V31H9V25H14V19H19V12H29V19H34V25H39V31H43V46Z" fill={PINK[0]} /><path d="M29 12V19H34V25H39V31H43V46H33V12Z" fill={PINK[1]} stroke="none" opacity=".55" />
    {[14, 19, 24, 29].map((x) => <circle key={x} cx={x} cy="16" r=".9" fill="#fff" stroke="none" />)}
    {[9, 14, 19, 24, 29, 34, 39].flatMap((x) => [23, 29, 35, 41].filter((y) => !(y < 25 && (x < 14 || x > 34)) && !(y < 30 && (x < 9 || x > 39))).map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="#fff" stroke="none" />))}
    <path d="M19 12Q24 7 29 12" fill={PINK[0]} />
  </g></Scene>),
  Varanasi: () => (<Scene sky="g3" ground={false} water="day"><g {...O}>
    <path d="M0 47V30H10V34H18V38H28V42H48V47Z" fill={SAND[0]} /><path d="M3 30V20Q6 14 9 20V30Z" fill={RED[0]} /><path d="M12 34V24Q15 18 18 24V34Z" fill={RED[0]} />
    <path d="M30 42V36h8v6M29 36q5-5 10 0" fill={SAND[0]} />
  </g><path d="M30 51h10l-2 2.4h-6Z" fill="#7a4b2a" stroke={K} strokeWidth=".8" /><circle cx="35" cy="50" r="1.2" fill="#ffb400" /><path d="M35 52.8v2.6" stroke="#ffb400" strokeWidth="1" opacity=".7" /></Scene>),
  Kanpur: () => (<Scene sky="g3"><g {...O}>
    <rect x="4" y="42" width="40" height="4" fill={GREEN[0]} /><rect x="9" y="32" width="30" height="10" fill={MARBLE[0]} />
    <path d="M18 32V22Q24 10 30 22V32Z" fill={MARBLE[0]} /><path d="M10 32V26Q13.5 19 17 26V32Z" fill={MARBLE[1]} /><path d="M31 32V26Q34.5 19 38 26V32Z" fill={MARBLE[1]} />
    <path d="M24 13V9" /><path d="M21 42v-5a3 3 0 0 1 6 0v5Z" fill="#9a6b3a" />
  </g></Scene>),
  Lucknow: () => (<Scene sky="g3"><g {...O}>
    <path d="M9 46V20H39V46H30V31Q24 22 18 31V46Z" fill={SAND[0]} /><path d="M32 20H39V46H32Z" fill={SAND[1]} stroke="none" />
    <path d="M9 20Q24 6 39 20Z" fill={SAND[0]} /><path d="M12 19q2-3 4 0q2-4 4 0q2-5 4 0q2-4 4 0q2-3 4 0" fill="none" strokeWidth=".9" />
    <rect x="21" y="5" width="6" height="7" fill={SAND[0]} /><path d="M21 5Q24 1 27 5" fill={SAND[0]} />
  </g></Scene>),
  Guwahati: () => (<Scene sky="g4" ground={false} water="day"><g {...O}>
    <path d="M0 47V38Q24 22 48 38V47Z" fill={GREEN[0]} /><path d="M30 30Q40 34 48 38V47H34Z" fill={GREEN[1]} stroke="none" />
    <path d="M15 34Q15 20 24 19Q33 20 33 34Z" fill={RED[0]} /><path d="M27 20.5Q33 24 33 34H28Z" fill={RED[1]} stroke="none" /><rect x="13" y="33" width="22" height="4" fill={SAND[0]} /><path d="M24 19V15" />
  </g></Scene>),
  Bhubaneswar: () => (<Scene sky="g4"><g {...O}>
    <path d="M14 46V20Q14 8 24 6Q34 8 34 20V46Z" fill={LAT[0]} /><path d="M29 8Q34 11 34 20V46H29Z" fill={LAT[1]} stroke="none" />
    <path d="M18 44V16M22 44V12M26 44V12M30 44V16" fill="none" strokeWidth=".8" opacity=".55" />
    <ellipse cx="24" cy="5" rx="6" ry="2" fill={LAT[0]} /><path d="M24 3V0" />
    <path d="M35 46V34Q35 28 40 27Q45 28 45 34V46Z" fill={LAT[0]} /><ellipse cx="40" cy="26.5" rx="3.5" ry="1.2" fill={LAT[0]} />
  </g></Scene>),
  Kolkata: () => (<Scene sky="g4" ground={false} water="day"><g {...O} fill="none" stroke={K}>
    <path d="M9 47V14M39 47V14" stroke={STEEL[1]} strokeWidth="3" /><path d="M9 14H39" stroke={STEEL[1]} strokeWidth="2" />
    <path d="M9 16L1 40M39 16L47 40M9 26L39 14M9 14L39 26" stroke={STEEL[0]} strokeWidth="1.4" />
    <path d="M0 40H48" stroke={STEEL[1]} strokeWidth="2.4" />
  </g><rect x="19" y="35.5" width="9" height="4" rx="1" fill="#ffd23f" stroke={K} strokeWidth=".8" /><circle cx="21" cy="40" r="1" fill={K} /><circle cx="26" cy="40" r="1" fill={K} /></Scene>),
  Vadodara: () => (<Scene sky="g5"><g {...O}>
    <rect x="3" y="28" width="42" height="18" fill={RED[0]} /><rect x="3" y="28" width="42" height="4" fill={SAND[0]} />
    <rect x="19" y="13" width="10" height="33" fill={SAND[0]} /><path d="M19 13Q24 6 29 13Z" fill={RED[0]} /><circle cx="24" cy="19" r="2.4" fill="#fff" />
    {[7, 13, 35, 41].map((x) => <path key={x} d={`M${x - 2.5} 28Q${x} 23 ${x + 2.5} 28Z`} fill={SAND[0]} />)}
    {[7, 13, 35, 41].map((x) => <rect key={`w${x}`} x={x - 1.5} y="34" width="3" height="5" rx="1.5" fill="#fff" strokeWidth=".8" />)}
  </g></Scene>),
  Surat: () => (<Scene sky="g5"><g {...O}>
    {[[3, 34, 9], [12, 30, 8], [28, 32, 8], [37, 36, 8]].map(([x, y, w]) => <rect key={x} x={x} y={y} width={w} height={46 - y} fill="#b8c4e0" strokeWidth=".9" />)}
    <path d="M11 17L17 9H31L37 17L24 36Z" fill="#7fe8ff" /><path d="M11 17H37M17 9L21 17L24 36M31 9L27 17L24 36" fill="none" strokeWidth=".9" />
    <path d="M27 11l2 0M33 14l1 0" stroke="#fff" strokeWidth="1.6" />
  </g></Scene>),
  Ahmedabad: () => (<Scene sky="g5"><g {...O}>
    <rect x="9" y="12" width="5" height="34" fill={SAND[0]} /><rect x="34" y="12" width="5" height="34" fill={SAND[1]} />
    <path d="M11.5 12V7M36.5 12V7M9 20h5M34 20h5M9 28h5M34 28h5" />
    <rect x="14" y="30" width="20" height="16" fill={SAND[0]} /><path d="M20 46V39a4 4 0 0 1 8 0v7Z" fill="#9a6b3a" />
  </g><path d="M6 8Q4 11 6 13M43 7Q45 10 43 12" fill="none" stroke="#fff" strokeWidth=".8" />
    <path d="M21 4l4 3-4 3-4-3Z" fill="#ff4fd8" stroke={K} strokeWidth=".7" /><path d="M21 10q1 3 -1 5" fill="none" stroke={K} strokeWidth=".5" /></Scene>),
  Kochi: () => (<Scene sky="g6" ground={false} water="day"><g {...O} fill="none">
    <path d="M10 47L22 10M34 47L22 10" stroke="#8b5a2b" strokeWidth="2" /><path d="M22 10L44 30" stroke="#8b5a2b" strokeWidth="1.4" />
    <path d="M32 26Q38 38 46 30" stroke="#1b1035" strokeWidth="1" /><path d="M34 28l8 4M36 32l6 -1" stroke={K} strokeWidth=".6" />
  </g><path d="M4 47V28" stroke="#6b4a2a" strokeWidth="1.8" /><path d="M4 28q-5 1-6 5M4 28q5 1 7 5M4 28q-2-4-6-4M4 28q3-4 7-3" fill="none" stroke={GREEN[1]} strokeWidth="1.6" strokeLinecap="round" /></Scene>),
  Chennai: () => (<Scene sky="g6"><g {...O}>
    <path d="M10 46L14 14H34L38 46Z" fill="#f6c35a" /><path d="M29 14H34L38 46H32Z" fill="#d08b2e" stroke="none" />
    <path d="M12.5 38H35.5M13.5 30H34.5M14.5 22H33.5" fill="none" strokeWidth=".9" />
    {([[17, 34, '#ff4fd8'], [24, 26, '#00c97a'], [30, 34, '#2b7bff'], [20, 18, '#ff2d55'], [28, 18, '#00c97a']] as [number, number, string][]).map(([x, y, c]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill={c} stroke="none" />)}
    <path d="M15 14Q24 7 33 14Z" fill="#f6c35a" /><path d="M19 9V6M24 8V4M29 9V6" strokeWidth="1.4" />
    <path d="M21 46v-5a3 3 0 0 1 6 0v5Z" fill="#7a4b2a" />
  </g></Scene>),
  Hyderabad: () => (<Scene sky="g6"><g {...O}>
    <rect x="10" y="22" width="28" height="24" fill={SAND[0]} /><path d="M31 22h7v24h-7Z" fill={SAND[1]} stroke="none" />
    <path d="M17 46V34Q24 24 31 34V46Z" fill="#7a5c9e" /><path d="M10 22H38" />
    {[6, 38].map((x) => <g key={x}><rect x={x} y="8" width="4" height="38" fill={SAND[0]} /><path d={`M${x} 20h4M${x} 30h4`} /><path d={`M${x} 8Q${x + 2} 4 ${x + 4} 8Z`} fill={MARBLE[0]} /></g>)}
    {[14, 20, 26, 32].map((x) => <path key={`a${x}`} d={`M${x} 27v-2a1.5 1.5 0 0 1 3 0v2`} fill="#7a5c9e" strokeWidth=".7" />)}
  </g></Scene>),
  Bengaluru: () => (<Scene sky="g6"><g {...O}>
    <rect x="2" y="42" width="44" height="4" fill={GREEN[0]} /><rect x="4" y="26" width="40" height="16" fill="#c9c3b8" /><path d="M34 26h10v16H34Z" fill="#9e978a" stroke="none" />
    <rect x="16" y="20" width="16" height="6" fill="#c9c3b8" /><path d="M17 20Q24 8 31 20Z" fill="#c9c3b8" /><path d="M24 11V7" />
    {[8, 13, 18, 23, 28, 33, 38].map((x) => <rect key={x} x={x} y="29" width="2" height="13" fill="#fff" strokeWidth=".6" />)}
  </g></Scene>),
  Mumbai: () => (<Scene sky="g7" ground={false} water="night"><g {...O}>
    <rect y="44" width="48" height="3" fill="#d9c4a0" stroke="none" />
    <rect x="8" y="30" width="6" height="15" fill={SAND[0]} /><rect x="34" y="30" width="6" height="15" fill={SAND[1]} />
    <path d="M13 45V22h22v23Z" fill={SAND[0]} /><path d="M28 22.6h6.4v21.8H28Z" fill={SAND[1]} stroke="none" />
    <rect x="12" y="19" width="24" height="3.4" fill="#fff1cf" />
    <path d="M14 19v-5h2.6v5M20 19v-5h2.6v5M25.4 19v-5H28v5M31.4 19v-5H34v5" fill={SAND[0]} />
    <path d="M19 45V33q5-8 10 0v12Z" fill="#5b3fae" /><path d="M9.5 45v-6q1.5-2.5 3 0v6M35.5 45v-6q1.5-2.5 3 0v6" fill="#5b3fae" />
  </g><path d="M3 48.5h7l-1.6 2H4.6Z" fill="#2b49ff" stroke={K} strokeWidth=".8" /><path d="M6.5 48.5V43l3 5.5Z" fill="#fff" stroke={K} strokeWidth=".8" /></Scene>),
};

// --- special tiles ---
const coin = (x: number, y: number) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="4" fill="url(#dk-gold)" stroke={K} strokeWidth=".9" /><text x={x} y={y + 1.6} textAnchor="middle" fontSize="4.4" fontWeight="900" fill="#7a5200">₹</text></g>;
const SPECIALS: Record<string, () => ReactNode> = {
  start: () => (<Scene sky="start" sun={false} ground={false}><g {...O}>
    <rect x="13" y="9" width="22" height="38" rx="4" fill="#1b1035" /><rect x="15" y="13" width="18" height="30" rx="1.5" fill="#fff" stroke="none" />
    <rect x="16.5" y="17" width="15" height="9" rx="2" fill="#00c97a" stroke="none" /><text x="24" y="23.6" textAnchor="middle" fontSize="5" fontWeight="900" fill="#fff" stroke="none">+₹2000</text>
    <path d="M18 30h12M18 34h8" stroke="#c9c2e6" strokeWidth="1.4" />
  </g>{coin(8, 44)}{coin(40, 40)}{coin(6, 30)}</Scene>),
  jail: () => (<Scene sky="jail" sun={false} ground={false}><g {...O}>
    <rect x="5" y="8" width="38" height="20" rx="1.5" fill="#2e6b4f" stroke="#8b5a2b" strokeWidth="2" />
    <text x="24" y="21" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff" stroke="none" fontFamily="sans-serif">62%</text>
    <rect x="9" y="36" width="30" height="4" fill="#c27a45" /><path d="M12 40v7M36 40v7" strokeWidth="1.6" />
    <circle cx="40" cy="5.5" r="3.5" fill="#fff" strokeWidth=".9" /><path d="M40 3.5v2l1.4 1" strokeWidth=".7" />
  </g><circle cx="16" cy="31" r="2.6" fill="#ffcf9e" stroke={K} strokeWidth=".8" /><path d="M14.5 33.5q1.5-1 3 0" fill="none" stroke={K} strokeWidth=".7" /></Scene>),
  police: () => (<Scene sky="police" sun={false} ground={false}><g {...O}>
    <rect x="9" y="16" width="30" height="34" rx="2" fill="#fffaf0" /><path d="M13 23h22M13 29h22M13 35h22M13 41h22" stroke="#c9c2e6" strokeWidth="1" />
    <path d="M30 31l6 6M36 31l-6 6" stroke="#ff2d55" strokeWidth="2.4" />
    <path d="M17 14V9Q24 2 31 9V14Z" fill="#ff2d55" /><rect x="15" y="13" width="18" height="4" rx="1" fill="#555" />
  </g><path d="M10 7l-4-3M38 7l4-3M24 2v-2" stroke="#ffd23f" strokeWidth="1.6" strokeLinecap="round" className="siren" /></Scene>),
  chai: () => (<Scene sky="chai" sun={false} ground={false}><g {...O}>
    <path d="M2 18L24 8L46 18Z" fill="#ff8c42" /><path d="M5 18V46M43 18V46" strokeWidth="1.6" />
    <rect x="4" y="34" width="40" height="12" fill="#8b5a2b" />
    <path d="M10 34V26Q10 22 15 22Q20 22 20 26V34Z" fill="#9aa7b8" /><path d="M20 26q4 0 5 3" fill="none" />
    <path d="M27 34l1-6h5l1 6Z" fill="#c4713a" /><path d="M35 34l1-6h5l1 6Z" fill="#c4713a" />
    <ellipse cx="24" cy="43" rx="5" ry="3.5" fill="url(#dk-gold)" /><rect x="22" y="39.5" width="4" height="1" fill={K} stroke="none" />
  </g><path d="M13 19q-1-3 1-5M17 19q-1-3 1-5" fill="none" stroke="#fff" strokeWidth=".9" opacity=".8" /></Scene>),
  kismat: () => (<Scene sky="kismat" sun={false} ground={false}>
    {[[8, 10], [40, 12], [12, 44], [38, 46], [24, 6]].map(([x, y]) => <path key={x} d={`M${x} ${y - 3}l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z`} fill="#fff" />)}
    <path d="M12 28a12 12 0 1 1 12 12a8 8 0 1 1 -8 -8a4 4 0 1 1 4 4" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </Scene>),
  parivaar: () => (<Scene sky="parivaar" sun={false} ground={false}><g {...O}>
    <rect x="12" y="6" width="24" height="44" rx="4" fill="#1b1035" /><rect x="14" y="10" width="20" height="36" rx="1.5" fill="#ece5dd" stroke="none" />
    <rect x="15.5" y="13" width="12" height="5" rx="2" fill="#fff" stroke="none" /><rect x="20" y="20.5" width="12" height="5" rx="2" fill="#d9fdd3" stroke="none" />
    <rect x="15.5" y="28" width="10" height="5" rx="2" fill="#fff" stroke="none" /><rect x="22" y="35.5" width="10" height="5" rx="2" fill="#d9fdd3" stroke="none" />
  </g><circle cx="37" cy="8" r="5" fill="#ff2d55" stroke={K} strokeWidth=".9" /><text x="37" y="10" textAnchor="middle" fontSize="4.6" fontWeight="900" fill="#fff">99+</text></Scene>),
  tax: () => (<Scene sky="tax" sun={false} ground={false}><g {...O}>
    <path d="M10 6H38V50L34 47L30 50L26 47L22 50L18 47L14 50L10 47Z" fill="#fffaf0" /><path d="M15 14H33M15 20H33M15 26H27" stroke="#c9c2e6" strokeWidth="1.2" />
    <circle cx="30" cy="37" r="7" fill="#ff2d55" /><text x="30" y="40" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff" stroke="none">₹</text>
  </g></Scene>),
  metro: () => (<Scene sky="train" sun={false}><g {...O}>
    <rect x="4" y="18" width="40" height="22" rx="5" fill="#ff4fd8" /><rect x="8" y="22" width="9" height="8" rx="1.5" fill="#cfe3ff" /><rect x="20" y="22" width="9" height="8" rx="1.5" fill="#cfe3ff" /><rect x="32" y="22" width="9" height="8" rx="1.5" fill="#cfe3ff" />
    <rect x="4" y="33" width="40" height="2" fill="#fff" stroke="none" /><circle cx="12" cy="42" r="2.4" fill="#333" /><circle cx="36" cy="42" r="2.4" fill="#333" />
  </g></Scene>),
  bike: () => (<Scene sky="train" sun={false}><g {...O}>
    <circle cx="12" cy="40" r="5" fill="#333" /><circle cx="36" cy="40" r="5" fill="#333" /><circle cx="12" cy="40" r="2" fill="#aaa" /><circle cx="36" cy="40" r="2" fill="#aaa" />
    <path d="M12 40L20 30H32L36 40" fill="none" strokeWidth="2" /><path d="M18 30h16l2-6h-6" fill="#ffd23f" /><path d="M33 22l3-4" strokeWidth="1.8" />
    <circle cx="25" cy="18" r="4" fill="#ffcf9e" /><path d="M21 17q4-6 8 0" fill="#00c97a" />
  </g></Scene>),
  bus: () => (<Scene sky="train" sun={false}><g {...O}>
    <rect x="3" y="16" width="42" height="24" rx="4" fill="#2b7bff" />{[6, 14, 22, 30].map((x) => <rect key={x} x={x} y="20" width="6" height="7" rx="1" fill="#cfe3ff" />)}
    <rect x="37" y="20" width="6" height="12" rx="1" fill="#cfe3ff" /><path d="M3 31H37" stroke="#ffd23f" strokeWidth="2" /><circle cx="12" cy="41" r="3" fill="#333" /><circle cx="36" cy="41" r="3" fill="#333" />
  </g><text x="20" y="12" textAnchor="middle" fontSize="5" fontWeight="900" fill={K}>Zz</text></Scene>),
  vande: () => (<Scene sky="train" sun={false}><g {...O}>
    <path d="M2 40V24Q2 18 10 18H34Q46 20 46 34V40Z" fill="#fffaf0" /><path d="M34 18Q46 20 46 34H38Q38 24 34 18Z" fill="#2b49ff" />
    <path d="M2 32H44" stroke="#ff8c42" strokeWidth="2.4" /><rect x="7" y="22" width="7" height="6" rx="1" fill="#2b49ff" /><rect x="17" y="22" width="7" height="6" rx="1" fill="#2b49ff" /><rect x="27" y="22" width="5" height="6" rx="1" fill="#2b49ff" />
  </g></Scene>),
  wifi: () => (<Scene sky="util" sun={false} ground={false}><g {...O}>
    <rect x="10" y="36" width="28" height="9" rx="2" fill="#1b1035" /><path d="M16 36L13 30M32 36L35 30" strokeWidth="1.6" />
    <circle cx="16" cy="40.5" r="1" fill="#00c97a" stroke="none" /><circle cx="20" cy="40.5" r="1" fill="#00c97a" stroke="none" />
  </g>{[6, 11, 16].map((r) => <path key={r} d={`M${24 - r} 28a${r} ${r} 0 0 1 ${r * 2} 0`} fill="none" stroke="#2b7bff" strokeWidth="2.4" strokeLinecap="round" />)}</Scene>),
  recharge: () => (<Scene sky="util" sun={false} ground={false}><g {...O}>
    <rect x="14" y="8" width="20" height="40" rx="4" fill="#1b1035" /><rect x="16" y="12" width="16" height="32" rx="1.5" fill="#fff" stroke="none" />
    {[0, 1, 2, 3].map((k) => <rect key={k} x={18 + k * 3.4} y={34 - k * 4} width="2.4" height={4 + k * 4} fill="#00c97a" stroke="none" />)}
    <path d="M27 16l-4 6h3l-2 5 5-7h-3l2-4Z" fill="#ffd23f" strokeWidth=".7" />
  </g></Scene>),
};

export const MONUMENTS: Record<string, { label: string }> = {
  Patna: { label: 'Golghar' }, Ranchi: { label: 'Pahari Mandir' }, Bhopal: { label: 'Taj-ul-Masajid' }, Gwalior: { label: 'Gwalior Fort' },
  Nagpur: { label: 'Zero Mile' }, Jodhpur: { label: 'Mehrangarh Fort' }, Udaipur: { label: 'Lake Palace' }, Jaipur: { label: 'Hawa Mahal' },
  Varanasi: { label: 'Dashashwamedh Ghat' }, Kanpur: { label: 'JK Temple' }, Lucknow: { label: 'Rumi Darwaza' }, Guwahati: { label: 'Kamakhya Temple' },
  Bhubaneswar: { label: 'Lingaraj Temple' }, Kolkata: { label: 'Howrah Bridge' }, Vadodara: { label: 'Laxmi Vilas Palace' }, Surat: { label: 'Diamond City' },
  Ahmedabad: { label: 'Jhulta Minar' }, Kochi: { label: 'Chinese Fishing Nets' }, Chennai: { label: 'Kapaleeshwarar' }, Hyderabad: { label: 'Charminar' },
  Bengaluru: { label: 'Vidhana Soudha' }, Mumbai: { label: 'Gateway of India' },
};

const TRAIN_ART: Record<string, string> = { 'Midnight Metro': 'metro', 'Bike Taxi': 'bike', 'Sleeper Bus': 'bus', 'Vande Bharat': 'vande' };

/** Picture for any tile: a landmark postcard for cities, a matching scene for everything else. */
export function TilePic({ kind, name, className = '' }: { kind: string; name: string; color?: string; className?: string }) {
  const draw = kind === 'city' ? LANDMARKS[name]
    : kind === 'train' ? SPECIALS[TRAIN_ART[name] ?? 'metro']
    : kind === 'utility' ? SPECIALS[name.includes('WiFi') ? 'wifi' : 'recharge']
    : SPECIALS[kind];
  if (!draw) return null;
  return <svg viewBox="0 0 48 56" preserveAspectRatio="xMidYMax slice" className={`tile-art ${className}`}>{draw()}</svg>;
}
/** Back-compat alias. */
export const Monument = ({ city, className }: { city: string; color?: string; className?: string }) => <TilePic kind="city" name={city} className={className} />;

/** Small building symbols for the colour band. */
export function Buildings({ n }: { n: number }) {
  if (!n) return null;
  if (n >= 5) return <svg viewBox="0 0 24 18" className="bld villa"><path d="M2 17V9h4V6l6-5 6 5v3h4v8Z" fill="url(#dk-gold)" stroke={K} strokeWidth="1.3" strokeLinejoin="round" /><path d="M10 17v-4a2 2 0 0 1 4 0v4" fill={K} /></svg>;
  if (n === 4) return <svg viewBox="0 0 18 18" className="bld hotel"><rect x="2" y="2" width="14" height="15" rx="1.5" fill="#ff2d55" stroke={K} strokeWidth="1.3" /><text x="9" y="13.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff">H</text></svg>;
  return <span className="bld-houses">{Array.from({ length: n }, (_, k) => <svg key={k} viewBox="0 0 12 12" className="bld house"><path d="M1.5 11V5.5L6 1.5l4.5 4V11Z" fill="#fff" stroke={K} strokeWidth="1.2" strokeLinejoin="round" /></svg>)}</span>;
}

export type SethMood = 'idle' | 'happy' | 'shocked' | 'sad' | 'count' | 'party';

/** Seth-ji: the cool-uncle banker. Mood drives the expression and animation via CSS. */
export function SethJi({ mood = 'idle', shades = false }: { mood?: SethMood; shades?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className="sethji" data-mood={mood} aria-label="Seth-ji the banker">
      <g stroke={K} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="60" cy="115" rx="50" ry="4" fill="#000" opacity=".25" stroke="none" />
        <g className="sj-body">
          <path d="M28 98Q28 66 60 63Q92 66 92 98Z" fill="#6c2bd9" />
          <path d="M60 70V98" fill="none" />
          <path d="M51 63h18l-3 7H54Z" fill="#fff3d6" />
          <path d="M70 76l4-4 4 4Z" fill="#ff4fd8" strokeWidth="1.4" />
          <path d="M57.4 76h.1M57.4 83h.1" stroke="#ffd23f" strokeWidth="3" />
        </g>
        <g className="sj-head">
          <circle cx="39" cy="45" r="4.5" fill="#d9976a" /><circle cx="81" cy="45" r="4.5" fill="#d9976a" />
          <rect x="80.5" y="45" width="3" height="6" rx="1.5" fill="#fff" strokeWidth="1.2" />
          <circle cx="60" cy="43" r="21" fill="#d9976a" />
          <path d="M39 40Q38 21 60 20Q82 21 81 40Q78 30 66 28Q56 27 47 31Q42 34 39 40Z" fill="#2a1a14" />
          <path d="M66 22Q73 24 76 31" fill="none" stroke="#d7d2e6" strokeWidth="2" />
          <ellipse cx="46" cy="51" rx="3.5" ry="2" fill="#ff7a8a" opacity=".45" stroke="none" />
          <ellipse cx="74" cy="51" rx="3.5" ry="2" fill="#ff7a8a" opacity=".45" stroke="none" />
          <g className="sj-brows" fill="none"><path className="b-l" d="M47 34q5-3 10 0" /><path className="b-r" d="M63 34q5-3 10 0" /></g>
          <g className="sj-eyes">
            <g className="e e-open"><circle cx="52" cy="43" r="2.4" fill={K} stroke="none" /><circle cx="68" cy="43" r="2.4" fill={K} stroke="none" /></g>
            <path className="e e-happy" d="M48.5 44.5q3.5-4 7 0M64.5 44.5q3.5-4 7 0" fill="none" />
            <g className="e e-shock" strokeWidth="1.4"><circle cx="52" cy="43" r="3.6" fill="#fff" /><circle cx="68" cy="43" r="3.6" fill="#fff" /><circle cx="52" cy="43" r="1.3" fill={K} /><circle cx="68" cy="43" r="1.3" fill={K} /></g>
            <path className="e e-sad" d="M48.5 42q3.5 3 7 0M64.5 42q3.5 3 7 0" fill="none" />
          </g>
          <g className="sj-glasses" fill="rgba(255,255,255,.18)" stroke="#c9961a" strokeWidth="1.8"><circle cx="52" cy="43" r="6.5" /><circle cx="68" cy="43" r="6.5" /><path d="M58.5 43h3" /></g>
          <g className={`sj-shades ${shades ? 'on' : ''}`} stroke="none"><path d="M44 39h32v3q-1 7-8 7q-6 0-7-6h-2q-1 6-7 6q-7 0-8-7Z" fill="#111" /><path d="M47 41h4M65 41h4" stroke="#fff" strokeWidth="1.2" /></g>
          <path d="M49 53q5-4.5 11-1.5q6-3 11 1.5q-5 2.5-11 .5q-6 2-11-.5Z" fill="#2a1a14" strokeWidth="1.2" />
          <g className="sj-mouth" fill="none">
            <path className="m m-idle" d="M55 57.5q5 3 10 0" />
            <path className="m m-happy" d="M52 55.5q8 9 16 0Z" fill="#7a1f2b" />
            <ellipse className="m m-shock" cx="60" cy="58.5" rx="3.2" ry="4" fill="#7a1f2b" />
            <path className="m m-sad" d="M55 60q5-3.5 10 0" />
          </g>
          <g className="sj-fx" strokeWidth="1.2">
            <path className="fx fx-sweat" d="M83 26q4 6 0 8q-4-2 0-8Z" fill="#8fd8ff" />
            <path className="fx fx-tear" d="M50 48q2.5 4 0 5.5q-2.5-1.5 0-5.5Z" fill="#8fd8ff" />
            <path className="fx fx-spark" d="M102 40l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5Z" fill="#fff" />
          </g>
        </g>
        <g className="sj-desk">
          <rect x="10" y="90" width="100" height="26" rx="5" fill="#8a4b2a" />
          <rect x="6" y="86" width="108" height="7" rx="3" fill="#c27a45" />
          <rect x="46" y="98" width="28" height="12" rx="3" fill="#ffd23f" />
          <text x="60" y="107.5" textAnchor="middle" fontSize="10" fontWeight="900" fill={K} stroke="none">₹</text>
          <g className="sj-stack" fill="#ffd23f" strokeWidth="1.5"><ellipse cx="106" cy="84" rx="7" ry="2.6" /><ellipse cx="106" cy="80" rx="7" ry="2.6" /><ellipse cx="106" cy="76" rx="7" ry="2.6" fill="#ffe08a" /></g>
        </g>
        <g className="sj-arm-l">
          <rect x="16" y="64" width="15" height="24" rx="3" fill={K} transform="rotate(-8 23 76)" />
          <rect x="18.5" y="67" width="10" height="10" fill="#fff" stroke="none" transform="rotate(-8 23 76)" />
          <path d="M19.5 68h3v3h-3zM24.5 68h3v3h-3zM19.5 73h3v3h-3zM24.5 73.5h1.5v1.5h-1.5z" fill={K} stroke="none" transform="rotate(-8 23 76)" />
          <path d="M36 70Q26 74 28 84h7q0-6 5-8Z" fill="#6c2bd9" />
          <circle cx="30" cy="83" r="5" fill="#d9976a" />
        </g>
        <g className="sj-arm-r">
          <path d="M84 70Q96 72 96 84l-8 1q0-7-8-8Z" fill="#6c2bd9" />
          <circle cx="93" cy="85" r="5" fill="#d9976a" />
          <circle cx="99" cy="79" r="5.5" fill="#ffd23f" strokeWidth="1.6" />
        </g>
      </g>
    </svg>
  );
}
/** Back-compat alias used by the guide. */
export const Banker = ({ mood }: { mood?: string }) => <SethJi mood={mood === 'paying' ? 'count' : ((mood as SethMood) || 'idle')} />;
