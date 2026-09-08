export function recordedPatterns(events, days = 28, now = Date.now()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const key = (t) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const valid = events.filter(
    (e) => !e.deletedAt && Number.isFinite(e.time) && e.time <= end.getTime(),
  );
  const current = valid.filter((e) => e.time >= start.getTime());
  const priorStart = new Date(start);
  priorStart.setDate(priorStart.getDate() - days);
  const previous = valid.filter(
    (e) => e.time >= priorStart.getTime() && e.time < start.getTime(),
  );
  const series = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = key(d),
      rows = current.filter((e) => key(e.time) === date);
    series.push({
      date,
      count: rows.length,
      pee: rows.filter((e) => e.type === "pee").length,
      poop: rows.filter((e) => e.type === "poop").length,
      meal: rows.filter((e) => e.type === "meal").length,
    });
  }
  const counts = Object.fromEntries(
    ["pee", "poop", "meal", "nap", "slumber"].map((t) => [
      t,
      {
        current: current.filter((e) => e.type === t).length,
        previous: previous.filter((e) => e.type === t).length,
      },
    ]),
  );
  const completed = valid.filter(
      (e) => ["nap", "slumber"].includes(e.type) && e.end_time != null,
    ),
    invalidSleep = completed.filter(
      (e) =>
        !Number.isFinite(e.end_time) ||
        e.end_time <= e.time ||
        e.end_time - e.time > 86400000,
    );
  const tagged = current.filter(
    (e) =>
      ["pee", "poop"].includes(e.type) &&
      (e.signal || (e.tags || []).includes("self-signaled")),
  );
  return {
    days,
    start: key(start),
    end: key(end),
    previousStart: key(priorStart),
    total: current.length,
    activeDays: new Set(current.map((e) => key(e.time))).size,
    previousActiveDays: new Set(previous.map((e) => key(e.time))).size,
    counts,
    series,
    invalidSleep: invalidSleep.length,
    tagged: tagged.length,
    selfAsked: tagged.filter(
      (e) =>
        e.signal === "He asked" || (e.tags || []).includes("self-signaled"),
    ).length,
    allCount: valid.length,
    first: valid.length ? Math.min(...valid.map((e) => e.time)) : null,
  };
}
