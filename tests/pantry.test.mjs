import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePantry,
  stockOf,
  mealsPerDay,
  pantryState,
  rotation,
  foodPoopStats,
} from "../public/pantry.js";
import { migrate, applyCommand } from "../netlify/lib/core.mjs";

const DAY = 86400000,
  now = Date.UTC(2026, 9, 12, 20);
let n = 0;
const meal = (time, ...foods) => ({ id: `m${n++}`, type: "meal", time, foods });
const food = (name, servings, at, extra = {}) => ({
  id: name.toLowerCase(),
  name,
  perPackage: 14,
  link: "",
  count: { servings, at },
  ...extra,
});

test("stock counts down from the last count, splitting mixed meals", () => {
  const beef = food("Beef", 10, now - 3 * DAY);
  const events = [
    meal(now - 4 * DAY, "Beef"), // before the count: ignored
    meal(now - 2 * DAY, "Beef"),
    meal(now - DAY, "beef", "Chicken"), // half a serving each
    { ...meal(now - DAY / 2, "Beef"), deletedAt: 1 },
  ];
  assert.equal(stockOf(beef, events, now), 8.5);
});

test("meals per day comes from recent logs, with a sane default", () => {
  assert.equal(mealsPerDay([], now), 2);
  const events = [];
  for (let d = 1; d <= 7; d++) events.push(meal(now - d * DAY, "Beef"), meal(now - d * DAY + 3600000, "Pork"));
  assert.equal(mealsPerDay(events, now), 2);
});

test("pantry says when to order: days left within delivery time plus slack", () => {
  const pantry = { foods: [food("Beef", 9, now - DAY)], leadDays: 3, ordered: null };
  const events = [];
  for (let d = 1; d <= 6; d++) events.push(meal(now - d * DAY - 1, "Pork"), meal(now - d * DAY - 2, "Pork"));
  const s = pantryState(pantry, events, now);
  assert.equal(s.daysLeft, 4.5);
  assert.equal(s.low, true);
  const ordered = pantryState({ ...pantry, ordered: { by: "kim", at: now - DAY } }, events, now);
  assert.equal(ordered.low, false);
  assert.equal(ordered.ordered.by, "kim");
});

test("rotation puts the food eaten longest ago first", () => {
  const events = [meal(now - 3 * DAY, "Beef"), meal(now - DAY, "Chicken"), meal(now - 2 * DAY, "Pork")];
  assert.deepEqual(rotation(["Chicken", "Beef", "Pork", "Lamb"], events), ["Lamb", "Beef", "Pork", "Chicken"]);
});

test("food and poop quality pairs each meal with the next poop within a day", () => {
  const events = [
    meal(now - 10 * 3600000, "Pork"),
    { id: "p1", type: "poop", time: now - 8 * 3600000, tags: ["soft"] },
    meal(now - 6 * 3600000, "Beef"),
    { id: "p2", type: "poop", time: now - 4 * 3600000, tags: ["firm"] },
    meal(now - 2 * 3600000, "Beef"),
    { id: "p3", type: "poop", time: now - 3600000 }, // untagged
  ];
  const stats = foodPoopStats(events);
  assert.deepEqual(stats.find((r) => r.food === "Pork"), { food: "Pork", firm: 0, soft: 1, loose: 0, tagged: 1 });
  assert.equal(stats.find((r) => r.food === "Beef").firm, 1);
});

test("validation keeps good data and rejects bad links and duplicates", () => {
  const ok = validatePantry({
    foods: [food("Beef", 3, now, { link: "https://www.amazon.com/dp/B000" })],
    leadDays: 3,
    ordered: null,
  });
  assert.equal(ok.foods[0].link, "https://www.amazon.com/dp/B000");
  assert.throws(() => validatePantry({ foods: [food("Beef", 3, now, { link: "javascript:alert(1)" })], leadDays: 3, ordered: null }));
  assert.throws(() => validatePantry({ foods: [food("Beef", 3, now), { ...food("beef", 1, now), id: "b2" }], leadDays: 3, ordered: null }));
});

test("the server stores a valid pantry in shared settings and rejects a bad one", () => {
  const doc = migrate({ events: [] }),
    device = { id: "d1", person: "brandon" };
  const cmd = (id, pantry) => ({
    protocol: 4,
    operationId: id,
    kind: "profile",
    eventId: null,
    payload: { pantry },
    expectedRevision: doc.profile.revision,
  });
  applyCommand(doc, cmd("p1", { foods: [food("Beef", 14, now)], leadDays: 3, ordered: null }), device);
  assert.equal(doc.profile.pantry.foods[0].name, "Beef");
  applyCommand(doc, cmd("hide-food", { ...doc.profile.pantry, hiddenFoods: [" BEEF ", "beef"] }), device);
  assert.deepEqual(doc.profile.pantry.hiddenFoods, ["beef"]);
  assert.equal(doc.profile.pantry.foods[0].count.servings, 14);
  assert.throws(() => validatePantry({ ...doc.profile.pantry, hiddenFoods: [null] }), /Food options/);
  assert.throws(() => applyCommand(doc, cmd("p2", { foods: [], leadDays: 0, ordered: null }), device), /Delivery time/);
});
