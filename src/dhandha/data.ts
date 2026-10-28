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
  { kind: 'start', name: 'Shuruaat', short: 'START', icon: '🚩' },
  city('Patna', 'Patna', 0, 600, 20),
  { kind: 'parivaar', name: 'Parivaar', short: 'Parivaar', icon: '👪' },
  city('Ranchi', 'Ranchi', 0, 600, 40),
  { kind: 'tax', name: 'Income Tax', short: 'Tax', tax: 2000, icon: '🧾' },
  { kind: 'train', name: 'Rajdhani Express', short: 'Rajdhani', price: 2000, icon: '🚆' },
  city('Bhopal', 'Bhopal', 1, 1000, 60),
  { kind: 'kismat', name: 'Kismat', short: 'Kismat', icon: '🎲' },
  city('Indore', 'Indore', 1, 1000, 60),
  city('Nagpur', 'Nagpur', 1, 1200, 80),
  { kind: 'jail', name: 'Sasural', short: 'Sasural', icon: '👵' },
  city('Jodhpur', 'Jodhpur', 2, 1400, 100),
  { kind: 'utility', name: 'Bijli Board', short: 'Bijli', price: 1500, icon: '⚡' },
  city('Udaipur', 'Udaipur', 2, 1400, 100),
  city('Jaipur', 'Jaipur', 2, 1600, 120),
  { kind: 'train', name: 'Shatabdi Express', short: 'Shatabdi', price: 2000, icon: '🚄' },
  city('Varanasi', 'Varanasi', 3, 1800, 140),
  { kind: 'parivaar', name: 'Parivaar', short: 'Parivaar', icon: '👪' },
  city('Kanpur', 'Kanpur', 3, 1800, 140),
  city('Lucknow', 'Lucknow', 3, 2000, 160),
  { kind: 'chai', name: 'Chai Break', short: 'Chai', icon: '☕' },
  city('Guwahati', 'Guwahati', 4, 2200, 180),
  { kind: 'kismat', name: 'Kismat', short: 'Kismat', icon: '🎲' },
  city('Bhubaneswar', 'BBSR', 4, 2200, 180),
  city('Kolkata', 'Kolkata', 4, 2400, 200),
  { kind: 'train', name: 'Duronto Express', short: 'Duronto', price: 2000, icon: '🚅' },
  city('Vadodara', 'Baroda', 5, 2600, 220),
  city('Surat', 'Surat', 5, 2600, 220),
  { kind: 'utility', name: 'Jal Board', short: 'Jal', price: 1500, icon: '💧' },
  city('Ahmedabad', 'Amdavad', 5, 2800, 240),
  { kind: 'police', name: 'Rishta Pakka!', short: 'Rishta!', icon: '💍' },
  city('Kochi', 'Kochi', 6, 3000, 260),
  city('Chennai', 'Chennai', 6, 3000, 260),
  { kind: 'parivaar', name: 'Parivaar', short: 'Parivaar', icon: '👪' },
  city('Hyderabad', 'Hyd', 6, 3200, 280),
  { kind: 'train', name: 'Vande Bharat', short: 'Vande B.', price: 2000, icon: '🚝' },
  { kind: 'kismat', name: 'Kismat', short: 'Kismat', icon: '🎲' },
  city('Bengaluru', "B'luru", 7, 3500, 350),
  { kind: 'tax', name: 'GST', short: 'GST', tax: 1000, icon: '💸' },
  city('Mumbai', 'Mumbai', 7, 4000, 500),
];

export const SALARY = 2000;
export const START_CASH = 15000;
export const BAIL = 500; // shagun for Saasu-ma to leave Sasural early
export const JAIL = 10;
export const MAX_BUILD = 5; // 3 houses, then a hotel, then a villa

/** What stands on a city with `n` buildings. */
export const BUILD_LEVELS = ['Empty plot', '1 House', '2 Houses', '3 Houses', 'Hotel', 'Villa'];
export const buildIcon = (n: number) => (n >= 5 ? '🏰' : n === 4 ? '🏨' : '🏠'.repeat(n));
/** Building costs climb: houses at the group price, hotel ×1.5, villa ×2. */
export const buildCost = (base: number, next: number) => (next === 5 ? base * 2 : next === 4 ? Math.round(base * 1.5) : base);
/** The bank buys a city card back at 70% (20% if mortgaged), plus half of what was built. */
export const SELL_RATE = 0.7;

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

export interface Card { title: string; text: string; fx: CardFx; deck: 'kismat' | 'parivaar' }

export const CARDS: Card[] = [
  { deck: 'kismat', title: 'Lottery lagi!', text: 'Your Diwali lottery ticket won. Collect ₹2,000.', fx: { t: 'cash', amount: 2000 } },
  { deck: 'kismat', title: 'Traffic challan', text: 'No helmet on the Activa. Pay ₹300.', fx: { t: 'cash', amount: -300 } },
  { deck: 'kismat', title: 'Mumbai calling', text: 'Big meeting at Nariman Point. Go to Mumbai.', fx: { t: 'goto', sq: 39 } },
  { deck: 'kismat', title: 'Wrong train!', text: 'Boarded the wrong platform. Go back 3 squares.', fx: { t: 'back', n: 3 } },
  { deck: 'kismat', title: 'Rishta aaya!', text: 'Mummy fixed a rishta for you. Go straight to Sasural.', fx: { t: 'jail' } },
  { deck: 'kismat', title: 'Jugaad card', text: 'Your bestie fakes an urgent call. Keep this to escape Sasural free.', fx: { t: 'free' } },
  { deck: 'kismat', title: 'Startup funded', text: 'Your chai startup raised a seed round. Collect ₹1,500.', fx: { t: 'cash', amount: 1500 } },
  { deck: 'kismat', title: 'Back to basics', text: 'Advance to Shuruaat. Collect ₹2,000.', fx: { t: 'goto', sq: 0 } },
  { deck: 'kismat', title: 'Monsoon damage', text: 'Pay ₹250 per house and ₹1,000 per hotel or villa for repairs.', fx: { t: 'repairs', perHouse: 250, perMall: 1000 } },
  { deck: 'kismat', title: 'Shaadi season', text: 'Your cousin’s wedding. Pay every player ₹200 for gifts.', fx: { t: 'each', amount: -200 } },
  { deck: 'parivaar', title: 'Shagun mila!', text: 'Birthday shagun from everyone. Collect ₹300 from each player.', fx: { t: 'each', amount: 300 } },
  { deck: 'parivaar', title: 'Dadi’s savings', text: 'Dadi slipped you some cash. Collect ₹1,000.', fx: { t: 'cash', amount: 1000 } },
  { deck: 'parivaar', title: 'School fees', text: 'Tuition fees due. Pay ₹1,000.', fx: { t: 'cash', amount: -1000 } },
  { deck: 'parivaar', title: 'FD matured', text: 'Your fixed deposit matured. Collect ₹1,500.', fx: { t: 'cash', amount: 1500 } },
  { deck: 'parivaar', title: 'Doctor visit', text: 'Too many samosas. Pay ₹500.', fx: { t: 'cash', amount: -500 } },
  { deck: 'parivaar', title: 'Bengaluru trip', text: 'Family trip to Bengaluru. Advance there.', fx: { t: 'goto', sq: 37 } },
  { deck: 'parivaar', title: 'Tax refund', text: 'ITR refund arrived. Collect ₹800.', fx: { t: 'cash', amount: 800 } },
  { deck: 'parivaar', title: 'Jugaad card', text: 'Didi covers for you. Keep this to escape Sasural free.', fx: { t: 'free' } },
  { deck: 'parivaar', title: 'Pandit ji says', text: 'Shubh muhurat! Go directly to Sasural.', fx: { t: 'jail' } },
  { deck: 'parivaar', title: 'Kitty party win', text: 'You won the kitty pot. Collect ₹500.', fx: { t: 'cash', amount: 500 } },
];

export const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
