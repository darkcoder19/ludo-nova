// Jhoota Seth: play cards face down and claim they are the rank everyone is on. Anyone can shout "Jhooth!".
// Caught lying: the liar picks up the pile. Wrong call: the caller picks it up. Empty your hand to win.
import { AUTO, type Rules, type Seat } from '../../shared/room';
import { pick, seats, shuffle } from '../common';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♦', '♣'];
export const rankOf = (c: string) => c.slice(0, -1);
export interface JPlay { pid: string; cards: string[]; claim: number }
export interface JReveal { caller: string; liar: boolean; cards: string[]; loser: string; claim: number }
export interface JGame {
  order: string[]; names: Record<string, string>; bots: string[];
  hands: Record<string, string[]>; pile: string[]; claim: number; turn: number;
  phase: 'play' | 'call' | 'reveal'; clock: number; last: JPlay | null; reveal: JReveal | null;
  winner: string | null; seq: number; note: string; caught: Record<string, number>; bluffs: Record<string, number>;
}
export type JAction = { t: 'play'; cards: string[] } | { t: 'call' } | { t: 'tick' };
const CALL_SECS = 5;

const next = (g: JGame, from: number) => (from + 1) % g.order.length;

export const jsRules: Rules<JGame, JAction> & { ranking(g: JGame): string[] } = {
  maxPlayers: 5,
  start(players: Seat[]) {
    const s = seats(players);
    const deck = shuffle(RANKS.flatMap((r) => SUITS.map((x) => r + x)));
    const per = Math.min(10, Math.floor(52 / s.order.length));
    const hands = Object.fromEntries(s.order.map((id, i) => [id, deck.slice(i * per, i * per + per)]));
    return { ...s, hands, pile: [], claim: 0, turn: Math.floor(Math.random() * s.order.length), phase: 'play', clock: 0, last: null, reveal: null, winner: null, seq: 1, note: 'Start with Aces!', caught: Object.fromEntries(s.order.map((id) => [id, 0])), bluffs: Object.fromEntries(s.order.map((id) => [id, 0])) };
  },
  waitingOn: (g) => (g.winner || g.phase !== 'play' ? null : g.order[g.turn]),
  turnKey: (g) => `${g.seq}:${g.phase}`,
  over: (g) => !!g.winner,
  ranking: (g) => [...g.order].sort((a, b) => g.hands[a].length - g.hands[b].length),
  botDelay: () => 1200,
  auto: (g) => (g.winner ? null : g.phase === 'call' ? { a: { t: 'tick' }, delay: 1000 } : g.phase === 'reveal' ? { a: { t: 'tick' }, delay: 2800 } : null),
  timeout: (g) => ({ t: 'play', cards: [g.hands[g.order[g.turn]][0]] }),
  bot(g, pid) {
    const hand = g.hands[pid], want = RANKS[g.claim];
    const honest = hand.filter((c) => rankOf(c) === want).slice(0, 4);
    if (honest.length && Math.random() < 0.85) return { t: 'play', cards: honest };
    const n = Math.random() < 0.3 && hand.length > 2 ? 2 : 1;
    return { t: 'play', cards: shuffle(hand).slice(0, n) };
  },
  act(g, pid, a) {
    if (g.winner) return null;
    if (a.t === 'tick') {
      if (pid !== AUTO) return null;
      if (g.phase === 'reveal' && g.reveal) {
        const r = g.reveal, last = g.last!;
        const hands = { ...g.hands, [r.loser]: [...g.hands[r.loser], ...g.pile] };
        const n: JGame = { ...g, hands, pile: [], phase: 'play', reveal: null, seq: g.seq + 1, turn: next(g, g.order.indexOf(last.pid)), claim: (last.claim + 1) % 13 };
        if (hands[last.pid].length === 0) return { ...n, winner: last.pid, note: `${g.names[last.pid]} emptied their hand!` };
        return n;
      }
      if (g.phase === 'call' && g.last) {
        // Bots may call while the window is open.
        const last = g.last, want = RANKS[last.claim];
        for (const b of shuffle(g.bots.filter((x) => x !== last.pid))) {
          const mine = g.hands[b].filter((c) => rankOf(c) === want).length;
          const sure = mine + last.cards.length > 4, lastCards = g.hands[last.pid].length === 0;
          if (sure || (lastCards && Math.random() < 0.5) || Math.random() < 0.06 * last.cards.length) return jsRules.act(g, b, { t: 'call' });
        }
        if (g.clock > 1) return { ...g, clock: g.clock - 1 };
        const n: JGame = { ...g, phase: 'play', seq: g.seq + 1, turn: next(g, g.order.indexOf(last.pid)), claim: (last.claim + 1) % 13, note: `Nobody called. Next: ${RANKS[(last.claim + 1) % 13]}s` };
        if (g.hands[last.pid].length === 0) return { ...n, winner: last.pid, note: `${g.names[last.pid]} got away with it and wins!` };
        return n;
      }
      return null;
    }
    if (a.t === 'call') {
      if (g.phase !== 'call' || !g.last || pid === g.last.pid || !g.order.includes(pid)) return null;
      const liar = g.last.cards.some((c) => rankOf(c) !== RANKS[g.last!.claim]);
      const loser = liar ? g.last.pid : pid;
      return {
        ...g, phase: 'reveal', reveal: { caller: pid, liar, cards: g.last.cards, loser, claim: g.last.claim }, seq: g.seq + 1,
        note: liar ? `JHOOTH! ${g.names[g.last.pid]} was bluffing and takes the pile` : `${g.names[pid]} called wrong and takes the pile`,
        caught: liar ? { ...g.caught, [pid]: g.caught[pid] + 1 } : g.caught,
      };
    }
    if (a.t === 'play') {
      if (g.phase !== 'play' || g.order[g.turn] !== pid) return null;
      const hand = g.hands[pid], cards = [...new Set(a.cards)].filter((c) => hand.includes(c));
      if (cards.length < 1 || cards.length > 4) return null;
      const bluff = cards.some((c) => rankOf(c) !== RANKS[g.claim]);
      return {
        ...g, hands: { ...g.hands, [pid]: hand.filter((c) => !cards.includes(c)) }, pile: [...g.pile, ...cards],
        last: { pid, cards, claim: g.claim }, phase: 'call', clock: CALL_SECS, seq: g.seq + 1,
        note: `${g.names[pid]}: "${cards.length} × ${RANKS[g.claim]}${pick(['', ', I swear!', ', sach mein!', ''])}"`,
        bluffs: bluff ? { ...g.bluffs, [pid]: g.bluffs[pid] + 1 } : g.bluffs,
      };
    }
    return null;
  },
};
