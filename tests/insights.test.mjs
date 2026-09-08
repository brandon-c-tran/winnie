import test from "node:test";
import assert from "node:assert/strict";
import { recordedPatterns } from "../public/insights.js";
test("history patterns separate missing logs, valid records, and tagged trips", () => {
  const now = new Date(2026, 8, 7, 12).getTime();
  const data = recordedPatterns(
    [
      { id: "a", type: "pee", time: now, signal: "He asked" },
      { id: "b", type: "poop", time: now },
      { id: "c", type: "nap", time: now, end_time: now - 1 },
      { id: "d", type: "meal", time: now, deletedAt: now },
      { id: "e", type: "pee", time: now - 35 * 86400000 },
    ],
    28,
    now,
  );
  assert.equal(data.total, 3);
  assert.equal(data.activeDays, 1);
  assert.equal(data.counts.pee.previous, 1);
  assert.equal(data.series.length, 28);
  assert.equal(data.series.filter((d) => d.count === 0).length, 27);
  assert.equal(data.invalidSleep, 1);
  assert.equal(data.tagged, 1);
  assert.equal(data.selfAsked, 1);
});
