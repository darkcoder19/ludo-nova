import { useEffect, useState } from 'react';
import { AUCTION_STEP, BAIL, BOARD, CALENDAR, CARDS, CASH_CHOICES, CATCHUP, DEAL_MAX, SEASONS, GIFT_STEP, GROUPS, LOAN, MAX_POWERS, MEHNGAI, SETS_TO_WIN, POWERS, RENT_MULT, SALARY, START_CASH, STREAK_BONUS, WHEEL, fmt, type Power } from './data';
import { ArtDefs, Buildings, SethJi, TilePic } from './Monument';

const STEPS = [
  { t: 'Roll two dice', d: 'Tap Roll and move the total, anywhere from 2 to 12. Roll doubles and you go again. Three doubles in a row? Proxy caught, straight to Detention.', scene: 'dice' },
  { t: 'Buy cities from Seth-ji', d: 'Land on an unowned city, ride or utility and buy it. Your coins fly to Seth-ji, and he slides the city card back to you.', scene: 'buy' },
  { t: 'Pass and it goes to Bolee 🔨', d: 'Don’t want it at full price? It goes to auction: bids start at half price and go up ₹200. With 2–3 players you can bid too. Highest bid takes it.', scene: 'bolee' },
  { t: 'Complete a colour set', d: 'Own every city of one colour and the rent doubles. Seth-ji puts on his shades. Now you can build.', scene: 'set' },
  { t: 'Build houses, a hotel, a villa', d: '3 houses, then a hotel, then a villa. Rent climbs up to 90× the base rent.', scene: 'build' },
  { t: 'Spin the Tapri wheel ☕', d: 'Fees and fines go into the Tapri gullak. Land on Tapri Jackpot and spin: full gullak, half, a power-up, a free house… or Seth-ji keeps it.', scene: 'wheel' },
  { t: 'Play power-ups ⚡', d: 'Rent Shield blocks a rent, Double Dhamaka doubles the next rent you collect, Teleport jumps you to any unowned tile.', scene: 'powers' },
  { t: 'Ride the trends', d: 'A film shoot or festival can make a city trend (rent ×2 or ×3). Bad news makes it slump (rent ×½).', scene: 'event' },
  { t: 'Trade cities & borrow 🤝', d: `On your turn, tap 🤝 Deal to swap cities and cash with a friend. They can accept, refuse or send one counter-offer. Short on cash? 🏦 Loan from Seth-ji, up to ${fmt(LOAN.LIMIT)} at ${LOAN.RATE * 100}% interest.`, scene: 'deal' },
  { t: 'Play the market 📊', d: 'Every city has a market value that moves each round. Sell at your own price, to a friend or to Seth-ji. Seth-ji decides by secret maths, and he hears one offer per city each turn.', scene: 'event' },
  { t: 'Campus Calendar 🗓️', d: `Every ${CALENDAR.EVERY} rounds a season changes a rule for ${CALENDAR.LENGTH} rounds: Fest Week, Exam Week, Placement Drive, Hostel Strike or Sale Season.`, scene: 'wheel' },
  { t: 'Win the game 👑', d: `Quick: after 15 rounds the richest player wins. Classic has no round limit: rents stay the same for ${MEHNGAI.START - 1} rounds, then Mehngai gently raises them ×${MEHNGAI.STEP} every ${MEHNGAI.EVERY} rounds until one tycoon is left. Teen Set: first to own ${SETS_TO_WIN} full colour sets wins.`, scene: 'win' },
];

function Scene({ kind }: { kind: string }) {
  switch (kind) {
    case 'dice': return <div className="gs gs-dice"><i className="die a">⚄</i><i className="die b">⚂</i><b className="sum">= 8</b></div>;
    case 'buy': return <div className="gs gs-buy"><div className="gs-tile"><div className="gs-tile-art"><TilePic kind="city" name="Mumbai" /></div><small>Mumbai</small></div><i className="coin c1">₹</i><i className="coin c2">₹</i><i className="coin c3">₹</i><div className="gs-seth"><SethJi mood="count" /></div><i className="gs-card">Mumbai</i></div>;
    case 'bolee': return <div className="gs gs-bolee"><span className="gavel">🔨</span><div className="gs-tile-art"><TilePic kind="city" name="Goa" /></div><b>₹1,200</b></div>;
    case 'set': return <div className="gs gs-set">{['Jodhpur', 'Udaipur', 'Jaipur'].map((c, k) => <div key={c} className={`gs-tile-art gs-mon m${k}`}><TilePic kind="city" name={c} /></div>)}<b className="crown">😎</b></div>;
    case 'deal': return <div className="gs gs-deal"><div className="gs-tile-art gs-mon d0"><TilePic kind="city" name="Pune" /></div><b className="shake">🤝</b><div className="gs-tile-art gs-mon d1"><TilePic kind="city" name="Jaipur" /></div><i className="coin c1">₹</i></div>;
    case 'build': return <div className="gs gs-build"><div className="gs-tile-art"><TilePic kind="city" name="Hyderabad" /></div>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`b${n}`}><Buildings n={n === 4 ? 4 : n === 5 ? 5 : 1} /></span>)}</div>;
    case 'wheel': return <div className="gs gs-wheel"><MiniWheel /><div className="gs-seth"><SethJi mood="happy" /></div></div>;
    case 'powers': return <div className="gs gs-powers">{(Object.keys(POWERS) as Power[]).map((p) => <span key={p} className={`power ${p}`}><span>{POWERS[p].icon}</span>{POWERS[p].name}</span>)}</div>;
    case 'event': return <div className="gs gs-event"><div className="gs-tile-art gs-mon"><TilePic kind="city" name="Kolkata" /></div><span className="badge">🙏 Durga Puja ×3</span></div>;
    default: return <div className="gs gs-win"><div className="gs-seth"><SethJi mood="party" shades /></div><span>DhandhaKing</span></div>;
  }
}

function MiniWheel() {
  const seg = 360 / WHEEL.length;
  return (
    <svg viewBox="-55 -55 110 110">
      {WHEEL.map((w, k) => {
        const a0 = (k * seg - 90) * Math.PI / 180, a1 = ((k + 1) * seg - 90) * Math.PI / 180;
        return <path key={k} d={`M0 0L${50 * Math.cos(a0)} ${50 * Math.sin(a0)}A50 50 0 0 1 ${50 * Math.cos(a1)} ${50 * Math.sin(a1)}Z`} fill={w.color} stroke="#1b1035" strokeWidth="1.5" />;
      })}
      <circle r="9" fill="#fffaf0" stroke="#1b1035" strokeWidth="2" />
    </svg>
  );
}

const WAYS = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];

export function DhandhaGuide({ onClose, start = 'video' }: { onClose(): void; start?: 'video' | 'rules' }) {
  const [tab, setTab] = useState<'video' | 'rules'>(start);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (tab !== 'video' || !playing) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 4800);
    return () => clearTimeout(t);
  }, [tab, step, playing]);

  const twist = CARDS.filter((c) => c.deck === 'kismat'), chat = CARDS.filter((c) => c.deck === 'parivaar');
  return (
    <div className="guide-ov" onClick={onClose}>
      <div className="guide" onClick={(e) => e.stopPropagation()}>
        <ArtDefs />
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
            <p>Buy Indian cities, build on them and collect rent until you are the richest on campus. Everyone starts with <b>{fmt(START_CASH)}</b>, or whatever the host picks in the lobby ({CASH_CHOICES.map((c) => fmt(c)).join(' · ')}). Seth-ji is the banker — every rupee you pay or win goes through him.</p>

            <h3>🎲 Your turn</h3>
            <ul>
              <li>Roll two dice and move that many tiles clockwise.</li>
              <li><b>Doubles</b> = roll again. <b>Three doubles in a row</b> = Proxy caught, straight to Detention.</li>
              <li>Passing or landing on <b>Payday</b> pays you <b>{fmt(SALARY)}</b>.</li>
              <li>Before or after rolling, open <b>🃏 Cards</b> to build, mortgage or sell, and play your power-ups.</li>
            </ul>

            <h3>📊 Dice totals</h3>
            <p className="dim">With two dice you can never roll a 1. The lowest is 2 (1+1), the highest is 12 (6+6), and 7 is the most common.</p>
            <table className="dice-table">
              <thead><tr><th>Total</th><th>Ways</th><th>Chance</th><th>WiFi/Recharge rent (own 1 · both)</th></tr></thead>
              <tbody>{WAYS.map((w, k) => <tr key={k}><td><b>{k + 2}</b></td><td>{w}</td><td>{((w / 36) * 100).toFixed(1)}%</td><td>{fmt((k + 2) * 40)} · {fmt((k + 2) * 100)}</td></tr>)}</tbody>
            </table>

            <h3>🏙️ Cities &amp; rent</h3>
            <p>Buy an unowned tile from Seth-ji, or pass it to the <b>Bolee</b>. Rent rises as you build:</p>
            <table className="dice-table">
              <thead><tr><th>On the city</th><th>Rent</th></tr></thead>
              <tbody>
                <tr><td>Empty plot</td><td>base rent</td></tr>
                <tr><td>👑 Full colour set</td><td>base × 2</td></tr>
                {[1, 2, 3, 4, 5].map((n) => <tr key={n}><td><span className="rule-bld"><Buildings n={n} /></span> {['', '1 house', '2 houses', '3 houses', 'Hotel', 'Villa'][n]}</td><td>base × {RENT_MULT[n]}</td></tr>)}
              </tbody>
            </table>
            <p className="dim">Houses cost the colour’s build price, a hotel 1.5×, a villa 2×. Example: Mumbai’s base rent is {fmt(BOARD[39].rent!)}, so with a villa it is {fmt(BOARD[39].rent! * 90)}.</p>
            <div className="group-chips">{GROUPS.map((g) => <span key={g.name} style={{ ['--g' as string]: g.color }}>{g.name} · build {fmt(g.build)}</span>)}</div>

            <h3>🔨 Bolee (auction)</h3>
            <p>If you pass on a tile, Seth-ji auctions it. The other players take turns: bid (opening at half the price, then +{fmt(AUCTION_STEP)} each time) or drop out. With 2–3 players, the player who passed joins in too, bidding last. Last bidder standing gets it for their bid. Every bid has the same turn timer as a normal turn.</p>

            <h3>😈 Hostile takeover</h3>
            <p>Land on a city someone has <b>mortgaged</b> (GIRVI) and you can grab it by paying its full price. The old owner gets half. Buy your GIRVI cities back to stay safe!</p>

            <h3>⚡ Power-ups (hold up to {MAX_POWERS})</h3>
            <table className="dice-table special">
              <tbody>{(Object.keys(POWERS) as Power[]).map((p) => <tr key={p}><td>{POWERS[p].icon} {POWERS[p].name}</td><td>{POWERS[p].text}</td></tr>)}</tbody>
            </table>
            <p className="dim">Win them on the Tapri wheel or from cards marked ⚡.</p>

            <h3>🔥 Rent streak</h3>
            <p>Collect rent three rounds in a row and Seth-ji tips you <b>{fmt(STREAK_BONUS)}</b>. Keep it going for another bonus every third round.</p>

            <h3>📈 City trends</h3>
            <p>From round 3 a city can start <b>trending</b> (a film shoot in Udaipur, Durga Puja in Kolkata…) and its rent goes ×2 or ×3. Or it can <b>slump</b> (floods, power cuts) and rent is halved. Each one lasts a few rounds.</p>

            <h3>✨ Special tiles</h3>
            <table className="dice-table special">
              <tbody>
                <tr><td><TilePic kind="start" name="" className="rt" /> Payday</td><td>Collect {fmt(SALARY)} every time you pass.</td></tr>
                <tr><td><TilePic kind="tax" name="" className="rt" /> Semester Fees</td><td>Pay ₹2,000 into the Tapri gullak.</td></tr>
                <tr><td><TilePic kind="tax" name="" className="rt" /> Platform Fee</td><td>Pay ₹1,000 into the Tapri gullak.</td></tr>
                <tr><td><TilePic kind="chai" name="" className="rt" /> Tapri Jackpot</td><td>Spin the wheel: {WHEEL.map((w) => w.label.toLowerCase()).join(', ')}.</td></tr>
                <tr><td><TilePic kind="kismat" name="" className="rt" /> Plot Twist</td><td>Draw a card: viral reels, missed metros, surprise trips.</td></tr>
                <tr><td><TilePic kind="parivaar" name="" className="rt" /> Group Chat</td><td>Draw a card: Splitwise settlements, Mom’s UPI, 3 AM biryani.</td></tr>
                <tr><td><TilePic kind="train" name="Midnight Metro" className="rt" /> Rides</td><td>Metro, Bike Taxi, Sleeper Bus, Vande Bharat: rent ₹250 / ₹500 / ₹1,000 / ₹2,000 for 1–4 owned.</td></tr>
                <tr><td><TilePic kind="utility" name="Hostel WiFi" className="rt" /> WiFi &amp; Recharge</td><td>Rent = dice total × 40, or × 100 if one player owns both.</td></tr>
                <tr><td><TilePic kind="police" name="" className="rt" /> Proxy Pakdi Gayi!</td><td>Go straight to Detention. No salary.</td></tr>
                <tr><td><TilePic kind="jail" name="" className="rt" /> Detention Room</td><td>Leave by rolling doubles, paying the {fmt(BAIL)} late fine, or using a Doctor’s Note. After 3 tries you pay and leave.</td></tr>
              </tbody>
            </table>

            <h3>🃏 Plot Twist &amp; Group Chat cards</h3>
            <div className="card-list">
              {[...twist, ...chat].map((c, k) => <div key={k} className={c.deck}><b>{c.deck === 'kismat' ? '🌀' : '💬'} {c.title}{c.power ? ' ⚡' : ''}</b><span>{c.text}</span></div>)}
            </div>

            <h3>💝 Send money</h3>
            <p>Tap <b>💝 Send</b> (next to Log) to give cash to another player, any time, in steps of {fmt(GIFT_STEP)}. Use the slider, the ±₹500 buttons or type the amount. Helping a friend out of a tight spot is allowed. So is bribery.</p>

            <h3>🤝 City deals</h3>
            <ul>
              <li>On your turn (before or after you roll), tap <b>🤝 Deal</b>. Pick a player, the cities you give and the cities you want: up to {DEAL_MAX} each side.</li>
              <li>Add cash either way with the slider, in steps of {fmt(GIFT_STEP)}. A deal must give something and get something back.</li>
              <li>Cities with houses can't be traded. Sell the buildings first. GIRVI cities move with their loan still on.</li>
              <li>The other player gets a pop-up with a timer: <b>Deal ✓</b> swaps everything at once, <b>No thanks</b> cancels it, and <b>🔁 Counter</b> sends the deal back with new terms. After one counter it is a straight yes or no.</li>
              <li>Bots trade too: a bot one city short of a set will offer the owner a fair swap. They say yes only to a fair deal, and they value a city that finishes a colour set a lot more.</li>
            </ul>

            <h3>📊 The resale market</h3>
            <ul>
              <li>Every city, ride and utility has a <b>market value</b> that moves every round. It creeps up over a long game, jumps when a city is trending and drops when it slumps. Big moves show up on the board as ▲/▼ tags.</li>
              <li>You see it on every city card and in <b>My cities</b>. Buildings count at half their cost; a GIRVI city has its buy-back taken off.</li>
              <li>Tap <b>🏷️ Sell</b> on a city, set your own price (₹100 steps), then choose who to offer it to.</li>
              <li><b>A player</b> gets a pop-up to accept, refuse or counter. The city must have no buildings.</li>
              <li><b>Seth-ji</b> decides by his own secret maths. His mood, what's trending and how full his godown is all count, and nobody knows the exact numbers. He hears one offer per city each turn, so name your price carefully. A city he buys goes back on sale.</li>
            </ul>

            <h3>🗓️ Campus Calendar</h3>
            <p>Every {CALENDAR.EVERY} rounds a season starts and bends one rule for {CALENDAR.LENGTH} rounds:</p>
            <ul>
              {Object.values(SEASONS).map((s) => <li key={s.name}><b>{s.emoji} {s.name}:</b> {s.text}.</li>)}
            </ul>

            <h3>🎒 Nobody gets left behind</h3>
            <ul>
              <li><b>Backbencher Bonus:</b> at Payday, the player in last place gets {fmt(CATCHUP.BONUS)} if they are far behind the leader.</li>
              <li><b>Topper Tax:</b> at Payday, a leader way ahead of everyone else pays {fmt(CATCHUP.TAX)} into the Tapri gullak.</li>
            </ul>

            <h3>🏦 Seth-ji's loans</h3>
            <ul>
              <li>Tap <b>🏦 Loan</b> on your turn to borrow from Seth-ji in steps of {fmt(LOAN.STEP)}, up to {fmt(LOAN.LIMIT)} borrowed at a time ({fmt(LOAN.LIMIT * (1 + LOAN.RATE))} to pay back).</li>
              <li>Interest is {LOAN.RATE * 100}%: borrow {fmt(LOAN.STEP)}, owe {fmt(LOAN.STEP * (1 + LOAN.RATE))}. Your debt shows as 🏦 on your player card.</li>
              <li>Every time you collect Payday, {fmt(LOAN.PAYDAY)} of it goes back to Seth-ji until you are clear. You can also repay any time from the Loan sheet.</li>
              <li>If a bill is bigger than your cash, Seth-ji lends first, before any of your buildings get sold.</li>
              <li>Debt counts against your total worth at the end of a Quick game.</li>
            </ul>

            <h3>💸 Short of money?</h3>
            <ul>
              <li><b>Seth-ji lends you</b> what he can (up to {fmt(LOAN.LIMIT)} borrowed, {LOAN.RATE * 100}% interest).</li>
              <li><b>Sell a building</b> back for half its cost.</li>
              <li><b>Mortgage (GIRVI)</b> an empty city for half its price. It earns no rent and anyone landing there can take it over, until you <b>buy it back</b> for price × 0.55 (💰 Buy back, on your turn).</li>
              <li><b>Sell a city</b> to a player or to Seth-ji at your own price (see the resale market above).</li>
              <li>If you still can’t pay, you are <b>bankrupt</b> and your cities go to the player you owe.</li>
            </ul>

            <h3>👑 Winning</h3>
            <p><b>Quick:</b> after 15 rounds the richest player (cash + cities + buildings) wins. Rents never go up.</p>
            <p><b>Classic:</b> no round limit. The game goes on until only one player is not bankrupt. Rents stay the same for the first {MEHNGAI.START - 1} rounds. From round {MEHNGAI.START} <b>Mehngai</b> (inflation) raises them gently, ×{MEHNGAI.STEP} every {MEHNGAI.EVERY} rounds (round {[0, 1, 2, 3].map((k) => `${MEHNGAI.START + k * MEHNGAI.EVERY}: ×${+(MEHNGAI.STEP ** (k + 1)).toFixed(2)}`).join(', ')}…), so even the longest game ends.</p>
            <p><b>Teen Set:</b> no round limit. The first player to own {SETS_TO_WIN} complete colour sets wins on the spot. Trading is the fastest way there, so everyone will want your last city.</p>
            <p className="dim">At the end everyone gets awards: Rent Lord, Real-Estate Influencer, Builder Bro, Tapri Regular and Comeback Kid.</p>
          </div>
        )}
      </div>
    </div>
  );
}
