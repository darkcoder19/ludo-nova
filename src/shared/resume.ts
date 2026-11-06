// Remembers the game you are in, so leaving by mistake (✕, refresh, closing the app) isn't the end of it.
// Guests keep the room code; hosts and bot games also keep the game itself, since it runs on this device.
export interface Resume { kind: 'host' | 'join' | 'solo'; code: string; at: number; state?: unknown }

const KEY = (game: string) => `resume-${game}`;
const MAX_AGE = 60 * 60_000;

export function saveResume(game: string, r: Resume) {
  try { localStorage.setItem(KEY(game), JSON.stringify(r)); } catch { /* storage full or blocked */ }
}

export function loadResume(game: string): Resume | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY(game)) || 'null') as Resume | null;
    return r && Date.now() - r.at < MAX_AGE ? r : null;
  } catch { return null; }
}

export function clearResume(game: string) {
  try { localStorage.removeItem(KEY(game)); } catch { /* blocked */ }
}

/** Keep the resume entry in step with the game: saved while it is being played, dropped once it ends. */
export function trackResume(game: string, phase: string, s: { code: string; myId: string; local: boolean }, hostId: string, state: unknown) {
  if (phase === 'over') { clearResume(game); return; }
  if (phase !== 'playing' || (!s.local && !s.code)) return;
  const kind = s.local ? 'solo' : hostId === s.myId ? 'host' : 'join';
  saveResume(game, { kind, code: s.code, at: Date.now(), state: kind === 'join' ? undefined : state });
}
