import test from "node:test";
import assert from "node:assert/strict";
import {
  fridgeState,
  onFridge,
  validateFridge,
  fridgeDay,
} from "../public/fridge-model.js";
import { migrate, applyCommand } from "../netlify/lib/core.mjs";
import { project } from "../public/sync.js";
const note = {
  id: "n1",
  text: "Breakfast is in the fridge",
  by: "kim",
  createdAt: Date.now(),
  until: null,
  archivedAt: null,
  color: "rose",
};
test("existing shared notes carry over without changing original profile or attribution", () => {
  const p = {
    routine: "Keep this",
    goal: "Training memory",
    routineUpdatedBy: "brandon",
    routineUpdatedAt: 100,
  };
  const b = fridgeState(p);
  assert.equal(b.notes.length, 2);
  assert.equal(b.notes[0].by, "brandon");
  assert.equal(b.notes[1].by, "");
  b.notes[0].text = "Edit";
  assert.equal(p.routine, "Keep this");
});
test("today notes expire at SF midnight and remain restorable data", () => {
  const n = { ...note, until: "2026-09-10" };
  assert.equal(fridgeDay(Date.parse("2026-09-11T06:59:00Z")), "2026-09-10");
  assert(onFridge(n, Date.parse("2026-09-11T06:59:00Z")));
  assert(!onFridge(n, Date.parse("2026-09-11T07:00:00Z")));
  assert(!onFridge({ ...note, archivedAt: 100 }));
  assert(onFridge({ ...n, until: null }));
  assert.equal(n.text, note.text);
});
test("fridge data rejects corrupt notes and photo references", () => {
  assert.deepEqual(validateFridge({ notes: [note], photo: null }), {
    notes: [note],
    photo: null,
  });
  for (const bad of [
    { notes: [note, note], photo: null },
    { notes: [{ ...note, text: "" }], photo: null },
    { notes: [note], photo: { eventId: "x", photoId: "../bad" } },
    { notes: [{ ...note, color: "url(x)" }], photo: null },
  ])
    assert.throws(() => validateFridge(bad));
});
const command = (id, payload, revision) => ({
  protocol: 4,
  operationId: id,
  kind: "profile",
  eventId: null,
  payload,
  expectedRevision: revision,
});
test("notes archive and plan removal commit together; stale partner changes do not replace the board", () => {
  const doc = migrate({ events: [] }),
    a = { id: "a", person: "brandon" },
    b = { id: "b", person: "kim" };
  applyCommand(
    doc,
    command(
      "first",
      {
        fridge: { notes: [note], photo: null },
        nextCare: { label: "Dinner", dueAt: null, claimedBy: "kim" },
      },
      doc.profile.revision,
    ),
    a,
  );
  const stale = doc.profile.revision,
    archived = { ...note, archivedAt: Date.now() };
  applyCommand(
    doc,
    command(
      "archive",
      { fridge: { notes: [archived], photo: null }, nextCare: null },
      stale,
    ),
    a,
  );
  assert.equal(doc.profile.nextCare, null);
  assert.equal(doc.profile.fridge.notes[0].text, note.text);
  assert.equal(doc.events.length, 0);
  assert.throws(
    () =>
      applyCommand(
        doc,
        command("stale", { fridge: { notes: [], photo: null } }, stale),
        b,
      ),
    /changed/,
  );
  assert.equal(doc.profile.fridge.notes.length, 1);
});
test("offline fridge updates preserve notes, archive and photo after serialization", () => {
  const board = {
    notes: [{ ...note, archivedAt: Date.now() }],
    photo: { eventId: "e", photoId: "p" },
  };
  const data = JSON.parse(
    JSON.stringify({
      snapshot: { events: [], profile: { revision: 1 } },
      queue: [{ command: command("offline", { fridge: board }, 1) }],
    }),
  );
  assert.deepEqual(project(data).profile.fridge, board);
  assert.equal(data.snapshot.profile.fridge, undefined);
});
