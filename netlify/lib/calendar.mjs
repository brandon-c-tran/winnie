import ICAL from "ical.js";
import { randomUUID } from "node:crypto";
import {
  assert,
  hash,
  transact,
  authenticate,
  applyCommand,
  snapshot,
} from "./core.mjs";
import {
  calendarKind,
  calendarCareTitle,
  calendarMatch,
} from "../../public/calendar.js";

const FIRST_DAY = "2025-07-25",
  MAX_BYTES = 4 * 1024 * 1024;
export function calendarFeedURL(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Object.assign(
      new Error("Paste the Google Calendar secret iCal address."),
      { status: 400 },
    );
  }
  assert(
    url.protocol === "https:" &&
      url.hostname === "calendar.google.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/calendar\/ical\/[^/]+\/private-[a-f0-9]+\/basic\.ics$/.test(
        url.pathname,
      ),
    "Use the secret iCal address from Google Calendar settings.",
  );
  return url.href;
}

export function parseCalendar(text, now = Date.now()) {
  assert(
    Buffer.byteLength(text) <= MAX_BYTES,
    "This calendar is too large.",
    413,
  );
  let root;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch {
    throw Object.assign(
      new Error(
        "Google did not return a readable calendar. Check the calendar link.",
      ),
      { status: 422 },
    );
  }
  assert(root.name === "vcalendar", "Choose a valid calendar feed.", 422);
  // Definitions belong to this feed. Parsing is synchronous so registrations cannot interleave.
  ICAL.TimezoneService.reset();
  for (const zone of root.getAllSubcomponents("vtimezone"))
    ICAL.TimezoneService.register(zone);
  const calendarZone = String(
    root.getFirstPropertyValue("x-wr-timezone") || "America/Los_Angeles",
  );
  try {
    new Intl.DateTimeFormat("en", { timeZone: calendarZone }).format(now);
  } catch {
    throw Object.assign(
      new Error("This calendar has an unsupported timezone."),
      { status: 422 },
    );
  }
  const through = new Date(now + 366 * 86400000).toISOString().slice(0, 10);
  const components = root.getAllSubcomponents("vevent"),
    out = new Map();
  assert(
    components.length <= 10000,
    "This calendar has too many entries.",
    413,
  );
  let steps = 0;
  const occurrenceKey = (date) =>
    date.isDate ? date.toString() : String(date.toUnixTime());
  const exceptions = new Map();
  for (const component of components) {
    if (!component.hasProperty("recurrence-id")) continue;
    const item = new ICAL.Event(component);
    exceptions.set(item.uid + "|" + occurrenceKey(item.recurrenceId), item);
  }
  const add = (item, startDate, endDate, identity) => {
    let day = startDate.toString().slice(0, 10);
    const allDay = startDate.isDate;
    const start = allDay
      ? Date.parse(day + "T12:00:00Z")
      : startDate.toUnixTime() * 1000;
    const end = allDay
      ? Date.parse(endDate.toString().slice(0, 10) + "T12:00:00Z")
      : endDate.toUnixTime() * 1000;
    assert(
      Number.isFinite(start) && Number.isFinite(end) && end >= start,
      "An event has an unreadable time.",
      422,
    );
    // Never interpret an unknown timezone as UTC.
    for (const field of ["dtstart", "dtend"]) {
      const tzid = item.component.getFirstProperty(field)?.getParameter("tzid");
      assert(
        !tzid || ICAL.TimezoneService.has(tzid),
        "A calendar timezone is missing its definition.",
        422,
      );
    }
    assert(
      allDay || startDate.zone.tzid !== "floating",
      "A timed calendar event needs a timezone.",
      422,
    );
    let timezone =
      startDate.zone.tzid === "UTC" ? calendarZone : startDate.zone.tzid;
    if (!allDay) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format(start);
      } catch {
        timezone = calendarZone;
      }
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .formatToParts(start)
          .map((p) => [p.type, p.value]),
      );
      day = `${parts.year}-${parts.month}-${parts.day}`;
    }
    if (day < FIRST_DAY || day > through) return;
    const title = String(item.summary || "Untitled event").slice(0, 200),
      id = "cal-" + hash(item.uid + "|" + identity).slice(0, 48);
    out.set(id, {
      id,
      legacyId:
        identity === "single"
          ? String(item.uid).replace(/@google\.com$/, "")
          : "",
      title,
      kind: calendarKind(title),
      start,
      end,
      day,
      allDay,
      timezone: allDay ? "" : timezone,
      location: String(item.location || "").slice(0, 500),
      status:
        item.component.getFirstPropertyValue("status") === "CANCELLED"
          ? "cancelled"
          : "scheduled",
    });
    assert(out.size <= 5000, "This calendar has too many occurrences.", 413);
  };
  for (const c of components) {
    const event = new ICAL.Event(c);
    assert(event.uid, "A calendar event is missing its identifier.", 422);
    if (event.isRecurrenceException()) {
      // Also include exceptions moved across the expansion window boundary.
      if (event.startDate)
        add(
          event,
          event.startDate,
          event.endDate,
          occurrenceKey(event.recurrenceId),
        );
      else if (c.getFirstPropertyValue("status") === "CANCELLED")
        add(
          event,
          event.recurrenceId,
          event.recurrenceId,
          occurrenceKey(event.recurrenceId),
        );
      continue;
    }
    if (!event.startDate) continue;
    if (!event.isRecurring()) {
      add(event, event.startDate, event.endDate, "single");
      continue;
    }
    const iterator = event.iterator();
    let date;
    while ((date = iterator.next())) {
      assert(
        ++steps <= 20000,
        "This calendar recurrence is too large to sync safely.",
        413,
      );
      if (date.toString().slice(0, 10) > through) break;
      const exception = exceptions.get(event.uid + "|" + occurrenceKey(date));
      const occurrence = exception
        ? {
            item: exception,
            startDate: exception.startDate || date,
            endDate: exception.startDate ? exception.endDate : date,
          }
        : event.getOccurrenceDetails(date);
      add(
        occurrence.item,
        occurrence.startDate,
        occurrence.endDate,
        occurrenceKey(date),
      );
    }
  }
  return {
    name: String(
      root.getFirstPropertyValue("x-wr-calname") || "Calendar",
    ).slice(0, 100),
    from: FIRST_DAY,
    through,
    checkedAt: now,
    events: [...out.values()].sort((a, b) => a.start - b.start),
  };
}

export async function readCalendar(url, fetcher = fetch, now = Date.now()) {
  const address = calendarFeedURL(url);
  let response;
  try {
    response = await fetcher(address, {
      redirect: "error",
      signal: AbortSignal.timeout(18000),
      headers: { Accept: "text/calendar" },
    });
  } catch {
    throw Object.assign(
      new Error(
        "Google Calendar could not be reached. Try again; the saved calendar is unchanged.",
      ),
      { status: 502 },
    );
  }
  assert(
    response.ok,
    "Google could not open that calendar. Check its secret address.",
    502,
  );
  assert(
    Number(response.headers.get("content-length") || 0) <= MAX_BYTES,
    "This calendar is too large.",
    413,
  );
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      assert(size <= MAX_BYTES, "This calendar is too large.", 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return parseCalendar(Buffer.concat(chunks).toString("utf8"), now);
}

export function mergeCalendar(previous, incoming) {
  const present = new Set(incoming.events.map((e) => e.id));
  const removed = (previous?.events || [])
    .filter(
      (e) =>
        e.day >= incoming.from &&
        e.day <= incoming.through &&
        !present.has(e.id),
    )
    .map((e) => ({ ...e, status: "removed" }));
  return {
    ...incoming,
    events: [...incoming.events, ...removed].sort((a, b) => a.start - b.start),
    connected: true,
    error: null,
  };
}

export async function refreshCalendar(
  main,
  key,
  { fetcher = fetch, now = Date.now() } = {},
) {
  const before = await main.get(key, { type: "json" }),
    connection = before?.calendarConnection;
  if (!connection?.url) return;
  try {
    const incoming = await readCalendar(connection.url, fetcher, now);
    await transact(main, key, (d) => {
      if (
        d.calendarConnection?.generation !== connection.generation ||
        d.calendar?.checkedAt > now
      )
        return {};
      d.calendar = mergeCalendar(d.calendar, incoming);
      d.revision++;
      return {};
    });
  } catch (error) {
    await transact(main, key, (d) => {
      if (
        d.calendarConnection?.generation !== connection.generation ||
        d.calendar?.checkedAt > now
      )
        return {};
      if (d.calendar)
        d.calendar.error =
          "Calendar refresh failed. Saved entries are still available. Check the connection and try again.";
      d.revision++;
      return {};
    });
    throw error;
  }
}

export async function calendarAction({
  action,
  input,
  main,
  key,
  token,
  fetcher = fetch,
}) {
  if (action === "calendar-connect") {
    const url = calendarFeedURL(input.url),
      incoming = await readCalendar(url, fetcher);
    assert(
      /^winnie$/i.test(incoming.name.trim()),
      "Use the shared calendar named Winnie.",
    );
    const result = await transact(main, key, (d) => {
      authenticate(d, token);
      d.calendarConnection = { url, generation: randomUUID() };
      d.calendar = mergeCalendar(d.calendar, incoming);
      d.revision++;
      return {};
    });
    return snapshot(result.doc);
  }
  if (action === "calendar-refresh") {
    await refreshCalendar(main, key, { fetcher });
    return snapshot(await main.get(key, { type: "json" }));
  }
  const result = await transact(main, key, (d) => {
    const actor = authenticate(d, token);
    if (action === "calendar-disconnect") {
      delete d.calendarConnection;
      if (d.calendar) {
        d.calendar.connected = false;
        d.calendar.error = null;
      }
      d.revision++;
      return {};
    }
    assert(action === "calendar-confirm", "Unknown calendar action.");
    const v = d.calendar?.events.find((e) => e.id === input.id);
    assert(
      v &&
        v.status === "scheduled" &&
        !v.allDay &&
        v.end <= Date.now() &&
        ["trainer", "vet", "grooming", "training"].includes(v.kind),
      "Choose a past timed care visit to confirm.",
    );
    const match = calendarMatch(v, d.events);
    assert(
      !match || match.exact,
      "A care record already matches this visit. Open that record instead.",
      409,
    );
    if (match?.exact) return {};
    assert(
      !d.events.some((e) => e.id === "visit-" + v.id),
      "This visit was previously logged and deleted. Restore it from Recently deleted.",
      409,
    );
    const payload = {
      time: v.start,
      end_time: v.end,
      timezone: v.timezone,
      time_precision: "exact",
      calendarVisitId: v.id,
      note: v.title,
      location: v.location,
      historical: v.end < Date.now() - 86400000,
      tags: [],
      who: v.kind === "trainer" ? "trainer" : "us",
      ...(v.kind === "trainer"
        ? { type: "covered_gap", kind: "trainer" }
        : v.kind === "vet"
          ? { type: "appointment", appointment_kind: "vet" }
          : v.kind === "grooming"
            ? { type: "grooming", careTitle: calendarCareTitle(v.title) }
            : { type: "enrichment", enrichment_kind: "training" }),
    };
    applyCommand(
      d,
      {
        protocol: 4,
        operationId: "confirm-" + v.id,
        kind: "create",
        eventId: "visit-" + v.id,
        payload,
      },
      actor,
    );
    return {};
  });
  return snapshot(result.doc);
}
