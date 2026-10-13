# Winnie: proposed backend reliability scope

Status: proposal, September 7, 2026. This document specifies work to support the [product north star](product-north-star.md); it does not describe an implemented backend, completed migration, or deployed notification system.

## Recommendation and purpose

Keep the Netlify frontend and, by default, Netlify Blobs. Replace phone-owned whole-dataset writes with server-validated commands and an atomic household commit. This is enough to pursue reliable two-phone care tracking without automatically adding a database service.

The product promise is simple: a care action stays saved, both people see the same history, corrections survive, and the other person can receive a notification after the shared record is committed. Optimistic UI and Winnie's expressive response should remain immediate, while the interface accurately distinguishes a pending local action from shared success.

The default architecture is conditional on verifying a suitable Blobs SDK and its failure handling. If that gate cannot be met cleanly, use the Postgres fallback below. None of these changes should be deployed or applied to production merely by adopting this proposal.

## Evidence and current behavior

The prior isolated browser walkthrough **confirmed a lost correction across two simulated clients**: A corrected an existing entry and saw successful synchronization; B then added a different entry from its older local copy; after A refreshed, A's correction had disappeared. This was not a test on two physical phones or evidence about how often it has happened in production.

The same walkthrough confirmed that changing the shared code could copy the old local log into the new destination. Historical events do not have trustworthy Brandon/Kim or device attribution; migration must not invent it.

Current code explains the lost-edit result:

- [data.mjs](../netlify/functions/data.mjs) accepts a full `events` array and unconditionally replaces the stored array. It already uses **strong reads**; changing read consistency alone will not fix the write race.
- [app.js](../public/app.js) sends that array on save. Its remote merge keeps remote records for existing IDs and treats local-only IDs as pending additions, without a durable per-operation record or deletion marker.
- The shared-log cache is not scoped to the selected household. The service worker in [sw.js](../public/sw.js) caches application assets first and bypasses the current function routes.

**Code-supported hazards, not separately reproduced in the walkthrough:** a stale client can reintroduce a deleted record; diagnostic writes can restore an older snapshot over intervening work; overlapping sleep creation can bypass a local guard; an older cached application can continue issuing the unsafe protocol after a frontend deployment. The release tests below must exercise these explicitly.

## Current platform capabilities and implementation gate

Netlify documents atomic conditional writes through `onlyIfMatch` and `onlyIfNew`, ETags from `getWithMetadata`, and configurable strong reads. Unconditional writes remain last-write-wins. Site-wide Blobs stores are shared across deploy contexts, so a preview must use an explicitly isolated store. [Netlify Blobs documentation](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)

The current dependency is `@netlify/blobs: ^8.1.0`. Current documentation is not proof that the installed SDK has the same API or behavior. Before implementation is accepted, resolve and pin a tested version, verify conditional success/conflict/error semantics, and prove the store adapter with injected failures.

As of this review, Netlify's official repository has an **open report** that some conditional-write SDK paths report success on non-412 server errors, plus an open proposed fix. This is an upstream report, not a Winnie reproduction, and not a claim that every SDK version is affected. Inspect the selected version and test this case directly; do not treat a reported success with missing evidence as durable commitment. [Issue #741](https://github.com/netlify/primitives/issues/741), [proposed fix #756](https://github.com/netlify/primitives/pull/756)

Gate: either select a version whose behavior passes these tests, adopt a narrowly reviewed fix that passes them, or select the transactional Postgres alternative. A library upgrade alone is not a completed reliability fix.

## Proposed data boundary

Use one private household document as the atomic boundary. The document is server-owned; a browser submits a command, never a replacement document. A suggested logical shape is:

```text
Household
  schemaVersion, protocolVersion, householdId
  publicRevision
  people, pairedDevices
  eventsById
  mutationReceiptsByOperationId
  notificationJobsById
  notificationSubscriptions
```

Each event has a stable ID; a server-incremented revision; its occurrence time; server creation/update times; event-type-specific fields; creator and last-editor person/device IDs; and a deletion timestamp when removed. Preserve legacy IDs, source fields, original times, and an explicit unknown/shared creator for older records. Separate who logged an event from who performed the care.

Each receipt records the operation ID, request digest, authenticated device, committed result and event revision. Reusing an operation ID with different content is rejected. Each notification job identifies its originating committed action, intended recipient, attempts, next retry time, delivery status, and any temporary worker lease.

The public snapshot exposes only the household's displayable data and public revision. It must not expose device credentials, push endpoints, receipts, or internal queue state. Advancing an internal queue lease need not advance the public event revision.

Initially retain tombstones and idempotency receipts rather than guessing that a phone is no longer offline. If storage later requires compaction, first define device retirement and an accepted replay boundary; a client older than that boundary must reconcile and resnapshot. Do not silently replay it against pruned history.

## Proposed command and commit protocol

Commands include create, edit, delete, restore where explicitly supported, start/end sleep, and start/end outing if that feature ships. A paired bathroom action can be a single command creating linked records atomically. Exact command names and version numbers are implementation choices.

Each request carries a unique `operationId`, protocol version, stable event ID(s), intended payload, and expected event revision for modifications. Occurrence time is user-entered data; device clocks are not used to decide which concurrent edit wins. The server obtains household and actor identity from the authenticated device session.

For each command:

1. Authenticate and authorize the household/device; validate shape, type-specific fields, and time ranges.
2. Strongly read the household with its ETag. If the operation receipt already exists and matches the request, return its recorded result.
3. Check expected event revisions and household invariants, including any active-sleep rule. Apply the command to this current server state.
4. In the same proposed document, save the changed event(s), receipt, and eligible notification intent. Advance the public revision for visible changes.
5. Conditionally write with `onlyIfMatch`; use `onlyIfNew` for explicit household creation. Only an established successful commit permits a success receipt.
6. On a compare-and-swap conflict, reread and reevaluate the same command with bounded retries and jitter. On exhaustion or transport failure, return a retryable result without discarding the device's command.
7. Return the canonical changed record and receipt after commitment, then trigger notification processing. An uncertain response is retried with the original operation ID.

This makes the event, deduplication receipt, and notification intent atomic **within one document**. It does not claim Blobs provides multi-key transactions. Worker lease/status changes also use conditional writes and must preserve intervening care actions.

### Conflicts, deletion, and Undo

- Concurrent changes to different events survive automatically because each command applies to current server state.
- A stale edit of the same event returns a conflict containing the current revision; preserve the user's pending edit. Show a concise comparison such as “Kim changed this entry” and an explicit choice. Do not silently overwrite either edit or add a complex general-purpose CRDT in the first release.
- Deletion writes a tombstone. A stale edit cannot turn it back into a live entry. Restoration, if supported, is a separate deliberate command against the current deleted revision.
- Undo before transmission may cancel a queued create. Undo after a confirmed commit is a compensating command with version checks. If a write is in flight, first resolve its receipt; do not pretend cancellation proves the server did nothing.
- A local create followed by an edit/delete must preserve command ordering and use the acknowledged revision before dispatching dependent commands. Unrelated queued events need not be blocked by one event's unresolved conflict.

## Proposed phone behavior and identity

Use IndexedDB for a household-scoped canonical cache and a durable outbox. Save the optimistic local change and its queued command in one local transaction. Apply a fresh server snapshot, then replay unresolved local commands to build the visible view; do not union arbitrary cached arrays by ID.

Retry on launch, reconnect, foregrounding, and explicit retry, with backoff and bounded work per attempt. Fetch canonical state on those same transitions, after mutations, and periodically while visible. At this dataset size, a conditional snapshot is an acceptable starting point; streaming and a full change-feed system are optional later work.

Show pending, conflict, and server-confirmed states accurately. A confirmed server write does not prove Kim's phone has refreshed or displayed its notification. Keep the chosen day, open record, and scroll position stable as new data arrives.

Pair a device to the household using an invitation, choose Brandon or Kim, and issue a revocable server-recognized device credential. Keep `personId` distinct from `deviceId` so one person's laptop and phone do not count as two people. A display-name choice alone is not authentication. Define recovery/re-pairing and device removal without requiring a full account platform unless the product expands.

Joining another household selects a different cache and outbox. It never copies records implicitly. Preserve pending work in its original household when switching.

Browser storage is subject to platform limits, removal, and device loss. Request persistence where supported and handle failures visibly; do not promise that an uncommitted offline record survives uninstalling or clearing the app. The product must not depend on reliable background execution while an OS has suspended it.

## Proposed partner notification delivery

Each eligible committed new care action creates a job for the other person's subscribed devices. Do not replace the user's per-action requirement with a digest. Exclude the actor's person ID, not only the originating device. Historical imports, migration replay, and diagnostic activity must never generate partner-care pushes.

Create notification intent in the atomic commit, then use a retryable dispatcher to send it. Trigger dispatch promptly and run a scheduled recovery sweep so a crash between commit and dispatch does not strand a job. Do not rely on an unawaited promise continuing after a function returns. Workers acquire expiring leases with conditional writes; completion and retries also preserve current household state.

Netlify Async Workloads provides retryable durable execution and is one possible dispatcher, but requires an extension and consumes underlying resources. Choose it only if it simplifies this small system; a scoped dispatcher plus scheduled recovery is also a candidate. [Async Workloads documentation](https://docs.netlify.com/build/async-workloads/overview/)

Deduplicate job creation by committed action and recipient. Use stable notification identifiers and replacement/grouping behavior where supported. However, a push accepted by a provider followed by a worker crash creates an uncertain delivery outcome: retrying can duplicate a delivery attempt. The contract is **durable notification intent and retryable, potentially repeated delivery attempts**, not guaranteed exactly-once OS presentation or proof the person read it. Do not retry permanent expired/revoked subscriptions forever.

Copy should describe the logged fact and its occurrence time: “Kim logged a meal · 7:30am.” Late offline records must not appear to have happened just now. Tapping opens the exact record and refreshes its current state. Push is an awareness aid, not the source of truth or a replacement for foreground synchronization.

Before building, specify how ordinary edits, Undo, deletion, sleep/outing start and finish, and old backfilled records affect notifications. Prefer updating the current in-app truth and avoiding duplicate “new event” alerts for corrections. An already delivered notification may remain stale until the person opens it; make no unsupported promise that it can always be recalled.

Installation and permission must be tested on both actual phones. On iOS/iPadOS, WebKit documents Web Push for Home Screen web apps from 16.4 and permission requests tied to direct user interaction. Keep OS consent explicit and preferences under each person's control. [WebKit Web Push documentation](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## Proposed cutover and reconciliation

This is a controlled two-phone migration even if storage remains Blobs. Plan it with both devices available; an older cached app is a writer until the server proves otherwise.

1. Export immutable raw server data and both phones' local data before altering caches or switching the protocol. Record export time, source, ID set, count, and content checksums. Keep ambiguous variants for review.
2. Reconcile server and device-only records in an isolated store. Preserve IDs and provenance. Missing IDs are not proof of deletion, and old modified timestamps are not proof that one conflicting version is correct. Produce a short review of ambiguous differences rather than applying an unqualified union.
3. Rehearse migration and restore in isolation. Verify ID sets and canonical fields, not just record counts. Separate invalid historical durations from migration mechanics; flag them for correction rather than inventing replacements.
4. Arrange a brief coordinated cutover. Export any final pending local state, drain known old writes where safe, block the legacy full-array `PUT` path on the server, and take a final server snapshot before converting authoritative state. Do not enable two competing write protocols.
5. Publish the new protocol and an intentional service-worker update. Cover legacy cache names, cache-first HTML/JavaScript, existing open tabs, controller changes, and app restarts. Bypass caching for every new API route, not just today's function path. Preserve queued local data while requesting a reload.
6. Pair and upgrade both phones, import/reconcile their preserved pending changes explicitly, and verify they cannot issue an accepted whole-dataset replacement. A stale client's refused write must not be presented as shared success; server rejection is necessary even if that client cannot show the new update message.
7. Perform the two-phone acceptance walkthrough and verify notification routing. Keep original exports and the old server snapshot as recovery sources, with migration version and audit results recorded.

Do not blindly restore an old snapshot after new activity has started: it would discard subsequent care. A rollback must preserve/replay new accepted commands or use an explicit reconciliation window. Keep the command endpoint compatible with the last supported client during a UI rollback; publishing an old frontend is not a reason to reopen unsafe writes.

Backups need their own policy: create periodic immutable exports to storage separate from the mutable household key, document retention, and rehearse recovery. A backup in another key on the same service helps with application mistakes but is not independent protection from all account/service failures. Do not delete the original migration evidence as part of this release.

## Bounded implementation phases

| Phase | Deliverable | Exit condition |
|---|---|---|
| 1. Protocol and adapter | Validated commands, event revisions, receipts, tombstones, conditional store adapter, isolated fixtures | Concurrency, duplicate replay, and injected error tests pass against the selected SDK |
| 2. Two-phone client | IndexedDB cache/outbox, accurate save states, person/device pairing, lifecycle refresh, conflict/Undo flows | Offline and two-client tests preserve every accepted change; no whole-array client writes remain |
| 3. Shared-awareness slice | Atomic notification intent, dispatcher/recovery, permission/subscription flow, exact-entry links | Recipient/deduplication/retry tests pass; both actual phone setups are verified |
| 4. Cutover and recovery | Reconciled exports, legacy writer block, service-worker transition, backup/restore rehearsal | Both devices run the supported protocol; stale clients cannot corrupt it; production verification is complete |

Keep these boundaries small enough to review. Product prototype work can continue in parallel, but the production expressive response and push flow must use the real confirmed/pending states. Photos, story composition, prediction, multi-household administration, and a general analytics platform are outside this reliability slice.

## Meaningful release tests

Run deterministic protocol tests plus a small two-client integration suite. Then use the actual phones for OS-specific lifecycle and notification checks. Proposed acceptance criteria:

- A edits X while B creates Y: both survive on both clients. Two independent creates also survive concurrent commits.
- A and B edit the same revision: one succeeds, the other retains a reviewable conflict; neither silently overwrites the other.
- Edit versus deletion, stale-client refresh, and a long-offline client cannot resurrect a tombstone.
- Two simultaneous sleep starts cannot create two active sleeps; start/end and linked actions preserve their invariants under retry.
- A command commits but its HTTP response is lost: retry returns the original receipt, creates no second event, and creates no second notification intent. Reusing its ID with different content fails.
- Inject conflict responses, timeout, 500/503, malformed responses, and lost connection before/after commit. No false shared-success state; uncertain commands remain retryable.
- Offline create, edit, and Undo survive reload/app termination when local persistence succeeds. Reconnect replays dependencies correctly and preserves unrelated remote changes.
- Worker failure before sending, after sending, and before saving job completion is recoverable without losing notification intent. Duplicate attempts are handled as an expected uncertainty, not claimed impossible.
- The other person receives eligible notifications; the actor's other devices do not. Permission denial, revoked subscriptions, late records, correction links, and unsupported/suspended contexts behave honestly.
- An old service worker/open tab cannot overwrite the new data. New API requests are never answered from an obsolete application cache.
- Switching households, re-pairing, or revoking a device cannot mix caches, replay commands into the wrong household, or expose another household's data.
- Migration preserves IDs and reviewed field values; recovery rehearsal retains new post-cutover activity. Diagnostics use isolated records/store and cannot restore the care dataset.

Record commit failures, conflict counts, pending-command age, retry counts, and notification-queue age with minimal identifiers. These are operational evidence for reliability, separate from product metrics such as unaided learning and delight. Never log device credentials or push subscription secrets.

## Postgres fallback and later option

Netlify Database is now managed Postgres with integrated development and preview branching. It can be accessed using Postgres-compatible drivers. It is available on credit-based plans, with compute/bandwidth usage and plan-specific limits. Confirm this account's actual eligibility and current terms; do not assume the migration is free or necessary. [Database overview](https://docs.netlify.com/build/data-and-storage/netlify-database/), [tooling](https://docs.netlify.com/build/data-and-storage/netlify-database/tooling/), [billing and limits](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/)

Postgres would put events, mutation receipts, and notification jobs in separate tables, committed in one transaction. Unique constraints, conditional revision updates, and transactional job claiming can replace parts of the custom aggregate logic. It becomes attractive if the verified Blobs adapter is not a clean option, the household document becomes cumbersome, or multiple households, more relationships, richer querying, or independently active workers materially expand the product.

That benefit comes with schema migration, connection/runtime configuration, another resource to operate, and billing considerations. It does not remove the need for the phone outbox, identity, conflict rules, legacy-client cutover, or realistic push guarantees. Keep the command contract independent of the store so this choice can change without redesigning the product again.

Netlify documents daily/on-publish database backups with plan-dependent retention. A frontend deploy rollback does not automatically restore the database, and restoring an older backup can discard later activity. The reconciliation/recovery discipline still applies. [Database backup and recovery](https://docs.netlify.com/build/data-and-storage/netlify-database/backup-and-recovery/)

## Decisions to confirm before implementation

- Actual OS versions, browser/Home Screen installation, and number of active devices for each person.
- Notification semantics for corrections, Undo, start/finish actions, backfilling, and long-delayed offline events.
- Availability of both phones and preserved local caches for the cutover; treatment of ambiguous historical conflicts.
- Device pairing/recovery behavior, supported offline/replay window, and backup retention.
- The tested Blobs SDK/fix, or an explicit decision to use Postgres after checking the account and operational tradeoffs.

These decisions refine implementation scope. They do not require adding infrastructure to the everyday interface or delaying the independent product design work.
