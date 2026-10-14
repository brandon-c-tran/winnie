---
version: 1
slug: "public-places-view-js"
primary_target: "public/places-view.js"
related_targets: ["public/travel.js", "public/travel-map.js", "public/places.js", "public/app/library.js", "public/app/lifetime-view.js", "public/styles.css", "public/geo/README.md"]
---

# Places

Mode: Operate. Existing pixel-world extension, code-led. No new identity or raster assets.

## Direction contract — travel map extension

THESIS: Explore Winnie's growing world on a real map, then replay the dated evidence behind a destination. Geography and age supply the story; bathroom logs quietly provide its evidence.

OWN-WORLD: Inherit Pixelify titles, Rubik reading text, navy edges and periwinkle ground. Real cartography occupies the main field; pink destination markers and square controls connect it to Winnie. No identity change or new decorative raster assets.

STORY: Start with all mapped destinations. Tap a grouped marker or a region to explore; choose an outing to step through its recorded days, see Winnie's age then, selected photos, and original records. Inferred outings are labeled, and the user can name/save a trip. Missing pins remain in an accessible list.

FIRST VIEWPORT: Existing Places heading and Photos / Memories / Places navigation, one factual age-and-geography sentence, geographic scope controls, then a generous interactive map with grouped markers, fit and zoom controls. A selected destination or replay day appears immediately below. Dated outings follow, then searchable destinations and source coverage.

FORM: Code-led extension of the established Operate surface, with Read story detail. Signature interaction is stepping through an outing's recorded days as the map reframes; reduced motion uses immediate bounds changes. Continuous travel routes and total miles are never inferred from sparse pins.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented behavior and evidence

The atlas leads the surface. Bundled Natural Earth countries, states, lakes and land render locally; GeoNames references supply approximate town names, including smaller US towns. Saved coordinates stay unchanged. No third-party tile or geocoding requests are needed. The atlas is generalized geography, not street navigation.

Region controls and grouped markers narrow the geography. Destination previews and details label the first saved age and date; a year filter says Earliest shown. These dates describe available evidence, never Winnie's first-ever visit. The directory initially shows six destinations per region; expansion and search expose all matching destinations. Named places without pins remain in their own list.

Suggested outings group nearby away-days consecutively, at least 60 km from the most-recorded destination. They remain explicitly labeled suggestions until the family names and saves a trip through the existing form. Replay combines the recorded date, Winnie's age, selected photos and links to destinations and original records. It never draws an inferred route or estimates travel mileage.

Photo metadata supplies capture dates and pins when present. Selected care photos appear as keepsakes while retaining the original care attachment. Saved trips collect selected photos within their inclusive dates even when a photo has no location; photo-only days remain in replay without invented pins. Destination and trip strips use contained source images, and outing covers use a selected photo when available. There are no new raster assets.

Source evidence: `public/places-view.js`, `public/travel.js`, `public/travel-map.js`, `public/places.js`, the appended travel styles in `public/styles.css`, `public/geo/README.md`, and the existing trip form hookup in `public/app/lifetime-view.js`. The twelve review captures in `.impeccable/review/travel/` cover overview, destination, outing and photo replay at mobile, desktop, dark and small widths; `before-mobile.png` is the earlier baseline. Captures use a local saved-record snapshot and isolated synthetic photo fixtures; the newest production uploads were not inspected.

## Finish record

The fresh review returned fix for omitted locationless selected trip photos, stale directory-first documentation and glyph replay arrows. The code now retains photo-only replay days and uses the existing left/right icons; this record reconciles the documentation. The reported baseline passed 108 unit and 88 browser tests. The final regression report adds four passing travel unit tests (109 unit tests total), eight targeted browser checks and a passing `npm run check`. Coverage includes two locationless selected photos in a saved trip and a photo-only replay day with zero map markers. The twelve review captures were refreshed after the fixes. The scored verdict is recorded below.

The established pixel-world tokens and `.impeccable/design.json` remain unchanged. Prior sidecar drift is outside this ordinary extension. Historical directory contracts are superseded by the atlas contract above.

Final scored verdict: **ship**. The same reviewer scored all three material fixes resolved: locationless selected photos and photo-only replay days; Places documentation consistency; authored pixel replay icons. No regressions were observed in the refreshed captures. This verdict covers those three scored fixes. Fourteen validated captures include the mobile/desktop December 24 photo-only state. No new shipping raster or identity/token changes were introduced.

