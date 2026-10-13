// Entry, shared plan, and place forms.
import { eventPosition, placeName, placeLabel } from "../places.js?v=4.8";
import {
  validPin,
  mapURL,
  canCaptureHere,
  capturePlace,
} from "../care-state.js?v=4.8";
import { GROOMING } from "../icons.js?v=4.0";
import { normalizeFood } from "../everyday.js?v=4.8";
import { autoPlace, facts, fridge, sync } from "./services.js?v=4.8";
import {
  $,
  TYPES,
  clock,
  dateLabel,
  dateTime,
  esc,
  uid,
} from "./format.js?v=4.8";
import { closeDialog, openDialog, safe, toast } from "./ui.js?v=4.8";
import { render } from "./today.js?v=4.8";
import { detail, eventLabel } from "./entries.js?v=4.8";
import { state } from "./state.js?v=4.8";

export function editForm(type = "note", id = null, defaults = {}) {
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
  state.formPhotos = [];
  state.formType = e.type;
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
      )}</select></label><label id="title-label" ${e.type === "grooming" ? "" : "hidden"}>What was done<input name="careTitle" maxlength="60" value="${esc(e.careTitle || "")}" placeholder="Bath" list="groom-titles"><datalist id="groom-titles">${GROOMING.map(([t]) => `<option value="${t}"></option>`).join("")}</datalist></label><label id="foods-label" ${e.type === "meal" ? "" : "hidden"}>What he ate<input name="foods" maxlength="500" value="${esc((e.foods || []).join(", "))}" placeholder="Chicken, sardine…"></label><label>When<input name="time" type="datetime-local" value="${dateTime(e.time)}" required></label><label id="end-label" ${["nap", "slumber", "walk", "outing", "episode", "appointment", "travel", "covered_gap"].includes(e.type) ? "" : "hidden"}>Ended<input name="end_time" type="datetime-local" value="${e.end_time ? dateTime(e.end_time) : ""}"></label><label>${e.type === "moment" ? "Caption" : "Note"} <span class="fine">(optional)</span><textarea name="note" maxlength="10000" placeholder="Optional">${esc(e.note || "")}</textarea></label><details><summary class="fine">More details</summary><label>Who provided care?<select name="who">${["us", "trainer", "sitter", "unknown"].map((w) => `<option value="${w}" ${e.who === w ? "selected" : ""}>${w === "us" ? "Us" : w}</option>`).join("")}</select></label><label>Tags<input name="tags" value="${esc((e.tags || []).join(", "))}" placeholder="outdoors, self-signaled"></label><label>Place<input name="location" maxlength="500" value="${esc(placeName(e))}"></label><label>Time accuracy<select name="time_precision">${["exact", "approx", "unknown"].map((t) => `<option ${e.time_precision === t ? "selected" : ""}>${t}</option>`).join("")}</select></label></details>${!id ? '<div class="button-row"><button type="button" class="secondary small" data-form-camera>Take photo</button><button type="button" class="secondary small" data-form-library>Choose photos</button></div><p id="form-photo-status" class="fine"></p>' : ""}<p id="form-error" class="error" role="alert"></p><div class="button-row"><button type="submit" class="primary">${id ? "Save changes" : "Save entry"}</button><button type="button" class="secondary" data-act="close">Cancel</button></div></form>`,
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
        !state.formPhotos.length &&
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
      while (state.formPhotos.length) {
        await sync.addPhoto(eventId, state.formPhotos[0]);
        state.formPhotos.shift();
        savedRevision = sync
          .view()
          .events.find((e) => e.id === eventId)?.revision;
      }
      closeDialog();
      toast("Saved", id ? null : () => sync.enqueue("delete", eventId));
      if (
        ["pee", "poop"].includes(payload.type) &&
        !id &&
        !state.formPhotos.length
      )
        render();
    } finally {
      submit.disabled = false;
    }
  });
}
export function plan() {
  fridge.edit();
}
export function nextCareForm() {
  const p = sync.view().profile,
    n = p.nextCare;
  openDialog(
    `<h2 id="dialog-title">Shared plan</h2><form id="next-care-form"><label>Next step<input name="label" maxlength="200" required placeholder="e.g. Evening walk" value="${esc(n?.label || "")}"></label><label>When <span class="fine">(optional)</span><input name="due" type="datetime-local" value="${n?.dueAt ? dateTime(n.dueAt) : ""}"></label><label>Who’s doing it?<select name="person"><option value="">Not decided</option><option value="brandon" ${n?.claimedBy === "brandon" ? "selected" : ""}>Brandon</option><option value="kim" ${n?.claimedBy === "kim" ? "selected" : ""}>Kim</option></select></label><div class="button-row"><button class="primary">Save plan</button><button type="button" class="secondary" data-act="close">Cancel</button>${n ? '<button type="button" class="text-button" id="clear-care-plan">Clear plan</button>' : ""}</div><p id="form-error" class="error" role="alert"></p></form>`,
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
export function placeSummary(e) {
  const url = mapURL(e);
  return url
    ? `<div class="place-summary"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">⌖ ${esc(placeLabel(e))} ↗</a>${validPin(e.placePin) ? `<p class="fine">Phone location · accuracy about ${Math.round(e.placePin.accuracy)} m</p>` : ""}</div>`
    : "";
}
export function placePicker(id) {
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
    `<h2 id="dialog-title">Place</h2><p class="fine">${esc(eventLabel(e))} · ${dateLabel(e.time)} · ${clock(e.time)}</p><form id="place-form"><label>Place name<input name="place" maxlength="500" list="recent-places" placeholder="Home, the park, the beach" value="${esc(placeName(e))}"></label><datalist id="recent-places">${recent.map((p) => `<option value="${esc(p)}"></option>`).join("")}</datalist>${canCaptureHere(e) ? '<button type="button" class="secondary small" id="capture-place">Use current location</button>' : ""}<p id="pin-status" class="fine" role="status">${pin ? `${placeLabel(e)}${Number.isFinite(pin.accuracy) ? ` · accuracy about ${Math.round(pin.accuracy)} m` : ""}` : "No map pin attached."}</p><button type="button" class="text-button" id="remove-pin" ${pin ? "" : "hidden"}>Remove map pin</button><div class="button-row"><button class="primary" id="save-place">Save place</button><button type="button" class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p></form>`,
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
