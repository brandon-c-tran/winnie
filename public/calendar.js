// Calendar evidence remains separate from completed care.
export const CALENDAR_KINDS = {
  trainer: "Will",
  training: "Classes",
  vet: "Vet",
  grooming: "Grooming",
  other: "Other",
};
export function calendarKind(title = "") {
  const t = title.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^training\s+(?:w\/|with)\s*will\b/.test(t)) return "trainer";
  if (/\b(vet|veterinary)\b/.test(t)) return "vet";
  if (/\b(groom|grooming|haircut|bath|shower|nail|trim|tidy)\b/.test(t))
    return "grooming";
  if (
    /\b(training|trainer|agility|pre[- ]?school|playgroup|play session)\b/.test(
      t,
    )
  )
    return "training";
  return "other";
}
export function calendarCareTitle(title = "") {
  if (/haircut/i.test(title)) return "Haircut";
  if (/bath|shower/i.test(title)) return "Bath";
  if (/nail/i.test(title)) return "Nails";
  return "Grooming";
}
export function calendarMatch(visit, events) {
  const live = events.filter((e) => !e.deletedAt);
  const exact = live.find(
    (e) =>
      e.calendarVisitId === visit.id ||
      (visit.legacyId && e.calendarVisitId === visit.legacyId),
  );
  if (exact) return { event: exact, exact: true };
  if (visit.allDay) return null;
  const candidates = live.filter((e) => {
    if (Math.abs(e.time - visit.start) > 30 * 60000) return false;
    if (visit.kind === "trainer")
      return (
        (e.type === "covered_gap" && e.who === "trainer") ||
        (e.type === "enrichment" && /\bwill\b/i.test(e.note || ""))
      );
    if (visit.kind === "vet")
      return (
        e.type === "appointment" &&
        (e.appointment_kind === "vet" || /\bvet\b/i.test(e.note || ""))
      );
    if (visit.kind === "grooming")
      return (
        e.type === "grooming" &&
        (e.careTitle || "").toLowerCase() ===
          calendarCareTitle(visit.title).toLowerCase()
      );
    if (visit.kind === "training")
      return (
        e.type === "enrichment" &&
        (e.note || "").toLowerCase() === visit.title.toLowerCase()
      );
    return false;
  });
  return candidates.length
    ? { event: candidates[0], exact: false, ambiguous: candidates.length > 1 }
    : null;
}
export function calendarStats(rows, now = Date.now()) {
  const past = rows.filter((v) => v.status === "scheduled" && v.end <= now);
  return {
    past: past.length,
    will: past.filter((v) => v.kind === "trainer").length,
    willHours: past
      .filter((v) => v.kind === "trainer" && !v.allDay)
      .reduce((n, v) => n + (v.end - v.start) / 3600000, 0),
  };
}
