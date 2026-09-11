// Shared, read-only interpretation of locations across all generations of entries.
const number = (value) =>
  typeof value === "number"
    ? value
    : typeof value === "string" &&
        value.trim() &&
        /^[-+]?\d+(\.\d+)?$/.test(value.trim())
      ? Number(value)
      : NaN;
function position(value) {
  if (!value || typeof value !== "object") return null;
  const lat = number(value.lat),
    lng = number(value.lng);
  return Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}
function coordinateText(value) {
  if (typeof value !== "string") return null;
  const match = value
    .trim()
    .match(/^\(?\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*\)?$/);
  return match ? position({ lat: match[1], lng: match[2] }) : null;
}
export function eventPosition(event) {
  // A deliberately removed pin must never reappear from a legacy field.
  if (Object.hasOwn(event, "placePin")) return position(event.placePin);
  return position(event.coords) || coordinateText(event.location);
}
export function placeName(event) {
  return typeof event.location === "string" && !coordinateText(event.location)
    ? event.location.trim()
    : "";
}
export function distanceKm(a, b) {
  const rad = Math.PI / 180,
    dlat = (b.lat - a.lat) * rad,
    dlng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function createCityLookup(rows) {
  const cities = rows.map(([id, name, lat, lng, country, region]) => ({
    id,
    name,
    lat,
    lng,
    country,
    region,
  }));
  const cache = new Map();
  return (pin) => {
    if (!position(pin) || !cities.length) return null;
    const key = `${pin.lat.toFixed(3)},${pin.lng.toFixed(3)}`;
    if (cache.has(key)) return cache.get(key);
    let best,
      distance = Infinity;
    // Cheap latitude lower bound skips most of the world before spherical distance.
    for (const city of cities) {
      if (Math.abs(city.lat - pin.lat) * 111.19 > distance) continue;
      const d = distanceKm(pin, city);
      if (d < distance) {
        best = city;
        distance = d;
      }
    }
    const result = { ...best, distance };
    if (cache.size > 10000) cache.clear();
    cache.set(key, result);
    return result;
  };
}
let lookup = null,
  loading = null;
export function loadCities() {
  if (!loading)
    loading = fetch("/geo/cities.json")
      .then((r) => {
        if (!r.ok) throw Error("City names could not load.");
        return r.json();
      })
      .then((rows) => {
        lookup = createCityLookup(rows);
      })
      .catch((error) => {
        loading = null;
        throw error;
      });
  return loading;
}
export function cityFor(event, resolve = lookup) {
  const pin = eventPosition(event);
  return pin && resolve ? resolve(pin) : null;
}
export function cityLabel(city) {
  return city.distance > 30 ? `Near ${city.name}` : city.name;
}
export function placeLabel(event, resolve = lookup) {
  const name = placeName(event),
    city = cityFor(event, resolve);
  if (city)
    return name && name.toLowerCase() !== city.name.toLowerCase()
      ? `${name} · ${cityLabel(city)}`
      : cityLabel(city);
  return name || (eventPosition(event) ? "Location saved" : "");
}
const recordedDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function groupPlaces(events, resolve = lookup, now = Date.now()) {
  const groups = new Map();
  let missing = 0,
    mapped = 0;
  for (const event of events) {
    if (event.deletedAt || !Number.isFinite(event.time) || event.time > now)
      continue;
    const city = cityFor(event, resolve);
    if (!city) {
      missing++;
      continue;
    }
    mapped++;
    if (!groups.has(city.id))
      groups.set(city.id, {
        ...city,
        events: [],
        days: new Set(),
        first: event.time,
        last: event.time,
      });
    const group = groups.get(city.id);
    group.events.push(event);
    group.days.add(recordedDay.format(event.time));
    group.first = Math.min(group.first, event.time);
    group.last = Math.max(group.last, event.time);
  }
  return {
    groups: [...groups.values()]
      .map((g) => ({ ...g, events: g.events.sort((a, b) => b.time - a.time) }))
      .sort((a, b) => b.last - a.last),
    missing,
    mapped,
  };
}
