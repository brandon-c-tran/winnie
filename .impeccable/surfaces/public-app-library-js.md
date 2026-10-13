---
version: 1
slug: "public-app-library-js"
primary_target: "public/app/library.js"
related_targets: ["public/app/entries.js","public/app/photos.js","public/app/forms.js","public/app/format.js","public/app/today.js","public/app/logging.js","public/app/clicks.js","public/styles.css"]
---

# History, entry details, and photo browsing

Scope: existing Winnie surfaces and photo-add flow. Mode: Operate. Preserve the established pixel world, stored entries, photo associations, and all edit/reaction capabilities.

## Direction contract

THESIS: Preserve recognizable whole-person portraits and collect care photos at the natural logging moment. History is a readable chronological list; Winnie photos are an album; care photos are evidence attached to dated entries and visible in Today.

OWN-WORLD: Inherit Pixelify headings, Rubik reading text, square navy edges, periwinkle paper, pink accents and the existing care colors. Preserve the incumbent room, controls and portrait artwork.

STORY: Log poop, optionally choose consistency and take or choose a photo, or skip while preserving the saved record. See the attached photo in Today. Scan time and event, read only recorded facts, and open an entry for detail. Browse Winnie photos separately from poop and meal photos. Choose photos before adding a caption, or attach directly to an existing care entry.

FIRST VIEWPORT: Today retains its room and logging actions, with the whole HUD portrait contained in its Settings button. History retains its heading and Add entry, compact Daily log/Trends tabs, search with type/date tools, then grouped daily rows. Photos retains its heading and Add photos, Winnie/Care photos tabs, secondary Memories/Places links, then the album or dated care records. Detail sheets have a unified heading/date/author region, notes and facts, consistency and place sections, photos, then optional care updates.

FORM: Bounded Operate correction within the established Winnie's Room world; no identity seed, comp, new tokens or new rasters. Photo-first entry remains the signature interaction.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented behavior

Daily log rows are signed records: a full-bust portrait contained in a 40px square with the name beneath occupies a fixed left rail, beside the event and aligned time, one useful result such as "Firm stool", and an optional note limited to two visible lines. All portrait placements use the existing `brandon-pixel.png` and `kim-pixel.png` artwork rather than the close-cropped head assets. The room's Settings portrait is contained in a centred 32×32px area inside its 44×44px button. History footers hold only photo-count links when applicable and reactions. Place, tags and full notes remain in detail rather than turning each row into a miniature form. Detail sheets retain an uncropped full portrait in a 64px area beside the Pixelify Sans 700 title at 24px and logger attribution, followed by labeled dates and recorded facts. Logger and care-provider attribution remain distinct. Metadata is never flattened into bullet-separated strings.

Today displays the first attached photo in a 144×144px area with `object-fit: contain`, with a photo count when more than one is attached. Opening the preview leads to the entry details. History keeps its compact photo-count links.

A quick poop log opens an optional Poop photo sheet after the record saves, provided another dialog is not already open. Take photo, Choose photo, Consistency and Not now are available together. Consistency updates leave the sheet open; successful photo attachment closes it. Skipping or dismissing preserves the saved record. Pee and earlier logging retain their existing flow.

Winnie is a two-column monthly photo album excluding poop and meal entries. Care photos uses the same signed record heading with a larger uncropped photo below, filtered by All care photos, Poop photos or Meal photos. Memories and Places remain secondary destinations.

The photo composer starts with Choose photos and Take photo, shows removable previews, and saves with an optional caption and date taken. Care-photo addition searches existing poop and meal entries before attaching photos to the chosen record.

## Finish record

October 13, 2026, portrait and Today-photo correction: the user rejected the close-cropped head portraits and the HUD portrait extending beyond its frame, and requested visible poop photos in Today plus a natural photo prompt when logging poop. The fresh visual review accepted all twelve correction captures for portraits, containment, Today photos, prompt and preservation of the existing world; its remaining request was stale documentation. This pass reconciles the portrait dimensions and assets, Today previews, optional prompt and product preference with the implementation. Final reviewer confirmation of the documentation correction remains pending. No new identity, tokens or shipping raster assets were introduced; pre-existing `.impeccable/design.json` drift remains outside this correction.

October 13, 2026: the user's follow-up rejected the labeled-fact row treatment and portrait placement. The signed-record composition replaces that iteration. Fifteen confirmation captures cover mobile, desktop and dark History, detail, Winnie photos, Care photos and the composer after the detail-title correction, with no reported UI errors or overflow. The fresh review requested restoration of the Pixelify detail title and reconciliation of stale portrait and History/photos documentation; both corrections are recorded in the implementation and these documents. The final reviewer confirmed TYPE and Persistence resolved, accepted all fifteen replacement captures, and found no visual regressions introduced by the fixes. Final disposition: ship for the scored fixes. This ordinary extension introduces no new visual identity, tokens or shipping raster assets. Pre-existing drift in `.impeccable/design.json`, including its incomplete navigation example, is neither canonized nor repaired by this scoped pass.
