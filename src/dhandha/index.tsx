import { GameShell, type ShellConfig } from '../shared/GameShell';
import { DhandhaBoard } from './DhandhaBoard';
import { DhandhaGuide } from './Guide';
import { BOARD, CASH_CHOICES, START_CASH, fmt } from './data';
import { SethJi } from './Monument';
import { festivalOn } from '../game/festivals';
import { THEMES, type ThemeId } from './themes';
import { HOUSE_NAMES, dhandhaRules, fullSets, netWorth, teamWorth, type DAction, type DGame } from './rules';
import './dhandha.css';
import './dhandha2.css';
import './dhandha3.css';
import './dhandha-themes.css';

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
  recap: (g, name) => {
    const lines: { emoji: string; text: string }[] = [];
    const rank = dhandhaRules.ranking(g), r = g.rec ?? {};
    lines.push({ emoji: '👑', text: `${name(rank[0])} is the DhandhaKing · worth ${fmt(netWorth(g, rank[0]))}` });
    if (r.rent) lines.push({ emoji: '💸', text: `Biggest hit: ${name(r.rent.pid)} paid ${name(r.rent.other!)} ${fmt(r.rent.amount)} in ${BOARD[r.rent.sq!].name}` });
    if (r.jackpot) lines.push({ emoji: '☕', text: `${name(r.jackpot.pid)} won ${fmt(r.jackpot.amount)} from the Tapri gullak` });
    if (r.deal) lines.push({ emoji: '🤝', text: `Deal of the game: ${name(r.deal.pid)} ⇄ ${name(r.deal.other!)} with ${fmt(r.deal.amount)} cash` });
    if (r.seth) lines.push({ emoji: '🧔', text: `Seth-ji paid ${name(r.seth.pid)} ${fmt(r.seth.amount)} for ${BOARD[r.seth.sq!].name}` });
    if (r.bet) lines.push({ emoji: '🎲', text: `Luckiest shart: ${name(r.bet.pid)} won ${fmt(r.bet.amount)}` });
    const top = (k: string) => Object.entries(g.stats.x?.[k] ?? {}).sort((a, b) => b[1] - a[1])[0];
    const toll = top('toll'), stake = top('stake'), jail = top('jail');
    if (toll && toll[1] > 0) lines.push({ emoji: '👻', text: `Scariest ghost: ${name(toll[0])} collected ${fmt(toll[1])} in tolls` });
    if (stake && stake[1] > 0) lines.push({ emoji: '📈', text: `Smartest investor: ${name(stake[0])} earned ${fmt(stake[1])} from stakes` });
    if (jail && jail[1] >= 2) lines.push({ emoji: '🚨', text: `Detention regular: ${name(jail[0])}, ${jail[1]} times` });
    return { title: 'DhandhaKing Recap', sub: `${g.order.length} players · ${Math.max(1, g.round - (g.maxRounds && g.round > g.maxRounds ? 1 : 0))} rounds`, lines: lines.slice(0, 7) };
  },
  podiumExtra: (g, id) => (
    <>
      <span>💰 {fmt(netWorth(g, id))} · 🏙️ {BOARD.filter((_, i) => g.owner[i] === id).length}{g.mode === 'sets' ? ` · 🏆 ${fullSets(g, id)} sets` : ''} · 🏠 {g.stats.built[id] ?? 0} · 📥 {fmt(g.stats.rent[id] ?? 0)}</span>
      {g.teams && <i className="award team">👯 Team {g.teams[id] === 0 ? 'A' : 'B'} · {fmt(teamWorth(g, g.teams[id]))}</i>}
      {awards(g)[id].map((a) => <i key={a} className="award">{a}</i>)}
    </>
  ),
  options: [{ key: 'rounds', label: '⏳ Game length', choices: [
    { value: 'quick', label: '⚡ 15 rounds', hint: 'Richest wins · ~25 min' },
    { value: 'classic', label: '👑 Classic', hint: 'Last one standing · no round limit' },
    { value: 'sets', label: '🏆 Teen Set', hint: 'First to own 3 full colour sets wins' },
    { value: 'teams', label: '👯 Roommates 2v2', hint: '4 players · no rent between roommates · richest team wins' },
  ] }, {
    key: 'cash', label: '💰 Starting money', initial: String(START_CASH),
    choices: CASH_CHOICES.map((c) => ({ value: String(c), label: `₹${c / 1000}k` })),
  }, {
    key: 'theme', label: '🎨 Board theme', initial: 'auto',
    choices: [{ value: 'auto', label: festivalOn() ? `Auto ${festivalOn()!.emoji}` : 'Auto' }, { value: 'classic', label: 'Classic' }, ...(Object.keys(THEMES) as ThemeId[]).map((t) => ({ value: t, label: THEMES[t].emoji }))],
  }, {
    key: 'house', label: '🏠 House rules', multi: true, initial: '',
    choices: Object.entries(HOUSE_NAMES).map(([value, label]) => ({ value, label })),
  }],
};

export default function DhandhaApp() { return <GameShell cfg={cfg} />; }
