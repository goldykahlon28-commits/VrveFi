// Generates VrveFi PNG app icons (no dependencies) for the PWA / Play Store.
//   node tools/gen-icons.js
// Mark: the VrveFi "V" rising into a 3-bar growth chart (white on accent blue),
// reproduced from the Canva logo concept.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const BG = [44, 92, 220];      // #2c5cdc accent
const FG = [255, 255, 255];    // white mark

// ---- CRC32 / PNG encoder ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
// signed distance to a rounded rect (negative inside, positive outside)
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2, cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

// Mark defined on a 100×100 grid (matches the inline SVG in index.html).
//  - left V stroke: (24,24) -> (50,78)
//  - three rising bars forming the right arm
const STROKE = { ax: 24, ay: 24, bx: 50, by: 78, hw: 6 };
const BARS = [
  { x: 54, y: 60, w: 10, h: 18, r: 3 },
  { x: 67, y: 46, w: 10, h: 32, r: 3 },
  { x: 80, y: 30, w: 10, h: 48, r: 3 },
];

function markCoverage(gx, gy) {
  // gx,gy in 100-grid units. Returns 0..1 white coverage with ~AA.
  let cov = 0;
  const ds = distSeg(gx, gy, STROKE.ax, STROKE.ay, STROKE.bx, STROKE.by);
  cov = Math.max(cov, Math.min(1, STROKE.hw + 0.4 - ds));
  for (const b of BARS) {
    const sd = sdRoundRect(gx, gy, b.x, b.y, b.w, b.h, b.r);
    cov = Math.max(cov, Math.min(1, 0.5 - sd)); // negative inside -> full white
  }
  return Math.max(0, cov);
}

function drawIcon(size, markScale, rounded) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = rounded ? size * 0.22 : 0;
  const box = size * markScale, ox = (size - box) / 2, oy = (size - box) / 2;
  const G = 100 / box; // pixel -> grid scale
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // background (optionally rounded corners -> transparent outside)
      let bgA = 1;
      if (radius) {
        const cx = Math.max(radius, Math.min(x + 0.5, size - radius));
        const cy = Math.max(radius, Math.min(y + 0.5, size - radius));
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - radius;
        bgA = Math.max(0, Math.min(1, 0.5 - d));
      }
      const gx = (x + 0.5 - ox) * G, gy = (y + 0.5 - oy) * G;
      const m = markCoverage(gx, gy);
      const r = Math.round(BG[0] * (1 - m) + FG[0] * m);
      const g = Math.round(BG[1] * (1 - m) + FG[1] * m);
      const b = Math.round(BG[2] * (1 - m) + FG[2] * m);
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = Math.round(255 * bgA);
    }
  }
  return encodePNG(size, size, buf);
}

const jobs = [
  ['icon-192.png', 192, 0.62, true],
  ['icon-512.png', 512, 0.62, true],
  ['icon-maskable-512.png', 512, 0.52, false], // full-bleed bg + safe-zone mark
];
for (const [name, size, scale, rounded] of jobs) {
  fs.writeFileSync(path.join(OUT, name), drawIcon(size, scale, rounded));
  console.log('wrote icons/' + name);
}
console.log('done');
