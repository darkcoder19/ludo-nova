// Gutte Ghar: drop gutte (pebbles) into columns, first to line up four wins. Optional: the board flips over every few drops.
import type { Rules, Seat } from '../../shared/room';
import { seats } from '../common';

export interface GGame {
  order: string[]; names: Record<string, string>; bots: string[];
  cols: number; rows: number; grid: string[][]; // grid[c] = stack from the bottom up
  turn: number; drops: number; flipEvery: number; flips: number;
  winner: string | null; line: [number, number][] | null; draw: boolean;
  last: { c: number; r: number; id: number } | null; note: string; wins: Record<string, number>;
}
export type GAction = { t: 'drop'; c: number };
let seq = Date.now();

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
/** The first line of four for `pid`, if any. */
export function lineOf(g: Pick<GGame, 'grid' | 'cols' | 'rows'>, pid: string): [number, number][] | null {
  const at = (c: number, r: number) => (c >= 0 && c < g.cols && r >= 0 ? g.grid[c][r] : undefined);
  for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) {
    if (at(c, r) !== pid) continue;
    for (const [dc, dr] of DIRS) {
      const cells: [number, number][] = [];
      for (let k = 0; k < 4 && at(c + dc * k, r + dr * k) === pid; k++) cells.push([c + dc * k, r + dr * k]);
      if (cells.length === 4) return cells;
    }
  }
  return null;
}
const place = (g: GGame, c: number, pid: string): GGame => ({ ...g, grid: g.grid.map((col, i) => (i === c ? [...col, pid] : col)) });

function score(g: GGame, pid: string): number {
  // count open threes / twos for a quick bot heuristic
  let s = 0;
  const at = (c: number, r: number) => (c >= 0 && c < g.cols && r >= 0 && r < g.rows ? g.grid[c][r] ?? '' : '#');
  for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) for (const [dc, dr] of DIRS) {
    let mine = 0, empty = 0;
    for (let k = 0; k < 4; k++) { const v = at(c + dc * k, r + dr * k); if (v === pid) mine++; else if (v === '') empty++; }
    if (mine + empty === 4) s += mine === 3 ? 6 : mine === 2 ? 2 : mine;
  }
  return s;
}

export const ggRules: Rules<GGame, GAction> & { ranking(g: GGame): string[] } = {
  maxPlayers: 3,
  start(players: Seat[], o) {
    const [cols, rows] = o.size === '9x7' ? [9, 7] : [7, 6];
    const s = seats(players);
    return { ...s, cols, rows, grid: Array.from({ length: cols }, () => []), turn: Math.floor(Math.random() * players.length), drops: 0, flipEvery: o.flip === 'on' ? 7 : 0, flips: 0, winner: null, line: null, draw: false, last: null, note: 'Line up four to win!', wins: Object.fromEntries(s.order.map((id) => [id, 0])) };
  },
  waitingOn: (g) => (g.winner || g.draw ? null : g.order[g.turn]),
  turnKey: (g) => `${g.drops}`,
  over: (g) => !!g.winner || g.draw,
  ranking: (g) => [...g.order].sort((a, b) => (b === g.winner ? 1 : 0) - (a === g.winner ? 1 : 0)),
  botDelay: () => 800,
  timeout: (g) => ggRules.bot(g, g.order[g.turn]),
  bot(g, pid) {
    const legal = g.grid.map((col, c) => (col.length < g.rows ? c : -1)).filter((c) => c >= 0);
    const others = g.order.filter((x) => x !== pid);
    for (const c of legal) if (lineOf(place(g, c, pid), pid)) return { t: 'drop', c };
    for (const o of others) for (const c of legal) if (lineOf(place(g, c, o), o)) return { t: 'drop', c };
    let best = legal[0], bs = -1e9;
    for (const c of legal) {
      const n = place(g, c, pid);
      let v = score(n, pid) - Math.abs(c - (g.cols - 1) / 2) * 0.7 + Math.random() * 1.5;
      // don't hand the next player a winning spot right above
      if (n.grid[c].length < g.rows && others.some((o) => lineOf(place(n, c, o), o))) v -= 50;
      for (const o of others) v -= score(n, o) * 0.6;
      if (v > bs) { bs = v; best = c; }
    }
    return { t: 'drop', c: best };
  },
  act(g, pid, a) {
    if (g.winner || g.draw || g.order[g.turn] !== pid || a.t !== 'drop') return null;
    const c = Math.floor(a.c);
    if (!(c >= 0 && c < g.cols) || g.grid[c].length >= g.rows) return null;
    let n: GGame = { ...place(g, c, pid), drops: g.drops + 1, last: { c, r: g.grid[c].length, id: seq++ }, note: `${g.names[pid]} dropped in column ${c + 1}` };
    let line = lineOf(n, pid);
    if (line) return { ...n, winner: pid, line, note: `${g.names[pid]} lined up four!`, wins: { ...n.wins, [pid]: n.wins[pid] + 1 } };
    if (n.flipEvery && n.drops % n.flipEvery === 0) {
      // Flip the board upside down: every column's stack reverses and falls again.
      n = { ...n, grid: n.grid.map((col) => [...col].reverse()), flips: n.flips + 1, last: null, note: '🔄 The board flipped!' };
      const winners = n.order.filter((id) => lineOf(n, id));
      if (winners.length === 1) return { ...n, winner: winners[0], line: lineOf(n, winners[0]), note: `🔄 The flip made a line for ${n.names[winners[0]]}!` };
      if (winners.length > 1) { line = lineOf(n, pid); if (line) return { ...n, winner: pid, line, note: `🔄 Flip! ${n.names[pid]} dropped last and takes it.` }; }
    }
    if (n.grid.every((col) => col.length >= n.rows)) return { ...n, draw: true, note: 'Board full. A draw!' };
    return { ...n, turn: (g.turn + 1) % g.order.length };
  },
};
