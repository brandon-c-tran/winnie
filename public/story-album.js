import {
  BIRTHDAY,
  recordDay,
  selectedPhotos,
  usable,
} from "./lifetime.js?v=4.23";

export function ageBoundary(month) {
  return new Date(Date.UTC(2025, 6 + month, 25)).toISOString().slice(0, 10);
}
export function ageMonth(day) {
  const d = new Date(day + "T12:00Z");
  return (
    (d.getUTCFullYear() - 2025) * 12 +
    d.getUTCMonth() -
    6 -
    (d.getUTCDate() < 25 ? 1 : 0)
  );
}
export function albumChapters(
  events,
  profile = {},
  year = 0,
  today = recordDay({ time: Date.now() }),
) {
  const all = selectedPhotos(events).filter(
    (p) => p.day >= BIRTHDAY && p.day <= today,
  );
  const groups = new Map();
  for (const photo of all) {
    const month = ageMonth(photo.day);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(photo);
  }
  const chapters = [];
  for (
    let month = year * 12;
    month < year * 12 + 12 && ageBoundary(month) <= today;
    month++
  ) {
    const start = ageBoundary(month),
      end = ageBoundary(month + 1);
    const photos = (groups.get(month) || []).toSorted(
      (a, b) => a.time - b.time,
    );
    const chosen = profile.storyCovers?.[month];
    const cover =
      photos.find((p) => p.photo.id === chosen) ||
      photos[Math.floor(photos.length / 2)] ||
      null;
    chapters.push({
      month,
      start,
      end,
      photos,
      cover,
      title:
        month === 0
          ? "His first weeks"
          : `${month} ${month === 1 ? "month" : "months"} old`,
      milestones: events.filter(
        (e) =>
          usable(e) &&
          e.milestone &&
          recordDay(e) >= start &&
          recordDay(e) < end,
      ),
    });
  }
  return chapters;
}
export function filterPhotoChoices(photos, { month = "", query = "" } = {}) {
  const q = query.trim().toLocaleLowerCase();
  return photos.filter(
    (p) =>
      (!month || p.day.startsWith(month)) &&
      (!q ||
        [
          p.day,
          p.location,
          p.event.note,
          p.event.milestone,
          ...Object.values(p.event.recollections || {}).map((r) => r.text),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(q)),
  );
}
