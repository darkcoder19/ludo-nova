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

/** Office games (board games) live on the main Sarvimo site; the hub lists them in the Office games pop-up. */
export interface OfficeGame { key: string; name: string; icon: string; blurb: string; meta: string; path: string; colors: [string, string]; isNew?: boolean }
export const OFFICE_GAMES: OfficeGame[] = [
  { key: 'treasure', name: 'Treasure Hunt', icon: '🗺️', blurb: 'A story your teams solve on their phones: riddles, codes, clips and mini-games. Live leaderboard on the TV.', meta: 'Teams of 2–5 · 30–60 min', path: '/treasure-hunt', colors: ['#10b981', '#f59e0b'], isNew: true },
  { key: 'guess-song', name: 'Guess the Song', icon: '🎵', blurb: 'A few seconds of a Bollywood song, and teams race to name it. The host picks how many seconds.', meta: '2–6 teams · 15–30 min', path: '/board-games/guess-the-song', colors: ['#8b5cf6', '#ec4899'], isNew: true },
  { key: 'emojis', name: 'Decode the Emojis', icon: '🎭', blurb: 'Emojis spell out a Bollywood film, a dialogue, a startup or a brand. A voice host, hints and troll GIFs.', meta: '2–6 teams · 15–30 min', path: '/board-games/decode-the-emojis', colors: ['#d946ef', '#0ea5e9'], isNew: true },
  { key: 'guess-prop', name: 'Guess the Prop', icon: '🕶️', blurb: 'Props on a table, a Bollywood song on the speaker. First team to grab the thing the song is about wins.', meta: '2–4 teams · 15–30 min', path: '/board-games/guess-the-prop', colors: ['#ec4899', '#f59e0b'], isNew: true },
  { key: 'dialogue', name: 'Complete the Dialogue', icon: '🎬', blurb: 'Famous Bollywood dialogues with words missing, easy to tough. Then see the film and the scene.', meta: '2–6 teams · 15–30 min', path: '/board-games/complete-the-dialogue', colors: ['#f59e0b', '#dc2626'], isNew: true },
  { key: 'pass-ball', name: 'Pass the Ball', icon: '⚽', blurb: 'Pass the ball while a party song plays. The music stops by itself and whoever has it answers rapid fire.', meta: 'Any size · 10–20 min', path: '/board-games/pass-the-ball', colors: ['#0ea5e9', '#10b981'], isNew: true },
  { key: 'whisper', name: 'Chinese Whisper', icon: '🤫', blurb: 'A secret sentence goes down the line in whispers. The host gives points for what is left.', meta: 'Teams of 4–8 · 15–25 min', path: '/board-games/chinese-whisper', colors: ['#14b8a6', '#6366f1'], isNew: true },
  { key: 'lemon-spoon', name: 'Lemon and Spoon Race', icon: '🥄', blurb: '3-2-1-GO and a stopwatch on the TV, a fun twist every heat, music while you race.', meta: 'Up to 8 a heat · 10–20 min', path: '/board-games/lemon-spoon-race', colors: ['#84cc16', '#f59e0b'], isNew: true },
  { key: 'housie', name: 'Housie', icon: '🎟️', blurb: 'Tambola with printable tickets, numbers called out loud and a big-screen board.', meta: '5–200 players · 20–40 min', path: '/housie-game', colors: ['#f59e0b', '#e11d48'] },
  { key: 'picture-housie', name: 'Picture Housie', icon: '🪔', blurb: 'Housie with pictures in place of numbers. Easy for kids and mixed groups.', meta: '5–200 players · 15–25 min', path: '/housie-game?kind=pictures', colors: ['#fb923c', '#db2777'] },
  { key: 'charades', name: 'Dumb Charades', icon: '🎭', blurb: 'Act out films and office moments without a word. The team guesses against the clock.', meta: 'Teams · 15–30 min', path: '/board-games/dumb-charades', colors: ['#d946ef', '#7c3aed'] },
  { key: 'antakshari', name: 'Antakshari', icon: '🎤', blurb: 'Sing a Hindi song from the last letter. The TV shows the letter, the clock and the scores.', meta: '2–6 teams · 15–30 min', path: '/board-games/antakshari', colors: ['#f43f5e', '#f97316'] },
  { key: 'lucky-draw', name: 'Lucky Draw', icon: '🎁', blurb: 'Names spin on the big screen and stop on a winner, with a drumroll and confetti.', meta: 'Any size · 5–15 min', path: '/board-games/lucky-draw', colors: ['#10b981', '#0ea5e9'] },
];
/** The main site: the same address when the hub is opened through sarvimo.com/games, the full one anywhere else. */
export const siteUrl = (path: string) => (location.hostname.endsWith('sarvimo.com') ? '' : 'https://sarvimo.com') + path;
