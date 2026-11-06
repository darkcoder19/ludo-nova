// Haat Hustle art: land plots, goods icons and buildings, all drawn as SVG (no emoji).
import type { Good, Terrain } from './data';

const K = '#1b1035';

/** One land plot, drawn to fill a square. */
export function PlotArt({ t }: { t: Terrain }) {
  return (
    <svg viewBox="0 0 60 60" className="hh-plot-art" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {t === 'cotton' && (<>
        <rect width="60" height="60" fill="#9ed36a" />
        {[10, 24, 38, 52].map((y) => <path key={y} d={`M0 ${y}h60`} stroke="#86bd55" strokeWidth="3" />)}
        {[[12, 14], [32, 12], [50, 18], [20, 32], [42, 30], [10, 48], [30, 46], [50, 46]].map(([x, y], k) => (
          <g key={k}><circle cx={x} cy={y + 3} r="5" fill="#4f8f2f" /><circle cx={x - 2} cy={y} r="3" fill="#fff" /><circle cx={x + 2} cy={y + 1} r="3" fill="#fff" /><circle cx={x} cy={y - 2} r="3" fill="#fff" /></g>
        ))}
      </>)}
      {t === 'spice' && (<>
        <rect width="60" height="60" fill="#e8b26a" />
        <path d="M0 40q30-10 60 0V60H0Z" fill="#d49a52" />
        {[[12, 16], [34, 10], [50, 24], [22, 36], [44, 44], [10, 50]].map(([x, y], k) => (
          <g key={k}>
            <path d={`M${x} ${y + 10}v-8`} stroke="#3c7a2a" strokeWidth="2" />
            <path d={`M${x} ${y + 2}q-6 2-5 10q3-2 5-10Z`} fill="#e3242b" stroke={K} strokeWidth=".6" />
            <path d={`M${x} ${y + 2}q6 1 6 9q-4-3-6-9Z`} fill="#ff4d4d" stroke={K} strokeWidth=".6" />
          </g>
        ))}
      </>)}
      {t === 'tea' && (<>
        <rect width="60" height="60" fill="#7fd1a0" />
        {[8, 20, 32, 44, 56].map((y, k) => <path key={y} d={`M-4 ${y}q16-${8 - k} 34 0t34 0`} fill="none" stroke="#2e8b57" strokeWidth="6" strokeLinecap="round" />)}
        {[8, 20, 32, 44, 56].map((y) => <path key={`l${y}`} d={`M-4 ${y - 3}q16-6 34 0t34 0`} fill="none" stroke="#4cbf7a" strokeWidth="2" strokeDasharray="2 4" />)}
      </>)}
      {t === 'brick' && (<>
        <rect width="60" height="60" fill="#c98a5a" />
        <path d="M0 44h60V60H0Z" fill="#a8693e" />
        <rect x="34" y="12" width="8" height="30" fill="#5a3a2a" stroke={K} strokeWidth="1" />
        <circle cx="40" cy="8" r="5" fill="#d9d4e6" opacity=".9" /><circle cx="46" cy="4" r="4" fill="#d9d4e6" opacity=".7" />
        {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}${c}`} x={6 + c * 7 + (r % 2) * 3} y={46 - r * 5} width="6" height="4" rx=".6" fill="#e2733a" stroke="#8a3e1a" strokeWidth=".6" />))}
      </>)}
      {t === 'rice' && (<>
        <rect width="60" height="60" fill="#6fb7e8" />
        {[14, 30, 46].map((y) => <path key={y} d={`M2 ${y + 6}h56`} stroke="#9fd2f5" strokeWidth="1.5" strokeDasharray="6 5" />)}
        {[[8, 12], [22, 12], [36, 12], [50, 12], [15, 28], [29, 28], [43, 28], [8, 44], [22, 44], [36, 44], [50, 44]].map(([x, y], k) => (
          <g key={k} stroke="#3c9a3c" strokeWidth="1.6" strokeLinecap="round"><path d={`M${x} ${y + 8}l-3-8`} /><path d={`M${x} ${y + 8}v-9`} /><path d={`M${x} ${y + 8}l3-8`} /></g>
        ))}
      </>)}
      {t === 'mandi' && (<>
        <rect width="60" height="60" fill="#ffe6a8" />
        <path d="M4 24l8-10h36l8 10Z" fill="#ff8c42" stroke={K} strokeWidth="1.2" />
        {[0, 1, 2, 3, 4].map((k) => <path key={k} d={`M${12 + k * 9} 14l-3 10h6Z`} fill="#ffd23f" />)}
        <rect x="8" y="24" width="44" height="22" fill="#fffaf0" stroke={K} strokeWidth="1.2" />
        {[14, 26, 38].map((x, k) => <circle key={x} cx={x + 4} cy="38" r="4" fill={['#e3242b', '#3fbf6a', '#ffd23f'][k]} stroke={K} strokeWidth=".8" />)}
        <circle cx="30" cy="32" r="0" />
        <text x="30" y="56" textAnchor="middle" fontSize="8" fontWeight="900" fill={K}>MANDI</text>
      </>)}
      {t === 'banjar' && (<>
        <rect width="60" height="60" fill="#e6cf9a" />
        <path d="M6 14l10 6 4 12 10 4M40 8l-6 14 8 10 12 2M10 44l12-4 8 10M36 52l8-8 12 2" fill="none" stroke="#b89c62" strokeWidth="1.4" />
        <path d="M30 46v-14m0 6h-5v-6m5 4h5v-8" stroke="#5f9a3a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </>)}
    </svg>
  );
}

/** Small icon for a good. */
export function GoodIcon({ g, size = 20 }: { g: Good; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`hh-good ${g}`} aria-label={g}>
      {g === 'cotton' && (<><circle cx="12" cy="16" r="5" fill="#4f8f2f" /><circle cx="8" cy="10" r="5" fill="#fff" stroke={K} strokeWidth=".8" /><circle cx="16" cy="10" r="5" fill="#fff" stroke={K} strokeWidth=".8" /><circle cx="12" cy="6" r="5" fill="#fff" stroke={K} strokeWidth=".8" /></>)}
      {g === 'spice' && (<><path d="M14 3c3 0 4 2 3 4" stroke="#3c7a2a" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M16 7C20 12 12 21 5 21c3-3 6-9 8-14 1-1 2-1 3 0Z" fill="#e3242b" stroke={K} strokeWidth=".9" /></>)}
      {g === 'tea' && (<><path d="M4 20C4 9 12 3 20 4c1 9-6 16-16 16Z" fill="#3fbf6a" stroke={K} strokeWidth=".9" /><path d="M5 19L18 6" stroke="#2e8b57" strokeWidth="1.2" /></>)}
      {g === 'brick' && (<><rect x="2" y="7" width="20" height="11" rx="1.5" fill="#e2733a" stroke={K} strokeWidth=".9" /><path d="M2 12.5h20M9 7v5.5M15 12.5V18" stroke="#8a3e1a" strokeWidth="1" /></>)}
      {g === 'rice' && (<><path d="M12 22V9" stroke="#8a6a1a" strokeWidth="1.6" />{[[7, 6], [17, 6], [6, 11], [18, 11], [9, 15], [15, 15], [12, 4]].map(([x, y], k) => <ellipse key={k} cx={x} cy={y} rx="2.4" ry="3.4" fill="#ffd23f" stroke={K} strokeWidth=".7" transform={`rotate(${x < 12 ? -30 : x > 12 ? 30 : 0} ${x} ${y})`} />)}</>)}
    </svg>
  );
}

/** A stall, godown or haveli in its owner's colour. */
export function BuildingArt({ level, color }: { level: number; color: string }) {
  if (level <= 0) return null;
  return (
    <svg viewBox="0 0 40 32" className={`hh-bld lv${level}`} aria-hidden>
      <ellipse cx="20" cy="30" rx="16" ry="2.5" fill="#000" opacity=".25" />
      {level === 1 && (<>
        <rect x="10" y="16" width="20" height="12" fill="#fffaf0" stroke={K} strokeWidth="1.2" />
        <path d="M6 17l4-9h20l4 9Z" fill={color} stroke={K} strokeWidth="1.2" />
        <path d="M14 8l-2 9M20 8v9M26 8l2 9" stroke="#fff" strokeWidth="1.6" opacity=".8" />
        <rect x="15" y="21" width="10" height="7" fill={color} opacity=".55" />
      </>)}
      {level === 2 && (<>
        <rect x="6" y="13" width="28" height="15" fill="#fffaf0" stroke={K} strokeWidth="1.2" />
        <path d="M3 14L20 4l17 10Z" fill={color} stroke={K} strokeWidth="1.2" />
        <rect x="15" y="18" width="10" height="10" fill={color} stroke={K} strokeWidth="1" />
        <path d="M15 21h10M15 24h10" stroke="#fff" strokeWidth="1" opacity=".7" />
      </>)}
      {level === 3 && (<>
        <rect x="5" y="14" width="30" height="14" fill="#fffaf0" stroke={K} strokeWidth="1.2" />
        <path d="M13 14a7 7 0 0 1 14 0Z" fill={color} stroke={K} strokeWidth="1.2" />
        <path d="M5 14h6v-5h-6ZM29 14h6v-5h-6Z" fill={color} stroke={K} strokeWidth="1" />
        <path d="M20 7V2l5 2-5 2" fill="#ffd23f" stroke={K} strokeWidth=".8" />
        {[9, 15, 21, 27].map((x) => <path key={x} d={`M${x} 28v-6a2 2 0 0 1 4 0v6`} fill={color} opacity=".8" />)}
      </>)}
    </svg>
  );
}
