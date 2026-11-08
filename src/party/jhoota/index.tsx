import { useEffect, useRef, useState } from 'react';
import { buzz, sfx } from '../../game/sound';
import { GameShell, type GameProps, type ShellConfig } from '../../shared/GameShell';
import { Banner, Chips, Clock, Hero } from '../common';
import { jsRules, RANKS, rankOf, type JAction, type JGame } from './rules';

const ORDER = Object.fromEntries(RANKS.map((r, i) => [r, i]));
function Card({ c, on, mini, onClick }: { c: string; on?: boolean; mini?: boolean; onClick?(): void }) {
  const s = c.slice(-1), red = s === '♥' || s === '♦';
  return <button className={`js-card ${red ? 'red' : ''} ${on ? 'on' : ''} ${mini ? 'mini' : ''}`} onClick={onClick} disabled={!onClick && !mini}><span className="r">{rankOf(c)}</span><span className="s">{s}</span></button>;
}

function JhootaBoard(p: GameProps<JGame, JAction>) {
  const { game: g, me, act, setMood } = p;
  const [sel, setSel] = useState<string[]>([]);
  const cur = g.order[g.turn], mine = g.phase === 'play' && cur === me && !g.winner;
  const hand = [...(g.hands[me] ?? [])].sort((a, b) => ORDER[rankOf(a)] - ORDER[rankOf(b)]);
  const seq = useRef(g.seq);
  useEffect(() => { setSel((s) => s.filter((c) => hand.includes(c))); }, [g.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (g.seq === seq.current) return; seq.current = g.seq;
    if (g.phase === 'call') sfx.pop();
    if (g.phase === 'reveal' && g.reveal) {
      if (g.reveal.liar) { sfx.captured(); setMood(g.reveal.loser, 'sad', 3000); setMood(g.reveal.caller, 'cool', 3000); } else { sfx.captured(); setMood(g.reveal.caller, 'sad', 3000); }
      if (g.reveal.loser === me) buzz([60, 40, 120]);
    }
    if (g.winner) sfx.win();
  }, [g.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  const canCall = g.phase === 'call' && g.last && g.last.pid !== me;
  return (
    <div className="party">
      <Chips p={p} active={(id) => id === cur && g.phase === 'play'} extra={(id) => (<><span className="js-backs">{Array.from({ length: Math.min(12, g.hands[id].length) }, (_, i) => <i key={i} />)}</span><b>{g.hands[id].length}</b></>)} />
      <div className="js-table">
        <div className="js-claim">Now playing: <em>{RANKS[g.phase === 'play' ? g.claim : g.last?.claim ?? g.claim]}s</em></div>
        <div className="js-pile">{g.pile.slice(-5).map((_, i) => <i key={i} style={{ transform: `rotate(${(i * 37) % 24 - 12}deg) translate(${i * 2}px, ${-i * 2}px)` }} />)}<b>{g.pile.length}</b></div>
        {g.phase === 'reveal' && g.reveal && <div className="js-reveal">{g.reveal.cards.map((c) => <Card key={c} c={c} mini />)}</div>}
        <div className="js-claim" style={{ fontSize: '0.85rem' }}>{g.note}</div>
        {g.phase === 'call' && <Clock s={g.clock} of={5} />}
      </div>
      {g.winner ? <Banner tone={g.winner === me ? 'good' : 'bad'}>{g.winner === me ? 'You win! 🏆' : `${g.names[g.winner]} wins!`}</Banner>
        : canCall ? <button className="btn primary big js-call" onClick={() => { act({ t: 'call' }); buzz(40); }}>🗣️ JHOOTH! ({g.last!.cards.length} × {RANKS[g.last!.claim]}?)</button>
        : mine ? (
          <div className="party-row">
            <button className="btn primary" disabled={sel.length < 1 || sel.length > 4} onClick={() => { act({ t: 'play', cards: sel }); setSel([]); }}>
              {sel.length ? `Play ${sel.length} as "${RANKS[g.claim]}"` : `Pick 1–4 cards to call "${RANKS[g.claim]}"`}
            </button>
          </div>
        ) : <Banner>{g.phase === 'play' ? `${g.names[cur]} is choosing cards…` : g.phase === 'call' ? 'Waiting for a call…' : 'Revealing…'}</Banner>}
      <div className="js-hand">
        {hand.map((c) => <Card key={c} c={c} on={sel.includes(c)} onClick={mine ? () => { sfx.tap(); setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : s.length < 4 ? [...s, c] : s)); } : undefined} />)}
      </div>
    </div>
  );
}

const cfg: ShellConfig<JGame, JAction> = {
  slug: 'jhootaseth', name: 'Jhoota Seth', kind: 'Bluff cards', prefix: 'jhootaseth-v1-',
  tagline: 'Play face down, claim anything, shout JHOOTH! Empty your hand first.',
  rules: jsRules, Board: JhootaBoard,
  hero: <Hero emoji="🃏" a="#b3122f" b="#ff8c42" />,
  progress: (g, pid) => ({ stats: { js_caught: g.caught[pid] ?? 0 } }),
  summary: (g, name) => <p className="dim">Bluffs: {g.order.map((id) => `${name(id)} ${g.bluffs[id]}`).join(' · ')}</p>,
};
export default function JhootaApp() { return <GameShell cfg={cfg} />; }
