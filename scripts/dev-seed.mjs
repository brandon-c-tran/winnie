// Example histories for local development and browser tests. Never used in production.
const DAY = 86400000;
const rand = (seed) => () =>
  ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export function smallLog(now = Date.now()) {
  return {
    schemaVersion: 3,
    events: [
      {
        id: "demo-pee",
        type: "pee",
        time: now - 3600000,
        who: "us",
        note: "",
        tags: ["outdoors"],
        source: "manual",
      },
      {
        id: "demo-meal",
        type: "meal",
        time: now - 7200000,
        who: "us",
        note: "Breakfast",
        tags: [],
        source: "manual",
      },
    ],
  };
}

// About four months of plausible care, similar in size to the real log.
export function largeLog(now = Date.now(), days = 150) {
  const r = rand(42),
    events = [];
  let n = 0;
  const add = (type, time, extra = {}) =>
    events.push({
      id: `seed-${n++}`,
      type,
      time: Math.round(time),
      who: "us",
      note: "",
      tags: [],
      source: "manual",
      ...extra,
    });
  const start = new Date(now - days * DAY);
  start.setHours(0, 0, 0, 0);
  for (let d = 0; d < days; d++) {
    const day = start.getTime() + d * DAY;
    if (day > now) break;
    const at = (h) => day + h * 3600000 + r() * 1800000;
    for (const h of [6.8, 10.5, 13.5, 17, 21.5])
      if (r() > 0.12)
        add("pee", at(h), { tags: r() > 0.3 ? ["outdoors"] : [] });
    for (const h of [7.6, 18.2]) if (r() > 0.2) add("poop", at(h));
    for (const h of [7, 17.5])
      if (r() > 0.1)
        add("meal", at(h), { foods: [r() > 0.5 ? "Chicken" : "Duck"] });
    if (r() > 0.4) {
      const t = at(9.5);
      add("nap", t, { end_time: t + (45 + r() * 60) * 60000 });
    }
    if (d % 3 === 0) {
      const t = at(16.5);
      add("walk", t, { end_time: t + (20 + r() * 25) * 60000 });
    }
    if (d % 21 === 4) add("medication", at(8.2), { note: "Heartworm" });
    if (d % 30 === 9) add("enrichment", at(11), { note: "Trainer" });
  }
  return { schemaVersion: 3, events: events.filter((e) => e.time < now) };
}
