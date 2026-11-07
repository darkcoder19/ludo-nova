// The reasons to come back: daily quests with a streak, badges you can wear as a title, and dice skins
// that unlock as you level up. Everything lives on the device with the profile, shared by every Sarvimo game.
import { levelOf, saveProfile, type Profile } from './profile';
import { festivalOn } from './festivals';

export type Stats = Record<string, number>;

export interface Quest { id: string; game: string; text: string; stat: string; target: number; mode: 'sum' | 'best'; xp: number }
export const QUESTS: Quest[] = [
  { id: 'play2', game: 'any', text: 'Play 2 games', stat: 'played', target: 2, mode: 'sum', xp: 30 },
  { id: 'play3', game: 'any', text: 'Play 3 games', stat: 'played', target: 3, mode: 'sum', xp: 45 },
  { id: 'win1', game: 'any', text: 'Win any game', stat: 'won', target: 1, mode: 'sum', xp: 50 },
  { id: 'top2', game: 'any', text: 'Finish in the top 2 twice', stat: 'top2', target: 2, mode: 'sum', xp: 40 },
  { id: 'dk_hotel', game: 'dhandhaking', text: 'Build a hotel in DhandhaKing', stat: 'dk_hotel', target: 1, mode: 'sum', xp: 50 },
  { id: 'dk_rent', game: 'dhandhaking', text: 'Collect ₹6,000 rent in one DhandhaKing game', stat: 'dk_rent', target: 6000, mode: 'best', xp: 45 },
  { id: 'dk_deal', game: 'dhandhaking', text: 'Close a city deal in DhandhaKing', stat: 'dk_deals', target: 1, mode: 'sum', xp: 40 },
  { id: 'dk_bolee', game: 'dhandhaking', text: 'Win a bolee in DhandhaKing', stat: 'dk_bolees', target: 1, mode: 'sum', xp: 35 },
  { id: 'dk_seth', game: 'dhandhaking', text: 'Sell a city to Seth-ji', stat: 'dk_seth', target: 1, mode: 'sum', xp: 35 },
  { id: 'dk_set', game: 'dhandhaking', text: 'Complete a colour set in DhandhaKing', stat: 'dk_sets', target: 1, mode: 'best', xp: 40 },
  { id: 'ln_cap', game: 'ludonova', text: 'Capture 3 tokens in LudoNova', stat: 'captures', target: 3, mode: 'sum', xp: 40 },
  { id: 'ln_win', game: 'ludonova', text: 'Win a LudoNova game', stat: 'ln_won', target: 1, mode: 'sum', xp: 50 },
  { id: 'sr_ladder', game: 'seedhirush', text: 'Climb 4 ladders in SeedhiRush', stat: 'sr_climbs', target: 4, mode: 'sum', xp: 35 },
  { id: 'sr_win', game: 'seedhirush', text: 'Win a SeedhiRush game', stat: 'sr_won', target: 1, mode: 'sum', xp: 45 },
  { id: 'hh_haveli', game: 'haathustle', text: 'Build a haveli in Haat Hustle', stat: 'hh_haveli', target: 1, mode: 'sum', xp: 45 },
  { id: 'hh_play', game: 'haathustle', text: 'Play a Haat Hustle game', stat: 'hh_played', target: 1, mode: 'sum', xp: 30 },
];
export const CHEST_XP = 100;
const SHORT: Record<string, string> = { dhandhaking: 'dk', ludonova: 'ln', seedhirush: 'sr', haathustle: 'hh' };
export const GAME_NAME: Record<string, string> = { dhandhaking: 'DhandhaKing', ludonova: 'LudoNova', seedhirush: 'SeedhiRush', haathustle: 'Haat Hustle', any: 'Any game' };

export interface Badge { id: string; emoji: string; name: string; how: string }
export const BADGES: Badge[] = [
  { id: 'first_win', emoji: '🥇', name: 'First Blood', how: 'Win your first game' },
  { id: 'wins10', emoji: '🏆', name: 'Ten-Time Topper', how: 'Win 10 games' },
  { id: 'games25', emoji: '🎮', name: 'Regular', how: 'Play 25 games' },
  { id: 'games100', emoji: '💯', name: 'Centurion', how: 'Play 100 games' },
  { id: 'streak3', emoji: '🔥', name: 'On Fire', how: 'Do a quest 3 days in a row' },
  { id: 'streak7', emoji: '⚡', name: 'Unstoppable', how: 'Do a quest 7 days in a row' },
  { id: 'chest', emoji: '🎁', name: 'Full Attendance', how: 'Finish all 3 quests in one day' },
  { id: 'level5', emoji: '🎓', name: 'Senior', how: 'Reach level 5' },
  { id: 'level10', emoji: '🧠', name: 'Professor', how: 'Reach level 10' },
  { id: 'rent_lord', emoji: '👑', name: 'Rent Lord', how: 'Collect the most rent in a DhandhaKing game' },
  { id: 'influencer', emoji: '📸', name: 'Real-Estate Influencer', how: 'Buy the most cities in a DhandhaKing game' },
  { id: 'builder', emoji: '🏗️', name: 'Builder Bro', how: 'Build the most in a DhandhaKing game' },
  { id: 'tapri', emoji: '☕', name: 'Tapri Regular', how: 'Win the Tapri gullak most often in a game' },
  { id: 'comeback', emoji: '🔥', name: 'Comeback Kid', how: 'Climb back from almost broke in DhandhaKing' },
  { id: 'seth', emoji: '🧔', name: "Seth-ji's Favourite", how: 'Sell a city to Seth-ji' },
  { id: 'dealer', emoji: '🤝', name: 'Deal Maker', how: 'Close 3 deals in one DhandhaKing game' },
  { id: 'hunter', emoji: '🎯', name: 'Token Hunter', how: 'Capture 5 tokens in one LudoNova game' },
  { id: 'ladder', emoji: '🪜', name: 'Ladder Legend', how: 'Climb 5 ladders in one SeedhiRush game' },
  { id: 'haveli', emoji: '🏰', name: 'Haveli Owner', how: 'Build a haveli in Haat Hustle' },
];
export const badgeOf = (id?: string) => BADGES.find((b) => b.id === id);
export const titleText = (id?: string) => { const b = badgeOf(id); return b ? `${b.emoji} ${b.name}` : ''; };

/** `fest`: a festival skin, free while its festival is on and kept for good once you play during it. */
export interface Skin { id: string; name: string; level: number; fest?: string }
export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic', level: 1 },
  { id: 'neon', name: 'Neon', level: 2 },
  { id: 'gold', name: 'Sona', level: 4 },
  { id: 'galaxy', name: 'Galaxy', level: 6 },
  { id: 'chai', name: 'Kulhad', level: 8 },
  { id: 'holi', name: 'Holi', level: 10, fest: 'Holi' },
  { id: 'diya', name: 'Diya', level: 99, fest: 'Diwali' },
];
export const skinUnlocked = (p: Profile, id: string) => levelOf(p.xp) >= (SKINS.find((s) => s.id === id)?.level ?? 99) || !!p.collected?.includes(id) || festivalOn()?.skin === id;
/** A seat's skin as other players see it: only known skins, else Classic. */
export const skinClass = (id?: string) => `skin-${SKINS.some((s) => s.id === id) ? id : 'classic'}`;

// ---------- days ----------
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayBefore = (day: string) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() - 1); return localDay(d); };

function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
/** Today's three quests: one for any game, two for two different games. Same for everyone on the same day. */
export function questsFor(day: string): Quest[] {
  let h = hash(day);
  const pick = <T,>(arr: T[]) => { h = Math.imul(h ^ (h >>> 13), 2246822507) >>> 0; return arr[h % arr.length]; };
  const games = ['dhandhaking', 'ludonova', 'seedhirush', 'haathustle'];
  const g1 = pick(games), g2 = pick(games.filter((g) => g !== g1));
  return [pick(QUESTS.filter((q) => q.game === 'any')), pick(QUESTS.filter((q) => q.game === g1)), pick(QUESTS.filter((q) => q.game === g2))];
}

export interface Daily { day: string; progress: Record<string, number>; done: string[]; chest?: boolean }
export const dailyOf = (p: Profile): Daily => (p.daily?.day === localDay() ? p.daily : { day: localDay(), progress: {}, done: [] });
/** A streak is alive if a quest was done today or yesterday. */
export const questStreak = (p: Profile) => (p.qLast === localDay() || p.qLast === dayBefore(localDay()) ? p.qStreak ?? 0 : 0);

export interface RivalLine { id: string; name: string; w: number; l: number; won: boolean }
export interface Progress { profile: Profile; quests: Quest[]; chest: boolean; badges: Badge[]; xp: number; rivals?: RivalLine[] }

/** Head-to-head: after a game with friends, whoever finished higher gets the win against each other player. */
export function recordRivals(pr: Progress, me: string, ranking: string[], humans: { id: string; name: string; avatar: string }[]): Progress {
  const mine = ranking.indexOf(me);
  if (mine < 0) return pr;
  const rivals = { ...(pr.profile.rivals ?? {}) }, lines: RivalLine[] = [];
  for (const h of humans) {
    const theirs = ranking.indexOf(h.id);
    if (h.id === me || theirs < 0) continue;
    const won = mine < theirs, r = rivals[h.id] ?? { name: h.name, avatar: h.avatar, w: 0, l: 0, last: '' };
    rivals[h.id] = { name: h.name, avatar: h.avatar, w: r.w + (won ? 1 : 0), l: r.l + (won ? 0 : 1), last: localDay() };
    lines.push({ id: h.id, name: h.name, w: rivals[h.id].w, l: rivals[h.id].l, won });
  }
  if (!lines.length) return pr;
  const profile = { ...pr.profile, rivals };
  saveProfile(profile);
  return { ...pr, profile, rivals: lines };
}

/**
 * Called once when a game ends: moves today's quests along, pays their XP, keeps the streak and hands out badges.
 * `stats` are this player's numbers from the game (rent collected, captures…), `earned` badge ids the game awarded.
 */
export function recordProgress(p: Profile, game: string, place: number, players: number, stats: Stats = {}, earned: string[] = []): Progress {
  const day = localDay(), short = SHORT[game] ?? game;
  const won = place === 1 ? 1 : 0;
  const s: Stats = { played: 1, won, top2: place > 0 && place <= 2 && players > 1 ? 1 : 0, [`${short}_played`]: 1, [`${short}_won`]: won, ...stats };
  const d: Daily = { ...dailyOf(p) };
  d.progress = { ...d.progress }; d.done = [...d.done];
  const quests: Quest[] = [];
  for (const q of questsFor(day)) {
    if (d.done.includes(q.id) || (q.game !== 'any' && q.game !== game)) continue;
    const v = s[q.stat] ?? 0;
    d.progress[q.id] = q.mode === 'sum' ? (d.progress[q.id] ?? 0) + v : Math.max(d.progress[q.id] ?? 0, v);
    if (d.progress[q.id] >= q.target) { d.done.push(q.id); quests.push(q); }
  }
  const fest = festivalOn(day);
  let xp = quests.reduce((t, q) => t + q.xp, 0) * (fest ? 2 : 1); // festivals: double quest XP
  const chest = d.done.length >= 3 && !d.chest;
  if (chest) { d.chest = true; xp += CHEST_XP; }
  let qStreak = p.qStreak ?? 0, qLast = p.qLast ?? '';
  if (quests.length && qLast !== day) { qStreak = qLast === dayBefore(day) ? qStreak + 1 : 1; qLast = day; }

  const next: Profile = { ...p, xp: p.xp + xp, daily: d, qStreak, qLast, qBest: Math.max(p.qBest ?? 0, qStreak), badges: { ...(p.badges ?? {}) } };
  if (fest?.skin && !next.collected?.includes(fest.skin)) next.collected = [...(next.collected ?? []), fest.skin]; // the festival skin is yours to keep
  const gained: Badge[] = [];
  const give = (id: string, repeat = false) => {
    const b = badgeOf(id);
    if (!b || (!repeat && next.badges![id])) return;
    if (!next.badges![id]) gained.push(b);
    next.badges![id] = (next.badges![id] ?? 0) + 1;
  };
  earned.forEach((id) => give(id, true));
  if (won && next.wins >= 1) give('first_win'); // win badges arrive on a winning game
  if (won && next.wins >= 10) give('wins10');
  if (next.games >= 25) give('games25');
  if (next.games >= 100) give('games100');
  if (qStreak >= 3) give('streak3');
  if (qStreak >= 7) give('streak7');
  if (chest) give('chest');
  if (levelOf(next.xp) >= 5) give('level5');
  if (levelOf(next.xp) >= 10) give('level10');
  if (game === 'dhandhaking' && (s.dk_seth ?? 0) > 0) give('seth');
  if (game === 'dhandhaking' && (s.dk_deals ?? 0) >= 3) give('dealer');
  if (game === 'ludonova' && (s.captures ?? 0) >= 5) give('hunter');
  if (game === 'seedhirush' && (s.sr_climbs ?? 0) >= 5) give('ladder');
  if (game === 'haathustle' && (s.hh_haveli ?? 0) > 0) give('haveli');
  saveProfile(next);
  return { profile: next, quests, chest, badges: gained, xp };
}
