// 不靠任何套件產生 PNG 圖示（iOS 的 apple-touch-icon 必須是 PNG）。
// 用法：node scripts/make-icons.mjs  → public/icons/*.png
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// 深色底滿版（maskable 安全區內放書籤＋淡金星），與畫面標記同一造型
function pixel(u, v) {
  const bg = [44, 33, 28, 255];
  const cream = [246, 241, 234, 255];
  const gold = [196, 165, 116, 255];
  const inX = u >= 0.34 && u <= 0.66;
  const notch = v > 0.64 && Math.abs(u - 0.5) < (v - 0.64) * 0.9;
  if (inX && v >= 0.24 && v <= 0.76 && !notch) {
    const cx = u - 0.5, cy = v - 0.42;
    const r = Math.hypot(cx, cy);
    const t = Math.atan2(cy, cx) + Math.PI / 2;
    const k = Math.cos(5 * t) * 0.5 + 0.5;
    if (r < 0.045 + 0.045 * k) return gold;
    return cream;
  }
  return bg;
}
mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/icons/${name}`, png(size, pixel));
  console.log('wrote public/icons/' + name);
}
