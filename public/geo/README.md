# Geographic reference data

These files contain public geographic reference data only, never Winnie's locations.

- `cities.json`: GeoNames cities15000, downloaded September 11, 2026 from https://download.geonames.org/export/dump/cities15000.zip . Copyright GeoNames contributors; licensed under Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/). Subdivisions (PPLX) excluded; selected columns stored as compact tuples: ID, name, latitude, longitude, country, first administrative division. https://www.geonames.org/
- `towns-us.json`: additional US populated places from GeoNames cities500, downloaded October 13, 2026 from https://download.geonames.org/export/dump/cities500.zip . Same CC BY 4.0 license and tuple schema; excludes PPLX subdivisions and IDs already in cities.json. Includes smaller towns so rural travel is not assigned to distant large cities.
- `atlas.json`: Natural Earth public-domain countries (1:110m), states/provinces and lakes (1:50m), downloaded October 13, 2026 from https://github.com/nvkelso/natural-earth-vector/tree/master/geojson . Geometry rounded to three decimals; retains only names, country/state codes and label coordinates. These global reference boundaries render locally. The map makes no third-party tile or geocoding requests. It is an atlas for browsing destinations, not a street-navigation map; boundaries and shapes are generalized.
- `land.json`: Natural Earth 1:50m land, public domain (https://www.naturalearthdata.com/about/terms-of-use/), downloaded September 11, 2026 from https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson . Exterior rings only, coordinates rounded to three decimals.

Rebuild with `node scripts/build-geography.mjs <cities15000.txt> <ne_50m_land.geojson>`.

Rebuild the additional towns and atlas with `node scripts/build-travel-geography.mjs <cities500.txt> <ne_110m_admin_0_countries.geojson> <ne_50m_admin_1_states_provinces.geojson> <ne_50m_lakes.geojson>`.

Nearest-city labels are approximate, not municipal boundaries. Small towns may not be included. Resolution happens on the device, without sending saved coordinates to a geocoding provider. Original event coordinates are preserved.
