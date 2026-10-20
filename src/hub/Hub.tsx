import { useState } from 'react';
import { BannerStrip } from '../ads/AdViews';
import { adsEnabled } from '../ads/premium';
import { Backdrop } from '../components/Home';
import { GAMES, gameUrl, type GameInfo } from './games';

/** sarvimo.com/games — tiles for every game. */
export function Hub() {
  const [all, setAll] = useState(false);
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

      <div className="hub-row">
        <b>Games</b>
        <button className="btn ghost xs" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all (${GAMES.length})`}</button>
      </div>

      <section className={`tiles ${all ? 'all' : ''}`}>
        {shown.map((g, i) => <Tile key={g.slug} g={g} i={i} />)}
      </section>

      {adsEnabled() && <BannerStrip />}
      <footer className="foot">© Sarvimo · Free to play</footer>
    </div>
  );
}

function Tile({ g, i }: { g: GameInfo; i: number }) {
  return (
    <a className={`tile ${g.ready ? '' : 'soon'}`} href={gameUrl(g.slug)} style={{ ['--a' as string]: g.colors[0], ['--b' as string]: g.colors[1], animationDelay: `${i * 80}ms` }}>
      <div className="tile-art"><TileArt slug={g.slug} /></div>
      <div className="tile-body">
        <small>{g.kind}</small>
        <b>{g.name}</b>
        <p>{g.tagline}</p>
        <div className="tile-foot"><span>{g.players}</span><span className="play">{g.ready ? 'Play ›' : 'Coming soon'}</span></div>
      </div>
    </a>
  );
}

function TileArt({ slug }: { slug: string }) {
  if (slug === 'ludonova') {
    return (
      <svg viewBox="0 0 100 100">
        <rect x="6" y="6" width="40" height="40" rx="8" fill="#ff2d55" /><rect x="54" y="6" width="40" height="40" rx="8" fill="#00c97a" />
        <rect x="6" y="54" width="40" height="40" rx="8" fill="#2b7bff" /><rect x="54" y="54" width="40" height="40" rx="8" fill="#ffb400" />
        <circle cx="50" cy="50" r="14" fill="#fff" /><circle cx="26" cy="26" r="7" fill="#fff" /><circle cx="74" cy="74" r="7" fill="#fff" />
      </svg>
    );
  }
  if (slug === 'slithernova') {
    return (
      <svg viewBox="0 0 100 100">
        {Array.from({ length: 25 }, (_, k) => <rect key={k} x={6 + (k % 5) * 18} y={6 + Math.floor(k / 5) * 18} width="16" height="16" rx="3" fill={(k + Math.floor(k / 5)) % 2 ? '#fff' : '#ffe08a'} />)}
        <path d="M24 84 L30 20 M38 84 L44 20" stroke="#8b5a2b" strokeWidth="4" /><path d="M27 70 L41 70 M28 54 L42 54 M29 38 L43 38" stroke="#8b5a2b" strokeWidth="3" />
        <path d="M80 18 Q60 30 76 46 Q92 62 70 76 Q58 84 62 92" fill="none" stroke="#00c97a" strokeWidth="8" strokeLinecap="round" />
        <circle cx="80" cy="18" r="6" fill="#00c97a" /><circle cx="82" cy="16" r="1.6" fill="#111" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100">
      <rect x="8" y="8" width="84" height="84" rx="6" fill="#e9f5e1" stroke="#1b1035" strokeWidth="3" />
      <rect x="24" y="24" width="52" height="52" rx="4" fill="#9b6bff" opacity="0.25" />
      {[14, 30, 46, 62, 78].map((x, k) => <rect key={k} x={x - 5} y="9" width="10" height="9" fill={['#ff2d55', '#2b7bff', '#ffb400', '#00c97a', '#ff8c42'][k]} />)}
      <path d="M38 64 L38 48 L50 38 L62 48 L62 64 Z" fill="#ff8c42" stroke="#1b1035" strokeWidth="2.5" /><rect x="46" y="54" width="8" height="10" fill="#1b1035" />
      <text x="50" y="35" textAnchor="middle" fontSize="12" fontWeight="900" fill="#1b1035">₹</text>
    </svg>
  );
}

/** Placeholder page for games that are still being built. */
export function ComingSoon({ g }: { g: GameInfo }) {
  return (
    <div className="screen hub">
      <Backdrop />
      <div className="topbar"><a className="btn ghost sm" href={import.meta.env.BASE_URL}>← All games</a></div>
      <a className="tile soon big" href={import.meta.env.BASE_URL} style={{ ['--a' as string]: g.colors[0], ['--b' as string]: g.colors[1] }}>
        <div className="tile-art"><TileArt slug={g.slug} /></div>
        <div className="tile-body"><small>{g.kind}</small><b>{g.name}</b><p>{g.tagline}</p><div className="tile-foot"><span>Coming soon</span></div></div>
      </a>
      {adsEnabled() && <BannerStrip />}
    </div>
  );
}
