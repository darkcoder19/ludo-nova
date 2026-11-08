// Bol Bachchan: everyone gets the same secret word except one bahurupiya, who only knows the category.
// One clue each, then vote out the faker. Caught? The faker can still steal points by guessing the word.
import { AUTO, type Rules, type Seat } from '../../shared/room';
import { clean, pick, seats, shuffle, zeros } from '../common';

type Pack = Record<string, Record<string, string[]>>;
export const PACK: Pack = {
  Food: { Samosa: ['triangle', 'chutney', 'crispy', 'potato'], Biryani: ['rice', 'dum', 'spicy', 'Hyderabad'], 'Pani Puri': ['tangy', 'street', 'water', 'round'], Jalebi: ['sweet', 'spiral', 'syrup', 'orange'], Dosa: ['crispy', 'south', 'sambar', 'thin'], Maggi: ['two minutes', 'hostel', 'noodles', 'packet'] },
  Places: { Beach: ['sand', 'waves', 'sunset', 'Goa'], Railway: ['platform', 'tickets', 'chai', 'coolie'], Temple: ['bell', 'prasad', 'shoes off', 'aarti'], Hostel: ['roommate', 'mess', 'curfew', 'warden'], Mall: ['escalator', 'shopping', 'food court', 'sale'], Hospital: ['doctor', 'nurse', 'injection', 'ward'] },
  Festivals: { Diwali: ['diya', 'crackers', 'rangoli', 'sweets'], Holi: ['colours', 'gulal', 'pichkari', 'bhang'], Raksha: ['thread', 'sister', 'gift', 'brother'], Navratri: ['garba', 'dandiya', 'nine', 'dance'], Eid: ['sevaiyan', 'moon', 'hug', 'eidi'], Christmas: ['tree', 'cake', 'Santa', 'carols'] },
  Cricket: { Sixer: ['boundary', 'crowd', 'big hit', 'ropes'], Umpire: ['finger', 'hat', 'decision', 'out'], Pitch: ['22 yards', 'grass', 'crack', 'roller'], Helmet: ['grill', 'head', 'safety', 'bouncer'], 'Super Over': ['tie', 'extra', 'six balls', 'thriller'], Stumps: ['three', 'bails', 'bowled', 'wood'] },
  Campus: { Exam: ['marks', 'pen', 'night out', 'paper'], Canteen: ['chai', 'samosa', 'gossip', 'udhaar'], Library: ['silence', 'books', 'card', 'study'], Proxy: ['attendance', 'friend', 'roll call', 'caught'], Fest: ['stage', 'DJ', 'sponsor', 'night'], Placement: ['package', 'interview', 'resume', 'offer'] },
  Things: { Umbrella: ['rain', 'fold', 'handle', 'monsoon'], Pressure: ['whistle', 'cooker', 'kitchen', 'steam'], Remote: ['TV', 'buttons', 'lost', 'sofa'], Charger: ['phone', 'cable', 'plug', 'battery'], Mirror: ['reflection', 'glass', 'selfie', 'bathroom'], Scooty: ['two wheels', 'helmet', 'petrol', 'kick'] },
};
export const CAT_CLUES: Record<string, string[]> = {
  Food: ['tasty', 'spicy', 'eat', 'hungry', 'plate'], Places: ['crowd', 'visit', 'go there', 'people', 'trip'], Festivals: ['family', 'celebrate', 'lights', 'holiday', 'puja'],
  Cricket: ['match', 'team', 'score', 'India', 'bat'], Campus: ['college', 'friends', 'semester', 'professor', 'bunk'], Things: ['use daily', 'home', 'handy', 'buy', 'small'],
};

export interface BClue { pid: string; text: string }
export interface BGame {
  order: string[]; names: Record<string, string>; bots: string[];
  round: number; rounds: number; imp: string; cat: string; word: string; options: string[];
  phase: 'clue' | 'vote' | 'guess' | 'reveal'; spoke: number; passes: number; clues: BClue[];
  votes: Record<string, string>; clock: number; score: Record<string, number>; seq: number;
  accused: string | null; caught: boolean; guessed: string | null; note: string; catches: Record<string, number>;
}
export type BAction = { t: 'clue'; text: string } | { t: 'vote'; who: string } | { t: 'guess'; word: string } | { t: 'tick' };
const VOTE_SECS = 25;

function deal(g: Omit<BGame, 'imp' | 'cat' | 'word' | 'options'> & Partial<BGame>): BGame {
  const cat = pick(Object.keys(PACK)), word = pick(Object.keys(PACK[cat]));
  const options = shuffle([word, ...shuffle(Object.keys(PACK[cat]).filter((w) => w !== word)).slice(0, 3)]);
  const order = shuffle(g.order); // a new speaking order each round
  return { ...g, order, imp: pick(g.order), cat, word, options, phase: 'clue', spoke: 0, clues: [], votes: {}, clock: 0, accused: null, caught: false, guessed: null, note: `Round ${g.round}: give one clue for the word` } as BGame;
}
const speaker = (g: BGame) => g.order[g.spoke % g.order.length];

export const bbRules: Rules<BGame, BAction> & { ranking(g: BGame): string[] } = {
  maxPlayers: 6,
  start(players: Seat[], o) {
    const s = seats(players);
    return deal({ ...s, round: 1, rounds: Number(o.rounds) || 3, passes: s.order.length <= 4 ? 2 : 1, score: zeros(s.order), seq: 1, phase: 'clue', spoke: 0, clues: [], votes: {}, clock: 0, accused: null, caught: false, guessed: null, note: '', catches: zeros(s.order) });
  },
  waitingOn: (g) => (g.phase === 'clue' ? speaker(g) : g.phase === 'guess' ? g.imp : null),
  turnKey: (g) => `${g.seq}`,
  over: (g) => g.round > g.rounds,
  ranking: (g) => [...g.order].sort((a, b) => g.score[b] - g.score[a]),
  botDelay: () => 1700,
  auto: (g) => (g.round > g.rounds ? null : g.phase === 'vote' ? { a: { t: 'tick' }, delay: 1000 } : g.phase === 'reveal' ? { a: { t: 'tick' }, delay: 5500 } : null),
  timeout: (g, pid) => (g.phase === 'guess' ? { t: 'guess', word: pick(g.options) } : pid ? { t: 'clue', text: '🤐' } : null),
  bot(g, pid) {
    if (g.phase === 'guess') return { t: 'guess', word: Math.random() < 0.45 ? g.word : pick(g.options) };
    const used = new Set(g.clues.map((c) => c.text.toLowerCase()));
    const pool = pid === g.imp ? [...CAT_CLUES[g.cat], ...g.clues.map((c) => c.text)] : PACK[g.cat][g.word];
    const fresh = pool.filter((w) => !used.has(w.toLowerCase()));
    return { t: 'clue', text: fresh.length ? pick(fresh) : pick(CAT_CLUES[g.cat]) };
  },
  act(g, pid, a) {
    if (g.round > g.rounds) return null;
    if (a.t === 'clue') {
      if (g.phase !== 'clue' || speaker(g) !== pid) return null;
      const text = clean(a.text, 20) || '🤐';
      const clues = [...g.clues, { pid, text }], spoke = g.spoke + 1;
      if (spoke >= g.order.length * g.passes) return { ...g, clues, spoke, phase: 'vote', clock: VOTE_SECS, seq: g.seq + 1, note: 'Who is the bahurupiya? Vote!' };
      return { ...g, clues, spoke, seq: g.seq + 1 };
    }
    if (a.t === 'vote') {
      if (g.phase !== 'vote' || !g.order.includes(pid) || !g.order.includes(a.who) || a.who === pid) return null;
      const votes = { ...g.votes, [pid]: a.who };
      return Object.keys(votes).length >= g.order.length ? tally({ ...g, votes }) : { ...g, votes };
    }
    if (a.t === 'guess') {
      if (g.phase !== 'guess' || pid !== g.imp) return null;
      const right = a.word === g.word;
      const score = { ...g.score }; if (right) score[g.imp] += 2;
      return { ...g, guessed: a.word, score, phase: 'reveal', seq: g.seq + 1, note: right ? `Caught, but ${g.names[g.imp]} guessed "${g.word}"! +2` : `${g.names[g.imp]} guessed "${a.word}". Wrong!` };
    }
    if (a.t === 'tick' && pid === AUTO) {
      if (g.phase === 'reveal') {
        const round = g.round + 1;
        if (round > g.rounds) return { ...g, round, seq: g.seq + 1 };
        return { ...deal({ ...g, round }), seq: g.seq + 1 };
      }
      if (g.phase === 'vote') {
        let votes = g.votes;
        for (const b of g.bots) if (!votes[b] && Math.random() < 0.3) {
          // bots lean toward whoever gave the vaguest (category-style) clue
          const sus = g.order.filter((x) => x !== b), vague = sus.filter((x) => g.clues.some((c) => c.pid === x && CAT_CLUES[g.cat].includes(c.text)));
          const who = b === g.imp ? pick(sus.filter((x) => x !== b)) : vague.length && Math.random() < 0.7 ? pick(vague) : pick(sus);
          votes = { ...votes, [b]: who };
        }
        const n = { ...g, votes, clock: g.clock - 1 };
        return Object.keys(votes).length >= g.order.length || n.clock <= 0 ? tally(n) : n;
      }
    }
    return null;
  },
};

function tally(g: BGame): BGame {
  const count: Record<string, number> = {};
  for (const v of Object.values(g.votes)) count[v] = (count[v] ?? 0) + 1;
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]);
  const accused = top.length && (top.length === 1 || top[0][1] > top[1][1]) ? top[0][0] : null;
  const caught = accused === g.imp, score = { ...g.score }, catches = { ...g.catches };
  if (caught) for (const id of g.order) { if (id !== g.imp) score[id] += 1; if (g.votes[id] === g.imp) catches[id]++; }
  else score[g.imp] += 3;
  const note = caught ? `Caught! ${g.names[g.imp]} was the bahurupiya. Last chance: guess the word…` : accused ? `${g.names[accused]} was innocent! ${g.names[g.imp]} escapes. +3` : `Votes tied! ${g.names[g.imp]} escapes. +3`;
  return { ...g, accused, caught, score, catches, phase: caught ? 'guess' : 'reveal', seq: g.seq + 1, note };
}
