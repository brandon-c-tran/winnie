// Tabs and day navigation.
import { icon } from "../icons.js?v=4.0";
import { $, dayKey } from "./format.js?v=4.22";
import { render } from "./today.js?v=4.22";
import { state } from "./state.js?v=4.22";

$("day-picker").value = dayKey(Date.now());
let historySection = "care",
  photosSection = "moments",
  photoCollection = "moments",
  storyTab = "history";
document.addEventListener('winnie:calendar', () => {
  historySection = 'calendar';
  setTab('history');
});

document
  .querySelectorAll(".tab-ic, [data-icon]")
  .forEach((s) => (s.innerHTML = icon(s.dataset.icon)));
export function setTab(next) {
  if (next === "story") next = storyTab;
  document.dispatchEvent(new Event("winnie:surface-change"));
  if (state.tab !== next) state.limit = 60;
  state.tab = next;
  const inStory = ["history", "photos"].includes(next);
  if (inStory) storyTab = next;
  $("today-view").hidden = next !== "today";
  $("plans-view").hidden = next !== "plans";
  $("story-view").hidden = !inStory && next !== "insights";
  $("history-view").hidden = !["history", "insights"].includes(next);
  $("photos-view").hidden = next !== "photos";
  for (const t of ["today", "plans", "story", "insights"]) {
    if (t === (inStory ? "story" : next)) $(`${t}-tab`).setAttribute("aria-current", "page");
    else $(`${t}-tab`).removeAttribute("aria-current");
  }
  if (state.tab === "history") state.filter = historySection;
  if (state.tab === "photos") state.filter = photosSection;
  if (next === "insights") state.filter = "patterns";
  const memories = (next === "photos" && photosSection === "memories") || (next === "history" && historySection === "lifetime");
  const timeline = next === "history" && !memories;
  $("story-title").textContent = next === "insights" ? "Insights" : "Story";
  $("story-navigation").hidden = next === "insights";
  $("story-add").hidden = next === "insights";
  $("story-add").textContent = next === "photos" && photosSection === "care-photos" ? "Attach photos" : "Add photos";
  $("timeline-navigation").hidden = !timeline;
  $("memory-navigation").hidden = !memories;
  document.querySelector('[data-story="care"]').setAttribute('aria-pressed', String(timeline));
  document.querySelector('[data-memory="memories"]').setAttribute('aria-pressed', String(next === 'photos' && memories));
  document
    .querySelectorAll("[data-history]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(next === "history" && b.dataset.history === historySection),
      ),
    );
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.filter === "memories" ? memories : next === "photos" && b.dataset.filter === photosSection),
      ),
    );
  $("places-home").setAttribute(
    "aria-pressed",
    String(next === "photos" && ["moments", "care-photos"].includes(photosSection)),
  );
  window.scrollTo(0, 0);
  render();
  const heading = inStory || next === "insights" ? $("story-title") : $(next + "-view").querySelector("h1");
  if (heading) { heading.tabIndex = -1; heading.focus({preventScroll: true}); }
}
// Open a photo-led view inside Story, preserving the selected collection.
export function showPhotos(section) {
  if (["moments", "care-photos"].includes(section)) photoCollection = section;
  photosSection = section;
  state.limit = 60;
  setTab("photos");
}
$("places-home").onclick = () => showPhotos(photoCollection);
document.querySelector('[data-story="care"]').onclick = () => {
  if (historySection === "lifetime") historySection = "care";
  setTab("history");
};
document.querySelector('[data-memory="memories"]').onclick = () => showPhotos('memories');
document
  .querySelectorAll("[data-filter]")
  .forEach((b) => (b.onclick = () => showPhotos(b.dataset.filter)));
// Open the History log with no filters, optionally narrowed to one type.
export function openHistory({ type = "", from = "", to = "" } = {}) {
  historySection = "care";
  $("history-type").value = type;
  $("story-search").value = "";
  for (const id of ["history-from", "history-to"]) {
    $(id).value = id === "history-from" ? from : to;
    $(id).dispatchEvent(new Event("change"));
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
      setTab("history");
    }),
);
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-care-nav]");
  if (!b) return;
  if (b.dataset.careNav === "upcoming") setTab("plans");
  else {
    const insights = b.dataset.careNav === "patterns";
    if (!insights) historySection = "care";
    setTab(insights ? "insights" : "history");
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
