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
    .flatMap(event => {
      const photos = winniePhotos(event);
      if (!photos.length) return [{...event, photos:[]}];
      return photos.map(photo => ({...event, time: photo.metadata?.capturedAt || event.time,
        timezone: photo.metadata?.timezone || event.timezone,
        photoDay: photo.metadata?.wall?.slice(0,10),
        location: photo.metadata?.location || event.location,
        ...(photo.metadata?.pin ? {placePin:photo.metadata.pin} : {}), photos:[photo]}));
    }).sort((a,b)=>b.time-a.time);
