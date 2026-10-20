import { useState } from 'react';
import { seatOrder, type GameState } from '../game/engine';
import type { Session, Status } from '../game/net';
import { sfx } from '../game/sound';
import { Backdrop, ModePicker } from './Home';

interface Props {
  session: Session;
  state: GameState | null;
  code: string;
  status: { st: Status; msg?: string };
  onLeave(): void;
}

export function Lobby({ session, state, code, status, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const isHost = state?.hostId === session.myId;
  const players = state?.players ?? [];
  const link = `${location.origin}/?room=${code}`;
  const colors = seatOrder(Math.max(2, players.length));

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); } catch { /* clipboard blocked */ }
    sfx.pop(); setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const share = async () => {
    const text = `Join my Ludo Nova game! Code: ${code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Ludo Nova', text, url: link }); } catch { /* cancelled */ } }
    else window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`, '_blank');
  };

  return (
    <div className="screen lobby">
      <Backdrop />
      <div className="topbar">
        <button className="btn ghost sm" onClick={onLeave}>← Leave</button>
        <span className={`dot ${status.st}`}>{status.st === 'online' ? 'Live' : status.st === 'connecting' ? 'Connecting…' : status.msg ?? status.st}</span>
      </div>

      <section className="room-code card">
        <small>ROOM CODE</small>
        {code ? (
          <button className="code" onClick={copy} aria-label="Copy room code">
            {code.split('').map((ch, i) => <span key={i} style={{ animationDelay: `${i * 70}ms` }}>{ch}</span>)}
          </button>
        ) : <div className="code loading"><span className="spinner" /></div>}
        <div className="row">
          <button className="btn glass sm" onClick={copy} disabled={!code}>{copied ? '✓ Copied' : '⧉ Copy'}</button>
          <button className="btn primary sm" onClick={share} disabled={!code}>↗ Invite friends</button>
        </div>
      </section>

      <section className="seats">
        {[0, 1, 2, 3].map((i) => {
          const p = players[i];
          const c = p ? colors[i] ?? 'blue' : undefined;
          return (
            <div key={i} className={`seat ${p ? `filled ${c}` : ''}`} style={{ animationDelay: `${i * 80}ms` }}>
              {p ? (
                <>
                  <div className="seat-av">{p.avatar}</div>
                  <div className="seat-name">{p.name}{p.id === session.myId && <em> (you)</em>}</div>
                  <div className="seat-tag">{p.id === state?.hostId ? '👑 Host' : p.bot ? 'Bot' : 'Ready'}</div>
                  {isHost && p.id !== state?.hostId && (
                    <button className="kick" onClick={() => session.act({ t: 'kick', id: p.id })} aria-label="Remove">✕</button>
                  )}
                </>
              ) : (
                <>
                  <div className="seat-av empty">?</div>
                  <div className="seat-name dim">Waiting…</div>
                  {isHost && <button className="btn ghost xs" onClick={() => { sfx.tap(); session.act({ t: 'addBot' }); }}>+ Add bot</button>}
                </>
              )}
            </div>
          );
        })}
      </section>

      {state && (
        <section className="card lobby-mode">
          <ModePicker mode={state.mode} onMode={(m) => session.act({ t: 'mode', mode: m })} disabled={!isHost} />
          <div className="timer-pick">
            <span>⏱ Time per turn</span>
            <div className="seg">
              {[0, 10000, 15000, 20000, 30000].map((ms) => (
                <button key={ms} disabled={!isHost} className={state.turnMs === ms ? 'on' : ''}
                  onClick={() => { sfx.tap(); session.act({ t: 'timer', ms }); }}>{ms ? `${ms / 1000}s` : 'Off'}</button>
              ))}
            </div>
          </div>
        </section>
      )}

      {isHost ? (
        <button className="btn primary big start" disabled={players.length < 2} onClick={() => { sfx.turn(); session.act({ t: 'start' }); }}>
          {players.length < 2 ? 'Waiting for players…' : `Start game · ${players.length} players`}
        </button>
      ) : (
        <div className="waiting-host"><span className="spinner" /> Waiting for host to start</div>
      )}
    </div>
  );
}
