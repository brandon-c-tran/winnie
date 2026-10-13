import {
  careDay,
  careStates,
  planState,
  completionId,
  validateCarePlans,
} from "./care-plans.js?v=4.11";
import { ROUTINE } from "./routine.js?v=4.11";
import { icon } from "./icons.js?v=4.0";

export function createCare({
  root,
  sync,
  esc,
  person,
  openDialog,
  closeDialog,
  toast,
  safe,
  detail,
  celebrate,
  attachLocation = () => {},
}) {
  const $ = (id) => document.getElementById(id);
  const date = (day) =>
    new Date(day + "T12:00:00").toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const cadence = (p) =>
    p.unit === "once"
      ? "Once"
      : `Every ${p.every === 1 ? "" : p.every + " "}${p.unit}${p.every === 1 ? "" : "s"}`;
  const states = () => careStates(sync.view().profile, sync.view().events);
  const dueText = (s) =>
    !s.due
      ? "Completed"
      : s.today
        ? "Due today"
        : `${s.overdue ? "Due " : ""}${date(s.due)}`;
  function row(s, compact = false) {
    const p = s.plan;
    return `<article class="care-plan-row ${s.overdue ? "overdue" : ""} ${compact ? "compact" : ""}"><span class="care-plan-icon" aria-hidden="true">${icon(p.type === "medication" ? "pill" : p.type === "appointment" ? "vet" : p.type === "grooming" ? "bath" : p.type === "enrichment" ? "star" : "check", "ic sm")}</span><div class="care-plan-body"><button class="care-plan-title" data-care-action="open" data-plan="${esc(p.id)}">${esc(p.title)}</button><p>${s.paused ? "Paused" : dueText(s)}</p>${!compact ? `<span class="care-plan-cadence">${cadence(p)}</span>` : ""}${s.claimedBy && !s.paused ? `<span class="care-owner"><img class="face xs" src="/photos/${s.claimedBy}-pixel.png" alt="" aria-hidden="true">${esc(person(s.claimedBy))} has it</span>` : ""}</div>${!p.paused && s.due ? `<button class="${compact ? "fridge-done" : "secondary small"}" data-care-action="complete" data-plan="${esc(p.id)}">Done</button>` : ""}</article>`;
  }
  let lastContent = "";
  function render() {
    const all = states(),
      active = all.filter((s) => !s.paused && s.due),
      inactive = all.filter((s) => s.paused || !s.due);
    const content = `<section class="plans-section"><div class="section-heading"><h2>Reminders</h2><button class="text-button" data-care-action="new">Add reminder</button></div>${active.length ? `<div class="care-plan-list">${active.map((s) => row(s)).join("")}</div>` : '<p class="fine">No reminders set.</p>'}${inactive.length ? `<details class="care-inactive"><summary>Paused and finished (${inactive.length})</summary>${inactive.map((s) => row(s)).join("")}</details>` : ""}</section>`;
    if (content !== lastContent) {
      const expanded = root.querySelector(".care-inactive")?.open;
      lastContent = content;
      root.innerHTML = content;
      if (expanded && root.querySelector(".care-inactive"))
        root.querySelector(".care-inactive").open = true;
    }
  }

  function fridgeHTML() {
    const due = states().filter(
      (s) => !s.paused && s.due && s.due <= careDay(),
    );
    if (!due.length) return "";
    return `<div class="care-plan-list">${due
      .slice(0, 2)
      .map((s) => row(s, true))
      .join(
        "",
      )}${due.length > 2 ? `<button class="text-button" data-care-nav="upcoming">${due.length - 2} more due</button>` : ""}</div>`;
  }
  function choosePlan() {
    openDialog(
      `<h2 id="dialog-title">Set a reminder</h2><div class="plan-presets"><button class="px" data-care-template="heartgard">${icon("pill")}Heartgard</button>${ROUTINE.map(([title, glyph]) => `<button class="px" data-care-template="${title}">${icon(glyph)}${title}</button>`).join("")}<button class="px" data-care-template="other">${icon("calendar")}Other reminder</button></div>`,
    );
  }
  function edit(id, template = "other") {
    const profile = sync.view().profile,
      plans = structuredClone(profile.carePlans || []),
      old = plans.find((p) => p.id === id);
    const p = old || {
      id: crypto.randomUUID(),
      title:
        template === "heartgard"
          ? "Heartgard"
          : template === "other"
            ? ""
            : template,
      instructions: "",
      start: careDay(),
      every: 1,
      unit: template === "heartgard" ? "month" : "once",
      type:
        template === "heartgard"
          ? "medication"
          : template === "other"
            ? "appointment"
            : "grooming",
      paused: false,
      claim: null,
    };
    const custom =
      !ROUTINE.some(([title]) => title === p.title) &&
      !/^heartgard$/i.test(p.title);
    openDialog(
      `<h2 id="dialog-title">${old ? "Edit reminder" : p.title || "New reminder"}</h2><form id="care-plan-form"><label>Name<input name="title" maxlength="200" required value="${esc(p.title)}" placeholder="Reminder name"></label>${
        custom
          ? `<label>Kind<select name="type">${[
              ["grooming", "Grooming"],
              ["appointment", "Appointment"],
              ["medication", "Medication"],
              ["enrichment", "Training"],
              ["note", "Other care"],
            ]
              .map(
                ([v, n]) =>
                  `<option value="${v}" ${p.type === v ? "selected" : ""}>${n}</option>`,
              )
              .join("")}</select></label>`
          : `<input type="hidden" name="type" value="${p.type}">`
      }<label>${old ? "First scheduled date" : "Next due"}<input class="plan-date" name="start" type="date" value="${p.start}" required></label><div class="care-repeat"><label>Repeat<select name="unit">${[
        ["once", "Does not repeat"],
        ["day", "Days"],
        ["week", "Weeks"],
        ["month", "Months"],
      ]
        .map(
          ([v, n]) =>
            `<option value="${v}" ${p.unit === v ? "selected" : ""}>${n}</option>`,
        )
        .join(
          "",
        )}</select></label><label id="repeat-every">Every<input type="number" inputmode="numeric" name="every" min="1" max="365" value="${p.every}" required></label></div><label>Notes <span class="fine">Optional</span><textarea name="instructions" maxlength="2000">${esc(p.instructions)}</textarea></label><p id="form-error" class="error" role="alert"></p><div class="button-row"><button class="primary">Save reminder</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`,
    );
    const form = $("care-plan-form"),
      state = old && planState(old, sync.view().events);
    if (state?.done) {
      form.elements.start.disabled = true;
      form.elements.start.closest("label").insertAdjacentHTML("beforeend", "");
    }
    const repeat = () => {
      form.elements.every.disabled = form.elements.unit.value === "once";
      $("repeat-every").hidden = form.elements.unit.value === "once";
    };
    repeat();
    form.elements.unit.onchange = repeat;
    form.onsubmit = safe(async (ev) => {
      ev.preventDefault();
      const button = form.querySelector(".primary");
      button.disabled = true;
      try {
        const f = new FormData(form),
          next = {
            ...p,
            title: f.get("title").trim(),
            type: f.get("type"),
            start: f.get("start") || p.start,
            unit: f.get("unit"),
            every: Number(f.get("every") || 1),
            instructions: f.get("instructions").trim(),
          };
        const updated = old
          ? plans.map((x) => (x.id === id ? next : x))
          : [...plans, next];
        await sync.enqueue(
          "profile",
          null,
          { carePlans: validateCarePlans(updated) },
          profile.revision,
        );
        closeDialog();
        toast("Reminder saved");
      } finally {
        button.disabled = false;
      }
    });
  }
  function open(id) {
    const s = states().find((s) => s.plan.id === id);
    if (!s) return;
    const p = s.plan;
    openDialog(
      `<h2 id="dialog-title">${esc(p.title)}</h2><p class="care-detail-due">${s.paused ? "Paused" : dueText(s)}</p><p class="fine">${cadence(p)}</p>${p.instructions ? `<p class="detail-notes">${esc(p.instructions)}</p>` : ""}${s.done ? `<button class="care-last-done" data-open="${esc(s.done.id)}">Last done ${date(careDay(s.done.time))}</button><p class="fine">${esc(person(s.done.loggedBy))}</p>` : ""}${s.claimedBy ? `<p>${esc(person(s.claimedBy))} has it this time.</p>` : ""}<div class="button-row">${!s.paused && s.due ? `<button class="primary" data-care-action="complete" data-plan="${esc(id)}">Done</button>${!s.claimedBy ? `<button class="secondary" data-care-action="claim" data-plan="${esc(id)}">I'll do it</button>` : s.claimedBy === sync.session.person ? `<button class="secondary" data-care-action="release" data-plan="${esc(id)}">Unclaim</button>` : ""}` : ""}<button class="text-button" data-care-action="edit" data-plan="${esc(id)}">Edit</button><button class="text-button" data-care-action="pause" data-plan="${esc(id)}">${s.paused ? "Resume" : "Pause"}</button></div><p id="form-error" class="error" role="alert"></p>`,
    );
  }
  async function update(id, action) {
    const profile = sync.view().profile,
      plans = structuredClone(profile.carePlans || []),
      p = plans.find((p) => p.id === id);
    if (!p) return;
    const state = planState(p, sync.view().events);
    if (action === "pause") p.paused = !p.paused;
    else if (action === "claim") {
      if (state.claimedBy && state.claimedBy !== sync.session.person)
        throw Error(`${person(state.claimedBy)} already has this.`);
      p.claim = { due: state.due, person: sync.session.person };
    } else p.claim = null;
    await sync.enqueue("profile", null, { carePlans: plans }, profile.revision);
    open(id);
  }
  function complete(id) {
    const s = states().find((s) => s.plan.id === id);
    if (!s || !s.due || s.paused) return;
    const eventId = completionId(s.plan, s.due),
      previous = sync.view().events.find((e) => e.id === eventId);
    if (previous) {
      detail(eventId);
      return;
    }
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    openDialog(
      `<h2 id="dialog-title">${esc(s.plan.title)}</h2><p class="fine">Scheduled for ${date(s.due)}${s.claimedBy ? ` · ${esc(person(s.claimedBy))} has it` : ""}</p>${s.plan.instructions ? `<p class="detail-notes">${esc(s.plan.instructions)}</p>` : ""}<form id="care-complete-form"><label>Done at<input type="datetime-local" name="time" value="${local}" max="${local}" required></label><label>Note <span class="fine">(optional)</span><textarea name="note" maxlength="2000" placeholder="Optional"></textarea></label><div class="button-row"><button class="primary">Save</button><button type="button" class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p></form>`,
    );
    const form = $("care-complete-form");
    form.onsubmit = safe(async (ev) => {
      ev.preventDefault();
      const button = form.querySelector(".primary");
      button.disabled = true;
      try {
        const f = new FormData(form),
          time = new Date(f.get("time")).getTime();
        if (!Number.isFinite(time) || time > Date.now() || time <= 0)
          throw Error("Choose when this actually happened.");
        if (s.done && time <= s.done.time)
          throw Error("Choose a time after the previous completion.");
        await sync.enqueue("create", eventId, {
          type: s.plan.type,
          time,
          note: f.get("note").trim(),
          carePlanId: id,
          careDue: s.due,
          careTitle: s.plan.title,
          who: "us",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        attachLocation(eventId);
        closeDialog();
        celebrate();
        toast(`${s.plan.title} done`);
      } finally {
        button.disabled = false;
      }
    });
  }
  document.addEventListener("click", (ev) => {
    const preset = ev.target.closest("[data-care-template]");
    if (preset) return edit(null, preset.dataset.careTemplate);
    const b = ev.target.closest("[data-care-action]");
    if (!b) return;
    safe(async () => {
      const action = b.dataset.careAction,
        id = b.dataset.plan;
      if (action === "new") {
        if (b.dataset.template) edit(null, b.dataset.template);
        else choosePlan();
      } else if (action === "edit") edit(id);
      else if (action === "open") open(id);
      else if (action === "complete") complete(id);
      else {
        b.disabled = true;
        try {
          await update(id, action);
        } finally {
          b.disabled = false;
        }
      }
    })();
  });
  return { render, fridgeHTML };
}
