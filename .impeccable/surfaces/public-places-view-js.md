---
version: 1
slug: "public-places-view-js"
primary_target: "public/places-view.js"
related_targets: ["public/places.js", "public/app/library.js", "public/styles.css"]
---

# Places

Mode: Operate. Existing pixel-world extension, code-led. No new identity or raster assets.

THESIS: Browse places Winnie has been; the care log is evidence underneath.

OWN-WORLD: Retain Pixelify headings, Rubik reading text, navy edges, periwinkle ground, square controls and existing signed-entry rows. Use a divided place index instead of map pins and cards.

STORY: Find a city or named place, choose a saved spot within the city, browse recorded days, and expand a day for its source logs. Repeated pee and poop logs support a destination without turning into a visit count. Preserve all source data.

FIRST VIEWPORT: Places heading and Back to photos, search, year/order selectors, region heading and immediately visible destination rows. Each row has a name, optional saved spot names, last recorded date and distinct recorded-day count. Details replace the list, with Back to places, city name/City map link, date range, optional spot selector and expandable recorded days. Returning restores the directory's search and scroll position. There is no care-type filter.

FORM: Local restructuring within the established world. External city maps and original per-entry pin links provide geographic context; the custom draggable canvas is retired from this flow. Names without pins remain separate, rather than guessing their city. City grouping stays approximate and on device. Dates consistently use San Francisco time.

FINISH: Documentation reconciled with the implemented directory. Nine confirmation captures and six supplemental scrolled captures cover the directory, detail, named-only places and final recorded days. Five unit tests and twelve targeted browser tests passed across the final runs. Fresh review found no material visual contradiction. Final disposition: ship for the scored persistence fix, with no regressions observed. User supplied no further grouping preference after the optional question; cities with named spots is the implementation assumption. Changes are local, not deployed.

## Evidence and limits

The user's October 13 request calls the map clunky and explains that pee and poop are proxies for where Winnie has been. Several logs on one calendar day count as one recorded day, never as inferred visits or trips. Places do not use care photos as destination thumbnails; non-care photos may appear in a place detail. Existing logs, photos, names, coordinates and removed-pin semantics are preserved. Demonstration captures use an isolated synthetic dataset.
