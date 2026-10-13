// A photo can be care evidence and a chosen keepsake without duplicating it.
export const isCarePhoto = (event) =>
  ["pee", "poop", "meal"].includes(event.type);
export const winniePhotos = (event) =>
  (event.photos || []).filter(
    (photo) => !isCarePhoto(event) || photo.keepsake === true,
  );
export const memoryEvents = (events) =>
  events
    .filter((event) => !event.deletedAt)
    .map((event) => ({ ...event, photos: winniePhotos(event) }));
