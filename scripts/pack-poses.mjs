// Pack generated pose art onto the existing 64px room grid. Source art is retained.
import fs from "node:fs";
import { decode, encode, image } from "./png.mjs";
const base = decode(fs.readFileSync("public/photos/winnie-room-v2.png"));
const out = image(192, 640);
base.px.copy(out.px);
const sheets = [
  [
    "a",
    3,
    [
      [56, 38],
      [56, 38],
      [56, 48],
      [52, 51],
      [52, 51],
      [50, 52],
      [55, 49],
      [56, 51],
      [56, 51],
    ],
  ],
  [
    "b",
    2,
    [
      [56, 43],
      [56, 43],
      [50, 52],
      [56, 46],
      [56, 46],
      [56, 32],
    ],
  ],
];
let index = 15;
for (const [name, rows, sizes] of sheets) {
  const src = decode(
    fs.readFileSync(`assets/animation/winnie-poses-${name}.png`),
  );
  const cw = src.w / 3,
    ch = src.h / rows;
  for (let n = 0; n < rows * 3; n++, index++) {
    const x0 = (n % 3) * cw,
      y0 = Math.floor(n / 3) * ch;
    let l = cw,
      r = 0,
      t = ch,
      b = 0;
    // The largest connected silhouette excludes stray droplets and generation noise
    // from the scale calculation, so animation pairs keep the same body size.
    const seen = new Uint8Array(cw * ch);
    let largest = 0;
    for (let start = 0; start < seen.length; start++) {
      if (seen[start]) continue;
      const queue = [start];
      let head = 0,
        count = 0,
        cl = cw,
        cr = 0,
        ct = ch,
        cb = 0;
      seen[start] = 1;
      while (head < queue.length) {
        const p = queue[head++],
          x = p % cw,
          y = Math.floor(p / cw);
        if (src.px[((y0 + y) * src.w + x0 + x) * 4 + 3] < 220) continue;
        count++;
        cl = Math.min(cl, x);
        cr = Math.max(cr, x);
        ct = Math.min(ct, y);
        cb = Math.max(cb, y);
        for (const [nx, ny] of [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ]) {
          if (nx < 0 || nx >= cw || ny < 0 || ny >= ch) continue;
          const next = ny * cw + nx;
          if (!seen[next]) {
            seen[next] = 1;
            queue.push(next);
          }
        }
      }
      if (count > largest) {
        largest = count;
        l = cl;
        r = cr;
        t = ct;
        b = cb;
      }
    }
    const [maxW, maxH] = sizes[n],
      scale = Math.min(maxW / (r - l + 1), maxH / (b - t + 1));
    const w = Math.round((r - l + 1) * scale),
      h = Math.round((b - t + 1) * scale);
    const ox = (index % 3) * 64 + Math.floor((64 - w) / 2),
      oy = Math.floor(index / 3) * 64 + 57 - h;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const sx = x0 + l + Math.min(r - l, Math.floor((x + 0.5) / scale));
        const sy = y0 + t + Math.min(b - t, Math.floor((y + 0.5) / scale));
        const i = (sy * src.w + sx) * 4,
          j = ((oy + y) * out.w + ox + x) * 4;
        if (src.px[i + 3] < 180) continue;
        src.px.copy(out.px, j, i, i + 3);
        out.px[j + 3] = 255;
      }
  }
}
fs.writeFileSync("public/photos/winnie-room-v3.png", encode(out));
console.log("Packed 30 frames at 64px: public/photos/winnie-room-v3.png");
