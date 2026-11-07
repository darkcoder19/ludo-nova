// End-of-game recap: a card of the game's best moments that can be shared as an image or on WhatsApp.
import { useState } from 'react';
import { sfx } from '../game/sound';

export interface RecapData { title: string; sub: string; lines: { emoji: string; text: string }[] }

const SITE = 'sarvimo.com/games';

/** Draws the recap as a 1080×1350 image (portrait, fits WhatsApp and Instagram stories). */
export function drawRecap(d: RecapData): HTMLCanvasElement {
  const W = 1080, H = 1350, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#4a2fa8'); bg.addColorStop(0.55, '#24166a'); bg.addColorStop(1, '#160e45');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // confetti dots
  const dots = ['#ffd23f', '#ff4fd8', '#12d6b4', '#ff8c42', '#2b7bff'];
  // confetti in the top and bottom margins only, away from the text
  for (let i = 0; i < 40; i++) {
    const top = i % 2 === 0, cx = (i * 211 + 37) % W, cy = top ? 14 + ((i * 53) % 70) : H - 150 + ((i * 41) % 40);
    x.fillStyle = dots[i % dots.length]; x.globalAlpha = 0.35; x.beginPath(); x.arc(cx, cy, 5 + (i % 4) * 3, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
  const font = (w: number, s: number) => `${w} ${s}px "Segoe UI", system-ui, -apple-system, Roboto, "Noto Color Emoji", sans-serif`;
  x.textAlign = 'center';
  const tg = x.createLinearGradient(200, 0, 880, 0); tg.addColorStop(0, '#ffe04a'); tg.addColorStop(1, '#ff8c42');
  x.fillStyle = tg; x.font = font(900, 92); x.fillText(d.title, W / 2, 200);
  x.fillStyle = '#d9d4f5'; x.font = font(700, 40); x.fillText(d.sub, W / 2, 262);
  // lines as rounded rows
  x.textAlign = 'left';
  let y = 330;
  const wrap = (t: string, max: number) => {
    const words = t.split(' '), out: string[] = []; let line = '';
    for (const w of words) { const test = line ? `${line} ${w}` : w; if (x.measureText(test).width > max && line) { out.push(line); line = w; } else line = test; }
    if (line) out.push(line);
    return out.slice(0, 2);
  };
  for (const l of d.lines.slice(0, 7)) {
    x.font = font(700, 38);
    const rows = wrap(l.text, 780), h = 54 + rows.length * 46;
    x.fillStyle = 'rgba(255,255,255,0.09)';
    x.beginPath(); if (x.roundRect) x.roundRect(70, y, W - 140, h, 28); else x.rect(70, y, W - 140, h); x.fill(); // older Safari has no roundRect
    x.font = font(400, 60); x.fillStyle = '#fff'; x.fillText(l.emoji, 100, y + h / 2 + 21);
    x.font = font(700, 38); x.fillStyle = '#fff';
    rows.forEach((r, k) => x.fillText(r, 200, y + 58 + k * 46));
    y += h + 18;
  }
  x.textAlign = 'center'; x.fillStyle = '#ffd23f'; x.font = font(900, 44); x.fillText(`Play free · ${SITE}`, W / 2, H - 70);
  return c;
}

async function shareImage(d: RecapData) {
  const blob: Blob | null = await new Promise((r) => drawRecap(d).toBlob(r, 'image/png'));
  if (!blob) return;
  const file = new File([blob], `${d.title.toLowerCase().replace(/\W+/g, '-')}.png`, { type: 'image/png' });
  const text = `${d.title}: ${d.lines.map((l) => `${l.emoji} ${l.text}`).join('\n')}\nPlay free at https://${SITE}`;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return; } catch { /* cancelled */ return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function RecapModal({ d, onClose }: { d: RecapData; onClose(): void }) {
  const [busy, setBusy] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${d.title} 🎲\n${d.lines.map((l) => `${l.emoji} ${l.text}`).join('\n')}\nPlay free: https://${SITE}`)}`;
  return (
    <div className="overlay recap-ov" onClick={onClose}>
      <div className="recap-card" onClick={(e) => e.stopPropagation()}>
        <div className="rc-head"><b>{d.title}</b><small>{d.sub}</small></div>
        <ol className="rc-lines">{d.lines.map((l, i) => <li key={i} style={{ animationDelay: `${i * 90}ms` }}><span>{l.emoji}</span><p>{l.text}</p></li>)}</ol>
        <small className="rc-foot">Play free · {SITE}</small>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={async () => { sfx.tap(); setBusy(true); await shareImage(d); setBusy(false); }}>📸 Share</button>
          <a className="btn glass" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  );
}
