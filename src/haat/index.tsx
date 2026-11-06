import { GameShell, type ShellConfig } from '../shared/GameShell';
import { BuildingArt, PlotArt } from './Art';
import { HaatBoard } from './HaatBoard';
import { HaatGuide } from './Guide';
import { LEVEL_NAME } from './data';
import { haatRules, izzat, type HAction, type HGame } from './rules';
import './haat.css';

export function HaatHero() {
  return (
    <div className="hh-hero">
      {(['cotton', 'tea', 'spice', 'rice', 'mandi', 'brick', 'tea', 'cotton', 'rice'] as const).map((t, k) => (
        <div key={k} className="cell" style={{ animationDelay: `${k * 90}ms` }}>
          <PlotArt t={t} />
          {[1, 3, 5, 7].includes(k) && <BuildingArt level={k === 3 ? 3 : k === 7 ? 2 : 1} color={['#ff2e88', '#7a5cff', '#12d6b4', '#ffab1a'][k % 4]} />}
        </div>
      ))}
    </div>
  );
}

const cfg: ShellConfig<HGame, HAction> = {
  slug: 'haathustle', name: 'Haat Hustle', kind: 'Trade & build', prefix: 'haathustle-v1-',
  tagline: 'Grow crops, play the mandi, build havelis. First to rule the haat wins.',
  rules: haatRules, hero: <HaatHero />, Board: HaatBoard, Guide: HaatGuide,
  options: [{
    key: 'target', label: '⭐ Izzat to win', initial: '12',
    choices: [{ value: '10', label: '10 ⭐' }, { value: '12', label: '12 ⭐' }, { value: '15', label: '15 ⭐' }],
  }],
  progress: (g, pid) => ({ stats: { hh_haveli: g.plots.filter((p) => p.owner === pid && p.level === 3).length } }),
  podiumExtra: (g, id) => {
    const built = [1, 2, 3].map((lv) => g.plots.filter((p) => p.owner === id && p.level === lv).length);
    return <span>⭐ {izzat(g, id)} · ₹{g.cash[id]} · {built.map((n, i) => (n ? `${n} ${LEVEL_NAME[i + 1].toLowerCase()}${n > 1 ? 's' : ''}` : '')).filter(Boolean).join(', ') || 'no stalls'} · 📦 {g.filled[id] ?? 0}</span>;
  },
};

export default function HaatApp() { return <GameShell cfg={cfg} />; }
