// Reproducible nearest-neighbour packing; the generated source remains untouched.
import fs from 'node:fs';
import { decode, encode, image } from './png.mjs';
const source = decode(fs.readFileSync('assets/animation/winnie-harness.png'));
const original = decode(fs.readFileSync('public/photos/winnie-room-v3.png'));
const output = image(192, 128);
function bounds(img, index, size) {
  const ox = index % 3 * size, oy = Math.floor(index / 3) * size;
  let l = size, t = size, r = 0, b = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (img.px[((oy + y) * img.w + ox + x) * 4 + 3] < 220) continue;
    l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
  }
  return { x: ox + l, y: oy + t, l, t, w: r - l + 1, h: b - t + 1 };
}
for (let n = 0; n < 6; n++) {
  const src = bounds(source, n, source.w / 3), dest = bounds(original, n, 64);
  for (let y = 0; y < dest.h; y++) for (let x = 0; x < dest.w; x++) {
    const sx = src.x + Math.min(src.w - 1, Math.floor((x + 0.5) * src.w / dest.w));
    const sy = src.y + Math.min(src.h - 1, Math.floor((y + 0.5) * src.h / dest.h));
    const a = (sy * source.w + sx) * 4, b = ((dest.y + y) * output.w + dest.x + x) * 4;
    if (source.px[a + 3] < 180) continue;
    source.px.copy(output.px, b, a, a + 3); output.px[b + 3] = 255;
  }
}
fs.writeFileSync('public/photos/winnie-harness-v1.png', encode(output));
console.log('Packed six harness poses, aligned to the existing room sprite.');
