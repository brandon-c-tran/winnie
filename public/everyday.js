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
