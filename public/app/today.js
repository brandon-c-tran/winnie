// Today: the room's state, the log buttons, Also today, the day strip, and partner greetings.
import { careStates, careDay } from "../care-plans.js?v=4.29";
import { fridgeState, onFridge } from "../fridge-model.js?v=4.29";
import { latestCare, elapsed } from "../care-state.js?v=4.29";
import { icon, typeIcon, typeColor } from "../icons.js?v=4.0";
import { getTimes } from "../vendor/suncalc.js";
import { weatherKind } from "../room.js?v=4.29";
import {
  cachedWeather,
  refreshWeather,
  weatherWords,
} from "./weather.js?v=4.29";
import { onThisDayToday, recentTrophies } from "./memories-view.js?v=4.29";
import { rhythmInsights, durationLabel } from "../insights.js?v=4.29";
import { care, facts, fridge, room, sync } from "./services.js?v=4.29";
import { setTab, showPhotos } from "./nav.js?v=4.29";
import { pantryHTML } from "./pantry-view.js?v=4.29";
import { QUALITY } from "../pantry.js?v=4.29";
import { finishWalk, log } from "./logging.js?v=4.29";
import {
  $,
  TYPES,
  face,
  active,
  clock,
  dayKey,
  esc,
  person,
  when,
} from "./format.js?v=4.29";
import { html, toast } from "./ui.js?v=4.29";
import { detail, entry, eventLabel, hydratePhotos } from "./entries.js?v=4.29";
import { legacyDiff } from "./settings.js?v=4.29";
import { renderLastTimes, renderStory } from "./library.js?v=4.29";
import { state } from "./state.js?v=4.29";
import { ROUTINE, lastRoutine } from "../routine.js?v=4.29";
import { suppliesHTML } from "./supplies-view.js?v=4.29";
import { trainingHTML } from "./trainer.js?v=4.29";
import { openGraduation } from "./room-memory-view.js?v=4.29";
import { openCloset } from "./room-closet.js?v=4.29";

let shownWeather = 0;
let roomReady = false,
  wallKey = null;
export function roomObject(what) {
  if (what === "lights") {
    room.setLights(!room.lights);
    try { localStorage.setItem("winnie:room-lights", room.lights ? "on" : "off"); } catch { /* Lighting still works without persistence. */ }
    return renderRoomLights();
  }
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
    const t = getTimes(new Date(), 37.7749, -122.4194),
      w = cachedWeather(),
      words = weatherWords(weatherKind(w), w);
    toast(
      `${words ? words + " · " : ""}Sunrise ${clock(+t.sunrise)} · Sunset ${clock(+t.sunset)}`,
    );
  }
  if (what === "toy") return room.react("toy");
  if (what === "ribbon") return openGraduation();
  if (what === "closet") return openCloset();
  if (what === "shelf") return showPhotos("memories");
}
function renderRoomLights() {
  const button = $("room-lights");
  button.setAttribute("aria-pressed", String(room.lights));
  button.title = room.lights ? "Turn room lights off" : "Turn room lights on";
}
function updateWall(profile) {
  const p = fridgeState(profile).photo,
    key = p ? p.photoId : "default";
  if (key === wallKey) return;
  wallKey = key;
  const img = new Image();
  img.onload = () => { if (wallKey === key) room.setPhoto(img); if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src); };
  if (p)
    sync
      .photo(p.photoId)
      .then((blob) => (img.src = URL.createObjectURL(blob)))
      .catch(() => (img.src = "/photos/winnie-wall.jpg"));
  else img.src = "/photos/winnie-wall.jpg";
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
  const list = theirs
    .slice(0, 3)
    .map((e) => `${eventLabel(e).toLowerCase()} ${clock(e.time)}`)
    .join(", ");
  dialogue(
    newest.loggedBy,
    `Logged ${list}${theirs.length > 3 ? ` and ${theirs.length - 3} more` : ""}`,
    newest.id,
  );
}
// A Stardew-style dialogue box in the room when the other person logs something.
let dialogueTimer = 0;
function dialogue(who, text, eventId) {
  const box = $("partner-box");
  box.innerHTML = `<img class="dlg-face" src="/photos/${who}-pixel.png" alt=""><span class="dlg-text"><b>${esc(person(who))}</b><span>${esc(text)}</span></span>`;
  box.setAttribute("aria-label", `${person(who)}: ${text}. Open entry`);
  box.hidden = false;
  box.onclick = () => {
    box.hidden = true;
    detail(eventId);
  };
  clearTimeout(dialogueTimer);
  dialogueTimer = setTimeout(() => (box.hidden = true), 7000);
}
// After a poop, one tap records how it was. Shown for 30 minutes, until tagged.
function renderQuality(events) {
  const poop = latestCare(events).poop;
  const show =
    poop &&
    Date.now() - poop.time < 30 * 60000 &&
    !QUALITY.some((q) => poop.tags?.includes(q));
  $("poop-quality").hidden = !show;
  if (!show) return;
  html(
    "poop-quality",
    `<span class="sq" style="--c:var(--poop)">${icon("poop", "ic sm")}</span><span class="q-label">${clock(poop.time)}</span><span class="seg">${QUALITY.map((q) => `<button class="px btn" data-quality="${q}" data-id="${esc(poop.id)}">${q[0].toUpperCase() + q.slice(1)}</button>`).join("")}</span>`,
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
  $("person-name").innerHTML =
    face(sync.session.person, "hud-portrait") || esc(me[0]);
  $("settings").setAttribute("aria-label", `Settings. This phone is ${me}'s`);
  const s = sync.lastError
    ? navigator.onLine ? "review" : "offline"
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
        ? sync.lastError ? "Sync needs attention" : `${errors.length} to review`
        : s === "pending"
          ? sync.busy
            ? "Sending"
            : `${pending} not sent`
          : sync.lastChecked
            ? "Up to date"
            : "Opening";
  $("sync-chip").setAttribute("aria-label", "Sync status: " + $("sync-status").textContent + ". Open sync details");
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
      outfit: view.profile.roomOutfit || 'bandanna',
      sleep: sleeping && now - sleeping.time < 36 * 3600000 ? sleeping.type : null,
      walk: !!walk && now - walk.time < 36 * 3600000,
      notes: fridgeState(view.profile).notes.filter((n) => onFridge(n)).length,
      pending,
      error: errors.length > 0,
      due: dueToday(view),
      weather: cachedWeather(),
      trophies: Math.min(3, recentTrophies()),
    },
    { instant: !roomReady },
  );
  roomReady = true;
  renderRoomLights();
  refreshWeather().then((w) => {
    if (w && w.at !== shownWeather) {
      shownWeather = w.at;
      room.set({ weather: w });
    }
  });
  greetPartner(events);
  hydratePhotos();
  if (state.tab === "plans") {
    html("supplies", suppliesHTML());
    html("training-visits", trainingHTML());
    html("pantry", pantryHTML());
    care.render();
  }
  if (["history", "insights"].includes(state.tab)) {
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
  const stale = run && now - run.time >= 36 * 3600000;
  // Something running: the status line says so and finishing it is one tap.
  $("room-status").classList.toggle("running", !!run);
  $("room-status").innerHTML = stale
    ? `<span class="grow"><b>Unfinished ${run.type === "walk" ? "walk" : "sleep"} entry</b><span class="status-last">Started ${when(run.time)}</span></span><button class="px btn" data-edit="${esc(run.id)}">Correct time</button>`
    : run
    ? `<span class="sq run-ic" style="--c:${typeColor(run.type)}" aria-hidden="true">${icon(typeIcon(run.type), "ic sm")}</span><span class="grow"><b>${run.type === "walk" ? "Walk timer running" : run.type === "nap" ? "Nap timer running" : "Sleep timer running"}</b> <span>${durationLabel(Math.max(1, Math.round((now - run.time) / 60000)))}${run.loggedBy ? `<span class="status-person">${face(run.loggedBy, "xs")}${esc(person(run.loggedBy))}</span>` : ""}</span></span><button class="px btn" data-act="${run.type === "walk" ? "finish-walk" : "end-sleep"}">${run.type === "walk" ? "Finish walk" : run.type === "nap" ? "End nap" : "End sleep"}</button>`
    : last ? `<span class="status-last">${esc(eventLabel(last))} ${elapsed(last.time).toLowerCase()}${last.loggedBy ? `, logged by ${esc(person(last.loggedBy))}` : ""}.</span>` : `<span>No care logged yet</span>`;
  $("room").setAttribute(
    "aria-label",
    run && !stale
      ? `${run.type === "walk" ? "Walk" : "Sleep"} timer started ${clock(run.time)}`
      : "Winnie’s room",
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
      meta = l ? elapsed(t) : "";
    return `<button class="px tile" style="--c:var(--${type})" data-log="${type}" aria-label="Log ${type}. Last ${esc(tm)}"><span class="top">${icon(type)}<span class="nm">${TYPES[type][1]}</span><span class="act">+ Log</span></span><span class="tm">${tm}</span><span class="tile-footer">${l?.loggedBy ? face(l.loggedBy, "tile-face") : ""}<span><span class="meta">${meta}</span>${l?.pending ? '<span class="pending-dot">Not sent</span>' : ""}${l?.loggedBy ? `<span class="tile-person">${esc(person(l.loggedBy))}</span>` : ""}</span></span>${type === "poop" ? poopHint(events) : ""}</button>`;
  };
  html("care-actions", tile("pee") + tile("poop"));
  renderQuality(events);
  const meal = latest.meal;
  html(
    "log-row",
    [
      `<button class="px chip" style="--c:var(--meal)" data-log="meal" aria-label="Log meal">${icon("meal")}Meal${meal ? `<small>${dayKey(meal.time) === dayKey(now) ? clock(meal.time) : elapsed(meal.time)}</small><small>${dayKey(meal.time) === dayKey(now) ? elapsed(meal.time) : ""}${meal.loggedBy ? `<span class="chip-person">${esc(person(meal.loggedBy))}</span>` : ""}</small>` : ""}</button>`,
      `<button class="px chip" style="--c:var(--photo)" data-act="photo">${icon("photo")}Photo</button>`,
      `<button class="px chip" data-act="earlier">${icon("earlier")}Earlier</button>`,
      `<button class="px chip" data-act="more">${icon("more")}More</button>`,
    ].join(""),
  );
  renderAlso(events);
  html(
    "routine-care",
    `<div class="card-head"><h2 id="routine-title">Care</h2><button class="text-button" data-care-action="new">Set reminder</button></div><div class="routine-list">${ROUTINE.map(
      ([title, glyph]) => {
        const last = lastRoutine(events, title),
          days = last
            ? Math.round(
                (Date.parse(dayKey(now) + "T12:00Z") -
                  Date.parse(dayKey(last.time) + "T12:00Z")) /
                  86400000,
              )
            : null,
          age =
            days === null
              ? "Not logged yet"
              : days === 0
                ? "Today"
                : days === 1
                  ? "Yesterday"
                  : `${days} days ago`;
        return `<div class="routine-row">${icon(glyph, "ic sm")}<div class="routine-copy"><b>${title}</b>${last ? `<button class="routine-last" data-open="${esc(last.id)}" aria-label="Last ${title.toLowerCase()}: ${age}">${age}</button>` : `<span class="muted">${age}</span>`}</div><button class="routine-done" data-groom="${title}" aria-label="Record ${title.toLowerCase()}">Done</button></div>`;
      },
    ).join("")}</div>`,
  );
  fridge.render();
  onThisDayToday(events);
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
      .join("")}</div>`,
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
  $("day-summary").innerHTML = ["pee", "poop", "meal"]
    .map(
      (type) =>
        `<span><strong>${count(type)}</strong> ${type === "meal" && count(type) !== 1 ? "meals" : type}</span>`,
    )
    .join("");
  html(
    "timeline",
    day.length
      ? day.map((event) => entry(event, { photoRecord: true })).join("")
      : `<div class="empty"><p>Nothing logged ${isToday ? "yet today" : "this day"}.</p></div>`,
  );
}
