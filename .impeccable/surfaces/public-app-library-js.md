---
version: 1
slug: "public-app-library-js"
primary_target: "public/app/library.js"
related_targets: ["public/app/entries.js","public/app/photos.js","public/app/forms.js","public/app/format.js","public/app/today.js","public/app/logging.js","public/app/clicks.js","public/fridge.js","public/styles.css"]
---

# History, entry details, and photo browsing

Scope: existing Winnie surfaces and photo-add flow. Mode: Operate. Preserve the established pixel world, stored entries, photo associations, and all edit/reaction capabilities.

## Direction contract

THESIS: Preserve recognizable whole-person portraits and collect care photos at the natural logging moment. History is a readable chronological list; Winnie photos are an album; care photos are evidence attached to dated entries and visible in Today.

OWN-WORLD: Inherit Pixelify headings, Rubik reading text, square navy edges, periwinkle paper, pink accents and the existing care colors. Preserve the incumbent room, controls and portrait artwork.

STORY: Log poop, optionally choose consistency and take or choose a photo, or skip while preserving the saved record. See the attached photo in Today. Scan time and event, read only recorded facts, and open an entry for detail. Browse Winnie photos separately from poop and meal photos. Choose photos before adding a caption, or attach directly to an existing care entry.

FIRST VIEWPORT: Today retains its room and logging actions, with the whole HUD portrait contained in its Settings button. History retains its heading and Add entry, compact Daily log/Trends tabs, search with type/date tools, then grouped daily rows. Photos, Memories and Places share a stable primary navigation row below the current destination's heading. Only Photos shows Add photos, subordinate Winnie/Care photos collection controls, then the album or dated care records. Returning to Photos restores the selected collection. Detail sheets have a unified heading/date/author region, notes and facts, consistency and place sections, photos, then optional care updates.

FORM: Bounded Operate correction within the established Winnie's Room world; no identity seed, comp, new tokens or new rasters. Photo-first entry remains the signature interaction.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented behavior

Daily log rows are compact signed records. The text column contains the event, one useful result such as "Firm stool", an optional note limited to two visible lines, then a frameless 24×24px full-bust portrait inline beside the author's name. Time sits at the top right and reactions at the bottom right within the row; photo-count links appear there when applicable. Reaction targets remain at least 44×44px. All portrait placements use the existing `brandon-pixel.png` and `kim-pixel.png` artwork rather than the close-cropped head assets. The room's Settings portrait is contained in a centred 32×32px area inside its 44×44px button. Place, tags and full notes remain in detail rather than turning each row into a miniature form. Detail sheets retain an uncropped full portrait in a 64px area beside the Pixelify Sans 700 title at 24px and logger attribution, followed by labeled dates and recorded facts. Logger and care-provider attribution remain distinct. Metadata is never flattened into bullet-separated strings.

Today displays the first attached photo beside the details and before the time/reaction column, with `object-fit: contain` and a photo count when more than one is attached. The preview is 80×88px, reducing to 64×80px at 360px and below. Row padding and gaps are 12px, with 10px horizontal padding and 8px gaps at that breakpoint. Opening the preview leads to the entry details. History keeps its compact photo-count links.

Notes use a frameless 28×28px full portrait in a byline below the note text, inline beside separate author/date elements. The byline is in normal flow with an 8px gap and wrapping text; authored notes hide the decorative top magnet. Metadata has no bullet separators.

Dialog content and forms use `minmax(0, 1fr)` grid tracks. Forms, labels and fields can shrink with `min-width: 0`. Native date and date-time fields use `appearance: none` and its WebKit prefix, `min-inline-size: 0`, and `max-inline-size: 100%`; WebKit values align left with hidden overflow. Inputs retain 16px text and native editing. Widths of 320px, 390px and 560px are the edit-date containment and saved-time regression cases.

A quick poop log opens an optional Poop photo sheet after the record saves, provided another dialog is not already open. Take photo, Choose photo, Consistency and Not now are available together. Consistency updates leave the sheet open; successful photo attachment closes it. Skipping or dismissing preserves the saved record. Pee and earlier logging retain their existing flow.

Winnie is a two-column monthly photo album excluding poop and meal entries. Care photos passes `fullPhoto: true` to the signed record renderer, keeping a larger uncropped photo below the heading across the full row, with `object-fit: contain`, automatic height and a 300px maximum height. It is filtered by All care photos, Poop photos or Meal photos. Photos, Memories and Places are peer destinations in the primary row; Winnie and Care photos are subordinate choices visible only in Photos. Navigation remembers the selected `photoCollection` when returning from Memories or Places, and the heading reflects the active destination. Add photos is shown only in Photos. Place details retain their Back to places breadcrumb and temporarily hide the shared heading and primary row.

The photo composer starts with Choose photos and Take photo, shows removable previews, and saves with an optional caption and date taken. Care-photo addition searches existing poop and meal entries before attaching photos to the chosen record.

## Finish record

October 13, 2026, photo navigation correction: the fresh reviewer accepted all twelve `.impeccable/review/nav-{mobile,desktop,dark,iphone}-software-{photos,memories,places}.png` captures. The 52 targeted browser checks across both engines and two strengthened photo-composer checks passed. The remaining finding was stale navigation documentation. This scoped update records the primary Photos / Memories / Places row, subordinate photo collections, remembered collection on return, destination headings, Photos-only Add photos and unchanged Back to places detail breadcrumb. The final reviewer scored Persistence resolved and returned disposition: ship for the scored fix. Existing design tokens, `.impeccable/design.json`, artwork and unrelated documentation are preserved; prior sidecar drift remains outside scope.

October 13, 2026, compact records, Notes and edit-date correction: the fresh reviewer accepted all eight `.impeccable/review/records-{mobile,desktop,dark,iphone}-{rows,edit}.png` captures and the visual fixes. The only material remaining finding was stale documentation. This scoped update reconciles inline 24px author portraits, compact side-by-side Today photos, right-aligned time/reactions, 28px Notes bylines, full Care photos and native date-field containment with the current source. The unit suite passed 93 tests. The browser suite passed 69 checks initially; its remaining check passed after an external weather error and a premature test reload were investigated, with the test corrected to await the saved state. The fresh reviewer scored Persistence resolved and returned disposition: ship for that scored fix, following acceptance of all eight visual captures. The earlier finish records below describe earlier passes, not approval of this correction. Design tokens, `.impeccable/design.json`, full portrait artwork and stored history are preserved; known sidecar drift remains outside scope.

October 13, 2026, portrait and Today-photo correction: the user rejected the close-cropped head portraits and the HUD portrait extending beyond its frame, and requested visible poop photos in Today plus a natural photo prompt when logging poop. The fresh visual review accepted all twelve correction captures for portraits, containment, Today photos, prompt and preservation of the existing world; its remaining request was stale documentation. This pass reconciles the portrait dimensions and assets, Today previews, optional prompt and product preference with the implementation. The final reviewer scored Persistence resolved, accepted all twelve captures and found no visible regression. Final disposition: ship for the scored fixes. No new identity, tokens or shipping raster assets were introduced; pre-existing `.impeccable/design.json` drift remains outside this correction.

October 13, 2026: the user's follow-up rejected the labeled-fact row treatment and portrait placement. The signed-record composition replaces that iteration. Fifteen confirmation captures cover mobile, desktop and dark History, detail, Winnie photos, Care photos and the composer after the detail-title correction, with no reported UI errors or overflow. The fresh review requested restoration of the Pixelify detail title and reconciliation of stale portrait and History/photos documentation; both corrections are recorded in the implementation and these documents. The final reviewer confirmed TYPE and Persistence resolved, accepted all fifteen replacement captures, and found no visual regressions introduced by the fixes. Final disposition: ship for the scored fixes. This ordinary extension introduces no new visual identity, tokens or shipping raster assets. Pre-existing drift in `.impeccable/design.json`, including its incomplete navigation example, is neither canonized nor repaired by this scoped pass.
