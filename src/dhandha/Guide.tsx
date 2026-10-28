import { useEffect, useState } from 'react';
import { BAIL, BOARD, CARDS, GROUPS, RENT_MULT, SALARY, START_CASH, buildIcon, fmt } from './data';
import { Banker, TilePic } from './Monument';

const STEPS = [
  { t: 'Roll two dice', d: 'On your turn tap Roll. You move the total of both dice — anything from 2 to 12. Doubles? Roll again!', scene: 'dice' },
  { t: 'Buy cities from Seth-ji', d: 'Land on an unowned city, train or board and buy it. Your money goes to Seth-ji the banker, and he hands you the city card.', scene: 'buy' },
  { t: 'Collect a colour set', d: 'Own every city of one colour and its rent doubles. Now you can build on it.', scene: 'set' },
  { t: 'Build houses, a hotel, a villa', d: '3 houses, then a hotel, then a villa. Rent climbs up to 90× the base rent.', scene: 'build' },
  { t: 'Collect rent', d: 'When another player lands on your city they pay you rent. Watch the coins fly into your pocket.', scene: 'rent' },
  { t: 'Ride the city trends', d: 'Every few rounds a festival makes one city trend (rent ×2 or ×3), or bad news makes it slump (rent ×½).', scene: 'event' },
  { t: 'Watch out for special tiles', d: 'Taxes fill the Chai pot — land on Chai Break to win it all. A Shaadi Invite sends you to Sasural!', scene: 'special' },
  { t: 'Become the DhandhaKing', d: 'Quick game: richest after 15 rounds wins. Classic: the last player who is not bankrupt wins.', scene: 'win' },
];

function Scene({ kind }: { kind: string }) {
  switch (kind) {
    case 'dice': return <div className="gs gs-dice"><i className="die a">⚄</i><i className="die b">⚂</i><b className="sum">= 8</b></div>;
    case 'buy': return <div className="gs gs-buy"><div className="gs-tile"><TilePic kind="city" name="Mumbai" color="#2b49ff" className="gs-mon" /><small>Mumbai</small></div><i className="coin c1">₹</i><i className="coin c2">₹</i><i className="coin c3">₹</i><div className="gs-banker"><Banker mood="happy" /></div><i className="gs-card">Mumbai</i></div>;
    case 'set': return <div className="gs gs-set">{['Jodhpur', 'Udaipur', 'Jaipur'].map((c, k) => <TilePic key={c} kind="city" name={c} color="#ff4fd8" className={`gs-mon m${k}`} />)}<b className="crown">👑</b></div>;
    case 'build': return <div className="gs gs-build"><TilePic kind="city" name="Hyderabad" color="#00c97a" className="gs-mon" /><span className="b1">🏠</span><span className="b2">🏠</span><span className="b3">🏠</span><span className="b4">🏨</span><span className="b5">🏰</span></div>;
    case 'rent': return <div className="gs gs-rent"><span className="who a">😩</span>{[0, 1, 2, 3].map((k) => <i key={k} className={`coin r${k}`}>₹</i>)}<span className="who b">😎</span></div>;
    case 'event': return <div className="gs gs-event"><TilePic kind="city" name="Kolkata" color="#ff2d55" className="gs-mon" /><span className="badge">🙏 Durga Puja ×3</span></div>;
    case 'special': return <div className="gs gs-special"><TilePic kind="chai" name="Chai Break" color="#fff" className="gs-mon" /><TilePic kind="tax" name="GST" color="#fff" className="gs-mon" /><TilePic kind="police" name="Shaadi" color="#fff" className="gs-mon" /><TilePic kind="jail" name="Sasural" color="#fff" className="gs-mon" /></div>;
    default: return <div className="gs gs-win"><b>👑</b><span>DhandhaKing</span></div>;
  }
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

  const kismat = CARDS.filter((c) => c.deck === 'kismat'), mohalla = CARDS.filter((c) => c.deck === 'parivaar');
  return (
    <div className="guide-ov" onClick={onClose}>
      <div className="guide" onClick={(e) => e.stopPropagation()}>
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
            <p>Buy Indian cities, build on them and collect rent until you are the richest Seth. Everyone starts with <b>{fmt(START_CASH)}</b>.</p>

            <h3>🎲 Your turn</h3>
            <ul>
              <li>Roll two dice and move that many tiles clockwise.</li>
              <li><b>Doubles</b> (same number on both) = roll again. <b>Three doubles in a row</b> = Shaadi Invite, straight to Sasural.</li>
              <li>Passing or landing on START pays you <b>{fmt(SALARY)}</b> salary.</li>
              <li>After moving you can open <b>🃏 My cards</b> to build, mortgage or sell, then tap End turn.</li>
            </ul>

            <h3>📊 Dice totals</h3>
            <p className="dim">With two dice you can never roll a 1. The lowest is 2 (1+1), the highest is 12 (6+6), and 7 is the most common.</p>
            <table className="dice-table">
              <thead><tr><th>Total</th><th>Ways</th><th>Chance</th><th>Bijli/Jal rent (1 board · 2 boards)</th></tr></thead>
              <tbody>{WAYS.map((w, k) => <tr key={k}><td><b>{k + 2}</b></td><td>{w}</td><td>{((w / 36) * 100).toFixed(1)}%</td><td>{fmt((k + 2) * 40)} · {fmt((k + 2) * 100)}</td></tr>)}</tbody>
            </table>

            <h3>🏙️ Cities &amp; rent</h3>
            <p>Buy an unowned tile from Seth-ji the banker, or pass. Rent rises as you build:</p>
            <table className="dice-table">
              <thead><tr><th>On the city</th><th>Rent</th></tr></thead>
              <tbody>
                <tr><td>🟫 Empty plot</td><td>base rent</td></tr>
                <tr><td>👑 Full colour set</td><td>base × 2</td></tr>
                {[1, 2, 3, 4, 5].map((n) => <tr key={n}><td>{buildIcon(n)} {['', '1 house', '2 houses', '3 houses', 'Hotel', 'Villa'][n]}</td><td>base × {RENT_MULT[n]}</td></tr>)}
              </tbody>
            </table>
            <p className="dim">Houses cost the colour’s build price, a hotel 1.5×, a villa 2×. Example — Mumbai base rent {fmt(BOARD[39].rent!)}: villa rent {fmt(BOARD[39].rent! * 90)}.</p>
            <div className="group-chips">{GROUPS.map((g) => <span key={g.name} style={{ ['--g' as string]: g.color }}>{g.name} · build {fmt(g.build)}</span>)}</div>

            <h3>📈 City trends</h3>
            <p>From round 3, every few rounds a city can start <b>trending</b> because of a festival (Durga Puja in Kolkata, Ganesh Chaturthi in Mumbai…) — its rent is ×2 or ×3. Or it can <b>slump</b> (floods, power cuts) and rent is halved. A pop-up tells everyone, and each event lasts 2–4 rounds.</p>

            <h3>✨ Special tiles</h3>
            <table className="dice-table special">
              <tbody>
                <tr><td><TilePic kind="start" name="" color="#fff" className="rt" /> START</td><td>Collect {fmt(SALARY)} every time you pass.</td></tr>
                <tr><td><TilePic kind="tax" name="" color="#fff" className="rt" /> Income Tax</td><td>Pay ₹2,000 into the Chai pot.</td></tr>
                <tr><td><TilePic kind="tax" name="" color="#fff" className="rt" /> GST</td><td>Pay ₹1,000 into the Chai pot.</td></tr>
                <tr><td><TilePic kind="chai" name="" color="#fff" className="rt" /> Chai Break</td><td>Win everything in the Chai pot.</td></tr>
                <tr><td><TilePic kind="kismat" name="" color="#fff" className="rt" /> Kismat</td><td>Draw a luck card: lotteries, challans, surprise trips.</td></tr>
                <tr><td><TilePic kind="parivaar" name="" color="#fff" className="rt" /> Mohalla</td><td>Draw a neighbourhood card: shagun, school fees, kitty party.</td></tr>
                <tr><td><TilePic kind="train" name="" color="#fff" className="rt" /> Trains</td><td>Rent ₹250 / ₹500 / ₹1,000 / ₹2,000 for 1–4 trains owned.</td></tr>
                <tr><td><TilePic kind="utility" name="Bijli" color="#fff" className="rt" /> Bijli &amp; Jal</td><td>Rent = dice total × 40, or × 100 with both (see the dice table).</td></tr>
                <tr><td><TilePic kind="police" name="" color="#fff" className="rt" /> Shaadi Invite</td><td>Go straight to Sasural. No salary.</td></tr>
                <tr><td><TilePic kind="jail" name="" color="#fff" className="rt" /> Sasural</td><td>Stuck with the in-laws. Escape by rolling doubles, paying {fmt(BAIL)} shagun, or a Jugaad card. After 3 turns you pay and leave.</td></tr>
              </tbody>
            </table>

            <h3>🃏 Kismat &amp; Mohalla cards</h3>
            <div className="card-list">
              {[...kismat, ...mohalla].map((c, k) => <div key={k} className={c.deck}><b>{c.deck === 'kismat' ? '✨' : '🏘️'} {c.title}</b><span>{c.text}</span></div>)}
            </div>

            <h3>💸 Short of money?</h3>
            <ul>
              <li><b>Sell a building</b> back for half its cost.</li>
              <li><b>Mortgage (girvi)</b> an empty city for half its price — it earns no rent until you unmortgage it (price × 0.55).</li>
              <li><b>Sell the card to Seth-ji</b> for 70% of its price plus half of what you built.</li>
              <li>If you still can’t pay, you are <b>bankrupt</b>: your cities go to the player you owe.</li>
            </ul>

            <h3>👑 Winning</h3>
            <p><b>Quick:</b> after 15 rounds the richest player (cash + cities + buildings) wins. <b>Classic:</b> the last player standing wins.</p>
          </div>
        )}
      </div>
    </div>
  );
}
