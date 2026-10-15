// Long-lived services: the shared log, the room, plans, notes, places, location.
import { createCare } from "../care-view.js?v=4.29";
import { createPlacesView } from "../places-view.js?v=4.29";
import { createFridge } from "../fridge.js?v=4.29";
import { createAutoPlace } from "../auto-place.js?v=4.29";
import { createRoom } from "../room.js?v=4.29";
import { WinnieSync } from "../sync.js?v=4.29";
import { $, esc, person } from "./format.js?v=4.29";
import { detail, entry, hydratePhotos } from "./entries.js?v=4.29";
import { closeDialog, openDialog, safe, toast } from "./ui.js?v=4.29";
import { editForm } from "./forms.js?v=4.29";
import { log, routineSheet } from "./logging.js?v=4.29";
import { roomObject } from "./today.js?v=4.29";
import { pantryNextHTML } from "./pantry-view.js?v=4.29";

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
  celebrate: () => room.react("done"),
  completeRoutine: routineSheet,
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
const harnessSprite = new Image();
harnessSprite.src = "/photos/winnie-harness-v2.png";
const shirtSprite = new Image();
shirtSprite.src = "/photos/winnie-stripes-v2.png";
export const room = createRoom($("room"), {
  sprite: roomSprite,
  harnessSprite,
  shirtSprite,
  onObject: (what) => safe(roomObject)(what),
});
try { room.setLights(localStorage.getItem("winnie:room-lights") === "on"); } catch { /* Default to the natural room lighting. */ }
