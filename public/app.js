import { recordedPatterns } from "./insights.js?v=3";
import { WinnieSync } from "./sync.js?v=3";
if (["localhost", "127.0.0.1"].includes(location.hostname))
  document.querySelectorAll('img[src^="/.netlify/images"]').forEach((img) => {
    img.src = new URL(img.src).searchParams.get("url");
  });
const $ = (id) => document.getElementById(id),
  sync = new WinnieSync();
const TYPES = {
  pee: ["💧", "Pee"],
  poop: ["💩", "Poop"],
  meal: ["🍽", "Meal"],
  nap: ["☾", "Nap"],
  slumber: ["☾", "Night sleep"],
  walk: ["🐾", "Walk"],
  outing: ["☀", "Outing"],
  enrichment: ["🦴", "Enrichment"],
  medication: ["💊", "Medication"],
  vomit: ["◌", "Vomit"],
  episode: ["⚑", "Episode"],
  appointment: ["▤", "Appointment"],
  travel: ["✈", "Travel"],
  covered_gap: ["♡", "Care cover"],
  note: ["✎", "Note"],
  moment: ["▧", "Moment"],
};
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const person = (id) =>
  ({ brandon: "Brandon", kim: "Kim" })[id] || "Shared history";
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
let patternDays = 28;
let tab = "today",
  filter = "moments",
  limit = 60,
  poopId = null,
  photoTarget = null,
  lastUndo = null,
  actionLock = 0,
  formPhotos = [],
  formType = null,
  detailId = null,
  dialogReturn = null;
const photoURLs = new Map(),
  photoLoading = new Set();
let toastTimer;
$("day-picker").value = dayKey(Date.now());
document.body.classList.toggle(
  "quiet",
  localStorage.getItem("winnie:quiet") === "true",
);
function toast(message, undo = null) {
  $("toast-text").textContent = message;
  $("toast").hidden = false;
  $("undo").hidden = !undo;
  lastUndo = undo;
  clearTimeout(toastTimer);
  if (!undo)
    toastTimer = setTimeout(() => {
      $("toast").hidden = true;
    }, 7000);
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
  dialogReturn = document.activeElement;
  $("dialog-content").innerHTML = html;
  detailId = null;
  if (!$("dialog").open) $("dialog").showModal();
}
function closeDialog() {
  $("dialog").close();
  detailId = null;
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
    toast("Undo saved on this device.");
  } finally {
    $("undo").disabled = false;
  }
});
function setTab(next) {
  tab = next;
  $("today-view").hidden = tab !== "today";
  $("story-view").hidden = tab !== "story";
  for (const t of ["today", "story"]) {
    $(`${t}-tab`).classList.toggle("selected", t === tab);
    if (t === tab) $(`${t}-tab`).setAttribute("aria-current", "page");
    else $(`${t}-tab`).removeAttribute("aria-current");
  }
  render();
}
$("today-tab").onclick = () => setTab("today");
$("story-tab").onclick = () => setTab("story");
$("day-picker").onchange = render;
$("retry").onclick = () => sync.flush();
function html(id, value) {
  if ($(id).innerHTML !== value) $(id).innerHTML = value;
}
function facts() {
  return sync
    .view()
    .events.filter((e) => !e.deletedAt)
    .sort((a, b) => b.time - a.time);
}
function render() {
  const paired = !!sync.session;
  $("connect").hidden = paired;
  $("experience").hidden = !paired;
  if (!paired) return;
  const view = sync.view(),
    events = facts(),
    pending = sync.data.queue.length,
    errors = sync.data.queue.filter((q) => q.error),
    oldCount = legacyDiff().length;
  $("person-name").textContent = person(sync.session.person);
  $("sync-status").textContent =
    sync.lastError ||
    (pending
      ? `${pending} ${pending === 1 ? "action" : "actions"} saved on this device · ${errors.length ? "review needed" : sync.busy ? "sharing…" : "waiting to share"}`
      : sync.lastChecked
        ? `Shared log checked ${when(sync.lastChecked)}`
        : "Opening our shared day…");
  document
    .querySelector(".sync-line")
    .classList.toggle("offline", !!sync.lastError || !!pending);
  $("pending-banner").hidden = !errors.length && !oldCount;
  if (errors.length || oldCount)
    $("pending-banner").innerHTML =
      `${errors.length ? `${errors.length} saved changes need review. ` : ""}${oldCount ? `${oldCount} older phone entries to review. ` : ""}<button data-act="review">Review saved changes</button>`;
  $("today-date").textContent = new Date()
    .toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    .toUpperCase();
  const sleeping = events.find(
    (e) => ["nap", "slumber"].includes(e.type) && active(e),
  );
  $("hero-caption").textContent = sleeping
    ? `Sleep started at ${clock(sleeping.time)}.`
    : view.profile.withPerson
      ? `${person(view.profile.withPerson)} is with Winnie.`
      : "Latest care, in one place.";
  const icons = {
    pee: '<svg viewBox="0 0 24 24"><path d="M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/><path d="M8 15c0 2 1 3 3 3"/></svg>',
    poop: "💩",
    meal: '<svg viewBox="0 0 24 24"><path d="M3 10h18c0 6-3 9-9 9s-9-3-9-9Z"/><path d="M8 6V3m4 3V2m4 4V3M5 21h14"/></svg>',
    sleep:
      '<svg viewBox="0 0 24 24"><path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z"/><path d="M17 2v4m-2-2h4"/></svg>',
  };
  html(
    "care-actions",
    ["pee", "poop", "meal", "sleep"]
      .map((type) => {
        const last =
          type === "sleep"
            ? events.find((e) => ["nap", "slumber"].includes(e.type))
            : events.find((e) => e.type === type);
        const label =
          type === "sleep"
            ? sleeping
              ? sleeping.type === "nap"
                ? "End nap"
                : "End night sleep"
              : "Start night sleep"
            : `Log ${type}`;
        return `<button class="care-tile ${type}" data-log="${type}"><span class="tile-icon" aria-hidden="true">${icons[type]}</span><span class="tile-plus" aria-hidden="true">${type === "sleep" && sleeping ? "↗" : "＋"}</span><span class="tile-label">${label}</span><span class="tile-last">${last ? `${type === "sleep" && sleeping ? "Started" : type === "sleep" && last.end_time ? "Ended" : "Last"} ${esc(when(type === "sleep" && last.end_time ? last.end_time : last.time))} · ${last.loggedBy ? esc(person(last.loggedBy)) : "shared log"}` : "Ready when he is"}</span></button>`;
      })
      .join(""),
  );
  const walk = events.find((e) => e.type === "walk" && active(e)),
    showWalk = localStorage.getItem("winnie:walks") === "true" || walk;
  $("walk-card").hidden = !showWalk;
  if (showWalk)
    $("walk-card").innerHTML =
      `<div class="section-heading"><h2>${walk ? "Out for a walk" : "A walk, together"}</h2><span aria-hidden="true">🐾</span></div><p class="fine">${walk ? `Started ${clock(walk.time)} · ${esc(person(walk.loggedBy))}` : "An optional way to let each other know you’re out."}</p><div class="button-row"><button class="secondary small" data-act="${walk ? "finish-walk" : "start-walk"}">${walk ? "Finish walk" : "Start walk"}</button>${walk ? '<button class="text-button" data-log="pee">Log pee</button><button class="text-button" data-log="poop">Log poop</button>' : ""}</div>`;
  const p = view.profile;
  $("plan-card").hidden = !p.routine && !p.goal && !p.withPerson;
  if (!$("plan-card").hidden)
    $("plan-card").innerHTML =
      `<div class="section-heading"><h2>What works for him</h2><button class="text-button" data-act="plan">Edit</button></div>${p.routine ? `<p>${esc(p.routine)}</p>` : ""}${p.goal ? `<div class="plan-line"><span class="mini-label">WE’RE PRACTICING</span><p>${esc(p.goal)}</p></div>` : ""}${p.withPerson ? `<p class="fine">${esc(person(p.withPerson))} is with Winnie.</p>` : ""}`;
  const day = events.filter((e) => dayKey(e.time) === $("day-picker").value);
  $("day-summary").textContent = ["pee", "poop", "meal"]
    .map(
      (t) =>
        `${day.filter((e) => e.type === t).length} ${t}${day.filter((e) => e.type === t).length === 1 ? "" : "s"}`,
    )
    .join(" · ");
  html(
    "timeline",
    day.length
      ? day.map(entry).join("")
      : '<div class="empty"><p>No entries for this day yet.</p></div>',
  );
  if (poopId) {
    const e = view.events.find((e) => e.id === poopId && !e.deletedAt);
    $("photo-prompt").hidden = !e;
    if (e)
      $("poop-save-state").textContent = e.pending
        ? "Poop saved on this phone. Photo optional."
        : "Poop saved to your shared log. Photo optional.";
  }
  renderTrainer(events);
  if (tab === "story") renderStory();
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
  return `<button class="entry" data-open="${esc(e.id)}"><span class="entry-symbol" aria-hidden="true">${TYPES[e.type]?.[0] || "•"}</span><span class="entry-body"><span class="entry-title">${esc(eventLabel(e))}${e.photos?.length ? ` · ▧ ${e.photos.length}` : ""}</span><span class="entry-note">${esc(e.note || [e.loggedBy ? person(e.loggedBy) : "Shared history", duration, ...(e.tags || [])].filter(Boolean).join(" · "))}</span></span><span class="entry-time">${clock(e.time)}${e.pending ? '<br><span class="pending-dot">Pending</span>' : ""}</span></button>`;
}
function renderStory() {
  $("story-tools").hidden = filter === "patterns";
  if (filter === "patterns") {
    renderPatterns();
    return;
  }

  let events = facts();
  const query = $("story-search").value.toLowerCase().trim();
  if (filter === "moments")
    events = events.filter((e) => e.type === "moment" || e.photos?.length);
  if (filter === "poop")
    events = events.filter((e) => e.type === "poop" && e.photos?.length);
  if (query)
    events = events.filter((e) =>
      `${e.note || ""} ${eventLabel(e)} ${e.location || ""} ${(e.tags || []).join(" ")} ${person(e.loggedBy)}`
        .toLowerCase()
        .includes(query),
    );
  if ($("history-type").value)
    events = events.filter((e) => e.type === $("history-type").value);
  if ($("history-from").value)
    events = events.filter((e) => dayKey(e.time) >= $("history-from").value);
  if ($("history-to").value)
    events = events.filter((e) => dayKey(e.time) <= $("history-to").value);
  $("story-count").textContent =
    filter === "poop"
      ? `${events.reduce((n, e) => n + (e.photos?.length || 0), 0)} ${events.reduce((n, e) => n + (e.photos?.length || 0), 0) === 1 ? "photo" : "photos"} · ${events.length} ${events.length === 1 ? "entry" : "entries"}`
      : `${events.length.toLocaleString()} ${filter === "care" ? "entries" : "moments"}`;
  $("load-more").hidden = events.length <= limit;
  if (!events.length) {
    $("story-items").innerHTML =
      `<div class="empty card"><div class="big">${filter === "poop" ? "💩" : "♡"}</div><h3>${filter === "poop" ? "His finest work." : filter === "care" ? "Nothing here yet." : "The moments we’ll keep."}</h3><p>${query ? "Try a different search." : filter === "poop" ? "Add a photo after logging a poop, or open an older poop entry and add one there." : "A funny face. A little milestone. An ordinary afternoon with our boy."}</p><div class="button-row"><button class="secondary small" data-act="${filter === "poop" ? "find-poop" : "moment"}">${filter === "poop" ? "Find a poop entry" : "Add a moment"}</button></div></div>`;
    return;
  }
  if (filter === "care") {
    $("story-items").innerHTML = events
      .slice(0, limit)
      .map(
        (e, i, a) =>
          `${i === 0 || dayKey(e.time) !== dayKey(a[i - 1].time) ? `<p class="eyebrow" style="margin:23px 0 10px">${dateLabel(e.time)}</p>` : ""}${entry(e)}`,
      )
      .join("");
    return;
  }
  $("story-items").innerHTML = `<div class="photo-grid">${events
    .slice(0, limit)
    .flatMap((e) =>
      (filter === "poop" ? e.photos || [] : [e.photos?.[0] || null]).map(
        (photo) =>
          `<button class="memory-card" data-open="${esc(e.id)}">${photo ? `<img data-photo="${esc(photo.id)}" alt="${esc(filter === "poop" ? "Winnie’s poop photo" : e.note || "A moment with Winnie")}" loading="lazy">` : '<div class="empty big">♡</div>'}<div><strong>${esc(e.note || (e.type === "poop" ? "His finest work." : "A little moment with Winnie."))}</strong><small>${dateLabel(e.time)}${e.pending ? " · Pending" : ""}</small></div></button>`,
      ),
    )
    .join("")}</div>`;
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
for (const id of ["story-search", "history-type", "history-from", "history-to"])
  $(id).addEventListener(id === "story-search" ? "input" : "change", () => {
    limit = 60;
    renderStory();
  });
$("load-more").onclick = () => {
  limit += 60;
  renderStory();
};
document.querySelectorAll("[data-filter]").forEach(
  (button) =>
    (button.onclick = () => {
      filter = button.dataset.filter;
      limit = 60;
      $("history-type").value = "";
      document
        .querySelectorAll("[data-filter]")
        .forEach((b) => b.classList.toggle("selected", b === button));
      renderStory();
    }),
);
async function log(type) {
  if (Date.now() - actionLock < 600) return;
  actionLock = Date.now();
  if (type === "sleep" || type === "nap") {
    const sleeping = facts().find(
      (e) => ["nap", "slumber"].includes(e.type) && active(e),
    );
    if (sleeping) {
      openDialog(
        `<h2 id="dialog-title">Finished sleeping?</h2><p class="fine">Started ${dateLabel(sleeping.time)} at ${clock(sleeping.time)}.</p><div class="button-row"><button class="primary" data-end="${esc(sleeping.id)}">End sleep now</button><button class="secondary" data-act="close">Keep sleeping</button></div><p id="form-error" class="error" role="alert"></p>`,
      );
      return;
    }
    if (type === "sleep") type = "slumber";
  }
  const eventId = uid();
  await sync.enqueue("create", eventId, {
    type,
    time: Date.now(),
    end_time: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    who: "us",
    tags: [],
    note: "",
    time_precision: "exact",
  });
  document.body.classList.remove("reaction");
  requestAnimationFrame(() => document.body.classList.add("reaction"));
  toast(`${TYPES[type][1]} saved on this device.`, () =>
    sync.enqueue("delete", eventId),
  );
  if (type === "poop") {
    poopId = eventId;
    $("photo-prompt").hidden = false;
    render();
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
    `<h2 id="dialog-title">${TYPES[e.type]?.[0] || "•"} ${esc(eventLabel(e))}</h2><p class="fine">${dateLabel(e.time)} · ${clock(e.time)}${e.end_time != null ? ` → ${dateLabel(e.end_time)} ${clock(e.end_time)}` : ""}</p><p class="fine">${e.loggedBy ? `Logged by ${esc(person(e.loggedBy))}` : "Original shared history · person not recorded"}${e.pending ? " · Waiting to share" : ""}</p>${e.end_time != null && e.end_time < e.time ? '<p class="error">This historical end time is before its start. You can correct it below; its original value has been preserved.</p>' : ""}<div class="detail-meta">${(e.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join("")}${e.who && e.who !== "us" ? `<span class="pill">Care by ${esc(e.who)}</span>` : ""}${e.signal ? `<span class="pill">${esc(e.signal)}</span>` : ""}</div>${e.note ? `<p class="detail-notes">${esc(e.note)}</p>` : ""}${e.location ? `<p class="fine">${esc(e.location)}</p>` : ""}<div class="button-row"><button class="primary small" data-photo-camera="${esc(id)}">Take photo</button><button class="secondary small" data-photo-library="${esc(id)}">Choose photo</button><button class="text-button" data-edit="${esc(id)}">Edit entry</button></div>${["pee", "poop"].includes(e.type) ? `<h3>Who initiated the trip?</h3><div class="signal-buttons">${["He asked", "We took him out"].map((s) => `<button data-signal="${s}" data-id="${esc(id)}" class="${e.signal === s ? "selected" : ""}">${s}</button>`).join("")}</div>` : ""}${(e.photos || []).map((p) => `<img class="detail-photo" data-photo="${esc(p.id)}" alt="${esc(e.type === "poop" ? "Winnie’s poop photo" : "A moment with Winnie")}"><div class="photo-actions"><button class="text-button" data-download-photo="${esc(p.id)}">Save photo</button><button class="text-button danger" data-remove-photo="${esc(p.id)}" data-id="${esc(id)}">Remove from entry</button></div>`).join("")}<div class="button-row"><button class="text-button danger" data-delete="${esc(id)}">Remove entry</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
  detailId = id;
  hydratePhotos();
}
function editForm(type = "note", id = null) {
  const e = id
    ? sync.view().events.find((e) => e.id === id)
    : { type, time: Date.now(), end_time: null, note: "", who: "us", tags: [] };
  if (!e) return;
  const eventId = id || uid();
  let savedRevision = id ? e.revision : undefined;
  let entrySaved = false;
  formPhotos = [];
  formType = e.type;
  openDialog(
    `<h2 id="dialog-title">${id ? "Edit entry" : e.type === "moment" ? "Keep a little moment" : "Log an earlier entry"}</h2><form id="event-form"><label>What happened?<select name="type">${Object.entries(
      TYPES,
    )
      .map(
        ([t, [, l]]) =>
          `<option value="${t}" ${e.type === t ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><label>When<input name="time" type="datetime-local" value="${dateTime(e.time)}" required></label><label id="end-label" ${["nap", "slumber", "walk", "outing", "episode", "appointment", "travel", "covered_gap"].includes(e.type) ? "" : "hidden"}>End time <span class="fine">(leave empty if in progress)</span><input name="end_time" type="datetime-local" value="${e.end_time ? dateTime(e.end_time) : ""}"></label><label>${e.type === "moment" ? "Caption" : "Note"} <span class="fine">(optional)</span><textarea name="note" maxlength="10000" placeholder="A little detail to remember…">${esc(e.note || "")}</textarea></label><details><summary class="fine">More details</summary><label>Who provided care?<select name="who">${["us", "trainer", "sitter", "unknown"].map((w) => `<option value="${w}" ${e.who === w ? "selected" : ""}>${w === "us" ? "Us" : w}</option>`).join("")}</select></label><label>Tags <span class="fine">(separate with commas)</span><input name="tags" value="${esc((e.tags || []).join(", "))}" placeholder="outdoors, self-signaled"></label><label>Place<input name="location" maxlength="500" value="${esc(e.location || "")}"></label><label>Time accuracy<select name="time_precision">${["exact", "approx", "unknown"].map((t) => `<option ${e.time_precision === t ? "selected" : ""}>${t}</option>`).join("")}</select></label></details>${!id ? '<div class="button-row"><button type="button" class="secondary small" data-form-camera>Take photo</button><button type="button" class="secondary small" data-form-library>Choose photos</button></div><p id="form-photo-status" class="fine"></p>' : ""}<p id="form-error" class="error" role="alert"></p><div class="button-row"><button type="submit" class="primary">${id ? "Save changes" : "Save entry"}</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`,
  );
  const f = $("event-form");
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
          location: input.get("location"),
          time_precision: input.get("time_precision"),
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
        "Entry saved on this device.",
        id ? null : () => sync.enqueue("delete", eventId),
      );
      if (payload.type === "poop") {
        poopId = eventId;
        render();
      }
    } finally {
      submit.disabled = false;
    }
  });
}
function moreCare() {
  openDialog(
    `<h2 id="dialog-title">A little more care</h2><div class="type-grid"><button data-act="trainer">Trainer · log finished hour</button><button data-log="nap">☾ Start nap</button>${Object.entries(
      TYPES,
    )
      .filter(
        ([t]) =>
          !["pee", "poop", "meal", "nap", "slumber", "moment"].includes(t),
      )
      .map(([t, [i, l]]) => `<button data-new-type="${t}">${i} ${l}</button>`)
      .join("")}</div>`,
  );
}
function plan() {
  const p = sync.view().profile;
  openDialog(
    `<h2 id="dialog-title">What works for him</h2><form id="plan-form"><label>Our current routine<textarea name="routine" maxlength="2000" placeholder="The useful things we both want to remember…">${esc(p.routine)}</textarea></label><label>One thing we’re practicing<textarea name="goal" maxlength="2000" placeholder="For example: ring the bell before putting on his harness.">${esc(p.goal)}</textarea></label><label>Who is with Winnie?<select name="withPerson"><option value="">Not set</option>${["brandon", "kim"].map((t) => `<option value="${t}" ${p.withPerson === t ? "selected" : ""}>${person(t)}</option>`).join("")}</select></label><p class="fine">Keep this current together. Clear a temporary instruction when it no longer applies.</p><p id="form-error" class="error" role="alert"></p><div class="button-row"><button class="primary">Save our plan</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`,
  );
  $("plan-form").onsubmit = safe(async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await sync.enqueue(
      "profile",
      "profile",
      {
        routine: f.get("routine"),
        goal: f.get("goal"),
        withPerson: f.get("withPerson"),
      },
      p.revision,
    );
    closeDialog();
    toast("Shared plan saved on this device.");
  });
}
function settings() {
  if (!sync.session) {
    $("shared-code").focus();
    return;
  }
  const devices = sync.data.snapshot.devices || [],
    me = sync.session.token.split(".")[0];
  openDialog(
    `<h2 id="dialog-title">Our little family</h2><div class="setting-block"><p>Using this device as <strong>${person(sync.session.person)}</strong></p><button class="secondary small" data-act="push">Enable partner notifications</button><p id="push-status">Get an update when the other person logs care. On iPhone, open Winnie from your Home Screen.</p></div><div class="setting-block"><button class="secondary small" data-act="plan">Edit our routine & learning goal</button><label class="switch-row">Show optional walk mode<input id="walk-setting" type="checkbox" ${localStorage.getItem("winnie:walks") === "true" ? "checked" : ""}></label><label class="switch-row">Quiet presentation<input id="quiet-setting" type="checkbox" ${document.body.classList.contains("quiet") ? "checked" : ""}></label></div><div class="setting-block"><h3>Our history</h3><p>${sync.data.snapshot.events.filter((e) => !e.deletedAt).length.toLocaleString()} shared entries. Original records keep their original attribution.</p><p>New entries: Brandon ${sync.data.snapshot.usage?.brandon || 0} · Kim ${sync.data.snapshot.usage?.kim || 0}</p><div class="button-row"><button class="secondary small" data-act="export">Export history & pending actions</button><button class="text-button" data-act="review">Review saved phone history</button></div><p>Photos can be saved from each entry. History exports include photo references.</p></div><div class="setting-block"><h3>Connected devices</h3>${devices
      .filter((d) => !d.revoked)
      .map(
        (d) =>
          `<div class="device"><span>${esc(d.name)} · ${person(d.person)}${d.id === me ? " · this device" : ""}</span>${d.id !== me ? `<button class="text-button danger" data-revoke="${esc(d.id)}">Remove</button>` : ""}</div>`,
      )
      .join(
        "",
      )}<button class="text-button" data-act="invite">Show shared code for another device</button></div><div class="setting-block"><button class="text-button" data-act="reconnect">Reconnect as another person</button><p>Pending actions stay with their original shared log.</p></div><p id="form-error" class="error" role="alert"></p>`,
  );
  $("walk-setting").onchange = (e) => {
    localStorage.setItem("winnie:walks", e.target.checked);
    render();
  };
  $("quiet-setting").onchange = (e) => {
    localStorage.setItem("winnie:quiet", e.target.checked);
    document.body.classList.toggle("quiet", e.target.checked);
  };
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
    e.location ? "Place: " + e.location : "",
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
    `<h2 id="dialog-title">Keep every change</h2><p class="fine">Your older phone history is preserved. Choose which differences belong in the shared log.</p>${conflicts.map((q) => `<div class="recovery"><h3>${esc(q.error)}</h3><p class="fine">${esc(q.command.kind)} · ${esc(q.command.payload.note || q.command.payload.type || q.command.eventId)}</p><details><summary>Compare saved changes</summary><p class="fine">Your pending change</p><pre>${esc(compareEntry(q.command.payload))}</pre><p class="fine">Latest shared entry</p><pre>${esc(compareEntry(q.current))}</pre></details><div class="button-row">${!["create", "recover"].includes(q.command.kind) && q.current && !q.current.deletedAt ? `<button class="secondary small" data-resolve="${q.command.operationId}" data-mine="yes">Use my changes</button>` : ""}<button class="text-button" data-resolve="${q.command.operationId}">Keep shared version</button></div></div>`).join("")}${older
      .slice(0, 25)
      .map((e) => {
        const shared = sync.data.snapshot.events.find((x) => x.id === e.id);
        return `<div class="recovery"><h3>${esc(eventLabel(e))} · ${dateLabel(e.time)}</h3><p class="fine">${shared ? "Different from the shared entry" : "Only in this phone’s older copy"} · ${clock(e.time)}</p><details><summary>Compare both versions</summary><p class="fine">Phone copy</p><pre>${esc(compareEntry(e))}</pre><p class="fine">Shared copy</p><pre>${esc(compareEntry(shared))}</pre></details><div class="button-row">${!shared ? `<button class="secondary small" data-recover="${esc(e.id)}">Keep this entry</button>` : !shared.deletedAt ? `<button class="secondary small" data-edit="${esc(e.id)}">Edit shared entry</button>` : `<button class="secondary small" data-restore="${esc(e.id)}">Restore shared entry</button>`}<button class="text-button" data-reviewed="${esc(e.id)}">Keep shared history</button></div></div>`;
      })
      .join(
        "",
      )}${!conflicts.length && !older.length ? '<div class="empty"><h3>All accounted for.</h3><p>No differences need your attention.</p></div>' : ""}${older.length > 25 ? '<p class="fine">More entries will appear as these are reviewed.</p>' : ""}<p id="form-error" class="error" role="alert"></p>`,
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
    toast("Preparing your photo…");
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
      if ($("dialog").open && detailId === target) detail(target);
      render();
    } else toast("Photo ready. Save the entry to keep it.");
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
$("poop-camera").onclick = () => choosePhoto(poopId, true);
$("poop-library").onclick = () => choosePhoto(poopId);
$("poop-dismiss").onclick = () => {
  poopId = null;
  $("photo-prompt").hidden = true;
};
$("earlier").onclick = () => editForm("pee");
$("more").onclick = moreCare;
$("add-moment").onclick = () => editForm("moment");
$("story-add").onclick = () => editForm("moment");
$("settings").onclick = settings;
$("connect-form").onsubmit = safe(async (e) => {
  e.preventDefault();
  $("connect-error").textContent = "";
  const button = e.target.querySelector("[type=submit]");
  button.disabled = true;
  try {
    await sync.pair(
      $("shared-code").value.trim(),
      new FormData(e.target).get("person"),
      $("device-name").value.trim(),
    );
    render();
  } catch (err) {
    $("connect-error").textContent = err.message;
  } finally {
    button.disabled = false;
  }
});
$("shared-code").value = localStorage.getItem("winnie:bin") || "";
document.addEventListener(
  "click",
  safe(async (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.log) {
      if ($("dialog").open) closeDialog();
      return log(b.dataset.log);
    }
    if (b.dataset.open) return detail(b.dataset.open);
    if (b.dataset.patternDay) {
      filter = "care";
      $("history-from").value = b.dataset.patternDay;
      $("history-to").value = b.dataset.patternDay;
      document
        .querySelectorAll("[data-filter]")
        .forEach((x) =>
          x.classList.toggle("selected", x.dataset.filter === filter),
        );
      renderStory();
      return;
    }
    if (b.dataset.edit) return editForm(null, b.dataset.edit);
    if (b.dataset.newType) return editForm(b.dataset.newType);
    if (b.dataset.end) {
      b.disabled = true;
      try {
        await sync.enqueue("edit", b.dataset.end, { end_time: Date.now() });
        closeDialog();
        toast("Sleep end saved on this device.");
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
      toast("Photo removed from this entry.", () =>
        sync.enqueue("attach", b.dataset.id, {
          photoId: b.dataset.removePhoto,
        }),
      );
      return;
    }
    if (b.dataset.delete) {
      const id = b.dataset.delete;
      openDialog(
        `<h2 id="dialog-title">Remove this entry?</h2><p class="fine">You can undo this after removing it.</p><div class="button-row"><button class="primary" data-confirm-delete="${esc(id)}">Remove entry</button><button class="secondary" data-open="${esc(id)}">Keep it</button></div><p id="form-error" class="error"></p>`,
      );
      return;
    }
    if (b.dataset.confirmDelete) {
      const id = b.dataset.confirmDelete;
      await sync.enqueue("delete", id);
      closeDialog();
      toast("Entry removal saved on this device.", () =>
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
      case "plan":
        plan();
        break;
      case "moment":
        editForm("moment");
        break;
      case "all-history":
        filter = "care";
        $("history-from").value = "";
        $("history-to").value = "";
        $("history-type").value = "";
        document
          .querySelectorAll("[data-filter]")
          .forEach((x) =>
            x.classList.toggle("selected", x.dataset.filter === filter),
          );
        renderStory();
        break;
      case "find-poop":
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
        await logTrainer();
        break;
      case "start-walk":
        await log("walk");
        break;
      case "finish-walk": {
        const e = facts().find((e) => e.type === "walk" && active(e));
        if (e) {
          await sync.enqueue("edit", e.id, { end_time: Date.now() });
          toast("Walk finish saved on this device.");
        }
        break;
      }
      case "push":
        b.disabled = true;
        try {
          await sync.enablePush();
          $("push-status").textContent =
            "Partner notifications are enabled on this device.";
        } finally {
          b.disabled = false;
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
          `<h2 id="dialog-title">Connect another device</h2><p class="fine">Open Winnie on the other device and enter this shared code. Choose the person using that device.</p><input readonly aria-label="Shared code" value="${esc(sync.session.code)}"><p class="fine">Keep this code within your family.</p>`,
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
sync.addEventListener("change", render);
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
  return e.type === "covered_gap" &&
    (e.kind === "trainer" || e.who === "trainer")
    ? "Trainer visit"
    : TYPES[e.type]?.[1] || e.type;
}
function renderTrainer(events) {
  const visits = events.filter(
      (e) =>
        e.type === "covered_gap" &&
        (e.kind === "trainer" || e.who === "trainer") &&
        dayKey(e.time) === dayKey(Date.now()),
    ),
    scheduled = [2, 3, 4].includes(new Date().getDay());
  $("trainer-card").hidden = !scheduled && !visits.length;
  if (!$("trainer-card").hidden)
    html(
      "trainer-card",
      `<div class="section-heading"><h2>Trainer visit</h2><span class="fine">Tue · Wed · Thu</span></div>${visits.length ? `<p class="fine">Logged ${clock(visits[0].time)}–${clock(visits[0].end_time)} · ${esc(person(visits[0].loggedBy))}</p><button class="text-button" data-edit="${esc(visits[0].id)}">Adjust visit</button>` : '<p class="fine">1 hour · ending now</p><div class="button-row"><button class="primary small" data-act="trainer">Log finished visit</button></div>'}`,
    );
}
async function logTrainer() {
  if (Date.now() - actionLock < 600) return;
  actionLock = Date.now();
  const now = Date.now(),
    id = uid();
  await sync.enqueue("create", id, {
    type: "covered_gap",
    kind: "trainer",
    time: now - 3600000,
    end_time: now,
    who: "trainer",
    note: "Trainer visit",
    tags: [],
    time_precision: "approx",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if ($("dialog").open) closeDialog();
  toast("Trainer hour saved. Tap the entry to adjust its time.", () =>
    sync.enqueue("delete", id),
  );
}
function renderPatterns() {
  const p = recordedPatterns(facts(), patternDays),
    max = Math.max(1, ...p.series.map((d) => d.pee + d.poop + d.meal));
  $("story-count").textContent =
    `${p.allCount.toLocaleString()} recorded entries${p.first ? " · since " + dateLabel(p.first) : ""}`;
  $("load-more").hidden = true;
  $("story-items").innerHTML =
    `<section class="card patterns"><div class="section-heading"><h2>What we’ve recorded</h2><label><span class="sr-only">Pattern time window</span><select id="pattern-window"><option value="7" ${patternDays === 7 ? "selected" : ""}>7 days</option><option value="28" ${patternDays === 28 ? "selected" : ""}>28 days</option><option value="90" ${patternDays === 90 ? "selected" : ""}>90 days</option></select></label></div><p class="fine">${p.start} — ${p.end}</p><div class="pattern-stats"><div><strong>${p.activeDays}<small> / ${p.days}</small></strong><span>days with entries</span></div><div><strong>${p.total}</strong><span>entries recorded</span></div></div><h3>Daily care entries</h3><div class="chart-legend"><span>● Pee</span><span>● Poop</span><span>● Meals</span></div><div class="daily-chart" style="--days:${p.days}" aria-label="Daily recorded care. Select a day to see its entries.">${p.series.map((d) => `<button data-pattern-day="${d.date}" title="${d.date}: ${d.pee} pee, ${d.poop} poop, ${d.meal} meal entries" aria-label="${d.date}: ${d.pee} pee, ${d.poop} poop, ${d.meal} meal entries" class="chart-column"><span style="height:${(d.meal / max) * 100}%" class="bar-meal"></span><span style="height:${(d.poop / max) * 100}%" class="bar-poop"></span><span style="height:${(d.pee / max) * 100}%" class="bar-pee"></span></button>`).join("")}</div><div class="chart-labels"><span>${p.start}</span><span>${p.end}</span></div><p class="fine">Blank days mean no entries were recorded. They don’t tell us whether care happened.</p><h3>This period and the previous ${p.days} days</h3><div class="comparison-table"><div class="table-row table-head"><span>Recorded entries</span><span>Previous</span><span>Current</span></div>${Object.entries(
      p.counts,
    )
      .map(
        ([type, count]) =>
          `<div class="table-row"><span>${type === "slumber" ? "Night sleep" : TYPES[type][1]}</span><span>${count.previous}</span><span>${count.current}</span></div>`,
      )
      .join(
        "",
      )}</div><p class="fine">Previous period starts ${p.previousStart}, with entries on ${p.previousActiveDays} of ${p.days} days. Changes in logging habits can change these counts.</p>${p.tagged ? `<h3>Asking to go out</h3><p><strong>${p.selfAsked} of ${p.tagged}</strong> tagged entries record that he asked.</p><p class="fine">Entries without a signal label are excluded.</p>` : ""}${p.invalidSleep ? `<div class="notice" style="margin-top:16px">${p.invalidSleep} historical sleep ${p.invalidSleep === 1 ? "entry has" : "entries have"} an end time that needs review. Original values are preserved; no sleep duration score is inferred.</div>` : ""}<div class="button-row"><button class="text-button" data-act="all-history">Browse the full history →</button></div></section>`;
  $("pattern-window").onchange = (e) => {
    patternDays = Number(e.target.value);
    renderPatterns();
  };
}
