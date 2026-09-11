import test from "node:test";
import assert from "node:assert/strict";
import {
  latestCare,
  elapsed,
  validPin,
  mapURL,
  canCaptureHere,
  capturePlace,
} from "../public/care-state.js";
import { migrate, applyCommand } from "../netlify/lib/core.mjs";
import { project } from "../public/sync.js";
test("latest state ignores future/deleted records and preserves an ongoing sleep", () => {
  const records = [
    { id: "a", type: "pee", time: 100 },
    { type: "pee", time: 3000 },
    { type: "pee", time: 500, deletedAt: 900 },
    { type: "nap", time: 200 },
    { type: "slumber", time: 700, end_time: 800 },
  ];
  const before = JSON.stringify(records),
    state = latestCare(records, 1000);
  assert.equal(state.pee.id, "a");
  assert.equal(state.sleep.time, 200);
  assert.equal(state.meal, undefined);
  assert.equal(JSON.stringify(records), before);
  assert.equal(elapsed(1000, 1000), "Just now");
  assert.equal(elapsed(1000, 3661000), "1h 1m ago");
  assert.equal(elapsed(1000, 86401000), "1d ago");
});
test("location is explicit, fresh, range-checked, and unavailable for historical entries", async () => {
  const now = Date.now();
  assert(canCaptureHere({ time: now }, now));
  assert(!canCaptureHere({ time: now - 900001 }, now));
  assert(!canCaptureHere({ time: now + 1 }, now));
  const p = { lat: 0, lng: 0, accuracy: 12, capturedAt: now };
  assert(validPin(p));
  assert(!validPin({ ...p, lat: 91 }));
  assert(mapURL({ placePin: p }).endsWith("query=0,0"));
  assert(mapURL({ location: "Park & beach" }).endsWith("Park%20%26%20beach"));
  assert.equal(mapURL({}), null);
  let options;
  const geo = {
    getCurrentPosition(ok, _fail, opts) {
      options = opts;
      ok({
        coords: { latitude: 0, longitude: 0, accuracy: 12 },
        timestamp: now,
      });
    },
  };
  assert.deepEqual(await capturePlace(geo), p);
  assert.equal(options.maximumAge, 0);
  assert.equal(options.timeout, 10000);
  await assert.rejects(
    capturePlace({
      getCurrentPosition(_ok, fail) {
        fail({ code: 1 });
      },
    }),
    /permission/,
  );
  await assert.rejects(
    capturePlace({
      getCurrentPosition(ok) {
        ok({
          coords: { latitude: 0, longitude: 0, accuracy: 12 },
          timestamp: now - 120000,
        });
      },
    }),
    /fresh/,
  );
});
const device = { id: "a", person: "brandon" };
const cmd = (operationId, kind, eventId, payload, expectedRevision) => ({
  protocol: 4,
  operationId,
  kind,
  eventId,
  payload,
  expectedRevision,
});
test("offline place and care-plan edits survive projection without changing the saved snapshot", () => {
  const pin = { lat: 0, lng: 0, accuracy: 12, capturedAt: Date.now() };
  const data = {
    snapshot: {
      events: [{ id: "a", type: "pee", time: Date.now(), revision: 1 }],
      profile: { revision: 1 },
    },
    queue: [
      {
        command: cmd(
          "local-place",
          "edit",
          "a",
          { placePin: pin, location: "Park" },
          1,
        ),
      },
      {
        command: cmd(
          "local-plan",
          "profile",
          null,
          { nextCare: { label: "Walk", dueAt: null, claimedBy: "kim" } },
          1,
        ),
      },
    ],
  };
  const restored = JSON.parse(JSON.stringify(data)),
    view = project(restored);
  assert.deepEqual(view.events[0].placePin, pin);
  assert.equal(view.events[0].pending, true);
  assert.equal(view.profile.nextCare.claimedBy, "kim");
  assert.equal(data.snapshot.events[0].placePin, undefined);
});
test("pins survive shared edits and explicit removal without modifying legacy coordinates", () => {
  const now = Date.now() - 1000,
    doc = migrate({
      events: [
        { id: "old", type: "pee", time: now, coords: { lat: 3, lng: 4 } },
      ],
    });
  const pin = { lat: 0, lng: 0, accuracy: 8, capturedAt: now };
  applyCommand(
    doc,
    cmd("pin-edit", "edit", "old", { location: "Test park", placePin: pin }, 1),
    device,
  );
  assert.deepEqual(doc.events[0].placePin, pin);
  assert.deepEqual(doc.events[0].coords, { lat: 3, lng: 4 });
  applyCommand(
    doc,
    cmd("pin-clear", "edit", "old", { location: "", placePin: null }, 2),
    device,
  );
  assert.equal(doc.events[0].placePin, null);
  assert.throws(
    () =>
      applyCommand(
        doc,
        cmd("pin-bad", "edit", "old", { placePin: { ...pin, lng: 181 } }, 3),
        device,
      ),
    /Invalid place/,
  );
});
test("shared next-care claims reject stale partner edits and never create care records", () => {
  const doc = migrate({ events: [] });
  const start = doc.profile.revision;
  applyCommand(
    doc,
    cmd(
      "plan-create",
      "profile",
      null,
      { nextCare: { label: "Evening walk", dueAt: null, claimedBy: "" } },
      start,
    ),
    device,
  );
  const revision = doc.profile.revision;
  applyCommand(
    doc,
    cmd(
      "plan-claim",
      "profile",
      null,
      { nextCare: { ...doc.profile.nextCare, claimedBy: "brandon" } },
      revision,
    ),
    device,
  );
  assert.throws(
    () =>
      applyCommand(
        doc,
        cmd(
          "plan-other",
          "profile",
          null,
          { nextCare: { ...doc.profile.nextCare, claimedBy: "kim" } },
          revision,
        ),
        { id: "b", person: "kim" },
      ),
    /changed/,
  );
  assert.equal(doc.profile.nextCare.claimedBy, "brandon");
  assert.equal(doc.events.length, 0);
  applyCommand(
    doc,
    cmd(
      "plan-clear",
      "profile",
      null,
      { nextCare: null },
      doc.profile.revision,
    ),
    device,
  );
  assert.equal(doc.profile.nextCare, null);
});
