// Cockpit radio chatter for Runway Raja: pilots call in, the tower answers, pilots read back.
// The voice is the browser's speech engine (an Indian-English voice when the phone has one) at a quick radio
// pace. Browsers don't allow that voice to be filtered, so the radio feel comes from what surrounds it, made
// with Web Audio: a push-to-talk click and tone, band-passed static under every call, a crackle that rises
// and falls, and a squelch tail at the end.

export interface Line { who: 'pilot' | 'atc'; text: string; caption: string; voice: number }

const CALL: Record<string, string> = { UD: 'Udaan', MW: 'Maharaja', CJ: 'Chai Jet', MX: 'Monsoon', DK: 'Dhandha', SR: 'Seedhi', HH: 'Haat', GO: 'Patang' };
const DIGIT = ['zero', 'one', 'two', 'tree', 'four', 'fife', 'six', 'seven', 'eight', 'niner'];
/** "UD1742" → "Udaan one seven four two", the way pilots say it. */
export const spoken = (code: string) => `${CALL[code.slice(0, 2)] ?? code.slice(0, 2)} ${code.slice(2).split('').map((d) => DIGIT[Number(d)] ?? d).join(' ')}`;
const rw = (name: string) => name.split('').map((d) => DIGIT[Number(d)] ?? d).join(' ');

let ctx: AudioContext | null = null;
let on = true;
const queue: Line[] = [];
let busy = false;
let onCaption: ((l: Line | null) => void) | null = null;

export function setRadio(v: boolean) { on = v; if (!v) radioReset(); }
export function onRadioCaption(fn: ((l: Line | null) => void) | null) { onCaption = fn; }
export function radioReset() { queue.length = 0; busy = false; try { speechSynthesis.cancel(); } catch { /* no speech */ } onCaption?.(null); }

function audio() {
  if (!ctx) { try { ctx = new AudioContext(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function noiseBuf(a: AudioContext, seconds: number) {
  const len = Math.max(1, Math.floor(a.sampleRate * seconds)), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
/** A burst of band-passed noise: VHF hiss / squelch. */
function burst(seconds: number, vol: number, low = 500, high = 2800) {
  const a = audio(); if (!a) return;
  const src = a.createBufferSource(); src.buffer = noiseBuf(a, seconds);
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = low;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = high;
  const g = a.createGain(); g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + seconds);
  src.connect(hp).connect(lp).connect(g).connect(a.destination); src.start();
}
/** The short tone and click of a push-to-talk button. */
function ptt(atc: boolean) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sine'; o.frequency.value = atc ? 1250 : 980;
  g.gain.setValueAtTime(0.06, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.09);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.1);
  burst(0.06, 0.12, 1500, 4000);
}
/** Static that sits under the voice while it talks, with a slow crackle. */
function bed() {
  const a = audio(); if (!a) return () => {};
  const src = a.createBufferSource(); src.buffer = noiseBuf(a, 2); src.loop = true;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.9;
  const g = a.createGain(); g.gain.value = 0.045;
  const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 0.02; lfo.connect(lg).connect(g.gain); lfo.start();
  src.connect(bp).connect(g).connect(a.destination); src.start();
  return () => { try { g.gain.cancelScheduledValues(a.currentTime); g.gain.setValueAtTime(g.gain.value, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.08); src.stop(a.currentTime + 0.1); lfo.stop(a.currentTime + 0.1); } catch { /* stopped */ } };
}

let voices: SpeechSynthesisVoice[] = [];
const loadVoices = () => { try { voices = speechSynthesis.getVoices(); } catch { voices = []; } };
if (typeof speechSynthesis !== 'undefined') { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function pickVoice(who: 'pilot' | 'atc', n: number) {
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const indian = en.filter((v) => /en[-_]IN/i.test(v.lang) || /India/i.test(v.name));
  const pool = indian.length ? indian : en;
  if (!pool.length) return null;
  return who === 'atc' ? pool[0] : pool[n % pool.length];
}

function next() {
  if (busy || !queue.length || !on) return;
  const l = queue.shift()!;
  busy = true;
  onCaption?.(l);
  ptt(l.who === 'atc');
  let stop = () => {};
  const done = () => { stop(); burst(0.28, 0.16, 400, 3200); busy = false; setTimeout(() => { if (!queue.length) onCaption?.(null); next(); }, 180); };
  if (typeof speechSynthesis === 'undefined' || !voices.length) { setTimeout(done, 700 + l.text.length * 22); return; }
  const u = new SpeechSynthesisUtterance(l.text);
  const v = pickVoice(l.who, l.voice); if (v) u.voice = v;
  // radio talk is fast and clipped
  u.rate = l.who === 'atc' ? 1.55 : 1.45 + (l.voice % 3) * 0.08;
  u.pitch = l.who === 'atc' ? 0.8 : 0.7 + (l.voice % 5) * 0.1;
  u.volume = 0.75;
  u.onstart = () => { stop = bed(); };
  u.onend = done; u.onerror = done;
  setTimeout(() => { try { speechSynthesis.speak(u); } catch { done(); } }, 90);
}

/** Queue calls; old chatter is dropped when the frequency is crowded. */
export function say(...lines: Line[]) {
  if (!on) return;
  queue.push(...lines);
  while (queue.length > 4) queue.shift();
  next();
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const vOf = (code: string) => [...code].reduce((s, c) => s + c.charCodeAt(0), 0);
const P = (code: string, text: string): Line => ({ who: 'pilot', text, caption: `${code}: ${text}`, voice: vOf(code) });
const T = (text: string): Line => ({ who: 'atc', text, caption: `Tower: ${text}`, voice: 0 });

export const radio = {
  inbound: (code: string, fix: string, heli: boolean) => say(P(code, pick([
    `Raja Tower, ${spoken(code)}, ${heli ? 'helicopter, ' : ''}holding at ${fix}, request landing.`,
    `Hello Raja Tower, ${spoken(code)}, inbound at ${fix}, requesting to land.`,
    `Tower, ${spoken(code)}, ${fix}, ready for approach.`]))),
  land: (code: string, runway: string | null) => say(
    T(runway ? `${spoken(code)}, runway ${rw(runway)}, cleared to land.` : `${spoken(code)}, helipad, cleared to land.`),
    P(code, runway ? `Cleared to land ${rw(runway)}, ${spoken(code)}.` : `Cleared to land, pad, ${spoken(code)}.`)),
  hold: (code: string) => say(T(`${spoken(code)}, hold present position.`), P(code, `Holding, ${spoken(code)}.`)),
  goAround: (code: string, why: string) => say(T(`${spoken(code)}, go around, ${why}.`), P(code, `Going around, ${spoken(code)}.`)),
  ready: (code: string, gate: number) => say(P(code, `Tower, ${spoken(code)}, gate ${DIGIT[gate]}, ready for departure.`)),
  takeoff: (code: string, runway: string) => say(T(`${spoken(code)}, runway ${rw(runway)}, cleared for take-off.`), P(code, `Cleared for take-off ${rw(runway)}, ${spoken(code)}.`)),
  lineUp: (code: string, runway: string) => say(T(`${spoken(code)}, line up and wait, runway ${rw(runway)}.`), P(code, `Line up and wait, ${spoken(code)}.`)),
  mayday: (code: string) => say(P(code, `Mayday, mayday, ${spoken(code)}, low fuel, request immediate landing.`)),
  landed: (code: string) => say(pick([P(code, `${spoken(code)}, down and clear, thanks Tower.`), T(`${spoken(code)}, welcome to Raja, vacate left.`)])),
  wind: (runways: string) => say(T(`All stations, wind change, runways ${runways} now in use.`)),
  traffic: (code: string) => say(T(`${spoken(code)}, traffic alert, traffic close by!`)),
};
