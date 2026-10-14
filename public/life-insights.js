import {
  BIRTHDAY,
  recordDay,
  selectedPhotos,
  usable,
  toileting,
  eraFor,
  destinationCollections,
} from "./lifetime.js?v=4.25";

const median = (values) => {
  const a = values.toSorted((x, y) => x - y),
    n = a.length;
  return n ? (a[Math.floor((n - 1) / 2)] + a[Math.floor(n / 2)]) / 2 : null;
};
const formats = new Map();
function hourOf(e) {
  if (
    ["day", "date", "unknown", "interval"].includes(e.time_precision) ||
    e.provenance?.uncertainType
  )
    return null;
  const zone = e.timezone || "America/Los_Angeles";
  try {
    if (!formats.has(zone))
      formats.set(
        zone,
        new Intl.DateTimeFormat("en-US", {
          timeZone: zone,
          hour: "numeric",
          hourCycle: "h23",
        }),
      );
    return Number(formats.get(zone).format(e.time));
  } catch {
    return null;
  }
}
export function lifetimeInsights(events, now = Date.now()) {
  const today = recordDay({ time: now }),
    end = today.slice(0, 7),
    months = [];
  for (
    let d = new Date(BIRTHDAY.slice(0, 7) + "-01T12:00Z");
    d.toISOString().slice(0, 7) <= end;
    d.setUTCMonth(d.getUTCMonth() + 1)
  ) {
    const month = d.toISOString().slice(0, 7);
    months.push({
      month,
      days: new Set(),
      rows: [],
      photos: [],
      places: [],
      cumulativePlaces: 0,
      indoor: 0,
      outdoor: 0,
      unknown: 0,
      accidents: 0,
      pee: { counts: new Map(), bins: Array(12).fill(0), timed: 0 },
      poop: { counts: new Map(), bins: Array(12).fill(0), timed: 0 },
      nights: [],
    });
  }
  const index = new Map(months.map((m) => [m.month, m]));
  const rows = events.filter(
    (e) =>
      usable(e) &&
      Number.isFinite(e.time) &&
      e.time <= now &&
      recordDay(e) >= BIRTHDAY &&
      recordDay(e) <= today,
  );
  for (const e of rows) {
    const day = recordDay(e),
      m = index.get(day.slice(0, 7));
    if (!m) continue;
    m.rows.push(e);
    if (
      ["pee", "poop", "meal"].includes(e.type) &&
      !e.provenance?.uncertainType
    )
      m.days.add(day);
    if (["pee", "poop"].includes(e.type) && !e.provenance?.uncertainType) {
      const p = m[e.type];
      p.counts.set(day, (p.counts.get(day) || 0) + 1);
      const h = hourOf(e);
      if (h !== null) {
        p.bins[Math.floor(h / 2)]++;
        p.timed++;
      }
      const t = toileting(e);
      m[t.setting]++;
      if (t.accident) m.accidents++;
    }
    if (
      e.type === "slumber" &&
      hourOf(e) !== null &&
      Number.isFinite(e.end_time) &&
      e.end_time <= now
    ) {
      const hours = (e.end_time - e.time) / 36e5;
      if (hours > 0 && hours <= 20) m.nights.push(hours);
    }
  }
  for (const p of selectedPhotos(rows))
    if (p.day >= BIRTHDAY && p.day <= today)
      index.get(p.day.slice(0, 7))?.photos.push(p);
  for (const place of destinationCollections(rows)) {
    const first = [...place.days]
      .filter((d) => d >= BIRTHDAY && d <= today)
      .sort()[0];
    if (first)
      index
        .get(first.slice(0, 7))
        ?.places.push({ key: place.key, name: place.name, day: first });
  }
  let cumulative = 0;
  for (const m of months) {
    cumulative += m.places.length;
    m.cumulativePlaces = cumulative;
    m.era = eraFor({ time: Date.parse(m.month + "-15T12:00Z") });
    m.pee.median = median([...m.pee.counts.values()]);
    m.poop.median = median([...m.poop.counts.values()]);
    m.nightMedian = median(m.nights);
    const last = new Date(
      Number(m.month.slice(0, 4)),
      Number(m.month.slice(5)),
      0,
    ).getDate();
    const firstDay = m.month === BIRTHDAY.slice(0, 7) ? 25 : 1;
    m.elapsedDays =
      (m.month === end ? Number(today.slice(8)) : last) - firstDay + 1;
  }
  return { months, today, rows };
}
