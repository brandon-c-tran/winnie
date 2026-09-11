import { fridgeState, onFridge, fridgeDay } from "./fridge-model.js?v=3.8";

export function createFridge({
  root,
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
    entrance = true,
    selected = null;
  const $ = (id) => document.getElementById(id);
  const day = (t) =>
    new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
  const time = (t) =>
    new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const magnet = (who) =>
    `<span class="fridge-magnet ${who || "heart"}" aria-hidden="true">${who ? (who === "kim" ? "K" : "B") : "♥"}</span>`;
  const notes = () => fridgeState(sync.view().profile);
  const portrait = ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "/photos/winnie-smile.png"
    : "/.netlify/images?url=/photos/winnie-smile.png&w=480&fm=webp&q=85";
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
    const photoEvent =
      b.photo &&
      events.find(
        (e) =>
          e.id === b.photo.eventId &&
          e.photos?.some((x) => x.id === b.photo.photoId),
      );
    const visits =
      p.trainerSchedule?.visits
        .filter((v) => v.end >= Date.now() - 12 * 3600000)
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
    const content = `<header class="fridge-heading"><div><span class="fridge-kicker">BRANDON + KIM + WINNIE</span><h2>Our fridge<span aria-hidden="true">♡</span></h2></div><button class="fridge-drawer" data-fridge="saved" aria-label="Saved notes">Saved <span>${saved.length}</span></button></header><div class="fridge-grid">${active.map((note, i) => `<article class="fridge-sticky ${note.color}" data-note-card="${esc(note.id)}" style="--tilt:${i % 2 ? 1.3 : -1.2}deg">${magnet(note.by)}<button class="sticky-body" data-fridge="note" data-id="${esc(note.id)}" aria-label="Read or edit note: ${esc(note.text.slice(0, 100))}"><span class="sticky-text">${esc(note.text)}</span><span class="sticky-by">${note.by ? esc(person(note.by)) : "Our saved note"}${note.createdAt ? " · " + day(note.createdAt) : ""}</span></button><footer><span>${note.until ? "For today" : "Until cleared"}</span><button data-fridge="archive" data-id="${esc(note.id)}" aria-label="Take down note: ${esc(note.text.slice(0, 80))}">Take down ↗</button></footer></article>`).join("")}${Array.from({ length: Math.max(0, 2 - active.length) }, (_, i) => `<button class="fridge-add-note" data-fridge="new"><span aria-hidden="true">＋</span>${active.length || i ? "Add another note" : "Leave each other a note"}<small>Pin a sticky note</small></button>`).join("")}<article class="fridge-plan"><span class="paper-clip" aria-hidden="true"></span><div class="fridge-card-heading"><span class="fridge-kicker">NEXT TOGETHER</span><button data-act="next-care">${n ? "Edit" : "Add plan"}</button></div>${n ? `<h3>${esc(n.label)}</h3><p>${n.dueAt ? `${day(n.dueAt)} · ${time(n.dueAt)}` : "When we’re ready"}</p><div class="fridge-owner">${n.claimedBy ? `${magnet(n.claimedBy)}<span>${esc(person(n.claimedBy))} has this</span>` : '<button class="claim-magnet" data-fridge="claim">＋ I’ve got this</button>'}</div><button class="fridge-done" data-fridge="done">✓ Done / log care</button>` : '<h3>What’s next for him?</h3><p>A little plan you can share.</p><button class="claim-magnet" data-act="next-care">＋ Plan care</button>'}</article><figure class="fridge-polaroid">${magnet("")}<button class="polaroid-picture" ${photoEvent ? `data-open="${esc(photoEvent.id)}" aria-label="Open pinned Winnie photo"` : 'data-fridge="photo" aria-label="Choose a photo for the fridge"'}>${photoEvent ? `<img data-photo="${esc(b.photo.photoId)}" alt="Pinned photo of Winnie">` : `<img src="${esc(portrait)}" alt="Winnie in his yellow harness">`}</button><figcaption><span>${photoEvent ? day(photoEvent.time) : "our boy, Winnie"}</span><button data-fridge="photo" aria-label="Change fridge photo">Change ↗</button></figcaption></figure>${visits[0] ? `<button class="fridge-appointment" data-act="trainer-schedule"><span aria-hidden="true">▤</span><span><strong>${esc(visits[0].title)}</strong><small>${visitConfirmed ? "Confirmed" : "Planned"} · ${day(visits[0].start)} · ${time(visits[0].start)}</small></span><span aria-hidden="true">↗</span></button>` : ""}</div><div class="fridge-bottom"><span class="fridge-screw" aria-hidden="true"></span><span>Notes stay saved when you take them down.</span><span class="fridge-screw" aria-hidden="true"></span></div>`;
    if (last === content) return;
    last = content;
    root.innerHTML = content;
    if (entrance) {
      root.classList.add("fridge-arrive");
      entrance = false;
    }
    hydratePhotos();
  }
  function edit(id) {
    const p = sync.view().profile,
      b = fridgeState(p),
      note = b.notes.find((n) => n.id === id);
    if (!note && b.notes.filter((n) => onFridge(n)).length >= 2) {
      toast("Take down a note to make room. It stays in Saved.");
      return;
    }
    openDialog(
      `<h2 id="dialog-title">${note ? "Your sticky note" : "A note for each other"}</h2><form id="fridge-note-form" class="note-editor"><label>Your note<textarea name="text" maxlength="2000" required placeholder="Anything the other person should know?">${esc(note?.text || "")}</textarea></label><label>Keep it up<select name="until"><option value="">Until we take it down</option><option value="today" ${note?.until ? "selected" : ""}>Just for today</option></select></label><fieldset class="paper-colors"><legend>Paper</legend><label><input type="radio" name="color" value="yellow" ${note?.color !== "rose" ? "checked" : ""}>Butter yellow</label><label><input type="radio" name="color" value="rose" ${note?.color === "rose" ? "checked" : ""}>Blush pink</label></fieldset><p class="fine">Today ends at midnight in San Francisco. Notes then move to Saved.</p><div class="button-row"><button class="primary">Pin note</button><button type="button" class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p></form>`,
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
        toast("Pinned to your fridge.");
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
      toast("Note tucked into Saved.", () => restore(id));
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
    toast("Note pinned again.");
  }
  function saved() {
    const list = notes()
      .notes.filter((n) => !onFridge(n))
      .reverse();
    openDialog(
      `<h2 id="dialog-title">Saved from the fridge</h2><p class="fine">Your notes and past plans, kept together.</p><div class="fridge-saved">${list.map((n) => `<article class="saved-paper ${n.color}"><p class="detail-notes">${esc(n.text)}</p><small>${n.by ? esc(person(n.by)) + " · " : ""}${n.createdAt ? day(n.createdAt) : "Earlier note"}</small><button class="text-button" data-fridge="restore" data-id="${esc(n.id)}">Pin again ↗</button></article>`).join("") || "<p>No notes put away yet.</p>"}</div><p id="form-error" class="error" role="alert"></p>`,
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
      `<h2 id="dialog-title">A photo for the fridge</h2><p class="fine">Pick from your saved moments.</p><div id="fridge-photo-options" class="fridge-photo-options"></div><button class="text-button" data-fridge="more-photos" id="fridge-more-photos">More photos</button>${!items.length ? "<p>No saved photos yet. Add a photo to a moment or care entry first.</p>" : ""}<button class="secondary small" data-fridge="default-photo">Use Winnie’s portrait</button><p id="form-error" class="error" role="alert"></p>`,
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
      `<h2 id="dialog-title">${esc(n.label)} — all done?</h2><p>Put this plan in Saved. You can log what happened next.</p><form id="fridge-done-form"><label>Log care<select name="type"><option value="">Just put the plan away</option><option value="pee">Pee</option><option value="poop">Poop</option><option value="meal">Meal</option><option value="walk">Walk (enter times)</option><option value="covered_gap">Trainer visit (enter times)</option></select></label><p class="fine">Choose a care type only if it happened just now.</p><div class="button-row"><button class="primary">Done</button><button type="button" class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p></form>`,
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
        else toast("Plan saved in the drawer.");
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
            await motion(root.querySelector(".fridge-polaroid"), "pin");
            toast("Photo pinned.");
          } finally {
            button.disabled = false;
          }
          break;
        }
      }
    }),
  );
  return { render, edit, saved, putPlanAway };
}
