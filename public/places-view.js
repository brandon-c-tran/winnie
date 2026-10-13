import { groupPlaces, loadCities, cityLabel } from "./places.js?v=4.6";

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
    frame = null,
    land = [],
    cities = [],
    ready = false;
  let type = "all",
    year = "all",
    limit = 12,
    loading = null,
    error = "",
    drag = null;
  const date = (t) =>
    new Date(t).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const countries = new Intl.DisplayNames(["en"], { type: "region" });
  async function load() {
    if (loading) return loading;
    loading = Promise.all([
      loadCities(),
      fetch("/geo/land.json")
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .catch(() => []),
    ])
      .then(([rows, outlines]) => {
        cities = rows;
        land = outlines;
        ready = true;
        error = "";
      })
      .catch(() => {
        error = "Places couldn't load.";
      })
      .finally(() => {
        loading = null;
        render();
      });
    return loading;
  }
  function groupsNow() {
    return groupPlaces(
      events.filter(
        (e) =>
          (year === "all" || String(new Date(e.time).getFullYear()) === year) &&
          (type === "all" ||
            (type === "photos" ? e.photos?.length : e.type === type)),
      ),
    );
  }
  function map(groups) {
    frame ||= mapFrame(groups, 0.4);
    const project = ([lng, lat]) => [
      ((lng - frame.west) / (frame.east - frame.west)) * 640,
      ((frame.north - lat) / (frame.north - frame.south)) * 400,
    ];
    const path = land
      .map((ring) => {
        // Skip distant rings without generating thousands of off-screen coordinates.
        const xs = ring.map((p) => p[0]),
          ys = ring.map((p) => p[1]);
        if (
          Math.max(...xs) < frame.west ||
          Math.min(...xs) > frame.east ||
          Math.max(...ys) < frame.south ||
          Math.min(...ys) > frame.north
        )
          return "";
        return (
          ring
            .map(
              (p, i) =>
                `${i ? "L" : "M"}${project(p)
                  .map((n) => Math.round(n * 10) / 10)
                  .join(",")}`,
            )
            .join("") + "Z"
        );
      })
      .join("");
    const markers = [];
    for (const g of groups) {
      const [x, y] = project([g.lng, g.lat]);
      if (x < 30 || x > 610 || y < 30 || y > 370) continue;
      const cluster = markers.find((m) => Math.hypot(m.x - x, m.y - y) < 72);
      if (cluster) cluster.groups.push(g);
      else markers.push({ x, y, groups: [g] });
    }
    const context = [];
    for (const [id, name, lat, lng] of cities) {
      if (groups.some((g) => g.id === id)) continue;
      const [x, y] = project([lng, lat]);
      if (
        x < 70 ||
        x > 570 ||
        y < 50 ||
        y > 350 ||
        [...markers, ...context].some((m) => Math.hypot(m.x - x, m.y - y) < 100)
      )
        continue;
      context.push({ x, y, name });
      if (context.length === 6) break;
    }
    const spanKm =
      (frame.east - frame.west) *
      111.19 *
      Math.cos((((frame.north + frame.south) / 2) * Math.PI) / 180);
    const scale = Math.max(1, Math.round(spanKm / 4));
    return `<div class="places-map"><div class="map-canvas" tabindex="0" role="group" aria-label="City map. Arrow keys move the map; use the zoom buttons to change scale.">
      <div class="map-art"><svg viewBox="0 0 640 400" aria-hidden="true"><path class="map-land" d="${path}"/>${context.map((c) => `<text class="map-context" x="${c.x}" y="${c.y}">${esc(c.name)}</text>`).join("")}</svg>
      ${markers
        .map((m) => {
          const multi = m.groups.length > 1,
            g = m.groups[0];
          const label = multi ? `${m.groups.length} cities` : cityLabel(g);
          return `<button class="map-pin ${multi ? "cluster" : ""} ${m.groups.some((g) => g.id === selected) ? "active" : ""}" ${multi ? `data-map-cluster="${esc(m.groups.map((c) => c.id).join(","))}"` : `data-city="${esc(g.id)}"`} style="left:${m.x / 6.4}%;top:${m.y / 4}%" aria-label="${esc(multi ? "Zoom into " + label : label)}"><span class="map-dot" aria-hidden="true"></span><strong>${esc(label)}</strong></button>`;
        })
        .join("")}</div>
      <span class="map-north" aria-hidden="true">↑ N</span><div class="map-zoom"><button data-map-zoom="in" aria-label="Zoom in">+</button><button data-map-zoom="out" aria-label="Zoom out">−</button></div>
      <span class="map-scale">${scale} km</span></div><div class="map-caption"><span>City locations</span><button class="text-button" data-map-all>Fit all</button></div></div>`;
  }
  function render() {
    if (!ready) {
      root.innerHTML = `<div class="empty" role="status"><h3>${error || "Loading places"}</h3>${error ? '<button class="px btn" data-retry-places>Try again</button>' : ""}</div>`;
      return;
    }
    const { groups, mapped, missing } = groupsNow();
    const chosen = groups.find((g) => g.id === selected);
    if (!chosen) selected = null;
    const years = [
      ...new Set(
        events
          .filter((e) => !e.deletedAt && e.time <= Date.now())
          .map((e) => new Date(e.time).getFullYear()),
      ),
    ].sort((a, b) => b - a);
    root.innerHTML = `<div class="places-controls"><label>When<select data-places-year><option value="all">All time</option>${years.map((y) => `<option ${String(y) === year ? "selected" : ""}>${y}</option>`).join("")}</select></label><label>Show<select data-places-type>${[
      ["all", "All entries"],
      ["photos", "Photos"],
      ["pee", "Pees"],
      ["poop", "Poops"],
    ]
      .map(
        ([v, n]) =>
          `<option value="${v}" ${type === v ? "selected" : ""}>${n}</option>`,
      )
      .join("")}</select></label></div>
      <div class="places-intro"><h2>${groups.length} ${groups.length === 1 ? "city" : "cities"}</h2><span class="fine">${mapped.toLocaleString()} located ${mapped === 1 ? "entry" : "entries"}</span></div>
      ${groups.length ? map(groups) : '<div class="empty"><h3>No saved locations</h3><button class="px btn" data-act="settings">Location settings</button></div>'}
      ${
        chosen
          ? `<section class="place-history" tabindex="-1"><div class="section-heading"><div><h2>${esc(cityLabel(chosen))}</h2><p class="fine">${chosen.days.size} recorded ${chosen.days.size === 1 ? "day" : "days"} · ${chosen.events.length} entries</p></div><button class="text-button" data-place-close>Close</button></div>${chosen.events
              .slice(0, limit)
              .map(
                (e, i, a) =>
                  `${i === 0 || date(e.time) !== date(a[i - 1].time) ? `<h3 class="history-day">${date(e.time)}</h3>` : ""}${entry(e)}`,
              )
              .join(
                "",
              )}${chosen.events.length > limit ? '<button class="px btn" data-more-places>Show more entries</button>' : ""}</section>`
          : ""
      }
      ${
        groups.length
          ? `<div class="places-list-head"><h2>Places</h2><span class="fine">Most recent first</span></div><div class="places-cities" aria-label="Cities">${groups
              .map((g) => {
                const photo = g.events.find((e) => e.photos?.length)?.photos[0];
                return `<button class="place-city ${g.id === selected ? "selected" : ""}" data-city="${esc(g.id)}" aria-pressed="${g.id === selected}">${photo ? `<img class="place-thumb" data-photo="${esc(photo.id)}" alt="" loading="lazy">` : '<span class="place-glyph" aria-hidden="true">⌖</span>'}<span class="place-copy"><strong>${esc(cityLabel(g))}</strong><span class="fine">${esc(g.country === "US" ? g.region : countries.of(g.country))} · ${g.days.size} recorded ${g.days.size === 1 ? "day" : "days"}</span><span class="fine">${date(g.last)}</span></span><span class="place-arrow" aria-hidden="true">→</span></button>`;
              })
              .join("")}</div>`
          : ""
      }
      <details class="places-about"><summary>Map details${missing ? ` · ${missing} entries without locations` : ""}</summary><p>Markers show nearby city centers, not exact stops. Recorded days count days with saved entries, not visits. Open an entry for its exact map link.</p><p>City matching stays on your device. City data: <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Land: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>, public domain.${land.length ? "" : " Coastline unavailable offline."}</p></details>`;
    hydratePhotos();
  }
  function move(dx, dy) {
    const w = frame.east - frame.west,
      h = frame.north - frame.south;
    frame = {
      west: frame.west + dx * w,
      east: frame.east + dx * w,
      south: frame.south + dy * h,
      north: frame.north + dy * h,
    };
    boundFrame();
  }
  function boundFrame() {
    const w = Math.min(360, frame.east - frame.west),
      h = Math.min(170, frame.north - frame.south);
    const cx = Math.max(
      -180 + w / 2,
      Math.min(180 - w / 2, (frame.west + frame.east) / 2),
    );
    const cy = Math.max(
      -85 + h / 2,
      Math.min(85 - h / 2, (frame.south + frame.north) / 2),
    );
    frame = {
      west: cx - w / 2,
      east: cx + w / 2,
      south: cy - h / 2,
      north: cy + h / 2,
    };
  }
  function zoom(factor) {
    const cx = (frame.west + frame.east) / 2,
      cy = (frame.south + frame.north) / 2;
    const h = Math.max(
        0.04,
        Math.min(155, (frame.north - frame.south) * factor),
      ),
      w = Math.min(
        360,
        (h * (frame.east - frame.west)) / (frame.north - frame.south),
      );
    frame = {
      west: cx - w / 2,
      east: cx + w / 2,
      south: cy - h / 2,
      north: cy + h / 2,
    };
    boundFrame();
  }
  root.addEventListener("click", (ev) => {
    const city = ev.target.closest("[data-city]"),
      cluster = ev.target.closest("[data-map-cluster]"),
      z = ev.target.closest("[data-map-zoom]");
    if (city) {
      selected = city.dataset.city;
      limit = 12;
      render();
      root.querySelector(".place-history")?.focus({ preventScroll: true });
    } else if (cluster) {
      frame = mapFrame(
        groupsNow().groups.filter((g) =>
          cluster.dataset.mapCluster.split(",").includes(g.id),
        ),
        0.06,
      );
      render();
      root.querySelector(".map-canvas")?.focus({ preventScroll: true });
    } else if (z) {
      zoom(z.dataset.mapZoom === "in" ? 0.5 : 2);
      render();
      root
        .querySelector(`[data-map-zoom="${z.dataset.mapZoom}"]`)
        ?.focus({ preventScroll: true });
    } else if (ev.target.closest("[data-map-all]")) {
      frame = null;
      render();
      root.querySelector("[data-map-all]")?.focus({ preventScroll: true });
    } else if (ev.target.closest("[data-place-close]")) {
      selected = null;
      render();
    } else if (ev.target.closest("[data-more-places]")) {
      limit += 24;
      render();
    } else if (ev.target.closest("[data-retry-places]")) {
      error = "";
      load();
    }
  });
  root.addEventListener("change", (ev) => {
    if (ev.target.matches("[data-places-year]")) year = ev.target.value;
    else if (ev.target.matches("[data-places-type]")) type = ev.target.value;
    else return;
    frame = null;
    selected = null;
    render();
  });
  root.addEventListener("keydown", (ev) => {
    if (!ev.target.matches(".map-canvas") || !frame) return;
    const delta = {
      ArrowLeft: [-0.2, 0],
      ArrowRight: [0.2, 0],
      ArrowUp: [0, 0.2],
      ArrowDown: [0, -0.2],
    }[ev.key];
    if (!delta) return;
    ev.preventDefault();
    move(...delta);
    render();
    root.querySelector(".map-canvas").focus({ preventScroll: true });
  });
  root.addEventListener("pointerdown", (ev) => {
    const canvas = ev.target.closest(".map-canvas");
    if (!canvas || ev.target.closest("button") || !frame) return;
    drag = { x: ev.clientX, y: ev.clientY, canvas };
    canvas.setPointerCapture(ev.pointerId);
  });
  root.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    drag.canvas.querySelector(".map-art").style.transform =
      `translate(${ev.clientX - drag.x}px,${ev.clientY - drag.y}px)`;
  });
  root.addEventListener("pointerup", (ev) => {
    if (!drag) return;
    const { x, y, canvas } = drag;
    drag = null;
    move(
      -(ev.clientX - x) / canvas.clientWidth,
      (ev.clientY - y) / canvas.clientHeight,
    );
    render();
  });
  root.addEventListener("pointercancel", () => {
    drag = null;
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
