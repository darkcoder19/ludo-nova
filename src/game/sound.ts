// Tiny WebAudio synth — no audio files to download.
let ctx: AudioContext | null = null;
let muted = (() => { try { return localStorage.getItem('ln-muted') === '1'; } catch { return false; } })();

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('ln-muted', m ? '1' : '0'); } catch { /* ignore */ }
}

function ac() {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0, slideTo?: number) {
  if (muted) return;
  const a = ac();
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const buzz = (ms: number | number[]) => { if (!muted) navigator.vibrate?.(ms); };

export const sfx = {
  tap: () => tone(660, 0.06, 'triangle', 0.08),
  roll: () => { for (let i = 0; i < 6; i++) tone(180 + Math.random() * 220, 0.05, 'square', 0.04, i * 0.07); },
  step: () => tone(520 + Math.random() * 60, 0.07, 'triangle', 0.09),
  six: () => { tone(660, 0.12, 'triangle', 0.12); tone(990, 0.18, 'triangle', 0.12, 0.09); },
  capture: () => { tone(880, 0.35, 'sawtooth', 0.09, 0, 110); buzz([40, 30, 80]); },
  captured: () => { tone(300, 0.5, 'sawtooth', 0.08, 0, 60); buzz(200); },
  home: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.11, i * 0.08)),
  turn: () => { tone(784, 0.12, 'sine', 0.12); tone(1175, 0.2, 'sine', 0.1, 0.1); buzz(30); },
  win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, i * 0.12)),
  lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.35, 'sine', 0.1, i * 0.18)),
  pop: () => tone(1200, 0.08, 'sine', 0.08, 0, 500),
};
