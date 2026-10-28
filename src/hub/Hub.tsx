import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { BannerStrip } from '../ads/AdViews';
import { adsEnabled } from '../ads/premium';
import { useAccount } from '../account/account';
import { AccountBar, AdminDashboard, UpgradeStrip } from '../account/AccountViews';
import { Avatar } from '../components/Avatar';
import { Backdrop } from '../components/Home';
import { sfx } from '../game/sound';
import { GAMES, gameUrl, type GameInfo } from './games';

/** sarvimo.com/games — the game picker. */
export function Hub() {
  const me = useAccount();
  const [all, setAll] = useState(false);
  const [admin, setAdmin] = useState(() => new URLSearchParams(location.search).has('admin'));
  if (admin && me?.admin) return <AdminDashboard onClose={() => { setAdmin(false); history.replaceState(null, '', location.pathname); }} />;
  const shown = all ? GAMES : GAMES.slice(0, 2);
  return (
    <div className="screen hub">
      <Backdrop />
      <header className="hub-head">
        <img src={`${import.meta.env.BASE_URL}sarvimo-icon.png`} alt="" />
        <div>
          <h1>Sarvimo <em>Games</em></h1>
          <p>Free multiplayer games. Make a room, share the code, play.</p>
        </div>
      </header>
      <AccountBar onAdmin={() => setAdmin(true)} />
      <UpgradeStrip />

      <div className="hub-row">
        <b>🎮 Games</b>
        <button className="btn ghost xs" onClick={() => { sfx.tap(); setAll(!all); }}>{all ? 'Show less' : `Show all (${GAMES.length})`}</button>
      </div>

      <section className="gcards">
        {shown.map((g, i) => <GameCard key={g.slug} g={g} i={i} />)}
      </section>

      {adsEnabled() && <BannerStrip />}
      <footer className="foot">© Sarvimo · Free to play · Install any game on your phone</footer>
    </div>
  );
}

const PEEKERS: Record<string, string[]> = { ludonova: ['c3', 'c8'], seedhirush: ['c1', 'c12'], dhandhaking: ['c13', 'c5'] };

function GameCard({ g, i }: { g: GameInfo; i: number }) {
  const el = useRef<HTMLAnchorElement>(null);
  const [going, setGoing] = useState(false);
  const tilt = (e: PointerEvent) => {
    const r = el.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.current!.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
    el.current!.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
    el.current!.style.setProperty('--gx', `${x * 100}%`);
    el.current!.style.setProperty('--gy', `${y * 100}%`);
  };
  const reset = () => { el.current?.style.setProperty('--rx', '0deg'); el.current?.style.setProperty('--ry', '0deg'); };
  return (
    <a ref={el} className={`gcard g-${g.slug} ${going ? 'going' : ''}`} href={gameUrl(g.slug)}
      style={{ ['--a' as string]: g.colors[0], ['--b' as string]: g.colors[1], animationDelay: `${i * 110}ms` }}
      onPointerMove={tilt} onPointerLeave={reset}
      onClick={(e) => { e.preventDefault(); sfx.six(); setGoing(true); setTimeout(() => (location.href = gameUrl(g.slug)), 420); }}>
      <div className="gc-scene">{SCENES[g.slug]}</div>
      <div className="gc-glare" />
      <div className="gc-peek">{PEEKERS[g.slug]?.map((a, k) => <Avatar key={a} id={a} size={k ? 44 : 56} hyped />)}</div>
      <div className="gc-body">
        <div className="gc-tags"><span>{g.kind}</span><span className="live">● Live</span></div>
        <h2>{g.name}</h2>
        <p>{g.tagline}</p>
        <div className="gc-foot">
          <span>👥 {g.players} · Free</span>
          <span className="gc-play">Play <i>▶</i></span>
        </div>
      </div>
    </a>
  );
}

const SCENES: Record<string, ReactNode> = {
  ludonova: (
    <svg viewBox="0 0 200 120" className="scene">
      <g className="ln-board">
        <rect x="60" y="10" width="80" height="80" rx="10" fill="#fff" />
        <rect x="64" y="14" width="30" height="30" rx="6" fill="#ff2d55" /><rect x="106" y="14" width="30" height="30" rx="6" fill="#00c97a" />
        <rect x="64" y="56" width="30" height="30" rx="6" fill="#2b7bff" /><rect x="106" y="56" width="30" height="30" rx="6" fill="#ffb400" />
        <path d="M100 50 L88 38 L112 38 Z" fill="#00c97a" /><path d="M100 50 L112 62 L88 62 Z" fill="#2b7bff" />
        <circle cx="100" cy="50" r="5" fill="#1b1035" />
      </g>
      <g className="ln-die d1"><rect x="20" y="62" width="30" height="30" rx="7" fill="#fff" stroke="#1b1035" strokeWidth="2" /><circle cx="29" cy="71" r="3" fill="#1b1035" /><circle cx="41" cy="83" r="3" fill="#1b1035" /><circle cx="35" cy="77" r="3" fill="#ff2d55" /></g>
      <g className="ln-die d2"><rect x="152" y="58" width="28" height="28" rx="7" fill="#fff" stroke="#1b1035" strokeWidth="2" />{[[160, 66], [172, 66], [160, 78], [172, 78]].map(([x, y]) => <circle key={x + '' + y} cx={x} cy={y} r="3" fill="#1b1035" />)}</g>
      {[['#ff2d55', 30, 20], ['#2b7bff', 170, 18], ['#ffb400', 44, 40]].map(([c, x, y], k) => <circle key={k} className={`ln-spark s${k}`} cx={x as number} cy={y as number} r="4" fill={c as string} />)}
    </svg>
  ),
  seedhirush: (
    <svg viewBox="0 0 200 120" className="scene">
      {Array.from({ length: 24 }, (_, k) => <rect key={k} x={40 + (k % 6) * 20} y={6 + Math.floor(k / 6) * 20} width="19" height="19" rx="4" fill={['#ffe8a3', '#ffd6e0', '#cdf5e1', '#d6e6ff'][(k + Math.floor(k / 6)) % 4]} />)}
      <g className="sr-ladder"><path d="M60 88 L76 10 M76 90 L92 12" stroke="#8b5a2b" strokeWidth="4" strokeLinecap="round" />{[74, 58, 42, 26].map((y) => <path key={y} d={`M${63 + (88 - y) * 0.2} ${y} L${79 + (88 - y) * 0.2} ${y}`} stroke="#a0693a" strokeWidth="3" />)}</g>
      <path className="sr-snake" d="M150 14 C120 30 168 46 136 58 C108 70 150 82 124 94" fill="none" stroke="#00c97a" strokeWidth="10" strokeLinecap="round" />
      <g className="sr-head"><ellipse cx="150" cy="14" rx="11" ry="9" fill="#00c97a" stroke="#1b1035" strokeWidth="2" /><circle cx="154" cy="10" r="2.6" fill="#fff" /><circle cx="155" cy="10" r="1.3" fill="#111" /><path d="M160 15 l8 0 m0 0 l3 -3 m-3 3 l3 3" stroke="#ff2d55" strokeWidth="1.6" className="sr-tongue" /></g>
      <g className="sr-climber"><circle cx="76" cy="60" r="8" fill="#ff9a3c" stroke="#1b1035" strokeWidth="2" /><circle cx="73" cy="58" r="1.6" fill="#1b1035" /><circle cx="79" cy="58" r="1.6" fill="#1b1035" /><path d="M72 63 q4 3 8 0" stroke="#1b1035" strokeWidth="1.6" fill="none" /></g>
    </svg>
  ),
  dhandhaking: (
    <svg viewBox="0 0 200 120" className="scene">
      <g className="dk-sky">
        {[[40, 50, '#9b6bff'], [58, 30, '#2b49ff'], [80, 60, '#ff8c42'], [100, 20, '#ff2d55'], [124, 44, '#00c97a'], [144, 36, '#ffd23f']].map(([x, h, c], k) => (
          <g key={k} className={`bld b${k}`}>
            <rect x={x as number} y={110 - (h as number) - 40} width="18" height={(h as number) + 40} fill={c as string} stroke="#1b1035" strokeWidth="2" />
            {Array.from({ length: Math.floor(((h as number) + 30) / 12) }, (_, w) => <rect key={w} x={(x as number) + 4} y={110 - (h as number) - 34 + w * 12} width="10" height="5" fill="#fff6c8" opacity="0.85" />)}
          </g>
        ))}
        <rect x="20" y="108" width="160" height="6" rx="3" fill="#1b1035" />
      </g>
      {[30, 70, 110, 150, 175].map((x, k) => <g key={k} className={`coin c${k}`}><circle cx={x} cy="-10" r="7" fill="#ffd23f" stroke="#b8860b" strokeWidth="2" /><text x={x} y="-6.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#7a5200">₹</text></g>)}
    </svg>
  ),
};

/** Placeholder page for games that are still being built. */
export function ComingSoon({ g }: { g: GameInfo }) {
  return (
    <div className="screen hub">
      <Backdrop />
      <div className="topbar"><a className="btn ghost sm" href={import.meta.env.BASE_URL}>← All games</a></div>
      <h2 style={{ textAlign: 'center' }}>{g.name} is coming soon</h2>
    </div>
  );
}
