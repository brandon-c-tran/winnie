import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  eventPosition,
  placeLabel,
  placeName,
  createCityLookup,
  groupPlaces,
  distanceKm,
  placeDirectory,
  placeDay,
} from "../public/places.js";
import { mapURL } from "../public/care-state.js";
const rows = JSON.parse(
  await fs.readFile(new URL("../public/geo/cities.json", import.meta.url)),
);
const lookup = createCityLookup(rows);
const sf = { lat: 37.7749, lng: -122.4194 },
  la = { lat: 34.0522, lng: -118.2437 };
test("old coordinates and new pins have one readable, nonmutating interpretation", () => {
  for (const e of [
    { coords: { ...sf, acc: 12 } },
    { placePin: { ...sf, accuracy: 12, capturedAt: 1 } },
    { location: "37.7749, -122.4194" },
  ]) {
    const original = JSON.stringify(e);
    assert.deepEqual(eventPosition(e), sf);
    assert.equal(placeLabel(e, lookup), "San Francisco");
    assert(mapURL(e).includes("37.7749,-122.4194"));
    assert.equal(JSON.stringify(e), original);
  }
  assert.equal(
    placeLabel({ coords: sf, location: "Our park" }, lookup),
    "Our park · San Francisco",
  );
  assert.equal(placeLabel({ location: "Home" }, lookup), "Home");
  assert.equal(placeName({ location: null }), "");
});
test("removed pins stay removed and invalid coordinates never turn into real places", () => {
  assert.equal(
    eventPosition({
      placePin: null,
      coords: sf,
      location: "37.7749,-122.4194",
    }),
    null,
  );
  assert.equal(
    mapURL({ placePin: null, coords: sf, location: "37.7749,-122.4194" }),
    null,
  );
  for (const coords of [
    { lat: null, lng: null },
    { lat: 91, lng: 0 },
    { lat: 0, lng: 181 },
    { lat: "", lng: 0 },
    { lat: Infinity, lng: 0 },
  ])
    assert.equal(eventPosition({ coords }), null);
  assert.deepEqual(eventPosition({ coords: { lat: "0", lng: "0" } }), {
    lat: 0,
    lng: 0,
  });
  assert.equal(
    placeLabel({ coords: sf }, () => null),
    "Location saved",
  );
});
test("global city lookup handles different regions and the date line", () => {
  assert.equal(lookup(la).name, "Los Angeles");
  assert.equal(lookup({ lat: 51.5074, lng: -0.1278 }).name, "London");
  const dateLine = createCityLookup([
    ["a", "West", 0, -179, "US", ""],
    ["b", "East", 0, 170, "US", ""],
  ]);
  assert.equal(dateLine({ lat: 0, lng: 179.9 }).name, "West");
  assert(distanceKm({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 }) < 23);
});
test("places count recorded days, exclude deleted/future entries and preserve history", () => {
  const time = Date.parse("2026-01-02T07:00:00Z");
  const events = [
    { id: "a", time, coords: sf },
    { id: "b", time: time + 1000, coords: sf },
    { id: "c", time: time + 86400000, placePin: sf },
    { id: "d", time, coords: la },
    { id: "e", time, location: "Home" },
    { id: "f", time: time + 1e9, coords: sf },
    { id: "g", time, coords: sf, deletedAt: time },
  ];
  const before = JSON.stringify(events),
    result = groupPlaces(events, lookup, time + 86400001);
  assert.equal(result.mapped, 4);
  assert.equal(result.missing, 1);
  assert.equal(result.groups.length, 2);
  const city = result.groups.find((g) => g.name === "San Francisco");
  assert.equal(city.days.size, 2);
  assert.equal(city.events.length, 3);
  assert.equal(city.first, time);
  assert.equal(city.events[0].id, "c");
  assert.equal(JSON.stringify(events), before);
  assert.deepEqual(groupPlaces([], lookup), {
    groups: [],
    missing: 0,
    mapped: 0,
  });
});

test("destination index keeps named spots, unnamed pins and name-only history without inventing visits", () => {
  const time = Date.parse("2026-01-02T07:00:00Z");
  const events = [
    { id: "a", type: "pee", time, coords: sf, location: "The park" },
    {
      id: "b",
      type: "poop",
      time: time + 1000,
      coords: sf,
      location: " the PARK ",
    },
    { id: "c", time: time + 86400000, coords: sf },
    { id: "d", time, location: "Grandma's" },
    { id: "e", time, coords: la, placePin: null, location: "Grandma's" },
    { id: "missing", time },
    { id: "future", time: time + 1e9, coords: sf },
    { id: "deleted", time, coords: sf, deletedAt: time },
  ];
  const original = JSON.stringify(events);
  const { groups, missing } = placeDirectory(events, lookup, time + 86400001);
  assert.equal(groups.length, 2);
  assert.equal(missing, 1);
  const city = groups.find((g) => g.located);
  assert.equal(city.days.size, 2);
  assert.equal(city.events.length, 3);
  assert.equal(city.spots.length, 2);
  assert.equal(city.spots[0].events.length, 2);
  assert.equal(city.spots[0].days.size, 1);
  assert.equal(groups.find((g) => !g.located).events.length, 2);
  assert.equal(placeDay(time), "2026-01-01");
  assert.equal(JSON.stringify(events), original);
});
