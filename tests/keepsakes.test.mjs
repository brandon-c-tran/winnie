import test from "node:test";
import assert from "node:assert/strict";
import { migrate, applyCommand } from "../netlify/lib/core.mjs";
import { project } from "../public/sync.js";
import { winniePhotos, memoryEvents } from "../public/keepsakes.js";

const device = { id: "phone-a", person: "brandon" };
const fixture = () =>
  migrate({
    events: [
      {
        id: "poop-photo",
        type: "poop",
        time: Date.now() - 10000,
        note: "At the park",
        photos: [{ id: "first" }, { id: "second" }],
      },
    ],
  });
const command = (keep, revision = 1, id = "keep-first") => ({
  protocol: 4,
  operationId: id,
  kind: "keepPhoto",
  eventId: "poop-photo",
  expectedRevision: revision,
  payload: { photoId: "first", keep },
});

test("selected photo remains attached to its care entry and survives replay and removal from Winnie", () => {
  const doc = fixture();
  applyCommand(doc, command(true), device);
  assert.equal(applyCommand(doc, command(true), device).duplicate, true);
  assert.equal(doc.events.length, 1);
  assert.equal(doc.events[0].photos.length, 2);
  assert.deepEqual(
    winniePhotos(doc.events[0]).map((p) => p.id),
    ["first"],
  );
  assert.equal(doc.events[0].type, "poop");
  assert.throws(
    () => applyCommand(doc, command(false, 1, "stale"), device),
    /changed/,
  );
  applyCommand(doc, command(false, 2, "unkeep"), device);
  assert.equal(winniePhotos(doc.events[0]).length, 0);
  assert.equal(doc.events[0].photos.length, 2);
});

test("invalid or missing selections cannot invent a photo", () => {
  assert.throws(
    () => applyCommand(fixture(), command("true"), device),
    /whether/,
  );
  const c = command(true);
  c.payload.photoId = "missing";
  assert.throws(() => applyCommand(fixture(), c, device), /no longer attached/);
});

test("offline projection keeps photo selection separate from its immutable snapshot", () => {
  const snapshot = fixture();
  const before = JSON.stringify(snapshot);
  const view = project({
    snapshot,
    queue: [{ command: command(true), person: "brandon" }],
  });
  assert.equal(winniePhotos(view.events[0]).length, 1);
  assert.equal(JSON.stringify(snapshot), before);
  const memories = memoryEvents([
    ...view.events,
    { id: "moment", type: "moment", photos: [{ id: "third" }] },
  ]);
  assert.deepEqual(
    memories.flatMap((e) => e.photos.map((p) => p.id)),
    ["first", "third"],
  );
});
