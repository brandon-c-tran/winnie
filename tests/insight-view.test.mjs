import test from "node:test";
import assert from "node:assert/strict";
import { rhythmInsights } from "../public/insights.js";
import { insightsView } from "../public/insight-view.js";
const now = Date.parse("2026-09-08T20:00:00-07:00");
test("every insight topic handles empty history without fabricated times or quantities", () => {
  const d = rhythmInsights([], 28, now);
  for (const topic of ["poop", "pee", "nights"]) {
    const html = insightsView(d, topic);
    assert.doesNotMatch(html, /NaN|Infinity|null|undefined/);
    assert.doesNotMatch(html, /His busiest window|Bed around/);
    assert.match(html, /0 entries in his history/);
  }
});
test("a weak meal association does not become a planning suggestion despite enough pairs", () => {
  const rows = [];
  for (let i = 1; i <= 8; i++) {
    const time = Date.parse(`2026-08-${20 + i}T07:00:00-07:00`);
    rows.push(
      { id: "meal" + i, type: "meal", time },
      { id: "poop" + i, type: "poop", time: time + 3600000 },
    );
    rows.push(
      { id: "lunch" + i, type: "meal", time: time + 5 * 3600000 },
      { id: "dinner" + i, type: "meal", time: time + 11 * 3600000 },
    );
  }
  const d = rhythmInsights(rows, 28, now);
  assert.equal(d.afterMeals.enough, true);
  assert.equal(d.afterMeals.representative, false);
  const html = insightsView(d, "poop");
  assert.match(html, /too patchy to plan around/);
  assert.doesNotMatch(html, /starting window for his next break/);
});
