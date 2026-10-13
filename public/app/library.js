// History, Trends, and Photos: search, filters, counters, charts, evidence.
import { placeLabel } from "../places.js?v=3.10";
import { elapsed } from "../care-state.js?v=3.10";
import { icon } from "../icons.js?v=4.0";
import {
  rhythmInsights,
  clockMinute,
  durationLabel,
  localParts,
} from "../insights.js?v=3.10";
import { insightsView } from "../insight-view.js?v=3.10";
import { photoCaption } from "../everyday.js?v=3.10";
import { html, openDialog } from "./ui.js?v=4.2";
import { $, TYPES, dateLabel, dayKey, esc, person } from "./format.js?v=4.2";
import { facts, places } from "./services.js?v=4.2";
import { entry, eventLabel, hydratePhotos } from "./entries.js?v=4.2";
import { editForm } from "./forms.js?v=4.2";
import { state } from "./state.js?v=4.2";

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
  $("story-tools").hidden = ["patterns", "places"].includes(state.filter);
  $("places-view").hidden = state.filter !== "places";
  $("story-items").hidden = state.filter === "places";
  $("story-count").hidden = state.filter === "places";
  if (state.filter === "places") {
    $("load-more").hidden = true;
    places.render(facts());
    return;
  }
  $("album-label").hidden = state.filter !== "moments";
  document.querySelector(".history-filters label:first-child").hidden =
    state.filter === "moments";
  if (state.filter === "patterns") {
    renderPatterns();
    return;
  }
  let events = facts();
  const album = $("photo-album").value,
    query = $("story-search").value.toLowerCase().trim();
  if (state.filter === "moments")
    events = events.filter(
      (e) =>
        (e.type === "moment" || e.photos?.length) &&
        (album === "all" || (e.type === album && e.photos?.length)),
    );
  if (query)
    events = events.filter((e) =>
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
        .includes(query),
    );
  if (state.filter === "care" && $("history-type").value)
    events = events.filter((e) => e.type === $("history-type").value);
  if ($("history-from").value)
    events = events.filter((e) => dayKey(e.time) >= $("history-from").value);
  if ($("history-to").value)
    events = events.filter((e) => dayKey(e.time) <= $("history-to").value);
  const count = events.length,
    photos = events.reduce((n, e) => n + (e.photos?.length || 0), 0);
  $("story-count").textContent =
    state.filter === "care"
      ? count.toLocaleString() + " " + (count === 1 ? "entry" : "entries")
      : photos + " " + (photos === 1 ? "photo" : "photos");
  $("load-more").hidden = count <= state.limit;
  if (!count) {
    html(
      "story-items",
      `<div class="empty"><h3>${query || $("history-from").value || $("history-to").value ? "No matches." : state.filter === "care" ? "Nothing logged yet." : "No photos yet."}</h3>${query || $("history-from").value || $("history-to").value ? "<p>Try another search or date range.</p>" : state.filter === "moments" ? '<button class="px btn ink" data-act="moment">Add photo</button>' : ""}</div>`,
    );
    return;
  }
  if (state.filter === "care")
    html(
      "story-items",
      events
        .slice(0, state.limit)
        .map(
          (e, i, a) =>
            `${i === 0 || dayKey(e.time) !== dayKey(a[i - 1].time) ? '<p class="eyebrow history-day">' + dateLabel(e.time) + "</p>" : ""}${entry(e)}`,
        )
        .join(""),
    );
  else
    html(
      "story-items",
      `<div class="photo-grid">${events
        .slice(0, state.limit)
        .flatMap((e) =>
          (e.photos?.length ? e.photos : [null]).map(
            (p) =>
              `<button class="memory-card" data-open="${esc(e.id)}">${p ? `<img data-photo="${esc(p.id)}" alt="${esc(photoCaption(e))}" loading="lazy">` : '<div class="empty big">♡</div>'}<div><strong>${esc(photoCaption(e))}</strong><small>${dateLabel(e.time)}${e.loggedBy ? " · " + person(e.loggedBy) : ""}${e.pending ? " · Pending" : ""}</small></div></button>`,
          ),
        )
        .join("")}</div>`,
    );
  hydratePhotos();
}
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
document.querySelectorAll("[data-filter]").forEach(
  (button) =>
    (button.onclick = () => {
      state.filter = button.dataset.filter;
      storySection = state.filter;
      state.limit = 60;
      $("history-type").value = "";
      document
        .querySelectorAll("[data-filter]")
        .forEach((b) => b.classList.toggle("selected", b === button));
      renderStory();
    }),
);
$("story-add").onclick = () => editForm("moment");
export function renderPatterns() {
  insightData = rhythmInsights(facts(), patternDays);
  $("story-count").textContent = "";
  $("load-more").hidden = true;
  html(
    "story-items",
    countsHTML(facts()) + insightsView(insightData, state.insightTopic),
  );
  $("pattern-window").onchange = (e) => {
    patternDays = Number(e.target.value);
    renderPatterns();
    $("pattern-window").focus();
  };
}
function countsHTML(events) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    return dayKey(d.getTime());
  });
  const rows = days.map((k) => {
    const day = events.filter((e) => dayKey(e.time) === k);
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
  return `<section class="rhythm-answer"><h3>Pee and poop, last 14 days</h3><div class="counts" role="img" aria-label="${rows.map(([k, p, q]) => `${short(k)}: ${p} pee, ${q} poop`).join("; ")}">${rows.map(([, p, q]) => `<span class="day">${p ? `<span class="seg-pee" style="height:${(p / max) * 100}%"></span>` : ""}${q ? `<span class="seg-poop" style="height:${(q / max) * 100}%"></span>` : ""}</span>`).join("")}</div><div class="rhythm-axis"><span>${short(days[0])}</span><span>Today</span></div><div class="legend"><span><i style="background:var(--pee)"></i>Pee</span><span><i style="background:var(--poop)"></i>Poop</span><span>On days with logs: ${avg(1)} pee, ${avg(2)} poop</span></div></section>`;
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
