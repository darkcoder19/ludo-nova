// Haat Hustle: an original trade-and-build game set in an Indian village market.
// Plots produce goods when the monsoon favours them; goods build stalls, godowns and havelis,
// fill public orders, or get traded at a mandi whose prices move with supply and demand.

export type Good = 'cotton' | 'spice' | 'tea' | 'brick' | 'rice';
export const GOODS: Good[] = ['cotton', 'spice', 'tea', 'brick', 'rice'];
export const GOOD_INFO: Record<Good, { name: string; hindi: string; color: string }> = {
  cotton: { name: 'Cotton', hindi: 'Kapas', color: '#f4f1ff' },
  spice: { name: 'Spice', hindi: 'Masala', color: '#ff4d4d' },
  tea: { name: 'Tea', hindi: 'Chai patti', color: '#3fbf6a' },
  brick: { name: 'Brick', hindi: 'Eent', color: '#d9743a' },
  rice: { name: 'Rice', hindi: 'Chawal', color: '#ffd23f' },
};

export type Terrain = Good | 'mandi' | 'banjar';
export const TERRAIN_NAME: Record<Terrain, string> = {
  cotton: 'Kapas khet', spice: 'Mirchi bagh', tea: 'Chai bagaan', brick: 'Eent bhatta', rice: 'Dhaan khet', mandi: 'Mandi', banjar: 'Banjar zameen',
};

/** The map is 7 × 5 plots; on tall phone screens it is drawn sideways (5 × 7). */
export const COLS = 7;
export const ROWS = 5;
export const MANDI = 2 * COLS + 3; // the centre plot

/** Building levels on a plot: 1 stall → 2 godown → 3 haveli. */
export const LEVEL_NAME = ['', 'Stall', 'Godown', 'Haveli'];
export const LEVEL_IZZAT = [0, 1, 2, 4];
/** Goods a plot yields when its crop is in season, by level. */
export const LEVEL_YIELD = [0, 1, 2, 2];

export type Cost = { goods: Partial<Record<Good, number>>; cash: number };
export const COSTS: Record<'stall' | 'godown' | 'haveli', Cost> = {
  stall: { goods: { brick: 1, rice: 1, cotton: 1 }, cash: 20 },
  godown: { goods: { brick: 2, tea: 1 }, cash: 40 },
  haveli: { goods: { cotton: 2, spice: 2 }, cash: 80 },
};

export const START_CASH = 80;
export const PRICE_BASE = 30;
export const PRICE_MIN = 10;
export const PRICE_MAX = 90;
/** The mandi buys at its price and sells at its price + this spread. */
export const BUY_SPREAD = 15;
export const SELL_DROP = 4;
export const BUY_RISE = 8;

export type MonsoonKind = 'season' | 'bumper' | 'drought' | 'mela';
export interface Monsoon { kind: MonsoonKind; goods: Good[]; title: string; text: string }
const pair = (a: Good, b: Good): Monsoon => ({ kind: 'season', goods: [a, b], title: 'Monsoon', text: `${GOOD_INFO[a].hindi} and ${GOOD_INFO[b].hindi} are in season.` });
const single = (g: Good): Monsoon => ({ kind: 'season', goods: [g], title: 'Monsoon', text: `${GOOD_INFO[g].hindi} is in season.` });
/** 24 cards: mostly one crop in season, sometimes two, a bumper crop, a drought or a perfect mela. */
export const MONSOON: Monsoon[] = [
  ...GOODS.flatMap((g) => [single(g), single(g), single(g)]),
  pair('cotton', 'spice'), pair('tea', 'brick'), pair('rice', 'spice'), pair('cotton', 'tea'), pair('brick', 'rice'),
  ...(['spice', 'tea'] as Good[]).map((g): Monsoon => ({ kind: 'bumper', goods: [g], title: `Bumper ${GOOD_INFO[g].hindi}!`, text: `Only ${GOOD_INFO[g].hindi} grows, but every plot of it yields double.` })),
  { kind: 'drought', goods: [], title: 'Sukha (drought)', text: 'Nothing grows. Scarcity pushes every mandi price up ₹8.' },
  { kind: 'mela', goods: [...GOODS], title: 'Kisan Mela!', text: 'A perfect season: every plot yields.' },
];

export interface Order { title: string; need: Partial<Record<Good, number>>; izzat: number; cash: number }
export const ORDERS: Order[] = [
  { title: 'Shaadi ka Khana', need: { rice: 2, spice: 2 }, izzat: 2, cash: 40 },
  { title: 'Diwali Mithai', need: { rice: 2, tea: 1, cotton: 1 }, izzat: 2, cash: 40 },
  { title: 'Export to Dubai', need: { spice: 2, tea: 2, cotton: 1 }, izzat: 3, cash: 60 },
  { title: 'School Uniforms', need: { cotton: 3, brick: 1 }, izzat: 2, cash: 30 },
  { title: 'New Metro Station', need: { brick: 3, rice: 1 }, izzat: 2, cash: 30 },
  { title: 'Tapri Franchise', need: { tea: 3, rice: 1 }, izzat: 2, cash: 30 },
  { title: 'Kurta Startup', need: { cotton: 2, spice: 1, tea: 1 }, izzat: 2, cash: 40 },
  { title: 'Hostel Mess', need: { rice: 2, spice: 1, brick: 1 }, izzat: 2, cash: 40 },
  { title: 'Temple Repairs', need: { brick: 2, cotton: 2 }, izzat: 2, cash: 30 },
  { title: 'Spice Route', need: { spice: 3, tea: 1 }, izzat: 2, cash: 30 },
  { title: 'Big Fat Wedding', need: { cotton: 2, spice: 2, rice: 2 }, izzat: 3, cash: 80 },
  { title: 'London Tea Auction', need: { tea: 3, spice: 2 }, izzat: 3, cash: 60 },
];
export const OPEN_ORDERS = 3;
export const MAX_ROUNDS = 30;
