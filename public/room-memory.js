// A room keepsake points to the original shared entry; it never copies a memory.
export function graduationMemory(events, profile = {}) {
  const live = events.filter(e => !e.deletedAt);
  const saved = profile.cgcMemory;
  if (saved) {
    const event = live.find(e => e.id === saved.eventId);
    const photo = event?.photos?.find(p => p.id === saved.photoId);
    return event && photo ? { event, photo } : null;
  }
  // Only a uniquely named, confirmed milestone can be picked automatically.
  const candidates = live.filter(e => /^(canine good citizen|cgc)( graduation)?$/i.test(e.milestone?.trim() || '') && e.photos?.length === 1);
  return candidates.length === 1 ? { event: candidates[0], photo: candidates[0].photos[0] } : null;
}
