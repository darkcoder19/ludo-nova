import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { sfx } from '../../game/sound';
import { GameShell, type GameProps, type ShellConfig } from '../../shared/GameShell';
import { Banner, Chips, Clock, Hero } from '../common';
import { bbRules, type BAction, type BGame } from './rules';

function BolBoard(p: GameProps<BGame, BAction>) {
  const { game: g, me, act, room, color, setMood } = p;
  const [text, setText] = useState('');
  const seq = useRef(g.seq);
  const speaking = g.phase === 'clue' ? g.order[g.spoke % g.order.length] : null;
  const isImp = g.imp === me, over = g.round > g.rounds;
  useEffect(() => {
    if (g.seq === seq.current) return; seq.current = g.seq;
    if (g.phase === 'clue') sfx.tap();
    if (g.phase === 'vote') sfx.pop();
    if (g.phase === 'guess' || g.phase === 'reveal') { if (g.caught) { setMood(g.imp, 'sad', 4000); sfx.captured(); } else { setMood(g.imp, 'cool', 4000); sfx.win(); } }
  }, [g.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  const avatar = (id: string) => room.players.find((s) => s.id === id)?.avatar ?? 'c0';
  const reveal = g.phase === 'guess' || g.phase === 'reveal';
  const tally: Record<string, number> = {};
  for (const v of Object.values(g.votes)) tally[v] = (tally[v] ?? 0) + 1;
  return (
    <div className="party">
      <Chips p={p} active={(id) => id === speaking} extra={(id) => <b>{g.score[id]} pts</b>} />
      {!over && (reveal ? (
        <div className="bb-word imp"><small>The bahurupiya was {g.names[g.imp]} · the word was</small><b>{g.word}</b></div>
      ) : isImp ? (
        <div className="bb-word imp"><small>🎭 You are the bahurupiya! Blend in. Category:</small><b>{g.cat}</b></div>
      ) : (
        <div className="bb-word"><small>Round {g.round}/{g.rounds} · {g.cat} · your secret word</small><b>{g.word}</b></div>
      ))}
      <div className="bb-clues">
        {g.order.map((id) => {
          const mineClues = g.clues.filter((c) => c.pid === id).map((c) => c.text);
          const voting = g.phase === 'vote' && id !== me;
          return (
            <div key={id} className={`bb-clue ${voting ? 'vote' : ''} ${g.votes[me] === id ? 'picked' : ''} ${reveal && id === g.imp ? 'sus' : ''}`} style={{ ['--c' as string]: color(id) }}
              onClick={voting ? () => { sfx.tap(); act({ t: 'vote', who: id }); } : undefined}>
              <div className="pav"><Avatar id={avatar(id)} size={28} /></div>
              <span><small>{g.names[id]}{id === speaking ? ' · speaking…' : ''}</small><b>{mineClues.join(' · ') || '…'}</b></span>
              {(g.phase === 'vote' || reveal) && tally[id] ? <span className="bb-votes">🗳️{tally[id]}</span> : null}
            </div>
          );
        })}
      </div>
      <div className="party-dock">
        {over ? <Banner tone="good">Game over!</Banner>
          : g.phase === 'clue' && speaking === me ? (
            <form className="party-row" onSubmit={(e) => { e.preventDefault(); act({ t: 'clue', text }); setText(''); }}>
              <input className="p-input" value={text} maxLength={20} autoFocus placeholder={isImp ? 'Bluff a clue…' : 'One-word clue (not the word!)'} onChange={(e) => setText(e.target.value)} />
              <button className="btn primary" disabled={!text.trim() || text.trim().toLowerCase() === g.word.toLowerCase()}>Say</button>
            </form>
          ) : g.phase === 'vote' ? (
            <div className="party-row"><Banner>{g.votes[me] ? `You voted ${g.names[g.votes[me]]}. Change anytime.` : 'Tap the player you think is faking'}</Banner><Clock s={g.clock} of={25} /></div>
          ) : g.phase === 'guess' && g.imp === me ? (
            <div className="p-pick" style={{ ['--n' as string]: 2 }}>{g.options.map((w) => <button key={w} onClick={() => act({ t: 'guess', word: w })}><span className="e">🤔</span>{w}</button>)}</div>
          ) : <Banner tone={reveal ? (g.caught ? 'good' : 'bad') : 'info'}>{reveal || g.phase === 'guess' ? g.note : `${g.names[speaking!]} is thinking of a clue…`}</Banner>}
      </div>
    </div>
  );
}

const cfg: ShellConfig<BGame, BAction> = {
  slug: 'bolbachchan', name: 'Bol Bachchan', kind: 'Spot the faker', prefix: 'bolbachchan-v1-',
  tagline: 'One secret word. One faker. Give a clue, then vote out the bahurupiya.',
  rules: bbRules, Board: BolBoard,
  hero: <Hero emoji="🎭" a="#7d5cff" b="#ff4fd8" />,
  options: [{ key: 'rounds', label: 'Rounds', initial: '3', choices: [{ value: '3', label: '3 rounds' }, { value: '5', label: '5 rounds' }] }],
  progress: (g, pid) => ({ stats: { bb_catches: g.catches[pid] ?? 0 } }),
};
export default function BolApp() { return <GameShell cfg={cfg} />; }
