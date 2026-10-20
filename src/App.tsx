import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Mode } from './game/engine';
import { hostRoom, joinRoom, localGame, type Emote, type Session, type Status } from './game/net';
import { loadProfile, saveProfile, type Profile } from './game/profile';
import { Home } from './components/Home';
import { Lobby } from './components/Lobby';
import { GameView } from './components/GameView';

export type StartOpts =
  | { kind: 'host' }
  | { kind: 'join'; code: string }
  | { kind: 'solo'; bots: number; mode: Mode };

export default function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<{ st: Status; msg?: string }>({ st: 'closed' });
  const [code, setCode] = useState('');
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [error, setError] = useState('');
  const sessionRef = useRef<Session | null>(null);

  const updateProfile = useCallback((p: Profile) => { setProfile(p); saveProfile(p); }, []);

  const start = (o: StartOpts) => {
    setError('');
    const handlers = {
      onState: setState,
      onEmote: (e: Emote) => setEmotes((list) => [...list.slice(-6), e]),
      onStatus: (st: Status, msg?: string) => {
        setStatus({ st, msg });
        if (st === 'closed' && msg) { setError(msg); leave(); }
      },
    };
    const { id, name, avatar } = profile;
    let s: Session;
    if (o.kind === 'solo') s = localGame(id, name, avatar, o.bots, o.mode, handlers);
    else if (o.kind === 'host') s = hostRoom(id, name, avatar, handlers, setCode);
    else { s = joinRoom(o.code, id, name, avatar, handlers); setCode(o.code.toUpperCase()); setUrlRoom(o.code.toUpperCase()); }
    sessionRef.current = s;
    setSession(s);
  };

  const leave = () => {
    sessionRef.current?.leave();
    sessionRef.current = null;
    setSession(null); setState(null); setCode(''); setEmotes([]);
    setUrlRoom('');
  };

  useEffect(() => () => sessionRef.current?.leave(), []);

  if (!session) return <Home profile={profile} onProfile={updateProfile} onStart={start} error={error} />;
  if (!state || state.phase === 'lobby')
    return <Lobby session={session} state={state} code={code} status={status} onLeave={leave} />;
  return (
    <GameView session={session} state={state} status={status} emotes={emotes}
      profile={profile} onProfile={updateProfile} onLeave={leave} />
  );
}

function setUrlRoom(code: string) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code); else url.searchParams.delete('room');
  history.replaceState(null, '', url);
}
