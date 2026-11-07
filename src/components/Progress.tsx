// Daily quests, streak, badges/titles and dice skins (the "come back tomorrow" layer), plus Hinglish quick-chat.
import { useEffect, useRef, useState } from 'react';
import { levelFloor, levelOf, type Profile } from '../game/profile';
import {
  BADGES, CHEST_XP, GAME_NAME, SKINS, dailyOf, questStreak, questsFor, skinClass, skinUnlocked, titleText, type Progress,
} from '../game/progress';
import { sfx } from '../game/sound';
import { festivalOn } from '../game/festivals';
import { Avatar } from './Avatar';
import './progress.css';

const PIP5 = [0, 2, 4, 6, 8];
/** A small still die face in a skin, for previews. */
export function DieFace({ skin }: { skin: string }) {
  return <span className={`die-prev ${skinClass(skin)}`}><span className="face prev">{Array.from({ length: 9 }, (_, i) => <i key={i} className={PIP5.includes(i) ? 'pip' : ''} />)}</span></span>;
}

/** "🔥 3 · 🎯 1/3 · Lv 4": opens the progress panel. */
export function DailyChip({ profile, onOpen }: { profile: Profile; onOpen(): void }) {
  const d = dailyOf(profile), streak = questStreak(profile);
  const left = 3 - d.done.length;
  return (
    <button className={`daily-chip ${left ? 'todo' : 'done'}`} onClick={() => { sfx.tap(); onOpen(); }} aria-label="Daily quests, badges and dice skins">
      {festivalOn() && <span className="fest" title={festivalOn()!.name}>{festivalOn()!.emoji}</span>}
      <span className="fire">🔥{streak}</span>
      <span>🎯 {d.done.length}/3</span>
      <span>Lv {levelOf(profile.xp)}</span>
      {left > 0 && <i className="dot" />}
    </button>
  );
}

const untilMidnight = () => {
  const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((m.getTime() - n.getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export function ProgressPanel({ profile, onProfile, onClose, start = 'today' }: { profile: Profile; onProfile(p: Profile): void; onClose(): void; start?: 'today' | 'badges' | 'dice' | 'rivals' }) {
  const [tab, setTab] = useState(start);
  const d = dailyOf(profile), quests = questsFor(d.day), streak = questStreak(profile);
  const lvl = levelOf(profile.xp), lo = levelFloor(lvl), hi = levelFloor(lvl + 1);
  const owned = profile.badges ?? {};
  return (
    <div className="overlay prog-ov" onClick={onClose}>
      <div className="card prog" onClick={(e) => e.stopPropagation()}>
        <div className="prog-head">
          <div className="lv"><b>Lv {lvl}</b><span className="bar"><i style={{ width: `${Math.round(((profile.xp - lo) / (hi - lo)) * 100)}%` }} /></span><small>{profile.xp - lo}/{hi - lo} XP</small></div>
          <button className="btn ghost xs" onClick={onClose}>✕</button>
        </div>
        <div className="seg prog-tabs">
          <button className={tab === 'today' ? 'on' : ''} onClick={() => setTab('today')}>🎯 Today</button>
          <button className={tab === 'badges' ? 'on' : ''} onClick={() => setTab('badges')}>🏅 Badges</button>
          <button className={tab === 'dice' ? 'on' : ''} onClick={() => setTab('dice')}>🎲 Dice</button>
          <button className={tab === 'rivals' ? 'on' : ''} onClick={() => setTab('rivals')}>⚔️ Rivals</button>
        </div>
        {tab === 'today' && (
          <div className="prog-body">
            {festivalOn() && (() => { const f = festivalOn()!; return <div className="fest-row" style={{ ['--fa' as string]: f.colors[0], ['--fb' as string]: f.colors[1] }}><span>{f.emoji}</span><div><b>{f.name} is on!</b><small>2× quest XP{f.skin ? ` · free ${f.skin === 'diya' ? 'Diya' : 'Holi'} dice skin, yours to keep` : ''} · festive DhandhaKing board: {f.perkText}</small></div></div>; })()}
            <div className="streak-row">
              <span className="big-fire">🔥</span>
              <div><b>{streak} day{streak === 1 ? '' : 's'} streak</b><small>Do one quest a day to keep it going · best {profile.qBest ?? 0}</small></div>
            </div>
            <ul className="quests">
              {quests.map((q) => {
                const done = d.done.includes(q.id), v = Math.min(q.target, d.progress[q.id] ?? 0);
                const show = (n: number) => (q.stat === 'dk_rent' ? `₹${n.toLocaleString('en-IN')}` : String(n));
                return (
                  <li key={q.id} className={done ? 'done' : ''}>
                    <span className="q-game">{GAME_NAME[q.game]}</span>
                    <b>{q.text}</b>
                    <span className="q-bar"><i style={{ width: `${(v / q.target) * 100}%` }} /></span>
                    <small>{done ? '✓ Done' : `${show(v)} / ${show(q.target)}`} · +{q.xp} XP</small>
                  </li>
                );
              })}
            </ul>
            <div className={`chest ${d.chest ? 'open' : ''}`}><span>{d.chest ? '🎉' : '🎁'}</span><div><b>{d.chest ? 'Chest opened!' : 'Finish all 3'}</b><small>{d.chest ? `+${CHEST_XP} XP collected today` : `Bonus chest: +${CHEST_XP} XP`}</small></div></div>
            <small className="dim center">New quests in {untilMidnight()} · same quests for everyone today</small>
          </div>
        )}
        {tab === 'badges' && (
          <div className="prog-body">
            <small className="dim">Tap a badge you've earned to wear it as your title. Everyone in the room sees it under your name.</small>
            <div className="badge-grid">
              {BADGES.map((b) => {
                const n = owned[b.id] ?? 0, wearing = profile.title === b.id;
                return (
                  <button key={b.id} className={`badge ${n ? 'got' : 'locked'} ${wearing ? 'wearing' : ''}`} disabled={!n}
                    onClick={() => { sfx.pop(); onProfile({ ...profile, title: wearing ? undefined : b.id }); }} title={b.how}>
                    <span className="em">{b.emoji}{!n && <i className="lock">🔒</i>}</span><b>{b.name}</b><small>{n ? (wearing ? 'Wearing ✓' : n > 1 ? `×${n}` : 'Earned') : b.how}</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {tab === 'rivals' && (
          <div className="prog-body">
            <small className="dim">Your head-to-head record with friends you've played in rooms, across all Sarvimo games. Whoever finishes higher gets the win.</small>
            {Object.keys(profile.rivals ?? {}).length ? (
              <ul className="rivals">
                {Object.entries(profile.rivals ?? {}).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).slice(0, 30).map(([id, r]) => (
                  <li key={id}>
                    <Avatar id={r.avatar} size={36} />
                    <div><b>{r.name}</b><small>{r.w + r.l} games · last {r.last}</small></div>
                    <span className={`score ${r.w > r.l ? 'lead' : r.w < r.l ? 'trail' : ''}`}>{r.w}–{r.l}</span>
                  </li>
                ))}
              </ul>
            ) : <small className="dim center">Play a room game with friends to start a rivalry ⚔️</small>}
          </div>
        )}
        {tab === 'dice' && (
          <div className="prog-body">
            <small className="dim">Your dice skin shows to everyone when you roll. New skins unlock as you level up.</small>
            <div className="skin-grid">
              {SKINS.map((s) => {
                const ok = skinUnlocked(profile, s.id), on = (profile.skin ?? 'classic') === s.id;
                return (
                  <button key={s.id} className={`skin ${on ? 'on' : ''} ${ok ? '' : 'locked'}`} disabled={!ok} onClick={() => { sfx.pop(); onProfile({ ...profile, skin: s.id }); }}>
                    <DieFace skin={s.id} /><b>{s.name}</b><small>{ok ? (on ? 'Using ✓' : profile.collected?.includes(s.id) || s.level <= levelOf(profile.xp) ? 'Tap to use' : `Free during ${s.fest}`) : s.fest && s.level > 50 ? `🎉 Play during ${s.fest}` : `🔒 Level ${s.level}`}</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** What this game did for your quests and badges, shown on the results screen. */
export function ResultExtras({ p }: { p: Progress | null }) {
  if (!p || (!p.quests.length && !p.badges.length && !p.chest && !p.rivals?.length)) return null;
  return (
    <div className="res-extras">
      {p.quests.map((q) => <span key={q.id} className="rx quest">🎯 Quest done: {q.text} <b>+{q.xp} XP</b></span>)}
      {p.chest && <span className="rx chest">🎁 All 3 quests! <b>+{CHEST_XP} XP</b></span>}
      {p.badges.map((b) => <span key={b.id} className="rx badge">{b.emoji} New badge: <b>{b.name}</b></span>)}
      {p.rivals?.map((r) => <span key={r.id} className="rx rival">⚔️ {r.won ? `You beat ${r.name}` : `${r.name} beat you`} · {r.w > r.l ? 'you lead' : r.w < r.l ? 'they lead' : 'level at'} <b>{r.w}–{r.l}</b></span>)}
    </div>
  );
}

/** Your head-to-head record with this player, for lobby seats. */
export function RivalTag({ profile, id }: { profile: Profile; id: string }) {
  const r = profile.rivals?.[id];
  if (!r) return <small className="rival-tag">⚔️ First game together</small>;
  return <small className={`rival-tag ${r.w > r.l ? 'lead' : r.w < r.l ? 'trail' : ''}`}>⚔️ You {r.w}–{r.l}</small>;
}

/** A small title line under a player's name. */
export const TitleTag = ({ id }: { id?: string }) => (id && titleText(id) ? <small className="title-tag">{titleText(id)}</small> : null);

// ---------------- quick chat ----------------
export const QUICK_LINES = [
  'Bhai rent nikaal 💸', 'Deal pakki? 🤝', 'Sorry not sorry 😏', 'Kya scene hai? 👀', 'GG, well played 🙌', 'Abhi toh party shuru hui hai 🎉',
  'Ek chance de do 🙏', 'Kismat ka khel 🎲', 'Ruk ja, aata hoon 😤', 'Bas kar pagle 😂', 'Paisa hi paisa 🤑', 'Jaldi chalo yaar ⏳',
];
export const chatIndex = (msg: string) => (msg?.startsWith('q:') ? Number(msg.slice(2)) : -1);

export function ChatPicker({ onPick, onClose }: { onPick(msg: string): void; onClose(): void }) {
  return (
    <div className="overlay chat-ov" onClick={onClose}>
      <div className="card chat-pick" onClick={(e) => e.stopPropagation()}>
        <div className="row-between"><b>💬 Quick chat</b><button className="btn ghost xs" onClick={onClose}>✕</button></div>
        <div className="chat-grid">{QUICK_LINES.map((l, i) => <button key={i} onClick={() => { sfx.tap(); onPick(`q:${i}`); }}>{l}</button>)}</div>
      </div>
    </div>
  );
}

interface Bubble { id: number; from: string; text: string }
/** Quick-chat lines float in at the top for a few seconds, with the sender's face. */
export function ChatBubbles({ emotes, players, me, color }: { emotes: { from: string; emoji: string; id: number }[]; players: { id: string; name: string; avatar: string }[]; me: string; color(id: string): string }) {
  const [list, setList] = useState<Bubble[]>([]);
  const seen = useRef(new Set<number>(emotes.map((e) => e.id)));
  useEffect(() => {
    for (const e of emotes) {
      if (seen.current.has(e.id)) continue;
      seen.current.add(e.id);
      const i = chatIndex(e.emoji);
      if (!(i >= 0 && i < QUICK_LINES.length)) continue;
      const b = { id: e.id, from: e.from, text: QUICK_LINES[i] };
      setList((l) => [...l.slice(-2), b]);
      sfx.pop();
      setTimeout(() => setList((l) => l.filter((x) => x.id !== b.id)), 3400);
    }
  }, [emotes]);
  if (!list.length) return null;
  return (
    <div className="chat-bubbles">
      {list.map((b) => {
        const p = players.find((x) => x.id === b.from);
        return p ? <div key={b.id} className={`chat-b ${b.from === me ? 'me' : ''}`} style={{ ['--c' as string]: color(b.from) }}><Avatar id={p.avatar} size={26} /><b>{b.from === me ? 'You' : p.name}</b><span>{b.text}</span></div> : null;
      })}
    </div>
  );
}
