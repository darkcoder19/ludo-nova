// Kabaddi Raid: the raider secretly picks a lane and how deep to go; the defender secretly picks a lane and a tackle.
// Touch defenders and get back for points; get tackled and you're out. Wipe out a whole side for an all-out bonus.
import { AUTO, type Rules, type Seat } from '../../shared/room';
import { pick, seats } from '../common';

export const LANES = ['Left', 'Centre', 'Right'];
export const DEPTHS = [{ d: 1, e: '👆', name: 'Quick touch', hint: '1 point, safe-ish' }, { d: 2, e: '🏃', name: 'Deep raid', hint: '2 points' }, { d: 3, e: '🔥', name: 'Super raid', hint: '3 points, risky' }];
export const TACKLES = [{ k: 'ankle', e: '🦶', name: 'Ankle hold', hint: 'Stops quick touches' }, { k: 'chain', e: '⛓️', name: 'Chain tackle', hint: 'Stops deep raids' }];
export interface Raid { lane: number; depth: number; dl: number; tk: string; pts: number; tackled: boolean; text: string; raider: string; id: number }
export interface KGame {
  order: string[]; names: Record<string, string>; bots: string[];
  raid: number; total: number; score: Record<string, number>; men: Record<string, number>;
  phase: 'pick' | 'show'; picks: { lane?: number; depth?: number; dl?: number; tk?: string }; last: Raid | null; seq: number; note: string;
  winner: string | null; tie: boolean; supers: Record<string, number>;
}
export type KAction = { t: 'raid'; lane: number; depth: number } | { t: 'defend'; lane: number; tk: string } | { t: 'next' };
let rid = Date.now();
export const raiderOf = (g: KGame) => g.order[g.raid % 2];
export const defenderOf = (g: KGame) => g.order[1 - (g.raid % 2)];

export const kbRules: Rules<KGame, KAction> & { ranking(g: KGame): string[] } = {
  maxPlayers: 2,
  start(players: Seat[], o) {
    const s = seats(players);
    return { ...s, raid: 0, total: Number(o.raids) || 12, score: Object.fromEntries(s.order.map((id) => [id, 0])), men: Object.fromEntries(s.order.map((id) => [id, 7])), phase: 'pick', picks: {}, last: null, seq: 1, note: 'Kabaddi kabaddi kabaddi…', winner: null, tie: false, supers: Object.fromEntries(s.order.map((id) => [id, 0])) };
  },
  waitingOn: (g) => (g.winner || g.tie || g.phase !== 'pick' ? null : g.picks.lane == null ? raiderOf(g) : g.picks.dl == null ? defenderOf(g) : null),
  turnKey: (g) => `${g.seq}:${g.picks.lane != null}:${g.picks.dl != null}`,
  over: (g) => !!g.winner || g.tie,
  ranking: (g) => [...g.order].sort((a, b) => g.score[b] - g.score[a]),
  botDelay: () => 900,
  auto: (g) => (g.winner || g.tie || g.phase !== 'show' ? null : { a: { t: 'next' }, delay: 2800 }),
  bot: (g, pid) => (pid === raiderOf(g) ? { t: 'raid', lane: Math.floor(Math.random() * 3), depth: pick([1, 1, 2, 2, 3]) } : { t: 'defend', lane: Math.floor(Math.random() * 3), tk: pick(['ankle', 'chain']) }),
  timeout: (g, pid) => kbRules.bot(g, pid),
  act(g, pid, a) {
    if (g.winner || g.tie) return null;
    if (a.t === 'next') {
      if (pid !== AUTO || g.phase !== 'show') return null;
      const raid = g.raid + 1;
      if (raid >= g.total) {
        const [x, y] = g.order;
        if (g.score[x] === g.score[y]) return { ...g, tie: true, note: 'Full time: a tie!' };
        const w = g.score[x] > g.score[y] ? x : y;
        return { ...g, winner: w, note: `Full time! ${g.names[w]} wins` };
      }
      return { ...g, raid, phase: 'pick', picks: {}, seq: g.seq + 1, note: `Raid ${raid + 1} of ${g.total}: ${g.names[g.order[raid % 2]]} raids` };
    }
    if (g.phase !== 'pick') return null;
    const r = raiderOf(g), d = defenderOf(g);
    let picks = g.picks;
    if (a.t === 'raid' && pid === r && picks.lane == null && [0, 1, 2].includes(a.lane) && [1, 2, 3].includes(a.depth)) picks = { ...picks, lane: a.lane, depth: a.depth };
    else if (a.t === 'defend' && pid === d && picks.dl == null && [0, 1, 2].includes(a.lane) && ['ankle', 'chain'].includes(a.tk)) picks = { ...picks, dl: a.lane, tk: a.tk };
    else return null;
    if (picks.lane == null || picks.dl == null) return { ...g, picks };
    const depth = picks.depth!, same = picks.lane === picks.dl, right = (picks.tk === 'ankle') === (depth === 1);
    let pts = 0, tackled = false, text: string;
    const score = { ...g.score }, men = { ...g.men }, supers = { ...g.supers };
    if (!same) { pts = depth; text = depth === 3 ? 'SUPER RAID! Three touches and back!' : `Clean raid! ${depth} point${depth > 1 ? 's' : ''}`; if (depth === 3) supers[r]++; }
    else if (right) { tackled = true; text = depth === 3 ? 'SUPER TACKLE! Raider caught deep!' : 'TACKLED! Raider is out'; }
    else { pts = 1; text = 'Slipped the tackle! 1 point'; }
    if (tackled) { score[d] += depth === 3 ? 2 : 1; men[r] = Math.max(0, men[r] - 1); men[d] = Math.min(7, men[d] + 1); }
    else { score[r] += pts; men[d] = Math.max(0, men[d] - pts); men[r] = Math.min(7, men[r] + pts); }
    for (const [side, other] of [[r, d], [d, r]]) if (men[side] === 0) { score[other] += 2; men[side] = 7; text += ` · ALL OUT! +2 ${g.names[other]}`; }
    return { ...g, picks, score, men, supers, phase: 'show', seq: g.seq + 1, note: text, last: { lane: picks.lane, depth, dl: picks.dl, tk: picks.tk!, pts, tackled, text, raider: r, id: rid++ } };
  },
};
