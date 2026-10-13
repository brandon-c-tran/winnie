// Memories: this week's postcard, on this day, milestones, and the year so far.
import {
  milestones,
  weekStats,
  onThisDay,
  yearRecap,
} from "../memories.js?v=4.11";
import { cityFor } from "../places.js?v=4.11";
import { icon, TYPES as TYPE_META } from "../icons.js?v=4.0";
import { facts, sync } from "./services.js?v=4.11";
import { $, esc } from "./format.js?v=4.11";
import { html, toast } from "./ui.js?v=4.11";
import { hydratePhotos } from "./entries.js?v=4.11";
import { download } from "./photos.js?v=4.11";

const DAY = 86400000;
const short = new Intl.DateTimeFormat([], { month: "short", day: "numeric" });
const full = new Intl.DateTimeFormat([], {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// ---------- milestones (memoised on the event list and on the city directory) ----------
let msKey = null,
  msCache = [];
const cityOf = (e) => {
  const c = cityFor(e);
  return c ? { id: c.name, name: c.name } : null;
};
export function allMilestones() {
  const events = facts(),
    pinned = events.find((e) => e.placePin || e.location),
    key = [events, pinned ? !!cityFor(pinned) : false];
  if (!msKey || msKey[0] !== key[0] || msKey[1] !== key[1]) {
    msKey = key;
    msCache = milestones(events, { cityOf });
  }
  return msCache;
}
export const recentTrophies = () =>
  allMilestones().filter((m) => Date.now() - m.time < 30 * DAY).length;

// ---------- the view ----------
let recapYear = new Date().getFullYear();
export function renderMemories() {
  const events = facts(),
    week = weekStats(events),
    ago = onThisDay(events),
    list = allMilestones(),
    years = [
      ...new Set(events.map((e) => new Date(e.time).getFullYear())),
    ].sort((a, b) => b - a),
    recap = yearRecap(events, recapYear);
  const range = `${short.format(week.start)} to ${short.format(week.end)}`;
  const agoHTML = ago.length
    ? `<section class="card mem" aria-labelledby="ago-title"><div class="card-head"><h2 id="ago-title">On this day</h2></div>${ago
        .map(
          (g) =>
            `<p class="mem-sub">${g.ago} ${g.unit}${g.ago > 1 ? "s" : ""} ago</p><div class="mem-photos">${g.items
              .flatMap((e) =>
                e.photos.map(
                  (p) =>
                    `<button class="mem-photo" data-open="${esc(e.id)}" aria-label="Photo from ${full.format(e.time)}"><img data-photo="${esc(p.id)}" alt="" loading="lazy"></button>`,
                ),
              )
              .join("")}</div>`,
        )
        .join("")}</section>`
    : "";
  const count = (n, label, type) =>
    `<div class="mem-count"><span class="sq" style="--c:var(--${type})">${icon(TYPE_META[type === "groom" ? "grooming" : type]?.[0] || "more", "ic sm")}</span><b>${n.toLocaleString()}</b><span>${label}</span></div>`;
  const recapRows = [
    [recap.byType.pee || 0, "pee", "pee"],
    [recap.byType.poop || 0, "poop", "poop"],
    [recap.byType.meal || 0, "meals", "meal"],
    [recap.byType.walk || 0, "walks", "walk"],
    [recap.byType.bath || 0, "baths", "groom"],
    [recap.photos, "photos", "photo"],
  ];
  html(
    "photo-items",
    `<section class="card mem" aria-labelledby="week-title">
      <div class="card-head"><h2 id="week-title">This week</h2><span class="muted">${range}</span></div>
      <canvas id="postcard" class="postcard" width="1080" height="1350" role="img" aria-label="Postcard for ${range}: ${week.counts.pee} pee, ${week.counts.poop} poop, ${week.counts.meal} meals, ${week.counts.walk} walks"></canvas>
      <div class="button-row"><button class="px btn ink" data-act="postcard-share">Share</button><button class="px btn" data-act="postcard-save">Save</button></div>
    </section>
    ${agoHTML}
    <section class="card mem" aria-labelledby="ms-title">
      <div class="card-head"><h2 id="ms-title">Milestones</h2><span class="muted">${list.length}</span></div>
      ${list.length ? `<div class="mem-list">${list.map((m) => `<button class="mem-row" data-open="${esc(m.eventId)}"><span class="sq" style="--c:var(--pee)">${icon("star", "ic sm")}</span><b>${esc(m.title)}</b><span class="muted">${full.format(m.time)}</span></button>`).join("")}</div>` : `<p class="muted">None yet.</p>`}
    </section>
    <section class="card mem" aria-labelledby="year-title">
      <div class="card-head"><h2 id="year-title">${recapYear === new Date().getFullYear() ? `${recapYear} so far` : recapYear}</h2>${years.length > 1 ? `<span class="seg">${years.map((y) => `<button class="px btn" data-recap-year="${y}" aria-pressed="${y === recapYear}">${y}</button>`).join("")}</span>` : ""}</div>
      <div class="mem-counts">${recapRows.map(([n, label, type]) => count(n, label, type)).join("")}</div>
      <p class="muted">${recap.entries.toLocaleString()} entries on ${recap.days.toLocaleString()} days${recap.busiestDay ? `. Busiest day ${short.format(new Date(recap.busiestDay.day + "T12:00"))}, ${recap.busiestDay.entries} entries.` : "."}</p>
    </section>`,
  );
  hydratePhotos();
  drawPostcard(week, range).catch(() => {});
}

// ---------- the postcard ----------
const CARD = { w: 1080, h: 1350 };
const COLORS = {
  ink: "#22264a",
  ground: "#eef1fb",
  muted: "#59608c",
  g: "rgba(92,122,214,0.55)",
};
async function photoImage(best) {
  if (!best) return null;
  try {
    const blob = await sync.photo(best.photoId),
      img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    return img;
  } catch {
    return null;
  }
}
let drawing = 0;
async function drawPostcard(week, range) {
  const canvas = $("postcard");
  if (!canvas) return;
  const ticket = ++drawing;
  await Promise.all([
    document.fonts.load('700 80px "Pixelify Sans"'),
    document.fonts.load('500 40px "Rubik"'),
  ]).catch(() => {});
  const [photo, ...faceImgs] = await Promise.all([
    photoImage(week.best),
    loadImage("/photos/brandon-pixel.png"),
    loadImage("/photos/kim-pixel.png"),
  ]);
  const faces = [
    ["brandon", faceImgs[0]],
    ["kim", faceImgs[1]],
  ].filter(([, img]) => img);
  if (ticket !== drawing || !canvas.isConnected) return;
  const c = canvas.getContext("2d");
  c.imageSmoothingEnabled = false;
  // gingham border
  c.fillStyle = "#f6f7ff";
  c.fillRect(0, 0, CARD.w, CARD.h);
  c.fillStyle = COLORS.g;
  for (let i = 0; i < CARD.w; i += 36) c.fillRect(i, 0, 18, CARD.h);
  for (let j = 0; j < CARD.h; j += 36) c.fillRect(0, j, CARD.w, 18);
  // card
  c.fillStyle = COLORS.ink;
  c.fillRect(48, 48, CARD.w - 96, CARD.h - 96);
  c.fillStyle = COLORS.ground;
  c.fillRect(56, 56, CARD.w - 112, CARD.h - 112);
  c.fillStyle = COLORS.ink;
  c.font = '700 96px "Pixelify Sans", monospace';
  c.fillText("Winnie", 96, 170);
  c.font = '500 38px "Rubik", sans-serif';
  c.fillStyle = COLORS.muted;
  c.fillText(range, 96, 226);
  // the room, as it is right now
  const room = $("room"),
    rw = CARD.w - 192,
    rh = Math.round((rw * room.height) / room.width);
  c.fillStyle = COLORS.ink;
  c.fillRect(90, 266, rw + 12, rh + 12);
  c.drawImage(room, 96, 272, rw, rh);
  // the week's best photo and counts
  const top = 272 + rh + 48;
  let statsX = 96;
  if (photo) {
    const size = 420,
      s = Math.min(photo.naturalWidth, photo.naturalHeight);
    c.fillStyle = COLORS.ink;
    c.fillRect(90, top - 6, size + 12, size + 12);
    c.imageSmoothingEnabled = true;
    c.drawImage(
      photo,
      (photo.naturalWidth - s) / 2,
      (photo.naturalHeight - s) / 2,
      s,
      s,
      96,
      top,
      size,
      size,
    );
    c.imageSmoothingEnabled = false;
    statsX = 96 + size + 60;
  }
  const rows = [
    ["pee", "Pee", week.counts.pee, "#ffd84a"],
    ["poop", "Poop", week.counts.poop, "#eaa56d"],
    ["meal", "Meals", week.counts.meal, "#7fe0a6"],
    ["walk", "Walks", week.counts.walk, "#a2e36f"],
    ["groom", "Grooming", week.counts.grooming, "#8fe3e0"],
    ["photo", "Photos", week.counts.photos, "#ff9ec2"],
  ];
  const colW = photo ? CARD.w - statsX - 96 : (CARD.w - 192) / 2;
  rows.forEach(([, label, n, color], i) => {
    const col = photo ? 0 : i % 2,
      row = photo ? i : Math.floor(i / 2),
      x = statsX + col * colW,
      y = top + row * (photo ? 70 : 110);
    c.fillStyle = COLORS.ink;
    c.fillRect(x, y, 44, 44);
    c.fillStyle = color;
    c.fillRect(x + 5, y + 5, 34, 34);
    c.fillStyle = COLORS.ink;
    c.font = '700 54px "Pixelify Sans", monospace';
    c.fillText(String(n), x + 64, y + 42);
    const numberWidth = c.measureText(String(n)).width;
    c.font = '500 36px "Rubik", sans-serif';
    c.fillStyle = COLORS.muted;
    c.fillText(label, x + 64 + numberWidth + 14, y + 40);
  });
  c.font = '700 36px "Pixelify Sans", monospace';
  c.fillStyle = COLORS.muted;
  c.fillText(
    `${week.days} ${week.days === 1 ? "day" : "days"} logged`,
    96,
    CARD.h - 96,
  );
  // who logged it: each face with their count, right-aligned on the footer line
  let x = CARD.w - 96;
  for (const [who, img] of faces.reverse()) {
    const n = String(week.byPerson?.[who] || 0);
    c.font = '700 44px "Pixelify Sans", monospace';
    const w = c.measureText(n).width;
    c.fillStyle = COLORS.ink;
    c.fillText(n, x - w, CARD.h - 96);
    x -= w + 14 + 64;
    c.fillRect(x - 4, CARD.h - 96 - 56, 72, 72);
    c.drawImage(img, x, CARD.h - 96 - 52, 64, 64);
    x -= 40;
  }
}
const loadImage = (src) =>
  new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
export async function postcard(share) {
  const canvas = $("postcard");
  if (!canvas) return;
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png")),
    name = `winnie-week-${new Date().toISOString().slice(0, 10)}.png`,
    file = new File([blob], name, { type: "image/png" });
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Winnie" });
    } catch {}
    return;
  }
  download(blob, name, "image/png");
  toast("Postcard saved");
}
export function setRecapYear(y) {
  recapYear = y;
  renderMemories();
}

// ---------- Today: on this day, only when it is a whole year ago ----------
export function onThisDayToday(events) {
  const years = onThisDay(events).filter((g) => g.unit === "year");
  const box = $("on-this-day");
  box.hidden = !years.length;
  if (!years.length) return;
  const g = years[0],
    e = g.items[0];
  html(
    "on-this-day",
    `<div class="card-head"><h2>${g.ago === 1 ? "A year ago today" : `${g.ago} years ago today`}</h2></div><button class="mem-photo wide" data-open="${esc(e.id)}"><img data-photo="${esc(e.photos[0].id)}" alt="Photo from ${full.format(e.time)}"></button>`,
  );
  hydratePhotos();
}
