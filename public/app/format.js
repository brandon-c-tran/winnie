// Formatting helpers and type metadata. No app imports: evaluated first.
import { TYPES as TYPE_META } from "../icons.js?v=4.0";

export const $ = (id) => document.getElementById(id);
export const TYPES = TYPE_META;
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const person = (id) => ({ brandon: "Brandon", kim: "Kim" })[id] || "";
export const by = (id) => (person(id) ? " · " + person(id) : "");
// Brandon's and Kim's Stardew portraits, shown uncropped. Decorative: names stay in text.
export const face = (id, size = "sm") =>
  id === "brandon" || id === "kim"
    ? `<img class="face ${size}" src="/photos/${id}-pixel.png" alt="" aria-hidden="true">`
    : "";
export const dayKey = (time) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const dateTime = (time) =>
  `${dayKey(time)}T${new Date(time).toTimeString().slice(0, 5)}`;
// Formatters are expensive to build, so each is made once.
const clockFormat = new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
  }),
  dateFormat = new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
  shortDateFormat = new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
  });
export const clock = (time) => clockFormat.format(time);
export const dateLabel = (time) => dateFormat.format(time);
export const when = (time) => {
  const age = Date.now() - time;
  if (age < 0) return clock(time);
  if (age < 60000) return "just now";
  if (age < 3600000) return `${Math.floor(age / 60000)}m ago`;
  if (dayKey(time) === dayKey(Date.now())) return clock(time);
  return shortDateFormat.format(time);
};
export const active = (e) => !e.deletedAt && e.end_time == null;
export const uid = () => crypto.randomUUID();
