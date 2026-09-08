# Winnie v3 release

## Shipped experience

- Today and His story, using Winnie's real photos and clear care actions.
- Optional camera/library attachment after poop logging; a dedicated poop-photo collection; photos on older entries; standalone moments; individual photo downloads.
- Brandon/Kim device pairing, per-event partner push, photo-update notifications, and revocable devices. Phones must explicitly enable notifications; iPhone requires a Home Screen installation.
- IndexedDB outbox, pending state, offline photo persistence, conditional server commands, explicit conflicting edits, Undo, and recovery of older phone-only entries.
- Night sleep as the main sleep action; optional naps under More care. Explicit sleep-end confirmation prevents a double tap ending a new sleep.
- One-tap trainer hour ending now, attributed as care by the trainer and logged by the actual person. Tuesday/Wednesday/Thursday Today card; always available in More care; editable times.
- Shared current routine and learning goal; optional walk mode; signal choices “He asked” / “We took him out.”
- Searchable full history and 7/28/90-day recorded patterns. Logging coverage and incomplete/invalid sleep data are explicit; no inferred health scores.

## Data boundary and backup

The old `winnie` store and its household key remain unchanged. The new `winnie-v4` household stores every original event field plus a revision. Immutable migration exports live in `winnie-backups`, verified by SHA-256 before conversion. Daily snapshots are scheduled. Device history is archived separately and differences require an explicit choice; no blind array union.

The old whole-array PUT returns 426 and cannot overwrite the canonical log. Original browser localStorage is never cleared. The new service worker preserves localStorage/IndexedDB, updates application assets, and excludes function requests from caching. Existing open old tabs need to close/reopen before they can save again.

The pre-release private server export contained 2,257 records. A rehearsal verified every original field and ID, including unusual historical durations. Private raw exports and credentials are kept in ignored `.local/`, never in the public site or repository.

## Store and notification safety

Pinned Blobs SDK 11.0.3, with a tested transport guard for conditional-write error responses and missing ETag acknowledgments. Each command atomically commits the event, idempotency receipt, and eligible notification jobs. Stale edits return a conflict. Deleted entries retain tombstones. Scheduled dispatch retries notification failures and expires invalid subscriptions; OS display is not guaranteed exactly once.

Uploads are bounded, format checked, household scoped, and fetched only after device authentication. Photos are uploaded before the attachment command; retries reuse the photo ID and content checksum. Photo upload failure cannot remove an already saved poop entry.

Non-production hostnames use deploy-specific store names. They never read the production namespace. Preview pairing accepts the test code `winnie-preview-demo` to create an isolated example, with no production data.

## Validation and release procedure

1. `npm ci`, `npm run check`, and `npm test`; Netlify also runs the checks before publishing.
2. Local browser walkthrough at phone width and independent Brandon/Kim browser sessions: one-tap care, photo attachment/collection, cross-device photo visibility, explicit sleep end, and history navigation.
3. An isolated Netlify preview exercises the actual store adapter before production publication.
4. Take another private server export immediately before publication. After migration, compare every legacy field/ID with that export and verify the old PUT is rejected without changing state.
5. Each actual phone chooses its person, reviews any old phone-only changes, and explicitly enables push. Physical iPhone camera/notification/lifecycle acceptance still requires the actual devices.

## Recovery

Do not publish the old writable backend or restore an old snapshot over newer activity. Preserve the v4 API during a frontend rollback. Export current v4 state and pending operations before recovery, compare against the immutable migration/day/device snapshots, then restore only reviewed missing/corrected records with versioned commands. Photos remain in the separate `winnie-photos` store. Backups have no automatic deletion in this first household release.

## Known limits

- Old entries cannot be attributed to Brandon versus Kim reliably. New entries record both person and device.
- Pending offline actions cannot survive clearing/uninstalling browser storage; request persistence and provide exports.
- Photo collections use optimized JPEG copies (up to 1,800 px). The camera's original remains in the phone's own library when its capture flow saves one there; the web app cannot guarantee OS-library behavior.
- A shared-code holder can pair as either family member; the code is a household invitation, not separate individual account authentication.
- No claim that every historical nap was tracked or that a gap in logging means a gap in care.

Platform references: [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Image CDN](https://docs.netlify.com/build/image-cdn/overview/), [WebKit Home Screen push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
