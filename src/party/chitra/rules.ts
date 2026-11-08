// Chitra Chor: one player draws a word, everyone else races to guess it. Faster guesses score more.
import { AUTO, type Rules, type Seat } from '../../shared/room';
import { clean, norm, pick, seats, shuffle, zeros } from '../common';

export const WORDS: [string, string][] = [
  ['kulfi', '🍦'], ['auto rickshaw', '🛺'], ['diya', '🪔'], ['kite', '🪁'], ['mango', '🥭'], ['elephant', '🐘'], ['peacock', '🦚'], ['cricket bat', '🏏'],
  ['train', '🚆'], ['umbrella', '🌂'], ['samosa', '🥟'], ['tea', '☕'], ['moon', '🌙'], ['rainbow', '🌈'], ['camel', '🐫'], ['rocket', '🚀'],
  ['guitar', '🎸'], ['banana', '🍌'], ['tiger', '🐅'], ['lotus', '🪷'], ['house', '🏠'], ['cycle', '🚲'], ['fish', '🐟'], ['star', '⭐'],
  ['clock', '⏰'], ['book', '📚'], ['phone', '📱'], ['cake', '🎂'], ['tree', '🌳'], ['sun', '☀️'], ['snake', '🐍'], ['crown', '👑'],
  ['glasses', '👓'], ['balloon', '🎈'], ['ship', '🚢'], ['pizza', '🍕'], ['football', '⚽'], ['monkey', '🐒'], ['mountain', '⛰️'], ['drum', '🥁'],
  ['bus', '🚌'], ['flower', '🌸'], ['cow', '🐄'], ['ice cream', '🍨'], ['parrot', '🦜'], ['candle', '🕯️'], ['scooter', '🛵'], ['bell', '🔔'],
];
export interface CLine { id: string; c: string; w: number; pts: number[] }
export interface CGame {
  order: string[]; names: Record<string, string>; bots: string[];
  drawer: number; turns: number; total: number; word: string; emoji: string;
  phase: 'draw' | 'reveal'; clock: number; lines: CLine[]; guessed: Record<string, number>;
  feed: { pid: string; text: string; ok: boolean; id: number }[]; score: Record<string, number>; seq: number; used: string[];
}
export type CAction = { t: 'line'; id: string; c: string; w: number; pts: number[] } | { t: 'clear' } | { t: 'undo' } | { t: 'guess'; text: string } | { t: 'tick' };
export const DRAW_SECS = 70;
let fid = Date.now();

function turn(g: Omit<CGame, 'word' | 'emoji'> & Partial<CGame>): CGame {
  const left = WORDS.filter(([w]) => !g.used.includes(w));
  const [word, emoji] = pick(left.length ? left : WORDS);
  return { ...g, word, emoji, used: [...g.used, word], phase: 'draw', clock: DRAW_SECS, lines: [], guessed: {}, feed: [] } as CGame;
}
export const drawerOf = (g: CGame) => g.order[g.drawer % g.order.length];
/** The word with some letters showing, more as time runs out. */
export function hint(g: CGame) {
  const n = g.clock < 20 ? 2 : g.clock < 40 ? 1 : 0;
  const idx = shuffle([...g.word].map((_, i) => i).filter((i) => g.word[i] !== ' ')).sort((a, b) => ((a * 7 + g.word.length) % 5) - ((b * 7 + g.word.length) % 5)).slice(0, n);
  return [...g.word].map((ch, i) => (ch === ' ' ? '  ' : idx.includes(i) ? ch : '_')).join(' ');
}

export const ccRules: Rules<CGame, CAction> & { ranking(g: CGame): string[] } = {
  maxPlayers: 6,
  start(players: Seat[], o) {
    const s = seats(players), laps = Number(o.laps) || (s.order.length <= 3 ? 2 : 1);
    return turn({ ...s, drawer: 0, turns: 0, total: laps * s.order.length, phase: 'draw', clock: DRAW_SECS, lines: [], guessed: {}, feed: [], score: zeros(s.order), seq: 1, used: [] });
  },
  waitingOn: () => null,
  turnKey: (g) => `${g.seq}`,
  over: (g) => g.turns >= g.total,
  ranking: (g) => [...g.order].sort((a, b) => g.score[b] - g.score[a]),
  auto: (g) => (g.turns >= g.total ? null : { a: { t: 'tick' }, delay: g.phase === 'reveal' ? 4000 : 1000 }),
  bot: () => null,
  timeout: () => null,
  act(g, pid, a) {
    if (g.turns >= g.total) return null;
    const drawer = drawerOf(g);
    if (a.t === 'line' || a.t === 'clear' || a.t === 'undo') {
      if (pid !== drawer || g.phase !== 'draw') return null;
      if (a.t === 'clear') return { ...g, lines: [] };
      if (a.t === 'undo') return { ...g, lines: g.lines.slice(0, -1) };
      const pts = (Array.isArray(a.pts) ? a.pts : []).slice(0, 600).map((v) => Math.max(0, Math.min(1000, Math.round(Number(v) || 0))));
      const line: CLine = { id: clean(a.id, 16), c: clean(a.c, 9), w: Math.max(2, Math.min(40, Number(a.w) || 6)), pts };
      const i = g.lines.findIndex((l) => l.id === line.id);
      const lines = i >= 0 ? g.lines.map((l, k) => (k === i ? line : l)) : [...g.lines, line].slice(-120);
      return { ...g, lines };
    }
    if (a.t === 'guess') {
      if (g.phase !== 'draw' || pid === drawer || !g.order.includes(pid) || g.guessed[pid] != null) return null;
      return guess(g, pid, clean(a.text, 30));
    }
    if (a.t === 'tick' && pid === AUTO) {
      if (g.phase === 'reveal') {
        const turns = g.turns + 1;
        if (turns >= g.total) return { ...g, turns, seq: g.seq + 1 };
        return { ...turn({ ...g, drawer: g.drawer + 1, turns }), seq: g.seq + 1 };
      }
      let n: CGame = { ...g, clock: g.clock - 1 };
      for (const b of g.bots) {
        if (b === drawer || n.guessed[b] != null) continue;
        const t = DRAW_SECS - n.clock;
        if (Math.random() < 0.01 + t * 0.0025) n = guess(n, b, n.word);
        else if (Math.random() < 0.06) n = guess(n, b, pick(WORDS)[0]);
      }
      const guessers = n.order.filter((x) => x !== drawer);
      if (n.clock <= 0 || guessers.every((x) => n.guessed[x] != null)) return { ...n, phase: 'reveal', seq: n.seq + 1 };
      return n;
    }
    return null;
  },
};

function guess(g: CGame, pid: string, text: string): CGame {
  if (!text) return g;
  const ok = norm(text) === norm(g.word);
  const feed = [...g.feed, { pid, text: ok ? 'guessed it! ✅' : text, ok, id: fid++ }].slice(-6);
  if (!ok) return { ...g, feed };
  const rank = Object.keys(g.guessed).length, pts = Math.max(3, Math.round(4 + g.clock / 7) - rank);
  const drawer = drawerOf(g);
  return { ...g, feed, guessed: { ...g.guessed, [pid]: pts }, score: { ...g.score, [pid]: g.score[pid] + pts, [drawer]: g.score[drawer] + 2 } };
}
