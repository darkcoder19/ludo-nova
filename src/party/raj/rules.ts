// Rajmahal: take turns laying tiles on a shared map. Touching edges must match (lane, canal or garden);
// you score for every matching edge, for neighbours of the same kind, and for closing a spot on all four sides.
import type { Rules, Seat } from '../../shared/room';
import { seats, zeros } from '../common';

export const CENTRES = [{ e: '🏰', name: 'Palace', bg: '#f6c27a' }, { e: '🌳', name: 'Garden', bg: '#a8dc8c' }, { e: '🏪', name: 'Bazaar', bg: '#f7a8a8' }, { e: '🛕', name: 'Temple', bg: '#f3e08a' }];
export const EDGES = ['#b9a58a', '#4aa8e8', '#5fbf4a']; // lane, canal, garden hedge
export interface Tile { c: number; e: number[] } // e = [north, east, south, west]
export interface RGame {
  order: string[]; names: Record<string, string>; bots: string[];
  n: number; board: (Tile | null)[]; hands: Record<string, Tile[]>; turn: number; moves: number; total: number;
  score: Record<string, number>; last: { at: number; pid: string; pts: number } | null; note: string; owner: (string | null)[];
}
export type RAction = { t: 'place'; i: number; at: number; rot: number } | { t: 'swap' };

const rnd = (n: number) => Math.floor(Math.random() * n);
export const newTile = (): Tile => ({ c: rnd(4), e: [rnd(3), rnd(3), rnd(3), rnd(3)] });
export const rotate = (t: Tile, rot: number): Tile => ({ c: t.c, e: [0, 1, 2, 3].map((d) => t.e[(d - rot + 8) % 4]) });
const NB = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Points for putting `t` at `at`, or -1 if it doesn't fit there. */
export function value(g: Pick<RGame, 'n' | 'board'>, t: Tile, at: number): number {
  if (g.board[at]) return -1;
  const x = at % g.n, y = Math.floor(at / g.n);
  let touch = 0, pts = 0;
  for (let d = 0; d < 4; d++) {
    const nx = x + NB[d][0], ny = y + NB[d][1];
    if (nx < 0 || ny < 0 || nx >= g.n || ny >= g.n) continue;
    const o = g.board[ny * g.n + nx]; if (!o) continue;
    if (o.e[(d + 2) % 4] !== t.e[d]) return -1;
    touch++; pts += 1 + (o.c === t.c ? 2 : 0);
  }
  if (!touch) return -1;
  return pts + (touch === 4 ? 3 : 0);
}
export function bestMove(g: RGame, pid: string) {
  let best: { i: number; at: number; rot: number; v: number } | null = null;
  g.hands[pid].forEach((t, i) => { for (let rot = 0; rot < 4; rot++) { const r = rotate(t, rot); for (let at = 0; at < g.board.length; at++) { const v = value(g, r, at); if (v >= 0 && (!best || v + Math.random() * 0.5 > best.v)) best = { i, at, rot, v }; } } });
  return best as { i: number; at: number; rot: number; v: number } | null;
}

export const rmRules: Rules<RGame, RAction> & { ranking(g: RGame): string[] } = {
  maxPlayers: 4,
  start(players: Seat[], o) {
    const s = seats(players), n = o.size === '9' ? 9 : 7;
    const board: (Tile | null)[] = Array(n * n).fill(null);
    board[Math.floor((n * n) / 2)] = { c: 0, e: [0, 1, 2, 0] };
    const per = n === 9 ? 14 : Math.max(8, Math.floor(36 / s.order.length));
    return { ...s, n, board, owner: Array(n * n).fill(null), hands: Object.fromEntries(s.order.map((id) => [id, [newTile(), newTile(), newTile()]])), turn: 0, moves: 0, total: per * s.order.length, score: zeros(s.order), last: null, note: 'Match edges to build the kingdom!' };
  },
  waitingOn: (g) => (g.moves >= g.total ? null : g.order[g.turn]),
  turnKey: (g) => `${g.moves}`,
  over: (g) => g.moves >= g.total,
  ranking: (g) => [...g.order].sort((a, b) => g.score[b] - g.score[a]),
  botDelay: () => 1100,
  timeout: (g, pid) => rmRules.bot(g, pid),
  bot(g, pid) { const b = bestMove(g, pid); return b ? { t: 'place', i: b.i, at: b.at, rot: b.rot } : { t: 'swap' }; },
  act(g, pid, a) {
    if (g.moves >= g.total || g.order[g.turn] !== pid) return null;
    const nextTurn = { turn: (g.turn + 1) % g.order.length, moves: g.moves + 1 };
    if (a.t === 'swap') return { ...g, ...nextTurn, hands: { ...g.hands, [pid]: [newTile(), newTile(), newTile()] }, last: null, note: `${g.names[pid]} swapped their tiles` };
    const t = g.hands[pid][a.i]; if (!t) return null;
    const at = Math.floor(a.at), r = rotate(t, ((Math.floor(a.rot) % 4) + 4) % 4), v = value(g, r, at);
    if (v < 0) return null;
    const board = g.board.slice(); board[at] = r;
    const owner = g.owner.slice(); owner[at] = pid;
    const hand = g.hands[pid].map((x, k) => (k === a.i ? newTile() : x));
    return { ...g, ...nextTurn, board, owner, hands: { ...g.hands, [pid]: hand }, score: { ...g.score, [pid]: g.score[pid] + v }, last: { at, pid, pts: v }, note: `${g.names[pid]} built a ${CENTRES[r.c].name.toLowerCase()} · +${v}` };
  },
};
