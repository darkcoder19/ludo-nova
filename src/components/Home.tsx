import { useEffect, useState } from 'react';
import type { StartOpts } from '../App';
import type { Mode } from '../game/engine';
import { AVATARS, levelFloor, levelOf, liveStreak, type Profile } from '../game/profile';
import { sfx } from '../game/sound';

interface Props {
  profile: Profile;
  onProfile(p: Profile): void;
  onStart(o: StartOpts): void;
  error: string;
}

type Panel = null | 'join' | 'solo';

export function Home({ profile, onProfile, onStart, error }: Props) {
  const [panel, setPanel] = useState<Panel>(() => (new URLSearchParams(location.search).get('room') ? 'join' : null));
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') ?? '');
  const [bots, setBots] = useState(3);
  const [mode, setMode] = useState<Mode>('classic');
  const [nameErr, setNameErr] = useState(false);
  const install = useInstallPrompt();

  const lvl = levelOf(profile.xp);
  const pct = ((profile.xp - levelFloor(lvl)) / (levelFloor(lvl + 1) - levelFloor(lvl))) * 100;
  const streak = liveStreak(profile);

  const go = (o: StartOpts) => {
    if (!profile.name.trim()) { setNameErr(true); sfx.pop(); return; }
    sfx.tap();
    onStart(o);
  };

  return (
    <div className="screen home">
      <Backdrop />
      <header className="brand">
        <div className="logo-mark" aria-hidden>
          <span /><span /><span /><span />
        </div>
        <h1>Ludo<em>Nova</em></h1>
        <p className="tag">Roll. Race. Rule the board.</p>
      </header>

      <section className="card profile">
        <div className="avatar-row">
          {AVATARS.map((a) => (
            <button key={a} className={`av ${a === profile.avatar ? 'on' : ''}`} onClick={() => { sfx.tap(); onProfile({ ...profile, avatar: a }); }}>{a}</button>
          ))}
        </div>
        <input
          className={`name ${nameErr ? 'err' : ''}`}
          placeholder="Your nickname"
          maxLength={14}
          value={profile.name}
          onChange={(e) => { setNameErr(false); onProfile({ ...profile, name: e.target.value }); }}
        />
        <div className="progress">
          <div className="lvl">LV {lvl}</div>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="streak" title="Daily streak">🔥 {streak}</div>
        </div>
        <div className="mini-stats">
          <span><b>{profile.games}</b> games</span>
          <span><b>{profile.wins}</b> wins</span>
          <span><b>{profile.captures}</b> captures</span>
        </div>
      </section>

      {error && <div className="banner err">{error}</div>}

      <section className="actions">
        <button className="btn primary big" onClick={() => go({ kind: 'host' })}>
          <span className="ic">✦</span> Create Room
        </button>
        <button className={`btn glass big ${panel === 'join' ? 'active' : ''}`} onClick={() => { sfx.tap(); setPanel(panel === 'join' ? null : 'join'); }}>
          <span className="ic">⇥</span> Join Room
        </button>
        {panel === 'join' && (
          <form className="card drawer" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 4) go({ kind: 'join', code: code.trim() }); }}>
            <input
              className="code-input"
              placeholder="CODE"
              maxLength={5}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
            <button className="btn primary" disabled={code.length < 5}>Join</button>
          </form>
        )}
        <button className={`btn glass big ${panel === 'solo' ? 'active' : ''}`} onClick={() => { sfx.tap(); setPanel(panel === 'solo' ? null : 'solo'); }}>
          <span className="ic">🤖</span> Play vs Bots
        </button>
        {panel === 'solo' && (
          <div className="card drawer col">
            <div className="seg">
              {[1, 2, 3].map((n) => (
                <button key={n} className={bots === n ? 'on' : ''} onClick={() => { sfx.tap(); setBots(n); }}>{n} bot{n > 1 ? 's' : ''}</button>
              ))}
            </div>
            <ModePicker mode={mode} onMode={setMode} />
            <button className="btn primary" onClick={() => go({ kind: 'solo', bots, mode })}>Start</button>
          </div>
        )}
      </section>

      {install && <button className="btn ghost install" onClick={install}>⬇ Install app</button>}
      <footer className="foot">Free · No sign-up · Works offline vs bots</footer>
    </div>
  );
}

export function ModePicker({ mode, onMode, disabled }: { mode: Mode; onMode(m: Mode): void; disabled?: boolean }) {
  return (
    <div className="modes">
      <button disabled={disabled} className={`mode ${mode === 'classic' ? 'on' : ''}`} onClick={() => { sfx.tap(); onMode('classic'); }}>
        <b>Classic</b><small>4 tokens · full race</small>
      </button>
      <button disabled={disabled} className={`mode ${mode === 'quick' ? 'on' : ''}`} onClick={() => { sfx.tap(); onMode('quick'); }}>
        <b>⚡ Quick</b><small>2 tokens · ~5 min</small>
      </button>
    </div>
  );
}

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <i className="blob b1" /><i className="blob b2" /><i className="blob b3" /><i className="blob b4" />
      <div className="grid-floor" />
    </div>
  );
}

interface BIPEvent extends Event { prompt(): Promise<void> }

function useInstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return evt ? () => { evt.prompt(); setEvt(null); } : null;
}
