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
  /** Quick party games: shown under the Party tab. */
  party?: boolean;
}

export const GAMES: GameInfo[] = [
  { slug: 'ludonova', name: 'LudoNova', kind: 'Ludo', tagline: 'Roll, race and troll your friends home.', players: '2–4 players', colors: ['#ff2e88', '#7a5cff'], ready: true },
    { slug: 'seedhirush', name: 'SeedhiRush', kind: 'Snakes & Ladders', tagline: 'Climb the seedhi, dodge the saanp, first to 100 wins.', players: '2–4 players', colors: ['#00c97a', '#ffb400'], ready: true },
    { slug: 'haathustle', name: 'Haat Hustle', kind: 'Trade & build', tagline: 'Grow crops, play the mandi, build havelis. Rule the village haat.', players: '2–4 players', colors: ['#ffab1a', '#12d6b4'], ready: true },
    { slug: 'runwayraja', name: 'Runway Raja', kind: 'Air traffic control', tagline: 'Draw routes, land into the wind, keep the skies safe.', players: 'Solo', colors: ['#12d6b4', '#2b7bff'], ready: true, solo: true, icon: '🛫' },
    { slug: 'hawaiadda', name: 'Hawai Adda', kind: 'Airport tycoon', tagline: 'Build gates, sign airlines, grow a hub.', players: 'Solo', colors: ['#ff8c42', '#ffd23f'], ready: true, solo: true, icon: '🏗️' },
    { slug: 'railwayraja', name: 'Railway Raja', kind: 'Junction puzzle', tagline: 'Flip switches, send every train home.', players: 'Solo', colors: ['#e5304f', '#ffb400'], ready: true, solo: true, icon: '🚆' },
    { slug: 'metromaker', name: 'Metro Maker', kind: 'City metro builder', tagline: 'Link stations, beat rush hour and monsoon.', players: 'Solo', colors: ['#2f7bff', '#00c97a'], ready: true, solo: true, icon: '🚇' },
    { slug: 'tapritycoon', name: 'Tapri Tycoon', kind: 'Chai stall tycoon', tagline: 'Grow a chai tapri into a café chain.', players: 'Solo', colors: ['#a0522d', '#ffb347'], ready: true, solo: true, icon: '☕' },
    { slug: 'dabbaexpress', name: 'Dabba Express', kind: 'Tiffin delivery tycoon', tagline: 'Cycles, trains, runners. Lunch on time.', players: 'Solo', colors: ['#2f7bff', '#ffd23f'], ready: true, solo: true, icon: '🍱' },
    { slug: 'dhandhaking', name: 'DhandhaKing', kind: 'Property tycoon', tagline: 'Buy cities, spin the Tapri wheel, outbid your friends.', players: '2–4 players', colors: ['#9b6bff', '#ff8c42'], ready: true },
    { slug: 'bolbachchan', name: 'Bol Bachchan', kind: 'Spot the faker', tagline: 'One word, one faker. Clue, vote, catch them.', players: '3–6 players', colors: ['#7d5cff', '#ff4fd8'], ready: true, party: true, icon: '🎭' },
    { slug: 'chitrachor', name: 'Chitra Chor', kind: 'Draw & guess', tagline: 'Draw it, guess it, fastest wins.', players: '2–6 players', colors: ['#ff6fb1', '#ffd23f'], ready: true, party: true, icon: '🎨' },
    { slug: 'jhootaseth', name: 'Jhoota Seth', kind: 'Bluff cards', tagline: 'Claim anything. Shout JHOOTH!', players: '2–5 players', colors: ['#b3122f', '#ff8c42'], ready: true, party: true, icon: '🃏' },
    { slug: 'mandiwars', name: 'Mandi Wars', kind: 'Live trading', tagline: 'Prices move every second. Out-trade friends.', players: '2–4 players', colors: ['#00a35c', '#ffd23f'], ready: true, party: true, icon: '📈' },
    { slug: 'rajmahal', name: 'Rajmahal', kind: 'Tile builder', tagline: 'Match edges, build the best kingdom.', players: '2–4 players', colors: ['#f6c27a', '#4aa8e8'], ready: true, party: true, icon: '🏰' },
    { slug: 'cricketcaptain', name: 'Cricket Captain', kind: 'Cricket duel', tagline: 'Pick shot vs ball. Outthink your friend.', players: '2 players', colors: ['#1f7a4d', '#9fe870'], ready: true, party: true, icon: '🏏' },
    { slug: 'kabaddiraid', name: 'Kabaddi Raid', kind: 'Kabaddi duel', tagline: 'Raid deep, time the tackle.', players: '2 players', colors: ['#e39a5c', '#ff4f6d'], ready: true, party: true, icon: '🤼' },
    { slug: 'gutteghar', name: 'Gutte Ghar', kind: 'Four in a row', tagline: 'Drop gutte, line up four. Board flips!', players: '2–3 players', colors: ['#a85f2e', '#ffb347'], ready: true, party: true, icon: '🔴' },
];

export const BASE = import.meta.env.BASE_URL; // "/games/"
export const gameUrl = (slug: string) => `${BASE}${slug}`;

/** Which screen the current URL points at: '' is the hub. */
export const currentSlug = () => location.pathname.slice(BASE.length).split('/')[0] ?? '';
