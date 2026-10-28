// The Sarvimo Games catalogue. `slug` is the URL under /games/.
export interface GameInfo {
  slug: string;
  name: string;
  kind: string;
  tagline: string;
  players: string;
  colors: [string, string];
  ready: boolean;
}

export const GAMES: GameInfo[] = [
  { slug: 'ludonova', name: 'LudoNova', kind: 'Ludo', tagline: 'Roll, race and troll your friends home.', players: '2–4 players', colors: ['#ff2d55', '#2b7bff'], ready: true },
    { slug: 'seedhirush', name: 'SeedhiRush', kind: 'Snakes & Ladders', tagline: 'Climb the seedhi, dodge the saanp, first to 100 wins.', players: '2–4 players', colors: ['#00c97a', '#ffb400'], ready: true },
    { slug: 'dhandhaking', name: 'DhandhaKing', kind: 'Property tycoon', tagline: 'Buy Mumbai, build hotels, become the Seth of India.', players: '2–4 players', colors: ['#9b6bff', '#ff8c42'], ready: true },
];

export const BASE = import.meta.env.BASE_URL; // "/games/"
export const gameUrl = (slug: string) => `${BASE}${slug}`;

/** Which screen the current URL points at: '' is the hub. */
export const currentSlug = () => location.pathname.slice(BASE.length).split('/')[0] ?? '';
