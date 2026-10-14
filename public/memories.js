// Memories built from the log: milestones, the week's postcard numbers, on this day, and the
// year recap. Everything is counted from saved entries; nothing is inferred or invented.
const DAY = 86400000;
const live = (events) =>
  events
    .filter((e) => !e.deletedAt && Number.isFinite(e.time))
    .sort((a, b) => a.time - b.time);
export const localDay = (time) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const groomTitle = (e) =>
  String(e.careTitle || "")
    .trim()
    .toLowerCase();
const nth = (n) => (n === 1 ? "First" : `${n.toLocaleString("en-US")}th`);

const COUNTED = {
  pee: { label: "pee", at: [100, 500, 1000, 2000, 3000, 5000] },
  poop: { label: "poop", at: [100, 500, 1000, 2000, 3000] },
  meal: { label: "meal", at: [100, 500, 1000, 2000] },
  walk: { label: "walk", at: [1, 10, 50, 100, 250, 500] },
  medication: { label: "medication", at: [1, 25, 100] },
  enrichment: { label: "training session", at: [1, 10, 50] },
};
const GROOMED = [1, 10, 25, 50];
const PHOTOS = [1, 10, 50, 100, 250, 500];
const DAYS = [30, 100, 200, 365, 500, 1000];

// cityOf(event) -> { id, name } | null, from the offline city directory (optional).
export function milestones(events, { cityOf = null, now = Date.now() } = {}) {
  const all = live(events).filter((e) => e.time <= now),
    out = [],
    counts = new Map(),
    days = new Set(),
    cities = new Map();
  let photos = 0;
  const add = (id, title, e, time = e.time) =>
    out.push({ id, title, time, eventId: e.id });
  for (const e of all) {
    const rule = COUNTED[e.type];
    const key = e.type === "grooming" ? `grooming:${groomTitle(e)}` : e.type;
    const n = (counts.get(key) || 0) + 1;
    counts.set(key, n);
    if (rule?.at.includes(n))
      add(`${e.type}-${n}`, `${nth(n)} ${rule.label} logged`, e);
    if (e.type === "grooming" && groomTitle(e) && GROOMED.includes(n))
      add(`${key}-${n}`, `${nth(n)} ${groomTitle(e)} logged`, e);
    for (let i = 0; i < (e.photos?.length || 0); i++) {
      photos++;
      if (PHOTOS.includes(photos))
        add(`photo-${photos}`, `${nth(photos)} photo`, e);
    }
    const day = localDay(e.time);
    if (!days.has(day)) {
      days.add(day);
      if (DAYS.includes(days.size))
        add(`days-${days.size}`, `${days.size} days with logs`, e);
    }
    const city = cityOf?.(e);
    if (city && !cities.has(city.id))
      cities.set(city.id, { city, e, count: 0 });
    if (city) cities.get(city.id).count++;
  }
  // The city with the most logs is home; every other city's first log is a milestone.
  const home = [...cities.values()].sort((a, b) => b.count - a.count)[0];
  for (const { city, e } of cities.values())
    if (city.id !== home?.city.id)
      add(`city-${city.id}`, `First log in ${city.name}`, e);
  const first = all[0];
  if (first)
    for (let years = 1; years <= 20; years++) {
      const date = new Date(first.time);
      date.setFullYear(date.getFullYear() + years);
      if (+date > now) break;
      add(
        `years-${years}`,
        years === 1 ? "One year of logs" : `${years} years of logs`,
        first,
        +date,
      );
    }
  return out.sort((a, b) => b.time - a.time);
}

// Monday-to-Sunday week containing `now`, with counts and the best photo.
export function weekStats(events, now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const start = +d,
    end = start + 7 * DAY;
  const week = live(events).filter(
    (e) => e.time >= start && e.time < end && e.time <= now,
  );
  const count = (pred) => week.filter(pred).length;
  const withPhotos = week.filter((e) => e.photos?.length);
  const reactions = (e) => Object.keys(e.reactions || {}).length;
  const best = withPhotos.sort(
    (a, b) => reactions(b) - reactions(a) || b.time - a.time,
  )[0];
  return {
    start,
    end: end - 1,
    counts: {
      pee: count((e) => e.type === "pee"),
      poop: count((e) => e.type === "poop"),
      meal: count((e) => e.type === "meal"),
      walk: count((e) => e.type === "walk"),
      grooming: count((e) => e.type === "grooming"),
      photos: withPhotos.reduce((n, e) => n + e.photos.length, 0),
    },
    days: new Set(week.map((e) => localDay(e.time))).size,
    byPerson: {
      brandon: count((e) => e.loggedBy === "brandon"),
      kim: count((e) => e.loggedBy === "kim"),
    },
    best: best
      ? { eventId: best.id, photoId: best.photos[0].id, time: best.time }
      : null,
  };
}

// Photos from this date in earlier years; if there are none yet, the same date in earlier months.
export function onThisDay(events, now = Date.now()) {
  const today = new Date(now),
    photos = live(events).filter(
      (e) => e.photos?.length && e.time < now - DAY / 2,
    );
  const sameDay = (e, months) => {
    const t = e.photoDay ? new Date(e.photoDay+"T12:00") : new Date(e.time),
      target = new Date(today);
    target.setMonth(target.getMonth() - months);
    return (
      t.getFullYear() === target.getFullYear() &&
      t.getMonth() === target.getMonth() &&
      t.getDate() === target.getDate() &&
      target.getDate() === today.getDate()
    );
  };
  for (const unit of [12, 1]) {
    const groups = [];
    for (let k = 1; k <= (unit === 12 ? 30 : 11); k++) {
      const items = photos.filter((e) => sameDay(e, k * unit));
      if (items.length)
        groups.push({
          ago: k,
          unit: unit === 12 ? "year" : "month",
          items: items.reverse(),
        });
    }
    if (groups.length) return groups;
  }
  return [];
}

export function yearRecap(events, year, { now = Date.now() } = {}) {
  const inYear = live(events).filter(
    (e) => new Date(e.time).getFullYear() === year && e.time <= now,
  );
  const byType = {};
  for (const e of inYear) {
    const key = e.type === "grooming" ? groomTitle(e) || "grooming" : e.type;
    byType[key] = (byType[key] || 0) + 1;
  }
  const perDay = new Map();
  for (const e of inYear)
    perDay.set(localDay(e.time), (perDay.get(localDay(e.time)) || 0) + 1);
  const busiest = [...perDay].sort((a, b) => b[1] - a[1])[0] || null;
  const photos = inYear.filter((e) => e.photos?.length);
  return {
    year,
    entries: inYear.length,
    days: perDay.size,
    byType,
    photos: photos.reduce((n, e) => n + e.photos.length, 0),
    busiestDay: busiest ? { day: busiest[0], entries: busiest[1] } : null,
    firstPhoto: photos[0]
      ? {
          eventId: photos[0].id,
          photoId: photos[0].photos[0].id,
          time: photos[0].time,
        }
      : null,
    latestPhoto: photos.at(-1)
      ? {
          eventId: photos.at(-1).id,
          photoId: photos.at(-1).photos[0].id,
          time: photos.at(-1).time,
        }
      : null,
  };
}
