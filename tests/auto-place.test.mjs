import test from "node:test";
import assert from "node:assert/strict";
import { createAutoPlace } from "../public/auto-place.js";
const pin = () => ({ lat: 0, lng: 0, accuracy: 10, capturedAt: Date.now() });
function setup() {
  let event = { id: "one", type: "pee", time: Date.now(), revision: 1 },
    on = true,
    resolve;
  const writes = [],
    reports = [];
  const auto = createAutoPlace({
    getEvent: () => event,
    enabled: () => on,
    capture: () => new Promise((r) => (resolve = r)),
    save: async (...args) => writes.push(args),
    report: (...args) => reports.push(args),
  });
  return {
    auto,
    writes,
    reports,
    event,
    finish: () => resolve(pin()),
    off: () => (on = false),
  };
}
test("new log can finish while GPS is pending, then attaches once using latest revision", async () => {
  const s = setup(),
    task = s.auto.attach("one");
  assert.equal(s.writes.length, 0);
  assert.equal(s.reports[0][1], "Finding location…");
  await s.auto.attach("one");
  s.event.revision = 3;
  s.finish();
  await task;
  assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0][2], 3);
  assert.equal(s.writes[0][0], "one");
});
test("late GPS never overwrites manual places, deleted logs, changed times or disabled capture", async () => {
  for (const action of [
    (s) => s.auto.cancel("one"),
    (s) => (s.event.deletedAt = Date.now()),
    (s) => (s.event.location = "Home"),
    (s) => (s.event.placePin = pin()),
    (s) => (s.event.time -= 1000),
    (s) => s.off(),
  ]) {
    const s = setup(),
      task = s.auto.attach("one");
    action(s);
    s.finish();
    await task;
    assert.equal(s.writes.length, 0);
  }
});
test("old logs and opt-out never request location", async () => {
  let requests = 0;
  const auto = createAutoPlace({
    getEvent: () => ({ time: Date.now() - 3600000 }),
    enabled: () => true,
    capture: () => requests++,
    save: () => assert.fail(),
  });
  await auto.attach("old");
  assert.equal(requests, 0);
  const off = createAutoPlace({
    getEvent: () => ({ time: Date.now() }),
    enabled: () => false,
    capture: () => requests++,
    save: () => assert.fail(),
  });
  await off.attach("new");
  assert.equal(requests, 0);
});
test("permission failure and failed attachment do not reject or block care logging", async () => {
  for (const failCapture of [true, false]) {
    const reports = [];
    const auto = createAutoPlace({
      getEvent: () => ({ time: Date.now(), revision: 1 }),
      enabled: () => true,
      capture: async () => {
        if (failCapture) throw Error("Denied");
        return pin();
      },
      save: async () => {
        throw Error("Storage unavailable");
      },
      report: (_id, msg) => reports.push(msg),
    });
    await auto.attach("new");
    assert.equal(
      reports.at(-1),
      "Entry saved. Location unavailable this time.",
    );
  }
});
