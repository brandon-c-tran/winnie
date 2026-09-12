import { eventPosition, placeName } from "./places.js?v=3.10";
export function latestCare(events, now = Date.now()) {
  const actual = events
    .filter((e) => !e.deletedAt && Number.isFinite(e.time) && e.time <= now)
    .sort((a, b) => b.time - a.time);
  const sleep = actual.filter((e) => ["nap", "slumber"].includes(e.type));
  return {
    pee: actual.find((e) => e.type === "pee"),
    poop: actual.find((e) => e.type === "poop"),
    meal: actual.find((e) => e.type === "meal"),
    sleep: sleep.find((e) => e.end_time == null) || sleep[0],
  };
}
export function elapsed(time, now = Date.now()) {
  if (!Number.isFinite(time) || time > now) return "Time unknown";
  const minutes = Math.floor((now - time) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440)
    return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""} ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
export function validPin(pin) {
  return (
    pin &&
    Number.isFinite(pin.lat) &&
    Math.abs(pin.lat) <= 90 &&
    Number.isFinite(pin.lng) &&
    Math.abs(pin.lng) <= 180 &&
    Number.isFinite(pin.accuracy) &&
    pin.accuracy >= 0 &&
    Number.isFinite(pin.capturedAt) &&
    pin.capturedAt > 0
  );
}
export function mapURL(event) {
  const pin = eventPosition(event);
  if (pin)
    return `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`;
  return placeName(event)
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName(event))}`
    : null;
}
export function canCaptureHere(event, now = Date.now()) {
  return event.time <= now && now - event.time <= 15 * 60000;
}
export function capturePlace(geo = navigator.geolocation) {
  return new Promise((resolve, reject) => {
    if (!geo)
      return reject(
        new Error("Location is unavailable. You can still name the place."),
      );
    geo.getCurrentPosition(
      (position) => {
        const pin = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: position.timestamp,
        };
        if (
          !validPin(pin) ||
          Date.now() - pin.capturedAt > 60000 ||
          pin.capturedAt > Date.now() + 60000
        )
          return reject(
            new Error(
              "Could not get a fresh location. Try again or name the place.",
            ),
          );
        resolve(pin);
      },
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? "Location permission was not granted. You can still name the place."
              : "Could not find your location. Try again or name the place.",
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  });
}
