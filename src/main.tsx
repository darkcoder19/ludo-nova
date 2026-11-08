import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { UpgradeSheet } from './account/AccountViews';
import SeedhiApp from './seedhi';
import DhandhaApp from './dhandha';
import HaatApp from './haat';
import { lazy, Suspense } from 'react';
const RunwayRaja = lazy(() => import('./atc/RunwayRaja'));
const HawaiAdda = lazy(() => import('./tycoon/HawaiAdda'));
const RailwayRaja = lazy(() => import('./rail/RailwayRaja'));
const MetroMaker = lazy(() => import('./metro/MetroMaker'));
const TapriTycoon = lazy(() => import('./flow/TapriTycoon'));
const DabbaExpress = lazy(() => import('./flow/DabbaExpress'));
const BolApp = lazy(() => import('./party/bol'));
const ChitraApp = lazy(() => import('./party/chitra'));
const JhootaApp = lazy(() => import('./party/jhoota'));
const MandiApp = lazy(() => import('./party/mandi'));
const RajApp = lazy(() => import('./party/raj'));
const CricketApp = lazy(() => import('./party/cricket'));
const KabaddiApp = lazy(() => import('./party/kabaddi'));
const GutteApp = lazy(() => import('./party/gutte'));
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
  if (game.slug === 'haathustle') return <HaatApp />;
  if (game.slug === 'runwayraja') return <Suspense fallback={null}><RunwayRaja /></Suspense>;
  if (game.slug === 'hawaiadda') return <Suspense fallback={null}><HawaiAdda /></Suspense>;
  if (game.slug === 'railwayraja') return <Suspense fallback={null}><RailwayRaja /></Suspense>;
  if (game.slug === 'metromaker') return <Suspense fallback={null}><MetroMaker /></Suspense>;
  if (game.slug === 'tapritycoon') return <Suspense fallback={null}><TapriTycoon /></Suspense>;
  if (game.slug === 'dabbaexpress') return <Suspense fallback={null}><DabbaExpress /></Suspense>;
  if (game.slug === 'bolbachchan') return <Suspense fallback={null}><BolApp /></Suspense>;
  if (game.slug === 'chitrachor') return <Suspense fallback={null}><ChitraApp /></Suspense>;
  if (game.slug === 'jhootaseth') return <Suspense fallback={null}><JhootaApp /></Suspense>;
  if (game.slug === 'mandiwars') return <Suspense fallback={null}><MandiApp /></Suspense>;
  if (game.slug === 'rajmahal') return <Suspense fallback={null}><RajApp /></Suspense>;
  if (game.slug === 'cricketcaptain') return <Suspense fallback={null}><CricketApp /></Suspense>;
  if (game.slug === 'kabaddiraid') return <Suspense fallback={null}><KabaddiApp /></Suspense>;
  if (game.slug === 'gutteghar') return <Suspense fallback={null}><GutteApp /></Suspense>;
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
