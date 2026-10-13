---
version: 1
slug: "public-care-view-js"
primary_target: "public/care-view.js"
related_targets: ["public/app/today.js", "public/app/supplies-view.js", "public/app/trainer.js", "public/app/pantry-view.js", "public/room.js", "public/styles.css"]
---

# Persistent care and practical Plans

Scope: ordinary Operate extension within Winnie's Room. User requests always-visible last-done grooming, Plans organized around supplies and training, iPhone field containment, and correct bed/Winnie layering.

THESIS: Make routine care visible and planning concrete: what needs doing, what needs restocking, and the next training visit.

OWN-WORLD: Preserve Pixelify headings, Rubik reading text, periwinkle ground, square navy edges and the actual room artwork. Flat aligned rows carry the information; no bullet-separated metadata strings.

STORY: Today shows Brush, Teeth, Ears, Nails, Bath and Haircut with actual last-done ages and quick logging. Plans separates supplies (wipes, poop bags, Heartgard and existing food inventory), calendar training visits and optional scheduled reminders. Ordering medication never records administration.

FIRST VIEWPORT: Today retains room and frequent logging, followed by the permanent Care section. Plans leads with Supplies; Training visits and Reminders follow. Reminder creation begins with a named task and hides unnecessary type configuration.

FORM: Bounded code-led extension, no new identity, seed, comp, quality card or raster assets. Six care tasks share a compact two-column divided list. Supplies and visits use flat rows with distinct status/date/action alignment. Existing calendar snapshots remain visibly identified as snapshots.

FINISH: fresh finish review includes the user's iPhone form and room-overlap screenshots, followed by documentation. No cadence is inferred for grooming. Heartgard defaults monthly only because the user specified monthly use. Existing history, plans and calendar IDs are preserved.

## Implemented behavior

- Today order is room and recorded status, Pee/Poop, optional post-poop controls, Meal/Photo/Earlier/More, permanent Care, optional Also today, Up next, Notes, optional On this day, then the day log. Care always includes Brush, Teeth, Ears, Nails, Bath and Haircut. Done logs that task now; the last-done age opens its original entry. Missing history reads “Not logged yet.” Deleted and future entries do not supply last-done state.
- Plans leads with Supplies (Wipes, Poop bags, Heartgard and Food), then Training visits and Reminders. Stock begins as Not checked and can be set to In stock, Running low or Ordered. Optional HTTPS reorder links remain distinct from stock updates. Food keeps its existing meal inventory and restocking controls.
- Heartgard stock and dose are separate: updating supplies never logs medication. Its reminder template starts monthly, as requested by the user. Grooming templates start one-time; no grooming frequency is invented. Named tasks omit entry-kind configuration; Other reminder exposes Kind. Existing plans retain their IDs and completion history.
- Training visits use the imported saved calendar. The Plans summary labels when it was checked; the schedule also labels the saved-through date and the need to import again after changes. Scheduled, Not confirmed and Logged are distinct states. Only a visit that has ended can be confirmed as a care record. Live calendar synchronization is not implemented.
- Care and Plans use divided rows, separate metadata lines, Pixelify headings and Rubik reading text. Labels and fields shrink within the sheet; controls remain 16px and bounded by their columns. Native date values align left. The bed front rim paints after Winnie only while he is in the bed; it paints before him when he is awake or moving.

## Evidence and finish review

Source checked: `public/routine.js`, `public/app/today.js`, `public/app/supplies-view.js`, `public/app/trainer.js`, `public/care-view.js`, `public/app/pantry-view.js`, `public/index.html`, `public/room.js` and `public/styles.css`.

The fresh finish review inspected 17 captures covering mobile, desktop, dark mode, permanent Care, native WebKit forms and room layering. The training date finding was a Pixelify numeral misread; fresh Today captures resolved missing navigation glyphs caused by capture setup. Documentation was reconciled. Final disposition: ship for the scored changes, with no regressions observed in recaptured surfaces. Validation passed 93 unit tests and 68 browser checks. No new identity tokens or raster assets were introduced by this extension. Existing `.impeccable/design.json` drift remains outside this documentation update.
