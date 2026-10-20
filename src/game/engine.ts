// Pure Ludo rules. The host runs these; everyone else just renders the resulting state.

export type Color = 'red' | 'green' | 'yellow' | 'blue';
export const COLORS: Color[] = ['red', 'green', 'yellow', 'blue'];
export const START: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const HOME = 56; // progress: -1 yard, 0..50 track, 51..55 home column, 56 finished
export const TURN_MS = 30000;

export type Mode = 'classic' | 'quick';

export interface Player {
  id: string;
  name: string;
  color: Color;
  avatar: string;
  bot: boolean;
  connected: boolean;
}

export type EventKind = 'unlock' | 'timeout' | 'roll' | 'move' | 'capture' | 'home' | 'six' | 'triple' | 'skip' | 'win' | 'start';
export interface GameEvent {
  id: number;
  kind: EventKind;
  color: Color;
  victim?: Color;
  text: string;
}

export interface GameState {
  phase: 'lobby' | 'playing' | 'over';
  mode: Mode;
  hostId: string;
  players: Player[];
  turn: number; // index into players
  dice: number;
  rollId: number;
  rolled: boolean;
  sixes: number;
  movable: number[];
  tokens: Partial<Record<Color, number[]>>;
  winners: string[]; // player ids in finishing order
  event: GameEvent | null;
  stats: Record<string, { captures: number; sixes: number }>;
  turnLeftMs: number;
  turnMs: number; // 0 = no timer
}

export const seatOrder = (n: number): Color[] =>
  n === 2 ? ['red', 'yellow'] : n === 3 ? ['red', 'green', 'yellow'] : COLORS;

export function newLobby(hostId: string): GameState {
  return {
    phase: 'lobby', mode: 'classic', hostId, players: [], turn: 0, dice: 1, rollId: 0, rolled: false,
    sixes: 0, movable: [], tokens: {}, winners: [], event: null, stats: {}, turnLeftMs: TURN_MS, turnMs: TURN_MS,
  };
}

let eventSeq = 1;
const ev = (kind: EventKind, color: Color, text: string, victim?: Color): GameEvent => ({ id: eventSeq++, kind, color, text, victim });

export function startGame(s: GameState): GameState {
  const n = s.players.length;
  const colors = seatOrder(n);
  // Order players clockwise by color so turns go around the board.
  const players = s.players
    .map((p, i) => ({ ...p, color: colors[i] }))
    .sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color));
  const count = s.mode === 'quick' ? 2 : 4;
  const tokens: GameState['tokens'] = {};
  const stats: GameState['stats'] = {};
  for (const p of players) {
    // Quick mode: fewer tokens and the first one starts on the board.
    tokens[p.color] = Array.from({ length: count }, (_, i) => (s.mode === 'quick' && i === 0 ? 0 : -1));
    stats[p.id] = { captures: 0, sixes: 0 };
  }
  return {
    ...s, phase: 'playing', players, tokens, stats, winners: [], turn: Math.floor(Math.random() * n),
    rolled: false, sixes: 0, movable: [], dice: 1, event: ev('start', players[0].color, 'Game on!'),
  };
}

const absPos = (c: Color, p: number) => (START[c] + p) % 52;

export function movableTokens(s: GameState, color: Color, dice: number): number[] {
  const t = s.tokens[color] ?? [];
  const out: number[] = [];
  t.forEach((p, i) => {
    if (p === HOME) return;
    if (p < 0) { if (dice === 6) out.push(i); return; }
    if (p + dice <= HOME) out.push(i);
  });
  return out;
}

export function roll(s: GameState, value = 1 + Math.floor(Math.random() * 6)): GameState {
  const me = s.players[s.turn];
  const sixes = value === 6 ? s.sixes + 1 : 0;
  const stats = { ...s.stats, [me.id]: { ...s.stats[me.id], sixes: s.stats[me.id].sixes + (value === 6 ? 1 : 0) } };
  const base = { ...s, dice: value, rollId: s.rollId + 1, rolled: true, sixes, stats };
  if (sixes === 3) return { ...base, movable: [], event: ev('triple', me.color, `${me.name} rolled three 6s — turn lost!`) };
  const movable = movableTokens(s, me.color, value);
  const text = movable.length ? `${me.name} rolled ${value}` : `${me.name} rolled ${value} — no moves`;
  return { ...base, movable, event: ev(value === 6 ? 'six' : 'roll', me.color, text) };
}

export function nextTurn(s: GameState): GameState {
  const n = s.players.length;
  let t = s.turn;
  for (let i = 0; i < n; i++) {
    t = (t + 1) % n;
    if (!s.winners.includes(s.players[t].id)) break;
  }
  return { ...s, turn: t, rolled: false, sixes: 0, movable: [] };
}

export function move(s: GameState, idx: number): GameState {
  const me = s.players[s.turn];
  if (!s.rolled || !s.movable.includes(idx)) return s;
  const tokens = { ...s.tokens };
  const mine = [...tokens[me.color]!];
  const from = mine[idx];
  const to = from < 0 ? 0 : from + s.dice;
  mine[idx] = to;
  tokens[me.color] = mine;

  let event = from < 0 ? ev('unlock', me.color, `🔓 ${me.name} unlocked a piece!`) : ev('move', me.color, `${me.name} moved`);
  let bonus = s.dice === 6;
  let stats = s.stats;

  if (to <= 50 && !SAFE.has(absPos(me.color, to))) {
    const here = absPos(me.color, to);
    for (const p of s.players) {
      if (p.color === me.color) continue;
      const theirs = tokens[p.color]!;
      if (theirs.some((q) => q >= 0 && q <= 50 && absPos(p.color, q) === here)) {
        tokens[p.color] = theirs.map((q) => (q >= 0 && q <= 50 && absPos(p.color, q) === here ? -1 : q));
        bonus = true;
        stats = { ...stats, [me.id]: { ...stats[me.id], captures: stats[me.id].captures + 1 } };
        event = ev('capture', me.color, `${me.name} captured ${p.name}!`, p.color);
      }
    }
  }
  if (to === HOME) { bonus = true; event = ev('home', me.color, `${me.name} got a token home!`); }

  let next: GameState = { ...s, tokens, stats, event, rolled: false, movable: [] };

  if (mine.every((p) => p === HOME)) {
    const winners = [...s.winners, me.id];
    next = { ...next, winners, event: ev('win', me.color, winners.length === 1 ? `${me.name} wins! 👑` : `${me.name} finished #${winners.length}`) };
    const left = s.players.filter((p) => !winners.includes(p.id));
    if (left.length <= 1) return { ...next, phase: 'over', winners: [...winners, ...left.map((p) => p.id)] };
    return nextTurn(next);
  }
  return bonus ? { ...next, sixes: s.dice === 6 ? s.sixes : 0 } : nextTurn(next);
}

/** Simple bot: capture > finish > leave yard > advance the token closest to home. */
export function botChoice(s: GameState): number {
  const me = s.players[s.turn];
  const mine = s.tokens[me.color]!;
  let best = s.movable[0], bestScore = -Infinity;
  for (const i of s.movable) {
    const from = mine[i];
    const to = from < 0 ? 0 : from + s.dice;
    let score = to;
    if (to === HOME) score += 200;
    if (from < 0) score += 120;
    if (to <= 50) {
      const here = absPos(me.color, to);
      if (SAFE.has(here)) score += 30;
      else for (const p of s.players) {
        if (p.color !== me.color && s.tokens[p.color]!.some((q) => q >= 0 && q <= 50 && absPos(p.color, q) === here)) score += 300;
      }
    }
    if (to > 50) score += 40;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

export function timeout(s: GameState): GameState {
  const me = s.players[s.turn];
  return nextTurn({ ...s, event: ev('timeout', me.color, `⏰ ${me.name} ran out of time`) });
}
