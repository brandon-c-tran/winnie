import {
  BIRTHDAY,
  HOMECOMING,
  recordDay,
  selectedPhotos,
  usable,
} from "./lifetime.js?v=4.24";
import { ageMonth } from "./story-album.js?v=4.24";

// A memory has a capture day; its care entry retains its own occurrence time.
export function lifeTimeline(events, today = recordDay({ time: Date.now() })) {
  const days = new Map();
  const group = (day) => {
    if (!days.has(day))
      days.set(day, {
        day,
        age: ageMonth(day),
        photos: [],
        landmarks: [],
        moments: [],
      });
    return days.get(day);
  };
  for (const [day, title] of [
    [BIRTHDAY, "Winnie was born"],
    [HOMECOMING, "Home with us"],
  ]) {
    if (day <= today) group(day).landmarks.push({ title, origin: true });
  }
  const valid = events.filter(usable);
  const seen = new Set();
  for (const p of selectedPhotos(valid)) {
    if (p.day < BIRTHDAY || p.day > today || seen.has(p.photo.id)) continue;
    seen.add(p.photo.id);
    group(p.day).photos.push(p);
  }
  for (const e of valid) {
    const day = recordDay(e);
    if (day < BIRTHDAY || day > today) continue;
    if (e.tags?.includes("trip-collection")) {
      group(day).landmarks.push({
        id: e.id,
        title: e.note || "Saved trip",
        trip: true,
        end: e.end_time ? recordDay({ ...e, time: e.end_time }) : day,
      });
    } else if (e.milestone) {
      group(day).landmarks.push({ id: e.id, title: e.milestone });
    } else if (e.type === "moment" && !e.photos?.length && e.note) {
      group(day).moments.push(e);
    }
  }
  for (const g of days.values())
    g.photos.sort(
      (a, b) => a.time - b.time || a.photo.id.localeCompare(b.photo.id),
    );
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}
