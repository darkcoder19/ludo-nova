import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Dice } from '../components/Dice';
import { buzz, sfx } from '../game/sound';
import type { GameProps } from '../shared/GameShell';
import { BAIL, BETS, BET_INFO, BOARD, BUILD_LEVELS, DEAL_MAX, GHOST, GIFT_STEP, GROUPS, LOAN, MARKET, SEASONS, SETS_TO_WIN, STAKE, type BetKind, type SeasonKind, MAX_BUILD, POWERS, RENT_MULT, WHEEL, fmt, type Card, type Power } from './data';
import { ArtDefs, Buildings, MONUMENTS, SethJi, TilePic, type SethMood } from './Monument';
import { DhandhaGuide } from './Guide';
import { festivalById } from '../game/festivals';
import { THEMES, themeOfFest, type ThemeId } from './themes';
import {
  betOdds, teamWorth, buyBackPrice, buyPrice, buyoutPrice, canBet, canBuild, canHaunt, canStake, fullSets, stakePrice, stakesOf, groupSquares, loanRoom, marketMult, marketValue, mehngaiLevel, netWorth, nextBuildCost, ownsGroup, placementOn, rentBoost, rentFor, takeoverPrice,
  type CityEvent, type DAction, type DGame, type Deal, type Fx,
} from './rules';

// ---------------- geometry ----------------
// The 40 squares run round the edge of a grid: n along top/bottom, m down each side.
export interface Geo { n: number; m: number; K: number }
const SQUARE: Geo = { n: 9, m: 9, K: 1.5 };
const TALL: Geo = { n: 6, m: 12, K: 1.6 }; // phones
const WIDE: Geo = { n: 12, m: 6, K: 1.6 }; // PC / landscape
type Side = 'b' | 'l' | 't' | 'r' | 'corner';

function cell(i: number, { n, m }: Geo): { r: number; c: number; side: Side } {
  const R = m + 2, C = n + 2, c1 = n + 1, c2 = n + m + 2, c3 = 2 * n + m + 3;
  if (i === 0) return { r: R, c: C, side: 'corner' };
  if (i < c1) return { r: R, c: C - i, side: 'b' };
  if (i === c1) return { r: R, c: 1, side: 'corner' };
  if (i < c2) return { r: R - (i - c1), c: 1, side: 'l' };
  if (i === c2) return { r: 1, c: 1, side: 'corner' };
  if (i < c3) return { r: 1, c: 1 + (i - c2), side: 't' };
  if (i === c3) return { r: 1, c: C, side: 'corner' };
  return { r: 1 + (i - c3), c: C, side: 'r' };
}
const track = (k: number, count: number, K: number) => {
  const total = 2 * K + count;
  return (k === 1 ? K / 2 : k === count + 2 ? total - K / 2 : K + (k - 2) + 0.5) / total;
};
const centre = (i: number, g: Geo): [number, number] => { const { r, c } = cell(i, g); return [track(c, g.n, g.K) * 100, track(r, g.m, g.K) * 100]; };
/** Tokens park on the tile's inner edge so its art and name stay visible. */
function park(i: number, k: number, cnt: number, g: Geo): [number, number] {
  const [x, y] = centre(i, g), { side } = cell(i, g);
  const ux = 100 / (2 * g.K + g.n), uy = 100 / (2 * g.K + g.m);
  const sx = (k - (cnt - 1) / 2) * ux * 0.32, sy = (k - (cnt - 1) / 2) * uy * 0.32;
  if (side === 'b') return [x + sx, y - 0.55 * g.K * uy];
  if (side === 't') return [x + sx, y + 0.55 * g.K * uy];
  if (side === 'l') return [x + 0.55 * g.K * ux, y + sy];
  if (side === 'r') return [x - 0.55 * g.K * ux, y + sy];
  return [x + (x < 50 ? 1 : -1) * 0.5 * g.K * ux + sx, y + (y < 50 ? 1 : -1) * 0.5 * g.K * uy];
}

/** Picks the layout that fills the space without any scrolling: tall on phones, wide on PC. */
function useBoardFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ geo: Geo; w: number; h: number }>({ geo: SQUARE, w: 300, h: 300 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (h / w > 1.12) { const u = w / (2 * TALL.K + TALL.n); setFit({ geo: TALL, w, h: Math.min(h, u * 1.6 * (2 * TALL.K + TALL.m)) }); }
      else if (w / h > 1.12) { const u = h / (2 * WIDE.K + WIDE.m); setFit({ geo: WIDE, w: Math.min(w, u * 1.6 * (2 * WIDE.K + WIDE.n)), h }); }
      else { const s = Math.min(w, h); setFit({ geo: SQUARE, w: s, h: s }); }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...fit };
}

// ---------------- flying coins & cards ----------------
const RM = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4;
const coinsFor = (amt: number) => Math.min(LOW ? 8 : 12, 3 + Math.floor(Math.log2(Math.max(1, amt / 100))));

/** Flies little chips (coins, a card…) between two elements, with an arc. */
function fly(from: Element | null, to: Element | null, html: string, delay = 0, n = 1) {
  if (!from || !to || document.hidden) return;
  if (document.querySelectorAll('.flyer').length > 24) n = 1;
  if (RM) n = 1;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const stagger = Math.min(70, 480 / n);
  for (let k = 0; k < n; k++) {
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = html;
    document.body.appendChild(el);
    const lift = -50 - Math.random() * 50, jit = (Math.random() - 0.5) * 34;
    const anim = el.animate(RM ? [{ transform: `translate(${x1}px, ${y1}px)`, opacity: 0 }, { transform: `translate(${x1}px, ${y1}px)`, opacity: 1 }] : [
      { transform: `translate(${x0}px, ${y0}px) scale(.5)`, opacity: 0 },
      { transform: `translate(${(x0 + x1) / 2 + jit}px, ${(y0 + y1) / 2 + lift}px) scale(1.15)`, opacity: 1, offset: 0.45, easing: 'cubic-bezier(.55,0,1,.45)' },
      { transform: `translate(${x1}px, ${y1}px) scale(.7)`, opacity: 0.9 },
    ], { duration: RM ? 200 : 650, delay: delay + k * stagger, easing: 'cubic-bezier(.33,0,.67,1)', fill: 'backwards' });
    anim.onfinish = anim.oncancel = () => {
      el.remove();
      if (k === n - 1 && !RM) { to.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 180 }); sfx.tink(k); }
    };
  }
}
const COIN = '<span class="fly-coin">₹</span>';
/** Puts an effect (a stamp, a falling building, a price tag, a ribbon…) over an element; its CSS class animates it. */
function overlay(anchor: Element | null, html: string, cls: string, ms = 1500, vars: Record<string, string> = {}) {
  if (!anchor || document.hidden) return;
  const r = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `fx-over ${cls}`;
  el.innerHTML = html;
  el.style.left = `${r.left + r.width / 2}px`; el.style.top = `${r.top + r.height / 2}px`;
  el.style.setProperty('--w', `${r.width}px`);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), RM ? 700 : ms);
}
/** Shakes an element (a big rent rattles the whole board). */
function shake(el: Element | null, px = 6) {
  if (!el || RM) return;
  el.animate([0, -1, 1, -0.7, 0.7, -0.3, 0].map((k, i) => ({ transform: `translate(${k * px}px, ${(i % 2 ? 1 : -1) * k * px * 0.4}px)` })), { duration: 480, easing: 'ease-out' });
}
const BUILD_EMOJI = ['', '🏠', '🏠', '🏠', '🏨', '🏰'];
/** Short form of each Campus Calendar season for the centre chip. */
const SEASON_SHORT: Record<SeasonKind, string> = { fest: 'rides ×2', exam: 'no building', placement: 'Payday ×2', strike: 'WiFi/Recharge free', sale: '20% off' };
const CARD = (name: string, color: string) => `<span class="fly-card" style="--g:${color}">${name}</span>`;

// ---------------- Seth-ji lines ----------------
const LINES: Record<string, string[]> = {
  buy: ['Registry done. Ab tum zameendaar ho, beta.', 'Badhai ho! Property tumhari.', 'Ek aur plot? Full investor mode.'],
  bigRent: ['Ouch. Itna toh meri EMI bhi nahi hai.', 'Wallet ki cheekh sunayi di 😳', 'Yeh rent tha ya donation?'],
  broke: ['Wallet mein sirf vibes bachi hain?', 'Beta, budget banao, reels nahi.'],
  salary: ['Salary credited! Udaana mat, invest karna.', 'Payday! Pehle EMI, phir Zomato.'],
  jackpot: ['Poori gullak tumhari! Chai on you today.', 'Jackpot! Tapri wale bhaiya bhi shocked.'],
  festival: ['Breaking news: {city} is trending! Rent ×{m}.', '{city} mein bheed! Rent ×{m} 🔥'],
  slump: ['{city} mein sannata. Rent half, pain full.'],
  bankrupt: ['Startup shut down. LinkedIn post likh do: "Lessons learnt".'],
  idle: ['Dice roll karo, reel baad mein dekhna.', 'Hello? Network gaya kya?', 'Seth-ji is waiting… ⏳'],
  villa: ['VILLA! Ab toh society ka secretary banoge.'],
  cardSold: ['Thank you for the discount, beta 😏'],
  jail: ['Attendance short? Shabaash. Baitho.', 'Detention! Phone jama karo.'],
  auction: ['Bolee shuru! Kaun lega {city}?'],
  shield: ['Rent Shield! Smart move, beta.'],
  takeover: ['Hostile takeover! Corporate drama 🍿'],
  deal: ['Sauda pakka! 🤝 Haath milao.', 'Deal done. Seth-ji witnessed it 📝'],
  counter: ['Mol-bhav shuru! 😏', 'Counter-offer? Asli business ab hua.', 'Thoda upar, thoda neeche… 🤝'],
  sethYes: ['Theek hai, le liya. Hisaab barabar 📝', 'Sauda pakka. Paisa gin lo, beta.', 'Achha maal hai. Done!'],
  sethClose: ['Thoda kam karo, beta 🤏', 'Itna nahi… thoda sa aur kam.', 'Almost! Mood thoda aur achha hota toh…'],
  sethFar: ['Sapne mein! 😂', 'Main seth hoon, sant nahi.', 'Is daam mein toh main khud bech doon!'],
  backbencher: ['Backbencher Bonus! Pichhe wale bhi aage aayenge 🎒', 'Le beta, ₹1,000. Comeback karo!'],
  topper: ['Topper Tax! Thoda gullak mein bhi daalo 🎓', 'Itna aage? ₹500 tapri ke naam.'],
  fest: ['Fest Week! Rides pe bheed, rent double 🎉'],
  exam: ['Exam Week! Koi construction nahi, sab padhai karo 📚'],
  drive: ['Placement Drive! Payday double 💼'],
  strike: ['Hostel Strike! WiFi band, Recharge free ✊'],
  sale: ['Sale Season! Meri dukaan pe 20% off 🛍️'],
  market: ['Market update! Daam upar-neeche 📊'],
  stake: ['Hissedari! Ab kiraye mein bhi hissa 📈', 'Smart investor! 25% ka maalik.'],
  toll: ['BOO! 👻 Bhoot ka toll bharo.', 'Haunted plot! Bhoot bhi kiraya leta hai 👻'],
  betWin: ['Shart jeet gaye! Seth-ji ka dil toota 😩', 'Lucky! Aaj kismat tumhari 🎲'],
  ghost: ['Divaliya hua, par bhoot ban ke wapas 👻'],
  loan: ['Le lo beta, par Payday pe wapas 😏', 'Byaaj 20%. Seth-ji ka dil bada hai, hisaab nahi.'],
  sets: ['Teen set! Asli DhandhaKing yahi hai 👑'],
  gift: ['Dosti ho toh aisi! 💝', 'Sharing is caring. Seth-ji approves 🙏', 'Paisa idhar se udhar. Pyaar dono taraf 💸'],
  buyback: ['Girvi se wapas! Ab ye phir se tumhara 💰'],
  streak: ['On a roll 🔥 ₹500 bonus from me.'],
  placement: ['Placement Season! Ab har rent ×1.5. All the best 😈'],
  mehngai: ['Mehngai badh gayi! Ab har rent {x}. 💸', 'Inflation alert 📈 Rent {x}. Savings sambhal ke!', 'Sab kuch mehnga! Rent {x}, chai bhi ₹20 ki 😤'],
  set: ['Poora set! Ab ghar bana, hotel bana, villa bana.'],
  spin: ['Ghumao wheel, dekhte hain kismat!'],
  double: ['Double Dhamaka armed. Koi toh aao 😈'],
  tele: ['Teleport? Uber se bhi fast!'],
  free: ['Detention se azaadi! 🕊️'],
};
/** More of Seth-ji: extra lines for every moment, merged into the lists above. */
const MORE: Record<string, string[]> = {
  buy: ['Naya plot, nayi EMI. Mubarak ho!', 'Registry ho gayi, chai pe party 🍵', 'Location location location. Sahi pakda!', 'Is daam pe? Chori ka maal lagta hai 😏', 'Property ka papa ban gaya tu!'],
  bigRent: ['Rent nahi, yeh toh dahej tha 😱', 'Itna kiraya? Hostel bhi sasta tha!', 'Paisa gaya, izzat bachi hai. Shayad.', 'Ouch! Bank balance ne resign kar diya.', 'Yeh thappad ki goonj sunayi di?'],
  broke: ['Jeb mein chhed hai kya beta?', 'Ab Maggi pe guzara karna padega 🍜', 'Kharcha kam, dhandha zyada. Seth-ji ki salah.', 'Paisa khatam, tension shuru.'],
  salary: ['Payday! Aaj ka din tumhara 💸', 'Stipend aa gaya! Canteen wale khush.', 'Paise aaye, ab dimaag lagao.', 'Salary credited. Mom ko call karna mat bhoolna 📞'],
  jackpot: ['Gullak tod di! Tapri wale ro rahe hain 😂', 'Itna paisa? Party toh banti hai!', 'Kismat ka dhakkan khul gaya ☕'],
  bankrupt: ['Dhandha band, sapne zinda. Agli baar!', 'Startup fail, lessons pass. Bhoot ban ke aao 👻', 'Divaliya! Par Seth-ji ka dil abhi bhi tumhare saath hai.'],
  idle: ['Soch kya rahe ho, Shark Tank ka pitch?', 'Dice ko dhoop lag rahi hai, roll karo!', 'Jaldi karo, mera chai thanda ho raha hai ☕', 'Beta, time is money. Aur money is mine 😏', 'Roll karo warna main kar dunga!'],
  villa: ['Villa! Ab toh Bollywood waale bhi kiraya denge 🎬', 'Swimming pool wala ghar? Show off!', 'Itni badi villa, itna bada rent 😈'],
  jail: ['Detention mein WiFi nahi milega 📵', 'Principal ke office mein swagat hai!', 'Proxy pakdi gayi, ab pachtao 😂', 'Thoda aaram karo. Kiraya dusre bharenge.'],
  shield: ['Shield ne bacha liya! Smart kid.', 'Rent dodge! Matrix style 😎'],
  takeover: ['GIRVI ka maal, sabka maal! 😈', 'Corporate jungle mein swagat hai.'],
  deal: ['Haath milao, sauda pakka 🤝', 'Win-win? Ya kisi ne chuna lagaya? 😏', 'Business ho toh aisa!'],
  set: ['Poora set! Ab asli khel shuru 👑', 'Colour set complete. Rent double, attitude triple!'],
  spin: ['Ghumao ghumao! Kismat ka pahiya ☕', 'Tapri ka jackpot bula raha hai!'],
  double: ['Double Dhamaka ready. Koi toh aao meri gali 😈'],
  free: ['Azaad! Ab dhandha karo, drama nahi.', 'Bail pe bahar. Seedha kaam pe lag jao!'],
  festival: ['{city} mein mela! Rent ×{m}. Wah!', 'Sab {city} ja rahe hain. Owner ki chandi 🔥'],
  slump: ['{city} mein sannata. Koi nahi aa raha 😶', '{city} ka market down. Ouch.'],
  dbl: ['Doubles! Ek aur chance, ek aur dhamaka 🎲', 'Do baar same? Lucky ho ya jugaadu?', 'Doubles! Kismat aaj tumhare side hai.'],
  mortgage: ['GIRVI rakh diya? Dhyaan rakhna, koi utha lega 😏', 'Mortgage! Seth-ji ka byaaj hi asli dhandha hai.', 'Plot girvi, dil nahi. Wapas lena jaldi!'],
  pass: ['Pass? Theek hai, bolee lagegi 🔨', 'Nahi chahiye? Koi aur le jayega!', 'Mehnga laga? Bolee mein sasta milega shayad.'],
  bid: ['Bolee garam hai! 🔥', 'Aur koi? Ek… do…', 'Ladai shuru! Kaun jeetega?'],
  chatter: ['Market ka mood dekho, phir dhandha karo 📊', 'Kabhi stake bhi try karo. Dusron ke rent mein hissa!', 'Deal karo, chup mat baitho. Dhandha bolne se chalta hai.', 'Loan chahiye? Seth-ji hamesha hazir 😏', 'Mere zamane mein ek plot ₹100 ka tha…', 'Chai pe charcha, plot pe kharcha ☕'],
};
for (const [k, v] of Object.entries(MORE)) LINES[k] = [...(LINES[k] ?? []), ...v];

const pickLine = (k: string, vars: Record<string, string> = {}) => {
  const arr = LINES[k];
  if (!arr) return '';
  return arr[Math.floor(Math.random() * arr.length)].replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LANDING = new Set<Fx['kind']>(['pay', 'earn', 'land', 'pot', 'jail', 'setComplete', 'shield', 'double', 'streak', 'event', 'free']);
const short = (n: number) => (n >= 1000 ? `₹${+(n / 1000).toFixed(1)}k` : `₹${n}`);
/** Rent multiplier as people read it: ×1.5, ×2.3, ×11. */
const times = (x: number) => (x < 10 ? `×${+x.toFixed(1)}` : `×${Math.round(x)}`);
interface Floater { id: number; pid: string; text: string; good: boolean }
const MODAL_POPS = new Set(['event', 'set']);
type Pop = { id: number; kind: 'event' | 'land' | 'set' | 'villa' | 'eventEnd' | 'placement' | 'gift' | 'streak' | 'takeover' | 'auctionWin' | 'shield' | 'counter' | 'season' | 'catchup' | 'stake' | 'haunt'; sq?: number; pid: string; amount?: number; ev?: CityEvent; other?: string };

export function DhandhaBoard({ room, game, me, color, mood, setMood, confetti, act, left }: GameProps<DGame, DAction>) {
  const [shown, setShown] = useState<Record<string, number>>(() => ({ ...game.pos }));
  const fit = useBoardFit();
  const geo = fit.geo;
  // Centre-panel unit: the smaller of a column and a row, so the middle never overflows.
  const uc = Math.min(fit.w / (2 * geo.K + geo.n), fit.h / (2 * geo.K + geo.m));
  const [peek, setPeek] = useState<number | null>(null);
  const [manage, setManage] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [gift, setGift] = useState<{ to: string; amount: number } | null>(null);
  const [rules, setRules] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [sellSq, setSellSq] = useState<number | null>(null);
  const [biz, setBiz] = useState(false);
  const [stakesOpen, setStakesOpen] = useState(false);
  const [betOpen, setBetOpen] = useState(false);
  const [haunting, setHaunting] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [sethAnim, setSethAnim] = useState('');
  const [teleport, setTeleport] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [flash, setFlash] = useState<Record<number, string>>({});
  const [pops, setPops] = useState<Pop[]>([]);
  const [seth, setSeth] = useState<{ mood: SethMood; say: string; id: number; shades: boolean }>({ mood: 'idle', say: '', id: 0, shades: false });
  const [settled, setSettled] = useState(true);
  const [moving, setMoving] = useState<string | null>(null);
  const [wheel, setWheel] = useState<{ idx: number; id: number; spun: boolean } | null>(null);
  const [cashShown, setCashShown] = useState<Record<string, number>>(() => ({ ...game.cash }));
  const lastMove = useRef(game.move?.id ?? 0);
  const seenFx = useRef(new Set<number>(game.fx.map((f) => f.id)));
  const fxMove = useRef(game.move?.id ?? 0);
  const root = useRef<HTMLDivElement>(null);
  // The live feed gives up its oldest lines when the centre panel runs out of room.
  const centre = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const c = centre.current; if (!c) return;
    const items = [...c.querySelectorAll<HTMLElement>('.dk-feed li')];
    items.forEach((li) => { li.style.display = ''; });
    const over = () => {
      const r = c.getBoundingClientRect(); let top = Infinity, bottom = -Infinity;
      for (const k of c.children) { const b = k.getBoundingClientRect(); if (b.height) { top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom); } }
      return top < r.top - 1 || bottom > r.bottom + 1;
    };
    for (let k = items.length - 1; k >= 0 && over(); k--) items[k].style.display = 'none';
  });

  const cur = game.order[game.turn];
  const festival = festivalById(game.festival);
  const theme = themeOfFest(game.festival);
  // Log: a side panel on wide screens (open or tucked away), a drawer from the right on phones.
  const wide = useWide();
  const [logSide, setLogSide] = useState(() => { try { return localStorage.getItem('dk-logside') !== 'closed'; } catch { return true; } });
  const toggleLog = () => { sfx.tap(); if (wide) { const v = !logSide; setLogSide(v); try { localStorage.setItem('dk-logside', v ? 'open' : 'closed'); } catch { /* private mode */ } } else setLogOpen(true); };
  // A theme change (into a festival, or back to Classic) plays a curtain and a wave across the tiles.
  const [themeIntro, setThemeIntro] = useState<string | null>(null);
  useEffect(() => {
    const key = theme ?? 'classic';
    let last = ''; try { last = localStorage.getItem('dk-theme') ?? ''; } catch { /* private mode */ }
    if (theme || (last && last !== 'classic')) {
      setThemeIntro(key);
      const t = setTimeout(() => setThemeIntro(null), 2600);
      if (theme) setTimeout(() => say('', 'party', {}, true, THEMES[theme].greet), 1200);
      try { localStorage.setItem('dk-theme', key); } catch { /* private mode */ }
      return () => clearTimeout(t);
    }
    try { localStorage.setItem('dk-theme', key); } catch { /* private mode */ }
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = cur === me;
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '?';
  const avatarOf = (pid: string) => room.players.find((p) => p.id === pid)?.avatar ?? 'c0';
  const q = (sel: string) => root.current?.querySelector(sel) ?? null;
  const chip = (pid: string) => q(`[data-pid="${pid}"]`);
  const tile = (sq: number) => q(`[data-sq="${sq}"]`);
  const nod = (kind: 'yes' | 'nope') => { setSethAnim(kind); setTimeout(() => setSethAnim(''), 700); };

  const say = (key: string, m: SethMood, vars?: Record<string, string>, shades = false, lines?: string[]) => {
    const text = lines ? lines[Math.floor(Math.random() * lines.length)] : pickLine(key, vars);
    const id = Date.now() + Math.random();
    setSeth({ mood: m, say: text, id, shades });
    setTimeout(() => setSeth((s) => (s.id === id ? { mood: 'idle', say: '', id, shades: false } : s)), 2600);
  };
  const pop = (p: Omit<Pop, 'id'>, ms = 3000) => {
    const id = Date.now() + Math.random();
    setPops((l) => [...l.slice(-2), { ...p, id }]);
    setTimeout(() => setPops((l) => l.filter((x) => x.id !== id)), ms);
  };
  const flashTile = (sq: number, cls: string, ms = 1100) => {
    setFlash((f) => ({ ...f, [sq]: cls }));
    setTimeout(() => setFlash((f) => { const n = { ...f }; if (n[sq] === cls) delete n[sq]; return n; }), ms);
  };

  // Count cash up/down smoothly.
  useEffect(() => {
    const from = { ...cashShown }, to = game.cash, t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 500);
      setCashShown(Object.fromEntries(Object.keys(to).map((id) => [id, Math.round((from[id] ?? to[id]) + (to[id] - (from[id] ?? to[id])) * k)])));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    const delay = setTimeout(() => { raf = requestAnimationFrame(step); }, 350);
    return () => { clearTimeout(delay); cancelAnimationFrame(raf); };
  }, [game.cash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Walk tokens square by square with a hop.
  useEffect(() => {
    const m = game.move;
    if (!m) { setShown({ ...game.pos }); return; }
    if (m.id === lastMove.current) return;
    lastMove.current = m.id;
    let alive = true;
    (async () => {
      await sleep(650);
      setMoving(m.pid);
      if (m.jump) { sfx.pop(); setShown((s) => ({ ...s, [m.pid]: m.to })); await sleep(500); setMoving(null); return; }
      const steps = (m.to - m.from + 40) % 40;
      for (let k = 1; k <= steps && alive; k++) {
        setShown((s) => ({ ...s, [m.pid]: (m.from + k) % 40 }));
        sfx.step();
        await sleep(170);
      }
      setMoving(null);
      if (alive && !RM) sfx.thud();
    })();
    return () => { alive = false; };
  }, [game.move, game.pos]);

  // A ribbon sweeps across the board when it becomes your turn.
  const firstTurn = useRef(true);
  useEffect(() => {
    if (firstTurn.current) { firstTurn.current = false; return; }
    if (game.order[game.turn] !== me || game.out.includes(me)) return;
    // wait for a season ribbon that is still sweeping across, so the two never overlap
    let t: ReturnType<typeof setTimeout>;
    const show = () => {
      if (document.querySelector('.fx-over.ribbon.season')) { t = setTimeout(show, 600); return; }
      overlay(root.current?.querySelector('.dk-board') ?? null, 'YOUR TURN 🎲', 'ribbon turn', 1700); sfx.turn();
    };
    t = setTimeout(show, 500);
    return () => clearTimeout(t);
  }, [game.turn, game.round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seth-ji nudges an idle player.
  useEffect(() => {
    if (!mine || game.phase !== 'roll') return;
    const t = setTimeout(() => say('idle', 'idle'), 11000);
    return () => clearTimeout(t);
  }, [mine, game.phase, game.rollId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every game effect → coins, Seth-ji, pop-ups, moods. Timed to land after the token arrives.
  useEffect(() => {
    const fresh = game.fx.filter((f) => !seenFx.current.has(f.id));
    if (!fresh.length) return;
    fresh.forEach((f) => seenFx.current.add(f.id));
    const m = game.move;
    // Effects of a landing wait until the walking token actually arrives.
    const moveFresh = !!m && m.id !== fxMove.current;
    if (m) fxMove.current = m.id;
    const arrive = moveFresh ? 650 + (m!.jump ? 500 : ((m!.to - m!.from + 40) % 40) * 170) + 80 : 150;
    const hasSpin = fresh.some((f) => f.kind === 'spin');
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const float = (f: Fx, text: string, good: boolean) => {
      const fl: Floater = { id: f.id, pid: f.pid, text, good };
      setFloaters((l) => [...l, fl]);
      setTimeout(() => setFloaters((l) => l.filter((x) => x !== fl)), 1800);
    };
    const banker = () => q('[data-anchor="banker"]');

    for (const f of fresh) {
      const s = f.sq != null ? BOARD[f.sq] : null;
      const gcol = s?.group != null ? GROUPS[s.group].color : '#9b6bff';
      let delay = hasSpin && ['pot', 'power', 'build', 'villa'].includes(f.kind) ? 2400 : LANDING.has(f.kind) ? arrive : 150;
      if ((f.kind === 'betWin' || f.kind === 'betLose') && f.text !== 'mine') delay = 950; // after the dice settle
      if ((f.kind === 'betWin' || f.kind === 'betLose') && f.text === 'mine') delay = arrive;
      if (f.kind === 'toll' || f.kind === 'stakeCut') delay = arrive + 300;
      if (f.kind === 'salary' && m) delay = 650 + (((40 - m.from) % 40) || 40) * 170;
      at(delay, () => {
        switch (f.kind) {
          case 'pay': {
            if (!f.amount) break;
            float(f, `−${fmt(f.amount)}`, false);
            const n = coinsFor(f.amount);
            if (f.other) fly(chip(f.pid), chip(f.other), COIN, 0, n);
            else if (f.text === 'pot') fly(chip(f.pid), q('[data-anchor="pot"]'), COIN, 0, n);
            else fly(chip(f.pid), banker(), COIN, 0, n);
            chip(f.pid)?.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-2 - Math.min(6, f.amount / 500)}px)` }, { transform: `translateX(${2 + Math.min(6, f.amount / 500)}px)` }, { transform: 'none' }], { duration: 300 });
            if (f.other && f.amount >= 1000) { setMood(f.pid, 'sad'); say('bigRent', f.amount >= 3000 ? 'shocked' : 'sad'); }
            if (f.other && f.amount >= 2000) {
              const big = f.amount >= 5000;
              shake(q('.dk-board'), big ? 10 : 5);
              overlay(q('.dk-centre'), `${big ? 'BADA JHATKA!' : 'OUCH!'}<small>−${fmt(f.amount)}</small>`, `stamp ${big ? 'jhatka' : 'ouch'}`, 1500);
              if (f.pid === me) buzz(big ? [80, 40, 160] : 120);
            }
            else if (!f.other) setSeth((x) => ({ ...x, mood: 'happy' }));
            if (f.pid === me) buzz(60);
            sfx.capture();
            if (game.cash[f.pid] < 500 && !game.out.includes(f.pid)) setTimeout(() => say('broke', 'shocked'), 900);
            break;
          }
          case 'earn': if (f.amount) { float(f, `+${fmt(f.amount)}`, true); if (f.amount >= 500) setMood(f.pid, 'cool'); if (f.text === 'bank') fly(banker(), chip(f.pid), COIN, 0, coinsFor(f.amount)); } break;
          case 'salary': float(f, `+${fmt(f.amount!)} salary`, true); fly(tile(0) ?? banker(), chip(f.pid), COIN, 0, f.amount! > 2000 ? 9 : 5); overlay(tile(0), '', 'ring gold', 900); flashTile(0, 'claim', 700); say(game.season?.kind === 'placement' ? 'drive' : 'salary', 'count'); sfx.six(); break;
          case 'buy':
            fly(chip(f.pid), banker(), COIN, 0, coinsFor(f.amount ?? 1000));
            fly(banker(), chip(f.pid), CARD(s!.short, gcol), 600);
            setTimeout(() => { flashTile(f.sq!, 'claim'); overlay(tile(f.sq!), 'SOLD', 'stamp sold sm', 1300, { '--oc': color(f.pid) }); setMood(f.pid, 'cool'); sfx.home(); }, 900);
            say('buy', 'happy');
            break;
          case 'build': fly(chip(f.pid), banker(), COIN, 0, 3); flashTile(f.sq!, 'build', 900); overlay(tile(f.sq!), BUILD_EMOJI[game.build[f.sq!]] || '🏠', 'drop', 1100); setSeth((x) => ({ ...x, mood: 'happy' })); sfx.home(); break;
          case 'sell': flashTile(f.sq!, 'unbuild', 500); break;
          case 'cardSold':
            fly(chip(f.pid), banker(), CARD(s!.short, gcol));
            fly(banker(), chip(f.pid), COIN, 600, coinsFor(f.amount ?? 500));
            flashTile(f.sq!, 'unclaim', 600);
            float(f, `🏦 +${fmt(f.amount!)}`, true); say('sethYes', 'count'); sfx.pop();
            overlay(q('[data-anchor="banker"]'), 'SOLD ✓', 'stamp approved', 1400); nod('yes');
            break;
          case 'mortgage': flashTile(f.sq!, 'girvi', 800); if (f.amount) fly(banker(), chip(f.pid), COIN, 0, 3); say('mortgage', 'count'); break;
          case 'unmort': flashTile(f.sq!, 'ungirvi', 600); fly(chip(f.pid), banker(), COIN, 0, 4); if (f.pid === me) say('buyback', 'happy'); break;
          case 'deal':
            if (f.amount) fly(chip(f.amount > 0 ? f.pid : f.other!), chip(f.amount > 0 ? f.other! : f.pid), COIN, 0, coinsFor(Math.abs(f.amount)));
            {
              const [gv, gt] = (f.text ?? '|').split('|').map((x) => x.split(',').filter(Boolean).map(Number));
              const card = (sq: number) => CARD(BOARD[sq].short, BOARD[sq].group != null ? GROUPS[BOARD[sq].group!].color : '#9b6bff');
              gv.forEach((sq, k) => fly(chip(f.pid), chip(f.other!), card(sq), 150 + k * 160));
              gt.forEach((sq, k) => fly(chip(f.other!), chip(f.pid), card(sq), 230 + k * 160));
              if (!gv.length && !gt.length) fly(chip(f.pid), chip(f.other!), CARD('DEAL', '#12d6b4'), 200);
              overlay(q('.dk-centre'), '🤝', 'stamp handshake', 1300);
            }
            pop({ kind: 'gift', pid: f.pid, other: f.other, amount: -1 }, 2600);
            say('deal', 'happy'); sfx.home();
            break;
          case 'loan': fly(banker(), chip(f.pid), COIN, 0, coinsFor(f.amount ?? 1000)); overlay(chip(f.pid), '💰', 'pack', 1100); say('loan', 'count'); sfx.pop(); break;
          case 'sethNo':
            overlay(q('[data-anchor="banker"]'), 'REJECTED', 'stamp rejected', 1400); nod('nope');
            say(f.text === 'close' ? 'sethClose' : 'sethFar', 'shocked'); sfx.captured();
            break;
          case 'counter': say('counter', 'count'); pop({ kind: 'counter', pid: f.pid, other: f.other }, 2400); sfx.pop(); break;
          case 'season': {
            const sk = f.text as SeasonKind, se = SEASONS[sk];
            if (!se) break;
            if (f.amount) {
              overlay(q('.dk-board'), `${se.emoji} ${se.name.toUpperCase()}<small>${se.text} · ${f.amount} rounds</small>`, `ribbon season s-${sk}`, 2700);
              confetti(innerWidth / 2, innerHeight * 0.45, sk === 'exam' ? ['#cfd8e8', '#fff'] : sk === 'sale' ? ['#ff4fd8', '#ffd23f'] : ['#12d6b4', '#ffd23f', '#ff8c42'], LOW ? 30 : 70);
              say(sk === 'placement' ? 'drive' : sk, sk === 'exam' ? 'sad' : 'party'); sfx.turn();
            } else pop({ kind: 'season', pid: f.pid, other: sk }, 2200);
            break;
          }
          case 'catchup':
            if (f.text === 'bonus') { fly(banker(), chip(f.pid), COIN, 0, 6); overlay(chip(f.pid), '🎒', 'pack', 1200); float(f, `🎒 +${fmt(f.amount!)}`, true); say('backbencher', 'happy'); }
            else { fly(chip(f.pid), q('[data-anchor="pot"]'), COIN, 0, 4); overlay(chip(f.pid), '🎓', 'pack', 1200); float(f, `🎓 −${fmt(f.amount!)}`, false); say('topper', 'count'); }
            pop({ kind: 'catchup', pid: f.pid, amount: f.amount, other: f.text }, 2600);
            break;
          case 'market': {
            if (f.sq != null) { overlay(tile(f.sq), `▲${f.amount}%`, 'tag up', 1900); flashTile(f.sq, 'spot', 1200); }
            if (f.text) { const [dsq, dd] = f.text.split(':').map(Number); overlay(tile(dsq), `▼${Math.abs(dd)}%`, 'tag down', 1900); flashTile(dsq, 'droop', 1200); }
            break;
          }
          case 'repay': fly(chip(f.pid), banker(), COIN, 0, coinsFor(f.amount ?? 500)); break;
          case 'sets': confetti(innerWidth / 2, innerHeight * 0.4, [color(f.pid), '#ffd23f', '#fff'], 160); say('sets', 'party', {}, true); sfx.win(); break;
          case 'stake':
            fly(chip(f.pid), chip(f.other!), COIN, 0, coinsFor(f.amount ?? 500));
            overlay(tile(f.sq!), '25%', 'tag up stake', 1900, { '--oc': color(f.pid) });
            pop({ kind: 'stake', pid: f.pid, other: f.other, sq: f.sq, amount: f.amount }, 2600); say('stake', 'count'); sfx.home();
            break;
          case 'stakeCut': fly(chip(f.other!), chip(f.pid), COIN, 0, 3); float(f, `📈 +${fmt(f.amount!)}`, true); break;
          case 'buyout':
            fly(f.text === 'bank' ? banker() : chip(f.other!), chip(f.pid), COIN, 0, coinsFor(f.amount ?? 500));
            float(f, `📈 +${fmt(f.amount!)}`, true);
            break;
          case 'haunt': overlay(tile(f.sq!), '👻', 'drop ghost', 1300); pop({ kind: 'haunt', pid: f.pid, sq: f.sq }, 2400); if (game.out.includes(f.pid) && f.pid === me) say('ghost', 'shocked'); break;
          case 'toll':
            fly(chip(f.pid), chip(f.other!), COIN, 0, 3);
            overlay(tile(f.sq!), 'BOO!', 'stamp boo sm', 1300);
            float(f, `👻 −${fmt(f.amount!)}`, false); say('toll', 'shocked'); sfx.captured();
            break;
          case 'bet': float(f, `🎲 ${fmt(f.amount!)} on ${BET_INFO[f.text as BetKind]?.name ?? ''}`, true); sfx.pop(); break;
          case 'betWin':
            fly(banker(), chip(f.pid), COIN, 0, coinsFor(f.amount ?? 400));
            overlay(chip(f.pid), 'SHART JEETA!', 'stamp approved', 1400); float(f, `🎲 +${fmt(f.amount!)}`, true);
            say('betWin', 'sad'); sfx.win();
            break;
          case 'betLose': fly(chip(f.pid), q('[data-anchor="pot"]'), COIN, 0, 1); break;
          case 'gift':
            fly(chip(f.pid), chip(f.other!), COIN, 0, coinsFor(f.amount ?? 100));
            float(f, `💝 −${fmt(f.amount!)}`, false);
            float({ ...f, id: f.id + 0.5, pid: f.other! }, `💝 +${fmt(f.amount!)}`, true);
            pop({ kind: 'gift', pid: f.pid, other: f.other, amount: f.amount }, 2600);
            say('gift', 'happy'); sfx.home();
            break;
          case 'pot': {
            const src = f.text === 'pot' ? q('[data-anchor="pot"]') : banker();
            fly(src, chip(f.pid), COIN, 0, f.text === 'pot' ? 12 : 5);
            float(f, `☕ +${fmt(f.amount!)}`, true); setMood(f.pid, 'cool');
            if (f.text === 'pot' && (f.amount ?? 0) >= 1000) { confetti(innerWidth / 2, innerHeight / 2, ['#ffd23f', '#ffb400', '#fff'], LOW ? 40 : 80); say('jackpot', 'shocked'); sfx.win(); }
            break;
          }
          case 'jail': setMood(f.pid, 'sad', 5000); say('jail', 'happy'); sfx.captured(); buzz(200); break;
          case 'free': say('free', 'idle'); sfx.pop(); break;
          case 'bankrupt':
            setMood(f.pid, 'sad', 8000); say('bankrupt', 'shocked'); sfx.lose(); buzz([100, 60, 200]);
            overlay(chip(f.pid), 'DIVALIYA!', 'stamp bankrupt', 1700);
            chip(f.pid)?.classList.add('crack'); setTimeout(() => chip(f.pid)?.classList.remove('crack'), 1300);
            if (f.other) fly(chip(f.pid), chip(f.other), CARD('🏙️', '#9b6bff'), 500, 4);
            setTimeout(() => setSeth((x) => ({ ...x, mood: 'sad' })), 1400);
            break;
          case 'land': pop({ kind: 'land', sq: f.sq!, pid: f.pid, amount: f.amount }, 2400); break;
          case 'setComplete':
            pop({ kind: 'set', sq: f.sq!, pid: f.pid }, 3200);
            groupSquares(s!.group!).forEach((k, i) => setTimeout(() => flashTile(k, 'wave', 900), i * 90));
            confetti(innerWidth / 2, innerHeight * 0.4, [gcol, '#ffd23f', '#fff'], LOW ? 60 : 120); sfx.win(); setMood(f.pid, 'cool', 5000);
            say('set', 'party', {}, true);
            break;
          case 'villa': pop({ kind: 'villa', sq: f.sq!, pid: f.pid }, 2800); flashTile(f.sq!, 'villa', 1000); confetti(innerWidth / 2, innerHeight * 0.4, [gcol, '#fff'], LOW ? 40 : 80); say('villa', 'party'); break;
          case 'event': {
            const ev = game.events.find((e) => e.id === f.amount);
            if (ev) { pop({ kind: 'event', sq: ev.sq, pid: f.pid, ev }, 3200); flashTile(ev.sq, ev.mult > 1 ? 'spot' : 'droop', 1600); say(ev.mult > 1 ? 'festival' : 'slump', ev.mult > 1 ? 'happy' : 'sad', { city: BOARD[ev.sq].name, m: String(ev.mult) }); sfx.turn(); }
            break;
          }
          case 'eventEnd': pop({ kind: 'eventEnd', sq: f.sq!, pid: f.pid }, 2000); break;
          case 'placement':
            pop({ kind: 'placement', pid: f.pid, amount: f.amount, other: f.text }, 3200);
            if (f.text === 'mehngai') say('mehngai', 'shocked', { x: times(f.amount ?? 1) }); else say('placement', 'party');
            sfx.turn();
            break;
          case 'streak': float(f, `🔥 +${fmt(f.amount!)} streak`, true); fly(banker(), chip(f.pid), COIN, 0, 4); say('streak', 'count'); break;
          case 'shield': pop({ kind: 'shield', pid: f.pid, sq: f.sq, amount: f.amount, other: f.other }, 2400); say('shield', 'shocked'); sfx.six(); break;
          case 'double': float(f, `💥 ×2 rent!`, true); sfx.win(); break;
          case 'takeover': pop({ kind: 'takeover', pid: f.pid, sq: f.sq, other: f.other }, 2600); flashTile(f.sq!, 'claim'); say('takeover', 'shocked'); break;
          case 'auctionWin': pop({ kind: 'auctionWin', pid: f.pid, sq: f.sq, amount: f.amount }, 2400); break;
          case 'power': if (f.text === 'double-armed') say('double', 'happy'); else if (f.text) { float(f, `${POWERS[f.text as Power]?.icon ?? '✨'} ${POWERS[f.text as Power]?.name ?? 'Power-up'}`, true); sfx.six(); } break;
          case 'tele': say('tele', 'shocked'); sfx.pop(); break;
          case 'spin': setWheel({ idx: f.amount!, id: f.id, spun: true }); setTimeout(() => setWheel((w) => (w?.id === f.id ? null : w)), 3600); break;
        }
      });
    }
    return () => timers.forEach((t) => clearTimeout(t)); // eslint-disable-line react-hooks/exhaustive-deps
  }, [game.fx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seth-ji reacts to doubles, and chats when nothing has happened for a while.
  const lastSay = useRef(Date.now());
  useEffect(() => { if (game.dice[0] === game.dice[1] && game.rollId > 0) setTimeout(() => say('dbl', 'happy'), 900); }, [game.rollId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { lastSay.current = Date.now(); }, [seth.id]);
  useEffect(() => {
    const t = setInterval(() => { if (Date.now() - lastSay.current > 28000 && game.phase !== 'auction') say('chatter', 'idle'); }, 6000);
    return () => clearInterval(t);
  }, [game.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (game.phase === 'auction' && game.auction?.leader) say('bid', 'happy'); }, [game.auction?.price]); // eslint-disable-line react-hooks/exhaustive-deps
  // Auction / wheel announcements from Seth-ji.
  useEffect(() => { if (game.phase === 'auction' && game.auction) say('auction', 'happy', { city: BOARD[game.auction.sq].name }); }, [game.phase === 'auction']); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (game.phase === 'spin') { say('spin', 'happy'); setWheel({ idx: 0, id: -1, spun: false }); } }, [game.phase === 'spin']); // eslint-disable-line react-hooks/exhaustive-deps

  const here = game.pos[cur];
  const sq = BOARD[here];
  const jailed = game.jail[cur] > 0;
  const myProps = BOARD.map((_, i) => i).filter((i) => game.owner[i] === me);
  const ready = mine && settled;
  const evOf = (i: number) => game.events.find((e) => e.sq === i);
  const myHand = game.hand[me] ?? [];
  const canManage = mine && (game.phase === 'end' || game.phase === 'roll');
  const doubles = game.dice[0] === game.dice[1] && game.rollId > 0;
  // Whose clock is running (the bidder during a bolee) and how much of it is left.
  const waitingId = game.phase === 'auction' && game.auction ? game.auction.queue[0] : game.phase === 'deal' && game.deal ? game.deal.to : cur;
  const waitingSeat = room.players.find((p) => p.id === waitingId);
  const timed = room.turnMs > 0 && !!waitingSeat && !waitingSeat.bot && waitingSeat.connected && !game.out.includes(waitingId);
  const secs = Math.ceil(left / 1000);
  const tFrac = timed ? Math.max(0, Math.min(1, left / room.turnMs)) : 0;
  // Cities I can build on right now; landing on one of them offers to build right there.
  const buildable = canManage ? myProps.filter((i) => canBuild(game, me, i)) : [];
  const buildHere = canManage && game.phase === 'end' && buildable.includes(here) ? here : null;
  // GIRVI (mortgaged) cities I can afford to buy back; standing on one offers it right there.
  const girvi = canManage ? myProps.filter((i) => game.mort[i] && game.cash[me] >= buyBackPrice(i)) : [];
  const buyBackHere = canManage && game.phase === 'end' && girvi.includes(here) ? here : null;
  const meIn = !game.out.includes(me) && game.order.includes(me);
  const giftTargets = room.players.filter((p) => p.id !== me && game.order.includes(p.id) && !game.out.includes(p.id));

  const bySq = new Map<number, string[]>();
  game.order.filter((id) => !game.out.includes(id)).forEach((id) => { const s = shown[id] ?? 0; bySq.set(s, [...(bySq.get(s) ?? []), id]); });

  const roll = () => { setSettled(false); act({ t: 'roll' }); };
  const potFill = Math.min(1, game.pot / 6000);

  return (
    <div className={`dk v5 ${theme ? `fest theme-${theme}` : 'theme-classic'} ${wide ? (logSide ? 'log-open' : 'log-tucked') : ''}`} ref={root} style={festival ? { ['--fa' as string]: festival.colors[0], ['--fb' as string]: festival.colors[1] } : undefined}>
      <ArtDefs />
      <div className="dk-players">
        {room.players.map((p) => {
          const out = game.out.includes(p.id);
          const hand = game.hand[p.id] ?? [];
          return (
            <div key={p.id} data-pid={p.id} className={`dk-p ${cur === p.id ? 'turn' : ''} ${out ? 'out' : ''} ${(game.streak[p.id] ?? 0) >= 2 ? 'hot' : ''}`} style={{ ['--c' as string]: color(p.id) }}>
              {waitingId === p.id && !out && <span className="your-turn">{p.id === me ? (game.phase === 'auction' ? 'YOUR BID' : game.phase === 'deal' ? 'YOUR CALL' : 'YOUR TURN') : game.phase === 'auction' ? 'BIDDING' : game.phase === 'deal' ? 'DECIDING' : 'TURN'}{timed && ` · ${secs}s`}</span>}
              {waitingId === p.id && timed && <i className={`tbar ${secs <= 5 ? 'low' : ''}`} style={{ ['--t' as string]: tFrac }} />}
              <div className="pav"><Avatar id={p.avatar} size={34} mood={out ? 'sad' : mood(p.id)} hyped={cur === p.id} />{game.jail[p.id] > 0 && <i className="bars" />}</div>
              <div className="dk-pinfo">
                <b>{p.name}{(game.streak[p.id] ?? 0) >= 2 && ' 🔥'}</b>
                <span className="cash">{out ? (game.ghosts?.[p.id] ? <span className="ghost-cash" title="Ghost landlord: tolls collected">👻 {fmt(game.cash[p.id] ?? 0)}</span> : <s>Bankrupt</s>) : fmt(cashShown[p.id] ?? game.cash[p.id])}{!out && stakesOf(game, p.id).length > 0 && <em className="stk" title="City stakes held">📈{stakesOf(game, p.id).length}</em>}{(game.debt?.[p.id] ?? 0) > 0 && !out && <em className="debt" title="Owes Seth-ji">🏦−{short(game.debt![p.id])}</em>}{game.mode === 'sets' && !out && <em className="sets">🏆{fullSets(game, p.id)}/{SETS_TO_WIN}</em>}{game.teams && <em className={`team t${game.teams[p.id]}`} title="Roommates team">{game.teams[p.id] === 0 ? 'A' : 'B'}</em>}</span>
                <span className="pips">{GROUPS.map((g, gi) => {
                  const any = groupSquares(gi).some((k) => game.owner[k] === p.id), full = ownsGroup(game, p.id, gi);
                  return <i key={gi} className={full ? 'full' : any ? 'any' : ''} style={{ ['--g' as string]: g.color }} />;
                })}<em>{game.owner.filter((o) => o === p.id).length} 🏙️</em></span>
              </div>
              {(hand.length > 0 || game.dblArmed[p.id]) && <span className="hand-mini">{hand.map((h, k) => <i key={k}>{POWERS[h].icon}</i>)}{game.dblArmed[p.id] && <i className="armed">💥</i>}</span>}
              {floaters.filter((f) => f.pid === p.id).map((f) => <span key={f.id} className={`floater ${f.good ? 'good' : 'bad'}`}>{f.text}</span>)}
            </div>
          );
        })}
      </div>

      <div className="dk-stage">
        {themeIntro && (
          <div className={`theme-curtain t-${themeIntro}`} key={themeIntro}>
            <i className="cl" /><i className="cr" />
            <b>{themeIntro === 'classic' ? '✨ Classic board' : `${THEMES[themeIntro as ThemeId].emoji} ${THEMES[themeIntro as ThemeId].name} theme`}</b>
            <small>{themeIntro === 'classic' ? 'The festival is over. Back to the campus classic.' : THEMES[themeIntro as ThemeId].tag}</small>
          </div>
        )}
        <div className="dk-scroll" ref={fit.ref}>
          <div className={`dk-board ${themeIntro ? 'theme-in' : ''} geo-${geo.n}x${geo.m} ${teleport ? 'tele-mode' : ''} ${rentBoost(game) > 1 ? 'placement' : ''} ${uc < 30 ? 'tight' : ''}`} style={{ width: fit.w, height: fit.h, ['--u' as string]: `${fit.w / (2 * geo.K + geo.n)}px`, ['--uc' as string]: `${uc}px`, ['--ds' as string]: Math.max(0.42, Math.min(0.8, uc / 52)), gridTemplateColumns: `${geo.K}fr repeat(${geo.n}, 1fr) ${geo.K}fr`, gridTemplateRows: `${geo.K}fr repeat(${geo.m}, 1fr) ${geo.K}fr` }}>
            {theme && <ThemeFx theme={theme} />}
            {BOARD.map((s, i) => {
              const { r, c, side } = cell(i, geo);
              const o = game.owner[i];
              const g = s.group != null ? GROUPS[s.group] : null;
              const ev = evOf(i);
              const teleOk = teleport && s.price && !o;
              const hauntOk = haunting && canHaunt(game, me, i);
              const ghostHere = Object.entries(game.ghosts ?? {}).find(([, x]) => x.sq === i)?.[0];
              const holder = game.stakes?.[i];
              return (
                <button key={i} data-sq={i}
                  className={`dk-sq ${side} k-${s.kind} ${o && s.kind === 'city' && ownsGroup(game, o, s.group!) ? 'fullset' : ''} ${o ? 'owned' : ''} ${o && o === me ? 'mine' : ''} ${game.mort[i] ? 'mort' : ''} ${ev ? (ev.mult > 1 ? 'boom' : 'slump') : ''} ${flash[i] ?? ''} ${here === i ? 'here' : ''} ${teleOk || hauntOk ? 'tele-ok' : ''} ${ghostHere ? 'haunted' : ''}`}
                  style={{ gridRow: r, gridColumn: c, ['--g' as string]: g?.color ?? 'transparent', ['--o' as string]: o ? color(o) : 'transparent', ['--i' as string]: i }}
                  onClick={() => {
                    sfx.tap();
                    if (teleport) { if (teleOk) { act({ t: 'power', p: 'tele', sq: i }); setTeleport(false); } return; }
                    if (haunting) { if (hauntOk) { act({ t: 'haunt', sq: i }); setHaunting(false); } return; }
                    setPeek(i);
                  }}>
                  <TilePic kind={s.kind} name={s.name} />
                  {g && <i className="bar"><Buildings n={game.build[i]} /></i>}
                  <span className="plate"><b className={`nm ${s.short.length > 7 ? 'long' : ''}`}>{s.short}</b>{s.price && !o && <span className="pr">{short(s.price)}</span>}</span>
                  {ev && <i className={`amb ${ev.mult > 1 ? 'spark' : 'rain'}`} />}
                  {ev && <span className="evb">{ev.emoji}<b>×{ev.mult}</b></span>}
                  {o && <span className={`own-badge ${o === me ? 'me' : ''}`} title={`Owned by ${name(o)}`}><Avatar id={avatarOf(o)} size={20} /></span>}
                  {game.mort[i] && <span className="girvi">GIRVI</span>}
                  {holder && <span className="stake-badge" style={{ ['--sc' as string]: color(holder) }} title={`${name(holder)} holds 25%`}>25%</span>}
                  {ghostHere && <span className="ghost-badge" style={{ ['--gc' as string]: color(ghostHere) }} title={`Haunted by ${name(ghostHere)}`}>👻</span>}
                </button>
              );
            })}

            <div className="dk-centre" ref={centre} style={{ gridRow: `2 / ${geo.m + 2}`, gridColumn: `2 / ${geo.n + 2}` }}>
              <div className="dk-brand">
                <b>Dhandha<em>King</em></b>
                <span className="round-chip">R{game.round}{game.maxRounds ? `/${game.maxRounds}` : ''}</span>
                <button className="log-btn" onClick={toggleLog}>📜 Log</button>
                {meIn && giftTargets.length > 0 && <button className="log-btn" onClick={() => { sfx.tap(); setGift({ to: giftTargets[0].id, amount: GIFT_STEP }); }}>💝 Send</button>}
                <button className="log-btn" onClick={() => { sfx.tap(); setRules(true); }}>📖 Rules</button>
                {placementOn(game) && <span className="season">🎓 PLACEMENT SEASON ×1.5</span>}
                {game.season && <span className={`season cal s-${game.season.kind}`}>{SEASONS[game.season.kind].emoji} {SEASONS[game.season.kind].name.toUpperCase()} · {SEASON_SHORT[game.season.kind]} · {game.season.rounds}r</span>}
                {festival && <span className="season festchip">{festival.emoji} {festival.name.toUpperCase()} · {festival.perkText}</span>}
                {game.teams && <span className="season teams">👯 A {short(Math.round(teamWorth(game, 0)))} vs B {short(Math.round(teamWorth(game, 1)))}</span>}
                {game.mode === 'sets' && <span className="season sets">🏆 TEEN SET · first to {SETS_TO_WIN} full sets</span>}
                {mehngaiLevel(game) > 0 && <span className="season">📈 MEHNGAI · RENT {times(rentBoost(game))}</span>}
              </div>
              <div className={`dk-sethbox ${sethAnim}`} data-anchor="banker">
                <SethJi mood={seth.mood} shades={seth.shades} />
                {seth.say && <div className="bubble" key={seth.id}>{seth.say}</div>}
              </div>
              <div className="dk-meters">
                <span className="gullak" data-anchor="pot" title="Tapri gullak">
                  <svg viewBox="0 0 24 24" className="kulhad"><path d="M4 6h16l-2 14H6Z" fill="#c4713a" stroke="#1b1035" strokeWidth="1.4" /><clipPath id="kh"><path d="M4 6h16l-2 14H6Z" /></clipPath><rect x="0" y={20 - 14 * potFill} width="24" height="24" fill="#ffd23f" clipPath="url(#kh)" /><path d="M4 6h16" stroke="#1b1035" strokeWidth="1.4" /></svg>
                  <b>{fmt(game.pot)}</b>
                </span>
                {timed && <span className={`turn-clock ${secs <= 5 ? 'low' : ''}`}>⏱ {waitingId === me ? 'You' : name(waitingId)} · {secs}s</span>}
                {canManage && <button className="log-btn biz" onClick={() => { sfx.tap(); setBiz(true); }}>💼 Dhandha</button>}
                {game.events.map((e) => (
                  <button key={e.id} className={`pill ev ${e.mult > 1 ? 'boom' : 'slump'}`} onClick={() => setPeek(e.sq)}>{e.emoji} {BOARD[e.sq].short} ×{e.mult}·{e.rounds}r</button>
                ))}
              </div>
              <div className={`dk-dice tray ${doubles && settled ? 'doubles' : ''}`}>
                <Dice value={game.dice[0]} rollId={game.rollId} color={color(cur)} skin={room.players.find((p) => p.id === cur)?.skin} ready={ready && game.phase === 'roll'} onRoll={roll} />
                <Dice value={game.dice[1]} rollId={game.rollId} color={color(cur)} skin={room.players.find((p) => p.id === cur)?.skin} ready={ready && game.phase === 'roll'} onRoll={roll} onSettled={() => setSettled(true)} />
                {doubles && settled && <span className="dbl-chip">DOUBLES!</span>}
              </div>
              <div className="dk-note" key={game.note}>{game.note}</div>
              {/* Live log: the latest events stay on the board; tap for the full history. */}
              <ol className="dk-feed" onClick={toggleLog} title="Open the full game log">
                {(game.log ?? []).filter((l) => l.t !== game.note).slice(-4).reverse().map((l, k) => (
                  <li key={l.id} className={k === 0 ? 'new' : ''} style={{ ['--c' as string]: l.pid && room.players.some((p) => p.id === l.pid) ? color(l.pid) : 'rgba(255,255,255,.3)' }}>{l.t}</li>
                ))}
              </ol>
              <div className="dk-actions">
                {game.phase === 'deal' && game.deal ? <span className="dim">🤝 {game.deal.from === me ? `Waiting for ${name(game.deal.to)} to answer…` : game.deal.to === me ? 'You have a deal offer' : `${name(game.deal.to)} is weighing a deal…`}</span>
                  : !mine && game.phase !== 'auction' && <span className="dim">{name(cur)} is thinking…</span>}
                {canBet(game, me) && (game.cash[me] ?? 0) >= BETS.AMOUNTS[0] && <button className="btn shart-btn sm" onClick={() => { sfx.tap(); setBetOpen(true); }}>🎲 Shart lagao</button>}
                {(() => { const b = game.bets?.find((x) => x.pid === me); return b ? <span className="my-bet">🎲 Your shart: {fmt(b.amount)} on {BET_INFO[b.kind].name} ×{b.odds}</span> : null; })()}
                {game.ghosts?.[me] && game.out.includes(me) && (
                  <span className="ghost-bar">👻 Haunting <b>{BOARD[game.ghosts[me].sq].short}</b>
                    {game.round - game.ghosts[me].since >= GHOST.MOVE_EVERY
                      ? <button className={`btn glass xs ${haunting ? 'on' : ''}`} onClick={() => setHaunting(!haunting)}>{haunting ? 'Tap a tile…' : 'Move'}</button>
                      : <small>move in {GHOST.MOVE_EVERY - (game.round - game.ghosts[me].since)}r</small>}
                  </span>
                )}
                {mine && game.phase === 'roll' && (<>
                  {jailed && game.jugaad[me] > 0 && <button className="btn glass sm" onClick={() => act({ t: 'jugaad' })}>🩺 Doctor's Note</button>}
                  {jailed && <button className="btn glass sm" disabled={game.cash[me] < BAIL} onClick={() => act({ t: 'bail' })}>Late fine {fmt(BAIL)}</button>}
                  <button className="btn roll-btn sm" disabled={!settled} onClick={roll}>🎲 Roll{jailed ? ' for doubles' : ''}</button>
                </>)}
                {mine && game.phase === 'end' && <button className="btn roll-btn sm" onClick={() => act({ t: 'end' })}>{game.again ? '🎲 Roll again' : 'End turn ›'}</button>}
                {mine && game.phase === 'moving' && <span className="dim">Moving…</span>}
                {buildHere != null && <button className="btn build-btn sm" onClick={() => act({ t: 'build', sq: buildHere })}>🏠 Build here {fmt(nextBuildCost(game, buildHere))}</button>}
                {buildHere == null && buildable.length > 0 && <button className="btn build-btn sm" onClick={() => setManage(true)}>🏗️ Build ({buildable.length})</button>}
                {buyBackHere != null && <button className="btn buyback-btn sm" onClick={() => act({ t: 'unmortgage', sq: buyBackHere })}>💰 Buy back here {fmt(buyBackPrice(buyBackHere))}</button>}
                {buyBackHere == null && girvi.length > 0 && <button className="btn buyback-btn sm" onClick={() => setManage(true)}>💰 Buy back ({girvi.length})</button>}
                {canManage && myProps.length > 0 && <button className="btn glass sm" onClick={() => setManage(true)}>🃏 My cities ({myProps.length})</button>}
              </div>
              {mine && (myHand.length > 0 || game.dblArmed[me]) && (
                <div className="power-bar">
                  {myHand.map((p, k) => {
                    const usable = (p === 'double' && canManage && !game.dblArmed[me]) || (p === 'tele' && mine && game.phase === 'roll' && !jailed);
                    return (
                      <button key={k} className={`power ${p} ${teleport && p === 'tele' ? 'on' : ''}`} disabled={!usable && p !== 'shield'} title={POWERS[p].text}
                        onClick={() => { if (p === 'double') act({ t: 'power', p: 'double' }); if (p === 'tele') setTeleport(!teleport); }}>
                        <span>{POWERS[p].icon}</span><small>{p === 'shield' ? 'Auto' : p === 'tele' && teleport ? 'Tap a tile' : POWERS[p].name}</small>
                      </button>
                    );
                  })}
                  {game.dblArmed[me] && <span className="power armed"><span>💥</span><small>Armed</small></span>}
                </div>
              )}
            </div>

            {[...bySq.entries()].flatMap(([s, ids]) => ids.map((id, k) => {
              const [x, y] = park(s, k, ids.length, geo);
              return (
                <div key={id} className={`dk-tok ${cur === id ? 'cur' : ''} ${moving === id ? 'moving' : ''}`} style={{ left: `${x}%`, top: `${y}%`, ['--c' as string]: color(id) }}>
                  <div className="tok-in" key={moving === id ? s : 'still'}><Avatar id={avatarOf(id)} size={28} mood={mood(id)} hyped={cur === id} /></div>
                  {game.jail[id] > 0 && <i className="tok-bars" />}
                </div>
              );
            }))}
          </div>
        </div>
        {wide && (
          <aside className={`dk-logside ${logSide ? 'open' : ''}`}>
            <button className="ls-tab" onClick={toggleLog} title={logSide ? 'Hide the log' : 'Show the log'}>{logSide ? '›' : '‹'}<span>📜 Log</span></button>
            {logSide && <><b className="ls-head">📜 Game log</b><LogList log={game.log ?? []} room={room} color={color} /></>}
          </aside>
        )}
        {!wide && !logOpen && <button className="ls-pull" onClick={toggleLog} title="Open the game log">‹ 📜</button>}
      </div>

      {mine && game.phase === 'buy' && sq.price && (() => {
        const owner = game.owner[here];
        const price = owner ? takeoverPrice(here) : buyPrice(game, here);
        const onSale = !owner && price < sq.price;
        return (
          <div className="dk-sheet">
            {owner && <div className="takeover-tag">😈 HOSTILE TAKEOVER · {name(owner)} mortgaged this — grab it for {fmt(price)} ({name(owner)} gets {fmt(price / 2)})</div>}
            <Deed i={here} game={game} name={name} me={me} />
            <div className="row">
              <button className="btn glass" onClick={() => act({ t: 'pass' })}>{owner ? 'Skip' : 'Pass → Bolee 🔨'}</button>
              <button className="btn premium" disabled={game.cash[me] < price} onClick={() => act({ t: 'buy' })}>{owner ? '😈 Take over' : '🏷️ Buy'} for {onSale && <s className="was">{fmt(sq.price)}</s>} {fmt(price)}</button>
            </div>
            {game.cash[me] < price && <small className="dim">Not enough cash — you have {fmt(game.cash[me])}</small>}
          </div>
        );
      })()}

      {game.phase === 'auction' && game.auction && (() => {
        const a = game.auction;
        const head = a.queue[0];
        return (
          <div className="dk-sheet auction">
            <div className="auc-head"><span className="gavel">🔨</span><div><b>Seth-ji’s Bolee</b><small>{BOARD[a.sq].name} · list price {fmt(BOARD[a.sq].price!)}</small></div></div>
            <div className="auc-row">
              <TilePic kind={BOARD[a.sq].kind} name={BOARD[a.sq].name} className="auc-art" />
              <div className="auc-bid">
                <small>Highest bid</small>
                <b key={a.price}>{a.leader ? fmt(a.price) : '—'}</b>
                <span>{a.leader ? `by ${name(a.leader)}` : `opens at ${fmt(a.next)}`}</span>
              </div>
            </div>
            <div className="auc-queue">{a.queue.map((id) => <span key={id} className={id === head ? 'now' : ''} style={{ ['--c' as string]: color(id) }}><Avatar id={avatarOf(id)} size={22} />{name(id)}</span>)}</div>
            {timed && <span className={`turn-clock ${secs <= 5 ? 'low' : ''}`}>⏱ {head === me ? 'Your bid' : name(head)} · {secs}s</span>}
            {head === me && me === cur && <small className="dim">You passed at full price, but you can still win it here.</small>}
            {head === me ? (
              <div className="row">
                <button className="btn glass" onClick={() => act({ t: 'out' })}>I’m out</button>
                <button className="btn premium" disabled={game.cash[me] < a.next} onClick={() => act({ t: 'bid' })}>Bid {fmt(a.next)}</button>
              </div>
            ) : <small className="dim">{name(head)} is deciding…</small>}
          </div>
        );
      })()}

      {game.phase === 'card' && game.card && <FortuneCard card={game.card} mine={mine} who={name(cur)} onOk={() => act({ t: 'cardOk' })} />}

      {(game.phase === 'spin' || wheel) && <SpinWheel result={wheel?.spun ? wheel.idx : null} canSpin={mine && game.phase === 'spin'} who={name(cur)} pot={game.pot} onSpin={() => act({ t: 'spin' })} />}

      {/* Big cards (city events, full sets) are modal; small toasts stack so two at once never overlap. */}
      {pops.filter((p) => MODAL_POPS.has(p.kind)).map((p) => <PopUp key={p.id} p={p} name={name} color={color} game={game} onClose={() => setPops((l) => l.filter((x) => x.id !== p.id))} />)}
      <div className="toast-stack">
        {pops.filter((p) => !MODAL_POPS.has(p.kind)).map((p) => <PopUp key={p.id} p={p} name={name} color={color} game={game} onClose={() => setPops((l) => l.filter((x) => x.id !== p.id))} />)}
      </div>

      {peek !== null && !manage && (
        <div className="dk-sheet peek" onClick={() => setPeek(null)}>
          <Deed i={peek} game={game} name={name} me={me} />
          {canManage && canStake(game, me, peek) && (
            <button className="btn premium" onClick={(e) => { e.stopPropagation(); act({ t: 'stake', sq: peek }); setPeek(null); }}>
              📈 Buy 25% of {BOARD[peek].short} · {fmt(stakePrice(game, peek))}
            </button>
          )}
          <small className="dim">Tap anywhere to close</small>
        </div>
      )}

      {rules && <DhandhaGuide start="rules" onClose={() => setRules(false)} />}
      {dealOpen && canManage && <DealSheet game={game} me={me} targets={giftTargets} color={color} name={name} onClose={() => setDealOpen(false)} onSend={(a) => { act(a); setDealOpen(false); }} />}
      {loanOpen && canManage && <LoanSheet game={game} me={me} onClose={() => setLoanOpen(false)} act={act} />}
      {biz && canManage && (
        <div className="dk-manage" onClick={() => setBiz(false)}>
          <div className="card dk-biz" onClick={(e) => e.stopPropagation()}>
            <div className="row-between"><b>💼 Dhandha</b><button className="btn ghost xs" onClick={() => setBiz(false)}>✕</button></div>
            <div className="biz-grid">
              <button disabled={!giftTargets.length} onClick={() => { setBiz(false); setDealOpen(true); }}><span>🤝</span><b>Deal</b><small>Swap cities and cash</small></button>
              <button onClick={() => { setBiz(false); setStakesOpen(true); }}><span>📈</span><b>Stakes</b><small>Own 25% of someone's rent</small></button>
              <button disabled={!myProps.length} onClick={() => { setBiz(false); setManage(true); }}><span>🏷️</span><b>Sell a city</b><small>To a friend or Seth-ji</small></button>
              <button onClick={() => { setBiz(false); setLoanOpen(true); }}><span>🏦</span><b>Loan</b><small>Borrow from Seth-ji</small></button>
            </div>
          </div>
        </div>
      )}
      {stakesOpen && canManage && <StakesSheet game={game} me={me} name={name} color={color} onClose={() => setStakesOpen(false)} act={act} />}
      {betOpen && canBet(game, me) && <BetSheet game={game} me={me} roller={name(cur)} onClose={() => setBetOpen(false)} act={(a) => { act(a); setBetOpen(false); }} />}
      {counterOpen && game.phase === 'deal' && game.deal?.to === me && !game.deal.counter && (
        <DealSheet game={game} me={me} targets={giftTargets.filter((p) => p.id === game.deal!.from)} color={color} name={name} counter={game.deal}
          onClose={() => setCounterOpen(false)} onSend={(a) => { act(a); setCounterOpen(false); }} />
      )}
      {game.phase === 'deal' && game.deal?.to === me && (
        <div className="dk-manage">
          <div className="card dk-deal in">
            <b>{game.deal.counter ? `🔁 ${name(game.deal.from)} sends a counter-offer` : game.deal.sale ? `🏷️ ${name(game.deal.from)} wants to sell you a city` : `🤝 ${name(game.deal.from)} offers you a deal`}</b>
            <DealView d={game.deal} me={me} name={name} />
            {[...game.deal.give, ...game.deal.get].length > 0 && <small className="dim">Market value: {[...game.deal.give, ...game.deal.get].map((k) => `${BOARD[k].short} ${fmt(marketValue(game, k))}`).join(' · ')}</small>}
            {timed && <span className={`turn-clock ${secs <= 5 ? 'low' : ''}`}>⏱ {secs}s to decide</span>}
            <div className="row">
              <button className="btn glass" onClick={() => act({ t: 'dealNo' })}>No thanks</button>
              {!game.deal.counter && <button className="btn glass" onClick={() => setCounterOpen(true)}>🔁 Counter</button>}
              <button className="btn premium" disabled={game.deal.cash < 0 && game.cash[me] < -game.deal.cash} onClick={() => act({ t: 'dealYes' })}>Deal ✓</button>
            </div>
          </div>
        </div>
      )}

      {gift && (() => {
        const cash = game.cash[me] ?? 0;
        // Gifts go in steps of ₹500, from ₹500 up to as much of your cash as fits.
        const maxGift = Math.floor(cash / GIFT_STEP) * GIFT_STEP;
        const amount = Math.max(0, Math.min(gift.amount, maxGift));
        const snap = (v: number) => Math.max(GIFT_STEP, Math.min(maxGift, Math.round(v / GIFT_STEP) * GIFT_STEP));
        const sendAmt = maxGift >= GIFT_STEP ? snap(gift.amount) : 0; // a typed odd amount is sent rounded to ₹500
        const target = giftTargets.find((p) => p.id === gift.to) ?? giftTargets[0];
        return (
          <div className="dk-manage" onClick={() => setGift(null)}>
            <div className="card dk-gift" onClick={(e) => e.stopPropagation()}>
              <div className="row-between"><b>💝 Send money</b><button className="btn ghost xs" onClick={() => setGift(null)}>✕</button></div>
              <small className="dim">You have {fmt(cash)}. Seth-ji takes no commission 😇</small>
              <div className="gift-to">
                {giftTargets.map((p) => (
                  <button key={p.id} className={target?.id === p.id ? 'on' : ''} style={{ ['--c' as string]: color(p.id) }} onClick={() => setGift({ ...gift, to: p.id })}>
                    <Avatar id={p.avatar} size={34} /><b>{p.name}</b><small>{fmt(game.cash[p.id] ?? 0)}</small>
                  </button>
                ))}
              </div>
              {maxGift < GIFT_STEP ? <small className="dim">You need at least {fmt(GIFT_STEP)} to send money.</small> : (<>
                <div className="gift-slider">
                  <input type="range" min={GIFT_STEP} max={maxGift} step={GIFT_STEP} value={amount || GIFT_STEP} aria-label="Amount"
                    onChange={(e) => setGift({ ...gift, amount: Number(e.target.value) })} />
                  <div className="ends"><span>{fmt(GIFT_STEP)}</span><span>{fmt(maxGift)}</span></div>
                </div>
                <div className="gift-row">
                  <button className="btn glass sm" disabled={amount <= GIFT_STEP} onClick={() => setGift({ ...gift, amount: snap(amount - GIFT_STEP) })}>−₹500</button>
                  <input className="gift-input" type="number" min={GIFT_STEP} max={maxGift} step={GIFT_STEP} value={gift.amount || ''} aria-label="Amount in rupees"
                    onChange={(e) => setGift({ ...gift, amount: Math.floor(Number(e.target.value) || 0) })}
                    onBlur={() => setGift({ ...gift, amount: snap(gift.amount) })} />
                  <button className="btn glass sm" disabled={amount >= maxGift} onClick={() => setGift({ ...gift, amount: snap(amount + GIFT_STEP) })}>+₹500</button>
                </div>
                {gift.amount % GIFT_STEP !== 0 && <small className="dim">Amounts go in steps of {fmt(GIFT_STEP)}; it will round to {fmt(snap(gift.amount))}.</small>}
              </>)}
              <button className="btn premium" disabled={!target || sendAmt < GIFT_STEP || sendAmt > cash}
                onClick={() => { if (target) { act({ t: 'gift', to: target.id, amount: sendAmt }); setGift(null); } }}>
                Send {fmt(sendAmt)} to {target?.name ?? '…'}
              </button>
            </div>
          </div>
        );
      })()}

      {logOpen && !wide && (
        <div className="dk-drawer-ov" onClick={() => setLogOpen(false)}>
          <div className="dk-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="row-between"><b>📜 Game log</b><button className="btn ghost xs" onClick={() => setLogOpen(false)}>›</button></div>
            <LogList log={game.log ?? []} room={room} color={color} />
          </div>
        </div>
      )}

      {manage && (
        <div className="dk-manage" onClick={() => setManage(false)}>
          <div className="card hand" onClick={(e) => e.stopPropagation()}>
            <div className="row-between"><b>🃏 My cities · {fmt(game.cash[me])}</b><button className="btn ghost xs" onClick={() => setManage(false)}>✕</button></div>
            <div className="set-progress">
              {GROUPS.map((g, gi) => ({ g, have: groupSquares(gi).filter((k) => game.owner[k] === me).length, need: groupSquares(gi).length }))
                .filter((x) => x.have > 0)
                .map(({ g, have, need }) => <span key={g.name} className={have === need ? 'full' : ''} style={{ ['--g' as string]: g.color }}>{have === need ? '✓ ' : ''}{g.name} {have}/{need}</span>)}
            </div>
            <small className="dim">{!canManage ? 'You can build, mortgage or sell on your own turn. ' : buildable.length ? `You can build on ${buildable.length} cit${buildable.length > 1 ? 'ies' : 'y'} now (glowing). ` : ''}Own every city of a colour, none mortgaged, to build: 3 houses → hotel → villa. Net worth {fmt(netWorth(game, me))}</small>
            <div className="hand-row">
              {[...myProps].sort((a, b) => (Number(buildable.includes(b)) * 2 + Number(game.mort[b])) - (Number(buildable.includes(a)) * 2 + Number(game.mort[a]))).map((i) => {
                const s = BOARD[i], g = s.group != null ? GROUPS[s.group] : null;
                const full = g && ownsGroup(game, me, s.group!);
                return (
                  <div key={i} className={`hcard ${game.mort[i] ? 'mort' : ''} ${buildable.includes(i) ? 'can-build' : ''}`} style={{ ['--g' as string]: g?.color ?? '#9b6bff' }}>
                    <div className="hc-art"><TilePic kind={s.kind} name={s.name} /><b>{s.name}</b></div>
                    <div className="hc-mid">
                      <small className="dim">{s.kind === 'city' ? MONUMENTS[s.name]?.label : s.kind === 'train' ? 'Transport' : 'Utility'}</small>
                      {g && <div className="hc-build"><Buildings n={game.build[i]} /><small>{BUILD_LEVELS[game.build[i]]}</small></div>}
                      <div className="hc-rent">Rent now <b>{fmt(rentFor(game, i, 7))}</b></div>
                      <MarketLine game={game} sq={i} />
                      {game.stakes?.[i] && <small className="stake-t">📈 {name(game.stakes[i])} holds 25% of the rent</small>}
                      {g && !full && <small className="dim">Collect all {groupSquares(s.group!).length} {g.name} cities to build</small>}
                      {game.mort[i] && <small className="girvi-t">GIRVI · mortgaged</small>}
                    </div>
                    <div className="hc-actions">
                      {g && game.build[i] < MAX_BUILD && <button className="btn primary xs" disabled={!canManage || !canBuild(game, me, i)} onClick={() => act({ t: 'build', sq: i })}>+ {BUILD_LEVELS[game.build[i] + 1].replace(/^\d /, '')} {fmt(nextBuildCost(game, i))}</button>}
                      {game.build[i] > 0 && <button className="btn glass xs" disabled={!canManage} onClick={() => act({ t: 'sell', sq: i })}>Sell building</button>}
                      {!game.build[i] && (game.mort[i]
                        ? <button className="btn buyback-btn xs" disabled={!canManage || game.cash[me] < buyBackPrice(i)} onClick={() => act({ t: 'unmortgage', sq: i })}>💰 Buy back {fmt(buyBackPrice(i))}</button>
                        : <button className="btn ghost xs" disabled={!canManage} onClick={() => act({ t: 'mortgage', sq: i })}>Mortgage +{fmt(s.price! / 2)}</button>)}
                      {game.stakes?.[i] && <button className="btn glass xs" disabled={!canManage || game.cash[me] < buyoutPrice(game, i)} onClick={() => act({ t: 'buyout', sq: i })}>💼 Buy back 25% · {fmt(buyoutPrice(game, i))}</button>}
                      <button className="btn sell xs" disabled={!canManage} onClick={() => setSellSq(i)}>🏷️ Sell · {short(marketValue(game, i))}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* after My cities, so it opens on top of it */}
      {sellSq != null && canManage && game.owner[sellSq] === me && (
        <SellSheet game={game} me={me} sq={sellSq} targets={giftTargets} color={color} onClose={() => setSellSq(null)} act={(a) => { act(a); setSellSq(null); setManage(false); }} />
      )}
    </div>
  );
}

// ---------------- Tapri spin wheel ----------------
function SpinWheel({ result, canSpin, who, pot, onSpin }: { result: number | null; canSpin: boolean; who: string; pot: number; onSpin(): void }) {
  const seg = 360 / WHEEL.length;
  const [turns] = useState(() => 4 + Math.floor(Math.random() * 2));
  const angle = result == null ? 0 : turns * 360 - (result * seg + seg / 2);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (result == null) return;
    sfx.roll();
    const t = setTimeout(() => { setDone(true); sfx.six(); }, 2300);
    return () => clearTimeout(t);
  }, [result]);
  return (
    <div className="wheel-ov">
      <div className="wheel-card">
        <small>☕ TAPRI JACKPOT · gullak {fmt(pot)}</small>
        <div className="wheel-wrap">
          <i className="wheel-pin" />
          <svg viewBox="-110 -110 220 220" className="wheel" style={{ transform: `rotate(${angle}deg)`, transition: result == null ? 'none' : 'transform 2.3s cubic-bezier(.17,.67,.12,1)' }}>
            {WHEEL.map((w, k) => {
              const a0 = (k * seg - 90) * Math.PI / 180, a1 = ((k + 1) * seg - 90) * Math.PI / 180;
              const mid = ((k + 0.5) * seg - 90);
              return (
                <g key={k}>
                  <path d={`M0 0L${100 * Math.cos(a0)} ${100 * Math.sin(a0)}A100 100 0 0 1 ${100 * Math.cos(a1)} ${100 * Math.sin(a1)}Z`} fill={w.color} stroke="#1b1035" strokeWidth="2" />
                  <text transform={`rotate(${mid}) translate(62 0) rotate(90)`} textAnchor="middle" fontSize="11" fontWeight="900" fill="#1b1035">{w.label}</text>
                </g>
              );
            })}
            <circle r="16" fill="#fffaf0" stroke="#1b1035" strokeWidth="3" /><text y="5" textAnchor="middle" fontSize="14">☕</text>
          </svg>
        </div>
        {result != null && done ? <b className="wheel-result">{WHEEL[result].label}!</b>
          : canSpin ? <button className="btn roll-btn" onClick={onSpin}>🎡 SPIN</button>
          : <span className="dim">{result != null ? 'Spinning…' : `${who} is spinning…`}</span>}
      </div>
    </div>
  );
}

// ---------------- Plot Twist / Group Chat card ----------------
function cardArt(c: Card): { pic: string; tone: 'good' | 'bad' | 'move' } {
  const f = c.fx;
  if (f.t === 'cash') return f.amount > 0 ? { pic: '💰', tone: 'good' } : { pic: '🧾', tone: 'bad' };
  if (f.t === 'each') return f.amount > 0 ? { pic: '🎁', tone: 'good' } : { pic: '🎂', tone: 'bad' };
  if (f.t === 'goto' || f.t === 'back') return { pic: f.t === 'back' ? '🚇' : '✈️', tone: 'move' };
  if (f.t === 'jail') return { pic: '🚨', tone: 'bad' };
  if (f.t === 'free') return { pic: '🩺', tone: 'good' };
  return { pic: '🧹', tone: 'bad' };
}

function FortuneCard({ card, mine, who, onOk }: { card: Card; mine: boolean; who: string; onOk(): void }) {
  const { pic, tone } = cardArt(card);
  const f = card.fx;
  const amount = f.t === 'cash' ? f.amount : f.t === 'each' ? f.amount : null;
  const twist = card.deck === 'kismat';
  return (
    <div className="dk-card-ov">
      <div className="deck-stack"><i /><i /><i /></div>
      <div className={`fcard ${card.deck} t-${tone}`}>
        <div className="fc-inner">
          <div className="fc-head">
            <span className="fc-deck">{twist ? '🌀 PLOT TWIST' : '💬 GROUP CHAT'}</span>
            <span className="fc-corner">{twist ? '✨' : '🔔'}</span>
          </div>
          <div className="fc-art"><span>{pic}</span></div>
          <h3>{card.title}</h3>
          <p>{card.text}</p>
          {amount != null && <div className={`fc-amt ${amount > 0 ? 'up' : 'down'}`}>{amount > 0 ? '+' : '−'}{fmt(Math.abs(amount))}{f.t === 'each' ? ' each' : ''}</div>}
          {card.power && <div className="fc-bonus">+ a random power-up ⚡</div>}
          {mine ? <button className="btn primary" onClick={onOk}>{tone === 'good' ? 'Collect 🤑' : tone === 'bad' ? 'Okay 😩' : 'Let’s go 🚀'}</button> : <span className="dim">{who} drew this</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------- pop-ups ----------------
function PopUp({ p, name, color, game, onClose }: { p: Pop; name(id: string): string; color(id: string): string; game: DGame; onClose(): void }) {
  const s = p.sq != null ? BOARD[p.sq] : null;
  const g = s?.group != null ? GROUPS[s.group] : null;
  if (p.kind === 'event' && p.ev && s) {
    const boom = p.ev.mult > 1;
    return (
      <div className={`evpop ${boom ? 'boom' : 'slump'}`} onClick={onClose} style={{ ['--g' as string]: g?.color ?? '#ff8c42' }}>
        <div className="evp-card">
          <small>{boom ? '📈 CITY TRENDING' : '📉 CITY SLUMP'}</small>
          <div className="evp-art"><TilePic kind="city" name={s.name} className="evp-mon" /><span className="evp-emoji">{p.ev.emoji}</span></div>
          <h3>{p.ev.title} in {s.name}!</h3>
          <p>{p.ev.reason}.</p>
          <div className="evp-rule">Rent <b>×{p.ev.mult}</b> for <b>{p.ev.rounds} rounds</b>{game.owner[p.sq!] ? <> · good news for <b>{name(game.owner[p.sq!]!)}</b></> : <> · still for sale!</>}</div>
        </div>
      </div>
    );
  }
  if (p.kind === 'eventEnd') return <div className="toast-pop">The buzz in {s?.name} is over — rent back to normal</div>;
  if (p.kind === 'placement') return p.other === 'mehngai'
    ? <div className="toast-pop gold big">📈 MEHNGAI! Every rent is now {times(p.amount ?? 1)}</div>
    : <div className="toast-pop gold big">🎓 PLACEMENT SEASON — every rent ×1.5 till the end!</div>;
  if (p.kind === 'gift') return p.amount === -1 ? <div className="toast-pop gold">🤝 Deal done: {name(p.pid)} ⇄ {name(p.other ?? '')}</div> : <div className="toast-pop gold">💝 {name(p.pid)} sent {fmt(p.amount ?? 0)} to {name(p.other ?? '')}</div>;
  if (p.kind === 'stake') return <div className="toast-pop gold">📈 {name(p.pid)} bought 25% of {s?.name} from {name(p.other ?? '')} for {fmt(p.amount ?? 0)}</div>;
  if (p.kind === 'haunt') return <div className="toast-pop ghost">👻 {name(p.pid)} now haunts {s?.name}: {fmt(GHOST.TOLL)} toll to land there</div>;
  if (p.kind === 'counter') return <div className="toast-pop">🔁 {name(p.pid)} sends {name(p.other ?? '')} a counter-offer</div>;
  if (p.kind === 'season') { const se = SEASONS[p.other as SeasonKind]; return se ? <div className="toast-pop">{se.emoji} {se.name} is over</div> : null; }
  if (p.kind === 'catchup') return p.other === 'bonus'
    ? <div className="toast-pop gold">🎒 Backbencher Bonus! {name(p.pid)} gets {fmt(p.amount ?? 0)} to catch up</div>
    : <div className="toast-pop">🎓 Topper Tax: {name(p.pid)} pays {fmt(p.amount ?? 0)} into the gullak</div>;
  if (p.kind === 'shield') return <div className="toast-pop">🛡️ {name(p.pid)}’s Rent Shield blocked {fmt(p.amount ?? 0)} from {name(p.other ?? '')}!</div>;
  if (p.kind === 'takeover') return <div className="toast-pop gold">😈 {name(p.pid)} took over {s?.name} from {name(p.other ?? '')}!</div>;
  if (p.kind === 'auctionWin') return <div className="toast-pop gold">🔨 SOLD! {s?.name} → {name(p.pid)} for {fmt(p.amount ?? 0)}</div>;
  if (p.kind === 'set' && s) return (
    <div className="evpop boom set" onClick={onClose} style={{ ['--g' as string]: g?.color ?? '#ffd23f' }}>
      <div className="evp-card"><small>👑 FULL SET</small><h3>{name(p.pid)} owns all of {g?.name}!</h3>
        <div className="set-row">{groupSquares(s.group!).map((k) => <TilePic key={k} kind="city" name={BOARD[k].name} className="set-mon" />)}</div>
        <p>Rent doubles here — and now you can build houses, a hotel and a villa.</p></div>
    </div>
  );
  if (p.kind === 'villa') return <div className="toast-pop gold">🏰 {name(p.pid)} built a VILLA in {s?.name}! Rent ×90</div>;
  if (!s) return null;
  const msg: Record<string, string> = {
    tax: `${s.name}! ${fmt(p.amount ?? 0)} goes into the Tapri gullak ☕`,
    police: 'Proxy pakdi gayi! Straight to Detention 🚨',
    jail: 'Just walking past Detention 😅',
  };
  return (
    <div className="landpop" style={{ ['--c' as string]: color(p.pid) }}>
      <TilePic kind={s.kind} name={s.name} className="lp-pic" />
      <span>{msg[s.kind] ?? s.name}</span>
    </div>
  );
}

// ---------------- deed ----------------
function Deed({ i, game, name, me }: { i: number; game: DGame; name(pid: string): string; me: string }) {
  const s = BOARD[i], g = s.group != null ? GROUPS[s.group] : null, o = game.owner[i];
  const base = s.rent ?? 0;
  const ev = game.events.find((e) => e.sq === i);
  return (
    <div className="deed v3" style={{ ['--g' as string]: g?.color ?? '#9b6bff' }}>
      <div className="deed-art">
        <TilePic kind={s.kind} name={s.name} />
        {s.kind === 'city' && <span className="deed-label">{MONUMENTS[s.name]?.label}</span>}
        {s.price && <span className="deed-price">{fmt(s.price)}</span>}
      </div>
      <div className="deed-title"><b>{s.name}</b><small>{g ? g.name : s.kind === 'train' ? 'Transport' : s.kind === 'utility' ? 'Utility' : 'Special tile'}</small></div>
      {s.flavour && <p className="deed-flav">“{s.flavour}”</p>}
      {s.price && <div className="deed-mkt">📊 Market value <MarketLine game={game} sq={i} bare /></div>}
      {game.stakes?.[i] && <div className="deed-mkt">📈 <b>{name(game.stakes[i])}</b> holds 25% of this rent</div>}
      {Object.entries(game.ghosts ?? {}).filter(([, x]) => x.sq === i).map(([id]) => <div key={id} className="deed-mkt ghost">👻 Haunted by <b>{name(id)}</b>: {fmt(GHOST.TOLL)} toll to land here</div>)}
      {s.price && rentBoost(game) > 1 && <div className="deed-ev boom">📈 {placementOn(game) ? 'Placement Season' : 'Mehngai'}: every rent {times(rentBoost(game))} right now</div>}
      {ev && <div className={`deed-ev ${ev.mult > 1 ? 'boom' : 'slump'}`}>{ev.emoji} {ev.title}: rent ×{ev.mult} for {ev.rounds} more round{ev.rounds > 1 ? 's' : ''}</div>}
      {s.kind === 'city' && (
        <div className="ladder">
          <div><span>Empty plot</span><b>{fmt(base)}</b></div>
          <div><span>👑 Full colour set</span><b>{fmt(base * 2)}</b></div>
          {[1, 2, 3, 4, 5].map((n) => <div key={n} className={game.build[i] === n ? 'now' : ''}><span><Buildings n={n} /> {BUILD_LEVELS[n]}</span><b>{fmt(base * RENT_MULT[n])}</b></div>)}
          <div className="cost"><span>Build: house · hotel · villa</span><b>{fmt(g!.build)} · {fmt(g!.build * 1.5)} · {fmt(g!.build * 2)}</b></div>
        </div>
      )}
      {s.kind === 'train' && <p>Rent {fmt(250)} · {fmt(500)} · {fmt(1000)} · {fmt(2000)} if the owner has 1–4 transport tiles.</p>}
      {s.kind === 'utility' && <p>Rent is 40× the dice — or 100× if the owner has both WiFi and Recharge.</p>}
      {s.kind === 'start' && <p>Collect ₹2,000 salary every time you pass.</p>}
      {s.kind === 'chai' && <p>Spin the Tapri wheel: full gullak, half gullak, ₹500, a power-up, a free house — or Seth-ji keeps it.</p>}
      {s.kind === 'jail' && <p>Leave by rolling doubles, paying the ₹500 late fine, or a Doctor’s Note. After 3 tries you pay and leave.</p>}
      {(s.kind === 'kismat' || s.kind === 'parivaar') && <p>Draw a {s.name} card.</p>}
      {s.price && <div className="deed-foot">{o ? <>{o === me ? <b className="yours">✅ You own this</b> : <>Owned by <b>{name(o)}</b></>}{game.mort[i] && (o === me ? ` · GIRVI — buy it back for ${fmt(buyBackPrice(i))} from My cities before someone takes it over` : ' · GIRVI (mortgaged) — open to hostile takeover')}</> : <>For sale from Seth-ji · pass and it goes to Bolee 🔨</>}</div>}
      {g && <div className="deed-set">{groupSquares(s.group!).map((k) => <span key={k} className={game.owner[k] ? 'own' : ''}>{BOARD[k].short}</span>)}</div>}
    </div>
  );
}

// ---------------- city deals ----------------
const CityChip = ({ sq, on, onClick }: { sq: number; on?: boolean; onClick?(): void }) => {
  const s = BOARD[sq], g = s.group != null ? GROUPS[s.group] : null;
  return (
    <button className={`city-chip ${on ? 'on' : ''}`} style={{ ['--g' as string]: g?.color ?? '#9b6bff' }} onClick={onClick} disabled={!onClick}>
      <i /><b>{s.short}</b><small>{short(s.price!)}</small>
    </button>
  );
};

function DealView({ d, me, name }: { d: Deal; me: string; name(id: string): string }) {
  const iFrom = d.from === me;
  const getCities = iFrom ? d.get : d.give, giveCities = iFrom ? d.give : d.get;
  const cashIn = iFrom ? -d.cash : d.cash;
  return (
    <div className="deal-view">
      <div><small>You get</small>{getCities.map((sq) => <CityChip key={sq} sq={sq} />)}{cashIn > 0 && <span className="cash-chip">+{fmt(cashIn)}</span>}{!getCities.length && cashIn <= 0 && <span className="dim">nothing</span>}</div>
      <span className="swap">⇄</span>
      <div><small>You give {iFrom ? name(d.to) : name(d.from)}</small>{giveCities.map((sq) => <CityChip key={sq} sq={sq} />)}{cashIn < 0 && <span className="cash-chip out">{fmt(-cashIn)}</span>}{!giveCities.length && cashIn >= 0 && <span className="dim">nothing</span>}</div>
    </div>
  );
}

function DealSheet({ game, me, targets, color, name, onClose, onSend, counter }: {
  game: DGame; me: string; targets: { id: string; name: string; avatar: string }[]; color(id: string): string; name(id: string): string; onClose(): void; onSend(a: DAction): void;
  /** Answering this deal with new terms instead of starting a fresh one. */
  counter?: Deal;
}) {
  const [to, setTo] = useState(counter?.from ?? targets[0]?.id ?? '');
  const [give, setGive] = useState<number[]>(counter ? [...counter.get] : []);
  const [get, setGet] = useState<number[]>(counter ? [...counter.give] : []);
  const [cash, setCash] = useState(counter ? -counter.cash : 0);
  const STEP = counter?.sale ? MARKET.STEP : GIFT_STEP;
  const tradable = (who: string) => BOARD.map((_, i) => i).filter((i) => game.owner[i] === who && !game.build[i]);
  const toggle = (list: number[], set: (l: number[]) => void, sq: number) => set(list.includes(sq) ? list.filter((x) => x !== sq) : list.length < DEAL_MAX ? [...list, sq] : list);
  const maxPay = Math.floor((game.cash[me] ?? 0) / STEP) * STEP, maxAsk = Math.floor((game.cash[to] ?? 0) / STEP) * STEP;
  const ok = !!to && (give.length > 0 || cash > 0) && (get.length > 0 || cash < 0);
  return (
    <div className="dk-manage" onClick={onClose}>
      <div className="card dk-deal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between"><b>{counter ? `🔁 Counter-offer to ${name(to)}` : '🤝 Make a deal'}</b><button className="btn ghost xs" onClick={onClose}>✕</button></div>
        <small className="dim">{counter ? 'Change the cities or the cash and send it back. After a counter it is a straight yes or no.' : `Swap cities and cash with another player. Cities with buildings can't be traded. Up to ${DEAL_MAX} cities each side.`}</small>
        {!counter && <div className="gift-to">
          {targets.map((p) => (
            <button key={p.id} className={to === p.id ? 'on' : ''} style={{ ['--c' as string]: color(p.id) }} onClick={() => { setTo(p.id); setGet([]); setCash(0); }}>
              <Avatar id={p.avatar} size={30} /><b>{p.name}</b><small>{fmt(game.cash[p.id] ?? 0)}</small>
            </button>
          ))}
        </div>}
        <div className="deal-cols">
          <div><small>You give</small><div className="chips">{tradable(me).map((sq) => <CityChip key={sq} sq={sq} on={give.includes(sq)} onClick={() => toggle(give, setGive, sq)} />)}{!tradable(me).length && <span className="dim">No cities to trade</span>}</div></div>
          <div><small>You want from {name(to)}</small><div className="chips">{tradable(to).map((sq) => <CityChip key={sq} sq={sq} on={get.includes(sq)} onClick={() => toggle(get, setGet, sq)} />)}{!tradable(to).length && <span className="dim">No cities to trade</span>}</div></div>
        </div>
        <div className="gift-slider">
          <input type="range" min={-maxAsk} max={maxPay} step={STEP} value={Math.max(-maxAsk, Math.min(maxPay, cash))} aria-label="Cash in the deal" onChange={(e) => setCash(Number(e.target.value))} />
          <div className="ends"><span>{name(to)} pays you {fmt(maxAsk)}</span><b>{cash > 0 ? `You pay ${fmt(cash)}` : cash < 0 ? `${name(to)} pays you ${fmt(-cash)}` : 'No cash'}</b><span>You pay {fmt(maxPay)}</span></div>
        </div>
        <button className="btn premium" disabled={!ok} onClick={() => onSend(counter ? { t: 'dealCounter', give, get, cash } : { t: 'deal', to, give, get, cash })}>{counter ? 'Send the counter-offer' : 'Offer the deal'}</button>
      </div>
    </div>
  );
}

// ---------------- Seth-ji loans ----------------
function LoanSheet({ game, me, onClose, act }: { game: DGame; me: string; onClose(): void; act(a: DAction): void }) {
  const owe = game.debt?.[me] ?? 0, room = loanRoom(game, me), cash = game.cash[me] ?? 0;
  const [borrow, setBorrow] = useState(Math.min(LOAN.STEP, room));
  const maxRepay = Math.min(owe, cash);
  const [repay, setRepay] = useState(Math.min(maxRepay, 1000));
  return (
    <div className="dk-manage" onClick={onClose}>
      <div className="card dk-loan" onClick={(e) => e.stopPropagation()}>
        <div className="row-between"><b>🏦 Seth-ji's loans</b><button className="btn ghost xs" onClick={onClose}>✕</button></div>
        <small className="dim">Borrow up to {fmt(LOAN.LIMIT)} at {LOAN.RATE * 100}% interest. Every Payday repays {fmt(LOAN.PAYDAY)} automatically. If you can't pay a bill, Seth-ji lends before your buildings get sold.</small>
        <div className="loan-stat"><span>You owe</span><b>{fmt(owe)}</b><span>Can still borrow</span><b>{fmt(room)}</b></div>
        {room >= LOAN.STEP && (<>
          <div className="gift-slider">
            <input type="range" min={LOAN.STEP} max={room} step={LOAN.STEP} value={Math.min(borrow, room)} aria-label="Borrow" onChange={(e) => setBorrow(Number(e.target.value))} />
            <div className="ends"><span>{fmt(LOAN.STEP)}</span><span>{fmt(room)}</span></div>
          </div>
          <button className="btn premium" onClick={() => { act({ t: 'loan', amount: Math.min(borrow, room) }); onClose(); }}>Borrow {fmt(Math.min(borrow, room))} · repay {fmt(Math.round(Math.min(borrow, room) * (1 + LOAN.RATE)))}</button>
        </>)}
        {owe > 0 && maxRepay > 0 && (<>
          <div className="gift-slider">
            <input type="range" min={Math.min(500, maxRepay)} max={maxRepay} step={maxRepay < 500 ? 1 : 500} value={Math.min(Math.max(repay, Math.min(500, maxRepay)), maxRepay)} aria-label="Repay" onChange={(e) => setRepay(Number(e.target.value))} />
            <div className="ends"><span>{fmt(Math.min(500, maxRepay))}</span><span>{fmt(maxRepay)}</span></div>
          </div>
          <div className="row">
            <button className="btn glass" onClick={() => { act({ t: 'repay', amount: Math.min(Math.max(repay, Math.min(500, maxRepay)), maxRepay) }); onClose(); }}>Repay {fmt(Math.min(Math.max(repay, Math.min(500, maxRepay)), maxRepay))}</button>
            {maxRepay === owe && <button className="btn primary" onClick={() => { act({ t: 'repay', amount: owe }); onClose(); }}>Clear it all</button>}
          </div>
        </>)}
      </div>
    </div>
  );
}

// ---------------- resale market ----------------
/** "₹2,340 ▲17%": a city's market value against its list price. */
function MarketLine({ game, sq, bare }: { game: DGame; sq: number; bare?: boolean }) {
  const pct = Math.round((marketMult(game, sq) - 1) * 100);
  const body = <><b>{fmt(marketValue(game, sq))}</b> <i className={pct >= 0 ? 'up' : 'down'}>{pct >= 0 ? '▲' : '▼'}{Math.abs(pct)}%</i></>;
  return bare ? body : <div className="hc-mkt">Market {body}</div>;
}

/** Sell one city: set your price, then ask Seth-ji (his private maths decides) or offer it to a player. */
function SellSheet({ game, me, sq, targets, color, onClose, act }: {
  game: DGame; me: string; sq: number; targets: { id: string; name: string; avatar: string }[]; color(id: string): string; onClose(): void; act(a: DAction): void;
}) {
  const s = BOARD[sq], g = s.group != null ? GROUPS[s.group] : null;
  const mv = marketValue(game, sq), pct = Math.round((marketMult(game, sq) - 1) * 100);
  const snap = (v: number) => Math.max(MARKET.STEP, Math.round(v / MARKET.STEP) * MARKET.STEP);
  const [price, setPrice] = useState(snap(mv || MARKET.STEP));
  const [to, setTo] = useState(targets[0]?.id ?? '');
  const max = Math.max(snap(mv * 2), 2000);
  const tried = !!game.sethTried?.includes(sq);
  const built = game.build[sq] > 0;
  const buyer = targets.find((p) => p.id === to);
  const p = snap(price);
  return (
    <div className="dk-manage" onClick={onClose}>
      <div className="card dk-sell" onClick={(e) => e.stopPropagation()}>
        <div className="row-between"><b>🏷️ Sell {s.name}</b><button className="btn ghost xs" onClick={onClose}>✕</button></div>
        <div className="sell-head" style={{ ['--g' as string]: g?.color ?? '#9b6bff' }}>
          <div className="sell-art"><TilePic kind={s.kind} name={s.name} /></div>
          <div className="sell-vals">
            <small>Market value today</small>
            <b className="mv">{fmt(mv)}</b>
            <span className={pct >= 0 ? 'up' : 'down'}>{pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}% vs list price {fmt(s.price!)}</span>
            {(built || game.mort[sq]) && <small className="dim">{built ? 'Buildings count at half their cost. ' : ''}{game.mort[sq] ? 'GIRVI: the buy-back is taken off.' : ''}</small>}
          </div>
        </div>
        <div className="sell-price">
          <small>Your price</small>
          <div className="gift-row">
            <button className="btn glass sm" disabled={p <= MARKET.STEP} onClick={() => setPrice(snap(p - MARKET.STEP))}>−₹100</button>
            <input className="gift-input" type="number" min={MARKET.STEP} step={MARKET.STEP} value={price || ''} aria-label="Your price in rupees"
              onChange={(e) => setPrice(Math.floor(Number(e.target.value) || 0))} onBlur={() => setPrice(p)} />
            <button className="btn glass sm" onClick={() => setPrice(snap(p + MARKET.STEP))}>+₹100</button>
          </div>
          <div className="gift-slider"><input type="range" min={MARKET.STEP} max={max} step={MARKET.STEP} value={Math.min(p, max)} aria-label="Your price" onChange={(e) => setPrice(Number(e.target.value))} /></div>
          <div className="quick-px">{[0.85, 1, 1.15, 1.3].map((k) => <button key={k} className={p === snap(mv * k) ? 'on' : ''} onClick={() => setPrice(snap(mv * k))}>{k === 1 ? 'Market' : `${k < 1 ? '−' : '+'}${Math.round(Math.abs(k - 1) * 100)}%`}</button>)}</div>
        </div>
        <div className="sell-opts">
          <div className="sell-opt seth">
            <b>🧔 Offer to Seth-ji</b>
            <small>Seth-ji decides by his own secret maths: his mood, what's trending, how full his godown is… He hears one offer per city each turn.</small>
            <button className="btn premium" disabled={tried} onClick={() => act({ t: 'sellSeth', sq, price: p })}>{tried ? 'Seth-ji already said no this turn' : `Ask Seth-ji for ${fmt(p)}`}</button>
          </div>
          {targets.length > 0 && (
            <div className="sell-opt">
              <b>🤝 Offer to a player</b>
              {built ? <small className="dim">Sell the buildings first to sell this city to a player.</small> : (<>
                <div className="gift-to">
                  {targets.map((t) => (
                    <button key={t.id} className={to === t.id ? 'on' : ''} style={{ ['--c' as string]: color(t.id) }} onClick={() => setTo(t.id)}>
                      <Avatar id={t.avatar} size={26} /><b>{t.name}</b><small>{fmt(game.cash[t.id] ?? 0)}</small>
                    </button>
                  ))}
                </div>
                <button className="btn glass" disabled={!buyer || (game.cash[to] ?? 0) < p} onClick={() => act({ t: 'offerCity', sq, to, price: p })}>
                  {buyer && (game.cash[to] ?? 0) < p ? `${buyer.name} has only ${fmt(game.cash[to] ?? 0)}` : `Offer to ${buyer?.name ?? '…'} for ${fmt(p)}`}
                </button>
              </>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- city stakes ----------------
/** Buy 25% of someone else's city (a quarter of its rent is yours), and see stakes in your own cities. */
function StakesSheet({ game, me, name, color, onClose, act }: { game: DGame; me: string; name(id: string): string; color(id: string): string; onClose(): void; act(a: DAction): void }) {
  const mine = stakesOf(game, me);
  const others = BOARD.map((_, i) => i).filter((i) => BOARD[i].price != null && game.owner[i] && game.owner[i] !== me && !game.mort[i] && !game.stakes?.[i])
    .sort((a, b) => rentFor(game, b, 7) - rentFor(game, a, 7));
  const inMine = Object.keys(game.stakes ?? {}).map(Number).filter((i) => game.owner[i] === me);
  const full = mine.length >= STAKE.MAX;
  const row = (i: number, right: React.ReactNode, note?: string) => (
    <li key={i} style={{ ['--c' as string]: color(game.owner[i]!) }}>
      <CityChip sq={i} />
      <span className="st-mid"><small>{name(game.owner[i]!)}{note ? ` · ${note}` : ''}</small><b>Rent {fmt(rentFor(game, i, 7))} → your 25%: {fmt(Math.round(rentFor(game, i, 7) * STAKE.SHARE))}</b></span>
      {right}
    </li>
  );
  return (
    <div className="dk-manage" onClick={onClose}>
      <div className="card dk-stakes" onClick={(e) => e.stopPropagation()}>
        <div className="row-between"><b>📈 City stakes</b><button className="btn ghost xs" onClick={onClose}>✕</button></div>
        <small className="dim">Buy 25% of someone's city: every time it collects rent, a quarter comes to you. The owner gets your money now and can buy the stake back later for more. Up to {STAKE.MAX} stakes. Earned so far: <b>{fmt(game.stats.x?.stake?.[me] ?? 0)}</b></small>
        {mine.length > 0 && (<><h4>Your stakes ({mine.length}/{STAKE.MAX})</h4><ul className="st-list">{mine.map((i) => row(i, <span className="st-own">25% ✓</span>))}</ul></>)}
        {inMine.length > 0 && (<><h4>Stakes in your cities</h4><ul className="st-list">{inMine.map((i) => (
          <li key={i} style={{ ['--c' as string]: color(game.stakes![i]) }}>
            <CityChip sq={i} /><span className="st-mid"><small>{name(game.stakes![i])} holds 25%</small><b>Buy it back for {fmt(buyoutPrice(game, i))}</b></span>
            <button className="btn glass xs" disabled={game.cash[me] < buyoutPrice(game, i)} onClick={() => act({ t: 'buyout', sq: i })}>Buy back</button>
          </li>
        ))}</ul></>)}
        <h4>Buy a stake</h4>
        {others.length ? <ul className="st-list">{others.map((i) => row(i,
          <button className="btn premium xs" disabled={full || !canStake(game, me, i)} onClick={() => act({ t: 'stake', sq: i })}>{fmt(stakePrice(game, i))}</button>))}</ul>
          : <small className="dim">Nobody owns a city you can buy into yet.</small>}
      </div>
    </div>
  );
}

// ---------------- side bets ----------------
/** A shart on someone else's roll: Seth-ji the bookie shows live odds. Lost bets go into the Tapri gullak. */
function BetSheet({ game, me, roller, onClose, act }: { game: DGame; me: string; roller: string; onClose(): void; act(a: DAction): void }) {
  const [amount, setAmount] = useState(BETS.AMOUNTS[0]);
  const ghost = game.out.includes(me);
  const kinds = (Object.keys(BET_INFO) as BetKind[]).filter((k) => !(ghost && k === 'mine'));
  return (
    <div className="dk-manage" onClick={onClose}>
      <div className="card dk-bet" onClick={(e) => e.stopPropagation()}>
        <div className="row-between"><b>🎲 Shart on {roller}'s roll</b><button className="btn ghost xs" onClick={onClose}>✕</button></div>
        <small className="dim">Seth-ji is the bookie. Win and he pays the odds; lose and your shart goes into the Tapri gullak. One shart per roll.</small>
        <div className="seg">{BETS.AMOUNTS.map((v) => <button key={v} className={amount === v ? 'on' : ''} disabled={(game.cash[me] ?? 0) < v} onClick={() => setAmount(v)}>{fmt(v)}</button>)}</div>
        <div className="bet-grid">
          {kinds.map((k) => {
            const odds = betOdds(game, k, me);
            return (
              <button key={k} disabled={odds <= 1 || (game.cash[me] ?? 0) < amount} onClick={() => act({ t: 'bet', kind: k, amount })}>
                <span>{BET_INFO[k].emoji}</span><b>{BET_INFO[k].name}</b><small>{BET_INFO[k].hint}</small>
                <em>{odds > 1 ? `×${odds} · win ${fmt(Math.round(amount * odds))}` : 'not possible now'}</em>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- log with pictures ----------------
const LOG_ICON: Record<string, string> = {
  pay: '💸', earn: '💰', salary: '💵', buy: '🏷️', build: '🏗️', villa: '🏰', sell: '🔨', mortgage: '🏦', unmort: '💰', cardSold: '🧔', sethNo: '🙅', deal: '🤝', counter: '🔁',
  gift: '💝', loan: '🏦', repay: '🏦', jail: '🚨', free: '🕊️', pot: '☕', spin: '🎡', event: '🔥', eventEnd: '📉', setComplete: '👑', sets: '🏆', power: '⚡', shield: '🛡️',
  double: '💥', tele: '🌀', takeover: '😈', auctionWin: '🔨', streak: '🔥', bankrupt: '💥', season: '🗓️', catchup: '🎒', market: '📊', placement: '📈', stake: '📈',
  stakeCut: '📈', buyout: '💼', haunt: '👻', toll: '👻', bet: '🎲', betWin: '🎲', betLose: '🎲', land: '📍',
};
function LogList({ log, room, color }: { log: DGame['log']; room: GameProps<DGame, DAction>['room']; color(id: string): string }) {
  const player = (id?: string) => (id ? room.players.find((p) => p.id === id) : undefined);
  return (
    <ol className="dk-loglist">
      {[...log].reverse().map((l, k, arr) => {
        const who = player(l.pid), other = player(l.o), s = l.sq != null ? BOARD[l.sq] : null;
        return (
          <li key={l.id} style={{ ['--c' as string]: who ? color(who.id) : 'rgba(255,255,255,0.25)' }} className={k === 0 ? 'new' : ''}>
            {(k === 0 || arr[k - 1].r !== l.r) && <small className="round">Round {l.r}</small>}
            <div className="ll-row">
              <span className="ll-pic">{s ? <TilePic kind={s.kind} name={s.name} /> : <span className="ll-ico">{(l.k && LOG_ICON[l.k]) || (/^[p{L}p{N}]/u.test(l.t) ? '📌' : Array.from(l.t)[0])}</span>}</span>
              <span className="ll-text">{l.t}</span>
              <span className="ll-who">{who && <Avatar id={who.avatar} size={22} />}{other && other.id !== who?.id && <Avatar id={other.avatar} size={18} />}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Whether the screen is wide enough for the log to sit beside the board. */
function useWide() {
  const q = '(min-width: 900px) and (min-aspect-ratio: 1/1)';
  const [w, setW] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => { const m = matchMedia(q), f = () => setW(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  return w;
}

// ---------------- festival particles ----------------
function ThemeFx({ theme }: { theme: ThemeId }) {
  const T = THEMES[theme];
  const [bits] = useState(() => Array.from({ length: LOW ? 8 : 14 }, (_, i) => ({ i, x: Math.random() * 100, d: 6 + Math.random() * 8, delay: -Math.random() * 12, s: 0.7 + Math.random() * 0.8, e: T.particles[i % T.particles.length] })));
  if (RM) return null;
  return (
    <div className={`theme-fx m-${T.motion} t-${theme}`} aria-hidden>
      {bits.map((b) => <i key={b.i} style={{ left: `${b.x}%`, animationDuration: `${b.d}s`, animationDelay: `${b.delay}s`, ['--s' as string]: b.s }}>{b.e}</i>)}
    </div>
  );
}
