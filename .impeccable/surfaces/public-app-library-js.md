---
version: 1
slug: "public-app-library-js"
primary_target: "public/app/library.js"
related_targets: ["public/app/entries.js","public/app/photos.js","public/app/forms.js"]
---

# History, entry details, and photo browsing

Scope: existing Winnie surfaces and photo-add flow. Mode: Operate. Preserve the established pixel world, stored entries, photo associations, and all edit/reaction capabilities.

## Direction contract

THESIS: One daily record, with two ways to revisit photos. History is a readable chronological list; Winnie photos are an album; care photos are evidence attached to dated entries.

OWN-WORLD: Inherit Pixelify headings, Rubik reading text, square navy edges, periwinkle paper and the existing care colors. Use fewer containers and stronger alignment.

STORY: Scan time and event, read only recorded facts, open an entry for detail. Browse Winnie photos separately from poop and meal photos. Choose photos before adding a caption, or attach directly to an existing care entry.

FIRST VIEWPORT: History heading and Add entry, compact Daily log/Trends tabs, search with type/date tools, then grouped daily rows. Photos heading and Add photos, Winnie/Care photos tabs, secondary Memories/Places links, then the album or dated care records. Detail sheets have a unified heading/date/author region, notes and facts, consistency and place sections, photos, then optional care updates.

FORM: Local restructuring within the established Winnie's Room world; no identity seed or comp required. Photo-first entry is the signature interaction.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented behavior

Daily log rows are signed records: a native 40px head portrait with the name beneath occupies a fixed left rail, beside the event and aligned time, one useful result such as "Firm stool", and an optional note limited to two visible lines. The footer holds only photo-count links when applicable and reactions. Place, tags and full notes remain in detail rather than turning each row into a miniature form. Detail sheets use an uncropped full portrait in a 64px area beside the Pixelify Sans 700 title at 24px and logger attribution, followed by labeled dates and recorded facts. Logger and care-provider attribution remain distinct. Metadata is never flattened into bullet-separated strings.

Winnie is a two-column monthly photo album excluding poop and meal entries. Care photos uses the same signed record heading with a larger uncropped photo below, filtered by All care photos, Poop photos or Meal photos. Memories and Places remain secondary destinations.

The photo composer starts with Choose photos and Take photo, shows removable previews, and saves with an optional caption and date taken. Care-photo addition searches existing poop and meal entries before attaching photos to the chosen record.

## Finish record

October 13, 2026: the user's follow-up rejected the labeled-fact row treatment and portrait placement. The signed-record composition replaces that iteration. Fifteen confirmation captures cover mobile, desktop and dark History, detail, Winnie photos, Care photos and the composer after the detail-title correction, with no reported UI errors or overflow. The fresh review requested restoration of the Pixelify detail title and reconciliation of stale portrait and History/photos documentation; both corrections are recorded in the implementation and these documents. The final reviewer confirmed TYPE and Persistence resolved, accepted all fifteen replacement captures, and found no visual regressions introduced by the fixes. Final disposition: ship for the scored fixes. This ordinary extension introduces no new visual identity, tokens or shipping raster assets. Pre-existing drift in `.impeccable/design.json`, including its incomplete navigation example, is neither canonized nor repaired by this scoped pass.
