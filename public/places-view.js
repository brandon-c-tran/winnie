import { placeDirectory, loadCities, placeDay } from "./places.js?v=4.11";

export function createPlacesView({ root, esc, entry, hydratePhotos }) {
  let events = [],
    selected = null,
    spot = null,
    year = "all",
    query = "",
    order = "recent";
  let ready = false,
    loading = null,
    error = "",
    limit = 14,
    listScroll = 0;
  const openDays = new Set();
  const date = (time) =>
    new Date(time).toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const countries = new Intl.DisplayNames(["en"], { type: "region" });
  const region = (group) =>
    group.located
      ? [
          group.region === "CA" ? "California" : group.region,
          countries.of(group.country),
        ]
          .filter(Boolean)
          .join(", ")
      : "Saved by name";
  const mapLink = (group) =>
    group.located
      ? `<a class="text-button" href="https://www.google.com/maps/search/?api=1&query=${group.lat},${group.lng}" target="_blank" rel="noopener noreferrer">City map</a>`
      : "";
  async function load() {
    if (loading) return loading;
    loading = loadCities()
      .then(() => {
        ready = true;
        error = "";
      })
      .catch(() => {
        error =
          "City names couldn't load. Saved place names are still available.";
        ready = true;
      })
      .finally(() => {
        loading = null;
        render();
      });
    return loading;
  }
  function current() {
    return placeDirectory(
      events.filter(
        (event) =>
          Number.isFinite(event.time) &&
          (year === "all" || placeDay(event.time).slice(0, 4) === year),
      ),
    );
  }
  function cityRow(group) {
    const names = group.spots.filter((s) => s.name).map((s) => s.name);
    return `<button class="place-city" data-city="${esc(group.id)}"><span class="place-copy"><strong>${esc(group.name)}</strong>${names.length ? `<span class="place-names">${esc(names.slice(0, 2).join(", "))}${names.length > 2 ? ` +${names.length - 2}` : ""}</span>` : ""}<span class="place-last">Last recorded ${date(group.last)}</span></span><span class="place-days"><strong>${group.days.size}</strong><span>recorded ${group.days.size === 1 ? "day" : "days"}</span></span></button>`;
  }
  function detail(group) {
    const chosenSpot = group.spots.find((s) => s.id === spot);
    const source = chosenSpot ? chosenSpot.events : group.events;
    const days = new Map();
    for (const event of source) {
      const key = placeDay(event.time);
      if (!days.has(key)) days.set(key, []);
      days.get(key).push(event);
    }
    // Care evidence stays in its log rather than representing a destination.
    const photos = source
      .filter((e) => !["pee", "poop", "meal"].includes(e.type))
      .flatMap((e) => (e.photos || []).map((photo) => ({ photo, event: e })))
      .slice(0, 4);
    return `<section class="place-history"><button class="text-button place-back" data-place-close>Back to places</button>
      <header class="place-heading"><div><h2 tabindex="-1">${esc(group.name)}</h2><p>${esc(region(group))}</p></div>${mapLink(group)}</header>
      <dl class="place-dates"><div><dt>First recorded</dt><dd>${date(group.first)}</dd></div><div><dt>Latest</dt><dd>${date(group.last)}</dd></div></dl>
      ${group.spots.some((s) => s.name) ? `<label class="place-spot-label">Place<select data-place-spot><option value="all">All locations</option>${group.spots.map((s) => `<option value="${esc(s.id)}" ${spot === s.id ? "selected" : ""}>${esc(s.name || "Other saved locations")}</option>`).join("")}</select></label>` : ""}
      ${photos.length ? `<div class="place-photo-strip">${photos.map(({ photo, event }) => `<button data-open="${esc(event.id)}" aria-label="Open photo from ${date(event.time)}"><img data-photo="${esc(photo.id)}" alt="${esc(event.note || "Winnie")}" loading="lazy"></button>`).join("")}</div>` : ""}
      <div class="place-days-heading"><h3>Recorded days</h3><span>${days.size}</span></div>
      <div class="place-day-list">${[...days]
        .slice(0, limit)
        .map(
          ([key, rows]) =>
            `<details class="place-day" data-place-day="${key}" ${openDays.has(key) ? "open" : ""}><summary><span>${date(rows[0].time)}</span><span>${rows.length} ${rows.length === 1 ? "log" : "logs"}</span></summary><div>${rows.map((event) => entry(event)).join("")}</div></details>`,
        )
        .join("")}</div>
      ${days.size > limit ? '<button class="px btn" data-more-places>Show earlier days</button>' : ""}</section>`;
  }
  function render() {
    if (!ready) {
      root.innerHTML = '<p class="empty" role="status">Loading places</p>';
      return;
    }
    const { groups, missing } = current();
    const chosen = groups.find((g) => g.id === selected);
    root
      .closest("#photos-view")
      ?.classList.toggle("has-place-detail", Boolean(chosen));
    if (chosen) {
      root.innerHTML = detail(chosen);
      hydratePhotos();
      return;
    }
    selected = null;
    const years = [
      ...new Set(
        events
          .filter(
            (e) =>
              !e.deletedAt && Number.isFinite(e.time) && e.time <= Date.now(),
          )
          .map((e) => placeDay(e.time).slice(0, 4)),
      ),
    ]
      .sort()
      .reverse();
    const visible = groups.filter((g) =>
      [g.name, region(g), ...g.spots.map((s) => s.name)]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase().trim()),
    );
    visible.sort(
      order === "name"
        ? (a, b) => a.name.localeCompare(b.name)
        : order === "days"
          ? (a, b) => b.days.size - a.days.size || b.last - a.last
          : (a, b) => b.last - a.last,
    );
    const regions = new Map();
    for (const group of visible) {
      const key = region(group);
      if (!regions.has(key)) regions.set(key, []);
      regions.get(key).push(group);
    }
    root.innerHTML = `<div class="places-search"><label><span class="sr-only">Find a place</span><input type="search" data-places-search placeholder="Find a city or place" value="${esc(query)}"></label></div>
      <div class="places-controls"><label><span class="sr-only">Year</span><select data-places-year aria-label="Year"><option value="all">All time</option>${years.map((y) => `<option ${year === y ? "selected" : ""}>${y}</option>`).join("")}</select></label><label><span class="sr-only">Order</span><select data-places-order aria-label="Order">${[
        ["recent", "Most recent"],
        ["days", "Most recorded days"],
        ["name", "A to Z"],
      ]
        .map(
          ([key, label]) =>
            `<option value="${key}" ${key === order ? "selected" : ""}>${label}</option>`,
        )
        .join("")}</select></label></div>
      <div class="places-result"><p role="status">${visible.length} ${visible.length === 1 ? "place" : "places"}</p>${query || year !== "all" ? '<button class="text-button" data-places-clear>Clear filters</button>' : ""}</div>
      ${visible.length ? [...regions].map(([label, rows]) => `<section class="place-region"><h2>${esc(label)}</h2><div class="places-cities">${rows.map(cityRow).join("")}</div></section>`).join("") : `<div class="empty"><h2>${query || year !== "all" ? "No matching places" : "No places recorded yet"}</h2>${query || year !== "all" ? "" : '<button class="text-button" data-act="settings">Location settings</button>'}</div>`}
      ${error ? `<p class="error">${esc(error)}</p><button class="text-button" data-retry-places>Retry city names</button>` : ""}
      <details class="places-about"><summary>About these places</summary><p>Places come from locations saved with Winnie's logs. Several pees or poops on one day count as one recorded day, not separate visits.</p><p>City names are approximate. Places saved without a pin stay separate. No location is tracked between logs.</p>${missing ? `<p>${missing} ${missing === 1 ? "log has" : "logs have"} no saved place.</p>` : ""}<p>City names from <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.</p></details>`;
  }
  root.addEventListener("click", (event) => {
    const city = event.target.closest("[data-city]");
    if (city) {
      listScroll = window.scrollY;
      selected = city.dataset.city;
      spot = null;
      limit = 14;
      openDays.clear();
      render();
      root.querySelector(".place-heading h2")?.focus();
    } else if (event.target.closest("[data-place-close]")) {
      const prior = selected;
      selected = null;
      render();
      [...root.querySelectorAll("[data-city]")]
        .find((button) => button.dataset.city === prior)
        ?.focus({ preventScroll: true });
      window.scrollTo(0, listScroll);
    } else if (event.target.closest("[data-more-places]")) {
      limit += 14;
      render();
      root.querySelector("[data-more-places]")?.focus({ preventScroll: true });
    } else if (event.target.closest("[data-retry-places]")) {
      load();
    } else if (event.target.closest("[data-places-clear]")) {
      query = "";
      year = "all";
      render();
      root.querySelector("[data-places-search]").focus();
    }
  });
  root.addEventListener("change", (event) => {
    if (event.target.matches("[data-places-year]")) year = event.target.value;
    else if (event.target.matches("[data-places-order]"))
      order = event.target.value;
    else if (event.target.matches("[data-place-spot]")) {
      spot = event.target.value === "all" ? null : event.target.value;
      limit = 14;
      openDays.clear();
    } else return;
    const attribute = event.target
      .getAttributeNames()
      .find((name) => name.startsWith("data-"));
    render();
    root.querySelector(`[${attribute}]`)?.focus({ preventScroll: true });
  });
  root.addEventListener("input", (event) => {
    if (!event.target.matches("[data-places-search]")) return;
    query = event.target.value;
    render();
    root.querySelector("[data-places-search]").focus({ preventScroll: true });
  });
  root.addEventListener(
    "toggle",
    (event) => {
      const key = event.target.dataset.placeDay;
      if (key) {
        if (event.target.open) openDays.add(key);
        else openDays.delete(key);
      }
    },
    true,
  );
  return {
    render(next) {
      events = next;
      render();
      if (!ready && !loading) load();
    },
  };
}
