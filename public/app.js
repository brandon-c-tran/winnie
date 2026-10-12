import { createCare } from "./care-view.js?v=3.10";
import { careStates, careDay } from "./care-plans.js?v=3.10";
import { fridgeState, onFridge } from "./fridge-model.js?v=3.10";
import {
  eventPosition,
  placeName,
  placeLabel,
  loadCities,
} from "./places.js?v=3.10";
import { createPlacesView } from "./places-view.js?v=3.10";
import { createFridge } from "./fridge.js?v=3.10";
import { createAutoPlace } from "./auto-place.js?v=3.10";
import {
  latestCare,
  elapsed,
  validPin,
  mapURL,
  canCaptureHere,
  capturePlace,
} from "./care-state.js?v=3.10";
import { protectAppSelection } from "./selection.js?v=3.10";
import { createRoom, sfEpoch } from "./room.js?v=4.0";
import { icon, TYPES as TYPE_META, GROOMING, typeIcon, typeColor } from "./icons.js?v=4.0";
import { getTimes } from "./vendor/suncalc.js";
import {
  rhythmInsights,
  clockMinute,
  durationLabel,
  localParts,
} from "./insights.js?v=3.10";
import { insightsView } from "./insight-view.js?v=3.10";
import {
  sleepContext,
  foodChoices,
  normalizeFood,
  photoCaption,
  validateTrainerImport,
} from "./everyday.js?v=3.10";
import { WinnieSync } from "./sync.js?v=3.10";
if (["localhost", "127.0.0.1"].includes(location.hostname))
  document.querySelectorAll('img[src^="/.netlify/images"]').forEach((img) => {
    img.src = new URL(img.src).searchParams.get("url");
  });
const $ = (id) => document.getElementById(id),
  sync = new WinnieSync();
const TYPES = TYPE_META;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const person = (id) => ({ brandon: "Brandon", kim: "Kim" })[id] || "";
const by = (id) => (person(id) ? " · " + person(id) : "");
const dayKey = (time) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateTime = (time) =>
  `${dayKey(time)}T${new Date(time).toTimeString().slice(0, 5)}`;
const clock = (time) =>
  new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dateLabel = (time) =>
  new Date(time).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const when = (time) => {
  const age = Date.now() - time;
  if (age < 0) return clock(time);
  if (age < 60000) return "just now";
  if (age < 3600000) return `${Math.floor(age / 60000)}m ago`;
  if (dayKey(time) === dayKey(Date.now())) return clock(time);
  return new Date(time).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
};
const active = (e) => !e.deletedAt && e.end_time == null;
const uid = () => crypto.randomUUID();
let patternDays = 28,
  insightTopic = "poop",
  insightData = null,
  evidenceKey = null,
  evidenceLimit = 30;
const places = createPlacesView({
  root: $("places-view"),
  esc,
  entry,
  hydratePhotos,
});
const care = createCare({
  root: $("care-upcoming"),
  sync,
  esc,
  person,
  openDialog,
  closeDialog,
  toast,
  safe,
  detail,
  contextHTML: () => {
    const visits = (sync.view().profile.trainerSchedule?.visits || [])
      .filter((v) => v.end >= Date.now() - 86400000)
      .sort((a, b) => a.start - b.start)
      .slice(0, 3);
    const recent = facts()
      .filter((e) =>
        ["medication", "appointment", "enrichment", "covered_gap"].includes(
          e.type,
        ),
      )
      .sort((a, b) => b.time - a.time)
      .slice(0, 3);
    return `<section class="care-overview-section"><div class="section-heading"><h3>Trainer visits</h3><button class="text-button" data-act="trainer-schedule">Schedule</button></div>${visits.map((v) => visitRow(v)).join("") || '<p class="fine">No visits coming up. Import them from Schedule.</p>'}</section><section class="care-overview-section"><div class="section-heading"><h3>Recent care</h3><button class="text-button" data-care-nav="care">History</button></div>${recent.map((e) => entry(e)).join("") || '<p class="fine">Grooming, medication, training, and appointments show up here.</p>'}<button class="px btn" data-act="more">Log care</button></section>`;
  },
  celebrate: () => room.react("done"),
  attachLocation: (id) => {
    void autoPlace.attach(id);
  },
});
const fridge = createFridge({
  careDueHTML: care.fridgeHTML,
  root: $("fridge-board"),
  nextRoot: $("up-next"),
  sync,
  esc,
  person,
  openDialog,
  closeDialog,
  toast,
  hydratePhotos,
  editCompletedCare: (type) => {
    editForm(type, null, {
      end_time: Date.now(),
      ...(type === "covered_gap" ? { who: "trainer" } : {}),
    });
    document.querySelector("#event-form [name=time]").value = "";
  },
  log,
  safe,
});
const autoPlaceEnabled = () =>
  localStorage.getItem("winnie:auto-place") !== "off";
const autoPlace = createAutoPlace({
  getEvent: (id) => sync.view().events.find((e) => e.id === id),
  save: (id, placePin, revision) =>
    sync.enqueue("edit", id, { placePin }, revision),
  enabled: autoPlaceEnabled,
  report: (id, message) => {
    const status = $("auto-place-status");
    if (status?.dataset.event === id) status.textContent = message;
  },
});
let tab = "today",
  filter = "moments",
  limit = 60,
  quickPhotoId = null,
  photoTarget = null,
  lastUndo = null,
  actionLock = 0,
  lastLogType = null,
  formPhotos = [],
  formType = null,
  detailId = null,
  dialogReturn = null;
const photoURLs = new Map(),
  photoLoading = new Set();
let toastTimer;
let mealSubmitting = false;
$("day-picker").value = dayKey(Date.now());
protectAppSelection();
function toast(message, undo = null, actions = []) {
  $("toast-text").textContent = message.replace(" · ", "\n");
  $("toast-text").style.whiteSpace = "pre-line";
  $("toast").hidden = false;
  $("undo").hidden = !undo;
  lastUndo = undo;
  const box = $("toast-actions");
  box.replaceChildren(
    ...actions.map(([label, fn]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = () => {
        $("toast").hidden = true;
        lastUndo = null;
        safe(fn)();
      };
      return b;
    }),
  );
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => {
      $("toast").hidden = true;
      lastUndo = null;
    },
    undo || actions.length ? 8000 : 5000,
  );
}
function error(err) {
  const box = $("form-error");
  if ($("dialog").open && box) box.textContent = err.message;
  else toast(err.message);
}
function safe(fn) {
  return (...args) => {
    try {
      return Promise.resolve(fn(...args)).catch(error);
    } catch (err) {
      error(err);
    }
  };
}
function openDialog(html) {
  if (!$("dialog").open) dialogReturn = document.activeElement;
  $("dialog-content").innerHTML = html;
  detailId = null;
  if (!$("dialog").open) $("dialog").showModal();
}
function closeDialog() {
  $("dialog").close();
  detailId = null;
  quickPhotoId = null;
  formPhotos = [];
  formType = null;
  dialogReturn?.focus?.();
}
$("dialog-close").onclick = closeDialog;
$("dialog").addEventListener("cancel", () => {
  detailId = null;
  formPhotos = [];
  formType = null;
});
$("toast-close").onclick = () => {
  $("toast").hidden = true;
};
$("undo").onclick = safe(async () => {
  const undo = lastUndo;
  if (!undo) return;
  lastUndo = null;
  $("undo").disabled = true;
  try {
    await undo();
    toast("Undone");
  } finally {
    $("undo").disabled = false;
  }
});
let historySection = "care",
  photosSection = "moments";
const libraryFilters = { history: {}, photos: {} };
const libraryFields = [
  "story-search",
  "history-type",
  "history-from",
  "history-to",
];
const TAB_IDS = ["today", "plans", "history", "photos"];
document
  .querySelectorAll(".tab-ic, [data-icon]")
  .forEach((s) => (s.innerHTML = icon(s.dataset.icon)));
function setTab(next) {
  if (tab !== next) {
    if (libraryFilters[tab])
      for (const id of libraryFields) libraryFilters[tab][id] = $(id).value;
    if (libraryFilters[next])
      for (const id of libraryFields)
        $(id).value = libraryFilters[next][id] || "";
    limit = 60;
  }
  tab = next;
  for (const t of TAB_IDS) {
    $(`${t}-view`).hidden = t !== tab;
    if (t === tab) $(`${t}-tab`).setAttribute("aria-current", "page");
    else $(`${t}-tab`).removeAttribute("aria-current");
  }
  if (tab === "history") filter = historySection;
  if (tab === "photos") filter = photosSection;
  // One search/filter/list library, moved into whichever tab shows it.
  const library = $(tab === "history" ? "history-library" : "photos-library");
  for (const id of ["story-tools", "story-count", "story-items", "load-more"])
    library.append($(id));
  document
    .querySelectorAll("[data-history]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.history === historySection)),
    );
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.filter === photosSection)),
    );
  window.scrollTo(0, 0);
  render();
}
document
  .querySelectorAll("[data-tab]")
  .forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
document.querySelectorAll("[data-history]").forEach(
  (b) =>
    (b.onclick = () => {
      historySection = b.dataset.history;
      $("history-type").value = "";
      setTab("history");
    }),
);
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-care-nav]");
  if (!b) return;
  if (b.dataset.careNav === "upcoming") setTab("plans");
  else {
    historySection = b.dataset.careNav === "patterns" ? "patterns" : "care";
    setTab("history");
  }
});
$("day-picker").onchange = render;
const shiftDay = (n) => {
  const d = new Date(($("day-picker").value || dayKey(Date.now())) + "T12:00");
  d.setDate(d.getDate() + n);
  const key = dayKey(d.getTime());
  if (key > dayKey(Date.now())) return;
  $("day-picker").value = key;
  render();
};
$("day-prev").onclick = () => shiftDay(-1);
$("day-next").onclick = () => shiftDay(1);
const renderedHTML = new Map();
function html(id, value) {
  if (renderedHTML.get(id) !== value) {
    $(id).innerHTML = value;
    renderedHTML.set(id, value);
  }
}
function facts() {
  return sync
    .view()
    .events.filter((e) => !e.deletedAt)
    .sort((a, b) => b.time - a.time);
}

// ---------- the room ----------
const roomSprite = new Image();
roomSprite.src = "/photos/winnie-room-v1.png";
const room = createRoom($("room"), {
  sprite: roomSprite,
  onObject: (what) => safe(roomObject)(what),
});
let roomReady = false,
  wallKey = null;
function roomObject(what) {
  const events = facts();
  if (what === "winnie") return room.react("pat");
  if (what === "fridge") return fridge.edit();
  if (what === "calendar") return setTab("plans");
  if (what === "photo") return fridge.photoPicker();
  if (what === "bowl") return log("meal");
  if (what === "bed") return log("sleep");
  if (what === "door")
    return events.some((e) => e.type === "walk" && active(e))
      ? finishWalk()
      : log("walk");
  if (what === "window") {
    const t = getTimes(new Date(), 37.7749, -122.4194);
    toast(
      `Sunrise ${clock(+t.sunrise)}, sunset ${clock(+t.sunset)}. Sleep logs as a nap between them and as night sleep outside them.`,
    );
  }
}
function updateWall(profile) {
  const p = fridgeState(profile).photo,
    key = p ? p.photoId : "default";
  if (key === wallKey) return;
  wallKey = key;
  const img = new Image();
  img.onload = () => room.setPhoto(img);
  if (p)
    sync
      .photo(p.photoId)
      .then((blob) => (img.src = URL.createObjectURL(blob)))
      .catch(() => (img.src = "/photos/winnie-smile.png"));
  else img.src = "/photos/winnie-smile.png";
}
const dueToday = (view) =>
  careStates(view.profile, view.events).some(
    (s) => !s.paused && s.due && s.due <= careDay(),
  );

// ---------- partner catch-up ----------
let seenIds = null;
function rememberSeen(events) {
  const t = Math.max(0, ...events.map((e) => e.created || 0));
  try {
    if (t) localStorage.setItem("winnie:seen", String(t));
  } catch {}
}
function greetPartner(events) {
  const me = sync.session.person;
  let fresh;
  if (!seenIds) {
    let since = 0;
    try {
      since = Number(localStorage.getItem("winnie:seen")) || 0;
    } catch {}
    seenIds = new Set(events.map((e) => e.id));
    fresh = since
      ? events.filter((e) => (e.created || 0) > since && e.time <= Date.now())
      : [];
  } else {
    fresh = events.filter((e) => !seenIds.has(e.id));
    fresh.forEach((e) => seenIds.add(e.id));
  }
  rememberSeen(events);
  const theirs = fresh.filter((e) => e.loggedBy && e.loggedBy !== me);
  if (!theirs.length) return;
  const newest = theirs[0];
  room.react(newest.type === "meal" ? "partnerMeal" : "partner");
  if (lastUndo) return;
  const list = theirs
    .slice(0, 3)
    .map((e) => `${eventLabel(e).toLowerCase()} ${clock(e.time)}`)
    .join(", ");
  toast(
    `${person(newest.loggedBy) || "Someone"} logged ${list}${theirs.length > 3 ? ` and ${theirs.length - 3} more` : ""}`,
    null,
    [["View", () => detail(newest.id)]],
  );
}

// ---------- render ----------
let insightCache = { key: "", data: null };
function poopHint(events) {
  const key = events.length + ":" + (events[0]?.id || "");
  if (insightCache.key !== key)
    insightCache = { key, data: rhythmInsights(events, 28) };
  const a = insightCache.data?.afterMeals,
    now = Date.now(),
    meal = events.find((e) => e.type === "meal" && e.time <= now),
    poop = events.find((e) => e.type === "poop" && e.time <= now);
  if (
    !a?.enough ||
    !a.representative ||
    !meal ||
    (poop && poop.time > meal.time) ||
    now - meal.time > 6 * 3600000
  )
    return "";
  return `<span class="hint">After meals, often ${durationLabel(a.low)} to ${durationLabel(a.high)} later</span>`;
}
function render() {
  const paired = !!sync.session;
  $("connect").hidden = paired;
  $("experience").hidden = !paired;
  $("tabbar").hidden = !paired;
  if (!paired) return;
  const view = sync.view(),
    events = facts(),
    pending = sync.data.queue.length,
    errors = sync.data.queue.filter((q) => q.error),
    oldCount = legacyDiff().length;
  const me = person(sync.session.person);
  $("person-name").textContent = me[0];
  $("settings").setAttribute("aria-label", `Settings. This phone is ${me}'s`);
  const s = sync.lastError
    ? "offline"
    : errors.length
      ? "review"
      : pending
        ? "pending"
        : "ok";
  $("sync-chip").dataset.s = s;
  $("sync-status").textContent =
    s === "offline"
      ? "Offline"
      : s === "review"
        ? `${errors.length} to review`
        : s === "pending"
          ? sync.busy
            ? "Sending"
            : `${pending} not sent`
          : sync.lastChecked
            ? "Up to date"
            : "Opening";
  $("pending-banner").hidden = !oldCount;
  if (oldCount)
    $("pending-banner").innerHTML =
      `${oldCount} older ${oldCount === 1 ? "entry" : "entries"} from this phone to review. <button data-act="review">Review</button>`;
  $("hud-time").textContent = clock(Date.now());
  const now = Date.now(),
    sleeping = events.find(
      (e) => ["nap", "slumber"].includes(e.type) && active(e) && e.time <= now,
    ),
    walk = events.find((e) => e.type === "walk" && active(e) && e.time <= now);
  if (tab === "today") renderToday(events, sleeping, walk);
  updateWall(view.profile);
  room.set(
    {
      epoch: now,
      sleep: sleeping?.type || null,
      walk: !!walk,
      notes: fridgeState(view.profile).notes.filter((n) => onFridge(n)).length,
      pending,
      error: errors.length > 0,
      due: dueToday(view),
    },
    { instant: !roomReady },
  );
  roomReady = true;
  greetPartner(events);
  hydratePhotos();
  if (tab === "plans") care.render();
  if (tab === "history") {
    renderLastTimes(events);
    renderStory();
  }
  if (tab === "photos") renderStory();
}
function renderToday(events, sleeping, walk) {
  const now = Date.now(),
    last = events.find(
      (e) => e.time <= now && !["nap", "slumber", "walk"].includes(e.type),
    );
  const run = walk || sleeping;
  // Something running: the status line says so and finishing it is one tap.
  $("room-status").classList.toggle("running", !!run);
  $("room-status").innerHTML = run
    ? `<span class="sq run-ic" style="--c:${typeColor(run.type)}" aria-hidden="true">${icon(typeIcon(run.type), "ic sm")}</span><span class="grow"><b>${run.type === "walk" ? "Out on a walk" : run.type === "nap" ? "Napping" : "Asleep for the night"}</b> <span>${durationLabel(Math.max(1, Math.round((now - run.time) / 60000)))}${esc(by(run.loggedBy))}</span></span><button class="px btn" data-act="${run.type === "walk" ? "finish-walk" : "end-sleep"}">${run.type === "walk" ? "Finish walk" : run.type === "nap" ? "End nap" : "End sleep"}</button>`
    : `<b>Awake</b>${last ? `<span>last log ${when(last.time)}${esc(by(last.loggedBy))}</span>` : ""}`;
  $("room").setAttribute(
    "aria-label",
    run
      ? `${run.type === "walk" ? "Out on a walk" : "Asleep"} since ${clock(run.time)}`
      : "Winnie is awake in his room",
  );
  $("active-bar").hidden = true;
  const latest = latestCare(events);
  const tile = (type) => {
    const l = latest[type],
      t = l?.time,
      today = t && dayKey(t) === dayKey(now),
      tm = !l
        ? "None yet"
        : today
          ? clock(t)
          : new Date(t).toLocaleDateString([], {
              month: "short",
              day: "numeric",
            }),
      meta = l
        ? `${elapsed(t)}${esc(by(l.loggedBy))}${l.pending ? " · not sent" : ""}`
        : "";
    return `<button class="px tile" style="--c:var(--${type})" data-log="${type}" aria-label="Log ${type}. Last ${esc(tm)}"><span class="top">${icon(type)}<span class="nm">${TYPES[type][1]}</span><span class="act">+ Log</span></span><span class="tm">${tm}</span><span class="meta">${meta}</span>${type === "poop" ? poopHint(events) : ""}</button>`;
  };
  html("care-actions", tile("pee") + tile("poop"));
  const meal = latest.meal;
  html(
    "log-row",
    [
      `<button class="px chip" style="--c:var(--meal)" data-log="meal" aria-label="Log meal">${icon("meal")}Meal${meal ? `<small>${dayKey(meal.time) === dayKey(now) ? clock(meal.time) : elapsed(meal.time)}</small><small>${dayKey(meal.time) === dayKey(now) ? elapsed(meal.time) : ""}${meal.loggedBy ? (dayKey(meal.time) === dayKey(now) ? " · " : "") + esc(person(meal.loggedBy)) : ""}</small>` : ""}</button>`,
      `<button class="px chip" style="--c:var(--photo)" data-act="photo">${icon("photo")}Photo</button>`,
      `<button class="px chip" data-act="earlier">${icon("earlier")}Earlier</button>`,
      `<button class="px chip" data-act="more">${icon("more")}More</button>`,
    ].join(""),
  );
  renderAlso(events);
  fridge.render();
  renderDay(events);
}
function renderAlso(events) {
  const key = dayKey(Date.now());
  let dismissed = false;
  try {
    dismissed = localStorage.getItem("winnie:also-done") === key;
  } catch {}
  const show = new Date().getHours() >= 17 && !dismissed;
  $("also-today").hidden = !show;
  if (!show) return;
  const today = events.filter((e) => dayKey(e.time) === key);
  const items = [
    ...GROOMING.slice(0, 3).map(([t, i]) => ["grooming", t, i]),
    ["medication", "Meds", "pill"],
    ["enrichment", "Training", "star"],
  ];
  html(
    "also-today",
    `<div class="card-head"><h2 id="also-title">Also today</h2><button class="text-button small" data-act="also-done">Nothing else</button></div><div class="chips">${items
      .map(([type, t, i]) => {
        const did = today.some(
          (e) =>
            e.type === type &&
            (type !== "grooming" ||
              (e.careTitle || "").toLowerCase() === t.toLowerCase()),
        );
        return `<button class="px" data-also="${type}" data-title="${t}" aria-pressed="${did}">${icon(did ? "check" : i, "ic sm")}${t}</button>`;
      })
      .join(
        "",
      )}</div><p class="fine">One tap logs it for today with an approximate time.</p>`,
  );
}
function renderDay(events) {
  const key = $("day-picker").value || dayKey(Date.now()),
    isToday = key === dayKey(Date.now()),
    mid = new Date(key + "T12:00");
  $("day-title").textContent = isToday
    ? "Today"
    : mid.toLocaleDateString([], { weekday: "long" });
  $("day-label").textContent = mid.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  $("day-next").disabled = isToday;
  $("day-picker-text").textContent = isToday ? "Pick day" : mid.toLocaleDateString([], { month: "short", day: "numeric" });
  const start = new Date(key + "T00:00").getTime(),
    end = start + 86400000,
    now = Date.now(),
    SPAN = ["nap", "slumber", "walk", "outing"];
  const day = events.filter((e) => dayKey(e.time) === key);
  const spans = events.filter(
    (e) =>
      SPAN.includes(e.type) &&
      e.time < end &&
      (e.end_time ?? Math.min(now, end)) > start &&
      !(e.end_time == null && now - e.time > 36 * 3600000),
  );
  const pct = (t) =>
    (Math.max(0, Math.min(1, (t - start) / 86400000)) * 100).toFixed(2);
  let strip = '<div class="lane">';
  for (const e of spans) {
    const stop = e.end_time ?? Math.min(now, end);
    strip += `<span class="span" style="--c:${typeColor(e.type)};left:${pct(e.time)}%;width:${Math.max(0.8, pct(stop) - pct(e.time))}%"></span>`;
  }
  for (const e of day)
    if (!SPAN.includes(e.type))
      strip += `<span class="tick" style="--c:${typeColor(e.type)};left:${pct(e.time)}%"></span>`;
  if (isToday) strip += `<span class="now" style="left:${pct(now)}%"></span>`;
  strip +=
    '</div><div class="hrs" aria-hidden="true"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>';
  html("day-strip", strip);
  const count = (t) => day.filter((e) => e.type === t).length;
  $("day-strip").setAttribute("role", "img");
  $("day-strip").setAttribute(
    "aria-label",
    `${day.length} ${day.length === 1 ? "entry" : "entries"} across the day`,
  );
  $("day-summary").textContent =
    `${count("pee")} pee · ${count("poop")} poop · ${count("meal")} ${count("meal") === 1 ? "meal" : "meals"}`;
  html(
    "timeline",
    day.length
      ? day.map(entry).join("")
      : `<div class="empty"><p>Nothing logged ${isToday ? "yet today" : "this day"}.</p></div>`,
  );
}
function renderLastTimes(events) {
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
let reactionPickerId = null;
const reactionEmojis = ["❤️", "😂", "👏"];
let freshEntry = null,
  longPressed = false,
  pressTimer = 0;
document.addEventListener("pointerdown", (ev) => {
  const b = ev.target.closest("#care-actions [data-log], #log-row [data-log]");
  if (!b) return;
  longPressed = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    longPressed = true;
    earlierSheet({ type: b.dataset.log });
  }, 480);
});
for (const name of ["pointerup", "pointercancel", "pointerleave"])
  document.addEventListener(name, () => clearTimeout(pressTimer));
document.addEventListener("contextmenu", (ev) => {
  if (ev.target.closest("[data-log]")) ev.preventDefault();
});
function syncSheet() {
  const pending = sync.data.queue.length,
    errors = sync.data.queue.filter((q) => q.error).length;
  const [title, msg] = sync.lastError
    ? ["Offline", `This phone can't reach the shared log: ${sync.lastError} New logs keep saving here and send when it's back.`]
    : errors
      ? ["Needs review", `${errors} ${errors === 1 ? "change conflicts" : "changes conflict"} with an edit from the other phone. Pick which version to keep. Nothing is lost until you choose.`]
      : pending
        ? ["Not sent yet", `${pending} ${pending === 1 ? "change is" : "changes are"} saved on this phone and not in the shared log yet.`]
        : ["Up to date", `Everything on this phone is in the shared log. Checked ${sync.lastChecked ? when(sync.lastChecked) : "just now"}.`];
  openDialog(
    `<h2 id="dialog-title">${title}</h2><p>${esc(msg)}</p><div class="button-row"><button class="px btn ink" data-act="sync-now">Check now</button>${errors ? '<button class="px btn" data-act="review">Review changes</button>' : ""}</div>`,
  );
}
function reactions(e) {
  if (e.deletedAt) return "";
  const mine = e.reactions?.[sync.session?.person]?.emoji;
  const groups = reactionEmojis
    .map((emoji) => ({
      emoji,
      people: Object.entries(e.reactions || {})
        .filter(([, r]) => r.emoji === emoji)
        .map(([p]) => person(p)),
    }))
    .filter((g) => g.people.length);
  const expanded = reactionPickerId === e.id;
  const description = groups
    .map((g) => g.emoji + " " + g.people.join(" and "))
    .join(", ");
  return `<div class="entry-reactions" data-reactions-for="${esc(e.id)}"><button class="reaction-trigger ${groups.length ? "has-reactions" : ""}" data-reaction-picker="${esc(e.id)}" aria-expanded="${expanded}" aria-label="${esc(description ? description + ". Add or change your reaction" : "React to this entry")}">${groups.length ? groups.map((g) => `<span class="reaction-total"><span aria-hidden="true">${g.emoji}</span><span>${g.people.length}</span></span>`).join("") : '<span aria-hidden="true">' + icon("heartOpen") + '</span><span class="sr-only">React</span>'}</button>${expanded ? `<div class="reaction-picker" role="group" aria-label="Choose your reaction">${reactionEmojis.map((emoji) => `<button class="reaction-chip" data-react="${emoji}" data-event="${esc(e.id)}" aria-label="${mine === emoji ? "Remove your" : "React with"} ${emoji} reaction" aria-pressed="${mine === emoji}">${emoji}</button>`).join("")}</div>` : ""}</div>`;
}
document.addEventListener(
  "click",
  safe(async (ev) => {
    const trigger = ev.target.closest("[data-reaction-picker]");
    if (trigger) {
      reactionPickerId =
        reactionPickerId === trigger.dataset.reactionPicker
          ? null
          : trigger.dataset.reactionPicker;
      refreshReactions();
      return;
    }
    const b = ev.target.closest("[data-react]");
    if (b) {
      const e = sync.view().events.find((e) => e.id === b.dataset.event);
      if (!e || e.deletedAt) return;
      const emoji =
        e.reactions?.[sync.session.person]?.emoji === b.dataset.react
          ? ""
          : b.dataset.react;
      const host = b.closest("[data-reactions-for]");
      reactionPickerId = null;
      await sync.enqueue("react", e.id, { emoji });
      refreshReactions();
      const target = host.isConnected
        ? host
        : [...document.querySelectorAll("[data-reactions-for]")].find(
            (n) => n.dataset.reactionsFor === e.id && n.getClientRects().length,
          );
      target
        ?.querySelector("[data-reaction-picker]")
        ?.focus({ preventScroll: true });
      if (emoji) room.react("heart");
      return;
    }
    if (reactionPickerId && !ev.target.closest(".entry-reactions")) {
      reactionPickerId = null;
      refreshReactions();
    }
  }),
);
document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Escape" || !reactionPickerId) return;
  ev.preventDefault();
  ev.stopPropagation();
  const host = document.activeElement.closest("[data-reactions-for]");
  reactionPickerId = null;
  refreshReactions();
  host?.querySelector("[data-reaction-picker]")?.focus({ preventScroll: true });
});
function refreshReactions() {
  const events = sync.view().events;
  document.querySelectorAll("[data-reactions-for]").forEach((node) => {
    const e = events.find((e) => e.id === node.dataset.reactionsFor);
    if (!e || e.deletedAt) {
      node.remove();
      return;
    }
    const focused = node.contains(document.activeElement);
    const selected = document.activeElement.dataset.react;
    const holder = document.createElement("div");
    holder.innerHTML = reactions(e);
    if (node.innerHTML === holder.firstElementChild.innerHTML) return;
    node.innerHTML = holder.firstElementChild.innerHTML;
    if (focused) {
      const choice = [...node.querySelectorAll("[data-react]")].find(
        (b) => b.dataset.react === selected,
      );
      (choice || node.querySelector("[data-reaction-picker]"))?.focus({
        preventScroll: true,
      });
    }
  });
}
function entry(e) {
  const duration =
    e.end_time != null
      ? e.end_time < e.time
        ? "Time needs review"
        : `${Math.round((e.end_time - e.time) / 60000)} min`
      : ["nap", "slumber", "walk"].includes(e.type)
        ? "In progress"
        : "";
  const detail = [
    e.foods?.join(" + "),
    placeLabel(e),
    person(e.loggedBy),
    duration,
    e.note !== eventLabel(e) ? e.note : "",
    ...(e.tags || []),
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="feed-entry${e.id === freshEntry ? " fresh" : ""}"><button class="entry" data-open="${esc(e.id)}"><span class="entry-symbol sq" style="--c:${typeColor(e.type)}" aria-hidden="true">${icon(typeIcon(e.type, e.careTitle), "ic sm")}</span><span class="entry-body"><span class="entry-title">${esc(eventLabel(e))}</span><span class="entry-note">${esc(detail)}</span></span><span class="entry-time">${clock(e.time)}${e.pending ? '<br><span class="pending-dot">Not sent</span>' : ""}</span></button>${e.photos?.length ? `<div class="feed-photos">${e.photos.map((p) => `<button data-open="${esc(e.id)}" aria-label="Open photo from ${esc(eventLabel(e))}"><img data-photo="${esc(p.id)}" alt="${esc(photoCaption(e))}" loading="lazy"></button>`).join("")}</div>` : ""}${reactions(e)}</div>`;
}
function renderStory() {
  $("story-tools").hidden = ["patterns", "places"].includes(filter);
  $("places-view").hidden = filter !== "places";
  $("story-items").hidden = filter === "places";
  $("story-count").hidden = filter === "places";
  if (filter === "places") {
    $("load-more").hidden = true;
    places.render(facts());
    return;
  }
  $("album-label").hidden = filter !== "moments";
  document.querySelector(".history-filters label:first-child").hidden =
    filter === "moments";
  if (filter === "patterns") {
    renderPatterns();
    return;
  }
  let events = facts();
  const album = $("photo-album").value,
    query = $("story-search").value.toLowerCase().trim();
  if (filter === "moments")
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
  if (filter === "care" && $("history-type").value)
    events = events.filter((e) => e.type === $("history-type").value);
  if ($("history-from").value)
    events = events.filter((e) => dayKey(e.time) >= $("history-from").value);
  if ($("history-to").value)
    events = events.filter((e) => dayKey(e.time) <= $("history-to").value);
  const count = events.length,
    photos = events.reduce((n, e) => n + (e.photos?.length || 0), 0);
  $("story-count").textContent =
    filter === "care"
      ? count.toLocaleString() + " " + (count === 1 ? "entry" : "entries")
      : photos +
        " " + (photos === 1 ? "photo" : "photos");
  $("load-more").hidden = count <= limit;
  if (!count) {
    html(
      "story-items",
      `<div class="empty"><h3>${query || $("history-from").value || $("history-to").value ? "No matches." : filter === "care" ? "Nothing logged yet." : "No photos yet."}</h3>${query || $("history-from").value || $("history-to").value ? "<p>Try another search or date range.</p>" : filter === "moments" ? '<button class="px btn ink" data-act="moment">Add photo</button>' : ""}</div>`,
    );
    return;
  }
  if (filter === "care")
    html(
      "story-items",
      events
        .slice(0, limit)
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
        .slice(0, limit)
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

async function hydratePhotos() {
  for (const img of document.querySelectorAll("img[data-photo]")) {
    const id = img.dataset.photo;
    if (photoURLs.has(id)) {
      img.src = photoURLs.get(id);
      continue;
    }
    if (photoLoading.has(id)) continue;
    photoLoading.add(id);
    sync
      .photo(id)
      .then((blob) => {
        photoURLs.set(id, URL.createObjectURL(blob));
        document.querySelectorAll("img[data-photo]").forEach((el) => {
          if (el.dataset.photo === id) el.src = photoURLs.get(id);
        });
      })
      .catch(() => {
        img.alt = "Photo unavailable offline · reconnect to load";
      })
      .finally(() => photoLoading.delete(id));
  }
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
    limit = 60;
    renderStory();
  });
$("photo-album").onchange = () => {
  limit = 60;
  renderStory();
};
$("load-more").onclick = () => {
  limit += 60;
  renderStory();
};
document.querySelectorAll("[data-filter]").forEach(
  (button) =>
    (button.onclick = () => {
      filter = button.dataset.filter;
      storySection = filter;
      limit = 60;
      $("history-type").value = "";
      document
        .querySelectorAll("[data-filter]")
        .forEach((b) => b.classList.toggle("selected", b === button));
      renderStory();
    }),
);
async function log(type, extra = {}) {
  if (type === lastLogType && Date.now() - actionLock < 600) return;
  actionLock = Date.now();
  lastLogType = type;
  if (type === "meal" && !extra.foods) return mealPicker();
  if (type === "sleep" || type === "nap" || type === "slumber") {
    const sleeping = facts().find(
      (e) => ["nap", "slumber"].includes(e.type) && active(e),
    );
    if (sleeping) return endSleep(sleeping);
    if (type === "sleep") type = sleepContext().type;
  }
  const eventId = uid();
  freshEntry = eventId;
  await sync.enqueue("create", eventId, {
    type,
    time: Date.now(),
    end_time: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    who: "us",
    tags: [],
    note: "",
    time_precision: "exact",
    ...extra,
  });
  room.react(["pee", "poop", "meal"].includes(type) ? type : "heart");
  const label = TYPES[type][1];
  toast(
    `${["nap", "slumber", "walk"].includes(type) ? label + " started" : label + " logged"} · ${clock(Date.now())}`,
    () => sync.enqueue("delete", eventId).then(() => room.react("undo")),
    ["nap", "slumber", "walk"].includes(type)
      ? []
      : [
          ["+ Photo", () => pottyPhoto(eventId, type)],
          ...(type === "poop" ? [] : [["+ Note", () => editForm(null, eventId)]]),
        ],
  );
  flashTile(type);
  void autoPlace.attach(eventId);
  return eventId;
}
function flashTile(type) {
  const b = document.querySelector(`#care-actions [data-log="${type}"], #log-row [data-log="${type}"]`);
  if (!b) return;
  b.classList.remove("logged");
  void b.offsetWidth;
  b.classList.add("logged");
  const act = b.querySelector(".act");
  if (act) act.textContent = "Logged";
  setTimeout(() => {
    renderedHTML.delete("care-actions");
    render();
  }, 1400);
}
async function endSleep(e) {
  await sync.enqueue("edit", e.id, { end_time: Date.now() });
  toast(
    `${TYPES[e.type][1]} ended · ${durationLabel(Math.max(1, Math.round((Date.now() - e.time) / 60000)))}`,
    () => sync.enqueue("edit", e.id, { end_time: null }),
  );
}
async function finishWalk() {
  const e = facts().find((e) => e.type === "walk" && active(e));
  if (!e) return;
  await sync.enqueue("edit", e.id, { end_time: Date.now() });
  toast(
    `Walk finished · ${durationLabel(Math.max(1, Math.round((Date.now() - e.time) / 60000)))}`,
    () => sync.enqueue("edit", e.id, { end_time: null }),
  );
}
async function logCare(type, title, approx = false) {
  const eventId = uid();
  await sync.enqueue("create", eventId, {
    type,
    time: Date.now(),
    end_time: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    who: "us",
    tags: [],
    note: "",
    time_precision: approx ? "approx" : "exact",
    ...(type === "grooming" ? { careTitle: title } : {}),
  });
  room.react("heart");
  toast(
    `${type === "grooming" ? title : TYPES[type][1]} logged${approx ? " for today" : " · " + clock(Date.now())}`,
    () => sync.enqueue("delete", eventId),
    [["+ Photo", () => pottyPhoto(eventId, type)]],
  );
  if (!approx) void autoPlace.attach(eventId);
}
let early = { type: "pee", ago: 15 };
function earlierSheet(next = {}) {
  early = { ...early, ...next };
  const types = ["pee", "poop", "meal", "walk", "sleep", "grooming"],
    name = (t) => (t === "sleep" ? "Sleep" : t === "grooming" ? "Bath" : TYPES[t][1]);
  openDialog(
    `<h2 id="dialog-title">Log earlier</h2><section class="sheet-section"><h3>What</h3><div class="offsets">${types.map((t) => `<button class="px" style="--c:${t === "sleep" ? "var(--sleep)" : typeColor(t)}" aria-pressed="${t === early.type}" data-early-type="${t}">${name(t)}</button>`).join("")}</div></section><section class="sheet-section"><h3>When</h3><div class="offsets">${[5, 15, 30, 60, 120, 180].map((m) => `<button class="px" aria-pressed="${m === early.ago}" data-early-ago="${m}">${m < 60 ? m + " min" : m / 60 + (m === 60 ? " hour" : " hours")} ago</button>`).join("")}</div></section><div class="button-row"><button class="px btn ink" data-early-save>Log ${name(early.type).toLowerCase()} at ${clock(Date.now() - early.ago * 60000)}</button><button class="text-button" data-early-form>Pick an exact time</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
}
async function saveEarlier() {
  const time = Date.now() - early.ago * 60000,
    eventId = uid(),
    type = early.type === "sleep" ? sleepContext(time).type : early.type;
  await sync.enqueue("create", eventId, {
    type,
    time,
    end_time: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    who: "us",
    tags: [],
    note: "",
    time_precision: "approx",
    retroactive: true,
    ...(type === "grooming" ? { careTitle: "Bath" } : {}),
    ...(type === "meal" ? { foods: [] } : {}),
  });
  closeDialog();
  room.react("heart");
  toast(
    `${type === "grooming" ? "Bath" : TYPES[type][1]} logged for ${clock(time)}`,
    () => sync.enqueue("delete", eventId),
  );
}
function pottyPhoto(id, type) {
  quickPhotoId = id;
  openDialog(
    `<h2 id="dialog-title">${type === "grooming" ? "Photo" : TYPES[type][1] + " photo"}</h2><p class="fine" id="auto-place-status" data-event="${esc(id)}" role="status">${autoPlaceEnabled() ? "Location is added when this phone allows it." : "Automatic location is off on this phone."}</p><div class="photo-choice"><button class="px" data-photo-camera="${id}">${icon("photo", "ic lg")}Take photo</button><button class="px" data-photo-library="${id}">${icon("photos", "ic lg")}Choose photo</button><button class="text-button" data-act="close">Not now</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
}
function mealPicker() {
  openDialog(
    `<h2 id="dialog-title">Meal</h2><div class="food-grid">${foodChoices(
      facts(),
    )
      .map(
        (food) =>
          `<button class="px" style="--c:var(--meal)" data-food="${esc(food)}">${esc(food)}</button>`,
      )
      .join(
        "",
      )}</div><form id="custom-food"><label>Other food<input name="food" maxlength="40" required placeholder="Turkey" autocomplete="off"></label><div class="button-row"><button class="px btn ink" type="submit">Log meal</button><button class="text-button" type="button" data-food-unknown>Log without a food</button></div></form><p id="form-error" class="error" role="alert"></p>`,
  );
  $("custom-food").onsubmit = safe(async (ev) => {
    ev.preventDefault();
    const food = normalizeFood(new FormData(ev.target).get("food"));
    if (!food) throw Error("Enter a food name.");
    const button = ev.target.querySelector("button");
    button.disabled = true;
    try {
      await saveMeal(food);
    } finally {
      button.disabled = false;
    }
  });
}
async function saveMeal(food) {
  if (mealSubmitting) return;
  mealSubmitting = true;
  try {
    actionLock = 0;
    const id = await log("meal", { foods: food ? [food] : [] });
    if (id) closeDialog();
  } finally {
    mealSubmitting = false;
  }
}
function detail(id) {
  const e = sync.view().events.find((e) => e.id === id);
  if (!e) {
    toast("This entry isn’t available yet. Refresh to try again.");
    return;
  }
  if (e.deletedAt) {
    openDialog(
      `<h2 id="dialog-title">Entry removed</h2><p class="fine">${esc(eventLabel(e))} · ${dateLabel(e.time)} · ${clock(e.time)}</p><div class="button-row"><button class="secondary" data-restore="${esc(id)}">Restore entry</button></div><p id="form-error" class="error"></p>`,
    );
    return;
  }
  openDialog(
    `<div class="detail-head"><span class="sq" style="--c:${typeColor(e.type)}">${icon(typeIcon(e.type, e.careTitle), "ic sm")}</span><h2 id="dialog-title">${esc(eventLabel(e))}</h2></div><p class="fine">${dateLabel(e.time)} · ${clock(e.time)}${e.end_time != null ? ` → ${dateLabel(e.end_time)} ${clock(e.end_time)}` : ""}</p><p class="fine">${e.loggedBy ? `Logged by ${esc(person(e.loggedBy))}` : "From the original log · person not recorded"}${e.pending ? " · not sent yet" : ""}</p>${e.end_time != null && e.end_time < e.time ? '<p class="error">This historical end time is before its start. You can correct it below; its original value has been preserved.</p>' : ""}${reactions(e)}<div class="detail-meta">${(e.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join("")}${e.who && e.who !== "us" ? `<span class="pill">Care by ${esc(e.who)}</span>` : ""}${e.signal ? `<span class="pill">${esc(e.signal)}</span>` : ""}</div>${e.foods?.length ? `<p class="detail-notes">Ate ${esc(e.foods.join(" + "))}</p>` : ""}${e.note ? `<p class="detail-notes">${esc(e.note)}</p>` : ""}${placeSummary(e)}<button class="text-button" data-place="${esc(id)}">⌖ ${placeLabel(e) ? "Edit place" : "Add place"}</button><div class="button-row"><button class="primary small" data-photo-camera="${esc(id)}">Take photo</button><button class="secondary small" data-photo-library="${esc(id)}">Choose photo</button><button class="text-button" data-edit="${esc(id)}">Edit entry</button></div>${["pee", "poop"].includes(e.type) ? `<h3>Who started it?</h3><div class="signal-buttons">${["He asked", "We took him out"].map((s) => `<button data-signal="${s}" data-id="${esc(id)}" class="${e.signal === s ? "selected" : ""}">${s}</button>`).join("")}</div>` : ""}${(e.photos || []).map((p) => `<img class="detail-photo" data-photo="${esc(p.id)}" alt="${esc(e.type === "poop" ? "Winnie’s poop photo" : "A moment with Winnie")}"><div class="photo-actions"><button class="text-button" data-download-photo="${esc(p.id)}">Save photo</button><button class="text-button danger" data-remove-photo="${esc(p.id)}" data-id="${esc(id)}">Remove from entry</button></div>`).join("")}<div class="button-row"><button class="text-button danger" data-delete="${esc(id)}">Remove entry</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
  detailId = id;
  hydratePhotos();
}
function editForm(type = "note", id = null, defaults = {}) {
  if (id) autoPlace.cancel(id);
  const e = id
    ? sync.view().events.find((e) => e.id === id)
    : {
        type,
        time: Date.now(),
        end_time: null,
        note: "",
        who: "us",
        tags: [],
        ...defaults,
      };
  if (!e) return;
  const eventId = id || uid();
  let savedRevision = id ? e.revision : undefined;
  let entrySaved = false;
  formPhotos = [];
  formType = e.type;
  openDialog(
    `<h2 id="dialog-title">${id ? "Edit entry" : e.type === "moment" ? "Add photo" : "New entry"}</h2><form id="event-form"><label>What happened?<select name="type">${Object.entries(
      TYPES,
    )
      .map(
        ([t, [, l]]) =>
          `<option value="${t}" ${e.type === t ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label id="title-label" ${e.type === "grooming" ? "" : "hidden"}>What was done<input name="careTitle" maxlength="60" value="${esc(e.careTitle || "")}" placeholder="Bath" list="groom-titles"><datalist id="groom-titles">${GROOMING.map(([t]) => `<option value="${t}"></option>`).join("")}</datalist></label><label id="foods-label" ${e.type === "meal" ? "" : "hidden"}>What he ate<input name="foods" maxlength="500" value="${esc((e.foods || []).join(", "))}" placeholder="Chicken, sardine…"></label><label>When<input name="time" type="datetime-local" value="${dateTime(e.time)}" required></label><label id="end-label" ${["nap", "slumber", "walk", "outing", "episode", "appointment", "travel", "covered_gap"].includes(e.type) ? "" : "hidden"}>End time <span class="fine">(leave empty if in progress)</span><input name="end_time" type="datetime-local" value="${e.end_time ? dateTime(e.end_time) : ""}"></label><label>${e.type === "moment" ? "Caption" : "Note"} <span class="fine">(optional)</span><textarea name="note" maxlength="10000" placeholder="Optional">${esc(e.note || "")}</textarea></label><details><summary class="fine">More details</summary><label>Who provided care?<select name="who">${["us", "trainer", "sitter", "unknown"].map((w) => `<option value="${w}" ${e.who === w ? "selected" : ""}>${w === "us" ? "Us" : w}</option>`).join("")}</select></label><label>Tags <span class="fine">(separate with commas)</span><input name="tags" value="${esc((e.tags || []).join(", "))}" placeholder="outdoors, self-signaled"></label><label>Place<input name="location" maxlength="500" value="${esc(placeName(e))}"></label><label>Time accuracy<select name="time_precision">${["exact", "approx", "unknown"].map((t) => `<option ${e.time_precision === t ? "selected" : ""}>${t}</option>`).join("")}</select></label></details>${!id ? '<div class="button-row"><button type="button" class="secondary small" data-form-camera>Take photo</button><button type="button" class="secondary small" data-form-library>Choose photos</button></div><p id="form-photo-status" class="fine"></p>' : ""}<p id="form-error" class="error" role="alert"></p><div class="button-row"><button type="submit" class="primary">${id ? "Save changes" : "Save entry"}</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`,
  );
  const f = $("event-form");
  f.elements.type.addEventListener("change", () => {
    $("foods-label").hidden = f.elements.type.value !== "meal";
  });
  f.elements.type.addEventListener("change", () => {
    $("title-label").hidden = f.elements.type.value !== "grooming";
  });
  f.elements.type.onchange = () => {
    $("end-label").hidden = ![
      "nap",
      "slumber",
      "walk",
      "outing",
      "episode",
      "appointment",
      "travel",
      "covered_gap",
    ].includes(f.elements.type.value);
  };
  f.onsubmit = safe(async (ev) => {
    ev.preventDefault();
    const submit = f.querySelector("[type=submit]");
    submit.disabled = true;
    try {
      const input = new FormData(f),
        payload = {
          type: input.get("type"),
          ...(input.get("type") === "meal"
            ? {
                foods: String(input.get("foods") || "")
                  .split(",")
                  .map(normalizeFood)
                  .filter(Boolean),
              }
            : {}),
          time: new Date(input.get("time")).getTime(),
          end_time:
            input.get("end_time") && !$("end-label").hidden
              ? new Date(input.get("end_time")).getTime()
              : null,
          note: input.get("note").trim(),
          who: input.get("who"),
          tags: input
            .get("tags")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          location:
            input.get("location") === placeName(e)
              ? e.location || ""
              : input.get("location"),
          ...(input.get("location") !== placeName(e) ? { placePin: null } : {}),
          time_precision: input.get("time_precision"),
          ...(input.get("type") === "grooming"
            ? { careTitle: String(input.get("careTitle") || "").trim() }
            : {}),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          retroactive: true,
        };
      if (payload.end_time != null && payload.end_time < payload.time)
        throw new Error("The end time must be after the start.");
      if (
        payload.type === "moment" &&
        !payload.note &&
        !formPhotos.length &&
        !e.photos?.length
      )
        throw new Error("Choose a photo or add a few words for this moment.");
      await sync.enqueue(
        id || entrySaved ? "edit" : "create",
        eventId,
        payload,
        savedRevision,
      );
      if (
        !id &&
        !entrySaved &&
        payload.time === new Date(dateTime(e.time)).getTime() &&
        payload.time_precision === "exact"
      )
        void autoPlace.attach(eventId);
      entrySaved = true;
      savedRevision = sync
        .view()
        .events.find((e) => e.id === eventId)?.revision;
      while (formPhotos.length) {
        await sync.addPhoto(eventId, formPhotos[0]);
        formPhotos.shift();
        savedRevision = sync
          .view()
          .events.find((e) => e.id === eventId)?.revision;
      }
      closeDialog();
      toast(
        "Saved",
        id ? null : () => sync.enqueue("delete", eventId),
      );
      if (["pee", "poop"].includes(payload.type) && !id && !formPhotos.length)
        render();
    } finally {
      submit.disabled = false;
    }
  });
}
function moreCare() {
  const events = facts(),
    sleeping = events.find((e) => ["nap", "slumber"].includes(e.type) && active(e)),
    walk = events.find((e) => e.type === "walk" && active(e)),
    lastOf = (pred) => {
      const e = events.find((x) => x.time <= Date.now() && pred(x));
      return e ? elapsed(e.time) : "Not yet";
    };
  openDialog(
    `<h2 id="dialog-title">More</h2><section class="sheet-section"><h3>Grooming</h3><div class="type-grid">${GROOMING.map(([t, i]) => `<button class="px" style="--c:var(--groom)" data-groom="${t}">${icon(i)}${t}<small>${lastOf((x) => x.type === "grooming" && (x.careTitle || "").toLowerCase() === t.toLowerCase())}</small></button>`).join("")}</div></section><section class="sheet-section"><h3>Walks and sleep</h3><div class="type-grid"><button class="px" style="--c:var(--walk)" data-act="${walk ? "finish-walk" : "start-walk"}">${icon("walk")}${walk ? "Finish walk" : "Start walk"}</button><button class="px" style="--c:var(--sleep)" data-act="${sleeping ? "end-sleep" : "start-sleep"}">${icon("sleep")}${sleeping ? (sleeping.type === "nap" ? "End nap" : "End sleep") : sleepContext().type === "nap" ? "Start nap" : "Start night sleep"}</button><button class="px" style="--c:var(--walk)" data-new-type="outing">${icon("walk")}Outing</button></div></section><section class="sheet-section"><h3>Health and training</h3><div class="type-grid">${["medication", "enrichment", "appointment", "vomit", "episode", "travel", "covered_gap", "note"].map((t) => `<button class="px" style="--c:${typeColor(t)}" data-new-type="${t}">${icon(typeIcon(t))}${TYPES[t][1]}</button>`).join("")}<button class="px" style="--c:var(--care)" data-act="trainer">${icon("whistle")}Trainer visit</button></div></section>`,
  );
}
function plan() {
  fridge.edit();
}
function renderHandoff() {
  fridge.render();
}
function nextCareForm() {
  const p = sync.view().profile,
    n = p.nextCare;
  openDialog(
    `<h2 id="dialog-title">Shared plan</h2><form id="next-care-form"><label>Next step<input name="label" maxlength="200" required placeholder="e.g. Evening walk" value="${esc(n?.label || "")}"></label><label>When <span class="fine">(optional)</span><input name="due" type="datetime-local" value="${n?.dueAt ? dateTime(n.dueAt) : ""}"></label><label>Who’s doing it?<select name="person"><option value="">Not decided</option><option value="brandon" ${n?.claimedBy === "brandon" ? "selected" : ""}>Brandon</option><option value="kim" ${n?.claimedBy === "kim" ? "selected" : ""}>Kim</option></select></label><p class="fine">A shared plan, not a reminder notification. Log the care when it happens.</p><div class="button-row"><button class="primary">Save plan</button><button type="button" class="secondary" data-act="close">Cancel</button>${n ? '<button type="button" class="text-button" id="clear-care-plan">Clear plan</button>' : ""}</div><p id="form-error" class="error" role="alert"></p></form>`,
  );
  $("next-care-form").onsubmit = safe(async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const nextCare = {
      label: f.get("label").trim(),
      dueAt: f.get("due") ? new Date(f.get("due")).getTime() : null,
      claimedBy: f.get("person"),
    };
    if (
      !nextCare.label ||
      (nextCare.dueAt !== null && !Number.isFinite(nextCare.dueAt))
    )
      throw Error("Choose a next step and a valid time.");
    await sync.enqueue("profile", null, { nextCare }, p.revision);
    closeDialog();
    toast("Plan saved");
  });
  if (n)
    $("clear-care-plan").onclick = safe(async () => {
      await fridge.putPlanAway(p);
      closeDialog();
      toast("Plan kept in Saved.");
    });
}
function placeSummary(e) {
  const url = mapURL(e);
  return url
    ? `<div class="place-summary"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">⌖ ${esc(placeLabel(e))} ↗</a>${validPin(e.placePin) ? `<p class="fine">Phone location · accuracy about ${Math.round(e.placePin.accuracy)} m</p>` : ""}</div>`
    : "";
}
function placePicker(id) {
  autoPlace.cancel(id);
  const e = sync.view().events.find((e) => e.id === id && !e.deletedAt);
  if (!e) return;
  let pin = validPin(e.placePin) ? e.placePin : eventPosition(e),
    pinChanged = false,
    locating = false;
  const recent = [...new Set(facts().map(placeName).filter(Boolean))].slice(
    0,
    12,
  );
  openDialog(
    `<h2 id="dialog-title">Place</h2><p class="fine">${esc(eventLabel(e))} · ${dateLabel(e.time)} · ${clock(e.time)}</p><form id="place-form"><label>Place name<input name="place" maxlength="500" list="recent-places" placeholder="Home, the park, the beach" value="${esc(placeName(e))}"></label><datalist id="recent-places">${recent.map((p) => `<option value="${esc(p)}"></option>`).join("")}</datalist>${canCaptureHere(e) ? '<button type="button" class="secondary small" id="capture-place">Use current location</button><p class="fine">Only if you’re still where this happened. Saved with this entry and shared with each other.</p>' : '<p class="fine">Name the original place for this older entry. Your current location won’t be attached.</p>'}<p id="pin-status" class="fine" role="status">${pin ? `${placeLabel(e)}${Number.isFinite(pin.accuracy) ? ` · accuracy about ${Math.round(pin.accuracy)} m` : ""}` : "No map pin attached."}</p><button type="button" class="text-button" id="remove-pin" ${pin ? "" : "hidden"}>Remove map pin</button><div class="button-row"><button class="primary" id="save-place">Save place</button><button type="button" class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p></form>`,
  );
  const form = $("place-form"),
    status = $("pin-status"),
    save = $("save-place"),
    remove = $("remove-pin"),
    capture = $("capture-place");
  if (capture)
    capture.onclick = async () => {
      if (locating) return;
      locating = true;
      capture.disabled = true;
      save.disabled = true;
      status.textContent = "Finding this spot…";
      try {
        const found = await capturePlace();
        if (!form.isConnected) return;
        if (!canCaptureHere(e))
          throw Error(
            "This entry is now too old for a current location. Name the place instead.",
          );
        pin = found;
        pinChanged = true;
        status.textContent = `${placeLabel({ placePin: pin })} · accuracy about ${Math.round(pin.accuracy)} m`;
        remove.hidden = false;
      } catch (err) {
        if (form.isConnected) status.textContent = err.message;
      } finally {
        locating = false;
        capture.disabled = false;
        save.disabled = false;
      }
    };
  remove.onclick = () => {
    pin = null;
    pinChanged = true;
    remove.hidden = true;
    status.textContent = "Map pin removed. Save to keep this change.";
  };
  form.onsubmit = safe(async (ev) => {
    ev.preventDefault();
    if (locating) return;
    save.disabled = true;
    try {
      await sync.enqueue(
        "edit",
        id,
        {
          location:
            new FormData(form).get("place").trim() === placeName(e) &&
            !pinChanged
              ? e.location || ""
              : new FormData(form).get("place").trim(),
          ...(pinChanged ? { placePin: pin } : {}),
        },
        e.revision,
      );
      detail(id);
      toast("Place saved");
    } finally {
      save.disabled = false;
    }
  });
}

function settings() {
  if (!sync.session) {
    $("shared-code").focus();
    return;
  }
  const devices = sync.data.snapshot.devices || [],
    me = sync.session.token.split(".")[0],
    entries = sync.data.snapshot.events.filter((e) => !e.deletedAt).length;
  openDialog(
    `<h2 id="dialog-title">Settings</h2><div class="setting-block"><h3>${person(sync.session.person)}</h3><p class="fine">This phone logs as ${person(sync.session.person)}.</p><button class="px btn" id="push-toggle" data-act="push" disabled>Checking notifications</button><p id="push-status" class="fine" role="status"></p></div><div class="setting-block"><h3>Location</h3><button class="px btn" data-act="auto-place">Automatic location: ${autoPlaceEnabled() ? "on" : "off"}</button><p class="fine">Adds this phone's location to new logs when allowed. Nothing is tracked between logs. Each phone has its own setting.</p></div><div class="setting-block"><h3>Plans</h3><div class="button-row"><button class="px btn" data-act="plan">Shared plan</button><button class="px btn" data-act="trainer-schedule">Trainer visits</button></div><p class="fine">Sleep logs as a nap between San Francisco sunrise and sunset, and as night sleep outside them.</p></div><div class="setting-block"><h3>History</h3><p>${entries.toLocaleString()} entries. Old entries keep who logged them.</p><p class="fine">Logged in the app: Brandon ${sync.data.snapshot.usage?.brandon || 0}, Kim ${sync.data.snapshot.usage?.kim || 0}</p><div class="button-row"><button class="px btn" data-act="export">Export history</button><button class="text-button" data-act="review">Review changes</button></div><p class="fine">Save photos from each entry. Exports include photo references.</p></div><div class="setting-block"><h3>Devices</h3>${devices
      .filter((d) => !d.revoked)
      .map(
        (d) =>
          `<div class="device"><span>${esc(d.name)} · ${person(d.person)}${d.id === me ? " · this phone" : ""}</span>${d.id !== me ? `<button class="text-button danger" data-revoke="${esc(d.id)}">Remove</button>` : ""}</div>`,
      )
      .join("")}<div class="button-row"><button class="px btn ink" data-act="join-code">Add a device</button>${sync.session.code ? '<button class="text-button" data-act="invite">Show shared code</button>' : ""}</div></div><div class="setting-block"><button class="text-button" data-act="reconnect">Switch person on this phone</button><p class="fine">Changes not sent yet stay with this shared log.</p></div><p id="form-error" class="error" role="alert"></p>`,
  );
  updatePushStatus();
}
async function updatePushStatus() {
  const button = $("push-toggle");
  if (!button) return;
  try {
    const state = await sync.pushState();
    if ($("push-toggle") !== button) return;
    const labels = {
      on: "Turn off notifications",
      off: "Turn on notifications",
      repair: "Reconnect notifications",
      blocked: "Notifications blocked in iPhone Settings",
      unsupported: "Open from the Home Screen to turn on",
    };
    button.textContent = labels[state];
    button.dataset.act = state === "on" ? "push-off" : "push";
    button.disabled = ["blocked", "unsupported"].includes(state);
    $("push-status").textContent =
      state === "on"
        ? "On. You get one when the other person logs something."
        : state === "repair"
          ? "Notifications need to reconnect on this phone."
          : state === "blocked"
            ? "Allow notifications for Winnie in iPhone Settings, then reopen Settings here."
            : state === "unsupported"
              ? "On iPhone, add Winnie to the Home Screen from Safari and open it there."
              : "Get a notification when the other person logs something.";
  } catch {
    if ($("push-toggle") === button) {
      button.textContent = "Retry notification check";
      button.dataset.act = "push-check";
      button.disabled = false;
      $("push-status").textContent =
        "Could not check this phone’s notification setup.";
    }
  }
}

function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical(v[k])]),
    );
  return v;
}
function legacyDiff() {
  const d = sync.data;
  if (!d.legacy) return [];
  const reviewed = new Set(d.reviewed),
    byId = new Map(d.snapshot.events.map((e) => [e.id, e]));
  return d.legacy.events.filter((e) => {
    if (reviewed.has(e.id)) return false;
    const shared = byId.get(e.id);
    return (
      !shared ||
      shared.deletedAt ||
      Object.keys(e).some(
        (k) =>
          JSON.stringify(canonical(e[k])) !==
          JSON.stringify(canonical(shared[k])),
      )
    );
  });
}
function compareEntry(e) {
  if (!e) return "No shared entry";
  return [
    e.type ? eventLabel(e) : "Saved changes",
    e.time ? dateLabel(e.time) + " at " + clock(e.time) : "",
    e.end_time
      ? "Ended " + dateLabel(e.end_time) + " at " + clock(e.end_time)
      : "",
    e.note ? "Note: " + e.note : "",
    placeLabel(e) ? "Place: " + placeLabel(e) : "",
    e.tags?.length ? "Tags: " + e.tags.join(", ") : "",
    e.signal ? "Signal: " + e.signal : "",
    e.deletedAt ? "This entry was removed." : "",
    e.routine ? "Routine: " + e.routine : "",
    e.goal ? "Practicing: " + e.goal : "",
    e.photos?.length ? e.photos.length + " photos" : "",
  ]
    .filter(Boolean)
    .join("\n");
}
function review() {
  const conflicts = sync.data.queue.filter((q) => q.error),
    older = legacyDiff();
  openDialog(
    `<h2 id="dialog-title">Review changes</h2><p class="fine">Nothing is deleted. Pick which version belongs in the shared log.</p>${conflicts.map((q) => `<div class="recovery"><h3>${esc(q.error)}</h3><p class="fine">${esc(q.command.kind)} · ${esc(q.command.payload.note || q.command.payload.type || q.command.eventId)}</p><details><summary>Compare saved changes</summary><p class="fine">Your pending change</p><pre>${esc(compareEntry(q.command.payload))}</pre><p class="fine">Latest shared entry</p><pre>${esc(compareEntry(q.current))}</pre></details><div class="button-row">${!["create", "recover"].includes(q.command.kind) && q.current && !q.current.deletedAt ? `<button class="secondary small" data-resolve="${q.command.operationId}" data-mine="yes">Use my changes</button>` : ""}<button class="text-button" data-resolve="${q.command.operationId}">Keep shared version</button></div></div>`).join("")}${older
      .slice(0, 25)
      .map((e) => {
        const shared = sync.data.snapshot.events.find((x) => x.id === e.id);
        return `<div class="recovery"><h3>${esc(eventLabel(e))} · ${dateLabel(e.time)}</h3><p class="fine">${shared ? "Different from the shared entry" : "Only in this phone’s older copy"} · ${clock(e.time)}</p><details><summary>Compare both versions</summary><p class="fine">Phone copy</p><pre>${esc(compareEntry(e))}</pre><p class="fine">Shared copy</p><pre>${esc(compareEntry(shared))}</pre></details><div class="button-row">${!shared ? `<button class="secondary small" data-recover="${esc(e.id)}">Keep this entry</button>` : !shared.deletedAt ? `<button class="secondary small" data-edit="${esc(e.id)}">Edit shared entry</button>` : `<button class="secondary small" data-restore="${esc(e.id)}">Restore shared entry</button>`}<button class="text-button" data-reviewed="${esc(e.id)}">Keep shared history</button></div></div>`;
      })
      .join(
        "",
      )}${!conflicts.length && !older.length ? '<div class="empty"><h3>Nothing to review.</h3></div>' : ""}${older.length > 25 ? '<p class="fine">More entries will appear as these are reviewed.</p>' : ""}<p id="form-error" class="error" role="alert"></p>`,
  );
}
async function photoFile(file) {
  if (file.size > 40000000)
    throw new Error("Please choose a photo smaller than 40 MB.");
  const url = URL.createObjectURL(file),
    img = new Image();
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () =>
        reject(
          new Error(
            "This photo format could not be opened. Choose a JPEG or a photo from your camera.",
          ),
        );
      img.src = url;
    });
    const scale = Math.min(
        1,
        1800 / Math.max(img.naturalWidth, img.naturalHeight),
      ),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    if (!blob)
      throw new Error("Could not prepare this photo. Please try another.");
    if (blob.size > 2400000)
      blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.65));
    if (!blob || blob.size > 2500000)
      throw new Error("This photo is too large. Please choose a smaller copy.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function choosePhoto(target, camera = false) {
  photoTarget = target;
  const input = $(camera ? "camera-input" : "library-input");
  input.value = "";
  input.click();
}
for (const id of ["camera-input", "library-input"])
  $(id).onchange = safe(async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 20),
      target = photoTarget;
    if (!files.length) return;
    toast("Preparing photo");
    for (const file of files) {
      const blob = await photoFile(file);
      if (target === "form") {
        if (!$("event-form")) return;
        formPhotos.push(blob);
        $("form-photo-status").textContent =
          `${formPhotos.length} ${formPhotos.length === 1 ? "photo" : "photos"} ready to keep.`;
      } else await sync.addPhoto(target, blob);
    }
    if (target !== "form") {
      toast(`${files.length === 1 ? "Photo" : "Photos"} saved on this device.`);
      if (quickPhotoId === target) {
        quickPhotoId = null;
        closeDialog();
      } else if ($("dialog").open && detailId === target) detail(target);
      render();
    } else toast("Photo attached. Save to keep it.");
  });
function download(value, name, type = "application/json") {
  const blob =
      value instanceof Blob
        ? value
        : new Blob([JSON.stringify(value, null, 2)], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
$("sync-chip").onclick = () => syncSheet();
$("story-add").onclick = () => editForm("moment");
$("settings").onclick = settings;
$("connect-form").onsubmit = safe(async (e) => {
  e.preventDefault();
  $("connect-error").textContent = "";
  const button = e.target.querySelector("[type=submit]");
  button.disabled = true;
  try {
    const code = $("shared-code").value.trim(),
      who = new FormData(e.target).get("person"),
      name = $("device-name").value.trim();
    if (/^[A-Za-z0-9]{4}[-\s]?[A-Za-z0-9]{4}$/.test(code))
      await sync.join(code, who, name);
    else await sync.pair(code, who, name);
    render();
  } catch (err) {
    $("connect-error").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

document.addEventListener(
  "click",
  safe(async (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.log) {
      if (longPressed) return (longPressed = false);
      if ($("dialog").open) closeDialog();
      return log(b.dataset.log);
    }
    if (b.dataset.groom) {
      closeDialog();
      return logCare("grooming", b.dataset.groom);
    }
    if (b.dataset.also) {
      if (b.getAttribute("aria-pressed") === "true") return;
      return logCare(b.dataset.also, b.dataset.title, true);
    }
    if (b.dataset.earlyType) return earlierSheet({ type: b.dataset.earlyType });
    if (b.dataset.earlyAgo) return earlierSheet({ ago: Number(b.dataset.earlyAgo) });
    if (b.hasAttribute("data-early-save")) return saveEarlier();
    if (b.hasAttribute("data-early-form"))
      return editForm(
        early.type === "sleep" ? sleepContext().type : early.type,
        null,
        early.type === "grooming" ? { careTitle: "Bath" } : {},
      );
    if (b.dataset.food || b.hasAttribute("data-food-unknown")) {
      b.disabled = true;
      try {
        await saveMeal(b.dataset.food || "");
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (b.dataset.visit) {
      await confirmVisit(b.dataset.visit);
      return;
    }
    if (b.dataset.rhythm) {
      insightTopic = b.dataset.rhythm;
      renderPatterns();
      document.querySelector('[data-rhythm="' + insightTopic + '"]')?.focus();
      return;
    }
    if (b.dataset.evidence) return showEvidence(b.dataset.evidence);
    if (b.dataset.act === "more") return moreCare();
    if (b.hasAttribute("data-evidence-more"))
      return showEvidence(evidenceKey, true);
    if (b.hasAttribute("data-evidence-back")) return showEvidence(evidenceKey);
    if (b.dataset.open) {
      const fromEvidence = !!b.closest(".evidence-list");
      detail(b.dataset.open);
      if (fromEvidence)
        $("dialog-content").insertAdjacentHTML(
          "afterbegin",
          '<button class="text-button" data-evidence-back>← Back to the pattern</button>',
        );
      return;
    }
    if (b.dataset.place) return placePicker(b.dataset.place);
    if (b.dataset.edit) return editForm(null, b.dataset.edit);
    if (b.dataset.newType) return editForm(b.dataset.newType);
    if (b.dataset.end) {
      b.disabled = true;
      try {
        await sync.enqueue("edit", b.dataset.end, { end_time: Date.now() });
        closeDialog();
        room.react("heart");
        toast("Sleep ended");
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (b.hasAttribute("data-form-camera")) return choosePhoto("form", true);
    if (b.hasAttribute("data-form-library")) return choosePhoto("form");
    if (b.dataset.photoCamera) return choosePhoto(b.dataset.photoCamera, true);
    if (b.dataset.photoLibrary) return choosePhoto(b.dataset.photoLibrary);
    if (b.dataset.signal) {
      await sync.enqueue("edit", b.dataset.id, { signal: b.dataset.signal });
      detail(b.dataset.id);
      return;
    }
    if (b.dataset.downloadPhoto) {
      download(
        await sync.photo(b.dataset.downloadPhoto),
        `winnie-${b.dataset.downloadPhoto}.jpg`,
      );
      return;
    }
    if (b.dataset.removePhoto) {
      await sync.enqueue("removePhoto", b.dataset.id, {
        photoId: b.dataset.removePhoto,
      });
      detail(b.dataset.id);
      toast("Photo removed", () =>
        sync.enqueue("attach", b.dataset.id, {
          photoId: b.dataset.removePhoto,
        }),
      );
      return;
    }
    if (b.dataset.delete) {
      const id = b.dataset.delete;
      openDialog(
        `<h2 id="dialog-title">Remove this entry?</h2><p class="fine">You can undo this right after.</p><div class="button-row"><button class="primary" data-confirm-delete="${esc(id)}">Remove entry</button><button class="secondary" data-open="${esc(id)}">Keep it</button></div><p id="form-error" class="error"></p>`,
      );
      return;
    }
    if (b.dataset.confirmDelete) {
      const id = b.dataset.confirmDelete;
      await sync.enqueue("delete", id);
      closeDialog();
      toast("Entry removed", () =>
        sync.enqueue("restore", id),
      );
      return;
    }
    if (b.dataset.restore) {
      await sync.enqueue("restore", b.dataset.restore);
      detail(b.dataset.restore);
      return;
    }
    if (b.dataset.resolve) {
      await sync.resolve(b.dataset.resolve, b.dataset.mine === "yes");
      review();
      return;
    }
    if (b.dataset.reviewed) {
      await sync.markReviewed(b.dataset.reviewed);
      review();
      return;
    }
    if (b.dataset.recover) {
      const e = sync.data.legacy.events.find((e) => e.id === b.dataset.recover);
      await sync.enqueue("recover", e.id, e);
      await sync.markReviewed(e.id);
      review();
      return;
    }
    if (b.dataset.revoke) {
      await sync.request("revoke", {
        method: "POST",
        value: { deviceId: b.dataset.revoke },
      });
      await sync.refresh();
      settings();
      return;
    }
    switch (b.dataset.act) {
      case "close":
        closeDialog();
        break;
      case "review":
        review();
        break;
      case "auto-place":
        localStorage.setItem(
          "winnie:auto-place",
          autoPlaceEnabled() ? "off" : "on",
        );
        if (!autoPlaceEnabled()) autoPlace.cancelAll();
        settings();
        break;
      case "next-care":
        nextCareForm();
        break;
      case "claim-care": {
        const p = sync.view().profile;
        if (p.nextCare)
          await sync.enqueue(
            "profile",
            null,
            { nextCare: { ...p.nextCare, claimedBy: sync.session.person } },
            p.revision,
          );
        break;
      }
      case "plan":
        plan();
        break;
      case "moment":
        editForm("moment");
        break;
      case "all-history":
        careSection = "care";
        setTab("care");
        filter = "care";
        $("history-from").value = "";
        $("history-to").value = "";
        $("history-type").value = "";
        $("story-search").value = "";
        document
          .querySelectorAll("[data-filter]")
          .forEach((x) =>
            x.classList.toggle("selected", x.dataset.filter === filter),
          );
        renderStory();
        break;
      case "find-poop":
        careSection = "care";
        setTab("care");
        filter = "care";
        document
          .querySelectorAll("[data-filter]")
          .forEach((x) =>
            x.classList.toggle("selected", x.dataset.filter === filter),
          );
        $("history-type").value = "poop";
        renderStory();
        break;
      case "trainer":
        trainerSchedule();
        break;
      case "start-walk":
        closeDialog();
        await log("walk");
        break;
      case "finish-walk":
        closeDialog();
        await finishWalk();
        break;
      case "start-sleep":
        closeDialog();
        await log("sleep");
        break;
      case "end-sleep": {
        closeDialog();
        const e = facts().find(
          (e) => ["nap", "slumber"].includes(e.type) && active(e),
        );
        if (e) await endSleep(e);
        break;
      }
      case "photo":
        editForm("moment");
        break;
      case "earlier":
        earlierSheet();
        break;
      case "also-done":
        try {
          localStorage.setItem("winnie:also-done", dayKey(Date.now()));
        } catch {}
        render();
        break;
      case "sync-now":
        closeDialog();
        await sync.flush();
        break;
      case "join-code": {
        b.disabled = true;
        try {
          const { code, expires } = await sync.createJoinCode();
          openDialog(
            `<h2 id="dialog-title">Add a device</h2><p>On the new phone, open Winnie and enter this code.</p><p class="join-code">${esc(code)}</p><p class="fine">Works once, until ${clock(expires)}.</p><button class="px btn" data-act="close">Done</button>`,
          );
        } finally {
          b.disabled = false;
        }
        break;
      }
      case "trainer-schedule":
        trainerSchedule();
        break;
      case "trainer-manual":
        editForm("covered_gap", null, {
          who: "trainer",
          time: Date.now() - 3600000,
          end_time: Date.now(),
        });
        break;
      case "trainer-import":
        $("trainer-import").value = "";
        $("trainer-import").click();
        break;
      case "push-check":
        await updatePushStatus();
        break;
      case "push-off":
        b.disabled = true;
        try {
          await sync.disablePush();
        } finally {
          await updatePushStatus();
        }
        break;
      case "push":
        b.disabled = true;
        try {
          await sync.enablePush();
          await updatePushStatus();
        } finally {
          await updatePushStatus();
        }
        break;
      case "export": {
        const { home, token, person: identity, ...shared } = sync.data.snapshot;
        download(
          {
            exportedAt: new Date().toISOString(),
            shared,
            pending: sync.data.queue.map(({ command, error, queuedAt }) => ({
              command,
              error,
              queuedAt,
            })),
            olderPhoneCopy: sync.data.legacy,
          },
          `winnie-history-${dayKey(Date.now())}.json`,
        );
        break;
      }
      case "invite":
        openDialog(
          `<h2 id="dialog-title">Shared code</h2><p class="fine">The long code still works for joining. A join code from Add a device is shorter and expires.</p><input readonly aria-label="Shared code" value="${esc(sync.session.code)}"><p class="fine">Anyone with this code can join your log. Only share it with people who should see the log.</p>`,
        );
        break;
      case "reconnect":
        if (sync.data.queue.length)
          throw new Error(
            "Finish syncing or reviewing this device’s pending changes before reconnecting.",
          );
        localStorage.removeItem("winnie:v4:session");
        sync.session = null;
        for (const url of photoURLs.values()) URL.revokeObjectURL(url);
        photoURLs.clear();
        closeDialog();
        render();
        break;
    }
  }),
);
sync.addEventListener("change", () => {
  render();
  refreshReactions();
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { updateViaCache: "none" })
    .then((r) => r.update())
    .catch(() => {});
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "OPEN_EVENT") {
      setTab("today");
      sync
        .refresh()
        .then(() => detail(e.data.id))
        .catch(error);
    }
  });
}
await sync.init().catch((err) => {
  $("connect").hidden = false;
  $("connect-error").textContent =
    "Winnie couldn’t open safe storage on this device. Please allow browser storage, then reload. " +
    err.message;
  $("connect-form").querySelector("[type=submit]").disabled = true;
});
const linkedEvent = new URL(location.href).searchParams.get("event");
if (linkedEvent && sync.session) {
  await sync.refresh().catch(() => {});
  detail(linkedEvent);
}
function eventLabel(e) {
  if (e.careTitle) return e.careTitle;
  return e.type === "covered_gap" &&
    (e.kind === "trainer" || e.who === "trainer")
    ? "Trainer visit"
    : TYPES[e.type]?.[1] || e.type;
}
function renderTrainer() {
  $("trainer-card").hidden = true;
}
function visitRow(v, events = facts()) {
  const logged = events.find(
    (e) =>
      e.calendarVisitId === v.id ||
      (e.type === "covered_gap" &&
        e.who === "trainer" &&
        Math.abs(e.time - v.start) < 1800000),
  );
  return `<div class="scheduled-visit"><strong>${esc(v.title)}</strong><p class="fine">${dateLabel(v.start)} · ${clock(v.start)}–${clock(v.end)} · ${logged ? "Confirmed" : "Planned"}</p>${logged ? `<button class="text-button" data-open="${esc(logged.id)}">View logged visit</button>` : v.end <= Date.now() ? `<button class="secondary small" data-visit="${esc(v.id)}">Confirm visit happened</button>` : '<span class="fine">Ready to confirm after the visit.</span>'}</div>`;
}
function trainerSchedule() {
  const schedule = sync.view().profile.trainerSchedule,
    visits =
      schedule?.visits.filter((v) => v.end >= Date.now() - 7 * 86400000) || [];
  openDialog(
    `<h2 id="dialog-title">Trainer visits</h2><p class="fine">${schedule ? "Calendar snapshot checked " + dateLabel(Date.parse(schedule.checkedAt)) + " · through " + esc(schedule.through) + ". Changes in Google Calendar need a fresh import." : "Import planned visits from your calendar. They become care entries only when you confirm they happened."}</p>${visits.map((v) => visitRow(v)).join("") || "<p>No upcoming visits imported yet.</p>"}<div class="button-row"><button class="secondary small" data-act="trainer-import">Import calendar visits</button><button class="text-button" data-act="trainer-manual">Log another visit</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
}
async function confirmVisit(id) {
  const visit = sync
    .view()
    .profile.trainerSchedule?.visits.find((v) => v.id === id);
  if (!visit || visit.end > Date.now())
    throw Error("Confirm this visit after it ends.");
  if (facts().some((e) => e.calendarVisitId === id)) {
    trainerSchedule();
    return;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(id),
  );
  const eventId =
    "trainer-" +
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  await sync.enqueue("create", eventId, {
    type: "covered_gap",
    kind: "trainer",
    calendarVisitId: id,
    time: visit.start,
    end_time: visit.end,
    who: "trainer",
    note: visit.title,
    tags: [],
    time_precision: "exact",
    timezone: "America/Los_Angeles",
  });
  trainerSchedule();
  toast("Trainer visit confirmed.");
}
$("trainer-import").onchange = safe(async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  if (file.size > 50000)
    throw Error("Choose a smaller trainer calendar export.");
  const schedule = validateTrainerImport(JSON.parse(await file.text())),
    revision = sync.view().profile.revision;
  openDialog(
    `<h2 id="dialog-title">Use these calendar visits?</h2><p class="fine">${schedule.visits.length} planned visits · through ${esc(schedule.through)}. Existing care entries stay as they are.</p>${schedule.visits.map((v) => `<p><strong>${esc(v.title)}</strong><br><span class="fine">${dateLabel(v.start)} · ${clock(v.start)}–${clock(v.end)}</span></p>`).join("")}<div class="button-row"><button class="primary" id="save-trainer-import">Use these visits</button><button class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
  $("save-trainer-import").onclick = safe(async (ev) => {
    ev.target.disabled = true;
    try {
      await sync.enqueue(
        "profile",
        null,
        { trainerSchedule: schedule },
        revision,
      );
      trainerSchedule();
      toast("Calendar visits saved to the shared schedule.");
    } finally {
      ev.target.disabled = false;
    }
  });
});


function renderPatterns() {
  insightData = rhythmInsights(facts(), patternDays);
  $("story-count").textContent = "";
  $("load-more").hidden = true;
  html("story-items", countsHTML(facts()) + insightsView(insightData, insightTopic));
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
function showEvidence(key, more = false) {
  evidenceKey = key;
  evidenceLimit = more ? evidenceLimit + 30 : 30;
  const d = insightData,
    p = d.potty[insightTopic],
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
    title = "Between daytime " + insightTopic + " breaks";
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
        ? "His recorded " + insightTopic + " times"
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

setInterval(() => {
  if (!document.hidden && !$("dialog").open) render();
}, 60000);

loadCities()
  .then(() => render())
  .catch(() => {});
