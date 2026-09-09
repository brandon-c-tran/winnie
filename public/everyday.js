import { getTimes } from "./vendor/suncalc.js";

export const FOODS = ["Chicken", "Duck", "Lamb", "Beef", "Pork", "Sardine"];
export function normalizeFood(value) {
  const text = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}
export function foodChoices(events) {
  return [
    ...new Set(
      [
        ...FOODS,
        ...events
          .filter((e) => !e.deletedAt && e.type === "meal")
          .flatMap((e) => e.foods || []),
      ]
        .map(normalizeFood)
        .filter(Boolean),
    ),
  ];
}
export function sleepContext(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type).value;
  const solarDay = new Date(
    `${part("year")}-${part("month")}-${part("day")}T20:00:00Z`,
  );
  const { sunrise, sunset } = getTimes(solarDay, 37.7749, -122.4194);
  return {
    type: now < +sunrise || now >= +sunset ? "slumber" : "nap",
    sunrise: +sunrise,
    sunset: +sunset,
  };
}
export function notificationState({ supported, permission, local, server }) {
  if (!supported) return "unsupported";
  if (permission === "denied") return "blocked";
  if (permission === "granted" && local && server) return "on";
  if (local || server) return "repair";
  return "off";
}
export function photoCaption(e) {
  if (
    e.note?.trim() &&
    !["His finest work.", "A little moment with Winnie."].includes(
      e.note.trim(),
    )
  )
    return e.note.trim();
  if (e.type === "meal" && e.foods?.length) return e.foods.join(" + ");
  const labels = {
    pee: "Potty break",
    poop: "Poop break",
    moment: "Winnie",
    nap: "Nap time",
    slumber: "Night sleep",
    covered_gap: "Trainer visit",
  };
  const time = new Date(e.time).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${labels[e.type] || e.type[0].toUpperCase() + e.type.slice(1)} · ${time}`;
}
export function storyInsights(events, now = Date.now()) {
  const valid = events.filter((e) => !e.deletedAt && e.time <= now),
    since = now - 28 * 86400000;
  const recent = valid.filter((e) => e.time >= since),
    cards = [];
  const meals = recent.filter((e) => e.type === "meal"),
    tagged = meals.filter((e) => e.foods?.length),
    counts = new Map();
  for (const e of tagged)
    for (const food of new Set(e.foods.map(normalizeFood)))
      counts.set(food, (counts.get(food) || 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1]);
  if (top.length)
    cards.push({
      title: "What’s been in his bowl",
      body: `${top.map(([f, n]) => `${f} · ${n}`).join(" / ")}. Food is recorded for ${tagged.length} of ${meals.length} meals in the last 28 days.`,
      type: "meal",
    });
  const potty = recent.filter((e) => ["pee", "poop"].includes(e.type)),
    signaled = potty.filter(
      (e) => e.signal || e.tags?.includes("self-signaled"),
    );
  if (signaled.length)
    cards.push({
      title: "When he asks to go out",
      body: `He asked on ${signaled.filter((e) => e.signal === "He asked" || e.tags?.includes("self-signaled")).length} of ${signaled.length} potty entries with a signal recorded. ${potty.length - signaled.length} entries have no signal recorded.`,
      type: "poop",
    });
  const sleeps = recent.filter(
    (e) =>
      e.type === "slumber" &&
      Number.isFinite(e.end_time) &&
      e.end_time <= now &&
      e.end_time > e.time &&
      e.end_time - e.time <= 86400000,
  );
  if (sleeps.length >= 3) {
    const durations = sleeps
      .map((e) => (e.end_time - e.time) / 60000)
      .sort((a, b) => a - b);
    const mid = Math.floor(durations.length / 2),
      median =
        durations.length % 2
          ? durations[mid]
          : (durations[mid - 1] + durations[mid]) / 2;
    cards.push({
      title: "His recorded nights",
      body: `The middle recorded night lasted ${Math.floor(Math.round(median) / 60)}h ${Math.round(median) % 60}m across ${sleeps.length} completed entries in the last 28 days. This reflects logged intervals, not measured sleep.`,
      type: "slumber",
    });
  }
  const visits = recent.filter(
    (e) =>
      e.type === "covered_gap" &&
      (e.who === "trainer" || e.kind === "trainer") &&
      Number.isFinite(e.end_time) &&
      e.end_time > e.time &&
      e.end_time <= now,
  );
  if (visits.length)
    cards.push({
      title: "Time with his trainer",
      body: `${visits.length} completed ${visits.length === 1 ? "visit" : "visits"} logged in the last 28 days. Scheduled visits only count after someone confirms them.`,
      type: "covered_gap",
    });
  const photos = valid.filter((e) => e.photos?.length),
    total = photos.reduce((n, e) => n + e.photos.length, 0);
  const photoDays = new Set(
    photos.map((e) => new Date(e.time).toLocaleDateString()),
  ).size;
  if (total)
    cards.push({
      title: "His growing photo album",
      body: `${total} ${total === 1 ? "photo" : "photos"} across ${photoDays} ${photoDays === 1 ? "day" : "days"}. Each one stays with its original care entry.`,
      photos: true,
    });
  if (!cards.length)
    cards.push({
      title: "Start with what you already record",
      body: "Meal choices, potty signals, and completed sleep entries turn into specific summaries here. Older entries remain in the full history.",
    });
  return cards;
}
export function validateTrainerImport(value) {
  if (
    !value ||
    !Array.isArray(value.visits) ||
    value.visits.length > 100 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.through || "") ||
    !Number.isFinite(Date.parse(value.checkedAt))
  )
    throw new Error("Choose a valid trainer calendar export.");
  const ids = new Set();
  const visits = value.visits
    .map((v) => {
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(v.id) ||
        ids.has(v.id) ||
        typeof v.title !== "string" ||
        v.title.length > 120 ||
        !Number.isFinite(v.start) ||
        !Number.isFinite(v.end) ||
        v.start <= 0 ||
        v.end <= v.start ||
        v.end - v.start > 86400000
      )
        throw new Error(
          "A scheduled visit needs a valid title, start, and end.",
        );
      ids.add(v.id);
      return { id: v.id, title: v.title, start: v.start, end: v.end };
    })
    .sort((a, b) => a.start - b.start);
  return {
    source: "Google Calendar",
    checkedAt: value.checkedAt,
    through: value.through,
    visits,
  };
}
