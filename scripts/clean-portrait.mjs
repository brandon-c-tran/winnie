// Turn an enlarged pixel-art portrait (JPEG noise and all) back into true pixel art.
// The cell size and grid offset come from where colour edges line up (pixel-art edges only
// fall on cell boundaries); each cell then takes the median colour of its centre.
// usage: node scripts/clean-portrait.mjs in.png out.png
import fs from "node:fs";
import { decode, encode, image } from "./png.mjs";

const [inp, out] = process.argv.slice(2);
const src = decode(fs.readFileSync(inp));
const at = (x, y) => (Math.min(src.h - 1, y) * src.w + Math.min(src.w - 1, x)) * 4;
const diff = (i, j) =>
  Math.abs(src.px[i] - src.px[j]) + Math.abs(src.px[i + 1] - src.px[j + 1]) + Math.abs(src.px[i + 2] - src.px[j + 2]);

// edge energy along columns and rows
const cols = new Float64Array(src.w),
  rows = new Float64Array(src.h);
for (let y = 1; y < src.h; y += 1)
  for (let x = 1; x < src.w; x += 1) {
    cols[x] += diff(at(x, y), at(x - 1, y));
    rows[y] += diff(at(x, y), at(x, y - 1));
  }
const score = (energy, cell, off) => {
  let on = 0,
    n = 0;
  for (let k = off; k < energy.length; k += cell, n++) on += energy[Math.round(k)] || 0;
  return on / n;
};
let best = null;
for (let cell = 8; cell <= 30; cell += 0.05)
  for (let off = 0; off < cell; off += 0.5) {
    const s = score(cols, cell, off) + score(rows, cell, off);
    if (!best || s > best.s) best = { s, cell, off };
  }
// refine the row offset separately, with the same cell size
let offY = best.off,
  bestY = -1;
for (let off = 0; off < best.cell; off += 0.5) {
  const s = score(rows, best.cell, off);
  if (s > bestY) (bestY = s), (offY = off);
}
const { cell, off: offX } = best;
const n = Math.floor((src.w - offX) / cell),
  m = Math.floor((src.h - offY) / cell),
  img = image(n, m);
const median = (v) => v.sort((a, b) => a - b)[v.length >> 1];
for (let y = 0; y < m; y++)
  for (let x = 0; x < n; x++) {
    const r = [],
      g = [],
      b = [];
    for (let dy = 0.3; dy <= 0.71; dy += 0.2)
      for (let dx = 0.3; dx <= 0.71; dx += 0.2) {
        const i = at(Math.floor(offX + (x + dx) * cell), Math.floor(offY + (y + dy) * cell));
        r.push(src.px[i]);
        g.push(src.px[i + 1]);
        b.push(src.px[i + 2]);
      }
    const o = (y * n + x) * 4;
    img.px[o] = median(r);
    img.px[o + 1] = median(g);
    img.px[o + 2] = median(b);
    img.px[o + 3] = 255;
  }
fs.writeFileSync(out, encode(img));
console.log(`${out}: ${n}x${m} art pixels (cell ${cell.toFixed(2)}px)`);
