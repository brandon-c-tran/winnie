import test from "node:test";
import assert from "node:assert/strict";
import {
  careDay,
  advanceDay,
  validateCarePlans,
  planState,
  completionId,
} from "../public/care-plans.js";
import { migrate, applyCommand } from "../netlify/lib/core.mjs";
import { project } from "../public/sync.js";
const plan = {
  id: "grooming",
  title: "Grooming",
  instructions: "Our usual groomer",
  start: "2026-01-01",
  every: 1,
  unit: "month",
  type: "appointment",
  paused: false,
  claim: null,
};
const device = { id: "phone-a", person: "brandon" },
  other = { id: "phone-b", person: "kim" };
const now = Date.parse("2026-01-31T20:00:00Z");
test("care dates handle SF midnight, DST, leap years and month ends", () => {
  assert.equal(careDay(Date.parse("2026-03-08T07:30:00Z")), "2026-03-07");
  assert.equal(advanceDay("2026-01-31", 1, "month"), "2026-02-28");
  assert.equal(advanceDay("2024-01-31", 1, "month"), "2024-02-29");
  assert.equal(advanceDay("2026-03-07", 1, "day"), "2026-03-08");
  assert.equal(advanceDay("2026-12-29", 1, "week"), "2027-01-05");
});
test("recurrence follows actual late completion and does not stack missed tasks", () => {
  const events = [{ carePlanId: plan.id, careDue: plan.start, time: now }];
  const before = JSON.stringify(events);
  assert.equal(planState(plan, events, now).due, "2026-02-28");
  assert.equal(planState(plan, [], now).due, "2026-01-01");
  assert(planState(plan, [], now).overdue);
  assert.equal(planState({ ...plan, unit: "once" }, events, now).due, null);
  assert.equal(
    planState(plan, [{ ...events[0], deletedAt: now }], now).due,
    plan.start,
  );
  assert.equal(
    planState(plan, [{ ...events[0], time: now + 1 }], now).due,
    plan.start,
  );
  assert.equal(JSON.stringify(events), before);
});
test("early completion advances beyond its occurrence and stale claims expire", () => {
  const p = {
    ...plan,
    start: "2026-02-01",
    claim: { due: "2026-02-01", person: "kim" },
  };
  const s = planState(
    p,
    [{ carePlanId: p.id, careDue: p.start, time: now }],
    now,
  );
  assert.equal(s.due, "2026-03-01");
  assert.equal(s.claimedBy, "");
  assert.equal(planState(p, [], now).claimedBy, "kim");
});
test("invalid schedules are rejected without changing valid data", () => {
  assert.deepEqual(validateCarePlans([plan]), [plan]);
  for (const p of [
    { ...plan, start: "2026-02-30" },
    { ...plan, every: 0 },
    { ...plan, every: 1.5 },
    { ...plan, claim: { due: plan.start, person: "x" } },
    { ...plan, title: "" },
    { ...plan, unit: "hour" },
  ])
    assert.throws(() => validateCarePlans([p]));
  assert.throws(() => validateCarePlans([plan, plan]));
});
const profileCommand = (id, plans, revision) => ({
  protocol: 4,
  operationId: id,
  kind: "profile",
  eventId: null,
  payload: { carePlans: plans },
  expectedRevision: revision,
});
const complete = (id, p = plan) => ({
  protocol: 4,
  operationId: id,
  kind: "create",
  eventId: completionId(p, p.start),
  payload: {
    type: p.type,
    time: now,
    carePlanId: p.id,
    careDue: p.start,
    careTitle: p.title,
    who: "us",
  },
});
test("two phones cannot complete one occurrence twice; replay remains idempotent", () => {
  const doc = migrate({ events: [] });
  applyCommand(
    doc,
    profileCommand("plan", [plan], doc.profile.revision),
    device,
  );
  const cmd = complete("done");
  applyCommand(doc, cmd, device);
  assert(applyCommand(doc, cmd, device).duplicate);
  assert.throws(
    () => applyCommand(doc, complete("other-done"), other),
    /already exists/,
  );
  assert.equal(doc.events.length, 1);
  const event = doc.events[0];
  assert.throws(
    () =>
      applyCommand(
        doc,
        {
          protocol: 4,
          operationId: "unlink",
          kind: "edit",
          eventId: event.id,
          expectedRevision: event.revision,
          payload: { carePlanId: "" },
        },
        device,
      ),
    /original care link/,
  );
  assert.equal(doc.events[0].carePlanId, plan.id);
  assert.equal(doc.events[0].careTitle, "Grooming");
  assert.throws(
    () =>
      applyCommand(
        doc,
        { ...complete("wrong-id"), eventId: "arbitrary" },
        other,
      ),
    /occurrence changed/,
  );
  assert.equal(doc.events.length, 1);
});
test("claims reject stale changes and offline completion advances without a second write", () => {
  const doc = migrate({
    events: [{ id: "old", type: "pee", time: 1, coords: { lat: 1, lng: 2 } }],
  });
  const original = JSON.stringify(doc.events[0]);
  applyCommand(
    doc,
    profileCommand("setup", [plan], doc.profile.revision),
    device,
  );
  const revision = doc.profile.revision;
  applyCommand(
    doc,
    profileCommand(
      "claim",
      [{ ...plan, claim: { due: plan.start, person: "brandon" } }],
      revision,
    ),
    device,
  );
  assert.throws(
    () =>
      applyCommand(
        doc,
        profileCommand(
          "stale",
          [{ ...plan, claim: { due: plan.start, person: "kim" } }],
          revision,
        ),
        other,
      ),
    /changed/,
  );
  const snap = { events: doc.events, profile: doc.profile };
  const projected = project({
    snapshot: snap,
    queue: [{ command: complete("offline"), person: "brandon" }],
  });
  assert.equal(planState(plan, projected.events, Date.now()).due, "2026-02-28");
  assert.equal(snap.events.length, 1);
  assert.equal(JSON.stringify(doc.events[0]), original);
});
