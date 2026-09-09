import test from "node:test";
import assert from "node:assert/strict";
import {
  sleepContext,
  notificationState,
  foodChoices,
  storyInsights,
  validateTrainerImport,
} from "../public/everyday.js";
import { migrate, applyCommand } from "../netlify/lib/core.mjs";
const at = (s) => Date.parse(s),
  device = { id: "test", person: "brandon" };
const command = (id, kind, eventId, payload, expectedRevision) => ({
  protocol: 4,
  operationId: id,
  kind,
  eventId,
  payload,
  expectedRevision,
});
test("SF sleep suggestion follows sunrise and sunset across seasons and midnight", () => {
  for (const day of ["2026-01-08", "2026-06-08", "2026-11-01"]) {
    const { sunrise, sunset } = sleepContext(at(day + "T20:00:00Z"));
    assert.equal(sleepContext(sunrise - 1000).type, "slumber");
    assert.equal(sleepContext(sunrise + 1000).type, "nap");
    assert.equal(sleepContext(sunset - 1000).type, "nap");
    assert.equal(sleepContext(sunset + 1000).type, "slumber");
  }
  assert.equal(sleepContext(at("2026-09-08T08:00:00Z")).type, "slumber");
});
test("notification state requires both local and server subscription and permission", () => {
  const setup = {
    supported: true,
    permission: "granted",
    local: true,
    server: true,
  };
  assert.equal(notificationState(setup), "on");
  assert.equal(notificationState({ ...setup, server: false }), "repair");
  assert.equal(notificationState({ ...setup, local: false }), "repair");
  assert.equal(
    notificationState({ ...setup, permission: "denied" }),
    "blocked",
  );
  assert.equal(
    notificationState({ ...setup, supported: false }),
    "unsupported",
  );
});
test("custom foods survive commands and history choices without relabeling legacy meals", () => {
  const doc = migrate({
    events: [
      {
        id: "old-meal",
        type: "meal",
        time: Date.now() - 100000,
        note: "Breakfast",
      },
    ],
  });
  applyCommand(
    doc,
    command("meal-op", "create", "meal-new", {
      type: "meal",
      time: Date.now() - 1000,
      foods: ["  TURKEY ", "turkey", "Sardine"],
    }),
    device,
  );
  assert.deepEqual(doc.events[1].foods, ["Turkey", "Sardine"]);
  assert.equal(doc.events[0].foods, undefined);
  assert(foodChoices(doc.events).includes("Turkey"));
  assert.throws(
    () =>
      applyCommand(
        doc,
        command("bad-food", "edit", "meal-new", { foods: [""] }, 1),
        device,
      ),
    /food names/,
  );
});
test("calendar imports preserve planned status and leave existing care untouched", () => {
  const now = Date.now(),
    value = {
      checkedAt: new Date().toISOString(),
      through: "2026-10-08",
      visits: [
        {
          id: "calendar-1",
          title: "Training",
          start: now + 10000,
          end: now + 3610000,
        },
      ],
    };
  const doc = migrate({ events: [] });
  applyCommand(
    doc,
    command("schedule-op", "profile", null, { trainerSchedule: value }, 1),
    device,
  );
  assert.equal(doc.events.length, 0);
  assert.equal(doc.profile.trainerSchedule.visits.length, 1);
  assert.throws(
    () =>
      validateTrainerImport({
        ...value,
        visits: [...value.visits, ...value.visits],
      }),
    /scheduled visit/,
  );
  assert.throws(
    () =>
      applyCommand(
        doc,
        command(
          "schedule-bad",
          "profile",
          null,
          {
            trainerSchedule: {
              ...value,
              visits: [{ ...value.visits[0], end: 0 }],
            },
          },
          2,
        ),
        device,
      ),
    /scheduled visit/,
  );
});
test("insights exclude deleted/future entries and show missing food coverage", () => {
  const now = Date.now(),
    events = [
      { id: "1", type: "meal", time: now - 1000, foods: ["Chicken"] },
      { id: "2", type: "meal", time: now - 2000 },
      {
        id: "3",
        type: "meal",
        time: now - 2000,
        foods: ["Beef"],
        deletedAt: now,
      },
      { id: "4", type: "meal", time: now + 100000, foods: ["Duck"] },
    ];
  const card = storyInsights(events, now).find((c) => c.type === "meal");
  assert.match(card.body, /1 of 2/);
  assert.doesNotMatch(card.body, /Beef|Duck/);
});
