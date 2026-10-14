import { renderLifetime, changesHTML, bindChanges } from './lifetime-view.js?v=4.22';
import { selectedPhotos, recordDay } from '../lifetime.js?v=4.22';
import { isCarePhoto, winniePhotos } from "../keepsakes.js?v=4.22";
import { renderMemories } from "./memories-view.js?v=4.22";
import { foodPoopStats } from "../pantry.js?v=4.22";
// History, Trends, and Photos: search, filters, counters, charts, evidence.
import { placeLabel } from "../places.js?v=4.22";
import { elapsed } from "../care-state.js?v=4.22";
import { icon } from "../icons.js?v=4.0";
import {
  rhythmInsights,
  clockMinute,
  durationLabel,
  localParts,
} from "../insights.js?v=4.22";
import { insightsView } from "../insight-view.js?v=4.22";
import { photoCaption } from "../everyday.js?v=4.22";
import { html, openDialog } from "./ui.js?v=4.22";
import { $, TYPES, dateLabel, dayKey, esc, person } from "./format.js?v=4.22";
import { facts, places } from "./services.js?v=4.22";
import { entry, eventLabel, hydratePhotos } from "./entries.js?v=4.22";
import { addPhotos } from "./photos.js?v=4.22";
import { state } from "./state.js?v=4.22";
import { renderCalendarHistory } from './calendar-view.js?v=4.22';

let patternDays = 28,
  insightData = null,
  evidenceLimit = 30;
export function renderLastTimes(events) {
  const now = Date.now(),
    title = (t) => (e) =>
      e.type === "grooming" &&
      (e.careTitle || "").toLowerCase() === t.toLowerCase();
  const items = [
    ["Bath", title("Bath"), "bath", "groom"],
    ["Nails", title("Nails"), "nails", "groom"],
    ["Brush", title("Brush"), "brush", "groom"],
    ["Vet", (e) => e.type === "appointment", "vet", "care"],
    ["Meds", (e) => e.type === "medication", "pill", "care"],
    ["Training", (e) => e.type === "enrichment", "star", "care"],
  ];
  html(
    "last-times",
    items
      .map(([label, pred, ic, col]) => {
        const e = events.find((x) => x.time <= now && pred(x));
        return e
          ? `<button class="last" data-open="${esc(e.id)}" aria-label="Last ${label.toLowerCase()} ${elapsed(e.time)}"><span class="sq" style="--c:var(--${col})">${icon(ic, "ic sm")}</span><b>${label}</b><small>${elapsed(e.time)}</small></button>`
          : "";
      })
      .join(""),
  );
}
export function renderStory() {
  const isPhotos = state.tab === "photos";
  if (isPhotos) return renderGallery();
  const lifetime = state.filter === "lifetime";
  const patterns = state.filter === "patterns" || lifetime || state.filter === 'calendar';
  $("story-tools").hidden = patterns;
  $("last-care").hidden = patterns || !$("last-times").children.length;
  $("history-clear").hidden =
    patterns ||
    !["story-search", "history-type", "history-from", "history-to"].some(
      (id) => $(id).value,
    );
  $("story-count").hidden = patterns;
  $("story-count").parentElement.hidden = patterns;
  if (state.filter === 'calendar') return renderCalendarHistory();
  if (lifetime) return renderLifetime();
  if (patterns) return renderPatterns();
  const query = $("story-search").value.toLowerCase().trim();
  let events = facts().filter((e) => matches(e, query));
  if ($("history-type").value)
    events = events.filter((e) => e.type === $("history-type").value);
  if ($("history-from").value)
    events = events.filter((e) => recordDay(e) >= $("history-from").value);
  if ($("history-to").value)
    events = events.filter((e) => recordDay(e) <= $("history-to").value);
  const count = events.length;
  $("story-count").textContent =
    count.toLocaleString() + (count === 1 ? " entry" : " entries");
  $("load-more").hidden = count <= state.limit;
  html(
    "story-items",
    count
      ? events
          .slice(0, state.limit)
          .map(
            (e, i, a) =>
              `${i === 0 || recordDay(e) !== recordDay(a[i - 1]) ? '<h2 class="history-day">' + dateLabel(new Date(recordDay(e)+"T12:00").getTime()) + "</h2>" : ""}${entry(e, { photoRecord: e.type === "moment" })}`,
          )
          .join("")
      : '<div class="empty"><h3>' +
          ($("history-clear").hidden
            ? "Nothing logged yet"
            : "No matching entries") +
          "</h3></div>",
  );
  hydratePhotos();
}
function matches(e, query) {
  return (
    !query ||
    [
      e.note,
      eventLabel(e),
      placeLabel(e),
      (e.tags || []).join(" "),
      (e.foods || []).join(" "),
      person(e.loggedBy),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query)
  );
}
function renderGallery() {
  const care = state.filter === "care-photos",
    gallery = state.filter === "moments" || care,
    map = state.filter === "places";
  $("photos-view").classList.toggle("is-places", map);
  $("photo-kinds").hidden = !gallery;
  $("photos-library").hidden = map;
  $("photo-tools").hidden = !gallery;
  $("album-label").hidden = !care;
  $("photo-tools").classList.toggle("care-tools", care);
  $("photo-clear").hidden =
    !gallery ||
    (!$("photo-search").value && (!care || $("photo-album").value === "all"));
  $("photo-count").hidden = !gallery;
  $("photo-count").parentElement.hidden = !gallery;
  $("photo-items").hidden = map;
  $("places-view").hidden = !map;
  $("photo-more").hidden = true;
  if (map) {
    places.render(facts());
    return;
  }
  if (!gallery) {
    renderMemories();
    return;
  }
  const album = $("photo-album").value,
    query = $("photo-search").value.toLowerCase().trim();
  const events = facts().filter(
    (e) =>
      e.photos?.length &&
      matches(e, query) &&
      (care
        ? isCarePhoto(e) &&
          (album === "all" || e.type === album)
        : winniePhotos(e).length > 0),
  );
  const photos = care ? events.flatMap(e => e.photos.map(p => ({e,p}))) : selectedPhotos(events).map(({event:e,photo:p,day,location}) => ({e:{...e,time:new Date(day+"T12:00").getTime(),location,photoDay:day},p}));
  $("photo-count").textContent =
    photos.length + (photos.length === 1 ? " photo" : " photos");
  $("photo-more").hidden =
    (care ? events.length : photos.length) <= state.limit;
  const month = new Intl.DateTimeFormat([], {
    month: "long",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
  html(
    "photo-items",
    photos.length
      ? care
        ? events
            .slice(0, state.limit)
            .map(
              (e, i, a) =>
                `${i === 0 || recordDay(e) !== dayKey(a[i - 1].time) ? '<h2 class="history-day">' + dateLabel(e.time) + "</h2>" : ""}${entry(e, { photoRecord: true, fullPhoto: true })}`,
            )
            .join("")
        : '<div class="photo-grid">' +
          photos
            .slice(0, state.limit)
            .map(
              ({ e, p }, i, a) =>
                `${i === 0 || month.format(e.time) !== month.format(a[i - 1].e.time) ? '<h2 class="photo-month">' + month.format(e.time) + "</h2>" : ""}<button class="memory-card" data-open="${esc(e.id)}" aria-label="${esc(photoCaption(e))}, ${dateLabel(e.time)}"><img data-photo="${esc(p.id)}" alt="${esc(photoCaption(e))}" loading="lazy"><span class="photo-caption">${e.note ? `<strong>${esc(e.note)}</strong>` : ""}<small>${dateLabel(e.time)}</small>${e.pending ? '<span class="pending-dot">Not sent</span>' : ""}</span></button>`,
            )
            .join("") +
          "</div>"
      : `<div class="album-empty">${icon(care ? "poop" : "photo", "ic")}<h3>${query || (care && album !== "all") ? "No matching photos" : care ? "No care photos yet" : "Add a photo of Winnie"}</h3><p>${query || (care && album !== "all") ? "Try another search or clear the filters." : care ? "" : "No keepsakes yet."}</p><button class="px btn ink" data-add-photos>${care ? "Attach to entry" : "Choose photos"}</button></div>`,
  );
  hydratePhotos();
}
$("history-clear").onclick = () => {
  for (const id of [
    "story-search",
    "history-type",
    "history-from",
    "history-to",
  ])
    $(id).value = "";
  for (const id of ["history-from", "history-to"])
    $(id).dispatchEvent(new Event("change"));
  state.limit = 60;
  renderStory();
};
$("photo-search").oninput = () => {
  state.limit = 60;
  renderStory();
};
$("photo-more").onclick = () => {
  state.limit += 60;
  renderStory();
};
for (const [type, [, label]] of Object.entries(TYPES))
  $("history-type").insertAdjacentHTML(
    "beforeend",
    `<option value="${type}">${label}</option>`,
  );
for (const id of ["history-from", "history-to"])
  $(id).addEventListener("change", () => {
    const v = $(id).value,
      label = id === "history-from" ? "From" : "To";
    document.querySelector(`[data-date-text="${id}"]`).textContent = v
      ? `${label}: ${new Date(v + "T12:00").toLocaleDateString([], { month: "short", day: "numeric" })}`
      : `${label}: any day`;
  });
for (const id of ["story-search", "history-type", "history-from", "history-to"])
  $(id).addEventListener(id === "story-search" ? "input" : "change", () => {
    state.limit = 60;
    renderStory();
  });
$("photo-album").onchange = () => {
  state.limit = 60;
  renderStory();
};
$("load-more").onclick = () => {
  state.limit += 60;
  renderStory();
};
$("story-add").onclick = () => addPhotos(state.filter === "care-photos");
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-add-photos]"))
    addPhotos(state.filter === "care-photos");
});
$("photo-clear").onclick = () => {
  $("photo-search").value = "";
  $("photo-album").value = "all";
  state.limit = 60;
  renderStory();
};
export function renderPatterns() {
  insightData = rhythmInsights(facts(), patternDays);
  $("story-count").textContent = "";
  $("load-more").hidden = true;
  html(
    "story-items",
    changesHTML(facts()) + insightsView(insightData, state.insightTopic, countsHTML(facts()) +
      (state.insightTopic === "poop" ? foodPoopHTML(facts()) : "")),
  );
  bindChanges();
  $("pattern-window").onchange = (e) => {
    patternDays = Number(e.target.value);
    renderPatterns();
    $("pattern-window").focus();
  };
}
function foodPoopHTML(events) {
  const start = new Date();
  start.setDate(start.getDate() - patternDays + 1);
  const rows = foodPoopStats(
    events.filter(
      (e) => e.time <= Date.now() && dayKey(e.time) >= dayKey(+start),
    ),
  );
  const total = rows.reduce((n, r) => n + r.tagged, 0);
  const body =
    total < 3
      ? `<p class="muted">Not enough tagged poops yet.</p>`
      : rows
          .map((r) => {
            const pct = (n) => ((n / r.tagged) * 100).toFixed(0);
            return `<div class="by-food"><b>${esc(r.food)}</b><span class="q-bar" role="img" aria-label="${esc(r.food)}: ${r.firm} firm, ${r.soft} soft, ${r.loose} loose"><i class="firm" style="width:${pct(r.firm)}%"></i><i class="soft" style="width:${pct(r.soft)}%"></i><i class="loose" style="width:${pct(r.loose)}%"></i></span><span class="muted">${r.soft + r.loose} of ${r.tagged} soft or loose</span></div>`;
          })
          .join("");
  return `<section class="rhythm-answer"><h3>Poop by food</h3><p class="muted">The first poop within a day after each meal.</p>${body}<div class="legend"><span><i class="firm"></i>Firm</span><span><i class="soft"></i>Soft</span><span><i class="loose"></i>Loose</span></div></section>`;
}
function countsHTML(events) {
  const days = Array.from({ length: patternDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - patternDays + 1 + i);
    return dayKey(d.getTime());
  });
  const rows = days.map((k) => {
    const day = events.filter((e) => e.time <= Date.now() && dayKey(e.time) === k);
    return [
      k,
      day.filter((e) => e.type === "pee").length,
      day.filter((e) => e.type === "poop").length,
    ];
  });
  const max = Math.max(1, ...rows.map(([, p, q]) => p + q)),
    logged = rows.filter(([, p, q]) => p + q),
    avg = (n) =>
      logged.length
        ? (logged.reduce((s, r) => s + r[n], 0) / logged.length).toFixed(1)
        : "0";
  const short = (k) =>
    new Date(k + "T12:00").toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  return `<section class="rhythm-answer"><h3>Pee and poop, last ${patternDays} days</h3><div class="counts" role="img" aria-label="${rows.map(([k, p, q]) => `${short(k)}: ${p} pee, ${q} poop`).join("; ")}">${rows.map(([, p, q]) => `<span class="day">${p ? `<span class="seg-pee" style="height:${(p / max) * 100}%"></span>` : ""}${q ? `<span class="seg-poop" style="height:${(q / max) * 100}%"></span>` : ""}</span>`).join("")}</div><div class="rhythm-axis"><span>${short(days[0])}</span><span>Today</span></div><div class="legend"><span><i style="background:var(--pee)"></i>Pee</span><span><i style="background:var(--poop)"></i>Poop</span><span>On days with logs: ${avg(1)} pee, ${avg(2)} poop</span></div></section>`;
}
export function showEvidence(key, more = false) {
  state.evidenceKey = key;
  evidenceLimit = more ? evidenceLimit + 30 : 30;
  const d = insightData,
    p = d.potty[state.insightTopic],
    all = new Map(facts().map((e) => [e.id, e]));
  let title, rows, description;
  if (key === "meals") {
    title = "Meals followed by a poop";
    description =
      d.afterMeals.pairs.length +
      " matched pairs from " +
      d.afterMeals.meals +
      " meals with a full four-hour window.";
    rows = d.afterMeals.pairs.map((p) => ({
      ids: [p.meal, p.poop],
      time: p.time,
      gap: p.minutes,
    }));
  } else if (key === "gaps") {
    title = "Between daytime " + state.insightTopic + " breaks";
    description = "Consecutive entries on the same day, between 6am and 10pm.";
    rows = p.gaps.map((g) => ({
      ids: [g.before, g.after],
      time: g.time,
      gap: g.minutes,
    }));
  } else {
    const n =
      key === "early-nights"
        ? d.oldNight
        : key === "past-nights"
          ? d.pastNight
          : d.night;
    const ids = key === "times" ? p.ids : n.ids;
    title =
      key === "times"
        ? "His recorded " + state.insightTopic + " times"
        : key === "early-nights"
          ? "His earliest recorded nights"
          : key === "past-nights"
            ? "Nights in the previous period"
            : "His recent recorded nights";
    description =
      key === "times"
        ? "The entries behind the time-of-day pattern."
        : "Completed night intervals used in this comparison.";
    rows = ids.map((id) => ({ ids: [id], time: all.get(id)?.time || 0 }));
  }
  rows.sort((a, b) => b.time - a.time);
  const rowHTML = rows
    .slice(0, evidenceLimit)
    .map(
      (row) =>
        '<div class="evidence-row"><p>' +
        new Date(row.time).toLocaleDateString("en-US", {
          timeZone: "America/Los_Angeles",
          month: "short",
          day: "numeric",
          year: "numeric",
        }) +
        (row.gap != null ? " · " + durationLabel(row.gap) + " apart" : "") +
        "</p><div>" +
        row.ids
          .map((id) => {
            const e = all.get(id);
            if (!e) return "";
            return (
              '<button class="evidence-entry" data-open="' +
              esc(id) +
              '"><span>' +
              esc(TYPES[e.type]?.[1] || e.type) +
              "</span><strong>" +
              clockMinute(localParts(e.time).minute) +
              (e.end_time
                ? " → " + clockMinute(localParts(e.end_time).minute)
                : "") +
              '</strong><span aria-hidden="true">↗</span></button>'
            );
          })
          .join("") +
        "</div></div>",
    )
    .join("");
  openDialog(
    '<h2 id="dialog-title">' +
      title +
      '</h2><p class="fine">' +
      description +
      ' Times are in San Francisco.</p><div class="evidence-list">' +
      rowHTML +
      "</div>" +
      (rows.length > evidenceLimit
        ? '<button class="secondary small" data-evidence-more>Show more entries</button>'
        : "") +
      '<p class="fine">Showing ' +
      Math.min(evidenceLimit, rows.length) +
      " of " +
      rows.length +
      ".</p>",
  );
}
