// Long-lived services: the shared log, the room, plans, notes, places, location.
import { createCare } from "../care-view.js?v=4.8";
import { createPlacesView } from "../places-view.js?v=4.8";
import { createFridge } from "../fridge.js?v=4.8";
import { createAutoPlace } from "../auto-place.js?v=4.8";
import { createRoom } from "../room.js?v=4.8";
import { WinnieSync } from "../sync.js?v=4.8";
import { $, esc, person } from "./format.js?v=4.8";
import { detail, entry, hydratePhotos } from "./entries.js?v=4.8";
import { closeDialog, openDialog, safe, toast } from "./ui.js?v=4.8";
import { visitRow } from "./trainer.js?v=4.8";
import { editForm } from "./forms.js?v=4.8";
import { log } from "./logging.js?v=4.8";
import { roomObject } from "./today.js?v=4.8";
import { pantryNextHTML } from "./pantry-view.js?v=4.8";

export const sync = new WinnieSync();
export const places = createPlacesView({
  root: $("places-view"),
  esc,
  entry,
  hydratePhotos,
});
export const care = createCare({
  root: $("care-upcoming"),
  sync,
  esc,
  person,
  openDialog,
  closeDialog,
  toast,
  safe,
  detail,
  contextHTML: () => {
    const visits = (sync.view().profile.trainerSchedule?.visits || [])
      .filter((v) => v.end >= Date.now() - 86400000)
      .sort((a, b) => a.start - b.start)
      .slice(0, 3);
    const recent = facts()
      .filter((e) =>
        ["medication", "appointment", "enrichment", "covered_gap"].includes(
          e.type,
        ),
      )
      .sort((a, b) => b.time - a.time)
      .slice(0, 3);
    return `<section class="care-overview-section"><div class="section-heading"><h3>Trainer visits</h3><button class="text-button" data-act="trainer-schedule">Schedule</button></div>${visits.map((v) => visitRow(v)).join("") || '<p class="fine">No visits coming up.</p>'}</section><section class="care-overview-section"><div class="section-heading"><h3>Recent care</h3><button class="text-button" data-care-nav="care">History</button></div>${recent.map((e) => entry(e)).join("") || '<p class="fine">Nothing yet.</p>'}<button class="px btn" data-act="more">Log care</button></section>`;
  },
  celebrate: () => room.react("done"),
  attachLocation: (id) => {
    void autoPlace.attach(id);
  },
});
export const fridge = createFridge({
  extraNext: () => pantryNextHTML(),
  careDueHTML: care.fridgeHTML,
  root: $("fridge-board"),
  nextRoot: $("up-next"),
  sync,
  esc,
  person,
  openDialog,
  closeDialog,
  toast,
  hydratePhotos,
  editCompletedCare: (type) => {
    editForm(type, null, {
      end_time: Date.now(),
      ...(type === "covered_gap" ? { who: "trainer" } : {}),
    });
    document.querySelector("#event-form [name=time]").value = "";
  },
  log,
  safe,
});
export const autoPlaceEnabled = () =>
  localStorage.getItem("winnie:auto-place") !== "off";
export const autoPlace = createAutoPlace({
  getEvent: (id) => sync.view().events.find((e) => e.id === id),
  save: (id, placePin, revision) =>
    sync.enqueue("edit", id, { placePin }, revision),
  enabled: autoPlaceEnabled,
  report: (id, message) => {
    const status = $("auto-place-status");
    if (status?.dataset.event === id) status.textContent = message;
  },
});
export const photoURLs = new Map(),
  photoLoading = new Set();
// Live events, newest first. Recomputed only when the shared view changes.
let factsOf = null,
  factsCache = [];
export function facts() {
  const view = sync.view();
  if (factsOf !== view) {
    factsOf = view;
    factsCache = view.events
      .filter((e) => !e.deletedAt)
      .sort((a, b) => b.time - a.time);
  }
  return factsCache;
}
const roomSprite = new Image();
roomSprite.src = "/photos/winnie-room-v3.png";
export const room = createRoom($("room"), {
  sprite: roomSprite,
  onObject: (what) => safe(roomObject)(what),
});
