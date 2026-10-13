// Tabs and day navigation.
import { icon } from "../icons.js?v=4.0";
import { $, dayKey } from "./format.js?v=4.4";
import { render } from "./today.js?v=4.4";
import { state } from "./state.js?v=4.4";

$("day-picker").value = dayKey(Date.now());
let historySection = "care",
  photosSection = "moments";
const libraryFilters = { history: {}, photos: {} };
const libraryFields = [
  "story-search",
  "history-type",
  "history-from",
  "history-to",
];
const TAB_IDS = ["today", "plans", "history", "photos"];
document
  .querySelectorAll(".tab-ic, [data-icon]")
  .forEach((s) => (s.innerHTML = icon(s.dataset.icon)));
export function setTab(next) {
  if (state.tab !== next) {
    if (libraryFilters[state.tab])
      for (const id of libraryFields)
        libraryFilters[state.tab][id] = $(id).value;
    if (libraryFilters[next])
      for (const id of libraryFields)
        $(id).value = libraryFilters[next][id] || "";
    state.limit = 60;
  }
  state.tab = next;
  for (const t of TAB_IDS) {
    $(`${t}-view`).hidden = t !== state.tab;
    if (t === state.tab) $(`${t}-tab`).setAttribute("aria-current", "page");
    else $(`${t}-tab`).removeAttribute("aria-current");
  }
  if (state.tab === "history") state.filter = historySection;
  if (state.tab === "photos") state.filter = photosSection;
  // One search/filter/list library, moved into whichever tab shows it.
  const library = $(
    state.tab === "history" ? "history-library" : "photos-library",
  );
  for (const id of ["story-tools", "story-count", "story-items", "load-more"])
    library.append($(id));
  document
    .querySelectorAll("[data-history]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.history === historySection),
      ),
    );
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.filter === photosSection),
      ),
    );
  window.scrollTo(0, 0);
  render();
}
// Switch the Photos tab between Photos, Places and Memories.
export function showPhotos(section) {
  photosSection = section;
  state.limit = 60;
  $("history-type").value = "";
  setTab("photos");
}
document
  .querySelectorAll("[data-filter]")
  .forEach((b) => (b.onclick = () => showPhotos(b.dataset.filter)));
// Open the History log with no filters, optionally narrowed to one type.
export function openHistory({ type = "" } = {}) {
  historySection = "care";
  libraryFilters.history = { "history-type": type };
  if (state.tab === "history") {
    for (const id of libraryFields)
      $(id).value = libraryFilters.history[id] || "";
    state.filter = "care";
  }
  setTab("history");
}
document
  .querySelectorAll("[data-tab]")
  .forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
document.querySelectorAll("[data-history]").forEach(
  (b) =>
    (b.onclick = () => {
      historySection = b.dataset.history;
      $("history-type").value = "";
      setTab("history");
    }),
);
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-care-nav]");
  if (!b) return;
  if (b.dataset.careNav === "upcoming") setTab("plans");
  else {
    historySection = b.dataset.careNav === "patterns" ? "patterns" : "care";
    setTab("history");
  }
});
$("day-picker").onchange = render;
const shiftDay = (n) => {
  const d = new Date(($("day-picker").value || dayKey(Date.now())) + "T12:00");
  d.setDate(d.getDate() + n);
  const key = dayKey(d.getTime());
  if (key > dayKey(Date.now())) return;
  $("day-picker").value = key;
  render();
};
$("day-prev").onclick = () => shiftDay(-1);
$("day-next").onclick = () => shiftDay(1);
