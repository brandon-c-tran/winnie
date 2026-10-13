# Winnie

<!-- impeccable:product-schema 1 -->

## Context Authority

Confirmed with the user on October 12, 2026: use the current app as the product authority. `docs/product-north-star.md` is an outdated proposal, not an approved roadmap or source of current requirements. This record describes the existing implementation; it does not authorize a redesign or introduce proposed features. Unspecified future product decisions remain open.

## Platform

web

## Users

Brandon and Kim share care of Winnie Bernard. Each device joins their shared log with a shared code, a person choice, and a device name. The app supports checking what was recorded, adding care, coordinating upcoming tasks, and revisiting photos and history across their devices.

## Product Purpose

Keep Winnie's day, care, and memories together. The current app combines a shared care record with plans, household notes, photos, and remembered places. Its existing promise is “His day, together.” No new growth targets or measured success claims are established by this setup.

## Operating Context

- **Today:** room, recorded status, frequent logging, and permanent Care rows for Brush, Teeth, Ears, Nails, Bath and Haircut; additional care, Up next, Notes, memories when available, and the dated shared timeline follow. Each Care row offers Done and the actual last-done age linked to its entry, or “Not logged yet.” An active walk exposes its finish action.
- **Plans:** Supplies, Training visits, then Reminders. Supplies contains wipes, poop bags, Heartgard stock and existing food inventory. Reminders support one-time or recurring plans, claims, completions, and paused or finished plans.
- **History:** Daily log and Trends, with search, type and date filters grounded in saved records.
- **Photos:** Winnie and Care photos, with Memories and Places as secondary destinations. Places groups coordinate-bearing entries by approximate nearby city using an on-device directory, with named spots within each city; places saved by name without a pin remain separate. Recorded days lead to the original logs. External city maps and each entry's saved pin provide geographic context.
- **Settings:** device identity, partner notifications, automatic location, shared handoff notes, trainer visits, exports, saved-phone-history review, and connected devices.
- Care schedules and recorded-day grouping use San Francisco dates. The sleep action switches between nap and night sleep using San Francisco sunrise and sunset.

## Capabilities and Constraints

- Both people use iPhones (installed to the Home Screen), so iOS PWA limits apply: no manifest shortcuts, no vibration API.
- Existing stack: vanilla JavaScript PWA, Netlify Functions, and Netlify Blobs. Browser modules and the service worker live in `public/`; backend code lives in `netlify/`.
- Care entries support editing, undo, occurrence times, care-provider attribution, notes, tags, and relevant additional fields. Preserve the distinction between who logs an entry and who provided care.
- Photos can accompany entries or standalone moments. Existing collections include poop and meal photos. Preserve stored photos and their associations with entries.
- Shared fridge notes can be archived and revisited. Care plans support claiming and recording completion. Trainer visits are imported calendar snapshots labeled with when the calendar was checked and how far it was saved; schedule changes require another import. A scheduled visit becomes a care entry only when explicitly confirmed after its end. Live calendar sync is not implemented.
- Wipes, poop bags and Heartgard have explicit stock states: Not checked, In stock, Running low and Ordered, with optional HTTPS reorder links. Updating or ordering Heartgard stock does not record a dose. Food retains its meal-based inventory and restocking controls.
- Reminder creation starts with Heartgard, one of the six grooming tasks, or Other reminder. Known tasks carry their entry kind without a “Logs as” selector. Heartgard starts with a monthly repeat because the user specified monthly use; grooming starts as one-time, with no inferred care cadence.
- Devices keep pending changes locally and show whether they are waiting to share or need review. Server-validated, versioned commands and recovery preserve concurrent changes and older phone history.
- Preserve original event IDs, historical fields, attribution, migration backups, and the legacy store. Never replace live history with seed data or restore the old writable backend. Follow `docs/release-v3.md` for recovery.
- Partner push follows committed events. Notification permission and subscription belong to each device; actual display and timing remain OS-dependent. Keep visible synchronization state accurate.
- Automatic location is permission-dependent and controlled per device. It attaches location to new logs, with no tracking between logs. City grouping happens on the device; nearby-city labels are approximate and recorded days are not visit counts.
- Local development uses `npm run dev` at `http://localhost:4173` and an isolated in-memory store. The README documents local and preview demo access. Production data is not needed for design work.
- Future audience expansion, new feature priorities, and additional accessibility targets are undecided.

## Brand Commitments

The product is Winnie, centered on Winnie Bernard and his family. Copy voice decided with Brandon on October 12, 2026: the app talks like a label maker (what happened, when, and who; buttons name exactly what they do) and pixel Winnie never speaks words, only emotes. Taglines and warm abstractions ("our good boy", "Our little family", "His story", "A life worth remembering") are retired because they read as AI-written; warmth comes from the room, motion, and the family's own notes and captions. Winnie's real portraits and the pixel companion (generated by Brandon with Astra 6) are the identity assets; the pixel companion is the center of the Winnie's Room design.

Observed logging habits (Brandon, October 12, 2026): pee and poop are logged most; walks and sleep are not logged reliably (Winnie now sleeps freely in the living room); occasional care like baths is easy to forget in the moment. Design for the logging that actually happens, and make occasional care easy to catch up on later.

Photo collection preference (Brandon, October 13, 2026): prompting naturally when poop is logged helps collect care photos. Offer an optional photo prompt after saving a quick poop log, keep consistency available there, and show attached photos in Today. Skipping the prompt must preserve the log.

Places intent (Brandon, October 13, 2026): pee and poop logs are also proxies for places Winnie has been. Place browsing should lead with destinations and group their source records, rather than lead with a care-event map. Recorded days remain distinct from inferred visits or trips.

Care and planning intent (Brandon, October 13, 2026): keep all six grooming tasks visible with their last recorded completion, and organize Plans around supplies, training visits and optional reminders. Stock and medication administration remain separate facts. Forms must fit the iPhone sheet; the room's bed rim may cover Winnie only while he is sleeping in the bed.

## Evidence on Hand

- Current interface and behavior: `public/index.html`, `public/app.js`, and the care, fridge, places, insights, synchronization, and companion modules in `public/`.
- Family portraits: `public/photos/winnie-smile.png` and `public/photos/winnie-story.png`.
- Existing companion and icons: `public/photos/winnie-pixel-v2.png`, `public/icons/`, and `assets/`.
- Technical and recovery context: `README.md`, `docs/release-v3.md`, and existing tests in `tests/`.
- Historical imports: `seed/`, retained as frozen source material. Their presence does not authorize reseeding.
- No testimonials, external performance claims, or new milestones are established here. Do not invent memories or facts about Winnie from imagery or missing records.

## Product Principles

Redesign priorities confirmed October 12, 2026: optimize for delight and intuitiveness, with quick one-handed phone use for checking and logging daily care. The user wants lots of playful personality, a snappy response, and an impressive, beautiful result; excessive restraint would miss the brief. Photos and plans stay close to the core care workflow. This request authorizes a new visual direction while preserving current product capabilities and records.

1. Preserve the household's shared history and make pending or conflicting changes visible.
2. Ground care state, trends, places, and memories in actual saved records.
3. Keep recording care, coordinating plans, and revisiting memories connected to the same shared log.
4. Preserve explicit attribution and each device's notification and location choices.

## Accessibility & Inclusion

The current implementation includes labeled controls, a skip link, status and error announcements, dialog labeling, and reduced-motion handling. Preserve these behaviors during future changes. No conformance audit or additional product-specific accessibility standard was established during initialization.
