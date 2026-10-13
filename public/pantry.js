// Food on hand, worked out from the log. Each food has a count taken at some moment
// (servings on hand then); every meal logged with that food since takes a serving off.
// Shared by the app and the server (validation).
const DAY = 86400000;
export const QUALITY = ["firm", "soft", "loose"];
const norm = (s) => String(s || "").trim().toLowerCase();

export function validatePantry(value) {
  const fail = (m = "This food update is invalid. Refresh and try again.") => {
    throw Error(m);
  };
  if (!value || typeof value !== "object" || !Array.isArray(value.foods) || value.foods.length > 20) fail();
  const ids = new Set(),
    names = new Set();
  const foods = value.foods.map((f) => {
    if (
      !f ||
      typeof f.id !== "string" ||
      !/^[\w-]{1,60}$/.test(f.id) ||
      ids.has(f.id) ||
      typeof f.name !== "string" ||
      !f.name.trim() ||
      f.name.length > 40 ||
      names.has(norm(f.name)) ||
      !Number.isInteger(f.perPackage) ||
      f.perPackage < 1 ||
      f.perPackage > 500 ||
      typeof f.link !== "string" ||
      f.link.length > 1000 ||
      (f.link && !/^https:\/\//.test(f.link)) ||
      !f.count ||
      !Number.isFinite(f.count.servings) ||
      f.count.servings < 0 ||
      f.count.servings > 5000 ||
      !Number.isFinite(f.count.at) ||
      f.count.at <= 0
    )
      fail("Each food needs a name, meals per package, and a count.");
    ids.add(f.id);
    names.add(norm(f.name));
    return {
      id: f.id,
      name: f.name.trim(),
      perPackage: f.perPackage,
      link: f.link,
      count: { servings: Math.round(f.count.servings * 10) / 10, at: f.count.at },
    };
  });
  if (!Number.isInteger(value.leadDays) || value.leadDays < 1 || value.leadDays > 21) fail("Delivery time must be 1 to 21 days.");
  const o = value.ordered;
  if (!(o === null || (o && ["brandon", "kim"].includes(o.by) && Number.isFinite(o.at) && o.at > 0))) fail();
  return { foods, leadDays: value.leadDays, ordered: o ? { by: o.by, at: o.at } : null };
}

export const emptyPantry = () => ({ foods: [], leadDays: 3, ordered: null });

const meals = (events) =>
  events.filter((e) => !e.deletedAt && e.type === "meal" && Number.isFinite(e.time));

// Servings of one food left now.
export function stockOf(food, events, now = Date.now()) {
  let used = 0;
  for (const e of meals(events)) {
    if (e.time <= food.count.at || e.time > now) continue;
    const foods = (e.foods || []).map(norm);
    if (foods.includes(norm(food.name))) used += 1 / foods.length;
  }
  return Math.max(0, food.count.servings - used);
}

// Average meals a day over the last two weeks of logs (2 when there is too little to tell).
export function mealsPerDay(events, now = Date.now()) {
  const recent = meals(events).filter((e) => e.time > now - 14 * DAY && e.time <= now);
  const days = new Set(recent.map((e) => new Date(e.time).toDateString())).size;
  if (days < 4) return 2;
  return Math.max(0.5, recent.length / days);
}

export function pantryState(pantry, events, now = Date.now()) {
  const p = pantry || emptyPantry(),
    rate = mealsPerDay(events, now);
  const foods = p.foods.map((f) => {
    const left = stockOf(f, events, now);
    return { ...f, left, days: left / rate };
  });
  const totalLeft = foods.reduce((n, f) => n + f.left, 0),
    daysLeft = foods.length ? totalLeft / rate : null;
  const ordered = p.ordered && now - p.ordered.at < 10 * DAY ? p.ordered : null;
  return {
    foods,
    rate,
    totalLeft,
    daysLeft,
    leadDays: p.leadDays,
    ordered,
    // Time to order: food left won't outlast delivery plus two days of slack.
    low: daysLeft !== null && daysLeft <= p.leadDays + 2 && !ordered,
  };
}

// Food names, the one eaten longest ago (or never) first.
export function rotation(names, events) {
  const last = new Map();
  for (const e of meals(events)) for (const f of e.foods || []) last.set(norm(f), Math.max(last.get(norm(f)) || 0, e.time));
  return [...names].sort((a, b) => (last.get(norm(a)) || 0) - (last.get(norm(b)) || 0));
}
export function lastEaten(name, events) {
  let t = 0;
  for (const e of meals(events)) if ((e.foods || []).map(norm).includes(norm(name))) t = Math.max(t, e.time);
  return t || null;
}

// For each food: the first poop within 24 hours after a meal of it, by tagged quality.
export function foodPoopStats(events) {
  const sorted = events.filter((e) => !e.deletedAt && Number.isFinite(e.time)).sort((a, b) => a.time - b.time);
  const out = new Map();
  for (let i = 0; i < sorted.length; i++) {
    const meal = sorted[i];
    if (meal.type !== "meal" || !meal.foods?.length) continue;
    const poop = sorted.slice(i + 1).find((e) => e.type === "poop" || (e.type === "meal" && e.time > meal.time));
    if (!poop || poop.type !== "poop" || poop.time - meal.time > DAY) continue;
    const quality = QUALITY.find((q) => poop.tags?.includes(q));
    if (!quality) continue;
    for (const f of meal.foods) {
      const key = f.trim();
      const row = out.get(norm(key)) || { food: key, firm: 0, soft: 0, loose: 0, tagged: 0 };
      row[quality]++;
      row.tagged++;
      out.set(norm(key), row);
    }
  }
  return [...out.values()].sort((a, b) => b.tagged - a.tagged);
}
