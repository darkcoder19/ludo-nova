// Per-device profile & progression, kept in localStorage.
export interface Profile {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  games: number;
  wins: number;
  captures: number;
  streak: number;
  lastDay: string;
  bestStreak: number;
}

export const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🐸', '🦄', '🐙', '🐲', '🦅', '🐺', '👽', '🤠'];
const KEY = 'ln-profile';
const today = () => new Date().toISOString().slice(0, 10);

export function loadProfile(): Profile {
  let p: Partial<Profile> = {};
  try { p = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* fresh */ }
  return {
    id: p.id || (crypto.randomUUID?.() ?? String(Math.random()).slice(2)),
    name: p.name || '',
    avatar: p.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)],
    xp: p.xp || 0, games: p.games || 0, wins: p.wins || 0, captures: p.captures || 0,
    streak: p.streak || 0, lastDay: p.lastDay || '', bestStreak: p.bestStreak || 0,
  };
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

export const levelOf = (xp: number) => Math.floor(Math.sqrt(xp / 50)) + 1;
export const levelFloor = (lvl: number) => (lvl - 1) ** 2 * 50;

/** Records a finished game and returns the XP earned. */
export function recordGame(p: Profile, place: number, players: number, captures: number): { profile: Profile; xp: number } {
  const xp = 20 + (place === 1 ? 60 : Math.max(0, (players - place) * 15)) + captures * 5;
  const d = today();
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = p.lastDay === d ? p.streak : p.lastDay === y ? p.streak + 1 : 1;
  const profile = {
    ...p, xp: p.xp + xp, games: p.games + 1, wins: p.wins + (place === 1 ? 1 : 0),
    captures: p.captures + captures, streak, lastDay: d, bestStreak: Math.max(p.bestStreak, streak),
  };
  saveProfile(profile);
  return { profile, xp };
}

/** A streak only counts if you played today or yesterday. */
export const liveStreak = (p: Profile) => {
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return p.lastDay === today() || p.lastDay === y ? p.streak : 0;
};
