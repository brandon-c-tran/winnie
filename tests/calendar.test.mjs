import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  parseCalendar,
  calendarFeedURL,
  mergeCalendar,
  refreshCalendar,
  calendarAction,
} from "../netlify/lib/calendar.mjs";
import { calendarKind, calendarMatch } from "../public/calendar.js";
import { migrate, hash, snapshot } from "../netlify/lib/core.mjs";
import { createHandler } from "../netlify/lib/api.mjs";
import { MemoryStore } from "./store.mjs";
const source = fs.readFileSync(
  new URL("./fixtures/winnie-calendar.ics", import.meta.url),
  "utf8",
);
const now = Date.parse("2026-10-13T12:00:00Z");
const url =
  "https://calendar.google.com/calendar/ical/synthetic%40group.calendar.google.com/private-abcdef/basic.ics";
const feed = () => new Response(source);
const envelope = (events) =>
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Winnie\r\n" +
  events +
  "\r\nEND:VCALENDAR";
const event = (extra = "") =>
  "BEGIN:VEVENT\r\nUID:series@google.com\r\nDTSTART:20251026T170000Z\r\nDTEND:20251026T180000Z\r\nSUMMARY:Training w/ Will\r\n" +
  extra +
  "\r\nEND:VEVENT";
async function fixture() {
  const main = new MemoryStore(),
    d = migrate({ schemaVersion: 3, events: [] });
  d.devices = {
    a: { id: "a", person: "brandon", tokenHash: hash("a".repeat(64)) },
    b: { id: "b", person: "kim", tokenHash: hash("b".repeat(64)) },
  };
  await main.setJSON("home/test", d);
  return {
    main,
    key: "home/test",
    token: "a." + "a".repeat(64),
    fetcher: feed,
  };
}
test("calendar recognizes exact Will sessions, broader classes, vet and grooming independently", () => {
  assert.equal(calendarKind("Training w/ Will"), "trainer");
  assert.equal(calendarKind("training with Will"), "trainer");
  assert.equal(calendarKind("Puppy pre-school"), "training");
  assert.equal(calendarKind("Training"), "training");
  assert.equal(calendarKind("Vet :("), "vet");
  assert.equal(calendarKind("Bath and tidy"), "grooming");
  assert.equal(calendarKind("Winnie arrives"), "other");
});
test("feed retains historical all-day dates and local timed visits with stable IDs", () => {
  const c = parseCalendar(source, now),
    repeat = parseCalendar(source, now + 1000);
  assert.equal(c.events.length, 8);
  assert.equal(c.events[0].day, "2025-10-04");
  assert.equal(c.events[0].allDay, true);
  assert.equal(c.events[1].start, Date.parse("2025-10-28T16:30:00Z"));
  assert.equal(c.events[1].timezone, "America/Los_Angeles");
  assert.deepEqual(c.events, repeat.events);
});
test("recurrences respect DST, exceptions, EXDATE and cancellation identity", () => {
  const recurring = source
    .replace("20261103T140000", "20251028T140000")
    .replace("20261103T150000", "20251028T150000");
  const entries = parseCalendar(recurring, now).events.filter(
    (e) => e.kind === "trainer" && !e.legacyId,
  );
  assert.equal(new Date(entries[0].start).getUTCHours(), 21);
  assert.equal(new Date(entries[1].start).getUTCHours(), 22);
  const original = envelope(
    event("RRULE:FREQ=WEEKLY;COUNT=3\r\nEXDATE:20251109T170000Z"),
  );
  const moved =
    "BEGIN:VEVENT\r\nUID:series@google.com\r\nRECURRENCE-ID:20251102T170000Z\r\nDTSTART:20251103T180000Z\r\nDTEND:20251103T190000Z\r\nSUMMARY:Training w/ Will\r\nEND:VEVENT";
  const before = parseCalendar(original, now).events,
    after = parseCalendar(
      original.replace("END:VCALENDAR", moved + "\r\nEND:VCALENDAR"),
      now,
    ).events;
  assert.equal(after.length, 2);
  assert.equal(after[1].id, before[1].id);
  assert.equal(after[1].day, "2025-11-03");
  const cancelled = parseCalendar(
    original.replace(
      "END:VCALENDAR",
      moved.replace("SUMMARY:", "STATUS:CANCELLED\r\nSUMMARY:") +
        "\r\nEND:VCALENDAR",
    ),
    now,
  ).events;
  assert.equal(cancelled[1].status, "cancelled");
});
test("private feed URL rejects redirects, public links and other origins; unknown timezone fails closed", () => {
  assert.equal(calendarFeedURL(url), url);
  for (const invalid of [
    "https://evil.test/a",
    "http://calendar.google.com/a",
    url + "?x=1",
    url.replace("private-abcdef", "public"),
    url.replace("calendar.google.com", "calendar.google.com.evil.test"),
  ])
    assert.throws(() => calendarFeedURL(invalid));
  assert.throws(() =>
    parseCalendar(
      envelope(
        event().replace(
          "DTSTART:20251026T170000Z",
          "DTSTART;TZID=Missing/Zone:20251026T170000",
        ),
      ),
      now,
    ),
  );
  assert.throws(() => parseCalendar("not a calendar", now));
});
test("connecting stores secret only on server and imports no completed care; confirmations are shared and idempotent", async () => {
  const f = await fixture();
  const result = await calendarAction({
    ...f,
    action: "calendar-connect",
    input: { url },
  });
  assert.equal(result.calendar.events.length, 8);
  assert.equal(result.events.length, 0);
  assert.ok(!JSON.stringify(result).includes("private-abcdef"));
  const stored = await f.main.get(f.key);
  assert.equal(stored.calendarConnection.url, url);
  assert.ok(!JSON.stringify(snapshot(stored)).includes(url));
  const id = result.calendar.events.find((v) => v.kind === "trainer").id;
  await Promise.all([
    calendarAction({ ...f, action: "calendar-confirm", input: { id } }),
    calendarAction({
      ...f,
      token: "b." + "b".repeat(64),
      action: "calendar-confirm",
      input: { id },
    }),
  ]);
  const completed = await f.main.get(f.key);
  assert.equal(completed.events.length, 1);
  assert.equal(completed.events[0].type, "covered_gap");
  await refreshCalendar(f.main, f.key, { fetcher: feed });
  assert.equal((await f.main.get(f.key)).events.length, 1);
});
test("removed and cancelled appointments never delete logged care or count as active schedule", () => {
  const c = parseCalendar(source, now),
    next = { ...c, events: c.events.slice(1) };
  const merged = mergeCalendar(c, next);
  assert.equal(merged.events[0].status, "removed");
  assert.equal(merged.events.length, c.events.length);
});
test("matching existing care blocks duplicates; unrelated or ambiguous records are not presented as a match", async () => {
  const f = await fixture();
  let c = await calendarAction({
    ...f,
    action: "calendar-connect",
    input: { url },
  });
  const v = c.calendar.events.find((v) => v.kind === "trainer");
  const care = {
    id: "existing",
    type: "covered_gap",
    who: "trainer",
    time: v.start + 1000,
  };
  assert.equal(calendarMatch(v, [care]).event.id, "existing");
  assert.equal(
    calendarMatch(v, [care, { ...care, id: "other" }]).ambiguous,
    true,
  );
  const d = await f.main.get(f.key);
  d.events = [care];
  await f.main.setJSON(f.key, d);
  await assert.rejects(
    calendarAction({ ...f, action: "calendar-confirm", input: { id: v.id } }),
    /already matches/,
  );
});
test("failed refresh preserves evidence; disconnect during fetch prevents a late reconnect", async () => {
  const f = await fixture();
  await calendarAction({ ...f, action: "calendar-connect", input: { url } });
  await assert.rejects(
    refreshCalendar(f.main, f.key, {
      fetcher: () => {
        throw Error("private-abcdef");
      },
    }),
    /could not be reached/,
  );
  let d = await f.main.get(f.key);
  assert.equal(d.calendar.events.length, 8);
  assert.ok(d.calendar.error);
  assert.ok(!d.calendar.error.includes("private-abcdef"));
  let release;
  const pending = refreshCalendar(f.main, f.key, {
    fetcher: () =>
      new Promise((r) => {
        release = r;
      }),
  });
  while (!release) await new Promise((r) => setImmediate(r));
  await calendarAction({ ...f, action: "calendar-disconnect", input: {} });
  release(feed());
  await pending;
  d = await f.main.get(f.key);
  assert.equal(d.calendar.connected, false);
  assert.equal(d.calendar.events.length, 8);
  assert.equal(d.calendarConnection, undefined);
});
test("calendar API requires home authentication and never exports the private link", async () => {
  const f = await fixture(),
    home = hash("test"),
    d = await f.main.get(f.key);
  await f.main.setJSON("home/" + home, d);
  const api = createHandler(() => ({ main: f.main }), { calendarFetch: feed });
  const call = (action, auth = true, method = "POST") =>
    api(
      new Request("https://winnie.test/?action=" + action, {
        method,
        headers: auth
          ? { "X-Winnie-Home": home, Authorization: "Bearer " + f.token }
          : {},
        body: method === "POST" ? JSON.stringify({ url }) : undefined,
      }),
    );
  assert.equal((await call("calendar-connect", false)).status, 401);
  assert.equal((await call("calendar-connect", true, "GET")).status, 405);
  assert.equal((await call("calendar-connect")).status, 200);
  const exported = await call("export", true, "GET");
  assert.equal(exported.status, 200);
  assert.ok(!(await exported.text()).includes("private-abcdef"));
});

test("a UTC recurrence exception replaces its local-time occurrence without duplicating it", () => {
  const moved =
    "BEGIN:VEVENT\nUID:upcoming-will@google.com\nRECURRENCE-ID:20261110T220000Z\nDTSTART:20261111T230000Z\nDTEND:20261112T000000Z\nSUMMARY:Training w/ Will\nEND:VEVENT";
  const before = parseCalendar(source, now).events;
  const after = parseCalendar(
    source.replace("END:VCALENDAR", moved + "\nEND:VCALENDAR"),
    now,
  ).events;
  assert.equal(after.length, before.length);
  const original = before.find((e) => e.day === "2026-11-10");
  assert.equal(after.find((e) => e.id === original.id).day, "2026-11-11");
  const cancelled = moved.replace(
    /DTSTART:.*\nDTEND:.*\n/,
    "STATUS:CANCELLED\n",
  );
  const rows = parseCalendar(
    source.replace("END:VCALENDAR", cancelled + "\nEND:VCALENDAR"),
    now,
  ).events;
  assert.equal(rows.length, before.length);
  assert.equal(rows.find((e) => e.id === original.id).status, "cancelled");
});
