// Logging: one-tap logs, sleep and walks, grooming, Earlier, meals, More, press-and-hold.
import { elapsed } from "../care-state.js?v=4.7";
import { icon, GROOMING, typeIcon, typeColor } from "../icons.js?v=4.0";
import { durationLabel } from "../insights.js?v=4.7";
import {
  sleepContext,
  foodChoices,
  normalizeFood,
} from "../everyday.js?v=4.7";
import {
  autoPlace,
  autoPlaceEnabled,
  facts,
  room,
  sync,
} from "./services.js?v=4.7";
import { $, TYPES, active, clock, esc, uid } from "./format.js?v=4.7";
import {
  closeDialog,
  openDialog,
  renderedHTML,
  safe,
  toast,
} from "./ui.js?v=4.7";
import { editForm } from "./forms.js?v=4.7";
import { render } from "./today.js?v=4.7";
import { state } from "./state.js?v=4.7";
import { rotation, lastEaten } from "../pantry.js?v=4.7";
import { pantryNow } from "./pantry-view.js?v=4.7";

let mealSubmitting = false;
let pressTimer = 0;
document.addEventListener("pointerdown", (ev) => {
  const b = ev.target.closest("#care-actions [data-log], #log-row [data-log]");
  if (!b) return;
  state.longPressed = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    state.longPressed = true;
    earlierSheet({ type: b.dataset.log });
  }, 480);
});
for (const name of ["pointerup", "pointercancel", "pointerleave"])
  document.addEventListener(name, () => clearTimeout(pressTimer));
document.addEventListener("contextmenu", (ev) => {
  if (ev.target.closest("[data-log]")) ev.preventDefault();
});
export async function log(type, extra = {}) {
  if (type === state.lastLogType && Date.now() - state.actionLock < 600) return;
  state.actionLock = Date.now();
  state.lastLogType = type;
  if (type === "meal" && !extra.foods) return mealPicker();
  if (type === "sleep" || type === "nap" || type === "slumber") {
    const sleeping = facts().find(
      (e) => ["nap", "slumber"].includes(e.type) && active(e),
    );
    if (sleeping) return endSleep(sleeping);
    if (type === "sleep") type = sleepContext().type;
  }
  const eventId = uid();
  state.freshEntry = eventId;
  room.react(["pee", "poop", "meal"].includes(type) ? type : "heart");
  flashTile(type);
  const saved = sync.enqueue("create", eventId, {
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
  const label = TYPES[type][1];
  toast(
    `${["nap", "slumber", "walk"].includes(type) ? label + " started" : label + " logged"} · ${clock(Date.now())}`,
    () => sync.enqueue("delete", eventId).then(() => room.react("undo")),
    ["nap", "slumber", "walk"].includes(type)
      ? []
      : [
          ["Add photo", () => pottyPhoto(eventId, type), "photo"],
          ...(type === "poop"
            ? []
            : [["Add note", () => editForm(null, eventId), "note"]]),
        ],
  );
  await saved;
  void autoPlace.attach(eventId);
  return eventId;
}
function flashTile(type) {
  const b = document.querySelector(
    `#care-actions [data-log="${type}"], #log-row [data-log="${type}"]`,
  );
  if (!b) return;
  b.classList.remove("logged");
  void b.offsetWidth;
  b.classList.add("logged");
  const act = b.querySelector(".act");
  if (act) act.textContent = "Logged";
  setTimeout(() => {
    renderedHTML.delete("care-actions");
    render();
  }, 1100);
}
export async function endSleep(e) {
  await sync.enqueue("edit", e.id, { end_time: Date.now() });
  toast(
    `${TYPES[e.type][1]} ended · ${durationLabel(Math.max(1, Math.round((Date.now() - e.time) / 60000)))}`,
    () => sync.enqueue("edit", e.id, { end_time: null }),
  );
}
export async function finishWalk() {
  const e = facts().find((e) => e.type === "walk" && active(e));
  if (!e) return;
  await sync.enqueue("edit", e.id, { end_time: Date.now() });
  toast(
    `Walk finished · ${durationLabel(Math.max(1, Math.round((Date.now() - e.time) / 60000)))}`,
    () => sync.enqueue("edit", e.id, { end_time: null }),
  );
}
export async function logCare(type, title, approx = false) {
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
  room.react(type !== "grooming" ? "heart" : /^bath$/i.test(title) ? "bath" : "groom");
  toast(
    `${type === "grooming" ? title : TYPES[type][1]} logged${approx ? " for today" : " · " + clock(Date.now())}`,
    () => sync.enqueue("delete", eventId),
    [["Add photo", () => pottyPhoto(eventId, type), "photo"]],
  );
  if (!approx) void autoPlace.attach(eventId);
}
export function earlierSheet(next = {}) {
  state.early = { ...state.early, ...next };
  const types = ["pee", "poop", "meal", "walk", "sleep", "grooming"],
    name = (t) =>
      t === "sleep" ? "Sleep" : t === "grooming" ? "Bath" : TYPES[t][1];
  openDialog(
    `<h2 id="dialog-title">Log earlier</h2><section class="sheet-section"><h3>What</h3><div class="offsets">${types.map((t) => `<button class="px" style="--c:${t === "sleep" ? "var(--sleep)" : typeColor(t)}" aria-pressed="${t === state.early.type}" data-early-type="${t}">${name(t)}</button>`).join("")}</div></section><section class="sheet-section"><h3>When</h3><div class="offsets">${[5, 15, 30, 60, 120, 180].map((m) => `<button class="px" aria-pressed="${m === state.early.ago}" data-early-ago="${m}">${m < 60 ? m + " min" : m / 60 + (m === 60 ? " hour" : " hours")} ago</button>`).join("")}</div></section><div class="button-row"><button class="px btn ink" data-early-save>Log ${name(state.early.type).toLowerCase()} at ${clock(Date.now() - state.early.ago * 60000)}</button><button class="text-button" data-early-form>Pick an exact time</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
}
export async function saveEarlier() {
  const time = Date.now() - state.early.ago * 60000,
    eventId = uid(),
    type =
      state.early.type === "sleep" ? sleepContext(time).type : state.early.type;
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
  state.quickPhotoId = id;
  openDialog(
    `<h2 id="dialog-title">${type === "grooming" ? "Photo" : TYPES[type][1] + " photo"}</h2><p class="fine" id="auto-place-status" data-event="${esc(id)}" role="status">${autoPlaceEnabled() ? "Location is added when this phone allows it." : "Automatic location is off on this phone."}</p><div class="photo-choice"><button class="px" data-photo-camera="${id}">${icon("photo", "ic lg")}Take photo</button><button class="px" data-photo-library="${id}">${icon("photos", "ic lg")}Choose photo</button><button class="text-button" data-act="close">Not now</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
}
// Foods in rotation order (eaten longest ago first), with when each was last eaten and what's left.
function mealOptions() {
  const events = facts(),
    pantry = pantryNow(),
    names = [...new Set([...pantry.foods.map((f) => f.name), ...foodChoices(events)])];
  const used = names.filter((n) => pantry.foods.some((f) => f.name.toLowerCase() === n.toLowerCase()) || lastEaten(n, events));
  const rest = names.filter((n) => !used.includes(n));
  return [...rotation(used, events), ...rest].map((food) => {
    const t = lastEaten(food, events),
      stock = pantry.foods.find((f) => f.name.toLowerCase() === food.toLowerCase()),
      d = t ? Math.floor((Date.now() - t) / 86400000) : null;
    const parts = [d === null ? "" : d === 0 ? "today" : `${d}d ago`, stock ? `${Math.round(stock.left)} left` : ""].filter(Boolean);
    return { food, note: parts.join(" · ") };
  });
}
function mealPicker() {
  openDialog(
    `<h2 id="dialog-title">Meal</h2><div class="food-grid">${mealOptions()
      .map(
        ({ food, note }) =>
          `<button class="px" style="--c:var(--meal)" data-food="${esc(food)}">${esc(food)}${note ? `<small>${esc(note)}</small>` : ""}</button>`,
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
export async function saveMeal(food) {
  if (mealSubmitting) return;
  mealSubmitting = true;
  try {
    state.actionLock = 0;
    const id = await log("meal", { foods: food ? [food] : [] });
    if (id) closeDialog();
  } finally {
    mealSubmitting = false;
  }
}
export function moreCare() {
  const events = facts(),
    sleeping = events.find(
      (e) => ["nap", "slumber"].includes(e.type) && active(e),
    ),
    walk = events.find((e) => e.type === "walk" && active(e)),
    lastOf = (pred) => {
      const e = events.find((x) => x.time <= Date.now() && pred(x));
      return e ? elapsed(e.time) : "Not yet";
    };
  openDialog(
    `<h2 id="dialog-title">More</h2><section class="sheet-section"><h3>Grooming</h3><div class="type-grid">${GROOMING.map(([t, i]) => `<button class="px" style="--c:var(--groom)" data-groom="${t}">${icon(i)}${t}<small>${lastOf((x) => x.type === "grooming" && (x.careTitle || "").toLowerCase() === t.toLowerCase())}</small></button>`).join("")}</div></section><section class="sheet-section"><h3>Walks and sleep</h3><div class="type-grid"><button class="px" style="--c:var(--walk)" data-act="${walk ? "finish-walk" : "start-walk"}">${icon("walk")}${walk ? "Finish walk" : "Start walk"}</button><button class="px" style="--c:var(--sleep)" data-act="${sleeping ? "end-sleep" : "start-sleep"}">${icon("sleep")}${sleeping ? (sleeping.type === "nap" ? "End nap" : "End sleep") : sleepContext().type === "nap" ? "Start nap" : "Start night sleep"}</button><button class="px" style="--c:var(--walk)" data-new-type="outing">${icon("walk")}Outing</button></div></section><section class="sheet-section"><h3>Health and training</h3><div class="type-grid">${["medication", "enrichment", "appointment", "vomit", "episode", "travel", "covered_gap", "note"].map((t) => `<button class="px" style="--c:${typeColor(t)}" data-new-type="${t}">${icon(typeIcon(t))}${TYPES[t][1]}</button>`).join("")}<button class="px" style="--c:var(--care)" data-act="trainer">${icon("whistle")}Trainer visit</button></div></section>`,
  );
}
