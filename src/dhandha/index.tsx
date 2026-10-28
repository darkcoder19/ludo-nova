import { GameShell, type ShellConfig } from '../shared/GameShell';
import { DhandhaBoard } from './DhandhaBoard';
import { dhandhaRules, type DAction, type DGame } from './rules';
import './dhandha.css';

export function DhandhaHero() {
  return (
    <svg viewBox="0 0 100 100" className="hero-svg">
      <rect x="6" y="6" width="88" height="88" rx="10" fill="#fff7e6" stroke="#1b1035" strokeWidth="3" />
      {['#ff2d55', '#2b49ff', '#ffd23f', '#00c97a', '#ff8c42', '#5ec8ff'].map((c, k) => <rect key={k} x={8 + k * 14} y="8" width="12" height="8" fill={c} />)}
      <g className="hero-city">
        <rect x="20" y="52" width="14" height="30" fill="#9b6bff" stroke="#1b1035" strokeWidth="2" />
        <rect x="38" y="36" width="18" height="46" fill="#2b49ff" stroke="#1b1035" strokeWidth="2" />
        <rect x="60" y="46" width="16" height="36" fill="#ff8c42" stroke="#1b1035" strokeWidth="2" />
        {[42, 48, 54, 60, 66, 72].map((y) => <rect key={y} x="42" y={y} width="10" height="3" fill="#ffd23f" />)}
      </g>
      <g className="hero-coin"><circle cx="72" cy="28" r="12" fill="#ffd23f" stroke="#b8860b" strokeWidth="3" /><text x="72" y="33" textAnchor="middle" fontSize="14" fontWeight="900" fill="#7a5200">₹</text></g>
    </svg>
  );
}

const cfg: ShellConfig<DGame, DAction> = {
  slug: 'dhandhaking', name: 'DhandhaKing', kind: 'Property tycoon', prefix: 'dhandhaking-v1-',
  tagline: 'Buy Mumbai, build malls, bankrupt your friends.',
  rules: dhandhaRules, hero: <DhandhaHero />, Board: DhandhaBoard,
  options: [{ key: 'rounds', label: '⏳ Game length', choices: [
    { value: 'quick', label: '⚡ 15 rounds', hint: 'Richest wins · ~25 min' },
    { value: 'classic', label: '👑 Classic', hint: 'Last seth standing' },
  ] }],
};

export default function DhandhaApp() { return <GameShell cfg={cfg} />; }
