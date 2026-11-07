// The Sarvimo Games catalogue. `slug` is the URL under /games/.
export interface GameInfo {
  slug: string;
  name: string;
  kind: string;
  tagline: string;
  players: string;
  colors: [string, string];
  ready: boolean;
  /** Single-player game: no rooms or codes; shown in the Solo row. */
  solo?: boolean;
  icon?: string;
}

export const GAMES: GameInfo[] = [
  { slug: 'ludonova', name: 'LudoNova', kind: 'Ludo', tagline: 'Roll, race and troll your friends home.', players: '2–4 players', colors: ['#ff2e88', '#7a5cff'], ready: true },
    { slug: 'seedhirush', name: 'SeedhiRush', kind: 'Snakes & Ladders', tagline: 'Climb the seedhi, dodge the saanp, first to 100 wins.', players: '2–4 players', colors: ['#00c97a', '#ffb400'], ready: true },
    { slug: 'haathustle', name: 'Haat Hustle', kind: 'Trade & build', tagline: 'Grow crops, play the mandi, build havelis. Rule the village haat.', players: '2–4 players', colors: ['#ffab1a', '#12d6b4'], ready: true },
    { slug: 'runwayraja', name: 'Runway Raja', kind: 'Air traffic control', tagline: 'Draw routes, land into the wind, keep the skies safe.', players: 'Solo', colors: ['#12d6b4', '#2b7bff'], ready: true, solo: true, icon: '🛫' },
    { slug: 'hawaiadda', name: 'Hawai Adda', kind: 'Airport tycoon', tagline: 'Build gates, sign airlines, grow a hub.', players: 'Solo', colors: ['#ff8c42', '#ffd23f'], ready: true, solo: true, icon: '🏗️' },
    { slug: 'dhandhaking', name: 'DhandhaKing', kind: 'Property tycoon', tagline: 'Buy cities, spin the Tapri wheel, outbid your friends.', players: '2–4 players', colors: ['#9b6bff', '#ff8c42'], ready: true },
];

export const BASE = import.meta.env.BASE_URL; // "/games/"
export const gameUrl = (slug: string) => `${BASE}${slug}`;

/** Which screen the current URL points at: '' is the hub. */
export const currentSlug = () => location.pathname.slice(BASE.length).split('/')[0] ?? '';
