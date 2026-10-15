import { loadCities, placeDay } from "./places.js?v=4.28";
import {
  travelAtlas,
  regionKey,
  regionName,
  travelDate,
  travelRange,
} from "./travel.js?v=4.28";
import { ageAt } from "./lifetime.js?v=4.28";
import { icon } from "./icons.js?v=4.0";
import { createTravelMap } from "./travel-map.js?v=4.28";

export function createPlacesView({ root, esc, entry, hydratePhotos }) {
  let events = [],
    atlas = null,
    selected = null,
    preview = null,
    outing = null,
    dayIndex = -1;
  let year = "all",
    scope = "all",
    query = "",
    order = "recent",
    ready = false,
    loading = false,
    error = "",
    map = null,
    frame = null,
    limit = 14,
    listScroll = 0,
    spot = null,
    signature = "",
    photoPickerOpen = false,
    directoryExpanded = false;
  const openDays = new Set();
  const photoStrip = (photos) =>
    photos.length
      ? `<div class="travel-photos">${photos
          .slice(0, 6)
          .map(
            (p) =>
              `<button data-open="${esc(p.event.id)}" aria-label="Open photo from ${travelDate(p.day)}"><img data-photo="${esc(p.photo.id)}" alt="Winnie on ${travelDate(p.day)}" loading="lazy"></button>`,
          )
          .join("")}</div>`
      : "";
  async function load() {
    if (loading) return;
    loading = true;
    try {
      await loadCities();
      error = "";
    } catch {
      error =
        "Place names couldn't load. Your saved place names are available below.";
    }
    ready = true;
    loading = false;
    render();
  }
  function currentTrip() {
    return atlas?.outings.find((t) => t.id === outing);
  }
  function visibleGroups() {
    return atlas.groups.filter(
      (g) =>
        (scope === "all" || regionKey(g) === scope) &&
        [
          g.name,
          regionName({ ...g, country: g.country || "ZZ" }),
          ...g.spots.map((s) => s.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase().trim()),
    );
  }
  function mappedGroups() {
    const trip = currentTrip();
    if (!trip) return visibleGroups().filter((g) => g.point);
    if (dayIndex < 0) return trip.groups;
    const day = trip.days[dayIndex];
    return trip.groups.filter((g) => g.events.some((e) => e.day === day));
  }
  function selection() {
    const trip = currentTrip();
    if (trip) {
      const day = trip.days[dayIndex],
        photos = day ? trip.photos.filter((p) => p.day === day) : trip.photos;
      return `<div class="travel-selected"><button class="text-button" data-trip-close>All destinations</button><h2>${esc(trip.name)}</h2><p>${travelRange(trip.firstDay, trip.lastDay)}</p><p class="fine">${trip.age} at the first recorded day${trip.inferred ? " here" : ""}</p>${trip.days.length ? `<div class="travel-replay"><button class="px btn" data-trip-step="-1" aria-label="Previous recorded day" ${dayIndex <= 0 ? "disabled" : ""}>${icon("left")}</button><div aria-live="polite"><strong>${day ? travelDate(day) : "All recorded days"}</strong><span>${day ? ageAt(day) : trip.days.length + " recorded days"}</span></div><button class="px btn" data-trip-step="1" aria-label="Next recorded day" ${dayIndex >= trip.days.length - 1 ? "disabled" : ""}>${icon("right")}</button></div><div class="travel-day-actions">${dayIndex >= 0 ? '<button class="text-button" data-trip-overview>Show all days</button>' : ""}<span class="fine">${dayIndex >= 0 ? dayIndex + 1 + " of " + trip.days.length : "Step through the saved locations"}</span></div>` : '<p class="fine">No saved locations in this date range yet. Photos from the trip can fill it in.</p><button class="text-button" data-act="photo">Add trip photos</button>'}${day && !mappedGroups().length ? '<p class="fine">No saved location for this day. Its photos still belong to the trip.</p>' : ""}${photoStrip(photos)}<div class="travel-stop-links">${mappedGroups()
        .map(
          (g) =>
            `<button class="text-button" data-city="${esc(g.id)}">${esc(g.name)}</button>`,
        )
        .join(
          "",
        )}</div>${tripPhotoPicker(trip)}${trip.inferred ? '<p class="fine">Suggested outing from nearby pins on consecutive days.</p><button class="text-button" data-save-outing>Name & save this trip</button>' : `<button class="text-button" data-open="${esc(trip.id)}">Edit trip</button>`}</div>`;
    }
    const g = atlas.groups.find((g) => g.id === preview);
    if (!g)
      return '<p class="travel-map-hint">Choose a marker to see when Winnie was there. Numbered markers group nearby destinations.</p>';
    return `<div class="travel-selected"><div class="travel-selected-head"><h2>${esc(g.name)}</h2><button class="text-button" data-preview-close aria-label="Clear selected destination">Close</button></div><p>${year === "all" ? "First saved here" : "Earliest shown"} at <strong>${g.age}</strong></p><p class="fine">${travelDate(g.firstDay)}</p><p class="fine">${g.days.size} recorded ${g.days.size === 1 ? "day" : "days"}</p>${photoStrip(g.photos)}<button class="text-button" data-city="${esc(g.id)}">Photos & recorded days</button></div>`;
  }
  function tripPhotoPicker(trip) {
    const candidates = [
      ...new Map(
        trip.rows.flatMap(({ observation: o }) =>
          (o.source.photos || [])
            .filter((p) => {
              const day = p.metadata?.wall?.slice(0, 10) || o.day;
              return (
                ["pee", "poop", "meal"].includes(o.source.type) &&
                day >= trip.firstDay &&
                day <= trip.lastDay
              );
            })
            .map((p) => [p.id, { p, e: o.source }]),
        ),
      ).values(),
    ];
    if (!candidates.length) return "";
    return `<details class="travel-photo-picker" ${photoPickerOpen ? "open" : ""}><summary>Choose from ${candidates.length} care photos</summary><p class="fine">Keep the photos you want in this trip and Winnie's album. Their care records stay attached.</p><div>${candidates.map(({ p, e }) => `<figure><img data-photo="${esc(p.id)}" alt="Care photo from this trip" loading="lazy"><button class="text-button" data-keep-photo="${esc(p.id)}" data-id="${esc(e.id)}" aria-pressed="${p.keepsake === true}">${p.keepsake ? "Kept in Winnie" : "Keep in Winnie"}</button></figure>`).join("")}</div></details>`;
  }
  function mapHTML() {
    const interactive = !matchMedia("(pointer: coarse)").matches;
    return `<section class="travel-map-block" aria-label="Winnie's travel map"><div class="travel-map-tools"><button class="text-button" data-map-fit>Show all in view</button><button class="text-button" data-map-interact aria-pressed="${interactive}">${interactive ? "Done moving" : "Move map"}</button></div><div class="travel-map" id="travel-map" aria-label="Map of saved destinations"></div><p class="travel-map-status fine" data-map-status hidden></p></section><div id="travel-selection">${selection()}</div>`;
  }
  function mountMap() {
    const node = root.querySelector("#travel-map");
    if (!node) return;
    map = createTravelMap(node, {
      groups: mappedGroups(),
      selected: preview,
      frame,
      onFrame: (f) => {
        frame = f;
      },
      onSelect: (id) => {
        preview = id;
        if (outing) {
          selected = id;
          render();
          return;
        }
        root.querySelector("#travel-selection").innerHTML = selection();
        hydratePhotos();
      },
    });
  }
  function cityRow(g) {
    return `<button class="place-city" data-city="${esc(g.id)}"><span class="place-copy"><strong>${esc(g.name)}</strong><span class="place-last">${g.located ? (year === "all" ? "First saved here at " : "Earliest shown at ") + g.age : "Saved by name"}</span><span class="place-last">${travelDate(g.firstDay)}</span></span><span class="place-days"><strong>${g.days.size}</strong><span>recorded ${g.days.size === 1 ? "day" : "days"}</span></span></button>`;
  }
  function detail(g) {
    const chosenSpot = g.spots.find((s) => s.id === spot),
      rows = chosenSpot ? chosenSpot.events : g.events,
      days = new Map();
    for (const e of rows) {
      if (!days.has(e.day)) days.set(e.day, []);
      if (!days.get(e.day).some((r) => r.id === e.source.id))
        days.get(e.day).push(e.source);
    }
    return `<section class="place-history"><button class="text-button place-back" data-place-close>Back to places</button><header class="place-heading"><div><h2 tabindex="-1">${esc(g.name)}</h2><p>${g.located ? esc(regionName(g)) : "Saved by name"}</p></div>${g.point ? `<a class="text-button" href="https://www.google.com/maps/search/?api=1&query=${g.point.lat},${g.point.lng}" target="_blank" rel="noopener noreferrer">City map</a>` : ""}</header><p class="travel-age">${year === "all" ? "First saved here" : "Earliest shown"} at <strong>${g.age}</strong></p><dl class="place-dates"><div><dt>First recorded</dt><dd>${travelDate(g.firstDay)}</dd></div><div><dt>Latest</dt><dd>${travelDate(g.lastDay)}</dd></div></dl>${photoStrip(g.photos)}${g.spots.some((s) => s.name) ? `<label class="place-spot-label">Place<select data-place-spot><option value="all">All locations</option>${g.spots.map((s) => `<option value="${esc(s.id)}" ${spot === s.id ? "selected" : ""}>${esc(s.name || "Other saved locations")}</option>`).join("")}</select></label>` : ""}<div class="place-days-heading"><h3>Recorded days</h3><span>${days.size}</span></div><div class="place-day-list">${[
      ...days,
    ]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, limit)
      .map(
        ([day, rs]) =>
          `<details class="place-day" data-place-day="${day}" ${openDays.has(day) ? "open" : ""}><summary><span>${travelDate(day)}</span><span>${rs.length} ${rs.length === 1 ? "log" : "logs"}</span></summary><div>${rs.map((e) => entry(e)).join("")}</div></details>`,
      )
      .join(
        "",
      )}</div>${days.size > limit ? '<button class="px btn" data-more-places>Show earlier days</button>' : ""}</section>`;
  }
  function render() {
    if (!ready) {
      root.innerHTML =
        '<p class="empty" role="status">Finding Winnie’s places</p>';
      return;
    }
    const oldMap = root.querySelector(".travel-map-block");
    atlas = travelAtlas(events, undefined, Date.now(), year);
    const chosen = atlas.groups.find((g) => g.id === selected);
    root
      .closest("#photos-view")
      ?.classList.toggle("has-place-detail", Boolean(chosen));
    if (chosen) {
      map?.destroy();
      map = null;
      root.innerHTML = detail(chosen);
      hydratePhotos();
      return;
    }
    selected = null;
    const visible = visibleGroups();
    visible.sort(
      order === "name"
        ? (a, b) => a.name.localeCompare(b.name)
        : order === "days"
          ? (a, b) => b.days.size - a.days.size
          : (a, b) => b.last - a.last,
    );
    const trip = currentTrip(),
      regions = new Map();
    for (const g of visible) {
      const label = g.located ? regionName(g) : "Places without a map pin";
      if (!regions.has(label)) regions.set(label, []);
      regions.get(label).push(g);
    }
    const years = [
      ...new Set(
        events
          .filter((e) => !e.deletedAt && e.time <= Date.now())
          .map((e) => placeDay(e.time).slice(0, 4)),
      ),
    ]
      .sort()
      .reverse();
    const eligible = atlas.outings.filter(
      (t) => scope === "all" || t.groups.some((g) => regionKey(g) === scope),
    );
    oldMap?.remove();
    root.innerHTML = `<div class="travel-intro"><h2>${
      atlas.regions.length === 2
        ? esc(
            atlas.regions
              .map((r) => r.name)
              .sort()
              .join(" to "),
          )
        : "Winnie’s places"
    }</h2><p>${atlas.mapped.length ? `${atlas.mapped.length} mapped destinations${atlas.lastDay ? " by " + ageAt(atlas.lastDay).replace(" old", "") : ""}.` : "Saved places will build his map."}</p></div>
      <div class="travel-scopes" aria-label="Map region"><button class="text-button" data-travel-scope="all" aria-pressed="${scope === "all"}">Everywhere</button>${atlas.regions.map((r) => `<button class="text-button" data-travel-scope="${esc(r.key)}" aria-pressed="${scope === r.key}">${esc(r.name)}</button>`).join("")}</div>
      ${mapHTML()}
      ${
        !trip && eligible.length
          ? `<section class="travel-outings"><div class="card-head"><h2>Outings in the records</h2><button class="text-button" data-new-trip>Add trip</button></div><p class="fine">Dates, destinations, and how little he was.</p><div class="travel-outing-list">${eligible
              .slice(0, 6)
              .map(
                (t) =>
                  `<button class="travel-outing" data-outing="${esc(t.id)}">${t.photos.length ? `<img class="travel-outing-photo" data-photo="${esc(t.photos[0].photo.id)}" alt="Winnie on this trip" loading="lazy">` : ""}<span class="travel-outing-date">${travelDate(t.firstDay)}</span><strong>${esc(t.name)}</strong><span>${t.age}</span><span class="fine">${t.days.length} recorded ${t.days.length === 1 ? "day" : "days"}${t.inferred ? " — suggested outing" : ""}</span></button>`,
              )
              .join("")}</div></section>`
          : !trip
            ? '<div class="travel-outings"><h2>Trips to remember</h2><p class="fine">Name a trip and bring its recorded places and photos together.</p><button class="text-button" data-new-trip>Add trip</button></div>'
            : ""
      }
      <section class="travel-directory"><h2>All destinations</h2><div class="places-search"><label><span class="sr-only">Find a place</span><input type="search" data-places-search placeholder="Find a town or place" value="${esc(query)}"></label></div><div class="places-controls"><label><span class="sr-only">Year</span><select data-places-year aria-label="Year"><option value="all">All time</option>${years.map((y) => `<option ${year === y ? "selected" : ""}>${y}</option>`).join("")}</select></label><label><span class="sr-only">Order</span><select data-places-order aria-label="Order">${[
        ["recent", "Most recent"],
        ["days", "Most recorded days"],
        ["name", "A to Z"],
      ]
        .map(
          ([key, label]) =>
            `<option value="${key}" ${order === key ? "selected" : ""}>${label}</option>`,
        )
        .join(
          "",
        )}</select></label></div><div class="places-result"><p role="status">${visible.length} ${visible.length === 1 ? "place" : "places"}</p>${query || year !== "all" || scope !== "all" ? '<button class="text-button" data-places-clear>Clear filters</button>' : ""}</div>${visible.length ? [...regions].map(([label, gs]) => `<section class="place-region"><h3>${esc(label)}</h3><div class="places-cities">${gs.slice(0, directoryExpanded || query ? gs.length : 6).map(cityRow).join("")}</div>${!directoryExpanded && !query && gs.length > 6 ? `<button class="text-button" data-all-destinations>Show all ${gs.length} ${esc(label)} destinations</button>` : ""}</section>`).join("") : '<p class="empty">No matching places.</p>'}</section>
      ${error ? `<p class="error">${esc(error)}</p><button class="text-button" data-retry-places>Retry place names</button>` : ""}<details class="places-about"><summary>How this map tells the story</summary><p>Places come from saved logs and photo locations. Repeated pees and poops on one date count as one recorded day, not separate visits.</p><p>First saved here means the earliest location in the available records, not Winnie's first-ever visit. Early Notes and photos without locations cannot fill the map automatically.</p><p>Suggested outings group consecutive recorded days at least 60 km from the most-recorded destination. They are clues to a trip, not a complete itinerary. No routes or travel miles are inferred.</p><p>Town names are approximate. Original pins stay where they were saved. The atlas renders on this device and works offline after its first load. Exploring does not send saved locations to a map service.</p><p>${atlas.missing} records have no saved place. Geography: <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.</p></details>`;
    if (oldMap && map) {
      root.querySelector(".travel-map-block").replaceWith(oldMap);
      map.update(mappedGroups(), preview, !frame);
    } else mountMap();
    hydratePhotos();
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.city) {
      listScroll = scrollY;
      selected = b.dataset.city;
      spot = null;
      limit = 14;
      openDays.clear();
      render();
      root.querySelector(".place-heading h2")?.focus();
    } else if (b.hasAttribute("data-place-close")) {
      selected = null;
      render();
      window.scrollTo(0, listScroll);
    } else if (b.hasAttribute("data-preview-close")) {
      preview = null;
      root.querySelector("#travel-selection").innerHTML = selection();
      map?.select(null);
    } else if (b.hasAttribute("data-travel-scope")) {
      scope = b.dataset.travelScope;
      outing = null;
      preview = null;
      frame = null;
      render();
    } else if (b.dataset.outing) {
      outing = b.dataset.outing;
      dayIndex = -1;
      preview = null;
      frame = null;
      render();
      root
        .querySelector(".travel-map-block")
        ?.scrollIntoView({ block: "start" });
    } else if (b.hasAttribute("data-trip-close")) {
      outing = null;
      dayIndex = -1;
      frame = null;
      render();
    } else if (b.hasAttribute("data-trip-overview")) {
      dayIndex = -1;
      frame = null;
      render();
    } else if (b.hasAttribute("data-trip-step")) {
      dayIndex = Math.max(
        0,
        Math.min(
          currentTrip().days.length - 1,
          dayIndex + Number(b.dataset.tripStep),
        ),
      );
      frame = null;
      render();
      root
        .querySelector('[data-trip-step="' + b.dataset.tripStep + '"]')
        ?.focus({ preventScroll: true });
    } else if (b.hasAttribute("data-map-fit")) {
      map?.fit();
    } else if (b.hasAttribute("data-map-interact")) {
      const next = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(next));
      b.textContent = next ? "Done moving" : "Move map";
      map?.setInteractive(next);
    } else if (b.hasAttribute("data-save-outing")) {
      const t = currentTrip();
      root.dispatchEvent(
        new CustomEvent("travel-save-trip", {
          bubbles: true,
          detail: { name: t.name, start: t.firstDay, end: t.lastDay },
        }),
      );
    } else if (b.hasAttribute("data-more-places")) {
      limit += 14;
      render();
    } else if (b.hasAttribute("data-all-destinations")) {
      directoryExpanded = true;
      render();
    } else if (b.hasAttribute("data-retry-places")) void load();
    else if (b.hasAttribute("data-places-clear")) {
      query = "";
      year = "all";
      scope = "all";
      frame = null;
      render();
      root
        .querySelector("[data-places-search]")
        ?.focus({ preventScroll: true });
    }
  });
  root.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches("[data-places-year]")) {
      year = t.value;
      selected = null;
      outing = null;
      frame = null;
    } else if (t.matches("[data-places-order]")) order = t.value;
    else if (t.matches("[data-place-spot]")) {
      spot = t.value === "all" ? null : t.value;
      openDays.clear();
    } else return;
    render();
  });
  root.addEventListener("input", (e) => {
    if (!e.target.matches("[data-places-search]")) return;
    query = e.target.value;
    frame = null;
    render();
    root.querySelector("[data-places-search]")?.focus({ preventScroll: true });
  });
  root.addEventListener(
    "toggle",
    (e) => {
      if (e.target.matches(".travel-photo-picker"))
        photoPickerOpen = e.target.open;
      const day = e.target.dataset.placeDay;
      if (day) {
        if (e.target.open) openDays.add(day);
        else openDays.delete(day);
      }
    },
    true,
  );
  return {
    render(next) {
      events = next;
      const key = JSON.stringify(
        next.map((e) => [
          e.id,
          e.revision,
          e.time,
          e.end_time,
          e.note,
          e.location,
          e.placePin,
          e.photos,
          e.deletedAt,
        ]),
      );
      if (key !== signature || !root.children.length) {
        signature = key;
        render();
      }
      if (!ready) void load();
    },
  };
}
