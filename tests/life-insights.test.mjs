import test from "node:test";
import assert from "node:assert/strict";
import { lifetimeInsights } from "../public/life-insights.js";
const now = Date.parse("2026-03-10T12:00Z");
const event = (id, type, day, extra = {}) => ({
  id,
  type,
  time: Date.parse(day + "T18:00Z"),
  timezone: "America/Los_Angeles",
  ...extra,
});
test("lifetime plots preserve blank months, activity denominators and explicit bathroom labels", () => {
  const rows = [
    event("a", "pee", "2025-10-06", { note: "indoors" }),
    event("b", "pee", "2025-10-06", { note: "accident" }),
    event("c", "pee", "2025-10-07", { note: "outdoors" }),
    event("d", "poop", "2025-10-07"),
    event("bad", "pee", "2025-10-07", { provenance: { uncertainType: true } }),
    event("gone", "pee", "2025-10-07", { deletedAt: 1 }),
    event("future", "pee", "2027-01-01"),
  ];
  const d = lifetimeInsights(rows, now),
    oct = d.months.find((m) => m.month === "2025-10");
  assert.equal(d.months[0].month, "2025-07");
  assert.equal(d.months.at(-1).month, "2026-03");
  assert.equal(oct.pee.median, 1.5);
  assert.equal(oct.poop.median, 1);
  assert.equal(oct.indoor, 1);
  assert.equal(oct.outdoor, 1);
  assert.equal(oct.unknown, 2);
  assert.equal(oct.accidents, 1);
  assert.equal(oct.days.size, 2);
  assert.equal(d.months.find((m) => m.month === "2025-11").pee.median, null);
  assert.equal(d.months.at(-1).elapsedDays, 10);
});
test("clock uncertainty, local timezone, completed nights and photo capture dates remain separate", () => {
  const p = event("photo", "moment", "2026-02-01", {
    photos: [
      {
        id: "p",
        metadata: {
          capturedAt: Date.parse("2025-09-05T12:00Z"),
          wall: "2025-09-05T12:00",
        },
      },
    ],
  });
  const rows = [
    p,
    event("clock", "pee", "2025-12-10", { timezone: "America/Chicago" }),
    event("unknown", "pee", "2025-12-10", { time_precision: "date" }),
    event("night", "slumber", "2025-12-10", {
      end_time: Date.parse("2025-12-11T04:00Z"),
    }),
    event("open", "slumber", "2025-12-11"),
    event("long", "slumber", "2025-12-12", {
      end_time: Date.parse("2025-12-14T04:00Z"),
    }),
  ];
  const d = lifetimeInsights(rows, now),
    dec = d.months.find((m) => m.month === "2025-12");
  assert.equal(dec.pee.timed, 1);
  assert.equal(dec.pee.bins[6], 1);
  assert.equal(dec.nightMedian, 10);
  assert.equal(dec.nights.length, 1);
  assert.equal(d.months.find((m) => m.month === "2025-09").photos.length, 1);
});
test("places accumulate once by earliest available day without treating repeated records as visits", () => {
  const d = lifetimeInsights(
    [
      event("a", "pee", "2025-10-01", { location: "Austin" }),
      event("b", "poop", "2025-11-01", { location: "Austin" }),
      event("c", "pee", "2025-12-01", { location: "Dallas" }),
    ],
    now,
  );
  assert.equal(d.months.find((m) => m.month === "2025-10").cumulativePlaces, 1);
  assert.equal(d.months.find((m) => m.month === "2025-11").places.length, 0);
  assert.equal(d.months.at(-1).cumulativePlaces, 2);
});
