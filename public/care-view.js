import {
  careDay,
  careStates,
  planState,
  completionId,
  validateCarePlans,
} from "./care-plans.js?v=3.9";

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
      ? "One time"
      : `Every ${p.every === 1 ? "" : p.every + " "}${p.unit}${p.every === 1 ? "" : "s"}`;
  const states = () => careStates(sync.view().profile, sync.view().events);
  const dueText = (s) =>
    !s.due
      ? "Completed"
      : s.today
        ? "Due today"
        : `${s.overdue ? "Overdue · " : ""}${date(s.due)}`;
  function row(s, compact = false) {
    const p = s.plan;
    return `<article class="care-plan-row ${s.overdue ? "overdue" : ""} ${compact ? "compact" : ""}"><span class="care-plan-icon" aria-hidden="true">${p.type === "medication" ? "✚" : p.type === "appointment" ? "▤" : "✓"}</span><div class="care-plan-body"><button class="care-plan-title" data-care-action="open" data-plan="${esc(p.id)}">${esc(p.title)}</button><p>${s.paused ? "Paused" : dueText(s)}${!compact ? " · " + cadence(p) : ""}</p>${s.claimedBy && !s.paused ? `<span class="care-owner">${esc(person(s.claimedBy))} has this</span>` : ""}</div>${!p.paused && s.due ? `<button class="${compact ? "fridge-done" : "secondary small"}" data-care-action="complete" data-plan="${esc(p.id)}">Done</button>` : ""}</article>`;
  }
  let lastContent = "";
  function render() {
    const all = states(),
      active = all.filter((s) => !s.paused && s.due),
      inactive = all.filter((s) => s.paused || !s.due);
    const content = `<div class="section-heading"><div><h2>Upcoming care</h2></div><button class="secondary small" data-care-action="new">＋ Add care</button></div>${active.length ? `<div class="care-plan-list">${active.map((s) => row(s)).join("")}</div>` : '<div class="care-plan-empty"><span aria-hidden="true">▤</span><h3>One less thing to keep in your head.</h3><p>Save a due date for grooming, a vet visit, or care you repeat. When it’s due, it joins your fridge.</p><button class="primary small" data-care-action="new">Plan his first care</button></div>'}<button class="care-trainer-link" data-act="trainer-schedule"><span>▤ Trainer visits</span><span>View schedule ↗</span></button>${inactive.length ? `<details class="care-inactive"><summary>Paused & completed (${inactive.length})</summary>${inactive.map((s) => row(s)).join("")}</details>` : ""}<p class="fine care-calendar-note">Schedules use San Francisco dates. Record a completion once to update both of you.</p>`;
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
    return `<section class="fridge-recurring"><div class="fridge-card-heading"><span class="fridge-kicker">CARE TO REMEMBER</span><button data-care-nav="upcoming">All care ↗</button></div>${due
      .slice(0, 2)
      .map((s) => row(s, true))
      .join(
        "",
      )}${due.length > 2 ? `<button class="text-button" data-care-nav="upcoming">${due.length - 2} more due</button>` : ""}</section>`;
  }
  function edit(id) {
    const profile = sync.view().profile,
      plans = structuredClone(profile.carePlans || []),
      old = plans.find((p) => p.id === id);
    const p = old || {
      id: crypto.randomUUID(),
      title: "",
      instructions: "",
      start: careDay(),
      every: 1,
      unit: "month",
      type: "appointment",
      paused: false,
      claim: null,
    };
    openDialog(
      `<h2 id="dialog-title">${old ? "Edit care" : "Something to remember"}</h2><form id="care-plan-form"><label>Care name<input name="title" maxlength="200" required value="${esc(p.title)}" placeholder="e.g. Grooming"></label><label>Log completion as<select name="type">${[
        ["appointment", "Appointment / grooming"],
        ["medication", "Medication"],
        ["enrichment", "Training / enrichment"],
        ["note", "Other care"],
      ]
        .map(
          ([v, n]) =>
            `<option value="${v}" ${p.type === v ? "selected" : ""}>${n}</option>`,
        )
        .join(
          "",
        )}</select></label><label>First due date<input name="start" type="date" value="${p.start}" required></label><div class="care-repeat"><label>Repeat every<input type="number" name="every" min="1" max="365" value="${p.every}" required></label><label>Frequency<select name="unit">${[
        ["once", "One time"],
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
        )}</select></label></div><p class="fine">The next date follows the scheduled date, or the completion date if care happens late. Missed dates stay as one task.</p><label>Details <span class="fine">(optional)</span><textarea name="instructions" maxlength="2000" placeholder="Anything to know when it’s time?">${esc(p.instructions)}</textarea></label><p id="form-error" class="error" role="alert"></p><div class="button-row"><button class="primary">Save care</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`,
    );
    const form = $("care-plan-form"),
      state = old && planState(old, sync.view().events);
    if (state?.done) {
      form.elements.start.disabled = true;
      form.elements.start
        .closest("label")
        .insertAdjacentHTML(
          "beforeend",
          '<span class="fine">The next date now follows his completions.</span>',
        );
    }
    const repeat = () => {
      form.elements.every.disabled = form.elements.unit.value === "once";
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
        toast("Care saved for both of you.");
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
      `<h2 id="dialog-title">${esc(p.title)}</h2><p class="care-detail-due">${s.paused ? "Paused" : dueText(s)}</p><p class="fine">${cadence(p)} · San Francisco dates</p>${p.instructions ? `<p class="detail-notes">${esc(p.instructions)}</p>` : ""}${s.done ? `<button class="care-last-done" data-open="${esc(s.done.id)}">Last completed ${date(careDay(s.done.time))} · ${esc(person(s.done.loggedBy))} ↗</button>` : ""}${s.claimedBy ? `<p>${esc(person(s.claimedBy))} has this occurrence.</p>` : ""}<div class="button-row">${!s.paused && s.due ? `<button class="primary" data-care-action="complete" data-plan="${esc(id)}">Record completion</button>${!s.claimedBy ? `<button class="secondary" data-care-action="claim" data-plan="${esc(id)}">I’ve got this</button>` : s.claimedBy === sync.session.person ? `<button class="secondary" data-care-action="release" data-plan="${esc(id)}">Release claim</button>` : ""}` : ""}<button class="text-button" data-care-action="edit" data-plan="${esc(id)}">Edit schedule</button><button class="text-button" data-care-action="pause" data-plan="${esc(id)}">${s.paused ? "Resume" : "Pause"}</button></div><p id="form-error" class="error" role="alert"></p>`,
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
      `<h2 id="dialog-title">${esc(s.plan.title)} — done?</h2><p class="fine">Scheduled for ${date(s.due)}${s.claimedBy ? ` · ${esc(person(s.claimedBy))} claimed this` : ""}</p>${s.plan.instructions ? `<p class="detail-notes">${esc(s.plan.instructions)}</p>` : ""}<form id="care-complete-form"><label>Completed at<input type="datetime-local" name="time" value="${local}" max="${local}" required></label><label>Note <span class="fine">(optional)</span><textarea name="note" maxlength="2000" placeholder="Anything worth remembering?"></textarea></label><p class="fine">Saves one entry in your shared history${s.plan.unit !== "once" ? " and sets the next due date" : ""}.</p><div class="button-row"><button class="primary">Confirm completion</button><button type="button" class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p></form>`,
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
        toast("Care recorded. The shared plan is up to date.");
      } finally {
        button.disabled = false;
      }
    });
  }
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-care-action]");
    if (!b) return;
    safe(async () => {
      const action = b.dataset.careAction,
        id = b.dataset.plan;
      if (action === "new") edit();
      else if (action === "edit") edit(id);
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
