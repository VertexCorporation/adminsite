# Central legal documents

## Inventory and preservation

The catalog contains **108 product/document/language variants** bound to **110 existing pages**, across 15 document families. Original clauses, language, addresses, and static fallback bodies are preserved. No legal wording has been rewritten or translated as part of this migration. Cortex's copies on cortexite and vertexite have equal normalized text and share a document ID. Other languages remain independent even when their current body happens to be English.

| Area | Documents | Language variants | Bound pages |
| --- | --- | ---: | ---: |
| Vertex | General terms, privacy, team contract, required application doctrine | 64 | 64 |
| Events | Participation/ticket terms, privacy | 32 | 32 |
| Cortex | Product terms, product privacy | 2 | 4 |
| Ally | Product terms, product privacy | 2 | 2 |
| All Star | Product terms, product privacy | 2 | 2 |
| Beacon | Program terms, privacy | 4 | 4 |
| Origin | Program/subscription terms | 2 | 2 |

Scanned repositories: adminsite, vertexite (including every language directory and Origin/Beacon/application extensions), cortexite, allyishere, eventsite, mergenishere, cozmosite, partnersite. The last three have no standalone legal text in their current repositories; mergenishere contains only a landing page and a code LICENSE. Code licenses are not customer legal policies and are not imported. Do not invent product policies for these missing areas. Ally's repository is named allyishere; Mergen's is mergenishere.

`functions/data/legal-documents.json` preserves the imported baseline and source commit/hash provenance. `docs/legal-page-bindings.json` lists every selector, document ID, repository and page. `adminsite/scripts/legal/build-catalog.cjs` regenerates the catalog from sibling checkouts when run from their parent directory; it requires adminsite's pinned jsdom dependency. Review its output before updating the immutable baseline after launch: **version 0 must remain the original launch snapshot**, not be regenerated as a routine deployment step.

## Data and authorization

- Stable ID: `{product}-{kind}--{locale}`. Only catalog IDs are accepted.
- `legalDocuments/{id}`: independent draft, published snapshot, monotonic edit revision, last editor/time.
- `legalDocuments/{id}/versions/{version}`: immutable published HTML, SHA-256, title, author, timestamp and required publication note.
- `legalDocuments/{id}/audit/{revision}`: append-only mutation action, actor, revision, version, hash and restoration source where applicable.
- Missing Firestore state reads the version-0 bundled baseline. No mass migration, credentials, or browser seed write is needed.
- All administration uses `manageLegalDocuments` and the existing live permission resolver on **every call**. `legal.documents` READ permits list/get/history; WRITE permits draft save, publication and restore. Current membership is read server-side; Core retains its canonical administrator bypass. No legacy admin token bypass.
- Draft save, publish and restore run transactions with `expectedRevision`; stale sessions receive `aborted` without overwriting newer edits. Publication increments a separate immutable publication version. Restore creates a draft; it never silently rolls back the public document.
- Legal collections and all nested records deny direct client access. The only public route is `getPublicLegalDocument`, which returns a published snapshot and never draft, audit, publication note, or author identity.
- HTML uses a narrow server sanitizer allowlist. No scripts, inline events, embedded frames, forms, images, external styles, or executable links. Preview is additionally sandboxed with `default-src 'none'`.

## Readers and rollout

1. Merge/deploy Fulcrum's `manageLegalDocuments` and `getPublicLegalDocument` in europe-west1 using the existing explicit selected-functions deployment workflow. Deploy the matching Firestore rules through the existing guarded rules workflow. Do not run a whole-project functions deployment.
2. Verify a known public ID gives schemaVersion 1, version 0 and its expected hash; unknown IDs give 404. Verify unauthenticated administration fails.
3. Publish adminsite and the four reader repositories (vertexite, eventsite, cortexite, allyishere) using their existing static hosting pipelines. Existing document addresses and root language redirects stay in place.
4. Open Legal in Console with `legal.documents` access. Save a draft, check both previews, provide a publication note, and publish. Only the selected language changes. A saved unpublished draft is never public.
5. The shared reader calls the public endpoint with an eight-second timeout; successful reads expose version/hash in `data-legal-version`/`data-legal-hash`. Responses cache for at most 60 seconds with ETags. Pages sanitize the response again before rendering. If the endpoint fails, the original in-page source remains, with an explicit notice that the current text could not be verified.
6. Public scripts are mirrored from `adminsite/scripts/legal/public-reader.js`; keep identical copies in all four sites. The doctrine modal retains its existing scroll element; a successful replacement resets its acceptance checkbox.

Publishing is immediate and per language. No automatic machine translation, future effective-date scheduler, legal review, or historic consent re-acceptance campaign is implied. Existing application/payment consent capture remains owned by those workflows; this feature serves version/hash metadata for a future receipt integration. Already-open documents do not silently change underneath a reader; reload to fetch a later publication.

## Rollback and verification

Use publication history to restore a previous version as a draft, review it, and publish as a new version. Version 0 restores the original imported snapshot. This retains the publication trail. Static reader changes can be reverted independently; their original fallback bodies remain in source.

Offline tests: `node --test functions/test/legal-documents.test.cjs` covers catalog, draft isolation, stale revisions, immutable history, restore, locale isolation, HTML sanitization, authorization gates and public response/ETag behavior. Console tests exercise the actual feature controller and shared public reader with success/failure/session fixtures. Run adminsite's existing syntax, architecture, localization, test, build and release checks before release. Production deployment and authenticated browser smoke checks must be recorded separately from local tests.

## Curia visibility configuration (13 November 2026)

The Legal screen is managed through the standard department permission matrix. The reviewed rollout sets Curia to READ, all other departments to NONE, and preserves Core administrator access. Curia can browse documents, drafts, previews and publication history; mutation controls require WRITE. The live backend checks the same scope for each request. Core can subsequently change these levels from the existing permission editor.

`config/legal-department-access.json` records this narrowly scoped initial intent. A main-branch change to that file applies only `legal.documents`, preserving other grants and configuration fields, checking the current matrix revision and appending an immutable permission audit. Re-running the same policy is a no-op. Deploy `manageLegalDocuments`, `saveDepartmentPermissions` and `restoreDepartmentPermissions` with the matching permission catalog before publishing the updated Console; the latter two must retain delegated Legal grants when a matrix is saved or restored.
