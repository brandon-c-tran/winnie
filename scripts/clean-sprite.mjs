// Re-pixelate the 384x256 soft sprite sheet into true pixel art:
// 2x2 blocks -> 1 art pixel (mode color), hard alpha, median-cut palette.
// usage: node clean-sprite.mjs in.png out.png [colors]
import fs from "node:fs";
import zlib from "node:zlib";

const [inp, out, nColors = "32"] = process.argv.slice(2);

function decode(buf) {
  let pos = 8, idat = [], w, h;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8);
    const d = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); }
    if (type === "IDAT") idat.push(d);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, px };
}
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function encode(w, h, px) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const src = decode(fs.readFileSync(inp));
const W = src.w / 2, H = src.h / 2, dst = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const cols = [];
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const i = ((y * 2 + dy) * src.w + x * 2 + dx) * 4;
    cols.push([src.px[i], src.px[i + 1], src.px[i + 2], src.px[i + 3]]);
  }
  const opaque = cols.filter((c) => c[3] > 110);
  const o = (y * W + x) * 4;
  if (opaque.length < 2) { dst[o + 3] = 0; continue; }
  // average of opaque samples (2x2 at this source scale is one art pixel + noise)
  const avg = [0, 1, 2].map((k) => Math.round(opaque.reduce((s, c) => s + c[k], 0) / opaque.length));
  dst[o] = avg[0]; dst[o + 1] = avg[1]; dst[o + 2] = avg[2]; dst[o + 3] = 255;
}
// median cut palette
const pts = [];
for (let i = 0; i < dst.length; i += 4) if (dst[i + 3]) pts.push([dst[i], dst[i + 1], dst[i + 2]]);
let boxes = [pts];
while (boxes.length < +nColors) {
  boxes.sort((a, b) => b.length - a.length);
  const box = boxes.shift();
  if (box.length < 2) { boxes.push(box); break; }
  const range = [0, 1, 2].map((k) => Math.max(...box.map((p) => p[k])) - Math.min(...box.map((p) => p[k])));
  const k = range.indexOf(Math.max(...range));
  box.sort((a, b) => a[k] - b[k]);
  const mid = box.length >> 1;
  boxes.push(box.slice(0, mid), box.slice(mid));
}
const palette = boxes.map((b) => [0, 1, 2].map((k) => Math.round(b.reduce((s, p) => s + p[k], 0) / b.length)));
for (let i = 0; i < dst.length; i += 4) {
  if (!dst[i + 3]) continue;
  let best = 0, bd = Infinity;
  palette.forEach((p, j) => { const d = (p[0] - dst[i]) ** 2 * 0.3 + (p[1] - dst[i + 1]) ** 2 * 0.59 + (p[2] - dst[i + 2]) ** 2 * 0.11; if (d < bd) { bd = d; best = j; } });
  [dst[i], dst[i + 1], dst[i + 2]] = palette[best];
}
// remove isolated single opaque pixels (noise halo)
const alpha = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : dst[(y * W + x) * 4 + 3]);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!alpha(x, y)) continue;
  const n = alpha(x - 1, y) + alpha(x + 1, y) + alpha(x, y - 1) + alpha(x, y + 1);
  if (n <= 255) dst[(y * W + x) * 4 + 3] = 0;
}
fs.writeFileSync(out, encode(W, H, dst));
console.log(`wrote ${out} ${W}x${H}, ${palette.length} colors`);
