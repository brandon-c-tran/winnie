import test from "node:test";
import assert from "node:assert/strict";
import {
  albumChapters,
  ageMonth,
  filterPhotoChoices,
} from "../public/story-album.js";
import { applyCommand, migrate } from "../netlify/lib/core.mjs";
import { project } from "../public/sync.js";
const make = (id, day, type = "moment") => ({
  id,
  type,
  time: Date.parse(day + "T12:00:00Z"),
  photos: [
    {
      id: "photo-" + id,
      metadata: {
        capturedAt: Date.parse(day + "T12:00:00Z"),
        wall: day + "T12:00",
        timezone: "UTC",
      },
    },
  ],
});
test("age chapters respect birth-month boundaries, photo dates, keepsakes and saved covers", () => {
  const events = [
    make("one", "2025-09-24"),
    make("two", "2025-09-25"),
    make("three", "2025-10-04"),
    make("care", "2025-10-05", "poop"),
    make("removed", "2025-10-06"),
  ];
  events[4].deletedAt = 1;
  events[0].time = Date.parse("2026-10-13T12:00Z");
  let chapters = albumChapters(
    events,
    { storyCovers: { 2: "photo-two" } },
    0,
    "2026-10-13",
  );
  assert.equal(ageMonth("2025-09-24"), 1);
  assert.equal(ageMonth("2025-09-25"), 2);
  assert.equal(chapters.length, 12);
  assert.equal(chapters[1].photos.length, 1);
  assert.equal(chapters[2].photos.length, 2);
  assert.equal(chapters[2].cover.photo.id, "photo-two");
  events[3].photos[0].keepsake = true;
  chapters = albumChapters(
    events,
    { storyCovers: { 2: "missing" } },
    0,
    "2026-10-13",
  );
  assert.equal(chapters[2].photos.length, 3);
  assert.ok(chapters[2].cover);
  assert.equal(albumChapters(events, {}, 1, "2026-10-13").length, 3);
});
test("large libraries remain searchable by date, place and personal recollection", () => {
  const photos = Array.from({ length: 6000 }, (_, i) => ({
    day: i === 5999 ? "2025-10-04" : "2026-09-10",
    location: "San Carlos",
    event: {
      note: "",
      recollections:
        i === 5999 ? { kim: { text: "His tiny paws on the drive home" } } : {},
    },
  }));
  assert.equal(filterPhotoChoices(photos, { query: "tiny paws" }).length, 1);
  assert.equal(filterPhotoChoices(photos, { month: "2025-10" }).length, 1);
  assert.equal(
    filterPhotoChoices(photos, { query: "San Carlos" }).length,
    6000,
  );
});
test("both caregivers can recollect concurrently without overwriting original notes or each other", () => {
  const doc = migrate({
    events: [{ ...make("memory", "2025-10-04"), note: "Original caption" }],
  });
  const b = { id: "b", person: "brandon" },
    k = { id: "k", person: "kim" };
  const cmd = (id, text, previous = "") => ({
    protocol: 4,
    operationId: id,
    kind: "recollect",
    eventId: "memory",
    expectedRevision: 1,
    payload: { text, previous },
  });
  applyCommand(doc, cmd("one", "He slept in my arms."), b);
  applyCommand(doc, cmd("two", "I remember his little paws."), k);
  assert.equal(doc.events[0].note, "Original caption");
  assert.equal(Object.keys(doc.events[0].recollections).length, 2);
  assert.throws(
    () => applyCommand(doc, cmd("three", "Stale overwrite"), b),
    /changed on another device/,
  );
  applyCommand(doc, cmd("four", "", "He slept in my arms."), b);
  assert.deepEqual(Object.keys(doc.events[0].recollections), ["kim"]);
  assert.equal(Object.keys(doc.jobs).length, 0);
  const projected = project({
    snapshot: doc,
    queue: [{ person: "brandon", command: cmd("five", "Offline memory") }],
  });
  assert.equal(
    projected.events[0].recollections.brandon.text,
    "Offline memory",
  );
  assert.ok(projected.events[0].recollections.kim);
  assert.equal(doc.events[0].recollections.brandon, undefined);
  doc.events[0].deletedAt = 1;
  assert.throws(() => applyCommand(doc, cmd("six", "No"), k), /removed/);
});
