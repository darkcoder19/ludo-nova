import { GameShell, type ShellConfig } from '../shared/GameShell';
import { SeedhiBoard } from './SeedhiBoard';
import { seedhiRules, type SAction, type SGame } from './rules';
import './seedhi.css';

export function SeedhiHero() {
  return (
    <svg viewBox="0 0 100 100" className="hero-svg">
      {Array.from({ length: 25 }, (_, k) => <rect key={k} x={4 + (k % 5) * 18.6} y={4 + Math.floor(k / 5) * 18.6} width="17" height="17" rx="4" fill={['#ffe8a3', '#ffd6e0', '#cdf5e1', '#d6e6ff', '#efe0ff'][(k + Math.floor(k / 5)) % 5]} />)}
      <g className="hero-ladder"><path d="M22 92 L34 14 M36 94 L48 16" stroke="#8b5a2b" strokeWidth="4" strokeLinecap="round" />{[80, 64, 48, 32].map((y) => <path key={y} d={`M${25 + (92 - y) * 0.15} ${y} L${39 + (92 - y) * 0.15} ${y}`} stroke="#a0693a" strokeWidth="3" />)}</g>
      <path className="hero-snake" d="M82 14 C58 30 92 50 68 62 C48 72 76 84 60 94" fill="none" stroke="#00c97a" strokeWidth="9" strokeLinecap="round" />
      <circle cx="82" cy="14" r="8" fill="#00c97a" /><circle cx="85" cy="11" r="2.5" fill="#fff" /><circle cx="86" cy="11" r="1.2" fill="#111" />
    </svg>
  );
}

const cfg: ShellConfig<SGame, SAction> = {
  slug: 'seedhirush', name: 'SeedhiRush', kind: 'Snakes & Ladders', prefix: 'seedhirush-v1-',
  tagline: 'Climb the seedhi, dodge the saanp, first to 100 wins.',
  rules: seedhiRules, hero: <SeedhiHero />, Board: SeedhiBoard,
};

export default function SeedhiApp() { return <GameShell cfg={cfg} />; }
