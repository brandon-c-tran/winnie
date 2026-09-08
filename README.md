# Winnie

Shared care and photos for Winnie Bernard. Vanilla JavaScript PWA, Netlify Functions, and Netlify Blobs.

## Develop

Run `npm ci`, then `npm run dev`. Open http://localhost:4173 and use the isolated test code `winnie-local-demo`. Local development uses an in-memory store; it never calls the production data store. `npm test` covers concurrency, migration preservation, offline IndexedDB recovery, photo attachment, and notification retries.

## Project

- `public/`: Today, His story, photo collection, recorded patterns, offline client, and service worker.
- `netlify/lib/`: server-validated commands, conditional storage adapter, authentication, uploads, and push delivery.
- `netlify/functions/`: API, read-only legacy compatibility, scheduled notifications, and backups.
- `tests/`: deterministic store, API, IndexedDB, and history-pattern tests.
- `docs/release-v3.md`: migration, release validation, and recovery procedure.
- `seed/`: frozen historical source imports. Do not edit or re-seed over live history.

## Release

Netlify is linked to the main branch of this repository. Its build runs syntax checks and tests before publishing. Preview hostnames use isolated stores; `winnie-preview-demo` opens an isolated example on a preview deployment.

The legacy data store remains untouched. The first upgraded pairing makes and verifies an immutable backup, then preserves all original event IDs/fields in the new canonical store. Legacy full-array writes are rejected. Existing phones preserve their old local copy and can review differences after reconnecting.

Never roll back to the old writable backend or replace the shared history with a seed. See the release document for the safe recovery procedure.

On each actual phone, choose Brandon or Kim and enable partner notifications. On iPhone, install to the Home Screen first. Push is sent after committed events; the OS controls final display and timing.
