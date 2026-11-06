import { useState } from 'react';
import { clearResume, loadResume } from '../shared/resume';

/** "Rejoin your game" card on a game's home screen, shown after leaving a game in progress. */
export function RejoinCard({ game, onRejoin }: { game: string; onRejoin(): void }) {
  const [r, setR] = useState(() => loadResume(game));
  if (!r) return null;
  const mins = Math.max(1, Math.round((Date.now() - r.at) / 60_000));
  return (
    <div className="card rejoin">
      <div>
        <b>↩ Your game is still on</b>
        <small>{r.kind === 'solo' ? 'Game vs bots' : `Room ${r.code}${r.kind === 'host' ? ' · you are the host' : ''}`} · left {mins} min ago</small>
      </div>
      <button className="btn primary sm" onClick={onRejoin}>Rejoin</button>
      <button className="btn ghost xs" aria-label="Forget this game" onClick={() => { clearResume(game); setR(null); }}>✕</button>
    </div>
  );
}
