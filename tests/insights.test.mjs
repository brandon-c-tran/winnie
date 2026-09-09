import test from "node:test";
import assert from "node:assert/strict";
import {
  rhythmInsights,
  localParts,
  clockMinute,
  durationLabel,
} from "../public/insights.js";
const at = (s) => Date.parse(s),
  now = at("2026-09-08T20:00:00-07:00");
const event = (id, type, time, extra = {}) => ({
  id,
  type,
  time: at(time),
  ...extra,
});
test("SF calendar windows include today, exclude future/deleted, and do not fill missing days", () => {
  const d = rhythmInsights(
    [
      event("a", "pee", "2026-09-08T00:00:00-07:00"),
      event("b", "poop", "2026-09-02T00:00:00-07:00"),
      event("c", "pee", "2026-09-01T23:59:59-07:00"),
      event("d", "meal", "2026-09-08T20:00:01-07:00"),
      event("e", "meal", "2026-09-07T10:00:00-07:00", { deletedAt: now }),
      { id: "bad", type: "pee", time: NaN },
    ],
    7,
    now,
  );
  assert.equal(d.start, "2026-09-02");
  assert.equal(d.total, 2);
  assert.equal(d.activeDays, 2);
  assert.equal(d.pastPotty.pee.count, 1);
  assert.equal(d.allCount, 3);
  assert.equal(localParts(at("2026-11-01T08:30:00Z")).minute, 90);
  assert.equal(localParts(at("2026-11-01T09:30:00Z")).minute, 90);
});
test("meal pairing is chronological, never reuses a meal/poop, and waits for a complete window", () => {
  const d = rhythmInsights(
    [
      event("poop2", "poop", "2026-09-08T10:45:00-07:00"),
      event("meal1", "meal", "2026-09-08T08:00:00-07:00"),
      event("meal2", "meal", "2026-09-08T10:00:00-07:00"),
      event("poop1", "poop", "2026-09-08T10:30:00-07:00"),
      event("far", "poop", "2026-09-08T15:00:00-07:00"),
      event("recent", "meal", "2026-09-08T18:00:00-07:00"),
      event("recent-poop", "poop", "2026-09-08T18:30:00-07:00"),
    ],
    28,
    now,
  ).afterMeals;
  assert.equal(d.meals, 2);
  assert.equal(d.waiting, 1);
  assert.deepEqual(
    d.pairs.map((p) => [p.meal, p.poop]),
    [["meal2", "poop1"]],
  );
  assert.equal(d.median, 30);
  assert.equal(d.enough, false);
});
test("meal pairing crosses midnight but does not bridge an uncertain meal", () => {
  const d = rhythmInsights(
    [
      event("a", "meal", "2026-09-06T23:30:00-07:00"),
      event("b", "poop", "2026-09-07T00:30:00-07:00"),
      event("c", "meal", "2026-09-07T08:00:00-07:00"),
      event("d", "meal", "2026-09-07T09:00:00-07:00", {
        time_precision: "unknown",
      }),
      event("e", "poop", "2026-09-07T09:30:00-07:00"),
    ],
    28,
    now,
  );
  assert.deepEqual(
    d.afterMeals.pairs.map((p) => [p.meal, p.poop]),
    [["a", "b"]],
  );
  assert.equal(d.afterMeals.median, 60);
});
test("a burst of logs or tied peak is not promoted as a dependable timing pattern", () => {
  const burst = Array.from({ length: 15 }, (_, i) =>
    event("b" + i, "poop", "2026-09-08T08:00:00-07:00"),
  );
  assert.equal(rhythmInsights(burst, 28, now).potty.poop.enough, false);
  const balanced = Array.from({ length: 6 }, (_, i) => [
    event("a" + i, "poop", `2026-09-0${i + 1}T08:00:00-07:00`),
    event("b" + i, "poop", `2026-09-0${i + 1}T18:00:00-07:00`),
  ]).flat();
  const p = rhythmInsights(balanced, 28, now).potty.poop;
  assert.equal(p.enough, true);
  assert.equal(p.concentrated, false);
});
test("daytime spacing excludes night, cross-day and excessive gaps", () => {
  const p = rhythmInsights(
    [
      event("a", "pee", "2026-09-06T21:00:00-07:00"),
      event("b", "pee", "2026-09-07T07:00:00-07:00"),
      event("c", "pee", "2026-09-07T07:05:00-07:00"),
      event("d", "pee", "2026-09-07T09:00:00-07:00"),
      event("e", "pee", "2026-09-07T18:00:00-07:00"),
      event("f", "pee", "2026-09-07T23:00:00-07:00"),
    ],
    28,
    now,
  ).potty.pee;
  assert.deepEqual(
    p.gaps.map((g) => [g.before, g.after]),
    [["c", "d"]],
  );
  assert.equal(p.gap.median, 115);
});
test("nights handle midnight, exclude invalid/open intervals, and keep earlier periods separate", () => {
  const rows = [
    event("a", "slumber", "2026-09-01T23:50:00-07:00", {
      end_time: at("2026-09-02T07:00:00-07:00"),
    }),
    event("b", "slumber", "2026-09-03T00:10:00-07:00", {
      end_time: at("2026-09-03T07:10:00-07:00"),
    }),
    event("c", "slumber", "2026-09-04T23:00:00-07:00", {
      end_time: at("2026-09-06T07:00:00-07:00"),
    }),
    event("d", "slumber", "2026-09-05T23:00:00-07:00", {
      end_time: at("2026-09-05T22:00:00-07:00"),
    }),
    event("e", "slumber", "2026-09-06T23:00:00-07:00"),
    event("f", "slumber", "2026-09-07T23:00:00-07:00", {
      end_time: now + 10000,
    }),
  ];
  const d = rhythmInsights(rows, 28, now);
  assert.equal(clockMinute(d.night.bed.median), "12am");
  assert.equal(clockMinute(d.night.wake.median), "7:05am");
  assert.equal(d.night.omitted, 4);
  assert.equal(d.oldNight.count, 0);
  assert.deepEqual(d.night.ids, ["a", "b"]);
  assert.equal(d.night.enough, false);
});
test("no input records are changed and every evidence id is from an eligible record", () => {
  const rows = Object.freeze([
    Object.freeze(event("a", "pee", "2026-09-05T08:00:00-07:00")),
  ]);
  assert.deepEqual(rhythmInsights(rows, 28, now).potty.pee.ids, ["a"]);
  const empty = rhythmInsights([], 28, now);
  assert.equal(empty.first, null);
  assert.equal(empty.night.bed.median, null);
  assert.equal(empty.afterMeals.median, null);
  assert.equal(durationLabel(119.7), "2h");
});
