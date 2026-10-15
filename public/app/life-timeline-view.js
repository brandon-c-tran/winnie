import { lifeTimeline } from "../life-timeline.js?v=4.29";
import { ageAt } from "../lifetime.js?v=4.29";
import { facts } from "./services.js?v=4.29";
import { $, esc } from "./format.js?v=4.29";
import { hydratePhotos } from "./entries.js?v=4.29";
import { recollectionsHTML } from "./recollections.js?v=4.29";
import { state } from "./state.js?v=4.29";

const BATCH = 8;
let start = 0,
  end = BATCH,
  rows = [],
  observer,
  key;
const expanded = new Map();
const date = (day) =>
  new Date(day + "T12:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const age = (n) =>
  n === 0
    ? "His first weeks"
    : n === 12
      ? "One year old"
      : `${n} ${n === 1 ? "month" : "months"} old`;
const changed = () => document.dispatchEvent(new Event("winnie:story-change"));
function dayHTML(g, previous) {
  const count = expanded.get(g.day) || 3,
    photos = g.photos.slice(0, count);
  const voices = [
    ...new Map(photos.map((p) => [p.event.id, p.event])).values(),
  ];
  return `${!previous || previous.age !== g.age ? `<h2 class="life-age" id="life-age-${g.age}">${age(g.age)}</h2>` : ""}<article class="life-day" id="life-day-${g.day}" data-life-memory="${g.day}" aria-label="Memories from ${date(g.day)}">
    <header class="life-date"><time datetime="${g.day}">${date(g.day)}</time><span>${esc(ageAt(g.day))}</span></header>
    ${g.landmarks.map((l) => `<div class="life-landmark">${l.id ? `<button class="text-button" ${l.trip ? "data-trip" : "data-open"}="${esc(l.id)}">${esc(l.title)}</button>` : `<h3>${esc(l.title)}</h3>`}${l.trip ? `<p class="fine">${date(g.day)} to ${date(l.end)}</p>` : ""}</div>`).join("")}
    ${photos.length ? `<div class="life-photos ${photos.length === 1 ? "single" : ""}">${photos.map((p, i) => `<button class="life-photo ${i === 0 ? "lead" : ""}" data-open="${esc(p.event.id)}" aria-label="Open photo from ${date(p.day)}${p.location ? ", " + esc(p.location) : ""}"><img data-photo="${esc(p.photo.id)}" loading="lazy" alt="Winnie, ${esc(ageAt(p.day))}${p.location ? " in " + esc(p.location) : ""}"></button>`).join("")}</div>${[...new Set(photos.map((p) => p.location).filter(Boolean))].map((place) => `<p class="life-place">${esc(place)}</p>`).join("")}` : ""}
    ${g.photos.length > photos.length ? `<button class="text-button life-more-photos" data-life-photos="${g.day}">Show ${Math.min(12, g.photos.length - photos.length)} more photos from this day</button>` : ""}
    ${voices.map((e) => `${e.type === "moment" && e.note && !e.tags?.includes("trip-collection") && !e.milestone ? `<p class="life-caption">${esc(e.note)}</p>` : ""}${recollectionsHTML(e)}`).join("")}
    ${g.moments.map((e) => `<button class="life-note" data-open="${esc(e.id)}">${esc(e.note)}</button>${recollectionsHTML(e)}`).join("")}
    ${photos.length ? `<button class="text-button life-recollect" data-recollect="${esc(photos[0].event.id)}" data-memory-photo="${esc(photos[0].photo.id)}">Add a recollection</button>` : ""}
  </article>`;
}
function entriesHTML() {
  return rows
    .slice(start, end)
    .map((g, i) => dayHTML(g, i ? rows[start + i - 1] : null))
    .join("");
}
export function lifeTimelineHTML() {
  const source = facts();
  if (key !== source) {
    const anchor = rows[start]?.day;
    rows = lifeTimeline(source);
    key = source;
    if (start > 0 && anchor) {
      const at = rows.findIndex((g) => g.day >= anchor);
      if (at >= 0) {
        end += at - start;
        start = at;
      }
    }
    end = Math.max(start + BATCH, end);
  }
  const ageDays = new Map();
  for (const g of rows) if (!ageDays.has(g.age)) ageDays.set(g.age, g.day);
  const ages = [...ageDays.entries()];
  return `<section class="life-timeline" aria-label="Winnie's life in memories"><div class="life-browse"><label><span class="sr-only">Jump to an age</span><select id="life-jump"><option value="">Jump to an age</option>${ages.map(([n, day]) => `<option value="${day}">${age(n)}</option>`).join("")}</select></label><button class="text-button" id="life-latest">Latest</button><details class="timeline-tools"><summary>More</summary><div><button class="text-button" id="life-yearbook">Make an album</button><button class="text-button" id="life-postcard">Make a postcard</button><button class="text-button" data-history="lifetime">Milestones & dates</button></div></details></div>
    <button class="secondary life-earlier" id="life-earlier" ${start === 0 ? "hidden" : ""}>Earlier memories</button>
    <div id="life-stream">${entriesHTML()}</div><div class="life-continue"><button class="secondary" id="life-continue" ${end >= rows.length ? "hidden" : ""}>Keep going</button><p id="life-end" class="fine" ${end < rows.length ? "hidden" : ""}>${rows.some((g) => g.photos.length) ? "You’re all caught up." : "His photos belong here."}</p><button class="text-button" data-add-photos>Add more photos</button></div></section>`;
}
function repaint(anchorDay) {
  const anchor = anchorDay && document.getElementById("life-day-" + anchorDay),
    before = anchor?.getBoundingClientRect().top;
  changed();
  if (before !== undefined) {
    const after = document.getElementById("life-day-" + anchorDay);
    if (after) window.scrollBy(0, after.getBoundingClientRect().top - before);
  }
  hydratePhotos();
}
export function bindLifeTimeline() {
  observer?.disconnect();
  if (!$("life-stream")) return;
  $("life-continue").onclick = () => {
    const anchor = rows[Math.min(end, rows.length) - 1]?.day;
    end += BATCH;
    repaint(anchor);
  };
  $("life-earlier").onclick = () => {
    const anchor = rows[start]?.day;
    start = Math.max(0, start - BATCH);
    repaint(anchor);
  };
  const jump = (day) => {
    const i = rows.findIndex((g) => g.day === day);
    if (i < 0) return;
    if (i < start || i >= end) {
      start = i;
      end = i + BATCH;
      repaint();
    }
    const el = document.getElementById("life-day-" + day);
    el?.scrollIntoView({ block: "start", behavior: "instant" });
    if (el) {
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
    }
  };
  $("life-jump").onchange = (e) => jump(e.target.value);
  $("life-latest").onclick = () => jump(rows.at(-1)?.day);
  $("life-postcard").onclick = () => {
    const el=document.querySelector(".postcard-tool");
    el.open=true; el.scrollIntoView({block:"start",behavior:"instant"}); el.querySelector("summary").focus({preventScroll:true});
  };
  $("life-yearbook").onclick = () => {
    const el = $("life-yearbook-tool");
    el.open = true;
    el.scrollIntoView({ block: "start", behavior: "instant" });
    el.querySelector("summary").focus({ preventScroll: true });
  };
  document.querySelectorAll("[data-life-photos]").forEach(
    (b) =>
      (b.onclick = () => {
        const day = b.dataset.lifePhotos;
        expanded.set(day, (expanded.get(day) || 3) + 12);
        repaint(day);
      }),
  );
  // Continue only after real scrolling, so a short/empty timeline never fans out requests.
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          window.scrollY > 200 &&
          state.tab === "photos" &&
          state.filter === "memories" &&
          !$("dialog").open &&
          end < rows.length
        ) {
          observer.disconnect();
          $("life-continue")?.click();
        }
      },
      { rootMargin: "0px 0px 160px 0px" },
    );
    if (end < rows.length) observer.observe($("life-continue"));
  }
}
document.addEventListener("winnie:surface-change", () =>
  observer?.disconnect(),
);
