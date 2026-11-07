// Real-calendar festivals: during these dates every Sarvimo game gets a festive look, double quest XP
// and (in DhandhaKing) a festival perk. Playing during a festival collects its dice skin for good.
import { localDay } from './progress';

export type FestPerk = 'bonus' | 'gullak' | 'trend';
export interface Festival { id: string; name: string; emoji: string; from: string; to: string; perk: FestPerk; perkText: string; skin?: string; colors: [string, string] }

/** Dates are local calendar days (inclusive). Add next year's dates as they are announced. */
export const FESTIVALS: Festival[] = [
  { id: 'diwali', name: 'Diwali', emoji: '🪔', from: '2026-11-04', to: '2026-11-12', perk: 'bonus', perkText: 'Payday +₹500 Diwali bonus', skin: 'diya', colors: ['#ffb400', '#ff4f1f'] },
  { id: 'xmas', name: 'Christmas & New Year', emoji: '🎄', from: '2026-12-22', to: '2027-01-02', perk: 'gullak', perkText: 'Tapri gullak starts with ₹1,500', colors: ['#12d67a', '#ff2d55'] },
  { id: 'republic', name: 'Republic Day', emoji: '🇮🇳', from: '2027-01-24', to: '2027-01-27', perk: 'bonus', perkText: 'Payday +₹500', colors: ['#ff9933', '#138808'] },
  { id: 'holi', name: 'Holi', emoji: '🎨', from: '2027-03-19', to: '2027-03-24', perk: 'trend', perkText: 'Two cities start trending', skin: 'holi', colors: ['#ff4fd8', '#12d6b4'] },
  { id: 'ipl', name: 'Cricket Season', emoji: '🏏', from: '2027-03-25', to: '2027-05-30', perk: 'trend', perkText: 'Two cities start trending', colors: ['#2b7bff', '#ffd23f'] },
  { id: 'azadi', name: 'Independence Day', emoji: '🇮🇳', from: '2027-08-13', to: '2027-08-16', perk: 'bonus', perkText: 'Payday +₹500', colors: ['#ff9933', '#138808'] },
  { id: 'ganesh', name: 'Ganesh Chaturthi', emoji: '🐘', from: '2027-09-03', to: '2027-09-14', perk: 'gullak', perkText: 'Tapri gullak starts with ₹1,500', colors: ['#ff8c42', '#ffd23f'] },
  { id: 'navratri', name: 'Navratri & Durga Puja', emoji: '💃', from: '2027-09-30', to: '2027-10-10', perk: 'trend', perkText: 'Two cities start trending', colors: ['#ff2d55', '#ffb400'] },
  { id: 'diwali27', name: 'Diwali', emoji: '🪔', from: '2027-10-25', to: '2027-11-02', perk: 'bonus', perkText: 'Payday +₹500 Diwali bonus', skin: 'diya', colors: ['#ffb400', '#ff4f1f'] },
];

export const festivalOn = (day = localDay()) => FESTIVALS.find((f) => day >= f.from && day <= f.to) ?? null;
export const festivalById = (id?: string | null) => FESTIVALS.find((f) => f.id === id) ?? null;
/** The next festival still to come, for a "coming soon" hint. */
export const nextFestival = (day = localDay()) => FESTIVALS.filter((f) => f.from > day).sort((a, b) => a.from.localeCompare(b.from))[0] ?? null;
