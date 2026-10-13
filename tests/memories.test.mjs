import test from "node:test";
import assert from "node:assert/strict";
import {
  milestones,
  weekStats,
  onThisDay,
  yearRecap,
} from "../public/memories.js";

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
let n = 0;
const ev = (type, time, extra = {}) => ({
  id: `e${n++}`,
  type,
  time,
  ...extra,
});

test("milestones count real logs at round numbers, in time order", () => {
  const start = at(2026, 4, 1);
  const events = Array.from({ length: 120 }, (_, i) =>
    ev("pee", start + i * 3600000),
  );
  const list = milestones(events, { now: at(2026, 10, 12) });
  const pee = list.find((m) => m.id === "pee-100");
  assert.equal(pee.title, "100th pee logged");
  assert.equal(pee.eventId, events[99].id);
  assert.ok(!list.some((m) => m.id === "pee-500"));
});

test("first bath, first walk, and photos are milestones; deleted entries are not", () => {
  const events = [
    ev("grooming", at(2026, 9, 1), { careTitle: "Bath" }),
    ev("walk", at(2026, 9, 2)),
    ev("pee", at(2026, 9, 3), { photos: [{ id: "p1" }] }),
    ev("walk", at(2026, 9, 1, 8), { deletedAt: 1 }),
  ];
  const titles = milestones(events, { now: at(2026, 10, 1) }).map(
    (m) => m.title,
  );
  assert.ok(titles.includes("First bath logged"));
  assert.ok(titles.includes("First walk logged"));
  assert.ok(titles.includes("First photo"));
  assert.equal(
    milestones(events, { now: at(2026, 10, 1) }).find((m) => m.id === "walk-1")
      .time,
    at(2026, 9, 2),
  );
});

test("a first log in a new city is a milestone, home is not", () => {
  const sf = { id: "sf", name: "San Francisco" },
    sc = { id: "sc", name: "Santa Cruz" };
  const events = [
    ev("pee", at(2026, 6, 1)),
    ev("pee", at(2026, 6, 2)),
    ev("pee", at(2026, 7, 4), { c: 1 }),
  ];
  const cityOf = (e) => (e.c ? sc : sf);
  const titles = milestones(events, { cityOf, now: at(2026, 10, 1) }).map(
    (m) => m.title,
  );
  assert.ok(titles.includes("First log in Santa Cruz"));
  assert.ok(!titles.includes("First log in San Francisco"));
});

test("one year of logs appears only after a full year", () => {
  const events = [ev("pee", at(2025, 10, 1))];
  assert.ok(
    !milestones(events, { now: at(2026, 9, 30) }).some(
      (m) => m.id === "years-1",
    ),
  );
  assert.ok(
    milestones(events, { now: at(2026, 10, 2) }).some(
      (m) => m.title === "One year of logs",
    ),
  );
});

test("weekStats covers Monday to Sunday and picks the most-reacted photo", () => {
  const now = at(2026, 10, 12, 20); // a Monday
  const events = [
    ev("pee", at(2026, 10, 12, 8)),
    ev("poop", at(2026, 10, 12, 9), { photos: [{ id: "a" }] }),
    ev("meal", at(2026, 10, 12, 10), {
      photos: [{ id: "b" }],
      reactions: { kim: { emoji: "❤️" } },
    }),
    ev("pee", at(2026, 10, 11, 8)), // Sunday: previous week
  ];
  const w = weekStats(events, now);
  assert.equal(w.counts.pee, 1);
  assert.equal(w.counts.photos, 2);
  assert.equal(w.best.photoId, "b");
  assert.equal(new Date(w.start).getDay(), 1);
});

test("onThisDay prefers whole years, then falls back to months", () => {
  const now = at(2026, 10, 12, 9);
  const monthAgo = ev("moment", at(2026, 9, 12), { photos: [{ id: "m" }] });
  assert.deepEqual(
    onThisDay([monthAgo], now).map((g) => [g.ago, g.unit]),
    [[1, "month"]],
  );
  const yearAgo = ev("moment", at(2025, 10, 12), { photos: [{ id: "y" }] });
  assert.deepEqual(
    onThisDay([monthAgo, yearAgo], now).map((g) => [g.ago, g.unit]),
    [[1, "year"]],
  );
  assert.deepEqual(
    onThisDay([ev("moment", at(2026, 9, 13), { photos: [{ id: "x" }] })], now),
    [],
  );
});

test("yearRecap totals one calendar year", () => {
  const events = [
    ev("pee", at(2026, 1, 5)),
    ev("pee", at(2026, 1, 5)),
    ev("grooming", at(2026, 3, 1), { careTitle: "Bath" }),
    ev("moment", at(2026, 5, 1), { photos: [{ id: "p" }] }),
    ev("pee", at(2025, 12, 31)),
  ];
  const r = yearRecap(events, 2026, { now: at(2026, 10, 1) });
  assert.equal(r.entries, 4);
  assert.equal(r.byType.pee, 2);
  assert.equal(r.byType.bath, 1);
  assert.equal(r.busiestDay.entries, 2);
  assert.equal(r.firstPhoto.photoId, "p");
});
