// Small helpers shared by the party games (rooms run by the shared GameShell).
import type { ReactNode } from 'react';
import { PlayerChip, type GameProps } from '../shared/GameShell';
import type { Seat } from '../shared/room';
import './party.css';

export const shuffle = <T,>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export const clean = (s: unknown, n = 24) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, n);
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Seat names and bot flags, kept inside the game state so pure rules can use them. */
export const seats = (players: Seat[]) => ({ order: players.map((p) => p.id), names: Object.fromEntries(players.map((p) => [p.id, p.name])), bots: players.filter((p) => p.bot).map((p) => p.id) });
export const zeros = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0])) as Record<string, number>;
export const byScore = (order: string[], score: Record<string, number>) => [...order].sort((a, b) => score[b] - score[a]);

/** Player chips row. `extra(pid)` renders the small line under each name. */
export function Chips<G, A>({ p, active, extra, cols }: { p: GameProps<G, A>; active?: (id: string) => boolean; extra?: (id: string) => ReactNode; cols?: number }) {
  return (
    <div className="pchips party-chips" style={cols ? { gridTemplateColumns: `repeat(${cols}, 1fr)` } : undefined}>
      {p.room.players.map((s) => (
        <PlayerChip key={s.id} name={s.id === p.me ? `${s.name} (you)` : s.name} avatar={s.avatar} color={p.color(s.id)} active={!!active?.(s.id)} mood={p.mood(s.id)}>
          {extra?.(s.id)}
        </PlayerChip>
      ))}
    </div>
  );
}

/** A simple drawn hero tile for the home screen. */
export function Hero({ emoji, a, b, children }: { emoji: string; a: string; b: string; children?: ReactNode }) {
  const id = `hg${a.slice(1)}${b.slice(1)}`;
  return (
    <svg viewBox="0 0 100 100" className="hero-svg">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
      <rect x="4" y="4" width="92" height="92" rx="22" fill={`url(#${id})`} />
      <circle cx="78" cy="22" r="10" fill="rgba(255,255,255,.25)" /><circle cx="20" cy="82" r="14" fill="rgba(255,255,255,.15)" />
      {children}
      <text x="50" y="66" textAnchor="middle" fontSize="44" className="hero-emoji">{emoji}</text>
    </svg>
  );
}

/** A banner across the board for the current phase. */
export function Banner({ children, tone }: { children: ReactNode; tone?: 'good' | 'bad' | 'info' }) {
  return <div className={`p-banner ${tone ?? 'info'}`}>{children}</div>;
}

/** Seconds left on a host clock that ticks once a second. */
export function Clock({ s, of }: { s: number; of: number }) {
  return <div className="p-clock" style={{ ['--p' as string]: `${Math.max(0, Math.min(1, s / of)) * 360}deg` }}><b>{Math.max(0, Math.ceil(s))}</b></div>;
}
