// Tabs and day navigation.
import { icon } from "../icons.js?v=4.0";
import { $, dayKey } from "./format.js?v=4.29";
import { render } from "./today.js?v=4.29";
import { state } from "./state.js?v=4.29";

$("day-picker").value = dayKey(Date.now());
let historySection = "care",
  photosSection = "memories",
  photoCollection = "moments",
  storyTab = "photos";
let insightReturn = null;
document.addEventListener("winnie:calendar", () => {
  setTab("calendar");
});

document
  .querySelectorAll(".tab-ic, [data-icon]")
  .forEach((s) => (s.innerHTML = icon(s.dataset.icon)));
export function setTab(next) {
  document.querySelectorAll('.timeline-tools[open]').forEach(el => { el.open = false; });
  if (next === "story") next = storyTab;
  document.dispatchEvent(new Event("winnie:surface-change"));
  if (state.tab !== next) state.limit = 60;
  state.tab = next;
  const calendar = next === "calendar";
  if (calendar) {
    next = "history";
    state.tab = "history";
  }
  const inStory = !calendar && ["history", "photos"].includes(next);
  if (inStory) storyTab = next;
  $("today-view").hidden = next !== "today";
  $("plans-view").hidden = next !== "plans";
  $("story-view").hidden = !inStory && next !== "insights" && !calendar;
  $("history-view").hidden = !["history", "insights"].includes(next);
  $("photos-view").hidden = next !== "photos";
  for (const t of ["today", "plans", "story", "insights"]) {
    if (t === (calendar ? "plans" : inStory ? "story" : next))
      $(`${t}-tab`).setAttribute("aria-current", "page");
    else $(`${t}-tab`).removeAttribute("aria-current");
  }
  if (state.tab === "history")
    state.filter = calendar ? "calendar" : historySection;
  if (state.tab === "photos") state.filter = photosSection;
  if (next === "insights") state.filter = "patterns";
  const timeline = next === "history" && !calendar;
  $("story-title").textContent = calendar
    ? "Calendar"
    : next === "insights"
      ? "Insights"
      : "Story";
  $("story-navigation").hidden = next === "insights" || calendar;
  $("story-add").hidden = next === "insights" || calendar;
  $("story-add").textContent =
    next === "history" ? "Add entry" : photosSection === "care-photos"
      ? "Attach photos"
      : "Add photos";
  $("insights-navigation").hidden = next !== "insights";
  $("story-back").hidden =
    !calendar && !(timeline && (historySection === "lifetime" || insightReturn));
  $("story-back-button").textContent = calendar
    ? "Back to Plans"
    : historySection === "lifetime" ? "Back to Timeline" : "Back to Insights";
  $("story-back-button").onclick = () => {
    if (calendar) setTab("plans");
    else if (historySection === "lifetime") showPhotos("memories");
    else if (insightReturn) {
      const position = insightReturn.scroll;
      insightReturn = null;
      setTab("insights");
      window.scrollTo(0, position);
    }
  };
  $("photo-collection").value = photoCollection;
  document
    .querySelector('[data-story="care"]')
    .setAttribute("aria-pressed", String(timeline && historySection !== "lifetime"));
  document
    .querySelectorAll("[data-history]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(
          !calendar &&
            next === "history" &&
            b.dataset.history === historySection,
        ),
      ),
    );
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String((next === "photos" && b.dataset.filter === photosSection) || (timeline && historySection === "lifetime" && b.dataset.filter === "memories")),
      ),
    );
  $("places-home").setAttribute(
    "aria-pressed",
    String(
      next === "photos" && ["moments", "care-photos"].includes(photosSection),
    ),
  );
  window.scrollTo(0, 0);
  render();
  const heading =
    inStory || calendar || next === "insights"
      ? $("story-title")
      : $(next + "-view").querySelector("h1");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}
// Open a photo-led view inside Story, preserving the selected collection.
export function showPhotos(section) {
  insightReturn = null;
  if (["moments", "care-photos"].includes(section) || section.startsWith("collection:")) photoCollection = section;
  photosSection = section.startsWith("collection:") ? "moments" : section;
  state.limit = 60;
  setTab("photos");
}
$("places-home").onclick = () => showPhotos(photoCollection);
$("photo-collection").onchange = (e) => showPhotos(e.target.value);
document
  .querySelectorAll("[data-filter]")
  .forEach((b) => (b.onclick = () => showPhotos(b.dataset.filter)));
// Open the History log with no filters, optionally narrowed to one type.
export function openHistory({ type = "", from = "", to = "" } = {}) {
  insightReturn = state.tab === "insights" ? {scroll:window.scrollY} : null;
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
  .forEach((b) => (b.onclick = () => { insightReturn = null; setTab(b.dataset.tab); }));
document.addEventListener("click", (event) => {
  const b=event.target.closest('[data-history]'); if(!b)return;
  insightReturn=null;
  if(b.dataset.history==='calendar')setTab('calendar');
  else {historySection=b.dataset.history;setTab('history');}
});
document.addEventListener("click", event => {
  document.querySelectorAll('.timeline-tools[open]').forEach(el => {
    if (!el.contains(event.target) || event.target.closest('button')) el.open = false;
  });
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const menu = document.querySelector('.timeline-tools[open]');
  if (menu) { menu.open = false; menu.querySelector('summary').focus(); }
});

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
