// SeedhiRush — snakes & ladders. Pure rules, run by the room host.
import { AUTO, type Rules, type Seat } from '../shared/room';

export const LADDERS: Record<number, number> = { 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 99 };
export const SNAKES: Record<number, number> = { 17: 7, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };

export type MoveKind = 'walk' | 'snake' | 'ladder' | 'bounce';
export interface Move { id: number; pid: string; from: number; via: number; to: number; kind: MoveKind; dice: number }

export interface SGame {
  order: string[];
  pos: Record<string, number>; // 0 = waiting below square 1
  turn: number;
  dice: number;
  rollId: number;
  phase: 'roll' | 'moving';
  move: Move | null;
  sixes: number;
  winner: string | null;
  bites: Record<string, number>;
  climbs: Record<string, number>;
  note: string;
}

export type SAction = { t: 'roll' } | { t: 'skip' } | { t: 'advance' };

let moveSeq = 1;
const names = new Map<string, string>();

/** Squares walked + slide, in ms; the client animates exactly this long. */
export const moveMs = (m: Move) => (m.kind === 'bounce' ? 700 : Math.abs(m.via - m.from) * 190 + (m.kind === 'snake' ? 1300 : m.kind === 'ladder' ? 900 : 0) + 350);

export const seedhiRules: Rules<SGame, SAction> & { ranking(g: SGame): string[] } = {
  maxPlayers: 4,
  start(players: Seat[]) {
    players.forEach((p) => names.set(p.id, p.name));
    const order = players.map((p) => p.id);
    return {
      order, pos: Object.fromEntries(order.map((id) => [id, 0])), turn: Math.floor(Math.random() * order.length),
      dice: 1, rollId: 0, phase: 'roll', move: null, sixes: 0, winner: null,
      bites: Object.fromEntries(order.map((id) => [id, 0])), climbs: Object.fromEntries(order.map((id) => [id, 0])), note: 'Race to 100!',
    };
  },
  waitingOn: (g) => (g.winner || g.phase !== 'roll' ? null : g.order[g.turn]),
  turnKey: (g) => `${g.turn}:${g.rollId}:${g.phase}`,
  over: (g) => !!g.winner,
  ranking: (g) => [...g.order].sort((a, b) => (b === g.winner ? 1 : 0) - (a === g.winner ? 1 : 0) || g.pos[b] - g.pos[a]),
  botDelay: () => 900,
  bot: () => ({ t: 'roll' }),
  timeout: () => ({ t: 'skip' }),
  auto: (g) => (g.phase === 'moving' && g.move ? { a: { t: 'advance' }, delay: moveMs(g.move) + 700 } : null),

  act(g, pid, a) {
    if (a.t === 'advance') {
      if (pid !== AUTO || g.phase !== 'moving' || !g.move) return null;
      const m = g.move;
      if (g.pos[m.pid] === 100) return { ...g, phase: 'roll', winner: m.pid, note: `${names.get(m.pid)} reached 100!` };
      const again = m.dice === 6 && g.sixes < 3;
      return { ...g, phase: 'roll', turn: again ? g.turn : (g.turn + 1) % g.order.length, sixes: again ? g.sixes : 0 };
    }
    if (g.phase !== 'roll' || g.winner || g.order[g.turn] !== pid) return null;
    if (a.t === 'skip') return { ...g, turn: (g.turn + 1) % g.order.length, sixes: 0, rollId: g.rollId + 1, note: `⏰ ${names.get(pid)} ran out of time` };

    const dice = 1 + Math.floor(Math.random() * 6);
    const sixes = dice === 6 ? g.sixes + 1 : 0;
    const from = g.pos[pid];
    if (sixes === 3) {
      return { ...g, dice, rollId: g.rollId + 1, sixes: 0, turn: (g.turn + 1) % g.order.length, note: `${names.get(pid)} rolled three 6s — turn lost!` };
    }
    let via = from + dice, to: number, kind: MoveKind;
    if (via > 100) { via = from; to = from; kind = 'bounce'; }
    else if (SNAKES[via]) { to = SNAKES[via]; kind = 'snake'; }
    else if (LADDERS[via]) { to = LADDERS[via]; kind = 'ladder'; }
    else { to = via; kind = 'walk'; }
    const n = names.get(pid);
    const note = kind === 'snake' ? `🐍 Snake ate ${n}! ${via} → ${to}` : kind === 'ladder' ? `⬆ ${n} climbed ${via} → ${to}!` : kind === 'bounce' ? `${n} needs exactly ${100 - from}` : `${n} rolled ${dice}`;
    return {
      ...g, dice, rollId: g.rollId + 1, sixes, phase: 'moving', note,
      pos: { ...g.pos, [pid]: to },
      move: { id: moveSeq++, pid, from, via, to, kind, dice },
      bites: kind === 'snake' ? { ...g.bites, [pid]: g.bites[pid] + 1 } : g.bites,
      climbs: kind === 'ladder' ? { ...g.climbs, [pid]: g.climbs[pid] + 1 } : g.climbs,
    };
  },
};
