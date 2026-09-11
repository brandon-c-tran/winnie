import { groupPlaces, loadCities, cityLabel } from "./places.js?v=3.8";

export function mapFrame(cities, minimum = 0.9) {
  let west = Math.min(...cities.map((c) => c.lng)),
    east = Math.max(...cities.map((c) => c.lng));
  let south = Math.min(...cities.map((c) => c.lat)),
    north = Math.max(...cities.map((c) => c.lat));
  if (east - west > 180)
    return { west: -180, east: 180, south: -70, north: 85 };
  const cy = (south + north) / 2,
    cx = (west + east) / 2,
    cos = Math.max(0.25, Math.cos((cy * Math.PI) / 180));
  const height = Math.max(
    minimum,
    (north - south) * 1.6,
    ((east - west) * cos * 1.6) / 1.6,
  );
  const width = (height * 1.6) / cos;
  return {
    west: cx - width / 2,
    east: cx + width / 2,
    south: cy - height / 2,
    north: cy + height / 2,
  };
}

export function createPlacesView({ root, esc, entry, hydratePhotos }) {
  let events = [],
    selected = null,
    focus = null,
    type = "all",
    year = "all",
    limit = 12,
    land = null,
    error = "",
    ready = false;
  let loading = null;
  const date = (t) =>
    new Date(t).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
  const region = (c) =>
    c.country === "US" ? c.region : countryNames.of(c.country);
  async function load() {
    if (loading) return loading;
    loading = Promise.all([
      loadCities(),
      fetch("/geo/land.json").then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      }),
    ])
      .then(([, outlines]) => {
        land = outlines;
        ready = true;
        error = "";
      })
      .catch(() => {
        error = "The place map couldn’t load. Your entries are safe.";
      })
      .finally(() => {
        loading = null;
        render();
      });
    return loading;
  }
  function map(groups, chosen) {
    const focused = focus ? groups.filter((g) => focus.includes(g.id)) : groups;
    const frame = mapFrame(
      chosen ? [chosen] : focused.length ? focused : groups,
      focus ? 0.04 : 0.9,
    );
    const project = ([lng, lat]) => [
      ((lng - frame.west) / (frame.east - frame.west)) * 640,
      ((frame.north - lat) / (frame.north - frame.south)) * 400,
    ];
    const path = land
      .map((ring) => {
        let last = null;
        return (
          ring
            .map((p, i) => {
              const point = project(p).map((n) => Math.round(n * 10) / 10);
              if (
                last &&
                Math.hypot(point[0] - last[0], point[1] - last[1]) < 1 &&
                i < ring.length - 1
              )
                return "";
              last = point;
              return `${i ? "L" : "M"}${point[0]},${point[1]}`;
            })
            .join("") + "Z"
        );
      })
      .join("");
    const markers = [];
    for (const g of groups) {
      const [x, y] = project([g.lng, g.lat]);
      if (x < 24 || x > 616 || y < 24 || y > 376) continue;
      const cluster = markers.find((m) => Math.hypot(m.x - x, m.y - y) < 90);
      if (cluster) {
        cluster.groups.push(g);
      } else {
        markers.push({ x, y, groups: [g] });
      }
    }
    return `<div class="places-map"><div class="map-canvas"><svg viewBox="0 0 640 400" aria-hidden="true"><defs><pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="currentColor" stroke-width=".5"/></pattern></defs><rect width="640" height="400" fill="url(#map-grid)"/><path class="map-land" d="${path}"/></svg>${markers
      .map((m) => {
        const multiple = m.groups.length > 1,
          g = m.groups[0],
          index = groups.findIndex((c) => c.id === g.id) + 1;
        const label = multiple
          ? `Zoom into ${m.groups.length} nearby city areas`
          : cityLabel(g);
        return `<button class="map-pin ${multiple ? "cluster" : ""} ${g.id === selected ? "active" : ""}" ${multiple ? `data-map-cluster="${m.groups.map((c) => c.id).join(",")}"` : `data-city="${esc(g.id)}"`} style="left:${m.x / 6.4}%;top:${m.y / 4}%" aria-label="${esc(label)}" title="${esc(label)}"><strong>${multiple ? m.groups.length : index}</strong>${multiple ? "<small>areas</small>" : ""}</button>`;
      })
      .join(
        "",
      )}</div><div class="map-caption">${chosen ? esc(cityLabel(chosen)) : focus ? "A closer look" : "His places, together"}${chosen || focus ? '<button class="text-button" data-map-all>Show all</button>' : '<span class="fine">Tap a group to zoom</span>'}</div></div>`;
  }

  function render() {
    if (!ready) {
      root.innerHTML = `<div class="card empty" role="status"><h3>${error ? "Map unavailable" : "Finding his places…"}</h3><p>${error || "Matching saved locations to nearby cities."}</p>${error ? '<button class="secondary" data-retry-places>Try again</button>' : ""}</div>`;
      return;
    }
    const valid = events.filter(
      (e) => !e.deletedAt && Number.isFinite(e.time) && e.time <= Date.now(),
    );
    const years = [
      ...new Set(valid.map((e) => new Date(e.time).getFullYear())),
    ].sort((a, b) => b - a);
    const filtered = valid.filter(
      (e) =>
        (year === "all" || String(new Date(e.time).getFullYear()) === year) &&
        (type === "all" ||
          (type === "photos" && e.photos?.length) ||
          e.type === type),
    );
    const { groups, missing, mapped } = groupPlaces(filtered);
    const chosen = groups.find((g) => g.id === selected);
    if (!chosen) selected = null;
    root.innerHTML = `<div class="places-controls"><label>When<select data-places-year><option value="all">All time</option>${years.map((y) => `<option ${String(y) === year ? "selected" : ""}>${y}</option>`).join("")}</select></label><label>Show<select data-places-type>${[
      ["all", "All entries"],
      ["pee", "Pees"],
      ["poop", "Poops"],
      ["photos", "Photos"],
    ]
      .map(
        ([v, n]) =>
          `<option value="${v}" ${type === v ? "selected" : ""}>${n}</option>`,
      )
      .join("")}</select></label></div>
      <div class="places-intro"><p class="eyebrow">Where he’s been</p><h2>${groups.length ? `${groups.length} city ${groups.length === 1 ? "area" : "areas"}, remembered together.` : "His map starts with a saved location."}</h2><p class="fine">${mapped.toLocaleString()} ${mapped === 1 ? "entry" : "entries"} with a location${missing ? ` · ${missing.toLocaleString()} without a map location` : ""}</p></div>
      ${
        groups.length
          ? `${map(groups, chosen)}<div class="places-cities" aria-label="City areas">${groups.map((g, i) => `<button class="place-city ${g.id === selected ? "selected" : ""}" data-city="${esc(g.id)}" aria-pressed="${g.id === selected}"><span class="place-number">${i + 1}</span><span><strong>${esc(cityLabel(g))}</strong><span class="fine">${esc(region(g))} · ${g.days.size} recorded ${g.days.size === 1 ? "day" : "days"} · ${g.events.length} ${g.events.length === 1 ? "entry" : "entries"}</span><span class="fine">First ${date(g.first)} · Latest ${date(g.last)}</span></span><span aria-hidden="true">↗</span></button>`).join("")}</div>${
              chosen
                ? `<section class="place-history"><div class="section-heading"><h3>${esc(cityLabel(chosen))}</h3><button class="text-button" data-map-all>All places</button></div><p class="fine">Saved entries, newest first</p>${chosen.events
                    .slice(0, limit)
                    .map(
                      (e) =>
                        `<p class="place-entry-date">${date(e.time)}</p>${entry(e)}`,
                    )
                    .join(
                      "",
                    )}${chosen.events.length > limit ? '<button class="secondary" data-more-places>Show more entries</button>' : ""}</section>`
                : '<p class="fine">Choose a city to revisit his entries and photos.</p>'
            }`
          : '<div class="card empty"><p>New logs add a location automatically when this phone allows it. Older entries with coordinates appear here too.</p><p class="fine">Named places without coordinates stay on their entries.</p></div>'
      }
      <details class="places-about"><summary>About this map</summary><p>City names are the nearest city in our offline directory, not exact city boundaries. Small towns may be labeled with a nearby city. Dots mark city centers, not individual stops. Recorded days use San Francisco time and count only days with saved entries; they aren’t a count of visits.</p><p>Place names are worked out on your device. No location history is sent to a geocoding service. Original coordinates stay with each entry; open an entry for its exact map link.</p><p>City data: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. Land: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a>, public domain.</p></details>`;
    const history = root.querySelector(".place-history");
    if (history) {
      history.tabIndex = -1;
      root.querySelector(".places-cities").before(history);
    }
    hydratePhotos();
  }
  root.addEventListener("click", (ev) => {
    const cluster = ev.target.closest("[data-map-cluster]");
    if (cluster) {
      focus = cluster.dataset.mapCluster.split(",");
      selected = null;
      render();
      root.querySelector("[data-map-all]")?.focus({ preventScroll: true });
    }
    const city = ev.target.closest("[data-city]");
    if (city) {
      selected = city.dataset.city;
      limit = 12;
      render();
      root.querySelector(".place-history")?.focus({ preventScroll: true });
      root.querySelector(".place-history")?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    }
    if (ev.target.closest("[data-map-all]")) {
      selected = null;
      focus = null;
      render();
    }
    if (ev.target.closest("[data-more-places]")) {
      limit += 24;
      render();
    }
    if (ev.target.closest("[data-retry-places]")) {
      error = "";
      render();
      load();
    }
  });
  root.addEventListener("keydown", (ev) => {
    if (ev.target.matches("g[data-city]") && ["Enter", " "].includes(ev.key)) {
      ev.preventDefault();
      ev.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });
  root.addEventListener("change", (ev) => {
    if (ev.target.matches("[data-places-year]")) year = ev.target.value;
    if (ev.target.matches("[data-places-type]")) type = ev.target.value;
    selected = null;
    focus = null;
    limit = 12;
    render();
  });
  return {
    render(next) {
      events = next;
      render();
      if (!ready && !error) load();
    },
  };
}
