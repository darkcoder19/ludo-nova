import { GameShell, type ShellConfig } from '../shared/GameShell';
import { DhandhaBoard } from './DhandhaBoard';
import { DhandhaGuide } from './Guide';
import { BOARD, fmt } from './data';
import { SethJi } from './Monument';
import { dhandhaRules, netWorth, type DAction, type DGame } from './rules';
import './dhandha.css';
import './dhandha2.css';
import './dhandha3.css';

export function DhandhaHero() {
  return <SethJi mood="happy" />;
}

/** Fun end-of-game titles, one per stat, for whoever topped it. */
function awards(g: DGame): Record<string, string[]> {
  const out: Record<string, string[]> = Object.fromEntries(g.order.map((id) => [id, []]));
  const top = (rec: Record<string, number>, min = 1) => {
    const best = Math.max(...g.order.map((id) => rec[id] ?? 0));
    return best >= min ? g.order.filter((id) => (rec[id] ?? 0) === best) : [];
  };
  top(g.stats.rent, 500).forEach((id) => out[id].push('👑 Rent Lord'));
  top(g.stats.bought, 3).forEach((id) => out[id].push('📸 Real-Estate Influencer'));
  top(g.stats.built, 2).forEach((id) => out[id].push('🏗️ Builder Bro'));
  top(g.stats.potWins, 1).forEach((id) => out[id].push('☕ Tapri Regular'));
  g.order.filter((id) => !g.out.includes(id) && (g.stats.minCash[id] ?? 15000) < 1500 && netWorth(g, id) > 8000).forEach((id) => out[id].push('🔥 Comeback Kid'));
  return out;
}

const cfg: ShellConfig<DGame, DAction> = {
  slug: 'dhandhaking', name: 'DhandhaKing', kind: 'Property tycoon', prefix: 'dhandhaking-v1-',
  tagline: 'Buy cities, spin the Tapri wheel, outbid your friends — Seth-ji is watching.',
  rules: dhandhaRules, hero: <DhandhaHero />, Board: DhandhaBoard, Guide: DhandhaGuide,
  podiumExtra: (g, id) => (
    <>
      <span>💰 {fmt(netWorth(g, id))} · 🏙️ {BOARD.filter((_, i) => g.owner[i] === id).length} · 🏠 {g.stats.built[id] ?? 0} · 📥 {fmt(g.stats.rent[id] ?? 0)}</span>
      {awards(g)[id].map((a) => <i key={a} className="award">{a}</i>)}
    </>
  ),
  options: [{ key: 'rounds', label: '⏳ Game length', choices: [
    { value: 'quick', label: '⚡ 15 rounds', hint: 'Richest wins · ~25 min' },
    { value: 'classic', label: '👑 Classic', hint: 'Last one standing · no round limit' },
  ] }],
};

export default function DhandhaApp() { return <GameShell cfg={cfg} />; }
