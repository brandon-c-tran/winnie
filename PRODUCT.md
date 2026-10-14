# Winnie

<!-- impeccable:product-schema 1 -->

## Context Authority

Confirmed with the user on October 12, 2026: use the current app as the product authority. `docs/product-north-star.md` is an outdated proposal, not an approved roadmap or source of current requirements. This record describes the existing implementation; it does not authorize a redesign or introduce proposed features. Unspecified future product decisions remain open.

## Platform

web

## Users

Brandon and Kim share care of Winnie Bernard. Each device joins their shared log with a shared code, a person choice, and a device name. The app supports checking what was recorded, adding care, coordinating upcoming tasks, and revisiting photos and history across their devices.

Winnie was born July 25, 2025 and came home October 4, 2025 (confirmed by Brandon on October 13, 2026). The family began tracking when he came home and intends to continue throughout his life. The lifetime extension includes a staged historical Notes import with source provenance and review flags. The earliest available note is October 6, 2025; October 4–5 and most of November remain missing. Do not assume the app contains the complete record or that tracking began at birth. Insights distinguish age-related context, recent patterns, and changes in logging coverage; imports preserve source and time uncertainty.

## Product Purpose

Keep Winnie's day, care, and memories together. The current app combines a shared care record with plans, household notes, photos, and remembered places. Its existing promise is “His day, together.” No new growth targets or measured success claims are established by this setup.

## Operating Context

- **Today:** room, recorded status, frequent logging, and permanent Care rows for Brush, Teeth, Ears, Nails, Bath and Haircut; additional care, Up next, Notes, memories when available, and the dated shared timeline follow. Each Care row offers Done and the actual last-done age linked to its entry, or “Not logged yet.” Status describes the last log or a running timer; a walk or sleep timer left open for at least 36 hours offers Correct time. A compact sentence identifies the latest activity and logger. More contains a secondary Explore the room disclosure with labeled keyboard access to room interactions.
- **Plans:** Supplies, Winnie’s calendar, then Reminders. Supplies contains wipes, poop bags, Heartgard stock and existing food inventory. The calendar shows the next three saved upcoming entries, connection status, and access to the full agenda. Reminders support one-time or recurring plans, claims, completions, and paused or finished plans.
- **Meal options:** Foods come from saved meals and pantry inventory, with no preset foods. Meal → Manage foods removes or restores picker options for both caregivers without changing past meals or stock. Removing pantry food also hides its picker option; adding it back restores it.
- **History:** Daily log, Trends, By age and Calendar. Daily log retains search, type and date filters. By age combines household-confirmed birth and homecoming dates, source-linked search, monthly selected photos and recorded-day navigation, confirmed milestones, and source coverage notes. Trends adds monthly comparisons and a training retrospective alongside the existing recent-pattern views. Calendar separates Upcoming and Past, with Will, Classes, Vet, Grooming and Other filters, title/place search, and an option to show cancelled and removed entries.
- **Photos:** Photos, Memories and Places share a stable primary navigation row. Winnie and Care photos are subordinate collections shown only within Photos; returning to Photos restores the selected collection. Each destination has its own heading. The header Add photos action appears only in Photos; an empty Memories postcard also offers Add photos. Places leads with a local geographic atlas, grouped destination markers and region controls, followed by dated outings and a searchable destination directory. Destination details connect age, selected photos and recorded days to the original logs. Places saved by name without a pin remain separate; external city maps and each entry's saved pin remain available.
- **Settings:** device identity, partner notifications, automatic location, shared handoff notes, trainer visits, exports, saved-phone-history review, and connected devices.
- Care schedules and recorded-day grouping use San Francisco dates. The sleep action switches between nap and night sleep using San Francisco sunrise and sunset.

## Capabilities and Constraints

- Both people use iPhones (installed to the Home Screen), so iOS PWA limits apply: no manifest shortcuts, no vibration API.
- Existing stack: vanilla JavaScript PWA, Netlify Functions, and Netlify Blobs. Browser modules and the service worker live in `public/`; backend code lives in `netlify/`.
- Care entries support editing, undo, occurrence times, care-provider attribution, notes, tags, and relevant additional fields. Preserve the distinction between who logs an entry and who provided care.
- Grooming completion from Today, Plans, or Earlier uses the same Now / Yesterday / Pick date form. A matching due reminder can be completed with the care record, or the user can choose Just record care. Yesterday records an approximate time; an exact earlier time stays selected when the form opens. Undo removes the completion, and that reminder can be completed again.
- Photos can accompany entries or standalone moments. Care collections include pee, poop and meal photos. Keep in Winnie selects individual care photos for the Winnie collection and memory surfaces while preserving their original care attachment. Unselecting a keepsake leaves the care photo intact; other photos on the same entry stay excluded unless selected separately.
- Memories leads with a postcard using a chosen photo, its saved date, caption and place when present. The caption edits the source entry. Care milestones and yearly totals remain available in a collapsed section; they do not appear on the postcard.
- By age labels age at mid-month and links recorded days and whole months to Daily log. Missing days remain unrecorded. Candidate milestones are the earliest matching records, not confirmed first-ever events; Keep confirms a candidate, and Add milestone saves a user-chosen name and date. History search matches saved activities, places, notes and source text, returns the supporting entries, and qualifies earliest matches and missing results.
- Monthly comparisons cover Pee, Poop and Meals, showing median records per logged day and entry/day counts. A change is shown only for different months with at least 14 logged days each, no more than five days' difference in coverage, and one shared logging era. Logged days are days containing pee, poop or meal records; uncertain activity types are excluded from that activity's count. Otherwise, the figures are descriptive only. They do not measure unrecorded activity or establish a medical change.
- Training history separates indoor/outdoor labels, unlabeled bathroom records and explicit accidents. It shows label coverage and named training-session records without treating indoor use as an accident, missing labels as outdoor success, accident counts as success rates, or training as the cause of a change.
- Memories includes Trips & places below the postcard and any On this day photos. Named trips use user-chosen inclusive dates and collect matching entries and selected photos. Destination collections use saved places and photo locations, count recorded days rather than inferred visits, and open their source records. Care keepsakes use each selected photo's own date and place while retaining the care attachment.
- Places renders bundled Natural Earth boundaries and GeoNames place references on the device without third-party tiles or geocoding requests. Nearby-city labels are approximate, while original pins remain at their saved positions. The directory initially shows six destinations per region; expansion and search expose the full matching collection. Age at a destination means its first saved day in the available records, or its earliest shown day under a year filter, never a first-ever visit.
- Places suggests outings from consecutive recorded days at least 60 km from the most-recorded destination, joining nearby destinations in the same region. Suggestions are labeled and become named trips only through the existing save form. Replay steps through recorded days with age and selected photos; it does not infer routes, mileage or a complete itinerary. Saved trips also include selected photos captured within their dates when those photos have no location, including photo-only replay days without invented pins. Individually selected care photos retain their original attachment; unselected care photos remain care evidence.
- Photo batches read original EXIF before compression and preserve each photo's capture date, offset or time zone, GPS when present, and original-file fingerprint. Explicit camera offsets take priority; a time zone estimated from GPS is labeled as an estimate. Each removable preview has Date & place controls. Missing or ambiguous capture times require review; library uploads never substitute upload time. A new camera capture can use the current capture time. Correcting photo Date & place does not change its care entry's occurrence time. Duplicate original standalone uploads are skipped, and stable IDs support interrupted retries. Metadata stripped during sharing or export needs manual details; native iPhone camera and every HEIC variant are not established by desktop/WebKit checks.
- Historical Notes retain original text, day headers, spellings, uncertainty and transformations. Untimed observations keep date-level precision; unknown travel time zones do not become precise timestamps. Undated fragments and planned schedules remain a source archive rather than completed activities. Historical open sleep windows do not become live timers or partner notifications. Import staging and reviewed application are separate; the package requires a verified backup and preserves existing IDs, attribution and photo references.
- Unfinished entry, grooming-completion and photo-composer drafts save on the current device for the current household, including selected photo data. Today offers Resume and Discard after dismissal or reopening the app. Drafts are not shared records; saving submits the entry, while discarding removes the draft. A storage failure is surfaced rather than reported as a successful local save.
- Shared fridge notes can be archived and revisited. Care plans support claiming and recording completion.
- Winnie’s calendar connects read-only to the shared Google Calendar named Winnie through its secret iCal address. One-time setup requires the user to supply that private address; the implemented connection does not itself establish that the household is connected. The address stays in server storage and is excluded from device snapshots and client exports. Google events are never changed. An hourly server job refreshes connected calendars, and Refresh now is available. Connected, paused and refresh-error states remain visible; failed refreshes and disconnection retain saved history. Existing trainer imports remain available before connection.
- Calendar entries preserve planned Training w/ Will, classes, vet visits, haircuts and other events, including historical blocks and all-day entries. The saved range starts at Winnie’s birth date and extends about one year ahead, with last-check and saved-through dates displayed. Past Will session counts and hours describe scheduled time, not completed care. Only an eligible past timed visit becomes care through an explicit Log completed visit action. Cancelled, removed, all-day and Other entries remain calendar evidence. Existing linked or matching care records are offered for review instead of duplicated; calendar updates do not revise confirmed care records.
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

Places intent (Brandon, October 13, 2026): pee and poop logs are also proxies for places Winnie has been. The travel map should make destinations, Winnie's age and the family's photos meaningful and enjoyable to revisit, with source records underneath. Recorded days remain distinct from visits; suggested outings are labeled inferences, and named trips use dates chosen by the family.

Care and planning intent (Brandon, October 13, 2026): keep all six grooming tasks visible with their last recorded completion, and organize Plans around supplies, training visits and optional reminders. Stock and medication administration remain separate facts. Forms must fit the iPhone sheet; the room's bed rim may cover Winnie only while he is sleeping in the bed.

## Evidence on Hand

- Current interface and behavior: `public/index.html`, `public/app.js`, and the care, fridge, places, insights, synchronization, and companion modules in `public/`.
- Family portraits: `public/photos/winnie-smile.png` and `public/photos/winnie-story.png`.
- Existing companion and icons: `public/photos/winnie-pixel-v2.png`, `public/icons/`, and `assets/`.
- Technical and recovery context: `README.md`, `docs/release-v3.md`, and existing tests in `tests/`.
- Lifetime extension implementation and limits: `public/lifetime.js`, `public/app/lifetime-view.js`, `public/app/photos.js`, and `docs/release-v4.16.md`.
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
