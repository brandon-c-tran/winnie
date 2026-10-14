import * as L from "./vendor/leaflet.mjs";

// Public geography renders locally. Browsing never sends saved locations to a map service.
let geography;
function loadGeography() {
  return (geography ||= Promise.all(
    ["/geo/atlas.json", "/geo/land.json"].map(async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw Error("Atlas unavailable");
      return r.json();
    }),
  ).catch((e) => {
    geography = null;
    throw e;
  }));
}
export function createTravelMap(
  root,
  { groups, onSelect, selected, frame, onFrame },
) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const map = L.map(root, {
    zoomControl: false,
    // Leaflet's delayed zoom transition can outlive a removed iOS map.
    zoomAnimation: false,
    attributionControl: true,
    scrollWheelZoom: false,
    dragging: !matchMedia("(pointer: coarse)").matches,
    tapHold: false,
    minZoom: 2,
    maxZoom: 16,
    preferCanvas: true,
  });
  let points = groups.filter((g) => g.point);
  const layer = L.layerGroup().addTo(map);
  let chosen = selected,
    alive = true,
    boundaries = null,
    states = [],
    countryData = [];
  const labels = L.layerGroup().addTo(map);
  L.control.zoom({ position: "topright" }).addTo(map);
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution(
    '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a> · <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>',
  );
  const status = root.parentElement.querySelector("[data-map-status]");
  const stateStyle = (f) => ({
    color: "#9aa8be",
    weight: 0.7,
    fillColor: points.some(
      (g) => f.properties.code === `${g.country}-${g.region}`,
    )
      ? "#e4cce8"
      : "#f1f3ed",
    fillOpacity: 0.8,
  });
  loadGeography()
    .then(([atlas, land]) => {
      if (!alive) return;
      L.geoJSON(
        { type: "MultiPolygon", coordinates: land.map((r) => [r]) },
        {
          interactive: false,
          style: {
            color: "#90a7bd",
            weight: 1,
            fillColor: "#f1f3ed",
            fillOpacity: 1,
          },
        },
      ).addTo(map);
      L.geoJSON(atlas.countries, {
        interactive: false,
        style: { color: "#899aad", weight: 1, fill: false },
      }).addTo(map);
      boundaries = L.geoJSON(atlas.states, {
        interactive: false,
        style: stateStyle,
      }).addTo(map);
      L.geoJSON(atlas.lakes, {
        interactive: false,
        style: {
          color: "#90a7bd",
          weight: 0.6,
          fillColor: "#d9e7f4",
          fillOpacity: 1,
        },
      }).addTo(map);
      states = atlas.states;
      countryData = atlas.countries;
      mapLabels();
      root.dataset.ready = "true";
    })
    .catch(() => {
      if (alive && status) {
        status.hidden = false;
        status.textContent =
          "Map background unavailable. Destinations and recorded days still work below.";
      }
    });
  function mapLabels() {
    labels.clearLayers();
    const zoom = map.getZoom();
    const candidates =
      zoom >= 4
        ? states.map((f) => ({
            name: f.properties.name,
            lat: f.properties.lat,
            lng: f.properties.lng,
          }))
        : countryData.map((f) => {
            const c = L.geoJSON(f).getBounds().getCenter();
            return { name: f.properties.name, lat: c.lat, lng: c.lng };
          });
    const used = [];
    for (const s of candidates) {
      if (
        !Number.isFinite(s.lat) ||
        !Number.isFinite(s.lng) ||
        !map.getBounds().contains([s.lat, s.lng])
      )
        continue;
      const p = map.latLngToContainerPoint([s.lat, s.lng]);
      if (used.some((q) => q.distanceTo(p) < 70)) continue;
      used.push(p);
      const el = document.createElement("span");
      el.textContent = s.name;
      L.marker([s.lat, s.lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "atlas-label",
          html: el,
          iconSize: [100, 20],
          iconAnchor: [50, 10],
        }),
      }).addTo(labels);
    }
  }
  function fit(list = points) {
    if (!list.length) {
      map.setView([37, -98], 3);
      return;
    }
    map.fitBounds(L.latLngBounds(list.map((g) => [g.point.lat, g.point.lng])), {
      padding: [48, 42],
      maxZoom: 6,
      animate: !reduced,
    });
  }
  if (frame) map.setView(frame.center, frame.zoom, { animate: false });
  else fit();
  function markers() {
    layer.clearLayers();
    const clusters = [];
    for (const g of points) {
      const p = map.latLngToContainerPoint([g.point.lat, g.point.lng]);
      const cluster = clusters.find((c) => c.pixel.distanceTo(p) < 44);
      if (cluster) cluster.groups.push(g);
      else clusters.push({ pixel: p, groups: [g] });
    }
    for (const c of clusters) {
      const g = c.groups[0],
        multiple = c.groups.length > 1;
      const label = multiple
        ? `${c.groups.length} destinations. Zoom in.`
        : `${g.name}. First recorded ${g.firstDay}.`;
      const icon = L.divIcon({
        className:
          "travel-marker" +
          (c.groups.some((x) => x.id === chosen) ? " is-selected" : ""),
        html: multiple
          ? `<span>${c.groups.length}</span>`
          : '<span class="travel-pin-core"></span>',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const marker = L.marker([g.point.lat, g.point.lng], {
        icon,
        title: label,
        alt: label,
        keyboard: true,
        riseOnHover: true,
      }).addTo(layer);
      marker.on("click", () => {
        if (multiple) {
          const bounds = L.latLngBounds(
            c.groups.map((x) => [x.point.lat, x.point.lng]),
          );
          map.fitBounds(bounds, {
            padding: [44, 44],
            maxZoom: Math.min(map.getZoom() + 3, 16),
            animate: !reduced,
          });
        } else {
          chosen = g.id;
          markers();
          onSelect(g.id);
        }
      });
      if (!multiple)
        marker.bindTooltip(g.name, {
          permanent: points.length <= 4,
          direction: "top",
          offset: [0, -12],
          className: "travel-tooltip",
        });
    }
  }
  map.on("zoomend moveend", () => {
    markers();
    mapLabels();
    onFrame?.({ center: map.getCenter(), zoom: map.getZoom() });
  });
  markers();
  const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
  resize.observe(root);
  return {
    fit,
    update(next, id, refit) {
      points = next.filter((g) => g.point);
      chosen = id;
      boundaries?.setStyle(stateStyle);
      markers();
      if (refit) fit();
    },
    select(id) {
      chosen = id;
      markers();
    },
    setInteractive(value) {
      if (value) map.dragging.enable();
      else map.dragging.disable();
    },
    destroy() {
      alive = false;
      resize.disconnect();
      map.remove();
    },
  };
}
