// Build Winnie's room sprite sheet (v2) from the six cleaned frames in winnie-room-v1.png.
// New poses are derived pixel by pixel from his real frames plus small hand-drawn
// details (towel, drips, Snuggle Puppy, open mouth). Run: node scripts/build-poses.mjs
import fs from "node:fs";
import { decode, encode, image } from "./png.mjs";

const CELL = 64;
const src = decode(fs.readFileSync("public/photos/winnie-room-v1.png"));
const frame = (cx, cy) => {
  const f = image(CELL, CELL);
  for (let y = 0; y < CELL; y++)
    src.px.copy(
      f.px,
      y * CELL * 4,
      ((cy * CELL + y) * src.w + cx * CELL) * 4,
      ((cy * CELL + y) * src.w + cx * CELL + CELL) * 4,
    );
  return f;
};
const clone = (f) => ({ w: f.w, h: f.h, px: Buffer.from(f.px) });
const at = (f, x, y) =>
  x < 0 || y < 0 || x >= f.w || y >= f.h ? -1 : (y * f.w + x) * 4;
const get = (f, x, y) => {
  const i = at(f, x, y);
  return i < 0 ? [0, 0, 0, 0] : [...f.px.subarray(i, i + 4)];
};
const set = (f, x, y, c) => {
  const i = at(f, x, y);
  if (i >= 0) {
    f.px[i] = c[0];
    f.px[i + 1] = c[1];
    f.px[i + 2] = c[2];
    f.px[i + 3] = c[3] ?? 255;
  }
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// Move an opaque region by (dx, dy): clear it, then paste it over whatever is there.
function shift(f, x0, y0, x1, y1, dx, dy) {
  const copy = clone(f);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) set(f, x, y, [0, 0, 0, 0]);
  // keep the body underneath: restore pixels below the region the head no longer covers
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const p = get(copy, x, y);
      if (p[3]) set(f, x + dx, y + dy, p);
    }
  // anything of the original frame outside the moved region that was overwritten stays as is
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
      if (!inside && !get(f, x, y)[3]) {
        const p = get(copy, x, y);
        if (p[3]) set(f, x, y, p);
      }
    }
  return fill(f);
}
// Close one-pixel seams a shift can open: a clear pixel between two opaque neighbours.
function fill(f) {
  const copy = clone(f);
  for (let y = 1; y < CELL - 1; y++)
    for (let x = 1; x < CELL - 1; x++) {
      if (get(copy, x, y)[3]) continue;
      const l = get(copy, x - 1, y),
        r = get(copy, x + 1, y),
        u = get(copy, x, y - 1),
        d = get(copy, x, y + 1);
      if (l[3] && r[3]) set(f, x, y, r);
      else if (u[3] && d[3]) set(f, x, y, d);
    }
  return f;
}
function paint(f, rows, ox, oy, colors) {
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (colors[ch]) set(f, ox + x, oy + y, hex(colors[ch]));
    }),
  );
  return f;
}

const sit = frame(0, 0),
  blink = frame(1, 0),
  sleep = frame(2, 0),
  walkA = frame(0, 1),
  walkB = frame(1, 1),
  happy = frame(2, 1);

// Tail wag: swing the tail (left of x=19) up and out by a couple of pixels.
const wag = shift(clone(sit), 4, 29, 15, 56, -1, -1);

// Eating: lower his head over the bowl in front of him.
const eatA = shift(clone(sit), 17, 3, 61, 33, 0, 4);
const eatB = shift(clone(sit), 17, 3, 61, 33, 0, 6);

// Sniffing: the walking pose with his nose down to the floor.
const sniffA = shift(clone(walkA), 30, 0, 63, 27, 0, 3);
const sniffB = shift(clone(walkB), 30, 0, 63, 27, 0, 4);

// Yawn: eyes closed (the blink frame), mouth open, a little tongue.
const yawn = paint(
  clone(blink),
  ["..ddddd..", ".ddddddd.", ".dddtttd.", "..dtttd..", "...ddd..."],
  37,
  28,
  { d: "#3b1d12", t: "#e8707a" },
);

// Just bathed: fur darker and flatter, a striped towel on his head, drips.
const wet = clone(sit);
for (let y = 0; y < CELL; y++)
  for (let x = 0; x < CELL; x++) {
    const [r, g, b, a] = get(wet, x, y);
    if (!a) continue;
    const fur = r > g && g > b && r - b > 45;
    if (fur) set(wet, x, y, [r * 0.8, g * 0.68, b * 0.62]);
  }
// The towel sits on his head: paint only over pixels that are already his head.
for (let y = 6; y <= 15; y++)
  for (let x = 18; x <= 60; x++) {
    if (!get(wet, x, y)[3]) continue;
    const edge =
      y === 15 ||
      !get(wet, x, y - 1)[3] ||
      !get(wet, x - 1, y)[3] ||
      !get(wet, x + 1, y)[3];
    set(
      wet,
      x,
      y,
      hex(edge ? "#c3cdee" : (x - 18) % 6 < 2 ? "#7fa0e6" : "#f6f7ff"),
    );
  }
paint(wet, ["ww", "wb", "ww", "wb", "gg"], 52, 16, {
  w: "#f6f7ff",
  b: "#7fa0e6",
  g: "#c3cdee",
});
for (const [x, y] of [
  [16, 30],
  [56, 34],
  [22, 46],
  [50, 50],
  [30, 56],
  [12, 40],
  [58, 24],
])
  paint(wet, ["c", "d"], x, y, { c: "#d8ecff", d: "#7fa8e8" });

// His Snuggle Puppy: a tan plush puppy with brown ears and a red heart.
const PUPPY = [
  "...oooooo...",
  "..ollllllo..",
  ".eollllllloe",
  "eeolkllkloee",
  "eeollnnlloee",
  ".eollllllle.",
  "..oottttoo..",
  ".otthhtttto.",
  ".otthhtttto.",
  ".otttttttto.",
  "..oo....oo..",
];
const PUPPY_COLORS = {
  o: "#6b4426",
  l: "#f0dcb8",
  t: "#dcbc8e",
  e: "#9c6a3c",
  k: "#241612",
  n: "#3a2216",
  h: "#e8505b",
};
const toy = paint(clone(happy), PUPPY, 33, 32, PUPPY_COLORS);
const sleepToy = paint(clone(sleep), PUPPY, 6, 44, PUPPY_COLORS);

// Sheet: 3 columns x 5 rows of 64px cells.
const SHEET = [
  [sit, blink, sleep],
  [walkA, walkB, happy],
  [wag, eatA, eatB],
  [sniffA, sniffB, yawn],
  [wet, toy, sleepToy],
];
const out = image(CELL * 3, CELL * SHEET.length);
SHEET.forEach((row, cy) =>
  row.forEach((f, cx) => {
    for (let y = 0; y < CELL; y++)
      f.px.copy(
        out.px,
        ((cy * CELL + y) * out.w + cx * CELL) * 4,
        y * CELL * 4,
        (y + 1) * CELL * 4,
      );
  }),
);
fs.writeFileSync("public/photos/winnie-room-v2.png", encode(out));
// The plush on its own, for the bed when he is not holding it.
const plush = image(12, 11);
paint(plush, PUPPY, 0, 0, PUPPY_COLORS);
fs.writeFileSync("public/photos/snuggle-puppy.png", encode(plush));
console.log("wrote public/photos/winnie-room-v2.png and snuggle-puppy.png");
