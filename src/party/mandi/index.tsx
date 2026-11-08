import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../game/sound';
import { GameShell, type GameProps, type ShellConfig } from '../../shared/GameShell';
import { Chips, Clock, Hero } from '../common';
import { CROPS, mwRules, price, worth, type MAction, type MGame } from './rules';

const rs = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
function Spark({ hist, up }: { hist: number[]; up: boolean }) {
  const lo = Math.min(...hist), hi = Math.max(...hist), span = hi - lo || 1;
  const d = hist.map((v, i) => `${i ? 'L' : 'M'}${(i / (hist.length - 1)) * 100} ${24 - ((v - lo) / span) * 22}`).join(' ');
  return <svg viewBox="0 0 100 26" preserveAspectRatio="none"><path d={d} fill="none" stroke={up ? '#00e08a' : '#ff5470'} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>;
}

function MandiBoard(p: GameProps<MGame, MAction>) {
  const { game: g, me, act } = p;
  const [qty, setQty] = useState(5);
  const prevFlash = useRef(g.flash);
  const [flashing, setFlashing] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const f: Record<string, boolean> = {};
    for (const c of CROPS) if ((g.flash[c.k] ?? 0) !== (prevFlash.current[c.k] ?? 0)) f[c.k] = true;
    prevFlash.current = g.flash;
    if (Object.keys(f).length) { setFlashing(f); const t = setTimeout(() => setFlashing({}), 600); return () => clearTimeout(t); }
  }, [g.flash]);
  useEffect(() => { if (g.done) sfx.win(); }, [g.done]);
  const ticks = useRef(g.ticker.length);
  useEffect(() => { if (g.ticker.length !== ticks.current) { ticks.current = g.ticker.length; sfx.pop(); } }, [g.ticker]);
  const mine = g.hold[me] ?? {};
  return (
    <div className="party">
      <Chips p={p} extra={(id) => <b>{rs(worth(g, id))}</b>} />
      <div className="party-row">
        <div className="mw-news" style={{ flex: 1 }}><span key={g.ticker[g.ticker.length - 1]}>{[...g.ticker].reverse().join('   •   ')}</span></div>
        <Clock s={g.clock} of={g.total} />
      </div>
      <div className="party-row" style={{ justifyContent: 'space-between', fontWeight: 900, fontSize: '0.85rem' }}>
        <span>💰 Cash {rs(g.cash[me] ?? 0)}</span>
        <div className="seg">{[1, 5, 10].map((q) => <button key={q} className={qty === q ? 'on' : ''} onClick={() => setQty(q)}>×{q}</button>)}</div>
      </div>
      <div className="mw-list">
        {CROPS.map((c) => {
          const cr = g.crops.find((x) => x.k === c.k)!, prev = cr.hist[cr.hist.length - 6] ?? cr.price, up = cr.price >= prev, pct = ((cr.price - c.base) / c.base) * 100;
          const have = mine[c.k] ?? 0;
          return (
            <div key={c.k} className={`mw-crop ${flashing[c.k] ? 'flash' : ''}`}>
              <span className="e">{c.emoji}</span>
              <div className="mid">
                <b>{c.name} <span className={up ? 'up' : 'down'}>{rs(cr.price)} {up ? '▲' : '▼'}</span><em className={pct >= 0 ? 'up' : 'down'}>{pct >= 0 ? '+' : ''}{pct.toFixed(0)}%</em></b>
                <Spark hist={cr.hist} up={up} />
              </div>
              <div className="acts">
                <button className="buy" disabled={g.done || (g.cash[me] ?? 0) < price(g, c.k)} onClick={() => { sfx.tap(); act({ t: 'trade', k: c.k, n: qty }); }}>Buy</button>
                <button className="sell" disabled={g.done || !have} onClick={() => { sfx.tap(); act({ t: 'trade', k: c.k, n: -qty }); }}>Sell</button>
                <small>You hold {have}</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const cfg: ShellConfig<MGame, MAction> = {
  slug: 'mandiwars', name: 'Mandi Wars', kind: 'Live trading', prefix: 'mandiwars-v1-',
  tagline: 'Prices change every second. Read the rumours, beat the market, out-trade friends.',
  rules: mwRules, Board: MandiBoard,
  hero: <Hero emoji="📈" a="#00a35c" b="#ffd23f"><text x="24" y="34" fontSize="16">🧅</text><text x="64" y="88" fontSize="16">🍅</text></Hero>,
  options: [{ key: 'time', label: 'Market time', initial: '150', choices: [{ value: '90', label: '1½ min' }, { value: '150', label: '2½ min' }, { value: '240', label: '4 min' }] }],
  podiumExtra: (g, pid) => <span>{rs(worth(g, pid))}</span>,
  progress: (g, pid) => ({ stats: { mw_trades: g.trades[pid] ?? 0 } }),
};
export default function MandiApp() { return <GameShell cfg={cfg} />; }
