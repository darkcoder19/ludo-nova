// DhandhaKing board: 40 squares of Indian cities, trains, utilities and desi chaos.

export type Kind = 'start' | 'city' | 'train' | 'utility' | 'tax' | 'kismat' | 'parivaar' | 'jail' | 'chai' | 'police';

export interface Square {
  kind: Kind;
  name: string;
  short: string;
  price?: number;
  rent?: number;   // base rent for cities
  group?: number;  // colour set index for cities
  tax?: number;
  icon?: string;
  flavour?: string;
}

export interface Group { name: string; color: string; build: number }

export const GROUPS: Group[] = [
  { name: 'Bihar-Jharkhand', color: '#8d5524', build: 500 },
  { name: 'Central India', color: '#5ec8ff', build: 500 },
  { name: 'Rajasthan', color: '#ff4fd8', build: 1000 },
  { name: 'Uttar Pradesh', color: '#ff8c42', build: 1000 },
  { name: 'East India', color: '#ff2d55', build: 1500 },
  { name: 'Gujarat', color: '#ffd23f', build: 1500 },
  { name: 'South India', color: '#00c97a', build: 2000 },
  { name: 'Metro Elite', color: '#2b49ff', build: 2000 },
];

const city = (name: string, short: string, group: number, price: number, rent: number): Square => ({ kind: 'city', name, short, group, price, rent });

export const BOARD: Square[] = [
  { kind: 'start', name: 'Payday', short: 'PAYDAY', icon: '💸', flavour: '₹2,000 credited. Seth-ji ka UPI never fails.' },
  city('Patna', 'Patna', 0, 600, 20),
  { kind: 'parivaar', name: 'Group Chat', short: 'GC', icon: '💬', flavour: '142 unread messages. One is about money.' },
  city('Ranchi', 'Ranchi', 0, 600, 40),
  { kind: 'tax', name: 'Semester Fees', short: 'FEES', tax: 2000, icon: '🧾', flavour: 'Fees due. Again.' },
  { kind: 'train', name: 'Midnight Metro', short: 'METRO', price: 2000, icon: '🚇', flavour: 'Last metro, packed like a WhatsApp forward.' },
  city('Bhopal', 'Bhopal', 1, 1000, 60),
  { kind: 'kismat', name: 'Plot Twist', short: 'TWIST', icon: '🌀', flavour: 'Life said: hold my chai.' },
  city('Gwalior', 'Gwalior', 1, 1000, 60),
  city('Nagpur', 'Nagpur', 1, 1200, 80),
  { kind: 'jail', name: 'Detention Room', short: 'DETENTION', icon: '🏫', flavour: 'Attendance 62%. Sit here and think about your life.' },
  city('Jodhpur', 'Jodhpur', 2, 1400, 100),
  { kind: 'utility', name: 'Hostel WiFi', short: 'WIFI', price: 1500, icon: '📶', flavour: 'Rent = dice × ₹40, or × ₹100 if you own both.' },
  city('Udaipur', 'Udaipur', 2, 1400, 100),
  city('Jaipur', 'Jaipur', 2, 1600, 120),
  { kind: 'train', name: 'Bike Taxi', short: 'BIKE TXI', price: 2000, icon: '🛵', flavour: 'Bhaiya, OTP bata do.' },
  city('Varanasi', 'Varanasi', 3, 1800, 140),
  { kind: 'parivaar', name: 'Group Chat', short: 'GC', icon: '💬', flavour: '142 unread messages. One is about money.' },
  city('Kanpur', 'Kanpur', 3, 1800, 140),
  city('Lucknow', 'Lucknow', 3, 2000, 160),
  { kind: 'chai', name: 'Tapri Jackpot', short: 'TAPRI', icon: '☕', flavour: 'Cutting chai plus all the fines in the tapri gullak.' },
  city('Guwahati', 'Guwahati', 4, 2200, 180),
  { kind: 'kismat', name: 'Plot Twist', short: 'TWIST', icon: '🌀', flavour: 'Life said: hold my chai.' },
  city('Bhubaneswar', 'BBSR', 4, 2200, 180),
  city('Kolkata', 'Kolkata', 4, 2400, 200),
  { kind: 'train', name: 'Sleeper Bus', short: 'SLEEPER', price: 2000, icon: '🚌', flavour: 'Recliner seat, zero sleep.' },
  city('Vadodara', 'Baroda', 5, 2600, 220),
  city('Surat', 'Surat', 5, 2600, 220),
  { kind: 'utility', name: 'Data Recharge', short: 'RECHARGE', price: 1500, icon: '📱', flavour: '1.5 GB/day, gone by noon.' },
  city('Ahmedabad', 'Amdavad', 5, 2800, 240),
  { kind: 'police', name: 'Proxy Pakdi Gayi!', short: 'PROXY!', icon: '🚨', flavour: 'Your friend gave proxy, prof noticed. Straight to Detention.' },
  city('Kochi', 'Kochi', 6, 3000, 260),
  city('Chennai', 'Chennai', 6, 3000, 260),
  { kind: 'parivaar', name: 'Group Chat', short: 'GC', icon: '💬', flavour: '142 unread messages. One is about money.' },
  city('Hyderabad', 'Hyd', 6, 3200, 280),
  { kind: 'train', name: 'Vande Bharat', short: 'VANDE', price: 2000, icon: '🚄', flavour: 'Fastest flex on rails.' },
  { kind: 'kismat', name: 'Plot Twist', short: 'TWIST', icon: '🌀', flavour: 'Life said: hold my chai.' },
  city('Bengaluru', "B'luru", 7, 3500, 350),
  { kind: 'tax', name: 'Platform Fee', short: 'PLT FEE', tax: 1000, icon: '🧾', flavour: 'Food ₹200, fees ₹1,000. Classic.' },
  city('Mumbai', 'Mumbai', 7, 4000, 500),
];

export const SALARY = 2000;
export const START_CASH = 15000;
/** Starting money the host can pick in the lobby. */
export const CASH_CHOICES = [10000, 15000, 20000, 30000];
export const BAIL = 500; // late fine to leave Detention early
export const JAIL = 10;
export const MAX_BUILD = 5; // 3 houses, then a hotel, then a villa

/** What stands on a city with `n` buildings. */
export const BUILD_LEVELS = ['Empty plot', '1 House', '2 Houses', '3 Houses', 'Hotel', 'Villa'];
export const buildIcon = (n: number) => (n >= 5 ? '🏰' : n === 4 ? '🏨' : '🏠'.repeat(n));
/** Building costs climb: houses at the group price, hotel ×1.5, villa ×2. */
export const buildCost = (base: number, next: number) => (next === 5 ? base * 2 : next === 4 ? Math.round(base * 1.5) : base);
/** The bank buys a city card back at 70% (20% if mortgaged), plus half of what was built. */
export const SELL_RATE = 0.7;
/** Resale market: every city's value drifts a little each round (multiplier on its list price). */
export const MARKET = { MIN: 0.6, MAX: 2.2, SWING: 0.12, GROW: 0.012, GROW_CAP: 1.6, STEP: 100 };
/** Campus Calendar: every few rounds a season bends one rule for a while. */
export const CALENDAR = { EVERY: 6, LENGTH: 3 };
export type SeasonKind = 'fest' | 'exam' | 'placement' | 'strike' | 'sale';
export const SEASONS: Record<SeasonKind, { name: string; emoji: string; text: string }> = {
  fest: { name: 'Fest Week', emoji: '🎉', text: 'Rides pay double rent' },
  exam: { name: 'Exam Week', emoji: '📚', text: 'No building, everyone is studying' },
  placement: { name: 'Placement Drive', emoji: '💼', text: 'Payday pays double' },
  strike: { name: 'Hostel Strike', emoji: '✊', text: 'WiFi & Recharge pay no rent' },
  sale: { name: 'Sale Season', emoji: '🛍️', text: "20% off at Seth-ji's shop, bolee opens at 30%" },
};
/** Catch-up at Payday: the player far behind gets a bonus, the runaway leader pays a little tax. */
export const CATCHUP = { BONUS: 1000, BONUS_BELOW: 0.6, TAX: 500, TAX_ABOVE: 1.6 };
/** City stakes: a 25% share of someone else's city earns a quarter of every rent it collects. */
export const STAKE = { SHARE: 0.25, PRICE: 0.35, BUYOUT: 0.5, MAX: 3 };
/** Ghost landlords: a bankrupt player haunts one tile and takes a toll from whoever lands there. */
export const GHOST = { TOLL: 300, MOVE_EVERY: 3 };
/** Side bets (shart) on someone else's roll. Seth-ji is the bookie: odds = 0.9 ÷ chance; lost bets feed the gullak. */
export const BETS = { AMOUNTS: [200, 500], EDGE: 0.9, MAX_ODDS: 10 };
export type BetKind = 'doubles' | 'under' | 'over' | 'seven' | 'mine';
export const BET_INFO: Record<BetKind, { name: string; emoji: string; hint: string }> = {
  doubles: { name: 'Doubles', emoji: '🎲', hint: 'both dice the same' },
  under: { name: 'Under 7', emoji: '⬇️', hint: 'total 2 to 6' },
  over: { name: 'Over 7', emoji: '⬆️', hint: 'total 8 to 12' },
  seven: { name: 'Lucky 7', emoji: '🍀', hint: 'total exactly 7' },
  mine: { name: 'Pays me rent', emoji: '💸', hint: 'lands on one of your cities' },
};

/** Rent multipliers for 0..5 buildings. */
export const RENT_MULT = [1, 5, 15, 45, 65, 90];

export type CardFx =
  | { t: 'cash'; amount: number }
  | { t: 'each'; amount: number }          // + collect from each player, − pay each player
  | { t: 'goto'; sq: number }
  | { t: 'back'; n: number }
  | { t: 'jail' }
  | { t: 'free' }
  | { t: 'repairs'; perHouse: number; perMall: number };

export interface Card { title: string; text: string; fx: CardFx; deck: 'kismat' | 'parivaar'; /** also hands you a random power-up */ power?: boolean }

export const CARDS: Card[] = [
  { deck: 'kismat', title: 'Reel went viral', text: '2M views on your chai-pouring reel. Brands are calling.', fx: { t: 'cash', amount: 2000 }, power: true },
  { deck: 'kismat', title: 'Finfluencer course', text: 'You bought a "get rich quick" course. It did not work.', fx: { t: 'cash', amount: -800 } },
  { deck: 'kismat', title: 'Placement offer', text: 'A Bengaluru startup wants you. Pack up and go to Bengaluru.', fx: { t: 'goto', sq: 37 } },
  { deck: 'kismat', title: 'Missed the metro', text: 'Doors closed on your face. Go back 3 squares.', fx: { t: 'back', n: 3 } },
  { deck: 'kismat', title: 'Proxy caught', text: 'Prof counted heads. Straight to Detention.', fx: { t: 'jail' } },
  { deck: 'kismat', title: 'Doctor\u2019s Note', text: '"Viral fever" 🤒. Keep it to walk out of Detention free.', fx: { t: 'free' } },
  { deck: 'kismat', title: 'Client paid!', text: 'Freelance logo money finally hit your account.', fx: { t: 'cash', amount: 1500 }, power: true },
  { deck: 'kismat', title: 'Salary came early', text: 'HR pressed the button early. Go to Payday.', fx: { t: 'goto', sq: 0 }, power: true },
  { deck: 'kismat', title: 'Warden inspection', text: 'Pay ₹250 per house and ₹1,000 per hotel or villa.', fx: { t: 'repairs', perHouse: 250, perMall: 1000 } },
  { deck: 'kismat', title: 'Birthday treat', text: 'Your bday, your bill. Pay every player ₹200.', fx: { t: 'each', amount: -200 } },
  { deck: 'parivaar', title: 'Split settled', text: 'Everyone finally paid you back on Splitwise. Collect ₹300 from each player.', fx: { t: 'each', amount: 300 } },
  { deck: 'parivaar', title: 'Mom\u2019s UPI', text: '"Kuch kha lena beta." ❤️', fx: { t: 'cash', amount: 1000 } },
  { deck: 'parivaar', title: 'Fees reminder', text: 'Late fee on lab fees. Again.', fx: { t: 'cash', amount: -1000 } },
  { deck: 'parivaar', title: 'Scholarship!', text: 'Your name is on the merit list.', fx: { t: 'cash', amount: 1500 } },
  { deck: 'parivaar', title: '3 AM biryani', text: 'Plus platform fee, plus tip, plus regret.', fx: { t: 'cash', amount: -500 } },
  { deck: 'parivaar', title: 'Tapri calling', text: '"Chai pe chalein?" Go to the Tapri Jackpot.', fx: { t: 'goto', sq: 20 } },
  { deck: 'parivaar', title: 'Cashback lagi', text: 'The scratch card actually worked for once.', fx: { t: 'cash', amount: 800 } },
  { deck: 'parivaar', title: 'Doctor\u2019s Note', text: 'A senior forged a really good one. Keep it to leave Detention free.', fx: { t: 'free' } },
  { deck: 'parivaar', title: 'Backlog in Maths', text: 'Results are out. Go to Detention.', fx: { t: 'jail' } },
  { deck: 'parivaar', title: 'Hackathon trip', text: 'Your team is flying to Hyderabad. Go there now.', fx: { t: 'goto', sq: 34 } },
];

export const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** City events: a festival makes one city trend (rent up), bad news makes it slump (rent down). */
export interface CityEventDef { title: string; reason: string; emoji: string; mult: number }
export const CITY_FESTIVALS: Record<string, CityEventDef> = {
  Patna: { title: 'Chhath Puja', reason: 'Devotees pour into Patna for Chhath', emoji: '🪔', mult: 2 },
  Ranchi: { title: 'Sarhul Utsav', reason: 'Ranchi celebrates the spring festival', emoji: '🌸', mult: 2 },
  Bhopal: { title: 'Lake Festival', reason: 'Boat races fill Bhopal’s Upper Lake', emoji: '🚣', mult: 2 },
  Gwalior: { title: 'Tansen Samaroh', reason: 'Music lovers flock to Gwalior Fort', emoji: '🎶', mult: 2 },
  Nagpur: { title: 'Orange Season', reason: 'Nagpur oranges are selling like hot cakes', emoji: '🍊', mult: 2 },
  Jodhpur: { title: 'Marwar Festival', reason: 'Camel races and folk music in the Blue City', emoji: '🐪', mult: 2 },
  Udaipur: { title: 'Film Shoot', reason: 'A Bollywood crew has booked every palace', emoji: '🎬', mult: 3 },
  Jaipur: { title: 'Literature Festival', reason: 'Authors and fans pack the Pink City', emoji: '📚', mult: 2 },
  Varanasi: { title: 'Dev Deepawali', reason: 'A million diyas light up the ghats', emoji: '🪔', mult: 3 },
  Kanpur: { title: 'Leather Trade Fair', reason: 'Buyers from around the world in Kanpur', emoji: '👞', mult: 2 },
  Lucknow: { title: 'Lucknow Mahotsav', reason: 'Kebabs, kathak and crowds everywhere', emoji: '🍢', mult: 2 },
  Guwahati: { title: 'Bihu', reason: 'Assam dances through Rongali Bihu', emoji: '💃', mult: 2 },
  Bhubaneswar: { title: 'Rath Yatra', reason: 'Pilgrims stream through Odisha', emoji: '🛕', mult: 2 },
  Kolkata: { title: 'Durga Puja', reason: 'Pandal-hopping crowds fill Kolkata', emoji: '🙏', mult: 3 },
  Vadodara: { title: 'Navratri Garba', reason: 'Nine nights of garba in Baroda', emoji: '🥁', mult: 2 },
  Surat: { title: 'Diamond Boom', reason: 'Export orders are pouring into Surat', emoji: '💎', mult: 2 },
  Ahmedabad: { title: 'Kite Festival', reason: 'Uttarayan skies full of kites', emoji: '🪁', mult: 2 },
  Kochi: { title: 'Onam', reason: 'Boat races and sadya feasts in Kerala', emoji: '🛶', mult: 2 },
  Chennai: { title: 'Pongal', reason: 'Harvest celebrations across Chennai', emoji: '🌾', mult: 2 },
  Hyderabad: { title: 'Biryani Week', reason: 'Foodies queue outside every restaurant', emoji: '🍛', mult: 2 },
  Bengaluru: { title: 'Startup Summit', reason: 'Founders and VCs book every hotel', emoji: '🚀', mult: 2 },
  Mumbai: { title: 'Ganesh Chaturthi', reason: 'Bappa’s visarjan brings the city to the streets', emoji: '🐘', mult: 3 },
};
export const CITY_SLUMPS: CityEventDef[] = [
  { title: 'Monsoon Floods', reason: 'Streets are waterlogged — nobody is visiting', emoji: '🌧️', mult: 0.5 },
  { title: 'Power Cut', reason: 'Bijli gone for days — shops shut early', emoji: '🔌', mult: 0.5 },
  { title: 'Traffic Jam', reason: 'A 6-hour jam keeps tourists away', emoji: '🚗', mult: 0.5 },
  { title: 'Water Shortage', reason: 'Tankers only — hotels half empty', emoji: '🚱', mult: 0.5 },
];

// ---- Power-ups (hand of max 2) ----
export type Power = 'shield' | 'double' | 'tele';
export const POWERS: Record<Power, { name: string; icon: string; text: string }> = {
  shield: { name: 'Rent Shield', icon: '🛡️', text: 'Blocks the next rent you would pay. Used automatically.' },
  double: { name: 'Double Dhamaka', icon: '💥', text: 'Play it: the next rent you collect is doubled.' },
  tele: { name: 'Teleport', icon: '🌀', text: 'Play it, then tap any unowned tile to jump there.' },
};
/** Money can be sent to another player in steps of this much. */
export const GIFT_STEP = 500;
/** Seth-ji's loans: borrow in steps of ₹1,000, up to ₹5,000 at a time, 20% interest; Paydays repay ₹1,000. */
export const LOAN = { STEP: 1000, LIMIT: 5000, RATE: 0.2, PAYDAY: 1000 };
/** Teen Set mode: the first player to own this many complete colour sets wins. */
export const SETS_TO_WIN = 3;
/** A city deal can include at most this many cities from each side. */
export const DEAL_MAX = 3;
export const MAX_POWERS = 2;
export const AUCTION_STEP = 200;
export const STREAK_BONUS = 500;
/** From this round on (quick games), every rent is x1.5 so games finish on time. */
/** Placement Season (a rent boost at the end of Quick games) is switched off: 0 rounds. */
export const PLACEMENT_ROUND = 0;
/** Classic has no round limit, so rents climb instead: from round START, every EVERY rounds, rent x STEP (compounding). */
// No rent increase for the first 55 rounds, then a gentle ×1.25 every 5 rounds (×1.25, ×1.56, ×1.95…).
export const MEHNGAI = { START: 55, EVERY: 5, STEP: 1.25 };

// ---- Tapri spin wheel ----
export type SpinPrize = 'pot' | 'half' | 'cash' | 'power' | 'house' | 'none';
export const WHEEL: { prize: SpinPrize; label: string; color: string }[] = [
  { prize: 'pot', label: 'FULL GULLAK', color: '#ffd23f' },
  { prize: 'cash', label: '+₹500', color: '#00c97a' },
  { prize: 'power', label: 'POWER-UP', color: '#9b6bff' },
  { prize: 'half', label: 'HALF GULLAK', color: '#ff8c42' },
  { prize: 'house', label: 'FREE HOUSE', color: '#2b7bff' },
  { prize: 'none', label: 'SETH-JI KEEPS', color: '#ff2d55' },
];
