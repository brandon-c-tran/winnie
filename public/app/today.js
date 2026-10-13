// Today: the room's state, the log buttons, Also today, the day strip, and partner greetings.
import { careStates, careDay } from "../care-plans.js?v=3.10";
import { fridgeState, onFridge } from "../fridge-model.js?v=3.10";
import { latestCare, elapsed } from "../care-state.js?v=3.10";
import { icon, GROOMING, typeIcon, typeColor } from "../icons.js?v=4.0";
import { getTimes } from "../vendor/suncalc.js";
import { rhythmInsights, durationLabel } from "../insights.js?v=3.10";
import { care, facts, fridge, room, sync } from "./services.js?v=4.2";
import { setTab } from "./nav.js?v=4.2";
import { finishWalk, log } from "./logging.js?v=4.2";
import {
  $,
  TYPES,
  active,
  by,
  clock,
  dayKey,
  esc,
  person,
  when,
} from "./format.js?v=4.2";
import { html, toast } from "./ui.js?v=4.2";
import { detail, entry, eventLabel, hydratePhotos } from "./entries.js?v=4.2";
import { legacyDiff } from "./settings.js?v=4.2";
import { renderLastTimes, renderStory } from "./library.js?v=4.2";
import { state } from "./state.js?v=4.2";

let roomReady = false,
  wallKey = null;
export function roomObject(what) {
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
  if (state.lastUndo) return;
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
export function render() {
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
  if (state.tab === "today") renderToday(events, sleeping, walk);
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
  if (state.tab === "plans") care.render();
  if (state.tab === "history") {
    renderLastTimes(events);
    renderStory();
  }
  if (state.tab === "photos") renderStory();
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
  $("day-picker-text").textContent = isToday
    ? "Pick day"
    : mid.toLocaleDateString([], { month: "short", day: "numeric" });
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
