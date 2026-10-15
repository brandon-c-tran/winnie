import {calendarPlansHTML, calendarSheet} from './calendar-view.js?v=4.28';
// Trainer visits imported from the calendar.
import { validateTrainerImport } from "../everyday.js?v=4.28";
import { $, clock, dateLabel, esc } from "./format.js?v=4.28";
import { facts, sync } from "./services.js?v=4.28";
import { openDialog, safe, toast } from "./ui.js?v=4.28";

export function visitRow(v, events = facts()) {
  const logged = events.find(
    (e) =>
      e.calendarVisitId === v.id ||
      (e.type === "covered_gap" &&
        e.who === "trainer" &&
        Math.abs(e.time - v.start) < 1800000),
  );
  const date = new Date(v.start),
    month = date.toLocaleDateString([], {
      month: "short",
      timeZone: "America/Los_Angeles",
    }),
    day = date.toLocaleDateString([], {
      day: "numeric",
      timeZone: "America/Los_Angeles",
    });
  return `<article class="scheduled-visit"><div class="training-date" aria-hidden="true">${month}<b>${day}</b></div><div class="visit-main"><strong>${esc(v.title)}</strong><p class="fine">${dateLabel(v.start)}</p><p class="fine">${clock(v.start)}–${clock(v.end)}</p><span class="visit-state">${logged ? "Logged" : v.end <= Date.now() ? "Not confirmed" : "Scheduled"}</span>${logged ? `<button class="text-button" data-open="${esc(logged.id)}">View logged visit</button>` : v.end <= Date.now() ? `<button class="secondary small" data-visit="${esc(v.id)}">Confirm visit</button>` : ""}</div></article>`;
}
export const trainingHTML = calendarPlansHTML;
export const trainerSchedule = calendarSheet;
export async function confirmVisit(id) {
  const visit = sync
    .view()
    .profile.trainerSchedule?.visits.find((v) => v.id === id);
  if (!visit || visit.end > Date.now())
    throw Error("Confirm this visit after it ends.");
  if (facts().some((e) => e.calendarVisitId === id)) {
    trainerSchedule();
    return;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(id),
  );
  const eventId =
    "trainer-" +
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  await sync.enqueue("create", eventId, {
    type: "covered_gap",
    kind: "trainer",
    calendarVisitId: id,
    time: visit.start,
    end_time: visit.end,
    who: "trainer",
    note: visit.title,
    tags: [],
    time_precision: "exact",
    timezone: "America/Los_Angeles",
  });
  trainerSchedule();
  toast("Trainer visit confirmed.");
}
$("trainer-import").onchange = safe(async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  if (file.size > 50000)
    throw Error("Choose a smaller trainer calendar export.");
  const schedule = validateTrainerImport(JSON.parse(await file.text())),
    revision = sync.view().profile.revision;
  openDialog(
    `<h2 id="dialog-title">Use these calendar visits?</h2><p class="fine">${schedule.visits.length} planned visits · through ${esc(schedule.through)}. Existing care entries stay as they are.</p>${schedule.visits.map((v) => `<p><strong>${esc(v.title)}</strong><br><span class="fine">${dateLabel(v.start)} · ${clock(v.start)}–${clock(v.end)}</span></p>`).join("")}<div class="button-row"><button class="primary" id="save-trainer-import">Use these visits</button><button class="secondary" data-act="close">Cancel</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
  $("save-trainer-import").onclick = safe(async (ev) => {
    ev.target.disabled = true;
    try {
      await sync.enqueue(
        "profile",
        null,
        { trainerSchedule: schedule },
        revision,
      );
      trainerSchedule();
      toast("Calendar visits saved to the shared schedule.");
    } finally {
      ev.target.disabled = false;
    }
  });
});
