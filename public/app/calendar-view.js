import {
  CALENDAR_KINDS,
  calendarMatch,
  calendarStats,
} from "../calendar.js?v=4.27";
import { $, esc } from "./format.js?v=4.27";
import { facts, sync } from "./services.js?v=4.27";
import { html, openDialog, closeDialog, safe, toast } from "./ui.js?v=4.27";
import { state } from "./state.js?v=4.27";

let period = "upcoming",
  kind = "",
  query = "",
  limit = 30,
  includeCancelled = false;
const allVisits = () =>
  sync.view().calendar?.events ||
  (sync.view().profile.trainerSchedule?.visits || []).map((v) => ({
    ...v,
    kind: "trainer",
    status: "scheduled",
    day: new Date(v.start).toISOString().slice(0, 10),
    legacy: true,
  }));
const dateFor = (v) =>
  v.allDay ? new Date(v.day + "T12:00:00Z") : new Date(v.start);
const dateOptions = (v) => ({
  timeZone: v.allDay ? "UTC" : v.timezone || "America/Los_Angeles",
});
function timing(v) {
  if (v.allDay) return "All day";
  const options = { ...dateOptions(v), hour: "numeric", minute: "2-digit" };
  return (
    new Date(v.start).toLocaleTimeString([], options) +
    "–" +
    new Date(v.end).toLocaleTimeString([], {
      ...options,
      timeZoneName: "short",
    })
  );
}
function row(v) {
  const match = calendarMatch(v, facts()),
    inactive = v.status !== "scheduled";
  const date = dateFor(v),
    opts = dateOptions(v),
    past = v.end <= Date.now();
  const loggable =
    !v.allDay &&
    past &&
    !inactive &&
    ["trainer", "training", "vet", "grooming"].includes(v.kind);
  return `<article class="calendar-entry${inactive ? " calendar-inactive" : ""}"><div class="calendar-date" aria-hidden="true"><span>${esc(date.toLocaleDateString([], { ...opts, month: "short" }))}</span><b>${esc(date.toLocaleDateString([], { ...opts, day: "numeric" }))}</b></div><div class="calendar-entry-body"><h3>${esc(v.title)}</h3><p class="fine">${esc(date.toLocaleDateString([], { ...opts, weekday: "short", year: "numeric", month: "short", day: "numeric" }))}</p><p class="fine">${esc(timing(v))}</p>${v.location ? `<p class="fine calendar-location">${esc(v.location)}</p>` : ""}<div class="calendar-entry-action">${inactive ? `<span class="fine">${v.status === "cancelled" ? "Cancelled in Google Calendar" : "Removed from Google Calendar"}</span>` : match ? `<button class="text-button" data-open="${esc(match.event.id)}">${match.exact ? "View care record" : "View matching care record"}</button>` : loggable ? `<button class="text-button" ${v.legacy ? "data-visit" : "data-calendar-confirm"}="${esc(v.id)}">Log completed visit</button>` : `<span class="fine">${past ? "Calendar entry" : "Scheduled"}</span>`}</div></div></article>`;
}
export function calendarPlansHTML() {
  const c = sync.view().calendar,
    rows = allVisits()
      .filter((v) => v.status === "scheduled" && v.end >= Date.now())
      .slice(0, 3);
  return `<div class="section-heading"><h2 id="training-title">Winnie’s calendar</h2><button class="text-button" data-act="trainer-schedule">${c || allVisits().length ? "View calendar" : "Connect"}</button></div>${c?.connected ? '<p class="fine calendar-connection-status">Connected to Google Calendar. Checks hourly.</p>' : ""}${rows.map(row).join("") || `<p class="fine">${c ? "No upcoming appointments in the saved calendar." : "Training with Will, vet visits, and grooming in one shared schedule."}</p>`}${c?.error ? `<p class="error">${esc(c.error)}</p>` : c && !c.connected ? '<p class="fine">Updates paused. Reconnect to keep this schedule current.</p>' : ""}`;
}
function agendaHTML(history = false) {
  const c = sync.view().calendar,
    count = allVisits().length,
    stats = calendarStats(allVisits());
  if (!c && !count)
    return `<div class="calendar-empty"><h${history ? "2" : "3"}>Winnie’s calendar</h${history ? "2" : "3"}><p>Bring in Training w/ Will, vet appointments, haircuts, and the days you’ve already saved.</p><button class="primary" data-calendar-action="connection">Connect Google Calendar</button></div>`;
  return `<div class="section-heading"><h${history ? "2" : "3"}>Winnie’s calendar</h${history ? "2" : "3"}><button class="text-button" data-calendar-action="connection">Connection</button></div><p class="fine">Calendar history preserves what you planned. Log a completed visit to include it in care insights.</p>${stats.will ? `<div class="calendar-tally"><strong>${stats.will} past Will ${stats.will === 1 ? "session" : "sessions"}</strong><span>${Number(stats.willHours.toFixed(1))} ${stats.willHours === 1 ? "hour" : "hours"} scheduled</span></div>` : ""}<div class="calendar-controls"><div class="calendar-period" role="group" aria-label="Calendar dates"><button class="secondary small" data-calendar-period="upcoming" aria-pressed="${period === "upcoming"}">Upcoming</button><button class="secondary small" data-calendar-period="past" aria-pressed="${period === "past"}">Past</button></div><label>Visits<select id="calendar-kind" aria-label="Visits"><option value="">All visits</option>${Object.entries(
    CALENDAR_KINDS,
  )
    .map(
      ([k, v]) =>
        `<option value="${k}"${kind === k ? " selected" : ""}>${v}</option>`,
    )
    .join(
      "",
    )}</select></label></div><label class="calendar-search"><span class="sr-only">Search calendar</span><input id="calendar-search" type="search" placeholder="Find a visit or place" value="${esc(query)}"></label><label class="calendar-cancelled"><input id="calendar-cancelled" type="checkbox"${includeCancelled ? " checked" : ""}> Show cancelled and removed entries</label><div id="calendar-results"></div><p class="fine calendar-source">${c ? `${c.connected ? "Google Calendar checks hourly." : "Updates paused."} Last checked ${esc(new Date(c.checkedAt).toLocaleString())}. Saved through ${esc(c.through)}.` : "Saved calendar import. Connect for automatic updates."}</p>${c?.error ? `<p class="error">${esc(c.error)}</p>` : ""}${c?.connected ? '<button class="text-button" data-calendar-action="refresh">Refresh now</button>' : ""}<p id="calendar-error" class="error" role="alert"></p>`;
}
function renderRows() {
  const target = $("calendar-results");
  if (!target) return;
  const now = Date.now(),
    needle = query.toLowerCase().trim();
  const rows = allVisits()
    .filter(
      (v) =>
        (includeCancelled || v.status === "scheduled") &&
        (period === "past" ? v.end < now : v.end >= now) &&
        (!kind || v.kind === kind) &&
        (!needle ||
          (v.title + " " + v.location).toLowerCase().includes(needle)),
    )
    .sort((a, b) =>
      period === "past" ? b.start - a.start : a.start - b.start,
    );
  target.innerHTML =
    `<p class="fine calendar-result-count" role="status">${rows.length} ${rows.length === 1 ? "entry" : "entries"}</p>` +
    (rows.length
      ? rows
          .slice(0, limit)
          .map(
            (v, i, vs) =>
              `${i === 0 || v.day.slice(0, 7) !== vs[i - 1].day.slice(0, 7) ? `<h3 class="calendar-month">${esc(dateFor(v).toLocaleDateString([], { ...dateOptions(v), month: "long", year: "numeric" }))}</h3>` : ""}${row(v)}`,
          )
          .join("")
      : '<p class="empty">No visits match this view.</p>') +
    (rows.length > limit
      ? '<button class="secondary" data-calendar-action="more">Show more visits</button>'
      : "");
}
function bindAgenda() {
  if (!$("calendar-kind")) return;
  $("calendar-kind").onchange = (e) => {
    kind = e.target.value;
    limit = 30;
    renderRows();
  };
  $("calendar-search").oninput = (e) => {
    query = e.target.value;
    limit = 30;
    renderRows();
  };
  $("calendar-cancelled").onchange = (e) => {
    includeCancelled = e.target.checked;
    renderRows();
  };
  renderRows();
}
export function calendarSheet() {
  if (!sync.view().calendar && !allVisits().length) return calendarConnection();
  closeDialog();
  document.dispatchEvent(new Event("winnie:calendar"));
}
export function renderCalendarHistory() {
  $("load-more").hidden = true;
  html("story-items", agendaHTML(true));
  bindAgenda();
}
function redraw() {
  if ($("dialog").open) calendarSheet();
  if (state.tab === "history" && state.filter === "calendar")
    renderCalendarHistory();
  html("training-visits", calendarPlansHTML());
}
export function calendarConnection() {
  const c = sync.view().calendar;
  openDialog(
    `<h2 id="dialog-title">Connect Winnie’s calendar</h2><p>Use the private, read-only link for the shared <strong>Winnie</strong> calendar. Training w/ Will, vet visits, grooming, and historical entries update automatically.</p><ol class="calendar-instructions"><li>On a computer, open Google Calendar’s Settings.</li><li>Choose <strong>Winnie</strong>, then <strong>Integrate calendar</strong>.</li><li>Copy the <strong>Secret address in iCal format</strong>.</li></ol><p class="fine">This link grants access to the calendar. Winnie stores it on the server and never shows it to other connected devices. No Google events are changed.</p><form id="calendar-connect-form"><label>Private calendar link<input id="calendar-feed" type="password" autocomplete="off" spellcheck="false" required placeholder="Paste the secret iCal address"></label><div class="button-row"><button class="primary" type="submit">${c?.connected ? "Replace connection" : "Connect calendar"}</button>${c ? '<button class="secondary" type="button" data-calendar-action="agenda">Back to calendar</button>' : ""}</div></form>${c?.connected ? '<div class="sheet-section"><button class="text-button" data-calendar-action="disconnect">Disconnect automatic updates</button><p class="fine">Saved calendar history and care records stay available.</p></div>' : ""}<p id="form-error" class="error" role="alert"></p>`,
  );
  $("calendar-connect-form").onsubmit = safe(async (e) => {
    e.preventDefault();
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await sync.request("calendar-connect", {
        method: "POST",
        value: { url: $("calendar-feed").value.trim() },
      });
      $("calendar-feed").value = "";
      await sync.refresh();
      redraw();
      toast("Winnie’s calendar connected.");
    } finally {
      button.disabled = false;
    }
  });
}
document.addEventListener(
  "click",
  safe(async (e) => {
    const button = e.target.closest(
      "[data-calendar-action],[data-calendar-period],[data-calendar-confirm]",
    );
    if (!button) return;
    if (button.dataset.calendarPeriod) {
      period = button.dataset.calendarPeriod;
      limit = 30;
      document
        .querySelectorAll("[data-calendar-period]")
        .forEach((b) =>
          b.setAttribute(
            "aria-pressed",
            String(b.dataset.calendarPeriod === period),
          ),
        );
      renderRows();
      return;
    }
    const action = button.dataset.calendarAction;
    if (action === "connection") return calendarConnection();
    if (action === "agenda") return calendarSheet();
    if (action === "more") {
      limit += 30;
      renderRows();
      return;
    }
    button.disabled = true;
    try {
      await sync.request(
        button.dataset.calendarConfirm
          ? "calendar-confirm"
          : "calendar-" + action,
        {
          method: "POST",
          value: button.dataset.calendarConfirm
            ? { id: button.dataset.calendarConfirm }
            : {},
        },
      );
      await sync.refresh();
      redraw();
      toast(
        button.dataset.calendarConfirm
          ? "Visit added to care history."
          : action === "disconnect"
            ? "Automatic updates disconnected."
            : "Calendar refreshed.",
      );
    } catch (err) {
      const error = $("calendar-error") || $("form-error");
      if (error) error.textContent = err.message;
      else throw err;
    } finally {
      button.disabled = false;
    }
  }),
);
