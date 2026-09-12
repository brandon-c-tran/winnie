import test from "node:test";
import assert from "node:assert/strict";
import { migrate, applyCommand } from "../netlify/lib/core.mjs";
import { project } from "../public/sync.js";
import { notification } from "../netlify/lib/push.mjs";
const a = { id: "a", person: "brandon", subscription: {} },
  b = { id: "b", person: "kim", subscription: {} };
function setup() {
  const doc = migrate({ events: [] });
  doc.devices = { a, b };
  applyCommand(
    doc,
    {
      protocol: 4,
      operationId: "create",
      kind: "create",
      eventId: "test-event",
      payload: { type: "poop", time: Date.now(), note: "Original" },
    },
    a,
  );
  doc.jobs = {};
  return doc;
}
const react = (id, emoji) => ({
  protocol: 4,
  operationId: id,
  kind: "react",
  eventId: "test-event",
  expectedRevision: 1,
  payload: { emoji },
});
test("reactions merge per person despite stale revisions; replay and same emoji do not push twice", () => {
  const doc = setup();
  const cmd = react("r1", "❤️");
  applyCommand(doc, cmd, b);
  applyCommand(doc, react("r2", "👏"), a);
  assert.equal(doc.events[0].note, "Original");
  assert.equal(doc.events[0].reactions.kim.emoji, "❤️");
  assert.equal(doc.events[0].reactions.brandon.emoji, "👏");
  assert.equal(Object.keys(doc.jobs).length, 2);
  assert(applyCommand(doc, cmd, b).duplicate);
  applyCommand(doc, react("r3", "❤️"), b);
  assert.equal(Object.keys(doc.jobs).length, 2);
  applyCommand(doc, react("r4", ""), b);
  assert.equal(doc.events[0].reactions.kim, undefined);
  assert.equal(Object.keys(doc.jobs).length, 2);
  assert.throws(() => applyCommand(doc, react("r5", "bad"), b), /reaction/);
});
test("removed entries reject reactions and pending reactions preserve partner and event data", () => {
  const doc = setup();
  applyCommand(doc, react("r1", "❤️"), a);
  const view = project({
    snapshot: doc,
    queue: [{ person: "kim", command: react("r2", "😂") }],
  });
  assert.equal(view.events[0].note, "Original");
  assert.equal(view.events[0].reactions.brandon.emoji, "❤️");
  assert.equal(view.events[0].reactions.kim.emoji, "😂");
  assert.equal(doc.events[0].reactions.kim, undefined);
  doc.events[0].deletedAt = Date.now();
  assert.throws(() => applyCommand(doc, react("r3", "👏"), b), /removed/);
});
test("reaction push points to the entry and names the response", () => {
  const n = notification({
    kind: "react",
    actor: "kim",
    emoji: "❤️",
    type: "poop",
    eventId: "test-event",
    time: Date.now(),
  });
  assert.equal(n.title, "Kim reacted ❤️");
  assert.match(n.body, /poop/);
  assert.equal(n.url, "/?event=test-event");
  assert.match(n.tag, /reaction/);
});
