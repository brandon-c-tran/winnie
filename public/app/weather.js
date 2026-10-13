// San Francisco weather for the room's window, from Open-Meteo (free, no account).
// Cached on the phone for 20 minutes; the room is fine without it.
const URL_SF =
  "https://api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&current=temperature_2m,weather_code,cloud_cover&temperature_unit=fahrenheit";
const KEY = "winnie:weather",
  FRESH = 20 * 60000;
let inFlight = null;

export function cachedWeather() {
  try {
    const w = JSON.parse(localStorage.getItem(KEY));
    return w && Date.now() - w.at < 3 * FRESH ? w : null;
  } catch {
    return null;
  }
}

// Resolves with fresh weather, or null when offline or the service is unavailable.
export function refreshWeather() {
  const cached = cachedWeather();
  if (cached && Date.now() - cached.at < FRESH) return Promise.resolve(cached);
  if (!navigator.onLine) return Promise.resolve(cached);
  inFlight ||= fetch(URL_SF, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const c = data?.current;
      if (!c || !Number.isFinite(c.weather_code)) return cached;
      const w = {
        code: c.weather_code,
        cloud: c.cloud_cover,
        temp: Math.round(c.temperature_2m),
        at: Date.now(),
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(w));
      } catch {}
      return w;
    })
    .catch(() => cached)
    .finally(() => (inFlight = null));
  return inFlight;
}

const WORDS = {
  clear: "Clear",
  partly: "Some clouds",
  overcast: "Overcast",
  fog: "Fog",
  rain: "Rain",
  snow: "Snow",
};
export const weatherWords = (kind, w) =>
  w ? `${WORDS[kind] || "Clear"}, ${w.temp}°F` : "";
