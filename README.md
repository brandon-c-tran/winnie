# Winnie

Shared care and photos for Winnie Bernard. Vanilla JavaScript PWA, Netlify Functions, and Netlify Blobs.

## Develop

Run `npm ci`, then `npm run dev` (or `npm run dev:large` for a log about the size of the real one). Open http://localhost:4173 and use the isolated test code `winnie-local-demo`. Local development uses an in-memory store; it never calls the production data store. `npm test` covers concurrency, migration preservation, offline IndexedDB recovery, photo attachment, and notification retries.

## Project

- `public/app.js`: startup only. `public/app/`: one module per job (format, state, services, ui, nav, today, logging, entries, forms, library, settings, photos, trainer, clicks).
- Connected grooming: `public/app/logging.js` owns the Now / Yesterday / Pick date completion sheet used by Today, Plans and Earlier. It can link a due reminder to the saved care entry; undo allows that occurrence to be completed again. `public/care-plans.js` supplies reminder state and completion IDs.
- Unfinished work: `public/app/ui.js` coordinates Resume and Discard for entry, grooming and photo-composer drafts. `public/draft-store.js` persists household-scoped drafts in device-local IndexedDB, encoding selected photo blobs as ArrayBuffers for WebKit. Drafts survive reopening when local storage succeeds and are never shared until submitted; storage failures show a warning.
- Chosen care photos: `public/keepsakes.js` filters Winnie and memory photos. Keep in Winnie marks only the chosen photo on a pee, poop or meal entry; the care attachment remains in place. `public/app/entries.js` and `public/app/photos.js` expose the selection, and the server validates the `keepPhoto` command in `netlify/lib/core.mjs`.
- `public/`: the room engine (`room.js`), pixel icons (`icons.js`), offline client (`sync.js`), shared logic modules, and the service worker. Versioned files are cached on the phone: when you change one, bump its `?v=` tag everywhere it is imported and bump `CACHE` in `sw.js`.
- Adding a device: Settings, Add a device shows an 8-character join code that works once for 15 minutes. The long shared code still works.
- Pixel Winnie: `scripts/build-poses.mjs` builds the room sprite sheet from his cleaned frames; `ASTRA_HANDOFF.md` specifies poses that need new art.
- People: Brandon's and Kim's portraits live in `public/photos/*-pixel.png` and `*-face.png`, cleaned from `assets/people/` with `scripts/clean-portrait.mjs`.
- Food on hand (Plans tab): stock per food counts down from each meal logged with it; when food won't outlast delivery time plus two days, Today shows Order food with the Amazon link. Logic in `public/pantry.js`, shared with the server, which validates it as part of shared settings. Poop quality tags (firm, soft, loose) feed Poop by food in Insights.
- Story → Memories → Highlights opens the first-year album with birthday-based monthly chapters, selected Winnie photos and individually kept care photos. Choose cover saves a shared chapter choice; Add a recollection saves the current caregiver's words separately from the caption and the other caregiver's words (1,200 characters each). The postcard, On this day, trips and expandable care milestones and yearly totals remain below. `public/story-album.js` derives chapters; `public/app/story-album-view.js` renders and exports the album.
- Save this album downloads `winnie-year-1.html` (or the selected later year), containing up to 12 chapter covers with embedded images and saved words. Open the file offline to read it, or use Print or save as PDF. Photos must be available when preparing the file; this is a monthly-cover album, not a full photo-library backup. The photo picker searches all supplied photos with month filters and 24 per page. Add photos accepts up to 100 files per selection; save and repeat for larger collections.
- `netlify/lib/`: server-validated commands, conditional storage adapter, authentication, uploads, and push delivery.
- `netlify/functions/`: API, read-only legacy compatibility, scheduled notifications, and backups.
- Google Calendar: Plans → Winnie’s calendar → Connect accepts the shared Winnie calendar’s **Secret address in iCal format** (Google Calendar desktop Settings → Winnie → Integrate calendar). The private address stays in the server-only household connection, excluded from device snapshots and exports. The `calendar-sync` scheduled function checks hourly at minute 15; Refresh now checks on demand. All available events since Winnie's birthday (July 25, 2025) and recurring occurrences through one year ahead appear in Story → Timeline → Calendar. Google may cache its subscription feed, so changes can take another refresh to appear. Cancelled/removed items retain their history; completed care records are never automatically changed. Disconnect stops updates and preserves saved history. Reset the secret address in Google if it has been exposed, then replace the connection in Winnie.
- Calendar evidence: `Training w/ Will` identifies Will sessions; other classes, vet, grooming and other appointments stay distinct. Past scheduled counts/hours describe the calendar, not attendance. Log completed visit explicitly creates care; exact or nearby matching care prevents duplicate records. `ical.js` expands recurrence and timezone definitions; incomplete or invalid feeds preserve the prior snapshot. Tests use the synthetic `tests/fixtures/winnie-calendar.ics` feed through a development-server-only injection (`WINNIE_DEV_CALENDAR`); production always fetches the validated Google address without redirects.
- `tests/`: deterministic store, API, IndexedDB, and history-pattern tests (`npm test`).
- `e2e/`: browser tests in iPhone WebKit and Chrome (`npm run test:e2e`). CI runs everything on each pull request.
- `docs/release-v3.md`: migration, release validation, and recovery procedure.
- `seed/`: frozen historical source imports. Do not edit or re-seed over live history.

## Release

Netlify is linked to the main branch of this repository. Its build runs syntax checks and tests before publishing. Preview hostnames use isolated stores; `winnie-preview-demo` opens an isolated example on a preview deployment.

The legacy data store remains untouched. The first upgraded pairing makes and verifies an immutable backup, then preserves all original event IDs/fields in the new canonical store. Legacy full-array writes are rejected. Existing phones preserve their old local copy and can review differences after reconnecting.

Never roll back to the old writable backend or replace the shared history with a seed. See the release document for the safe recovery procedure.

On each actual phone, choose Brandon or Kim and enable partner notifications. On iPhone, install to the Home Screen first. Push is sent after committed events; the OS controls final display and timing.
