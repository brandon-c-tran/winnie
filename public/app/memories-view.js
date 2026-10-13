// Memories: this week's postcard, on this day, milestones, and the year so far.
import { memoryEvents } from "../keepsakes.js?v=4.15";
import { placeLabel } from "../places.js?v=4.15";
import {
  milestones,
  weekStats,
  onThisDay,
  yearRecap,
} from "../memories.js?v=4.15";
import { cityFor } from "../places.js?v=4.15";
import { icon, TYPES as TYPE_META } from "../icons.js?v=4.0";
import { facts, sync } from "./services.js?v=4.15";
import { $, esc } from "./format.js?v=4.15";
import { html, toast } from "./ui.js?v=4.15";
import { hydratePhotos } from "./entries.js?v=4.15";
import { download } from "./photos.js?v=4.15";

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
let postcardPhoto = "";
export function renderMemories() {
  const events = facts(),
    memories = memoryEvents(events),
    week = weekStats(memories),
    ago = onThisDay(memories),
    list = allMilestones(),
    years = [
      ...new Set(events.map((e) => new Date(e.time).getFullYear())),
    ].sort((a, b) => b - a),
    recap = yearRecap(events, recapYear);
  const choices = memories
    .flatMap((e) => e.photos.map((p) => ({ e, p })))
    .slice(0, 60);
  const chosen =
    choices.find((x) => x.p.id === postcardPhoto) ||
    choices.find((x) => x.p.id === week.best?.photoId) ||
    choices[0];
  if (chosen)
    week.best = {
      eventId: chosen.e.id,
      photoId: chosen.p.id,
      time: chosen.e.time,
    };
  week.caption = chosen?.e.note || "";
  week.place = chosen ? placeLabel(chosen.e) : "";
  const range = chosen
    ? full.format(chosen.e.time)
    : "";
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
      <div class="card-head"><h2 id="week-title">Postcard</h2><span class="muted">${range}</span></div>
      ${chosen ? `<label>Photo<select id="postcard-photo">${choices.map(({ e, p }) => `<option value="${esc(p.id)}" ${p.id === chosen.p.id ? "selected" : ""}>${esc(e.note || "Winnie")} — ${full.format(e.time)}</option>`).join("")}</select></label><button class="text-button" data-edit="${esc(chosen.e.id)}">Edit caption</button>` : `<p>No keepsakes yet.</p><button class="px btn" data-add-photos>Add photos</button>`}
      <canvas ${chosen ? "" : "hidden"} id="postcard" class="postcard" width="1080" height="1350" role="img" aria-label="Winnie postcard: ${esc(range)}${week.caption ? ", " + esc(week.caption) : ""}"></canvas>
      <div class="button-row" ${chosen ? "" : "hidden"}><button class="px btn ink" data-act="postcard-share">Share</button><button class="px btn" data-act="postcard-save">Save</button></div>
    </section>
    ${agoHTML}
    <details class="card mem"><summary>Care milestones and totals</summary><section aria-labelledby="ms-title">
      <div class="card-head"><h2 id="ms-title">Milestones</h2><span class="muted">${list.length}</span></div>
      ${list.length ? `<div class="mem-list">${list.map((m) => `<button class="mem-row" data-open="${esc(m.eventId)}"><span class="sq" style="--c:var(--pee)">${icon("star", "ic sm")}</span><b>${esc(m.title)}</b><span class="muted">${full.format(m.time)}</span></button>`).join("")}</div>` : `<p class="muted">None yet.</p>`}
    </section>
    <section aria-labelledby="year-title">
      <div class="card-head"><h2 id="year-title">${recapYear === new Date().getFullYear() ? `${recapYear} so far` : recapYear}</h2>${years.length > 1 ? `<span class="seg">${years.map((y) => `<button class="px btn" data-recap-year="${y}" aria-pressed="${y === recapYear}">${y}</button>`).join("")}</span>` : ""}</div>
      <div class="mem-counts">${recapRows.map(([n, label, type]) => count(n, label, type)).join("")}</div>
      <p class="muted">${recap.entries.toLocaleString()} entries on ${recap.days.toLocaleString()} days${recap.busiestDay ? `. Busiest day ${short.format(new Date(recap.busiestDay.day + "T12:00"))}, ${recap.busiestDay.entries} entries.` : "."}</p>
    </section></details>`,
  );
  if ($("postcard-photo"))
    $("postcard-photo").onchange = (event) => {
      postcardPhoto = event.target.value;
      renderMemories();
      $("postcard-photo")?.focus();
    };
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
  canvas.dataset.ready = "false";
  document
    .querySelectorAll('[data-act^="postcard-"]')
    .forEach((button) => (button.disabled = true));
  await Promise.all([
    document.fonts.load('700 80px "Pixelify Sans"'),
    document.fonts.load('500 40px "Rubik"'),
  ]).catch(() => {});
  const photo = await photoImage(week.best);
  if (ticket !== drawing || !canvas.isConnected) {
    if (photo) URL.revokeObjectURL(photo.src);
    return;
  }
  const c = canvas.getContext("2d");
  c.fillStyle = "#f6f7ff";
  c.fillRect(0, 0, CARD.w, CARD.h);
  c.fillStyle = COLORS.g;
  for (let x = 0; x < CARD.w; x += 36) c.fillRect(x, 0, 18, CARD.h);
  for (let y = 0; y < CARD.h; y += 36) c.fillRect(0, y, CARD.w, 18);
  c.fillStyle = COLORS.ink;
  c.fillRect(48, 48, CARD.w - 96, CARD.h - 96);
  c.fillStyle = COLORS.ground;
  c.fillRect(56, 56, CARD.w - 112, CARD.h - 112);
  c.fillStyle = COLORS.ink;
  c.font = '700 96px "Pixelify Sans", monospace';
  c.fillText("Winnie", 96, 165);
  c.font = '500 36px "Rubik", sans-serif';
  c.fillStyle = COLORS.muted;
  c.fillText(range, 96, 220);
  if (photo) {
    const scale = Math.min(888 / photo.naturalWidth, 780 / photo.naturalHeight);
    const w = photo.naturalWidth * scale,
      h = photo.naturalHeight * scale;
    c.imageSmoothingEnabled = true;
    c.drawImage(photo, (CARD.w - w) / 2, 270 + (780 - h) / 2, w, h);
    URL.revokeObjectURL(photo.src);
  }
  c.fillStyle = COLORS.ink;
  c.font = '500 36px "Rubik", sans-serif';
  const words = week.caption.split(/\s+/);
  let line = "",
    y = 1110,
    lines = 0;
  for (const word of words) {
    const next = (line ? line + " " : "") + word;
    if (c.measureText(next).width > 888 && line) {
      c.fillText(line, 96, y, 888);
      y += 46;
      lines++;
      line = word;
      if (lines === 2) {
        line += "…";
        break;
      }
    } else line = next;
  }
  if (line) c.fillText(line, 96, y, 888);
  c.fillStyle = COLORS.muted;
  c.font = '500 30px "Rubik", sans-serif';
  if (week.place) c.fillText(week.place, 96, 1260, 888);
  canvas.dataset.ready = String(!!photo);
  document
    .querySelectorAll('[data-act^="postcard-"]')
    .forEach((button) => (button.disabled = !photo));
  if (!photo && week.best)
    toast("This photo is not available yet. Connect and try again.");
}
export async function postcard(share) {
  const canvas = $("postcard");
  if (!canvas || canvas.dataset.ready !== "true") return;
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
  const years = onThisDay(memoryEvents(events));
  const box = $("on-this-day");
  box.hidden = !years.length;
  if (!years.length) return;
  const g = years[0],
    e = g.items[0];
  html(
    "on-this-day",
    `<div class="card-head"><h2>${`${g.ago === 1 ? "A" : g.ago} ${g.unit}${g.ago === 1 ? "" : "s"} ago today`}</h2></div><button class="mem-photo wide" data-open="${esc(e.id)}"><img data-photo="${esc(e.photos[0].id)}" alt="Photo from ${full.format(e.time)}"></button>`,
  );
  hydratePhotos();
}
