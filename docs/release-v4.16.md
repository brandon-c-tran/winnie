# Winnie 4.16 — lifetime history and photo dates

History now includes By age: month-by-month recorded days, selected photos, source-linked searches and confirmed milestones. Candidate milestones are described as first recorded, never first-ever. Birth and homecoming dates are household-confirmed facts.

Trends adds What changed, comparing monthly recorded bathroom counts only when both months have enough coverage and use the same logging convention. Training history separates indoor/outdoor annotations from explicit accidents. Missing records are not zero events, and a change in logging is not presented as a change in Winnie's health.

Memories adds named trip collections and destination collections. Trips use user-confirmed date ranges; places group existing locations. Photos selected from care entries retain their care attachment while using their own capture date and place in memory surfaces.

Photo uploads read original EXIF before image compression. Each photo gets its own capture date, time zone, GPS location and original-file fingerprint. Explicit EXIF offsets take priority; GPS can suggest a time zone when no offset exists. Missing or ambiguous dates require review. The app never substitutes the upload date for a library photo with no capture date. Camera capture can use the current capture time. Users can correct Date & place without changing the attached care event's occurrence time. Duplicate original files are skipped, and stable photo/event IDs make interrupted upload retries safe. A photo whose sharing/export process removed metadata still needs manual details. Desktop and WebKit tests do not establish native iPhone camera or every HEIC variant behavior.

## Historical source handling

The staged Notes import preserves source text, day headers, original spellings, uncertain clocks and transformations on each entry. Untimed observations keep day-level precision. Unknown travel time zones do not become precise timestamps. Planned ideal schedules, undated fragments and source headings remain in a separate source archive instead of becoming invented events. Indoor records are not automatically accidents; only explicit accident markers are treated as such. Historical open sleep windows never start a live timer or generate partner notifications.

The import package contains deterministic new IDs, revision-bound corrections and a rollback manifest. Existing March records are reconciled by exact occurrence time before any clock-only fallback. Original IDs, attribution and photo references are retained. Four old sleep closures are corrected using explicit source evidence or marked as unknown; a diagnostic record is excluded from analysis.

`scripts/notes-import.mjs` stages normalized entries. `scripts/history-package.mjs` reconciles an exported household snapshot and simulates the complete command package. `scripts/apply-history-package.mjs` requires an explicitly authorized session and an already-reviewed private package. It exports the current household, archives both the backup and source ledger, verifies archive hashes, submits atomic batches and checks every affected field and original photo reference. The server refuses the import without a verified backup created by the importing device. Private files and credentials stay under ignored `.local/`; they are never published with the app.

## Validation

Unit coverage includes EXIF offsets and DST ambiguity, photo/care date separation, source semantics, coverage comparison gates, deterministic imports, overnight dates, historical timer isolation, backed-up atomic imports, replay safety and notification suppression. Browser coverage exercises mixed-date photo batches, reload and correction, trip collection assignment, source search, day navigation and confirmed milestones in Chromium and WebKit. The independent Impeccable finish review uses phone and desktop captures of By age, Trends, training history, photo import and Memories.
