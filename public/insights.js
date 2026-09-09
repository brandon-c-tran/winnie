// Summaries use San Francisco calendar days, even when a phone is travelling.
// A missing entry is never treated as a missed care event.
const DAY = 86400000;
const sf = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const partCache = new Map();
export function localParts(time) {
  if (partCache.has(time)) return partCache.get(time);
  const p = Object.fromEntries(
    sf.formatToParts(time).map((p) => [p.type, p.value]),
  );
  const result = {
    day: `${p.year}-${p.month}-${p.day}`,
    minute: +p.hour * 60 + +p.minute,
  };
  if (partCache.size > 12000) partCache.clear();
  partCache.set(time, result);
  return result;
}
function shiftDay(day, amount) {
  return new Date(Date.parse(day + "T12:00:00Z") + amount * DAY)
    .toISOString()
    .slice(0, 10);
}
export function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  return sorted[low] + (sorted[Math.ceil(at)] - sorted[low]) * (at - low);
}
const range = (values) => ({
  low: quantile(values, 0.25),
  median: quantile(values, 0.5),
  high: quantile(values, 0.75),
});
const daysOf = (rows) => new Set(rows.map((e) => localParts(e.time).day)).size;
const idsOf = (rows) => rows.map((e) => e.id);
const knownTime = (e) => !["day", "date", "unknown"].includes(e.time_precision);

function pottySummary(rows, type) {
  const entries = rows.filter((e) => e.type === type && knownTime(e));
  const bins = Array.from({ length: 12 }, (_, i) => ({
    start: i * 120,
    ids: [],
  }));
  for (const e of entries)
    bins[Math.floor(localParts(e.time).minute / 120)].ids.push(e.id);
  const peak = Math.max(0, ...bins.map((b) => b.ids.length));
  const peaks = bins.filter((b) => b.ids.length === peak && peak > 0);
  const enough = entries.length >= 10 && daysOf(entries) >= 5;
  const concentrated =
    enough && peaks.length === 1 && peak / entries.length >= 0.3;
  const gaps = [];
  for (let i = 1; i < entries.length; i++) {
    const a = entries[i - 1],
      b = entries[i],
      pa = localParts(a.time),
      pb = localParts(b.time);
    const minutes = (b.time - a.time) / 60000;
    if (
      pa.day === pb.day &&
      pa.minute >= 360 &&
      pb.minute < 1320 &&
      minutes >= 15 &&
      minutes <= 480
    )
      gaps.push({ before: a.id, after: b.id, time: b.time, minutes });
  }
  return {
    ids: idsOf(entries),
    count: entries.length,
    days: daysOf(entries),
    bins,
    enough,
    concentrated,
    peak: peaks[0] || null,
    gaps,
    gap: range(gaps.map((g) => g.minutes)),
    gapEnough: gaps.length >= 10 && daysOf(gaps) >= 5,
  };
}

function afterMeals(rows, now) {
  // A full four-hour observation window is required in the meal denominator.
  const meals = rows.filter((e) => e.type === "meal" && knownTime(e));
  const eligible = meals.filter((e) => e.time <= now - 4 * 3600000);
  const eligibleIds = new Set(idsOf(eligible)),
    pairs = [],
    used = new Set();
  let lastMeal = null;
  for (const e of rows) {
    if (e.type === "meal") {
      lastMeal = knownTime(e) ? e : null;
      continue;
    }
    if (
      e.type !== "poop" ||
      !knownTime(e) ||
      !lastMeal ||
      used.has(lastMeal.id) ||
      !eligibleIds.has(lastMeal.id)
    )
      continue;
    const minutes = (e.time - lastMeal.time) / 60000;
    if (minutes <= 0 || minutes > 240) continue;
    pairs.push({ meal: lastMeal.id, poop: e.id, time: lastMeal.time, minutes });
    used.add(lastMeal.id);
  }
  return {
    pairs,
    meals: eligible.length,
    waiting: meals.length - eligible.length,
    days: daysOf(pairs),
    ...range(pairs.map((p) => p.minutes)),
    enough: pairs.length >= 8 && daysOf(pairs) >= 5,
    representative:
      eligible.length > 0 && pairs.length / eligible.length >= 0.5,
  };
}

function nightSummary(rows, now) {
  const started = rows.filter((e) => e.type === "slumber"),
    valid = started.filter(
      (e) =>
        knownTime(e) &&
        Number.isFinite(e.end_time) &&
        e.end_time > e.time &&
        e.end_time <= now &&
        e.end_time - e.time <= DAY,
    );
  // Noon divides sleep nights: 23:55 and 00:05 meet at midnight, not noon.
  const bedtime = (e) => ((localParts(e.time).minute + 720) % 1440) + 720;
  const sleepDay = (e) => {
    const p = localParts(e.time);
    return p.minute < 720 ? shiftDay(p.day, -1) : p.day;
  };
  const distinct = new Set(valid.map(sleepDay)).size;
  return {
    ids: idsOf(valid),
    count: valid.length,
    days: distinct,
    enough: distinct >= 5,
    bed: range(valid.map(bedtime)),
    wake: range(
      valid.map((e) => ((localParts(e.end_time).minute + 720) % 1440) + 720),
    ),
    duration: range(valid.map((e) => (e.end_time - e.time) / 60000)),
    omitted: started.length - valid.length,
  };
}

export function rhythmInsights(events, days = 28, now = Date.now()) {
  if (![7, 28, 90].includes(days)) days = 28;
  const end = localParts(now).day,
    start = shiftDay(end, 1 - days),
    previousStart = shiftDay(start, -days);
  const valid = events
    .filter((e) => !e.deletedAt && Number.isFinite(e.time) && e.time <= now)
    .sort(
      (a, b) => a.time - b.time || String(a.id).localeCompare(String(b.id)),
    );
  const recent = valid.filter((e) => localParts(e.time).day >= start);
  const previous = valid.filter((e) => {
    const day = localParts(e.time).day;
    return day >= previousStart && day < start;
  });
  const first = valid[0] ? localParts(valid[0].time).day : null;
  const firstEnd = first ? shiftDay(first, days - 1) : null;
  const earlier =
    firstEnd && firstEnd < start
      ? valid.filter((e) => localParts(e.time).day <= firstEnd)
      : [];
  const night = nightSummary(recent, now),
    oldNight = nightSummary(earlier, now);
  const pastNight = nightSummary(previous, now);
  const potty = Object.fromEntries(
    ["pee", "poop"].map((type) => [type, pottySummary(recent, type)]),
  );
  const pastPotty = Object.fromEntries(
    ["pee", "poop"].map((type) => [type, pottySummary(previous, type)]),
  );
  return {
    days,
    start,
    end,
    previousStart,
    previousEnd: shiftDay(start, -1),
    total: recent.length,
    activeDays: daysOf(recent),
    allCount: valid.length,
    first,
    firstEnd,
    potty,
    pastPotty,
    afterMeals: afterMeals(recent, now),
    night,
    pastNight,
    oldNight,
  };
}

export function clockMinute(minute) {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440,
    hour = Math.floor(m / 60);
  return `${hour % 12 || 12}${m % 60 ? ":" + String(m % 60).padStart(2, "0") : ""}${hour >= 12 ? "pm" : "am"}`;
}
export function durationLabel(minutes) {
  const rounded = Math.max(0, Math.round(minutes)),
    hours = Math.floor(rounded / 60),
    rest = rounded % 60;
  return hours ? `${hours}h${rest ? " " + rest + "m" : ""}` : `${rest}m`;
}
