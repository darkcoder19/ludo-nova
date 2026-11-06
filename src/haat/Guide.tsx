import { useEffect, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { BuildingArt, GoodIcon, PlotArt } from './Art';
import { BUY_SPREAD, COSTS, GOOD_INFO, GOODS, LEVEL_IZZAT, LEVEL_NAME, LEVEL_YIELD, MONSOON, ORDERS, START_CASH, type Good } from './data';

const STEPS = [
  { t: 'Pick two plots', d: 'Everyone places two free stalls on the village map, in snake order. Your second stall also gives you one of its goods to start.', scene: 'setup' },
  { t: 'Call the monsoon 🌧️', d: 'Start your turn by drawing a monsoon card. It names the crops in season, and every stall on those plots yields goods to its owner, on everyone’s turn.', scene: 'monsoon' },
  { t: 'Grow your bazaar', d: 'Build a new stall on a free plot touching one of yours, or touching the Mandi. A stall costs 1 brick, 1 rice, 1 cotton and ₹20, and is worth 1 Izzat ⭐.', scene: 'build' },
  { t: 'Stall → Godown → Haveli', d: 'Upgrade your stalls. A godown doubles the plot’s harvest; a haveli is worth 4 Izzat. Plan which crops to upgrade.', scene: 'upgrade' },
  { t: 'Play the mandi ⚖️', d: 'Sell spare goods for cash, or buy what you are missing. Every sale drops that price, every purchase pushes it up. Sell before others flood the market!', scene: 'mandi' },
  { t: 'Deliver orders 📦', d: 'Three public orders, like a shaadi caterer or an export ship, pay Izzat and cash for the right goods. First to deliver takes it.', scene: 'orders' },
  { t: 'Make deals 🤝', d: 'Offer any player a swap of goods. They accept or refuse. Good deals win games.', scene: 'trade' },
  { t: 'Rule the Haat 👑', d: 'Stalls, godowns, havelis and orders all earn Izzat. The first to reach the target (12 by default) wins on the spot.', scene: 'win' },
];

const MiniPlot = ({ t, level = 0, color = '#ff2e88', className = '' }: { t: Good | 'mandi'; level?: number; color?: string; className?: string }) => (
  <div className={`gs-plot ${className}`}><PlotArt t={t} />{level > 0 && <BuildingArt level={level} color={color} />}</div>
);

function Scene({ kind }: { kind: string }) {
  switch (kind) {
    case 'setup': return (
      <div className="gs gs-hh-grid">
        {(['cotton', 'rice', 'tea', 'brick', 'mandi', 'spice', 'rice', 'cotton'] as const).map((t, k) => (
          <MiniPlot key={k} t={t} level={k === 1 || k === 6 ? 1 : 0} color={k === 1 ? '#ff2e88' : '#7a5cff'} className={k === 1 || k === 6 ? 'pop' : ''} />
        ))}
      </div>
    );
    case 'monsoon': return (
      <div className="gs gs-hh-monsoon">
        <div className="hh-card mini"><small>🌧️ MONSOON</small><b>Monsoon</b><div className="goods"><GoodIcon g="cotton" size={30} /><GoodIcon g="tea" size={30} /></div></div>
        <div className="row"><MiniPlot t="cotton" level={1} className="rain" /><MiniPlot t="tea" level={2} className="rain" /><MiniPlot t="brick" level={1} /></div>
        <i className="drop d1" /><i className="drop d2" /><i className="drop d3" />
      </div>
    );
    case 'build': return (
      <div className="gs gs-hh-build">
        <MiniPlot t="rice" level={1} />
        <span className="plus">+</span>
        <div className="cost"><GoodIcon g="brick" size={24} /><GoodIcon g="rice" size={24} /><GoodIcon g="cotton" size={24} /><b>₹20</b></div>
        <span className="plus">=</span>
        <MiniPlot t="spice" level={1} className="pop" />
      </div>
    );
    case 'upgrade': return (
      <div className="gs gs-hh-upgrade">
        {[1, 2, 3].map((lv) => <div key={lv} className={`stage s${lv}`}><MiniPlot t="tea" level={lv} /><small>{LEVEL_NAME[lv]} · {LEVEL_IZZAT[lv]}⭐</small></div>)}
      </div>
    );
    case 'mandi': return (
      <div className="gs gs-hh-mandi">
        {GOODS.map((k, i) => <div key={k} className="bar" style={{ ['--h' as string]: `${[60, 30, 45, 75, 50][i]}%`, ['--d' as string]: `${i * 0.2}s` }}><i /><GoodIcon g={k} size={22} /></div>)}
      </div>
    );
    case 'orders': return (
      <div className="gs gs-hh-orders">
        <div className="hh-order ready"><div><b>Shaadi ka Khana</b><span className="reward">+2 ⭐ · +₹40</span></div><span className="hh-cost"><span><GoodIcon g="rice" size={18} />2</span><span><GoodIcon g="spice" size={18} />2</span></span></div>
        <b className="star">+2 ⭐</b>
      </div>
    );
    case 'trade': return (
      <div className="gs gs-hh-trade">
        <Avatar id="c3" size={64} hyped /><span className="swap a"><GoodIcon g="tea" size={30} /></span><span className="swap b"><GoodIcon g="brick" size={30} /></span><Avatar id="c8" size={64} hyped />
      </div>
    );
    default: return <div className="gs gs-win"><b>👑</b><span>Haat ka Raja</span></div>;
  }
}

export function HaatGuide({ onClose, start = 'video' }: { onClose(): void; start?: 'video' | 'rules' }) {
  const [tab, setTab] = useState<'video' | 'rules'>(start);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (tab !== 'video' || !playing) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 5200);
    return () => clearTimeout(t);
  }, [tab, step, playing]);
  const count = (k: string) => MONSOON.filter((m) => m.kind === k).length;
  return (
    <div className="guide-ov" onClick={onClose}>
      <div className="guide hh-guide" onClick={(e) => e.stopPropagation()}>
        <div className="guide-head">
          <div className="seg"><button className={tab === 'video' ? 'on' : ''} onClick={() => setTab('video')}>▶ How to play</button><button className={tab === 'rules' ? 'on' : ''} onClick={() => setTab('rules')}>📖 Rule book</button></div>
          <button className="btn ghost xs" onClick={onClose}>✕</button>
        </div>
        {tab === 'video' ? (
          <div className="howto">
            <div className="howto-screen" key={step}>
              <Scene kind={STEPS[step].scene} />
              <div className="howto-cap"><small>Step {step + 1} of {STEPS.length}</small><b>{STEPS[step].t}</b><p>{STEPS[step].d}</p></div>
            </div>
            <div className="howto-bar">{STEPS.map((_, k) => <i key={k} className={k < step ? 'done' : k === step ? `now ${playing ? 'run' : ''}` : ''} onClick={() => setStep(k)} />)}</div>
            <div className="row">
              <button className="btn glass sm" onClick={() => setStep((s) => (s + STEPS.length - 1) % STEPS.length)}>⏮</button>
              <button className="btn primary sm" onClick={() => setPlaying(!playing)}>{playing ? '⏸ Pause' : '▶ Play'}</button>
              <button className="btn glass sm" onClick={() => setStep((s) => (s + 1) % STEPS.length)}>⏭</button>
            </div>
          </div>
        ) : (
          <div className="rules">
            <h3>🎯 Goal</h3>
            <p>Grow the richest bazaar in the village haat. Stalls, godowns, havelis and delivered orders earn <b>Izzat ⭐</b>. The first player to reach the target (10, 12 or 15, chosen by the host; 12 by default) wins straight away. Everyone starts with ₹{START_CASH}, 1 brick and 1 rice.</p>

            <h3>🗺️ The map</h3>
            <p>A village of 34 plots around the central <b>Mandi</b>. Each crop plot grows one good:</p>
            <div className="hh-goods-list">{GOODS.map((k) => <span key={k}><GoodIcon g={k} size={20} /> <b>{GOOD_INFO[k].hindi}</b> ({GOOD_INFO[k].name})</span>)}</div>
            <p className="dim">Two plots are banjar (barren): nothing grows and nobody can build there. The map is shuffled every game.</p>

            <h3>🏁 Setup</h3>
            <p>In snake order (1, 2, 3, then 3, 2, 1) each player places two free stalls on any free crop plots. Your second stall also gives you one of its goods.</p>

            <h3>🎲 Your turn</h3>
            <ul>
              <li><b>Call the monsoon:</b> draw a monsoon card. Every stall in the game on a plot of an in-season crop yields goods to its owner (stall 1, godown 2, haveli 2).</li>
              <li><b>Then, in any order and as often as you can afford:</b> build stalls, upgrade, sell or buy at the mandi, deliver orders, and offer deals to other players.</li>
              <li><b>End your turn.</b> The turn timer chosen by the host applies; when it runs out your turn ends.</li>
            </ul>

            <h3>🌧️ Monsoon cards ({MONSOON.length} in the deck)</h3>
            <ul>
              <li><b>Monsoon ({count('season')})</b>: one or two crops are in season.</li>
              <li><b>Bumper ({count('bumper')})</b>: one crop only, but its plots yield double.</li>
              <li><b>Kisan Mela ({count('mela')})</b>: a perfect season: every plot yields.</li>
              <li><b>Sukha / drought ({count('drought')})</b>: nothing grows and every mandi price rises ₹8.</li>
            </ul>
            <p className="dim">When the deck runs out it is reshuffled.</p>

            <h3>🏗️ Building</h3>
            <table className="dice-table">
              <thead><tr><th>Build</th><th>Cost</th><th>Izzat</th><th>Yield</th></tr></thead>
              <tbody>
                {([['Stall', COSTS.stall, 1], ['Godown', COSTS.godown, 2], ['Haveli', COSTS.haveli, 3]] as const).map(([n, c, lv]) => (
                  <tr key={n}><td><b>{n}</b></td><td>{GOODS.filter((k) => c.goods[k]).map((k) => `${c.goods[k]} ${GOOD_INFO[k].hindi}`).join(', ')}, ₹{c.cash}</td><td>{LEVEL_IZZAT[lv]}</td><td>{LEVEL_YIELD[lv]}</td></tr>
                ))}
              </tbody>
            </table>
            <p>A new stall must touch (side by side, not diagonally) one of your plots, or the Mandi. Godowns upgrade a stall; havelis upgrade a godown. The Izzat shown is for the whole plot, not added on top.</p>

            <h3>⚖️ The mandi</h3>
            <ul>
              <li>Each good has a price (it starts at ₹30). <b>Selling</b> pays you that price and drops it ₹4. <b>Buying</b> costs the price + ₹{BUY_SPREAD} and pushes it up ₹8.</li>
              <li>In-season crops get cheaper when they flood the market; droughts make everything dearer.</li>
              <li>After every turn prices drift ₹2 back towards ₹30.</li>
            </ul>

            <h3>📦 Orders</h3>
            <p>Three orders are always open. Deliver the goods shown to earn the Izzat and cash. A new order takes its place.</p>
            <div className="card-list">{ORDERS.map((o) => <div key={o.title} className="parivaar"><b>{o.title}</b><span>{GOODS.filter((k) => o.need[k]).map((k) => `${o.need[k]} ${GOOD_INFO[k].hindi}`).join(', ')} → +{o.izzat} ⭐, +₹{o.cash}</span></div>)}</div>

            <h3>🤝 Deals</h3>
            <p>On your turn, offer any player a swap: up to 5 of each good on each side. They have their turn timer to accept or refuse. Bots accept deals that are fair at mandi prices.</p>

            <h3>👑 Winning</h3>
            <p>Reach the target Izzat on your turn and you win immediately. If nobody has after 30 rounds, the player with the most Izzat wins (ties: most cash).</p>

            <h3>💡 Tips</h3>
            <ul>
              <li>Spread across crops early so every monsoon pays you something.</li>
              <li>Plots touching the Mandi are open to everyone, so grab the good ones fast.</li>
              <li>Sell into high prices, buy before a rival does, and watch which orders your opponents are chasing.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
