# Geographic reference data

These files contain public geographic reference data only, never Winnie's locations.

- `cities.json`: GeoNames cities15000, downloaded September 11, 2026 from https://download.geonames.org/export/dump/cities15000.zip . Copyright GeoNames contributors; licensed under Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/). Subdivisions (PPLX) excluded; selected columns stored as compact tuples: ID, name, latitude, longitude, country, first administrative division. https://www.geonames.org/
- `land.json`: Natural Earth 1:50m land, public domain (https://www.naturalearthdata.com/about/terms-of-use/), downloaded September 11, 2026 from https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson . Exterior rings only, coordinates rounded to three decimals.

Rebuild with `node scripts/build-geography.mjs <cities15000.txt> <ne_50m_land.geojson>`.

Nearest-city labels are approximate, not municipal boundaries. Small towns may not be included. Resolution happens on the device, without sending saved coordinates to a geocoding provider. Original event coordinates are preserved.
