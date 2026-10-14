// Read-only travel evidence. A recorded day is not a visit or a continuous route.
import {
  eventPosition,
  placeName,
  placeDirectory,
  distanceKm,
} from "./places.js?v=4.22";
import { ageAt, recordDay, selectedPhotos, usable } from "./lifetime.js?v=4.22";
import { winniePhotos } from "./keepsakes.js?v=4.22";

export const regionName = (g) =>
  g.country === "US"
    ? {
        CA: "California",
        TX: "Texas",
        NY: "New York",
        NV: "Nevada",
        AZ: "Arizona",
        OR: "Oregon",
        WA: "Washington",
        CO: "Colorado",
        FL: "Florida",
        HI: "Hawaii",
      }[g.region] || g.region
    : new Intl.DisplayNames(["en"], { type: "region" }).of(g.country || "ZZ");
export const regionKey = (g) =>
  g.located ? `${g.country}:${g.region}` : "unmapped";
export const travelDate = (day) =>
  new Date(day + "T12:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
export const travelRange = (first, last) =>
  first === last
    ? travelDate(first)
    : `${travelDate(first)} – ${travelDate(last)}`;
export function travelAtlas(events, resolve, now = Date.now(), year = "all") {
  const observations = [];
  for (const e of events.filter(
    (e) => usable(e) && Number.isFinite(e.time) && e.time <= now,
  )) {
    const pin = eventPosition(e),
      name = placeName(e),
      selected = new Set(winniePhotos(e).map((p) => p.id));
    if (pin || name)
      observations.push({
        ...e,
        id: e.id + ":record",
        source: e,
        day: recordDay(e),
        photos: winniePhotos(e).filter((p) => !p.metadata),
      });
    for (const p of e.photos || []) {
      const m = p.metadata;
      if (!m) continue;
      const photoPin = Object.hasOwn(m, "pin") ? m.pin : pin;
      const photoName = Object.hasOwn(m, "location") ? m.location : name;
      const time = m.capturedAt ?? e.time;
      if (time > now || (!photoPin && !photoName)) continue;
      observations.push({
        ...e,
        id: e.id + ":photo:" + p.id,
        time,
        placePin: photoPin,
        location: photoName,
        source: e,
        day:
          m.wall?.slice(0, 10) ||
          recordDay({ ...e, time, timezone: m.timezone || e.timezone }),
        photos: selected.has(p.id) ? [p] : [],
      });
    }
  }
  const directory = placeDirectory(
    observations.filter((o) => year === "all" || o.day.slice(0, 4) === year),
    resolve,
    now,
  );
  const groups = directory.groups.map((g) => {
    const days = [...new Set(g.events.map((e) => e.day))].sort();
    const photos = [
      ...new Map(
        g.events.flatMap((e) =>
          e.photos.map((p) => [
            p.id,
            { photo: p, event: e.source, day: e.day },
          ]),
        ),
      ).values(),
    ];
    const points = g.events.map(eventPosition).filter(Boolean);
    // Display the saved area, never move a rural pin onto a distant city center.
    const point = points.length ? points[Math.floor(points.length / 2)] : null;
    return {
      ...g,
      point,
      photos,
      days: new Set(days),
      firstDay: days[0],
      lastDay: days.at(-1),
      age: ageAt(days[0]),
      sources: [
        ...new Map(g.events.map((e) => [e.source.id, e.source])).values(),
      ],
    };
  });
  const mapped = groups.filter((g) => g.located && g.point);
  const base = [...mapped].sort((a, b) => b.days.size - a.days.size)[0];
  const regions = [
    ...new Map(
      mapped.map((g) => [
        regionKey(g),
        { key: regionKey(g), name: regionName(g) },
      ]),
    ).values(),
  ];
  const countries = new Set(mapped.map((g) => g.country));
  const allDays = [...new Set(mapped.flatMap((g) => [...g.days]))].sort();
  const away = new Map();
  if (base)
    for (const g of mapped.filter((g) => distanceKm(base.point, g.point) >= 60))
      for (const e of g.events) {
        if (!away.has(e.day)) away.set(e.day, []);
        away.get(e.day).push({ group: g, observation: e });
      }
  const outings = [];
  for (const [day, rows] of [...away].sort(([a], [b]) => a.localeCompare(b))) {
    const prior = outings.at(-1),
      anchor = rows[0].group;
    const consecutive =
      prior && (Date.parse(day) - Date.parse(prior.lastDay)) / 86400000 <= 1;
    if (
      consecutive &&
      distanceKm(prior.anchor.point, anchor.point) < 150 &&
      regionKey(prior.anchor) === regionKey(anchor)
    ) {
      prior.lastDay = day;
      prior.rows.push(...rows);
    } else
      outings.push({
        id: "outing:" + day,
        firstDay: day,
        lastDay: day,
        anchor,
        rows: [...rows],
        inferred: true,
      });
  }
  for (const trip of outings) {
    const counts = new Map();
    for (const r of trip.rows)
      counts.set(r.group.id, (counts.get(r.group.id) || 0) + 1);
    const destinations = [
      ...new Map(trip.rows.map((r) => [r.group.id, r.group])).values(),
    ].sort((a, b) => counts.get(b.id) - counts.get(a.id));
    trip.name = destinations[0].name;
    trip.groups = destinations;
    trip.age = ageAt(trip.firstDay);
    trip.days = [...new Set(trip.rows.map((r) => r.observation.day))].sort();
    trip.photos = [
      ...new Map(
        destinations.flatMap((g) =>
          g.photos
            .filter((p) => p.day >= trip.firstDay && p.day <= trip.lastDay)
            .map((p) => [p.photo.id, p]),
        ),
      ).values(),
    ];
  }
  // Explicit trip names override suggestions for the same recorded period.
  const keepsakes = selectedPhotos(events).filter(p => p.time <= now).map(p => ({
    ...p,
    day: p.photo.metadata?.wall?.slice(0, 10) || recordDay({
      ...p.event, time: p.time, timezone: p.photo.metadata?.timezone || p.event.timezone,
    }),
  }));
  const saved = events
    .filter(
      (e) =>
        usable(e) &&
        e.tags?.includes("trip-collection") &&
        e.end_time >= e.time,
    )
    .map((e) => {
      const firstDay = recordDay(e),
        lastDay = recordDay({ ...e, time: e.end_time });
      const rows = mapped.flatMap((group) =>
        group.events
          .filter((o) => o.day >= firstDay && o.day <= lastDay)
          .map((observation) => ({ group, observation })),
      );
      const destinations = [
        ...new Map(rows.map((r) => [r.group.id, r.group])).values(),
      ];
      const photos = keepsakes.filter(p => p.day >= firstDay && p.day <= lastDay &&
        (year === "all" || p.day.slice(0, 4) === year));
      return {
        id: e.id,
        name: e.note || "Saved trip",
        firstDay,
        lastDay,
        age: ageAt(firstDay),
        days: [...new Set([...rows.map((r) => r.observation.day), ...photos.map(p => p.day)])].sort(),
        rows,
        groups: destinations,
        photos,
        inferred: false,
      };
    })
    .filter(
      (t) =>
        year === "all" ||
        (t.firstDay <= year + "-12-31" && t.lastDay >= year + "-01-01"),
    );
  const uncovered = outings.filter(
    (t) =>
      !saved.some((s) => t.firstDay >= s.firstDay && t.lastDay <= s.lastDay),
  );
  return {
    groups,
    mapped,
    regions,
    countries,
    base,
    firstDay: allDays[0],
    lastDay: allDays.at(-1),
    outings: [...saved, ...uncovered].sort((a, b) =>
      b.firstDay.localeCompare(a.firstDay),
    ),
    missing: events.filter(
      (e) =>
        usable(e) &&
        e.time <= now &&
        !observations.some((o) => o.source.id === e.id),
    ).length,
  };
}
