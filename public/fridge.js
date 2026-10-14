import { fridgeState, onFridge, fridgeDay } from "./fridge-model.js?v=4.22";
import { icon } from "./icons.js?v=4.0";
const face = (id, size = "sm") =>
  id === "brandon" || id === "kim"
    ? `<img class="face ${size}" src="/photos/${id}-pixel.png" alt="" aria-hidden="true">`
    : "";

export function createFridge({
  extraNext = () => "",
  root,
  nextRoot,
  careDueHTML = () => "",
  sync,
  esc,
  person,
  openDialog,
  closeDialog,
  toast,
  hydratePhotos,
  editCompletedCare,
  log,
  safe,
}) {
  let last = "",
    lastNext = "",
    selected = null;
  const $ = (id) => document.getElementById(id);
  const day = (t) =>
    new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
  const time = (t) =>
    new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const notes = () => fridgeState(sync.view().profile);
  const store = async (fridge, revision, extra = {}) => {
    if (fridge.notes.length > 200)
      throw Error(
        "Your saved drawer is full. All existing notes are preserved.",
      );
    await sync.enqueue("profile", null, { fridge, ...extra }, revision);
  };
  async function motion(element, name) {
    if (!element || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const keyframes =
      name === "peel"
        ? [
            { opacity: 1, transform: "rotate(-1deg)" },
            {
              opacity: 0,
              transform: "translateY(-18px) rotate(9deg) scale(.94)",
            },
          ]
        : [
            { transform: "scale(.7) rotate(-14deg)" },
            { transform: "scale(1.12) rotate(4deg)" },
            { transform: "scale(1) rotate(0)" },
          ];
    try {
      await element.animate(keyframes, {
        duration: name === "peel" ? 230 : 420,
        easing: "cubic-bezier(.2,.8,.2,1)",
      }).finished;
    } catch {}
  }
  function render() {
    const p = sync.view().profile,
      b = fridgeState(p),
      active = b.notes.filter((n) => onFridge(n)),
      saved = b.notes.filter((n) => !onFridge(n)),
      n = p.nextCare;
    const events = sync.view().events.filter((e) => !e.deletedAt);
    const visits =
      p.trainerSchedule?.visits
        .filter(
          (v) =>
            v.end >= Date.now() - 12 * 3600000 &&
            fridgeDay(v.start) <= fridgeDay(),
        )
        .sort((a, b) => a.start - b.start) || [];
    const visitConfirmed =
      visits[0] &&
      events.some(
        (e) =>
          e.calendarVisitId === visits[0].id ||
          (e.type === "covered_gap" &&
            e.who === "trainer" &&
            Math.abs(e.time - visits[0].start) < 1800000),
      );
    const due = careDueHTML() + extraNext();
    const nextRow = n
      ? `<div class="row"><span class="sq" style="--c:var(--pee)">${icon("plans", "ic sm")}</span><div><b>${esc(n.label)}</b><small>${n.dueAt ? `${day(n.dueAt)} · ${time(n.dueAt)}` : "No time set"} · <span class="owner">${n.claimedBy ? `${face(n.claimedBy)}${esc(person(n.claimedBy))} has it` : "Nobody yet"}</span></small></div><span class="button-row">${n.claimedBy ? "" : '<button class="px btn" data-fridge="claim">I\'ll do it</button>'}<button class="px btn" data-fridge="done">Done</button></span></div>`
      : "";
    const visitRow = visits[0]
      ? `<div class="row"><span class="sq" style="--c:var(--care)">${icon("star", "ic sm")}</span><div><b>${esc(visits[0].title)}</b><small>${visitConfirmed ? "Confirmed" : "Planned"} · ${time(visits[0].start)}</small></div><button class="text-button" data-act="trainer-schedule">Open</button></div>`
      : "";
    const nextContent = `<div class="card-head"><h2 id="up-next-title">Up next</h2><button class="text-button small" data-care-nav="upcoming">All plans</button></div>${due}${nextRow}${visitRow}${!due && !nextRow && !visitRow ? '<div class="row"><span class="sq">' + icon("plans", "ic sm") + '</span><div><b>Nothing planned</b></div><button class="px btn" data-care-action="new">Add plan</button></div>' : ""}`;
    if (nextRoot && nextContent !== lastNext) {
      lastNext = nextContent;
      nextRoot.innerHTML = nextContent;
    }
    const content = `<div class="card-head"><h2 id="notes-title">Notes</h2><button class="text-button small" data-fridge="saved">Saved (${saved.length})</button></div>${active.length ? "" : '<div class="notes-empty"><span>No notes on the fridge.</span><button class="px btn" data-fridge="new">Add note</button></div>'}<div class="notes" ${active.length ? "" : "hidden"}>${active
      .map(
        (note) =>
          `<button class="sticky ${note.color === "rose" ? "rose" : ""}" data-fridge="note" data-id="${esc(note.id)}" data-note-card="${esc(note.id)}" aria-label="Edit note: ${esc(note.text.slice(0, 100))}"><span class="tx">${esc(note.text)}</span><span class="note-byline">${face(note.by, "magnet")}<small><span>${note.by ? esc(person(note.by)) : "Note"}</span>${note.createdAt ? `<time datetime="${new Date(note.createdAt).toISOString()}">${day(note.createdAt)}</time>` : ""}${note.until ? "<span>Today only</span>" : ""}</small></span></button>`,
      )
      .join(
        "",
      )}${active.length < 2 ? `<button class="add-note" data-fridge="new">${icon("plus", "ic sm")}Add note</button>` : ""}</div>`;
    if (last === content) return;
    last = content;
    root.innerHTML = content;
    hydratePhotos();
  }
  function edit(id) {
    const p = sync.view().profile,
      b = fridgeState(p),
      note = b.notes.find((n) => n.id === id);
    if (!note && b.notes.filter((n) => onFridge(n)).length >= 2) {
      toast("Two notes fit. Take one down first; it goes to Saved.");
      return;
    }
    openDialog(
      `<h2 id="dialog-title">${note ? "Note" : "New note"}</h2><form id="fridge-note-form" class="note-editor"><label>Your note<textarea name="text" maxlength="2000" required placeholder="Anything the other person should know?">${esc(note?.text || "")}</textarea></label><label>Keep it up<select name="until"><option value="">Until we take it down</option><option value="today" ${note?.until ? "selected" : ""}>Just for today</option></select></label><fieldset class="paper-colors"><legend>Paper</legend><label><input type="radio" name="color" value="yellow" ${note?.color !== "rose" ? "checked" : ""}>Butter yellow</label><label><input type="radio" name="color" value="rose" ${note?.color === "rose" ? "checked" : ""}>Blush pink</label></fieldset><div class="button-row"><button class="primary">Pin note</button><button type="button" class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p></form>`,
    );
    $("fridge-note-form").onsubmit = safe(async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target),
        text = f.get("text").trim();
      if (!text) throw Error("Write a note first.");
      const button =
        ev.target.querySelector("[type=submit]") ||
        ev.target.querySelector(".primary");
      button.disabled = true;
      try {
        const next = {
          id: note?.id || crypto.randomUUID(),
          text,
          by: sync.session.person,
          createdAt: Date.now(),
          until: f.get("until") === "today" ? fridgeDay() : null,
          archivedAt: null,
          color: f.get("color"),
        };
        if (note) b.notes = b.notes.map((n) => (n.id === id ? next : n));
        else b.notes.push(next);
        await store(b, p.revision);
        closeDialog();
        await motion(
          root.querySelector(`[data-note-card="${next.id}"]`),
          "pin",
        );
        toast("Note added");
      } finally {
        button.disabled = false;
      }
    });
  }
  async function archive(id, el) {
    const p = sync.view().profile,
      b = fridgeState(p),
      note = b.notes.find((n) => n.id === id);
    if (!note) return;
    el.disabled = true;
    await motion(el.closest(".fridge-sticky"), "peel");
    try {
      note.archivedAt = Date.now();
      await store(b, p.revision);
      toast("Note taken down", () => restore(id));
    } finally {
      el.disabled = false;
    }
  }
  async function restore(id) {
    const p = sync.view().profile,
      b = fridgeState(p);
    if (b.notes.filter((n) => onFridge(n)).length >= 2)
      throw Error("Take down a note first to make room.");
    const note = b.notes.find((n) => n.id === id);
    if (!note) return;
    note.archivedAt = null;
    note.until = null;
    await store(b, p.revision);
    closeDialog();
    toast("Note put back");
  }
  function saved() {
    const list = notes()
      .notes.filter((n) => !onFridge(n))
      .reverse();
    openDialog(
      `<h2 id="dialog-title">Saved notes</h2><div class="fridge-saved">${list.map((n) => `<article class="saved-paper ${n.color}"><p class="detail-notes">${esc(n.text)}</p><small>${n.by ? esc(person(n.by)) + " · " : ""}${n.createdAt ? day(n.createdAt) : "Earlier note"}</small><button class="text-button" data-fridge="restore" data-id="${esc(n.id)}">Pin again ↗</button></article>`).join("") || "<p>No notes put away yet.</p>"}</div><p id="form-error" class="error" role="alert"></p>`,
    );
  }
  function photoPicker() {
    const p = sync.view().profile,
      events = sync
        .view()
        .events.filter((e) => !e.deletedAt && e.photos?.length)
        .sort((a, b) => b.time - a.time),
      items = events.flatMap((e) => e.photos.map((photo) => ({ e, photo })));
    selected = { profile: p, items, shown: 0 };
    openDialog(
      `<h2 id="dialog-title">Photo on his wall</h2><div id="fridge-photo-options" class="fridge-photo-options"></div><button class="text-button" data-fridge="more-photos" id="fridge-more-photos">More photos</button>${!items.length ? "<p>No saved photos yet. Add a photo to a moment or care entry first.</p>" : ""}<button class="secondary small" data-fridge="default-photo">Use Winnie’s portrait</button><p id="form-error" class="error" role="alert"></p>`,
    );
    morePhotos();
  }
  function morePhotos() {
    if (!selected) return;
    const end = selected.shown + 24;
    $("fridge-photo-options").insertAdjacentHTML(
      "beforeend",
      selected.items
        .slice(selected.shown, end)
        .map(
          ({ e, photo }, i) =>
            `<button data-fridge="pick-photo" data-index="${selected.shown + i}" aria-label="Pin photo from ${esc(day(e.time))}"><img data-photo="${esc(photo.id)}" alt="Winnie · ${esc(day(e.time))}" loading="lazy"></button>`,
        )
        .join(""),
    );
    selected.shown = end;
    $("fridge-more-photos").hidden = end >= selected.items.length;
    hydratePhotos();
  }
  function done() {
    const p = sync.view().profile,
      n = p.nextCare;
    if (!n) return;
    openDialog(
      `<h2 id="dialog-title">${esc(n.label)}: done</h2><p>The plan moves to Saved. You can log the care too.</p><form id="fridge-done-form"><label>Also log, as of now<select name="type"><option value="">Nothing</option><option value="pee">Pee</option><option value="poop">Poop</option><option value="meal">Meal</option><option value="walk">Walk (enter times)</option><option value="covered_gap">Trainer visit (enter times)</option></select></label><div class="button-row"><button class="primary">Done</button><button type="button" class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p></form>`,
    );
    $("fridge-done-form").onsubmit = safe(async (ev) => {
      ev.preventDefault();
      const button = ev.target.querySelector(".primary");
      button.disabled = true;
      try {
        const type = new FormData(ev.target).get("type");
        await putPlanAway(p);
        closeDialog();
        if (["walk", "covered_gap"].includes(type)) editCompletedCare(type);
        else if (type) await log(type);
        else toast("Plan moved to Saved");
      } finally {
        button.disabled = false;
      }
    });
  }
  async function putPlanAway(p = sync.view().profile) {
    if (!p.nextCare) return;
    const b = fridgeState(p),
      n = p.nextCare;
    b.notes.push({
      id: crypto.randomUUID(),
      text: `Plan: ${n.label}${n.dueAt ? "\nPlanned for " + day(n.dueAt) + " · " + time(n.dueAt) : ""}${n.claimedBy ? "\n" + person(n.claimedBy) + " had this" : ""}`,
      by: sync.session.person,
      createdAt: Date.now(),
      until: null,
      archivedAt: Date.now(),
      color: "yellow",
    });
    await store(b, p.revision, { nextCare: null });
  }
  document.addEventListener(
    "click",
    safe(async (ev) => {
      const button = ev.target.closest("button[data-fridge]");
      if (!button) return;
      switch (button.dataset.fridge) {
        case "new":
          edit();
          break;
        case "note":
          edit(button.dataset.id);
          break;
        case "archive":
          await archive(button.dataset.id, button);
          break;
        case "saved":
          saved();
          break;
        case "restore":
          await restore(button.dataset.id);
          break;
        case "claim": {
          button.disabled = true;
          const p = sync.view().profile;
          if (!p.nextCare) return;
          try {
            await sync.enqueue(
              "profile",
              null,
              { nextCare: { ...p.nextCare, claimedBy: sync.session.person } },
              p.revision,
            );
            await motion(
              root.querySelector(".fridge-owner .fridge-magnet"),
              "pin",
            );
          } finally {
            button.disabled = false;
          }
          break;
        }
        case "done":
          done();
          break;
        case "photo":
          photoPicker();
          break;
        case "more-photos":
          morePhotos();
          break;
        case "pick-photo":
        case "default-photo": {
          if (!selected) return;
          button.disabled = true;
          try {
            const b = fridgeState(selected.profile),
              item = selected.items[Number(button.dataset.index)];
            b.photo =
              button.dataset.fridge === "default-photo"
                ? null
                : { eventId: item.e.id, photoId: item.photo.id };
            await store(b, selected.profile.revision);
            closeDialog();

            toast("Wall photo changed");
          } finally {
            button.disabled = false;
          }
          break;
        }
      }
    }),
  );
  return { render, edit, saved, putPlanAway, photoPicker };
}
