const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const careDay = (time = Date.now()) => dayFormat.format(time);
export function validDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const time = Date.parse(value + "T12:00:00Z");
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
export function advanceDay(day, every, unit) {
  const date = new Date(day + "T12:00:00Z");
  if (unit === "month") {
    const original = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + every);
    const last = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(original, last));
  } else date.setUTCDate(date.getUTCDate() + every * (unit === "week" ? 7 : 1));
  return date.toISOString().slice(0, 10);
}
export const completionId = (plan, due) => `care-${plan.id}-${due}`;
export function planState(plan, events, now = Date.now()) {
  const done = events
    .filter(
      (e) =>
        e.carePlanId === plan.id &&
        !e.deletedAt &&
        Number.isFinite(e.time) &&
        e.time <= now,
    )
    .sort((a, b) => b.time - a.time)[0];
  const due = done
    ? plan.unit === "once"
      ? null
      : [
          plan.start,
          advanceDay(
            [careDay(done.time), done.careDue || plan.start].sort().at(-1),
            plan.every,
            plan.unit,
          ),
        ]
          .sort()
          .at(-1)
    : plan.start;
  return {
    plan,
    done,
    due,
    overdue: !!due && due < careDay(now),
    today: due === careDay(now),
    claimedBy: plan.claim?.due === due ? plan.claim.person : "",
    paused: plan.paused,
  };
}
export function careStates(profile, events, now = Date.now()) {
  return (profile.carePlans || [])
    .map((p) => planState(p, events, now))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
}
export function validateCarePlans(value) {
  const fail = () => {
    throw Error("Choose a care name, valid date, and repeat schedule.");
  };
  if (!Array.isArray(value) || value.length > 50) fail();
  const ids = new Set();
  return value.map((p) => {
    if (
      !p ||
      typeof p.id !== "string" ||
      !/^[\w-]{1,60}$/.test(p.id) ||
      ids.has(p.id) ||
      typeof p.title !== "string" ||
      !p.title.trim() ||
      p.title.length > 200 ||
      typeof p.instructions !== "string" ||
      p.instructions.length > 2000 ||
      !validDay(p.start) ||
      !["day", "week", "month", "once"].includes(p.unit) ||
      !Number.isInteger(p.every) ||
      p.every < 1 ||
      p.every > 365 ||
      !["medication", "appointment", "enrichment", "note"].includes(p.type) ||
      typeof p.paused !== "boolean" ||
      !(
        p.claim === null ||
        (p.claim &&
          validDay(p.claim.due) &&
          ["brandon", "kim"].includes(p.claim.person))
      )
    )
      fail();
    ids.add(p.id);
    return {
      id: p.id,
      title: p.title.trim(),
      instructions: p.instructions.trim(),
      start: p.start,
      unit: p.unit,
      every: p.every,
      type: p.type,
      paused: p.paused,
      claim: p.claim ? { due: p.claim.due, person: p.claim.person } : null,
    };
  });
}
