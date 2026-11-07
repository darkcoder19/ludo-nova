// Festival themes for the DhandhaKing board: each festival dresses the whole board and game in its own colours,
// floating particles and Seth-ji greetings; outside festivals the board is back to Classic.
export type ThemeId = 'diwali' | 'holi' | 'xmas' | 'tiranga' | 'cricket' | 'ganesh' | 'navratri';

export const THEMES: Record<ThemeId, { name: string; emoji: string; tag: string; particles: string[]; motion: 'rise' | 'fall' | 'drift'; greet: string[] }> = {
  diwali: { name: 'Diwali', emoji: '🪔', tag: 'Shubh Deepavali!', particles: ['🪔', '✨', '🎆', '✨'], motion: 'rise',
    greet: ['Shubh Deepavali! Aaj har rent mein Lakshmi-ji ka aashirwad 🪔', 'Diye jalao, property badhao! Happy Diwali ✨', 'Diwali bonus milega Payday pe. Kharcha soch samajh ke 😏'] },
  holi: { name: 'Holi', emoji: '🎨', tag: 'Bura na mano, Holi hai!', particles: ['🟣', '🟡', '🩷', '🟢', '🔵'], motion: 'drift',
    greet: ['Bura na mano, Holi hai! Rent bhi rang-birangi 🎨', 'Gulal udao, cities kharido! Happy Holi 🌈', 'Holi hai! Aaj Seth-ji bhi gulabi 😄'] },
  xmas: { name: 'Christmas & New Year', emoji: '🎄', tag: 'Merry Christmas & Happy New Year!', particles: ['❄️', '❄️', '⭐', '🎁'], motion: 'fall',
    greet: ['Merry Christmas! Santa bhi rent deta hai yahan 🎅', 'Naya saal, naye plots! Happy New Year 🎉', 'Jingle bells, kiraya tells 🔔'] },
  tiranga: { name: 'Tiranga', emoji: '🇮🇳', tag: 'Jai Hind!', particles: ['🪁', '🧡', '🤍', '💚'], motion: 'drift',
    greet: ['Jai Hind! Aaj desh ke naam ek property 🇮🇳', 'Patang udao, dhandha badhao! 🪁', 'Azadi ka jashn, dhandhe ki aazadi! Jai Hind'] },
  cricket: { name: 'Cricket Season', emoji: '🏏', tag: 'Howzat! Cricket season is on', particles: ['🏏', '🏆', '⚾', '🎉'], motion: 'drift',
    greet: ['Cricket season! Har roll ek chhakka ho 🏏', 'Howzat! Rent out nahi hota 😏', 'Stadium full, plots full! Cricket fever 🏆'] },
  ganesh: { name: 'Ganesh Chaturthi', emoji: '🐘', tag: 'Ganpati Bappa Morya!', particles: ['🌼', '🌺', '🌸', '✨'], motion: 'fall',
    greet: ['Ganpati Bappa Morya! Vighna hatao, dhandha badhao 🐘', 'Modak khao, plot kharido 🌼', 'Bappa ka aashirwad, rent ki barsaat 🌺'] },
  navratri: { name: 'Navratri & Durga Puja', emoji: '💃', tag: 'Garba nights are here!', particles: ['🌸', '✨', '🪘', '🌺'], motion: 'rise',
    greet: ['Navratri ki shubhkamnayein! Garba karo, deal karo 💃', 'Dandiya raas aur dhandhe ki baat 🪘', 'Maa Durga ki kripa, kiraye ki varsha 🌺'] },
};

const BY_FEST: Record<string, ThemeId> = { diwali: 'diwali', diwali27: 'diwali', xmas: 'xmas', republic: 'tiranga', azadi: 'tiranga', holi: 'holi', ipl: 'cricket', ganesh: 'ganesh', navratri: 'navratri' };
export const themeOfFest = (id?: string | null): ThemeId | null => (id ? BY_FEST[id] ?? null : null);
