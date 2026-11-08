// Cricket Captain Duel: every ball, the batter secretly picks a shot and the bowler secretly picks a delivery.
// The match-up decides runs or a wicket. Bat first, then defend your total.
import { AUTO, type Rules, type Seat } from '../../shared/room';
import { pick, seats } from '../common';

export const SHOTS = [{ k: 'defend', e: '🛡️', name: 'Defend' }, { k: 'drive', e: '🏏', name: 'Drive' }, { k: 'pull', e: '💪', name: 'Pull' }, { k: 'loft', e: '🚀', name: 'Loft' }, { k: 'sweep', e: '🧹', name: 'Sweep' }];
export const BALLS = [{ k: 'yorker', e: '🎯', name: 'Yorker' }, { k: 'bouncer', e: '⬆️', name: 'Bouncer' }, { k: 'length', e: '📏', name: 'Good length' }, { k: 'slower', e: '🐢', name: 'Slower ball' }, { k: 'wide', e: '↔️', name: 'Wide line' }];
// shot × delivery: g = great for the batter, o = ok, b = trouble
const M: Record<string, string> = { defend: 'ooooo', drive: 'bbgog', pull: 'bgobo', loft: 'boogg', sweep: 'gbogb' };
export interface Ball { shot: string; ball: string; runs: number; out: boolean; text: string; id: number }
export interface CGame {
  order: string[]; names: Record<string, string>; bots: string[];
  overs: number; maxW: number; inn: number; bat: number; runs: [number, number]; wk: [number, number]; balls: [number, number];
  phase: 'pick' | 'show' | 'break'; picks: { shot?: string; ball?: string }; last: Ball | null; over: string[]; seq: number;
  winner: string | null; tie: boolean; sixes: Record<string, number>; note: string;
}
export type KAction = { t: 'shot'; k: string } | { t: 'ball'; k: string } | { t: 'next' };
let bid = Date.now();

export const batter = (g: CGame) => g.order[g.inn === 0 ? g.bat : 1 - g.bat];
export const bowler = (g: CGame) => g.order[g.inn === 0 ? 1 - g.bat : g.bat];

function play(shot: string, ball: string): Pick<Ball, 'runs' | 'out' | 'text'> {
  const q = M[shot][BALLS.findIndex((b) => b.k === ball)];
  if (shot === 'defend') { const r = pick([0, 0, 1, 1, 2]); return { runs: r, out: Math.random() < 0.04, text: r ? `${r} run${r > 1 ? 's' : ''}, nudged away` : 'Solid block' }; }
  if (q === 'g') { const r = shot === 'loft' ? pick([6, 6, 4]) : pick([4, 4, 6, 2]); return { runs: r, out: false, text: r === 6 ? 'SIX! Into the stands!' : r === 4 ? 'FOUR! Cracking shot!' : 'Two, good running' }; }
  if (q === 'o') { const r = pick([0, 1, 1, 2, 2, 3, 4]); return { runs: r, out: Math.random() < 0.08, text: r === 4 ? 'Edged, and it runs away for FOUR' : r ? `${r} run${r > 1 ? 's' : ''}` : 'Dot ball' }; }
  const out = Math.random() < 0.55;
  return { runs: 0, out, text: out ? pick(['BOWLED! Stumps everywhere!', 'CAUGHT! Straight to the fielder!', 'LBW! The finger goes up!']) : 'Beaten! Lucky survive' };
}

export const ckRules: Rules<CGame, KAction> & { ranking(g: CGame): string[] } = {
  maxPlayers: 2,
  start(players: Seat[], o) {
    const s = seats(players), overs = Number(o.overs) || 3;
    return { ...s, overs, maxW: overs >= 5 ? 5 : 3, inn: 0, bat: Math.floor(Math.random() * 2), runs: [0, 0], wk: [0, 0], balls: [0, 0], phase: 'pick', picks: {}, last: null, over: [], seq: 1, winner: null, tie: false, sixes: Object.fromEntries(s.order.map((id) => [id, 0])), note: 'Toss done. First innings!' };
  },
  waitingOn: (g) => (g.winner || g.tie || g.phase !== 'pick' ? null : !g.picks.shot ? batter(g) : !g.picks.ball ? bowler(g) : null),
  turnKey: (g) => `${g.seq}:${!!g.picks.shot}:${!!g.picks.ball}`,
  over: (g) => !!g.winner || g.tie,
  ranking: (g) => (g.winner ? [g.winner, ...g.order.filter((x) => x !== g.winner)] : g.order),
  botDelay: () => 900,
  auto: (g) => (g.winner || g.tie ? null : g.phase === 'show' ? { a: { t: 'next' }, delay: 2300 } : g.phase === 'break' ? { a: { t: 'next' }, delay: 3500 } : null),
  bot: (g, pid) => (pid === batter(g) ? { t: 'shot', k: pick(['drive', 'pull', 'loft', 'sweep', 'defend', 'drive']) } : { t: 'ball', k: pick(BALLS).k }),
  timeout: (g, pid) => ckRules.bot(g, pid),
  act(g, pid, a) {
    if (g.winner || g.tie) return null;
    if (a.t === 'next') {
      if (pid !== AUTO) return null;
      if (g.phase === 'break') return { ...g, phase: 'pick', inn: 1, picks: {}, over: [], seq: g.seq + 1, note: `Target: ${g.runs[0] + 1} from ${g.overs * 6} balls` };
      if (g.phase !== 'show') return null;
      const i = g.inn, done = g.balls[i] >= g.overs * 6 || g.wk[i] >= g.maxW;
      const over = g.balls[i] % 6 === 0 ? [] : g.over;
      if (i === 1) {
        if (g.runs[1] > g.runs[0]) return { ...g, winner: batter(g), note: `${g.names[batter(g)]} chased it down!` };
        if (done) return g.runs[1] === g.runs[0] ? { ...g, tie: true, note: "It's a tie!" } : { ...g, winner: bowler(g), note: `${g.names[bowler(g)]} defended the total!` };
      } else if (done) return { ...g, phase: 'break', seq: g.seq + 1, note: `Innings over: ${g.runs[0]}/${g.wk[0]}. Switch sides!` };
      return { ...g, phase: 'pick', picks: {}, over, seq: g.seq + 1 };
    }
    if (g.phase !== 'pick') return null;
    let picks = g.picks;
    if (a.t === 'shot' && pid === batter(g) && !picks.shot && SHOTS.some((s) => s.k === a.k)) picks = { ...picks, shot: a.k };
    else if (a.t === 'ball' && pid === bowler(g) && !picks.ball && BALLS.some((b) => b.k === a.k)) picks = { ...picks, ball: a.k };
    else return null;
    if (!picks.shot || !picks.ball) return { ...g, picks };
    const r = play(picks.shot, picks.ball), i = g.inn;
    const runs = [...g.runs] as [number, number], wk = [...g.wk] as [number, number], balls = [...g.balls] as [number, number];
    runs[i] += r.runs; if (r.out) wk[i]++; balls[i]++;
    const b = batter(g);
    return {
      ...g, picks, runs, wk, balls, phase: 'show', seq: g.seq + 1, last: { shot: picks.shot, ball: picks.ball, ...r, id: bid++ },
      over: [...g.over, r.out ? 'W' : String(r.runs)], sixes: r.runs === 6 ? { ...g.sixes, [b]: g.sixes[b] + 1 } : g.sixes, note: r.text,
    };
  },
};
