import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { UpgradeSheet } from './account/AccountViews';
import SeedhiApp from './seedhi';
import DhandhaApp from './dhandha';
import { ComingSoon, Hub } from './hub/Hub';
import { currentSlug, GAMES } from './hub/games';
import './hub/hub.css';
import './styles.css';
import './fun.css';
import './ads/ads.css';
import './layout.css';

// /games → hub, /games/<slug> → that game.
function Root() {
  const slug = currentSlug();
  const game = GAMES.find((g) => g.slug === slug);
  document.title = game ? `${game.name} · Sarvimo Games` : 'Sarvimo Games';
  // Each game installs as its own home-screen app.
  document.querySelector('link[rel=manifest]')?.setAttribute('href', `${import.meta.env.BASE_URL}${game ? `manifest-${game.slug}` : 'manifest'}.webmanifest`);
  if (!game) return <Hub />;
  if (game.slug === 'ludonova') return <App />;
  if (game.slug === 'seedhirush') return <SeedhiApp />;
  if (game.slug === 'dhandhaking') return <DhandhaApp />;
  return <ComingSoon g={game} />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /><UpgradeSheet /></StrictMode>);

// A tab or installed app left open after a deploy keeps running the old build, and an old host can't
// see guests on the new relay. So reload into the new build, but only from a home screen, never mid-game.
if (import.meta.env.PROD) {
  const build = (s: string) => s.match(/index-[\w-]+\.js/)?.[0];
  const mine = build([...document.scripts].map((s) => s.src).join(' '));
  const idle = () => !document.hidden && !!document.querySelector('.screen.home, .screen.hub') && !document.querySelector('.ad-ov');
  const checkForUpdate = async () => {
    if (!mine || !idle()) return;
    try {
      const live = build(await (await fetch(location.pathname, { cache: 'no-store' })).text());
      if (live && live !== mine && idle()) location.reload();
    } catch { /* offline: keep the current build */ }
  };
  document.addEventListener('visibilitychange', checkForUpdate);
  setInterval(checkForUpdate, 5 * 60_000);
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }));
}
