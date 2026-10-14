import {
  getPosition,
  getTimes,
  getMoonIllumination,
} from "./vendor/suncalc.js";
/* Winnie's Room: a pixel diorama that acts out recorded care.
   One art pixel = an integer number of device pixels. Scene is drawn at art
   resolution (W x 112) and blitted with nearest-neighbour scaling. */
const ROOM_H = 112;
const SF = [37.7749, -122.4194];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v + 0.5) / 16,
);
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const css = (a) => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function keyed(frames, v) {
  if (v <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (v <= frames[i][0]) {
      const [k0, a] = frames[i - 1],
        [k1, b] = frames[i],
        f = (v - k0) / (k1 - k0);
      return Array.isArray(a[0])
        ? a.map((c, j) => mix(c, b[j], f))
        : mix(a, b, f);
    }
  }
  return frames.at(-1)[1];
}
const SKY = [
  [-18, ["#070b26", "#141c4c"]],
  [-10, ["#0d1440", "#28306e"]],
  [-5, ["#1d2763", "#5a4c98"]],
  [-1.5, ["#34449a", "#c46d98"]],
  [1, ["#4d68c6", "#ff9b6a"]],
  [6, ["#5b8fe6", "#ffcf8f"]],
  [16, ["#4a9af2", "#b8e1ff"]],
  [60, ["#3d93f0", "#a7dbff"]],
].map(([k, c]) => [k, c.map(hx)]);
const TINT = [
  [-18, "#3a417c"],
  [-9, "#474f8f"],
  [-4, "#7468aa"],
  [-0.5, "#cf9aae"],
  [3, "#ffdcb8"],
  [9, "#fff3e6"],
  [15, "#ffffff"],
].map(([k, c]) => [k, hx(c)]);
const C = {
  ink: "#22264a",
  wall1: "#c6d2f8",
  wall2: "#b6c5f3",
  wall3: "#a8b9ee",
  wain: "#7d95dc",
  wainHi: "#93a9e6",
  wainLo: "#6a82c9",
  rail: "#eef1ff",
  base: "#eef1ff",
  baseLo: "#c9d1f1",
  wood: "#dc9b56",
  woodLo: "#c6853f",
  woodHi: "#e8ae6f",
  seam: "#a9692f",
  white: "#f6f7ff",
  whiteLo: "#d3d9f2",
  note1: "#ffe066",
  note1Lo: "#e6c443",
  note2: "#ff9ec2",
  note2Lo: "#e57ea5",
  green: "#5cbb63",
  greenLo: "#3d9150",
  greenHi: "#8fdc7f",
  pot: "#3f4f9e",
  potHi: "#5a6cc0",
  red: "#e8505b",
  redHi: "#ff8a8f",
  frame: "#8a5a33",
  frameLo: "#6e4426",
  door: "#b9713d",
  doorLo: "#9a5a2d",
  doorHi: "#d08b53",
  knob: "#ffd84a",
  dark: "#11152e",
  bedRim: "#3e52b0",
  bedHi: "#5a70cf",
  bedLo: "#2b3a87",
  g1: "#f6f7ff",
  g2: "#9fb5f0",
  g3: "#5c7ad6",
  kib: "#7a4426",
  cat1: "#7fd07a",
  cat2: "#4fa85a",
  sconce: "#ffe9a8",
  sconceLo: "#e3bf55",
  mat: "#e8505b",
  matLo: "#b93d4c",
};
const GLYPH = {
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
  n: ["000", "110", "101", "101", "101"],
  o: ["000", "010", "101", "101", "010"],
  m: ["00000", "11010", "10101", "10101", "10101"],
  z: ["111", "001", "010", "100", "111"],
  "!": ["1", "1", "1", "0", "1"],
  "?": ["111", "001", "011", "000", "010"],
  "+": ["000", "010", "111", "010", "000"],
  "~": ["00000", "00001", "00010", "10100", "01000"],
  "*": ["01010", "11111", "11111", "01110", "00100"],
};
function glyphs(c, s, x, y, color) {
  c.fillStyle = color;
  for (const ch of s) {
    const g = GLYPH[ch];
    if (!g) {
      x += 2;
      continue;
    }
    g.forEach((row, j) => {
      for (let i = 0; i < row.length; i++)
        if (row[i] === "1") c.fillRect(x + i, y + j, 1, 1);
    });
    x += g[0].length + 1;
  }
  return x;
}
const glyphW = (s) =>
  [...s].reduce((w, ch) => w + (GLYPH[ch] ? GLYPH[ch][0].length + 1 : 2), 0) -
  1;
// Sprite sheet: 3x10 cells of 64. dx/dy align each frame's feet and body centre to "sit".
const FRAMES = {
  sit: [0, 0, 0, 0],
  blink: [1, 0, 2, 0],
  sleep: [2, 0, 0, -1],
  walkA: [0, 1, -1, 4],
  walkB: [1, 1, -1, 4],
  happy: [2, 1, 1, 3],
  wag: [0, 2, 0, 0],
  eatA: [0, 8, 0, 0],
  eatB: [1, 8, 0, 0],
  sniffA: [0, 3, -1, 4],
  sniffB: [1, 3, -1, 4],
  yawn: [2, 3, 2, 0],
  wet: [0, 4, 0, 0],
  toy: [1, 4, 1, 3],
  sleepToy: [2, 9, 0, 0],
  belly: [0, 5, 0, 0],
  roll: [1, 5, 0, 0],
  bow: [2, 5, 0, 0],
  scratchA: [0, 6, 0, 0],
  scratchB: [1, 6, 0, 0],
  tilt: [2, 6, 0, 0],
  jump: [0, 7, 0, 0],
  shakeA: [1, 7, 0, 0],
  shakeB: [2, 7, 0, 0],
  greet: [2, 8, 0, 0],
  toyA: [0, 9, 0, 0],
  toyB: [1, 9, 0, 0],
};
// Small hand-drawn objects. Each character is one art pixel; "." is clear.
const BITMAPS = {
  puppy: [
    [
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
    ],
    {
      o: "#6b4426",
      l: "#f0dcb8",
      t: "#dcbc8e",
      e: "#9c6a3c",
      k: "#241612",
      n: "#3a2216",
      h: "#e8505b",
    },
  ],
  ribbon: [
    [
      "...bbb...",
      ".bbBBBbb.",
      "bBBByBBBb",
      "bBByyyBBb",
      "bBBByBBBb",
      ".bbBBBbb.",
      "...bbb...",
      "..bB.Bb..",
      "..bB.Bb..",
      ".bBB.BBb.",
      ".bB...Bb.",
      ".b.....b.",
    ],
    { b: "#2b4ea8", B: "#5c86e6", y: "#ffd84a" },
  ],
  pumpkin: [
    [
      "....gg....",
      "...gg.....",
      ".oOOOOOOo.",
      "oOOoOOoOOo",
      "oOOoOOoOOo",
      "oOOoOOoOOo",
      ".oOOOOOOo.",
    ],
    { o: "#c4541c", O: "#f08a2c", g: "#4f8a3a" },
  ],
  trophy: [
    ["y...y", "yyyyy", "yYYYy", ".yYy.", "..y..", ".yyy.", "ooooo"],
    { y: "#ffd84a", Y: "#fff1a6", o: "#8a5a33" },
  ],
};
function bitmap(c, name, x, y) {
  const [rows, colors] = BITMAPS[name];
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++)
      if (colors[row[i]]) {
        c.fillStyle = colors[row[i]];
        c.fillRect(x + i, y + j, 1, 1);
      }
  });
}
// Window weather from a WMO weather code (Open-Meteo).
export function weatherKind(w) {
  if (!w || !Number.isFinite(w.code)) return "clear";
  const c = w.code;
  if (c === 45 || c === 48) return "fog";
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) return "rain";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
  if (c === 3 || (w.cloud ?? 0) >= 85) return "overcast";
  if (c === 1 || c === 2) return "partly";
  return "clear";
}
// Seasonal decorations by date (local time).
function season(epoch) {
  const d = new Date(epoch),
    m = d.getMonth() + 1,
    day = d.getDate();
  if (m === 10) return "halloween";
  if (m === 12 || (m === 1 && day <= 6)) return "lights";
  if ((m === 3 && day >= 20) || m === 4 || m === 5 || (m === 6 && day <= 20))
    return "spring";
  return "";
}

export function sfEpoch(minute, base = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })
      .formatToParts(base)
      .map((p) => [p.type, +p.value || 0]),
  );
  const wall = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
  );
  const offset = wall - Math.floor(base / 60000) * 60000;
  return Date.UTC(parts.year, parts.month - 1, parts.day, 0, minute) - offset;
}

export function createRoom(canvas, opts = {}) {
  const { sprite, onObject = () => {}, still = false } = opts;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = opts.reduced ?? motion.matches;
  const view = canvas.getContext("2d");
  const scene = document.createElement("canvas"),
    s = scene.getContext("2d");
  const out = document.createElement("canvas"),
    o = out.getContext("2d");
  const relit = document.createElement("canvas"),
    r = relit.getContext("2d");
  const mask = document.createElement("canvas"),
    mk = mask.getContext("2d");
  const tiny = document.createElement("canvas"),
    tc = tiny.getContext("2d");
  const roomCache = document.createElement("canvas"),
    rc = roomCache.getContext("2d");
  const skyLayer = document.createElement("canvas"),
    skc = skyLayer.getContext("2d");
  const beamLayer = document.createElement("canvas"),
    bc = beamLayer.getContext("2d");
  let roomKey = "",
    photoRev = 0,
    skyKey = "",
    beamKey = "",
    skyAlt = 0,
    lastSig = "",
    paused = false;
  tiny.width = 14;
  tiny.height = 14;
  let W = 195,
    k = 2,
    L;
  const st = {
    epoch: Date.now(),
    sleep: null,
    walk: false,
    notes: 2,
    pending: 0,
    error: false,
    due: false,
    lights: false,
  };
  const dog = {
    x: 64,
    y: 102,
    face: 1,
    pose: "sit",
    hidden: false,
    bed: false,
    bob: 0,
    tail: 0,
    alpha: 1,
  };
  let queue = [],
    step = null,
    parts = [],
    emote = null,
    kibble = 0,
    doorOpen = 0,
    leash = true,
    paws = [];
  let flash = 0,
    calFlash = 0,
    envLift = 0,
    envGone = 0,
    lampOn = false,
    tick = 0,
    acc = 0,
    last = 0,
    raf = 0;
  let idleAt = 0,
    blinkAt = 0,
    visible = true,
    sky = null,
    hasPhoto = false,
    wallPhoto = null;
  if (still) tick = 60;

  function layout() {
    // holds from W=184 to ~260; the door, hook, lamp and bed anchor right
    const door = { x: Math.max(124, W - 66), y: 26, w: 26, h: 50 },
      hook = { x: door.x + door.w + 4, y: 33 };
    L = {
      fridge: { x: 3, y: 22, w: 18, h: 54 },
      plant: { x: 22, y: 60 },
      win: { x: 37, y: 12, w: 32, h: 30 },
      cal: { x: 80, y: 15, w: 13, h: 16 },
      frame: { x: 94, y: 13, w: Math.min(42, door.x - 96), h: 32 },
      door,
      hook,
      sconce: { x: Math.min(W - 9, hook.x + 9), y: 27 },
      bed: { x: W - 53, y: 88, w: 47, h: 18 },
      bowl: { x: 88, y: 100, w: 12, h: 6 },
      toy: { x: 56, y: 103 },
      ribbon: { x: 108, y: 47, w: 9, h: 12 },
      shelf: { x: 75, y: 44, w: 18, h: 6 },
    };
    L.spot = {
      door: door.x + door.w / 2 - 32,
      bowl: L.bowl.x + 6 - 32,
      bed: L.bed.x + L.bed.w / 2 - 31,
      min: 14,
      max: door.x - 30,
    };
  }
  function size() {
    const dpr = window.devicePixelRatio || 1,
      cssW = canvas.parentElement.clientWidth || 390;
    k = Math.max(1, Math.round((cssW * dpr) / 220));
    if (k > 1 && (cssW * dpr) / k < 180) k--;
    W = Math.floor((cssW * dpr) / k);
    for (const c of [scene, out, relit, mask, roomCache, skyLayer, beamLayer]) {
      c.width = W;
      c.height = ROOM_H;
    }
    roomKey = skyKey = beamKey = lastSig = "";
    canvas.width = W * k;
    canvas.height = ROOM_H * k;
    canvas.style.width = (W * k) / dpr + "px";
    canvas.style.height = (ROOM_H * k) / dpr + "px";
    layout();
    paintMask();
    dog.x = Math.min(dog.x, L.spot.max);
    settle();
    draw();
  }
  function paintMask() {
    mk.clearRect(0, 0, W, ROOM_H);
    const cx = L.sconce.x + 3,
      cy = L.sconce.y + 6,
      R = 58;
    mk.fillStyle = "#000";
    for (let y = 0; y < ROOM_H; y++)
      for (let x = Math.max(0, cx - R - 30); x < W; x++) {
        const d = Math.hypot((x - cx) * 0.8, (y - cy) * 1.1) / R;
        if (1 - d > bay(x, y) * 0.9) mk.fillRect(x, y, 1, 1);
      }
  }
  const R = (c, x, y, w, h, col) => {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };

  // ---------- static room ----------
  function paintRoom(c) {
    for (let y = 0; y < 50; y++)
      for (let x = 0; x < W; x++) {
        const v = (x >> 2) & 1,
          h = (y >> 2) & 1;
        R(c, x, y, 1, 1, v && h ? C.wall3 : v || h ? C.wall2 : C.wall1);
      }
    R(c, 0, 50, W, 2, C.rail);
    R(c, 0, 52, W, 1, C.wainLo);
    R(c, 0, 53, W, 20, C.wain);
    for (let x = 3; x < W; x += 24) {
      R(c, x, 56, 18, 1, C.wainLo);
      R(c, x, 56, 1, 14, C.wainLo);
      R(c, x + 1, 69, 18, 1, C.wainHi);
      R(c, x + 18, 57, 1, 13, C.wainHi);
    }
    R(c, 0, 73, W, 1, C.baseLo);
    R(c, 0, 74, W, 2, C.base);
    R(c, 0, 76, W, 1, C.seam);
    for (let y = 77, row = 0; y < ROOM_H; y += 5, row++) {
      R(c, 0, y, W, 5, C.wood);
      R(c, 0, y, W, 1, C.woodHi);
      R(c, 0, y + 4, W, 1, C.woodLo);
      for (let x = (row * 17) % 31; x < W; x += 31)
        R(c, x, y + 1, 1, 3, C.seam);
    }
    // fridge
    const f = L.fridge;
    R(c, f.x, f.y, f.w, f.h, C.ink);
    R(c, f.x + 1, f.y + 1, f.w - 2, f.h - 2, C.white);
    R(c, f.x + f.w - 3, f.y + 1, 2, f.h - 2, C.whiteLo);
    R(c, f.x + 1, f.y + 18, f.w - 2, 1, C.ink);
    R(c, f.x + 3, f.y + 7, 1, 7, C.ink);
    R(c, f.x + 3, f.y + 22, 1, 10, C.ink);
    R(c, f.x + 2, f.y + f.h, 2, 1, C.ink);
    R(c, f.x + f.w - 4, f.y + f.h, 2, 1, C.ink);
    for (let i = 0; i < Math.min(st.notes, 2); i++) {
      const nx = f.x + 6 + i * 7,
        ny = f.y + 4 + i * 2,
        col = i ? C.note2 : C.note1,
        lo = i ? C.note2Lo : C.note1Lo;
      R(c, nx, ny, 6, 6, col);
      R(c, nx, ny + 5, 6, 1, lo);
      R(c, nx + 2, ny - 1, 2, 2, i ? C.g3 : C.red);
      R(c, nx + 1, ny + 2, 4, 1, lo);
      R(c, nx + 1, ny + 3, 3, 1, lo);
    }
    R(c, f.x + 8, f.y + 25, 3, 3, C.red);
    R(c, f.x + 13, f.y + 30, 3, 3, C.g3);
    R(c, f.x + 9, f.y + 36, 3, 3, C.knob);
    // plant
    const p = L.plant;
    R(c, p.x, p.y + 8, 9, 8, C.ink);
    R(c, p.x + 1, p.y + 9, 7, 7, C.pot);
    R(c, p.x + 1, p.y + 9, 7, 1, C.potHi);
    [
      [3, 0, 3, 4],
      [0, 2, 3, 3],
      [6, 1, 3, 4],
      [2, 4, 5, 4],
      [1, -2, 2, 3],
      [5, -3, 2, 4],
    ].forEach(([x, y, w, h], i) => {
      R(c, p.x + x, p.y + y, w, h, i % 2 ? C.greenLo : C.green);
      R(c, p.x + x, p.y + y, 1, 1, C.greenHi);
    });
    // window frame (glass painted per frame)
    const wn = L.win;
    R(c, wn.x - 7, wn.y - 4, wn.w + 14, 1, C.ink);
    R(c, wn.x - 8, wn.y - 5, 2, 3, C.ink);
    R(c, wn.x + wn.w + 6, wn.y - 5, 2, 3, C.ink);
    R(c, wn.x - 1, wn.y - 1, wn.w + 2, wn.h + 2, C.ink);
    R(c, wn.x, wn.y, wn.w, wn.h, C.white);
    R(c, wn.x - 3, wn.y + wn.h, wn.w + 6, 3, C.white);
    R(c, wn.x - 3, wn.y + wn.h + 3, wn.w + 6, 1, C.ink);
    R(c, wn.x - 3, wn.y + wn.h - 1, wn.w + 6, 1, C.ink);
    for (const side of [0, 1]) {
      const cx0 = side ? wn.x + wn.w - 1 : wn.x - 7;
      for (let y = wn.y - 3; y < wn.y + wn.h + 5; y++)
        for (let x = cx0; x < cx0 + 8; x++) {
          const v = (x >> 1) & 1,
            h = (y >> 1) & 1;
          R(c, x, y, 1, 1, v && h ? C.g3 : v || h ? C.g2 : C.g1);
        }
      R(c, side ? cx0 + 7 : cx0, wn.y - 3, 1, wn.h + 8, C.ink);
      R(c, cx0, wn.y + 17, 8, 1, C.ink);
      R(c, cx0, wn.y + wn.h + 5, 8, 1, C.ink);
    }
    // calendar
    const cl = L.cal;
    R(c, cl.x + cl.w / 2 - 1, cl.y - 3, 2, 2, C.ink);
    R(c, cl.x - 1, cl.y - 1, cl.w + 2, cl.h + 2, C.ink);
    R(c, cl.x, cl.y, cl.w, cl.h, C.white);
    R(c, cl.x, cl.y, cl.w, 4, C.red);
    R(c, cl.x + 2, cl.y + 1, 1, 1, C.white);
    R(c, cl.x + cl.w - 3, cl.y + 1, 1, 1, C.white);
    R(c, cl.x, cl.y + cl.h - 1, cl.w, 1, C.whiteLo);
    const day = String(new Date(st.epoch).getDate());
    glyphs(
      c,
      day,
      cl.x + Math.round((cl.w - glyphW(day)) / 2),
      cl.y + 7,
      C.ink,
    );
    if (st.due) R(c, cl.x + cl.w - 3, cl.y + cl.h - 3, 2, 2, C.red);
    // picture
    const fr = L.frame;
    R(c, fr.x - 1, fr.y - 1, fr.w + 2, fr.h + 2, C.ink);
    R(c, fr.x, fr.y, fr.w, fr.h, C.frame);
    R(c, fr.x, fr.y + fr.h - 1, fr.w, 1, C.frameLo);
    R(c, fr.x + 2, fr.y + 2, fr.w - 4, fr.h - 4, C.whiteLo);
    if (!hasPhoto) glyphs(c, "*", fr.x + Math.floor(fr.w / 2) - 2, fr.y + 12, C.red);
    R(c, fr.x + 1, fr.y + 1, fr.w - 2, 1, C.ink);
    R(c, fr.x + 1, fr.y + fr.h - 2, fr.w - 2, 1, C.ink);
    R(c, fr.x + 1, fr.y + 1, 1, fr.h - 2, C.ink);
    R(c, fr.x + fr.w - 2, fr.y + 1, 1, fr.h - 2, C.ink);
    // sconce over the bed
    const sc = L.sconce;
    R(c, sc.x + 2, sc.y - 4, 2, 4, C.ink);
    R(c, sc.x - 1, sc.y - 1, 8, 6, C.ink);
    R(c, sc.x, sc.y, 6, 4, C.sconceLo);
    R(c, sc.x, sc.y, 6, 1, C.sconce);
    // doormat
    const d = L.door;
    R(c, d.x - 4, 78, d.w + 8, 5, C.ink);
    R(c, d.x - 3, 79, d.w + 6, 3, C.mat);
    for (let x = d.x - 2; x < d.x + d.w + 3; x += 3) R(c, x, 80, 1, 1, C.matLo);
    // toy caterpillar
    const t = L.toy;
    [
      [0, 1, C.cat2],
      [3, 0, C.cat1],
      [6, 1, C.cat2],
      [9, 0, C.cat1],
    ].forEach(([x, y, col]) => {
      R(c, t.x + x, t.y + y, 3, 3, col);
      R(c, t.x + x, t.y + y + 3, 3, 1, C.ink);
    });
    R(c, t.x + 11, t.y + 1, 1, 1, C.ink);
    // his Canine Good Citizen ribbon, under the picture
    bitmap(c, "ribbon", L.ribbon.x, L.ribbon.y);
    // a shelf of trophies, one per recent milestone (up to three)
    if (st.trophies > 0) {
      const s = L.shelf;
      R(c, s.x, s.y, s.w, 2, C.frame);
      R(c, s.x, s.y + 2, s.w, 1, C.frameLo);
      R(c, s.x + 2, s.y + 3, 1, 2, C.frameLo);
      R(c, s.x + s.w - 3, s.y + 3, 1, 2, C.frameLo);
      for (let i = 0; i < Math.min(3, st.trophies); i++)
        bitmap(c, "trophy", s.x + 2 + i * 7, s.y - 7);
    }
    const sn = season(st.epoch);
    if (sn === "halloween") bitmap(c, "pumpkin", L.door.x - 13, 70);
    if (sn === "spring")
      for (const [x, y, col] of [
        [2, -2, "#ff8fb8"],
        [7, -3, "#ffe066"],
        [4, 0, "#ff8fb8"],
        [1, 2, "#ffe066"],
      ])
        R(c, L.plant.x + x, L.plant.y + y, 2, 2, col);
    if (sn === "lights") {
      R(c, 0, 49, W, 1, "#3d4a7a");
    }
  }
  // bright things drawn after the room is lit for the time of day
  function paintGlow(c, night) {
    const sn = season(st.epoch);
    if (sn === "lights") {
      const colors = ["#ff5a6a", "#7fe0a6", "#ffe066", "#7fa8ff"];
      for (let x = 3, i = 0; x < W; x += 7, i++) {
        const on = !night || (i + (tick >> 4)) % 5 !== 0;
        R(c, x, 50, 2, 2, on ? colors[i % 4] : "#3d4a7a");
      }
    }
    if (sn === "halloween" && night) {
      const px = L.door.x - 13;
      R(c, px + 2, 73, 2, 1, "#ffe066");
      R(c, px + 6, 73, 2, 1, "#ffe066");
      R(c, px + 3, 75, 4, 1, "#ffe066");
    }
  }
  function paintDoor(c) {
    const d = L.door;
    R(c, d.x - 1, d.y - 1, d.w + 2, d.h + 1, C.ink);
    if (doorOpen > 0) {
      R(c, d.x, d.y, d.w, d.h, C.dark);
      const g = sky || [hx("#4a9af2"), hx("#b8e1ff")];
      R(c, d.x + 2, d.y + 2, d.w - 4, d.h - 14, css(g[1]));
      R(c, d.x + 2, d.y + d.h - 12, d.w - 4, 12, C.green);
      R(c, d.x + 2, d.y + d.h - 12, d.w - 4, 1, C.greenHi);
      const sw = Math.max(3, Math.round(d.w * (1 - doorOpen * 0.82)));
      R(c, d.x, d.y, sw, d.h, C.door);
      R(c, d.x + sw - 1, d.y, 1, d.h, C.doorLo);
      R(c, d.x, d.y, 1, d.h, C.doorHi);
    } else {
      R(c, d.x, d.y, d.w, d.h, C.door);
      for (const [py, ph] of [
        [4, 18],
        [26, 20],
      ]) {
        R(c, d.x + 4, d.y + py, d.w - 8, ph, C.doorLo);
        R(c, d.x + 5, d.y + py + 1, d.w - 10, ph - 2, C.door);
        R(c, d.x + 4, d.y + py + ph - 1, d.w - 8, 1, C.doorHi);
      }
      R(c, d.x + d.w - 6, d.y + 26, 3, 3, C.ink);
      R(c, d.x + d.w - 5, d.y + 26, 2, 2, C.knob);
      R(c, d.x + 8, d.y + 23, d.w - 16, 2, C.ink);
    }
    // leash on its hook
    const hk = L.hook;
    R(c, hk.x, hk.y, 3, 1, C.ink);
    R(c, hk.x + 2, hk.y - 1, 1, 1, C.ink);
    if (leash) {
      R(c, hk.x + 1, hk.y + 1, 1, 15, C.red);
      R(c, hk.x, hk.y + 15, 3, 1, C.ink);
      R(c, hk.x - 1, hk.y + 16, 5, 5, C.red);
      R(c, hk.x, hk.y + 17, 3, 3, C.wall1);
      R(c, hk.x + 1, hk.y + 21, 1, 1, C.ink);
    }
  }
  function paintBed(c, front) {
    const b = L.bed,
      cx = b.x + b.w / 2,
      cy = b.y + b.h / 2;
    for (let y = b.y; y < b.y + b.h; y++) {
      const hw = Math.round(
        (b.w / 2) * Math.sqrt(Math.max(0, 1 - ((y - cy) / (b.h / 2)) ** 2)),
      );
      if (!hw) continue;
      const isFront = y >= cy + 2;
      if (front !== isFront) continue;
      if (!front) {
        R(c, cx - hw, y, hw * 2, 1, C.ink);
        const inner = y > b.y + 2 ? hw - 3 : 0;
        R(c, cx - hw + 1, y, hw * 2 - 2, 1, y < b.y + 3 ? C.bedHi : C.bedRim);
        if (inner > 0)
          for (let x = cx - inner; x < cx + inner; x++) {
            const v = (x >> 1) & 1,
              h = (y >> 1) & 1;
            R(c, x, y, 1, 1, v && h ? C.g3 : v || h ? C.g2 : C.g1);
          }
      } else {
        R(c, cx - hw, y, hw * 2, 1, C.ink);
        R(
          c,
          cx - hw + 1,
          y,
          hw * 2 - 2,
          1,
          y === Math.ceil(cy + 2)
            ? C.bedHi
            : y > b.y + b.h - 3
              ? C.bedLo
              : C.bedRim,
        );
      }
    }
  }
  function paintBowl(c) {
    const b = L.bowl;
    for (let i = 0; i < kibble; i++)
      R(c, b.x + 2 + ((i * 5) % 8), b.y - 1 - (i % 2), 2, 2, C.kib);
    R(c, b.x, b.y, b.w, 1, C.ink);
    R(c, b.x + 1, b.y + 1, b.w - 2, 1, C.redHi);
    R(c, b.x, b.y + 1, 1, 3, C.ink);
    R(c, b.x + b.w - 1, b.y + 1, 1, 3, C.ink);
    R(c, b.x + 1, b.y + 2, b.w - 2, 2, C.red);
    R(c, b.x + 1, b.y + 4, b.w - 2, 1, C.ink);
    R(c, b.x + 2, b.y + 5, b.w - 4, 1, C.ink);
  }
  function paintEnvelope(c) {
    if (!st.pending && !st.error && envGone <= 0) return;
    const d = L.door,
      x = d.x + 9,
      y = 74 - envLift;
    if (y < d.y + 22) return;
    R(c, x - 1, y - 1, 10, 8, C.ink);
    R(c, x, y, 8, 6, st.error ? C.knob : C.white);
    R(c, x + 1, y + 1, 1, 1, C.ink);
    R(c, x + 2, y + 2, 1, 1, C.ink);
    R(c, x + 3, y + 3, 2, 1, C.ink);
    R(c, x + 5, y + 2, 1, 1, C.ink);
    R(c, x + 6, y + 1, 1, 1, C.ink);
    if (st.error) {
      R(c, x + 7, y - 4, 5, 7, C.red);
      glyphs(c, "!", x + 9, y - 3, C.white);
    } else if (st.pending > 1) {
      R(c, x + 6, y - 4, 5, 7, C.red);
      glyphs(c, String(Math.min(9, st.pending)), x + 7, y - 3, C.white);
    }
  }
  function paintSky(c) {
    const wn = L.win,
      gx = wn.x + 2,
      gy = wn.y + 2,
      gw = wn.w - 4,
      gh = wn.h - 4,
      now = st.epoch;
    const alt = getPosition(new Date(now), ...SF).altitude;
    let [top, bottom] = keyed(SKY, alt);
    const wk = weatherKind(st.weather),
      grey = ["overcast", "fog", "rain", "snow"].includes(wk);
    if (grey) {
      const g = hx(alt > 0 ? "#aab3c8" : "#2a2f55"),
        k = wk === "overcast" ? 0.5 : wk === "fog" ? 0.7 : 0.62;
      top = mix(top, g, k);
      bottom = mix(bottom, g, k);
    }
    sky = [top, bottom];
    for (let y = 0; y < gh; y++)
      for (let x = 0; x < gw; x++) {
        const band = Math.min(
          4,
          Math.max(0, Math.floor((y / (gh - 1)) * 4 + bay(x, y) - 0.25)),
        );
        R(c, gx + x, gy + y, 1, 1, css(mix(top, bottom, band / 4)));
      }
    const times = getTimes(new Date(now), ...SF);
    if (grey) {
      // no sun, moon or stars behind cloud
    } else if (alt < -4) {
      for (let i = 0; i < 14; i++) {
        const sx = (i * 37 + 11) % gw,
          sy = (i * 23 + 5) % Math.max(1, gh - 9);
        if ((tick >> 3) % 7 !== i % 7)
          R(c, gx + sx, gy + sy, 1, 1, i % 3 ? "#fff8d6" : "#cfd8ff");
      }
      const set = +times.sunset,
        rise = +getTimes(new Date(now + 864e5), ...SF).sunrise,
        prevSet = +getTimes(new Date(now - 864e5), ...SF).sunset;
      const from = now >= set ? set : prevSet,
        to = now >= set ? rise : +times.sunrise;
      const f = Math.min(1, Math.max(0, (now - from) / (to - from)));
      const mx = gx + 2 + Math.round(f * (gw - 8)),
        my = gy + 3 + Math.round(Math.abs(f - 0.5) * 10);
      const ill = getMoonIllumination(new Date(now));
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++) {
          if ((x === 0 || x === 4) && (y === 0 || y === 4)) continue;
          const lit = ill.waxing
            ? x / 4 >= 1 - ill.fraction
            : x / 4 <= ill.fraction;
          R(c, mx + x, my + y, 1, 1, lit ? "#fff6cf" : "#3a447f");
        }
    } else {
      const f = Math.min(
        1,
        Math.max(0, (now - +times.sunrise) / (+times.sunset - +times.sunrise)),
      );
      const sx = gx + 1 + Math.round(f * (gw - 6)),
        sy =
          gy +
          gh -
          9 -
          Math.round(Math.min(1, Math.max(0, alt / 45)) * (gh - 12));
      R(c, sx, sy + 1, 4, 2, "#fff1a6");
      R(c, sx + 1, sy, 2, 4, "#fff1a6");
      R(c, sx + 1, sy + 1, 2, 2, "#ffe066");
    }
    if (alt >= -4 || grey) {
      const cloud = grey
          ? alt > 0
            ? "#d6dbe7"
            : "#454c7e"
          : alt < 4
            ? "#ffc6b0"
            : "#ffffff",
        drift = Math.floor(tick / 24);
      for (const [ox, oy] of grey
        ? [
            [0, 2],
            [11, 6],
            [20, 3],
            [6, 9],
          ]
        : wk === "clear"
          ? [[0, 4]]
          : [
              [0, 4],
              [17, 9],
            ]) {
        const cx = gx + ((ox + drift) % (gw + 12)) - 6;
        for (const [x, y, w] of [
          [1, 0, 4],
          [0, 1, 8],
          [2, 2, 3],
        ])
          for (let i = 0; i < w; i++)
            if (cx + x + i >= gx && cx + x + i < gx + gw)
              R(c, cx + x + i, gy + oy + y, 1, 1, cloud);
      }
    }
    // skyline with Sutro Tower
    const hz = gy + gh - 5,
      dark = css(mix(bottom, hx(C.ink), 0.55)),
      lit = alt < -3;
    for (let x = 0; x < gw; x++) {
      const hgt = [3, 3, 5, 5, 2, 4, 4, 4, 6, 6, 3, 2, 2, 5, 5, 5, 3, 3, 4, 2][
        x % 20
      ];
      R(c, gx + x, hz + 5 - hgt, 1, hgt, dark);
    }
    const tx = gx + gw - 9;
    R(c, tx, hz - 9, 1, 10, dark);
    R(c, tx + 3, hz - 10, 1, 11, dark);
    R(c, tx + 6, hz - 9, 1, 10, dark);
    R(c, tx, hz - 6, 7, 1, dark);
    R(c, tx + 1, hz - 3, 5, 1, dark);
    if (lit)
      for (let i = 0; i < 6; i++)
        R(c, gx + ((i * 7 + 3) % (gw - 10)), hz + 2 + (i % 2), 1, 1, "#ffd96a");
    if (wk === "fog" && !reduced) {
      // the fog rolls in over the skyline and Sutro Tower
      const fog = alt > 0 ? "#e3e7f0" : "#4b5384",
        drift = Math.floor(tick / 10);
      for (let y = 0; y < gh; y++)
        for (let x = 0; x < gw; x++)
          if (bay(x + drift, y) < 0.15 + 0.7 * (y / gh))
            R(c, gx + x, gy + y, 1, 1, fog);
    }
    if ((wk === "rain" || wk === "snow") && !reduced) {
      const drop = wk === "snow" ? "#ffffff" : alt > 0 ? "#c9dcff" : "#8090cc";
      for (let i = 0; i < 12; i++) {
        const y = (i * 13 + tick * (wk === "snow" ? 0.5 : 2)) % gh,
          x =
            (i * 9 +
              Math.floor(tick * (wk === "snow" ? 0.1 : 0.6)) -
              Math.floor(y / 3) +
              gw * 2) %
            gw;
        R(
          c,
          gx + Math.floor(x),
          gy + Math.floor(y),
          1,
          wk === "snow" ? 1 : 2,
          drop,
        );
      }
    }
    if (st.walk && !reduced) {
      const span = gw + 16,
        px = ((tick * 0.35) % span) - 14;
      tc.clearRect(0, 0, 14, 14);
      tc.imageSmoothingEnabled = false;
      tc.drawImage(sprite, (tick >> 2) % 2 ? 64 : 0, 64, 64, 64, 0, 0, 14, 14);
      c.save();
      c.beginPath();
      c.rect(gx, gy, gw, gh);
      c.clip();
      c.drawImage(tiny, Math.round(gx + px), hz - 9);
      c.restore();
    }
    // mullions on top
    R(c, wn.x + Math.floor(wn.w / 2), wn.y + 1, 1, wn.h - 2, C.white);
    R(c, wn.x + 1, wn.y + 14, wn.w - 2, 1, C.white);
    return alt;
  }
  function paintBeam(c, alt) {
    const wn = L.win,
      morning = new Date(st.epoch).getHours() < 13,
      lean = morning ? 0.55 : -0.55;
    let strength = 0,
      col = "#fff4d8";
    if (["overcast", "fog", "rain", "snow"].includes(weatherKind(st.weather)))
      return;
    if (alt > 0) strength = Math.min(0.34, alt / 30 + 0.14);
    else if (alt < -6) {
      strength = 0.14;
      col = "#c9d4ff";
    }
    if (!strength) return;
    c.fillStyle = col;
    for (let y = 77; y < ROOM_H; y++) {
      const dy = y - 77,
        x0 = Math.round(wn.x + 2 + dy * lean + dy * 0.2),
        x1 = Math.round(wn.x + wn.w - 2 + dy * lean + dy * 0.9);
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++)
        if (bay(x, y) < strength) c.fillRect(x, y, 1, 1);
    }
  }
  function frameOf() {
    const p = dog.pose;
    if (p === "scratch") return (tick >> 2) % 2 ? "scratchB" : "scratchA";
    if (p === "shake") return (tick >> 2) % 2 ? "shakeB" : "shakeA";
    if (p === "carry") return (tick >> 2) % 2 ? "toyB" : "toyA";
    if (p === "walk") return (tick >> 2) % 2 ? "walkB" : "walkA";
    if (p === "sit" && tick < blinkAt) return "blink";
    if (p === "eat") return (tick >> 2) % 2 ? "eatB" : "eatA";
    if (p === "sniff") return (tick >> 3) % 2 ? "sniffB" : "sniffA";
    if (p === "wag") return (tick >> 2) % 2 ? "wag" : "sit";
    if (p === "sleep") return "sleepToy";
    return p;
  }
  function paintDog(c) {
    if (dog.hidden || dog.alpha <= 0) return;
    const name = frameOf(),
      [fx, fy, dx, dy] = FRAMES[name];
    let x = Math.round(dog.x),
      y = Math.round(dog.y - 57 + dy + dog.bob);
    c.save();
    c.globalAlpha = dog.alpha < 1 ? Math.round(dog.alpha * 4) / 4 : 1;
    const draw = (sx, sy, sw, sh, ox, oy) => {
      if (dog.face < 0) {
        c.save();
        c.translate(x + 64 - dx, y);
        c.scale(-1, 1);
        c.drawImage(
          sprite,
          fx * 64 + sx,
          fy * 64 + sy,
          sw,
          sh,
          sx + ox,
          sy + oy,
          sw,
          sh,
        );
        c.restore();
      } else
        c.drawImage(
          sprite,
          fx * 64 + sx,
          fy * 64 + sy,
          sw,
          sh,
          x + dx + sx + ox,
          y + sy + oy,
          sw,
          sh,
        );
    };
    if (name === "sleepToy" && !reduced) {
      const breathe = tick % 48 < 24 ? 1 : 0;
      draw(0, 42, 64, 22, 0, 0);
      draw(0, 0, 64, 43, 0, -breathe);
    } else if (dog.shake && !reduced) {
      // shaking off: alternate bands of rows jitter left and right
      for (let band = 0; band < 8; band++)
        draw(
          0,
          band * 8,
          64,
          8,
          ((band + tick) % 2 ? 1 : -1) * (band > 1 ? 1 : 0),
          0,
        );
    } else draw(0, 0, 64, 64, 0, 0);
    c.restore();
  }
  function bubble(c, text, x, y) {
    const isHeart = text === "*",
      w = isHeart ? 7 : glyphW(text) + 4,
      h = 9;
    x = Math.max(1, Math.min(W - w - 1, Math.round(x - w / 2)));
    y = Math.round(y);
    R(c, x - 1, y - 1, w + 2, h + 2, C.ink);
    R(c, x, y, w, h, C.white);
    R(c, x + 3, y + h + 1, 2, 1, C.ink);
    R(c, x + 3, y + h, 2, 1, C.white);
    glyphs(c, text, x + (isHeart ? 1 : 2), y + 2, isHeart ? C.red : C.ink);
  }
  function paintParts(c) {
    for (const p of parts) {
      const x = Math.round(p.x),
        y = Math.round(p.y);
      if (p.k === "heart")
        glyphs(c, "*", x, y, p.life > 6 || tick % 2 ? C.red : C.redHi);
      else if (p.k === "z") glyphs(c, "z", x, y, "#ffffff");
      else if (p.k === "spark") {
        R(c, x, y - 1, 1, 3, "#fff3a0");
        R(c, x - 1, y, 3, 1, "#fff3a0");
      } else if (p.k === "crumb") R(c, x, y, 1, 1, C.kib);
      else if (p.k === "drop") {
        R(c, x, y, 1, 1, "#d8ecff");
        R(c, x, y + 1, 1, 1, "#7fa8e8");
      }
    }
    for (const pw of paws) {
      c.globalAlpha = Math.min(1, pw.life / 60) * 0.55;
      R(c, pw.x, pw.y, 2, 1, C.seam);
      R(c, pw.x - 1, pw.y - 1, 1, 1, C.seam);
      R(c, pw.x + 2, pw.y - 1, 1, 1, C.seam);
      c.globalAlpha = 1;
    }
    if (emote)
      bubble(
        c,
        emote.text,
        dog.x + 32 + dog.face * 6,
        dog.bed ? 62 : dog.y - 62,
      );
  }
  function draw() {
    if (!L || !sprite.complete) return;
    const key = [
      W,
      st.notes,
      st.due,
      hasPhoto,
      photoRev,
      new Date(st.epoch).getDate(),
      st.trophies,
      season(st.epoch),
    ].join();
    if (key !== roomKey) {
      roomKey = key;
      rc.clearRect(0, 0, W, ROOM_H);
      paintRoom(rc);
    }
    s.clearRect(0, 0, W, ROOM_H);
    s.drawImage(roomCache, 0, 0);
    const sk = skyFrameKey();
    if (sk !== skyKey) {
      skyKey = sk;
      skc.clearRect(0, 0, W, ROOM_H);
      skyAlt = paintSky(skc);
    }
    s.drawImage(skyLayer, 0, 0);
    const alt = skyAlt;
    paintDoor(s);
    const bk = [
      Math.floor(st.epoch / 60000),
      Math.round(alt),
      weatherKind(st.weather),
    ].join();
    if (bk !== beamKey) {
      beamKey = bk;
      bc.clearRect(0, 0, W, ROOM_H);
      paintBeam(bc, alt);
    }
    s.drawImage(beamLayer, 0, 0);
    paintBed(s, false);
    if (!dog.bed) paintBed(s, true);
    if (!dog.bed && !dog.toy) bitmap(s, "puppy", L.bed.x + 9, L.bed.y - 3);
    paintEnvelope(s);
    if (!dog.bed) {
      paintDog(s);
      if (dog.pose !== "eat") paintBowl(s);
    } else {
      paintBowl(s);
      paintDog(s);
    }
    if (dog.bed) paintBed(s, true);
    // light
    o.globalCompositeOperation = "source-over";
    o.drawImage(scene, 0, 0);
    let tint = keyed(TINT, alt);
    // grey days are a little dimmer indoors (never mutate the shared table)
    if (
      ["overcast", "fog", "rain", "snow"].includes(weatherKind(st.weather)) &&
      alt > 0
    )
      tint = mix(tint, [214, 220, 236], 0.6);
    if (st.lights) tint = [255, 239, 214];
    if (tint.some((channel) => channel < 254)) {
      o.globalCompositeOperation = "multiply";
      o.fillStyle = css(tint);
      o.fillRect(0, 0, W, ROOM_H);
      o.globalCompositeOperation = "source-over";
    }
    lampOn = st.lights || (alt < -2.5 && st.sleep !== "slumber");
    if (lampOn && !st.lights) {
      r.globalCompositeOperation = "source-over";
      r.clearRect(0, 0, W, ROOM_H);
      r.drawImage(scene, 0, 0);
      r.globalCompositeOperation = "multiply";
      r.fillStyle = "#ffd6a0";
      r.fillRect(0, 0, W, ROOM_H);
      r.globalCompositeOperation = "destination-in";
      r.drawImage(mask, 0, 0);
      o.drawImage(relit, 0, 0);
    }
    if (lampOn) R(o, L.sconce.x, L.sconce.y + 1, 6, 3, "#fff6cc");
    // Interior lighting never turns the real night sky into daytime.
    if (st.lights) o.drawImage(skyLayer, 0, 0);
    paintGlow(o, alt < -2);
    paintParts(o);
    if (calFlash > 0 && calFlash % 4 < 2) {
      const cl = L.cal;
      R(o, cl.x - 2, cl.y - 2, cl.w + 4, 1, "#ffe066");
      R(o, cl.x - 2, cl.y + cl.h + 1, cl.w + 4, 1, "#ffe066");
      R(o, cl.x - 2, cl.y - 2, 1, cl.h + 4, "#ffe066");
      R(o, cl.x + cl.w + 1, cl.y - 2, 1, cl.h + 4, "#ffe066");
    }
    if (flash > 0) {
      o.fillStyle = `rgba(255,255,255,${flash / 8})`;
      o.fillRect(0, 0, W, ROOM_H);
    }
    view.imageSmoothingEnabled = false;
    view.drawImage(out, 0, 0, W, ROOM_H, 0, 0, W * k, ROOM_H * k);
    if (wallPhoto) {
      // Keep real photographs at display resolution; only the wooden frame is
      // pixel art. Fit the entire image instead of cropping or posterizing it.
      const fr = L.frame, pw = (fr.w - 4) * k, ph = (fr.h - 4) * k;
      const scale = Math.min(pw / wallPhoto.naturalWidth, ph / wallPhoto.naturalHeight);
      const w = wallPhoto.naturalWidth * scale, h = wallPhoto.naturalHeight * scale;
      const x = (fr.x + 2) * k + (pw - w) / 2, y = (fr.y + 2) * k + (ph - h) / 2;
      view.save();
      view.beginPath();
      view.rect((fr.x + 2) * k, (fr.y + 2) * k, pw, ph);
      view.clip();
      view.imageSmoothingEnabled = true;
      view.imageSmoothingQuality = "high";
      view.drawImage(wallPhoto, x, y, w, h);
      view.globalCompositeOperation = "multiply";
      view.fillStyle = css(tint);
      view.fillRect(x, y, w, h);
      view.globalCompositeOperation = "source-over";
      if (flash > 0) {
        view.fillStyle = `rgba(255,255,255,${flash / 8})`;
        view.fillRect(x, y, w, h);
      }
      view.restore();
    }
  }

  // ---------- behaviour ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const say = (text, ms = 1400) => {
    emote = { text, until: tick + Math.round(ms / 33) };
  };
  const burst = (kind, n, x, y) => {
    for (let i = 0; i < n; i++)
      parts.push(
        kind === "drop"
          ? {
              k: kind,
              x: x + rnd(-22, 22),
              y: y + rnd(-10, 10),
              vx: rnd(-0.9, 0.9),
              vy: rnd(-0.4, 0.6),
              life: 14,
            }
          : {
              k: kind,
              x: x + rnd(-6, 6),
              y: y + rnd(-4, 2),
              vx: rnd(-0.25, 0.25),
              vy: kind === "crumb" ? rnd(-0.6, -0.2) : rnd(-0.55, -0.3),
              life: kind === "z" ? 48 : 30 + i * 4,
            },
      );
  };
  function plan(steps, replace = true) {
    if (replace) {
      queue = [];
      step = null;
      dog.bob = 0;
      dog.shake = 0;
      dog.toy = false;
    }
    queue.push(...steps);
    wake();
  }
  function placeInBed() {
    dog.bed = true;
    dog.pose = "sleep";
    dog.face = 1;
    dog.x = L.spot.bed;
    dog.y = 101;
    dog.hidden = false;
    dog.clip = null;
    dog.alpha = 1;
  }
  function runStep() {
    if (!step) {
      step = queue.shift();
      if (!step) return false;
      step.t0 = tick;
    }
    const sp = step;
    switch (sp.do) {
      case "walk": {
        const tx = Math.max(L.spot.min - 10, Math.min(W - 60, sp.x));
        if (reduced) {
          dog.x = tx;
          step = null;
          return true;
        }
        const d = tx - dog.x;
        if (Math.abs(d) < 1.2) {
          dog.x = tx;
          dog.pose = sp.then || "sit";
          step = null;
          return true;
        }
        dog.face = Math.sign(d);
        dog.pose = dog.toy ? "carry" : "walk";
        dog.x += Math.sign(d) * (sp.speed || 1.3);
        if (Math.random() < 0.06 && dog.y > 90)
          paws.push({
            x: Math.round(dog.x + 30),
            y: Math.round(dog.y + 1),
            life: 90,
          });
        return true;
      }
      case "walkY": {
        // up into the doorway (fading out) or back down into the room (fading in)
        if (sp.from == null) sp.from = dog.y;
        if (reduced) {
          dog.y = sp.y;
          dog.alpha = sp.y < 90 ? 0 : 1;
          step = null;
          return true;
        }
        const d = sp.y - dog.y;
        dog.pose = "walk";
        const f = Math.min(
          1,
          Math.abs(dog.y - sp.from) / Math.abs(sp.y - sp.from || 1),
        );
        dog.alpha = sp.y < sp.from ? 1 - f : f;
        if (Math.abs(d) < 1) {
          dog.y = sp.y;
          step = null;
          return true;
        }
        dog.y += Math.sign(d) * 0.7;
        return true;
      }
      case "pose":
        dog.pose = sp.pose;
        if (tick - sp.t0 >= (sp.ticks || 0)) step = null;
        return true;
      case "wait":
        if (tick - sp.t0 >= sp.ticks) step = null;
        return true;
      case "fn":
        sp.fn();
        step = null;
        return true;
      case "door": {
        const target = sp.open ? 1 : 0;
        doorOpen += Math.sign(target - doorOpen) * 0.12;
        if (Math.abs(doorOpen - target) < 0.12) {
          doorOpen = target;
          step = null;
        }
        return true;
      }
      case "eat":
        dog.pose = "eat";
        if ((tick - sp.t0) % 10 === 0) {
          kibble = Math.max(0, kibble - 1);
          burst("crumb", 2, L.bowl.x + 6, L.bowl.y - 2);
        }
        if (tick - sp.t0 >= sp.ticks) {
          kibble = 0;
          step = null;
        }
        return true;
      case "hop":
        dog.pose = "jump";
        dog.bob = -[0, 3, 5, 6, 5, 3, 0][Math.min(6, tick - sp.t0)] || 0;
        if (tick - sp.t0 >= 7) {
          dog.bob = 0;
          step = null;
        }
        return true;
      case "wag":
        dog.pose = "wag";
        if (tick - sp.t0 >= sp.ticks) {
          dog.pose = "sit";
          step = null;
        }
        return true;
      case "sniff":
        dog.pose = "sniff";
        if (tick - sp.t0 >= sp.ticks) {
          dog.pose = "sit";
          step = null;
        }
        return true;
      case "shake":
        dog.pose = "shake";
        if ((tick - sp.t0) % 4 === 0) burst("drop", 3, dog.x + 32, dog.y - 30);
        if (tick - sp.t0 >= sp.ticks) {
          dog.shake = 0;
          step = null;
        }
        return true;
    }
    step = null;
    return true;
  }
  const hop = (text) => [
    { do: "fn", fn: () => text && say(text) },
    { do: "hop" },
    { do: "pose", pose: "sit", ticks: 10 },
  ];
  function rollOver() {
    return [
      { do: "pose", pose: "bow", ticks: 12 },
      { do: "pose", pose: "roll", ticks: 10 },
      { do: "pose", pose: "belly", ticks: 35 },
      { do: "pose", pose: "roll", ticks: 10 },
      { do: "pose", pose: "sit", ticks: 10 },
    ];
  }
  function toyTrip() {
    return [
      { do: "walk", x: L.spot.bed - 22 },
      {
        do: "fn",
        fn: () => {
          dog.toy = true;
        },
      },
      { do: "walk", x: L.spot.min + 12, then: "toyA" },
      { do: "pose", pose: "sleepToy", ticks: 38 },
      { do: "walk", x: L.spot.bed - 22, then: "toyA" },
      {
        do: "fn",
        fn: () => {
          dog.toy = false;
        },
      },
      { do: "pose", pose: "greet", ticks: 20 },
      { do: "pose", pose: "sit", ticks: 4 },
    ];
  }
  function idle() {
    if (reduced || st.sleep || st.walk || queue.length || step) return;
    if (tick < idleAt) return;
    idleAt = tick + Math.round(rnd(90, 210));
    const roll = Math.random();
    if (roll < 0.28)
      plan(
        [
          { do: "walk", x: rnd(L.spot.min, L.spot.max) },
          { do: "pose", pose: "sit", ticks: 10 },
        ],
        false,
      );
    else if (roll < 0.44) plan([{ do: "wag", ticks: 36 }], false);
    else if (roll < 0.58)
      plan(
        [
          { do: "pose", pose: "tilt", ticks: 36 },
          { do: "pose", pose: "sit", ticks: 8 },
        ],
        false,
      );
    else if (roll < 0.7)
      plan(
        [
          { do: "pose", pose: "scratch", ticks: 42 },
          { do: "pose", pose: "sit", ticks: 8 },
        ],
        false,
      );
    else if (roll < 0.8)
      plan(
        [
          { do: "pose", pose: "bow", ticks: 32 },
          { do: "pose", pose: "sit", ticks: 8 },
        ],
        false,
      );
    else if (roll < 0.89) plan(rollOver(), false);
    else if (roll < 0.96) plan(toyTrip(), false);
    else
      plan(
        [
          { do: "pose", pose: "yawn", ticks: 26 },
          { do: "pose", pose: "sit", ticks: 6 },
        ],
        false,
      );
  }
  const skyFrameKey = () => {
    const wk = weatherKind(st.weather);
    return [
      Math.floor(st.epoch / 60000),
      Math.floor(tick / 24),
      (tick >> 3) % 7,
      st.walk && !reduced ? Math.floor(tick * 0.35) : 0,
      wk,
      wk === "rain" || wk === "snow"
        ? tick
        : wk === "fog"
          ? Math.floor(tick / 10)
          : 0,
    ].join();
  };
  function frameSig() {
    return [
      dog.x | 0,
      dog.y | 0,
      frameOf(),
      dog.alpha,
      dog.bob,
      dog.shake ? tick % 2 : 0,
      dog.toy,
      dog.face,
      dog.hidden,
      dog.bed,
      st.trophies,
      dog.pose === "sleep" && !reduced ? tick % 48 < 24 : 0,
      parts
        .map((p) => `${p.k}${p.x | 0},${p.y | 0}${p.life > 6 || tick % 2}`)
        .join(";"),
      paws.map((p) => Math.min(6, Math.ceil(p.life / 10))).join(""),
      emote?.text,
      kibble,
      doorOpen,
      flash,
      calFlash,
      envLift,
      envGone > 0,
      leash,
      skyFrameKey(),
      st.pending,
      st.error,
      st.notes,
      st.due,
      st.sleep,
      st.lights,
      st.walk,
      hasPhoto,
      photoRev,
    ].join("|");
  }
  function loop(ts) {
    raf = 0;
    if (!visible || paused) return;
    const dt = Math.min(200, ts - (last || ts));
    last = ts;
    acc += dt;
    let ticked = false;
    while (acc >= 33) {
      acc -= 33;
      tick++;
      ticked = true;
      if (!queue.length && !step) idle();
      else runStep();
      if (tick > blinkAt + 120 && Math.random() < 0.02) blinkAt = tick + 4;
      parts = parts.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        return --p.life > 0;
      });
      paws = paws.filter((p) => --p.life > 0);
      if (emote && tick > emote.until) emote = null;
      if (flash > 0) flash--;
      if (calFlash > 0) calFlash--;
      if (st.sleep && dog.bed && tick % 40 === 0) burst("z", 1, dog.x + 44, 66);
      if (envGone > 0) {
        envLift += 1;
        if (--envGone <= 0) envLift = 0;
      }
    }
    if (ticked) {
      const sig = frameSig();
      if (sig !== lastSig) {
        lastSig = sig;
        draw();
      }
    }
    raf = requestAnimationFrame(loop);
  }
  function wake() {
    if (!raf && visible && !paused && !still && !reduced) {
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  }

  // ---------- public ----------
  function set(next, { instant = false } = {}) {
    const prev = { ...st };
    Object.assign(st, next);
    if (!L) return;
    if (instant || reduced || still) settle();
    else {
      if (st.sleep && !prev.sleep)
        plan([
          ...(prev.walk ? comeHome() : []),
          ...(st.sleep === "slumber"
            ? [{ do: "pose", pose: "yawn", ticks: 24 }]
            : []),
          { do: "walk", x: L.spot.bed - 2 },
          {
            do: "fn",
            fn: () => {
              placeInBed();
              say("z");
            },
          },
          { do: "wait", ticks: 20 },
        ]);
      else if (!st.sleep && prev.sleep)
        plan([
          {
            do: "fn",
            fn: () => {
              dog.bed = false;
              dog.y = 102;
              dog.x = L.spot.bed - 6;
              say("!");
            },
          },
          ...hop(),
          { do: "walk", x: L.spot.bed - 50 },
          { do: "wag", ticks: 30 },
        ]);
      if (st.walk && !prev.walk)
        plan([
          ...(prev.sleep
            ? [
                {
                  do: "fn",
                  fn: () => {
                    dog.bed = false;
                    dog.y = 102;
                  },
                },
              ]
            : []),
          { do: "walk", x: L.spot.door },
          {
            do: "fn",
            fn: () => {
              leash = false;
              dog.face = 1;
            },
          },
          { do: "door", open: true },
          { do: "walkY", y: 84 },
          {
            do: "fn",
            fn: () => {
              dog.hidden = true;
              dog.alpha = 1;
              dog.y = 102;
            },
          },
          { do: "door", open: false },
        ]);
      else if (!st.walk && prev.walk && !st.sleep) plan(comeHome());
    }
    if (prev.pending && !st.pending && !st.error) envGone = 26;
    draw();
    wake();
  }
  function comeHome() {
    return [
      { do: "door", open: true },
      {
        do: "fn",
        fn: () => {
          dog.hidden = false;
          dog.alpha = 0;
          dog.x = L.spot.door;
          dog.y = 84;
          dog.face = -1;
        },
      },
      { do: "walkY", y: 102 },
      {
        do: "fn",
        fn: () => {
          dog.alpha = 1;
          leash = true;
          for (let i = 0; i < 5; i++)
            paws.push({
              x: Math.round(L.spot.door + 22 - i * 9),
              y: 103 + (i % 2) * 2,
              life: 150,
            });
        },
      },
      { do: "door", open: false },
      ...hop("!"),
      { do: "wag", ticks: 30 },
    ];
  }
  function settle() {
    // place everything for the current state with no choreography
    if (!L) return;
    queue = [];
    step = null;
    dog.alpha = 1;
    dog.bob = 0;
    dog.shake = 0;
    dog.toy = false;
    parts = [];
    emote = null;
    doorOpen = 0;
    if (st.walk) {
      dog.hidden = true;
      leash = false;
      dog.bed = false;
      dog.y = 102;
    } else if (st.sleep) {
      leash = true;
      placeInBed();
    } else {
      leash = true;
      dog.hidden = false;
      if (dog.bed || dog.pose === "sleep") {
        dog.bed = false;
        dog.x = L.spot.bed - 48;
      }
      dog.y = 102;
      dog.pose = "sit";
    }
  }
  function react(kind) {
    if (!L) return;
    if (reduced || still) {
      settle();
      draw();
      return;
    }
    if (st.walk) {
      // he is out; show it at the door instead
      if (["pee", "poop"].includes(kind)) burst("spark", 4, L.door.x + 13, 40);
      if (kind === "pat" || kind === "heart")
        burst("heart", 2, L.door.x + 10, 40);
      return wake();
    }
    if (st.sleep) {
      if (kind === "pat" || kind === "heart") burst("heart", 2, dog.x + 34, 64);
      else say("z");
      return wake();
    }
    const head = () => dog.y - 52;
    switch (kind) {
      case "pee":
      case "poop":
        plan([
          { do: "walk", x: L.spot.door - 4 },
          {
            do: "fn",
            fn: () => {
              dog.face = 1;
            },
          },
          { do: "sniff", ticks: 24 },
          { do: "fn", fn: () => burst("spark", 4, dog.x + 34, head()) },
          ...hop("~"),
          { do: "wag", ticks: 24 },
        ]);
        break;
      case "bath":
        plan([
          { do: "walk", x: L.spot.min + 36 },
          {
            do: "fn",
            fn: () => {
              dog.face = 1;
              say("!");
            },
          },
          { do: "shake", ticks: 30 },
          { do: "pose", pose: "greet", ticks: 35 },
          ...hop("~"),
          { do: "wag", ticks: 20 },
        ]);
        break;
      case "groom":
        plan([
          { do: "fn", fn: () => burst("spark", 5, dog.x + 32, head()) },
          ...hop("~"),
          { do: "wag", ticks: 24 },
        ]);
        break;
      case "toy":
        plan(toyTrip());
        break;
      case "meal":
        plan([
          {
            do: "fn",
            fn: () => {
              kibble = 6;
            },
          },
          { do: "walk", x: L.spot.bowl - 18 },
          {
            do: "fn",
            fn: () => {
              dog.face = 1;
              say("nom", 1800);
            },
          },
          { do: "eat", ticks: 60 },
          ...hop("*"),
        ]);
        break;
      case "photo":
        flash = 8;
        plan([{ do: "fn", fn: () => (dog.face = -1) }, ...hop("!")]);
        break;
      case "done":
        calFlash = 24;
        plan([{ do: "walk", x: L.cal.x - 30 }, ...hop("~")]);
        break;
      case "partnerMeal":
        plan([
          { do: "walk", x: L.spot.door - 2 },
          {
            do: "fn",
            fn: () => {
              dog.face = 1;
            },
          },
          ...hop("!"),
          {
            do: "fn",
            fn: () => {
              kibble = 6;
            },
          },
          { do: "walk", x: L.spot.bowl },
          {
            do: "fn",
            fn: () => {
              dog.face = 1;
              say("nom", 1800);
            },
          },
          { do: "eat", ticks: 60 },
          ...hop("*"),
        ]);
        break;
      case "partner":
        plan([
          { do: "walk", x: L.spot.door - 2 },
          {
            do: "fn",
            fn: () => {
              dog.face = 1;
            },
          },
          { do: "pose", pose: "greet", ticks: 24 },
          ...hop("!"),
          { do: "wag", ticks: 30 },
        ]);
        break;
      case "heart":
        burst("heart", 3, dog.x + 32, head());
        plan(hop());
        break;
      case "pat":
        burst("heart", 3, dog.x + 32, head());
        plan([...rollOver(), { do: "wag", ticks: 24 }]);
        break;
      case "undo":
        plan([
          { do: "fn", fn: () => say("?") },
          { do: "pose", pose: "sit", ticks: 30 },
        ]);
        break;
    }
  }
  function setPhoto(img) {
    wallPhoto = img || null;
    hasPhoto = !!img;
    photoRev++;
    draw();
  }
  function hit(ax, ay) {
    const inR = (b, pad = 2) =>
      ax >= b.x - pad &&
      ax <= b.x + b.w + pad &&
      ay >= b.y - pad &&
      ay <= b.y + b.h + pad;
    if (
      !dog.hidden &&
      ax >= dog.x + 8 &&
      ax <= dog.x + 56 &&
      ay >= dog.y - 52 &&
      ay <= dog.y
    )
      return "winnie";
    if (inR(L.bowl, 4)) return "bowl";
    if (
      !dog.bed &&
      !dog.toy &&
      inR({ x: L.bed.x + 9, y: L.bed.y - 3, w: 12, h: 11 })
    )
      return "toy";
    if (inR(L.bed)) return "bed";
    if (inR(L.door) || inR({ x: L.door.x - 4, y: 77, w: L.door.w + 8, h: 6 }))
      return "door";
    if (inR(L.fridge)) return "fridge";
    if (inR(L.cal)) return "calendar";
    if (inR(L.frame)) return "photo";
    if (inR(L.ribbon)) return "ribbon";
    if (
      st.trophies > 0 &&
      inR({ x: L.shelf.x, y: L.shelf.y - 8, w: L.shelf.w, h: 12 })
    )
      return "shelf";
    if (inR(L.win)) return "window";
    return null;
  }
  const toArt = (e) => {
    const b = canvas.getBoundingClientRect();
    return [
      ((e.clientX - b.left) / b.width) * W,
      ((e.clientY - b.top) / b.height) * ROOM_H,
    ];
  };
  if (!still) {
    canvas.addEventListener("click", (e) => {
      const what = hit(...toArt(e));
      if (what) onObject(what);
    });
    canvas.addEventListener("pointermove", (e) => {
      canvas.style.cursor = hit(...toArt(e)) ? "pointer" : "default";
    });
  }
  motion.addEventListener("change", (event) => {
    if (opts.reduced !== undefined) return;
    reduced = event.matches;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    settle();
    draw();
    wake();
  });
  // Resizing the canvas changes its parent's height. Defer that write so it
  // doesn't trigger a ResizeObserver loop during phone viewport changes.
  let resizeFrame = 0;
  const ro = new ResizeObserver(() => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      size();
    });
  });
  ro.observe(canvas.parentElement);
  if (!still) {
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting && !document.hidden;
      wake();
    }).observe(canvas);
    document.addEventListener("visibilitychange", () => {
      visible = !document.hidden;
      wake();
    });
  }
  if (sprite.complete) size();
  else sprite.addEventListener("load", size, { once: true });
  return {
    set,
    react,
    setPhoto,
    get lights() { return st.lights; },
    setLights(on) { st.lights = !!on; draw(); },
    draw: () => draw(),
    pause(on) {
      paused = !!on;
      if (!paused) wake();
    },
    place(x, pose = "sit", face = 1) {
      dog.x = x;
      dog.pose = pose;
      dog.face = face;
      draw();
    },
    get layout() {
      return L;
    },
    get dog() {
      return dog;
    },
    feed(n) {
      kibble = n;
      draw();
    },
    openDoor(v) {
      doorOpen = v;
      draw();
    },
    say(t) {
      say(t, 1e9);
      draw();
    },
    hearts(n) {
      burst("heart", n, dog.x + 32, dog.y - 56);
      for (const p of parts) p.y -= 4;
      draw();
    },
  };
}
