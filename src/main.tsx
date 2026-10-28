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

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }));
}
