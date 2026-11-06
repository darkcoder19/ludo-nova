import { GameShell, type ShellConfig } from '../shared/GameShell';
import { DhandhaBoard } from './DhandhaBoard';
import { DhandhaGuide } from './Guide';
import { BOARD, CASH_CHOICES, START_CASH, fmt } from './data';
import { SethJi } from './Monument';
import { dhandhaRules, fullSets, netWorth, type DAction, type DGame } from './rules';
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

/** End-of-game awards are kept as profile badges. */
const AWARD_BADGE: Record<string, string> = { '👑 Rent Lord': 'rent_lord', '📸 Real-Estate Influencer': 'influencer', '🏗️ Builder Bro': 'builder', '☕ Tapri Regular': 'tapri', '🔥 Comeback Kid': 'comeback' };

const cfg: ShellConfig<DGame, DAction> = {
  slug: 'dhandhaking', name: 'DhandhaKing', kind: 'Property tycoon', prefix: 'dhandhaking-v1-',
  tagline: 'Buy cities, spin the Tapri wheel, outbid your friends — Seth-ji is watching.',
  rules: dhandhaRules, hero: <DhandhaHero />, Board: DhandhaBoard, Guide: DhandhaGuide,
  progress: (g, pid) => ({
    stats: {
      dk_rent: g.stats.rent[pid] ?? 0, dk_hotel: BOARD.some((_, i) => g.owner[i] === pid && g.build[i] >= 4) ? 1 : 0, dk_sets: fullSets(g, pid),
      dk_deals: g.stats.x?.deals?.[pid] ?? 0, dk_bolees: g.stats.x?.bolees?.[pid] ?? 0, dk_seth: g.stats.x?.seth?.[pid] ?? 0,
    },
    badges: awards(g)[pid].map((a) => AWARD_BADGE[a]).filter(Boolean),
  }),
  podiumExtra: (g, id) => (
    <>
      <span>💰 {fmt(netWorth(g, id))} · 🏙️ {BOARD.filter((_, i) => g.owner[i] === id).length}{g.mode === 'sets' ? ` · 🏆 ${fullSets(g, id)} sets` : ''} · 🏠 {g.stats.built[id] ?? 0} · 📥 {fmt(g.stats.rent[id] ?? 0)}</span>
      {awards(g)[id].map((a) => <i key={a} className="award">{a}</i>)}
    </>
  ),
  options: [{ key: 'rounds', label: '⏳ Game length', choices: [
    { value: 'quick', label: '⚡ 15 rounds', hint: 'Richest wins · ~25 min' },
    { value: 'classic', label: '👑 Classic', hint: 'Last one standing · no round limit' },
    { value: 'sets', label: '🏆 Teen Set', hint: 'First to own 3 full colour sets wins' },
  ] }, {
    key: 'cash', label: '💰 Starting money', initial: String(START_CASH),
    choices: CASH_CHOICES.map((c) => ({ value: String(c), label: `₹${c / 1000}k` })),
  }],
};

export default function DhandhaApp() { return <GameShell cfg={cfg} />; }
