// Trainer visits imported from the calendar.
import { validateTrainerImport } from "../everyday.js?v=4.3";
import { $, clock, dateLabel, esc } from "./format.js?v=4.3";
import { facts, sync } from "./services.js?v=4.3";
import { openDialog, safe, toast } from "./ui.js?v=4.3";

export function visitRow(v, events = facts()) {
  const logged = events.find(
    (e) =>
      e.calendarVisitId === v.id ||
      (e.type === "covered_gap" &&
        e.who === "trainer" &&
        Math.abs(e.time - v.start) < 1800000),
  );
  return `<div class="scheduled-visit"><strong>${esc(v.title)}</strong><p class="fine">${dateLabel(v.start)} · ${clock(v.start)}–${clock(v.end)} · ${logged ? "Confirmed" : "Planned"}</p>${logged ? `<button class="text-button" data-open="${esc(logged.id)}">View logged visit</button>` : v.end <= Date.now() ? `<button class="secondary small" data-visit="${esc(v.id)}">Confirm visit happened</button>` : ""}</div>`;
}
export function trainerSchedule() {
  const schedule = sync.view().profile.trainerSchedule,
    visits =
      schedule?.visits.filter((v) => v.end >= Date.now() - 7 * 86400000) || [];
  openDialog(
    `<h2 id="dialog-title">Trainer visits</h2><p class="fine">${schedule ? "Calendar snapshot checked " + dateLabel(Date.parse(schedule.checkedAt)) + " · through " + esc(schedule.through) + ". Changes in Google Calendar need a fresh import." : "Import planned visits from your calendar. They become care entries only when you confirm they happened."}</p>${visits.map((v) => visitRow(v)).join("") || "<p>No upcoming visits imported yet.</p>"}<div class="button-row"><button class="secondary small" data-act="trainer-import">Import calendar visits</button><button class="text-button" data-act="trainer-manual">Log another visit</button></div><p id="form-error" class="error" role="alert"></p>`,
  );
}
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
