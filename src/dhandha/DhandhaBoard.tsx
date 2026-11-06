import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Dice } from '../components/Dice';
import { buzz, sfx } from '../game/sound';
import type { GameProps } from '../shared/GameShell';
import { BAIL, BOARD, BUILD_LEVELS, GROUPS, MAX_BUILD, POWERS, RENT_MULT, WHEEL, fmt, type Card, type Power } from './data';
import { ArtDefs, Buildings, MONUMENTS, SethJi, TilePic, type SethMood } from './Monument';
import {
  canBuild, groupSquares, netWorth, nextBuildCost, ownsGroup, placementOn, rentFor, sellValue, takeoverPrice,
  type CityEvent, type DAction, type DGame, type Fx,
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
  streak: ['On a roll 🔥 ₹500 bonus from me.'],
  placement: ['Placement Season! Ab har rent ×1.5. All the best 😈'],
  set: ['Poora set! Ab ghar bana, hotel bana, villa bana.'],
  spin: ['Ghumao wheel, dekhte hain kismat!'],
  double: ['Double Dhamaka armed. Koi toh aao 😈'],
  tele: ['Teleport? Uber se bhi fast!'],
  free: ['Detention se azaadi! 🕊️'],
};
const pickLine = (k: string, vars: Record<string, string> = {}) => {
  const arr = LINES[k];
  if (!arr) return '';
  return arr[Math.floor(Math.random() * arr.length)].replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const LANDING = new Set<Fx['kind']>(['pay', 'earn', 'land', 'pot', 'jail', 'setComplete', 'shield', 'double', 'streak', 'event', 'free']);
const short = (n: number) => (n >= 1000 ? `₹${+(n / 1000).toFixed(1)}k` : `₹${n}`);
interface Floater { id: number; pid: string; text: string; good: boolean }
type Pop = { id: number; kind: 'event' | 'land' | 'set' | 'villa' | 'eventEnd' | 'placement' | 'streak' | 'takeover' | 'auctionWin' | 'shield'; sq?: number; pid: string; amount?: number; ev?: CityEvent; other?: string };

export function DhandhaBoard({ room, game, me, color, mood, setMood, confetti, act }: GameProps<DGame, DAction>) {
  const [shown, setShown] = useState<Record<string, number>>(() => ({ ...game.pos }));
  const fit = useBoardFit();
  const geo = fit.geo;
  // Centre-panel unit: the smaller of a column and a row, so the middle never overflows.
  const uc = Math.min(fit.w / (2 * geo.K + geo.n), fit.h / (2 * geo.K + geo.m));
  const [peek, setPeek] = useState<number | null>(null);
  const [manage, setManage] = useState(false);
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

  const cur = game.order[game.turn];
  const mine = cur === me;
  const name = (pid: string) => room.players.find((p) => p.id === pid)?.name ?? '?';
  const avatarOf = (pid: string) => room.players.find((p) => p.id === pid)?.avatar ?? 'c0';
  const q = (sel: string) => root.current?.querySelector(sel) ?? null;
  const chip = (pid: string) => q(`[data-pid="${pid}"]`);

  const say = (key: string, m: SethMood, vars?: Record<string, string>, shades = false) => {
    const text = pickLine(key, vars);
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
            else if (!f.other) setSeth((x) => ({ ...x, mood: 'happy' }));
            if (f.pid === me) buzz(60);
            sfx.capture();
            if (game.cash[f.pid] < 500 && !game.out.includes(f.pid)) setTimeout(() => say('broke', 'shocked'), 900);
            break;
          }
          case 'earn': if (f.amount) { float(f, `+${fmt(f.amount)}`, true); if (f.amount >= 500) setMood(f.pid, 'cool'); if (f.text === 'bank') fly(banker(), chip(f.pid), COIN, 0, coinsFor(f.amount)); } break;
          case 'salary': float(f, `+${fmt(f.amount!)} salary`, true); fly(banker(), chip(f.pid), COIN, 0, 5); flashTile(0, 'claim', 700); say('salary', 'count'); sfx.six(); break;
          case 'buy':
            fly(chip(f.pid), banker(), COIN, 0, coinsFor(f.amount ?? 1000));
            fly(banker(), chip(f.pid), CARD(s!.short, gcol), 600);
            setTimeout(() => { flashTile(f.sq!, 'claim'); setMood(f.pid, 'cool'); sfx.home(); }, 900);
            say('buy', 'happy');
            break;
          case 'build': fly(chip(f.pid), banker(), COIN, 0, 3); flashTile(f.sq!, 'build', 900); setSeth((x) => ({ ...x, mood: 'happy' })); sfx.home(); break;
          case 'sell': flashTile(f.sq!, 'unbuild', 500); break;
          case 'cardSold':
            fly(chip(f.pid), banker(), CARD(s!.short, gcol));
            fly(banker(), chip(f.pid), COIN, 600, coinsFor(f.amount ?? 500));
            flashTile(f.sq!, 'unclaim', 600);
            float(f, `🏦 +${fmt(f.amount!)}`, true); say('cardSold', 'count'); sfx.pop();
            break;
          case 'mortgage': flashTile(f.sq!, 'girvi', 800); if (f.amount) fly(banker(), chip(f.pid), COIN, 0, 3); break;
          case 'unmort': flashTile(f.sq!, 'ungirvi', 600); break;
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
          case 'placement': pop({ kind: 'placement', pid: f.pid }, 3200); say('placement', 'party'); sfx.turn(); break;
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

  const bySq = new Map<number, string[]>();
  game.order.filter((id) => !game.out.includes(id)).forEach((id) => { const s = shown[id] ?? 0; bySq.set(s, [...(bySq.get(s) ?? []), id]); });

  const roll = () => { setSettled(false); act({ t: 'roll' }); };
  const potFill = Math.min(1, game.pot / 6000);

  return (
    <div className="dk v5" ref={root}>
      <ArtDefs />
      <div className="dk-players">
        {room.players.map((p) => {
          const out = game.out.includes(p.id);
          const hand = game.hand[p.id] ?? [];
          return (
            <div key={p.id} data-pid={p.id} className={`dk-p ${cur === p.id ? 'turn' : ''} ${out ? 'out' : ''} ${(game.streak[p.id] ?? 0) >= 2 ? 'hot' : ''}`} style={{ ['--c' as string]: color(p.id) }}>
              {cur === p.id && !out && <span className="your-turn">{p.id === me ? 'YOUR TURN' : 'TURN'}</span>}
              <div className="pav"><Avatar id={p.avatar} size={34} mood={out ? 'sad' : mood(p.id)} hyped={cur === p.id} />{game.jail[p.id] > 0 && <i className="bars" />}</div>
              <div className="dk-pinfo">
                <b>{p.name}{(game.streak[p.id] ?? 0) >= 2 && ' 🔥'}</b>
                <span className="cash">{out ? <s>Bankrupt</s> : fmt(cashShown[p.id] ?? game.cash[p.id])}</span>
                <span className="pips">{GROUPS.map((g, gi) => {
                  const any = groupSquares(gi).some((k) => game.owner[k] === p.id), full = ownsGroup(game, p.id, gi);
                  return <i key={gi} className={full ? 'full' : any ? 'any' : ''} style={{ ['--g' as string]: g.color }} />;
                })}</span>
              </div>
              {(hand.length > 0 || game.dblArmed[p.id]) && <span className="hand-mini">{hand.map((h, k) => <i key={k}>{POWERS[h].icon}</i>)}{game.dblArmed[p.id] && <i className="armed">💥</i>}</span>}
              {floaters.filter((f) => f.pid === p.id).map((f) => <span key={f.id} className={`floater ${f.good ? 'good' : 'bad'}`}>{f.text}</span>)}
            </div>
          );
        })}
      </div>

      <div className="dk-stage">
        <div className="dk-scroll" ref={fit.ref}>
          <div className={`dk-board geo-${geo.n}x${geo.m} ${teleport ? 'tele-mode' : ''} ${placementOn(game) ? 'placement' : ''} ${uc < 30 ? 'tight' : ''}`} style={{ width: fit.w, height: fit.h, ['--u' as string]: `${fit.w / (2 * geo.K + geo.n)}px`, ['--uc' as string]: `${uc}px`, ['--ds' as string]: Math.max(0.42, Math.min(0.8, uc / 52)), gridTemplateColumns: `${geo.K}fr repeat(${geo.n}, 1fr) ${geo.K}fr`, gridTemplateRows: `${geo.K}fr repeat(${geo.m}, 1fr) ${geo.K}fr` }}>
            {BOARD.map((s, i) => {
              const { r, c, side } = cell(i, geo);
              const o = game.owner[i];
              const g = s.group != null ? GROUPS[s.group] : null;
              const ev = evOf(i);
              const teleOk = teleport && s.price && !o;
              return (
                <button key={i} data-sq={i}
                  className={`dk-sq ${side} k-${s.kind} ${o ? 'owned' : ''} ${game.mort[i] ? 'mort' : ''} ${ev ? (ev.mult > 1 ? 'boom' : 'slump') : ''} ${flash[i] ?? ''} ${here === i ? 'here' : ''} ${teleOk ? 'tele-ok' : ''}`}
                  style={{ gridRow: r, gridColumn: c, ['--g' as string]: g?.color ?? 'transparent', ['--o' as string]: o ? color(o) : 'transparent' }}
                  onClick={() => {
                    sfx.tap();
                    if (teleport) { if (teleOk) { act({ t: 'power', p: 'tele', sq: i }); setTeleport(false); } return; }
                    setPeek(i);
                  }}>
                  <TilePic kind={s.kind} name={s.name} />
                  {g && <i className="bar"><Buildings n={game.build[i]} /></i>}
                  <span className="plate"><b className={`nm ${s.short.length > 7 ? 'long' : ''}`}>{s.short}</b>{s.price && !o && <span className="pr">{short(s.price)}</span>}</span>
                  {ev && <span className="evb">{ev.emoji}<b>×{ev.mult}</b></span>}
                  {game.mort[i] && <span className="girvi">GIRVI</span>}
                </button>
              );
            })}

            <div className="dk-centre" style={{ gridRow: `2 / ${geo.m + 2}`, gridColumn: `2 / ${geo.n + 2}` }}>
              <div className="dk-brand">
                <b>Dhandha<em>King</em></b>
                <span className="round-chip">R{game.round}{game.maxRounds ? `/${game.maxRounds}` : ''}</span>
                {placementOn(game) && <span className="season">🎓 PLACEMENT SEASON ×1.5</span>}
              </div>
              <div className="dk-sethbox" data-anchor="banker">
                <SethJi mood={seth.mood} shades={seth.shades} />
                {seth.say && <div className="bubble" key={seth.id}>{seth.say}</div>}
              </div>
              <div className="dk-meters">
                <span className="gullak" data-anchor="pot" title="Tapri gullak">
                  <svg viewBox="0 0 24 24" className="kulhad"><path d="M4 6h16l-2 14H6Z" fill="#c4713a" stroke="#1b1035" strokeWidth="1.4" /><clipPath id="kh"><path d="M4 6h16l-2 14H6Z" /></clipPath><rect x="0" y={20 - 14 * potFill} width="24" height="24" fill="#ffd23f" clipPath="url(#kh)" /><path d="M4 6h16" stroke="#1b1035" strokeWidth="1.4" /></svg>
                  <b>{fmt(game.pot)}</b>
                </span>
                {game.events.map((e) => (
                  <button key={e.id} className={`pill ev ${e.mult > 1 ? 'boom' : 'slump'}`} onClick={() => setPeek(e.sq)}>{e.emoji} {BOARD[e.sq].short} ×{e.mult}·{e.rounds}r</button>
                ))}
              </div>
              <div className={`dk-dice tray ${doubles && settled ? 'doubles' : ''}`}>
                <Dice value={game.dice[0]} rollId={game.rollId} color={color(cur)} ready={ready && game.phase === 'roll'} onRoll={roll} />
                <Dice value={game.dice[1]} rollId={game.rollId} color={color(cur)} ready={ready && game.phase === 'roll'} onRoll={roll} onSettled={() => setSettled(true)} />
                {doubles && settled && <span className="dbl-chip">DOUBLES!</span>}
              </div>
              <div className="dk-note" key={game.note}>{game.note}</div>
              <div className="dk-actions">
                {!mine && game.phase !== 'auction' && <span className="dim">{name(cur)} is thinking…</span>}
                {mine && game.phase === 'roll' && (<>
                  {jailed && game.jugaad[me] > 0 && <button className="btn glass sm" onClick={() => act({ t: 'jugaad' })}>🩺 Doctor's Note</button>}
                  {jailed && <button className="btn glass sm" disabled={game.cash[me] < BAIL} onClick={() => act({ t: 'bail' })}>Late fine {fmt(BAIL)}</button>}
                  <button className="btn roll-btn sm" disabled={!settled} onClick={roll}>🎲 Roll{jailed ? ' for doubles' : ''}</button>
                </>)}
                {mine && game.phase === 'end' && <button className="btn roll-btn sm" onClick={() => act({ t: 'end' })}>{game.again ? '🎲 Roll again' : 'End turn ›'}</button>}
                {mine && game.phase === 'moving' && <span className="dim">Moving…</span>}
                {canManage && myProps.length > 0 && <button className="btn glass sm" onClick={() => setManage(true)}>🃏 Cards ({myProps.length})</button>}
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
      </div>

      {mine && game.phase === 'buy' && sq.price && (() => {
        const owner = game.owner[here];
        const price = owner ? takeoverPrice(here) : sq.price;
        return (
          <div className="dk-sheet">
            {owner && <div className="takeover-tag">😈 HOSTILE TAKEOVER · {name(owner)} mortgaged this — grab it for {fmt(price)} ({name(owner)} gets {fmt(price / 2)})</div>}
            <Deed i={here} game={game} name={name} />
            <div className="row">
              <button className="btn glass" onClick={() => act({ t: 'pass' })}>{owner ? 'Skip' : 'Pass → Bolee 🔨'}</button>
              <button className="btn premium" disabled={game.cash[me] < price} onClick={() => act({ t: 'buy' })}>{owner ? '😈 Take over' : '🏷️ Buy'} for {fmt(price)}</button>
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

      {pops.map((p) => <PopUp key={p.id} p={p} name={name} color={color} game={game} onClose={() => setPops((l) => l.filter((x) => x.id !== p.id))} />)}

      {peek !== null && !manage && (
        <div className="dk-sheet peek" onClick={() => setPeek(null)}>
          <Deed i={peek} game={game} name={name} />
          <small className="dim">Tap anywhere to close</small>
        </div>
      )}

      {manage && (
        <div className="dk-manage" onClick={() => setManage(false)}>
          <div className="card hand" onClick={(e) => e.stopPropagation()}>
            <div className="row-between"><b>🃏 My city cards · {fmt(game.cash[me])}</b><button className="btn ghost xs" onClick={() => setManage(false)}>✕</button></div>
            <small className="dim">Own every city in a colour to build: 3 houses → hotel → villa. Net worth {fmt(netWorth(game, me))}</small>
            <div className="hand-row">
              {myProps.map((i) => {
                const s = BOARD[i], g = s.group != null ? GROUPS[s.group] : null;
                const full = g && ownsGroup(game, me, s.group!);
                return (
                  <div key={i} className={`hcard ${game.mort[i] ? 'mort' : ''}`} style={{ ['--g' as string]: g?.color ?? '#9b6bff' }}>
                    <div className="hc-art"><TilePic kind={s.kind} name={s.name} /><b>{s.name}</b></div>
                    <div className="hc-mid">
                      <small className="dim">{s.kind === 'city' ? MONUMENTS[s.name]?.label : s.kind === 'train' ? 'Transport' : 'Utility'}</small>
                      {g && <div className="hc-build"><Buildings n={game.build[i]} /><small>{BUILD_LEVELS[game.build[i]]}</small></div>}
                      <div className="hc-rent">Rent now <b>{fmt(rentFor(game, i, 7))}</b></div>
                      {g && !full && <small className="dim">Collect all {groupSquares(s.group!).length} {g.name} cities to build</small>}
                      {game.mort[i] && <small className="girvi-t">GIRVI · mortgaged</small>}
                    </div>
                    <div className="hc-actions">
                      {g && game.build[i] < MAX_BUILD && <button className="btn primary xs" disabled={!canManage || !canBuild(game, me, i)} onClick={() => act({ t: 'build', sq: i })}>+ {BUILD_LEVELS[game.build[i] + 1].replace(/^\d /, '')} {fmt(nextBuildCost(game, i))}</button>}
                      {game.build[i] > 0 && <button className="btn glass xs" disabled={!canManage} onClick={() => act({ t: 'sell', sq: i })}>Sell building</button>}
                      {!game.build[i] && (game.mort[i]
                        ? <button className="btn glass xs" disabled={!canManage} onClick={() => act({ t: 'unmortgage', sq: i })}>Unmortgage</button>
                        : <button className="btn ghost xs" disabled={!canManage} onClick={() => act({ t: 'mortgage', sq: i })}>Mortgage +{fmt(s.price! / 2)}</button>)}
                      <button className="btn sell xs" disabled={!canManage} onClick={() => { if (confirm(`Sell the ${s.name} card to Seth-ji for ${fmt(sellValue(game, i))}?`)) act({ t: 'sellCity', sq: i }); }}>🏦 Sell card {fmt(sellValue(game, i))}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
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
  if (p.kind === 'placement') return <div className="toast-pop gold big">🎓 PLACEMENT SEASON — every rent ×1.5 till the end!</div>;
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
function Deed({ i, game, name }: { i: number; game: DGame; name(pid: string): string }) {
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
      {s.price && <div className="deed-foot">{o ? <>Owned by <b>{name(o)}</b>{game.mort[i] && ' · GIRVI (mortgaged) — open to hostile takeover'}</> : <>For sale from Seth-ji · pass and it goes to Bolee 🔨</>}</div>}
      {g && <div className="deed-set">{groupSquares(s.group!).map((k) => <span key={k} className={game.owner[k] ? 'own' : ''}>{BOARD[k].short}</span>)}</div>}
    </div>
  );
}
