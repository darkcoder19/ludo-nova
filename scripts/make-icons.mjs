// Rasterizes the app icon into PNGs (no dependencies) for PWA install + iOS home screen.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex('#0b0820'), W = [255, 255, 255];
const C = { top: hex('#2ee59d'), right: hex('#ffc93c'), bottom: hex('#3d8bff'), left: hex('#ff3d6e') };

function pixel(u, v) {
  const d = Math.hypot(u - 0.5, v - 0.5);
  if (d < 6 / 64) return W;
  if (d < 11 / 64) return BG;
  const m = 8 / 64;
  if (u < m || v < m || u > 1 - m || v > 1 - m) return BG;
  if (v < u && v < 1 - u) return C.top;
  if (v > u && v > 1 - u) return C.bottom;
  return u > 0.5 ? C.right : C.left;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(n) {
  const SS = 3, raw = Buffer.alloc((n * 3 + 1) * n);
  for (let y = 0; y < n; y++) {
    raw[y * (n * 3 + 1)] = 0;
    for (let x = 0; x < n; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const p = pixel((x + (sx + 0.5) / SS) / n, (y + (sy + 0.5) / SS) / n);
        acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2];
      }
      const o = y * (n * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const n of [192, 512]) writeFileSync(`public/icon-${n}.png`, png(n));
console.log('icons written');
