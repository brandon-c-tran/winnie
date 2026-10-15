// Logging: one-tap logs, sleep and walks, grooming, Earlier, meals, More, press-and-hold.
import { careStates, completionId } from "../care-plans.js?v=4.28";
import { elapsed } from "../care-state.js?v=4.28";
import { icon, GROOMING, typeIcon, typeColor } from "../icons.js?v=4.0";
import { durationLabel } from "../insights.js?v=4.28";
import {
  sleepContext,
  foodChoices,
  normalizeFood,
} from "../everyday.js?v=4.28";
import {
  autoPlace,
  autoPlaceEnabled,
  facts,
  room,
  sync,
} from "./services.js?v=4.28";
import {
  $,
  TYPES,
  active,
  clock,
  dateTime,
  esc,
  uid,
} from "./format.js?v=4.28";
import {
  closeDialog,
  retainDialogDraft,
  resumeDialogDraft,
  markDialogDirty,
  draftFields,
  applyDraftFields,
  openDialog,
  renderedHTML,
  safe,
  toast,
} from "./ui.js?v=4.28";
import { editForm } from "./forms.js?v=4.28";
import { render } from "./today.js?v=4.28";
import { state } from "./state.js?v=4.28";
import { rotation, lastEaten, QUALITY } from "../pantry.js?v=4.28";
import { pantryNow, savePantry } from "./pantry-view.js?v=4.28";

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
  if (type === "meal" && !extra.foods) return mealPicker();
  if (type === state.lastLogType && Date.now() - state.actionLock < 600) return;
  state.actionLock = Date.now();
  state.lastLogType = type;
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
  if (type === "poop" && !$("dialog").open) pottyPhoto(eventId, type);
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
  room.react(
    type !== "grooming" ? "heart" : /^bath$/i.test(title) ? "bath" : "groom",
  );
  toast(
    `${type === "grooming" ? title : TYPES[type][1]} logged${approx ? " for today" : " · " + clock(Date.now())}`,
    () => sync.enqueue("delete", eventId),
    [["Add photo", () => pottyPhoto(eventId, type), "photo"]],
  );
  if (!approx) void autoPlace.attach(eventId);
}
export function routineSheet(
  title,
  planId = null,
  initialTime = null,
  restored = null,
) {
  const draftKey = `routine:${sync.session?.home}:${title}:${planId || ""}`;
  if (!restored && resumeDialogDraft(draftKey)) return;
  const candidates =
    restored?.candidates ||
    careStates(sync.view().profile, sync.view().events).filter(
      (s) =>
        !s.paused &&
        s.due &&
        s.plan.type === "grooming" &&
        s.plan.title.trim().toLowerCase() === title.toLowerCase(),
    );
  const selected =
    planId || (candidates.length === 1 ? candidates[0].plan.id : "");
  openDialog(
    `<h2 id="dialog-title">${esc(title)}</h2><form id="routine-form"><fieldset class="routine-when"><legend>When was it done?</legend><div class="button-row"><button type="button" class="px btn" data-routine-time="now" aria-pressed="true">Now</button><button type="button" class="px btn" data-routine-time="yesterday" aria-pressed="false">Yesterday</button><button type="button" class="px btn" data-routine-time="date" aria-pressed="false">Pick date</button></div><label id="routine-date" hidden>Done at<input type="datetime-local" name="time" value="${dateTime(Date.now())}" required></label></fieldset>${candidates.length ? `<label>Reminder to complete<select name="plan"><option value="">Just record care</option>${candidates.map((s) => `<option value="${esc(s.plan.id)}" ${s.plan.id === selected ? "selected" : ""}>${esc(s.plan.title)} — due ${s.due}</option>`).join("")}</select></label>` : ''}<label>Note <span class="fine">(optional)</span><textarea name="note" maxlength="2000"></textarea></label><p id="form-error" class="error" role="alert"></p><div class="button-row"><button class="primary" type="submit">Save ${title.toLowerCase()}</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`,
  );
  const form = $("routine-form");
  let timing = restored?.timing || (initialTime ? "date" : "now");
  if (initialTime) form.elements.time.value = dateTime(initialTime);
  applyDraftFields(form, restored?.fields);
  $("routine-date").hidden = timing !== "date";
  for (const b of form.querySelectorAll("[data-routine-time]"))
    b.setAttribute("aria-pressed", String(b.dataset.routineTime === timing));
  retainDialogDraft(draftKey, undefined, undefined, () => ({
    kind: "routine",
    title,
    planId,
    timing,
    candidates,
    fields: draftFields(form),
  }));
  for (const button of form.querySelectorAll("[data-routine-time]"))
    button.onclick = () => {
      timing = button.dataset.routineTime;
      const time = new Date();
      if (timing === "yesterday") time.setDate(time.getDate() - 1);
      if (timing !== "date") form.elements.time.value = dateTime(+time);
      $("routine-date").hidden = timing !== "date";
      for (const b of form.querySelectorAll("[data-routine-time]"))
        b.setAttribute("aria-pressed", String(b === button));
      if (timing === "date") form.elements.time.focus();
      markDialogDirty();
    };
  form.onsubmit = safe(async (ev) => {
    ev.preventDefault();
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const time =
        timing === "now"
          ? Date.now()
          : new Date(form.elements.time.value).getTime();
      if (!Number.isFinite(time) || time > Date.now() || time <= 0)
        throw Error("Choose when this actually happened.");
      const linked = candidates.find(
        (s) => s.plan.id === form.elements.plan?.value,
      );
      if (linked?.done && time <= linked.done.time)
        throw Error(
          "This is before the last reminder completion. Choose Just record care to save older care.",
        );
      const id = linked ? completionId(linked.plan, linked.due) : uid();
      const payload = {
        type: "grooming",
        careTitle: title,
        time,
        end_time: null,
        note: form.elements.note.value.trim(),
        who: "us",
        tags: [],
        time_precision: timing === "yesterday" ? "approx" : "exact",
        retroactive: timing !== "now",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(linked ? { carePlanId: linked.plan.id, careDue: linked.due } : {}),
      };
      const previous = sync.view().events.find((e) => e.id === id);
      if (previous?.deletedAt) {
        const current = careStates(
          sync.view().profile,
          sync.view().events,
        ).find((s) => s.plan.id === linked.plan.id);
        if (!current || current.paused || current.due !== linked.due)
          throw Error("This reminder changed. Reopen Care to review it.");
        await sync.enqueue("restore", id, {}, previous.revision);
        await sync.enqueue(
          "edit",
          id,
          payload,
          sync.view().events.find((e) => e.id === id).revision,
        );
      } else await sync.enqueue("create", id, payload);
      closeDialog();
      room.react(/^bath$/i.test(title) ? "bath" : "groom");
      toast(title + " saved", () => sync.enqueue("delete", id));
      if (timing === "now") void autoPlace.attach(id);
    } finally {
      button.disabled = false;
    }
  });
}
document.addEventListener("winnie:resume-draft", ({ detail: data }) => {
  if (data?.kind === "routine")
    routineSheet(data.title, data.planId, null, data);
});
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
  if (type === "grooming") return routineSheet("Bath", null, time);
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
    `<h2 id="dialog-title">${type === "grooming" ? "Photo" : TYPES[type][1] + " photo"}</h2><div class="photo-choice"><button class="px" data-photo-camera="${id}">${icon("photo", "ic lg")}Take photo</button><button class="px" data-photo-library="${id}">${icon("photos", "ic lg")}Choose photo</button></div>${
      type === "poop"
        ? `<section class="detail-section"><h3>Consistency</h3><div class="signal-buttons">${QUALITY.map(
            (quality) =>
              `<button data-quality="${quality}" data-id="${esc(id)}" aria-pressed="${
                facts()
                  .find((event) => event.id === id)
                  ?.tags?.includes(quality) || false
              }">${quality[0].toUpperCase() + quality.slice(1)}</button>`,
          ).join("")}</div></section>`
        : ""
    }<p class="fine" id="auto-place-status" data-event="${esc(id)}" role="status">${autoPlaceEnabled() ? "Location is added when this phone allows it." : "Automatic location is off on this phone."}</p><button class="text-button" data-act="close">Not now</button><p id="form-error" class="error" role="alert"></p>`,
  );
}
// Foods in rotation order (eaten longest ago first), with when each was last eaten and what's left.
function mealOptions() {
  const events = facts(),
    pantry = pantryNow(),
    names = foodChoices(events, sync.view().profile.pantry || {});
  const used = names.filter(
    (n) =>
      pantry.foods.some((f) => f.name.toLowerCase() === n.toLowerCase()) ||
      lastEaten(n, events),
  );
  const rest = names.filter((n) => !used.includes(n));
  return [...rotation(used, events), ...rest].map((food) => {
    const t = lastEaten(food, events),
      stock = pantry.foods.find(
        (f) => f.name.toLowerCase() === food.toLowerCase(),
      ),
      d = t ? Math.floor((Date.now() - t) / 86400000) : null;
    const parts = [
      d === null ? "" : d === 0 ? "today" : `${d}d ago`,
      stock ? `${Math.round(stock.left)} left` : "",
    ].filter(Boolean);
    return { food, notes: parts };
  });
}
function mealPicker() {
  const options = mealOptions();
  openDialog(
    `<div class="card-head"><h2 id="dialog-title">Meal</h2><button class="text-button" id="manage-foods">Manage foods</button></div>${options.length ? `<div class="food-grid">${options
      .map(
        ({ food, notes }) =>
          `<button class="px" style="--c:var(--meal)" data-food="${esc(food)}">${esc(food)}${notes.map(note => `<small>${esc(note)}</small>`).join("")}</button>`,
      )
      .join(
        "",
      )}</div>` : '<p class="fine">Foods you log will appear here for next time.</p>'}<form id="custom-food"><label>${options.length ? "Other food" : "Food"}<input name="food" maxlength="40" required placeholder="Food name" autocomplete="off"></label><div class="button-row"><button class="px btn ink" type="submit">Log meal</button><button class="text-button" type="button" data-food-unknown>Log without a food</button></div></form><p id="form-error" class="error" role="alert"></p>`,
  );
  $("manage-foods").onclick = foodOptionsSheet;
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
function foodOptionsSheet() {
  const pantry = sync.view().profile.pantry || {},
    hidden = new Set((pantry.hiddenFoods || []).map(normalizeFood)),
    names = [...new Set([...foodChoices(facts(), { ...pantry, hiddenFoods: [] }), ...hidden])]
      .sort((a, b) => Number(hidden.has(a)) - Number(hidden.has(b)) || a.localeCompare(b));
  openDialog(`<h2 id="dialog-title">Manage foods</h2><p class="fine">Remove foods from the meal picker. Past meals and food stock stay saved.</p><div id="food-options-list">${names.map(name => `<div class="food-row"><div class="food-main"><b>${esc(name)}</b>${hidden.has(name) ? '<small>Removed from picker</small>' : ""}</div><button class="text-button" data-food-option="${esc(name)}" aria-label="${hidden.has(name) ? "Restore" : "Remove"} ${esc(name)}">${hidden.has(name) ? "Restore" : "Remove"}</button></div>`).join("") || '<p>No saved food options yet.</p>'}</div><div class="button-row"><button class="secondary" id="food-options-done">Back to meal</button></div><p id="form-error" class="error" role="alert"></p>`);
  $("food-options-done").onclick = mealPicker;
  $("food-options-list").onclick = safe(async event => {
    const button = event.target.closest("[data-food-option]");
    if (!button) return;
    button.disabled = true;
    const name = button.dataset.foodOption, restoring = hidden.has(name);
    try {
      await savePantry(p => {
        const next = new Set((p.hiddenFoods || []).map(normalizeFood));
        if (restoring) next.delete(name); else next.add(name);
        p.hiddenFoods = [...next];
      });
      foodOptionsSheet();
      const replacement = [...$("food-options-list").querySelectorAll("[data-food-option]")].find(b => b.dataset.foodOption === name);
      replacement?.focus();
      toast(`${name} ${restoring ? "restored" : "removed from picker"}`);
    } finally { button.disabled = false; }
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
const roomActionsHTML = `<details class="room-actions"><summary>Explore the room</summary><div class="button-row">${[
  ["winnie", "Pet Winnie"], ["toy", "Play with toy"], ["photo", "Change wall photo"],
  ["fridge", "Leave a note"], ["calendar", "Open plans"], ["bowl", "Log meal"],
  ["bed", "Sleep timer"], ["door", "Walk timer"], ["window", "Weather and daylight"],
  ["shelf", "Open memories"], ["ribbon", "Training ribbon"], ["closet", "Winnie's closet"]
].map(([action,label]) => `<button class="text-button" data-room-action="${action}">${label}</button>`).join("")}</div></details>`;
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
    `<h2 id="dialog-title">More</h2><section class="sheet-section"><h3>Grooming</h3><div class="type-grid">${GROOMING.map(([t, i]) => `<button class="px" style="--c:var(--groom)" data-groom="${t}">${icon(i)}${t}<small>${lastOf((x) => x.type === "grooming" && (x.careTitle || "").toLowerCase() === t.toLowerCase())}</small></button>`).join("")}</div></section><section class="sheet-section"><h3>Walks and sleep</h3><div class="type-grid"><button class="px" style="--c:var(--walk)" data-act="${walk ? "finish-walk" : "start-walk"}">${icon("walk")}${walk ? "Finish walk" : "Start walk"}</button><button class="px" style="--c:var(--sleep)" data-act="${sleeping ? "end-sleep" : "start-sleep"}">${icon("sleep")}${sleeping ? (sleeping.type === "nap" ? "End nap" : "End sleep") : sleepContext().type === "nap" ? "Start nap" : "Start night sleep"}</button><button class="px" style="--c:var(--walk)" data-new-type="outing">${icon("walk")}Outing</button></div></section><section class="sheet-section"><h3>Health and training</h3><div class="type-grid">${["medication", "enrichment", "appointment", "vomit", "episode", "travel", "covered_gap", "note"].map((t) => `<button class="px" style="--c:${typeColor(t)}" data-new-type="${t}">${icon(typeIcon(t))}${TYPES[t][1]}</button>`).join("")}<button class="px" style="--c:var(--care)" data-act="trainer">${icon("whistle")}Trainer visit</button></div></section>${roomActionsHTML}`,
  );
}
