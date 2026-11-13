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


## Lawyer-oriented workspace (13 November 2026)

The catalog groups the 108 imported locale records into 15 stable document families. Language records keep their existing public IDs and independent revision/publication histories. All 16 supported languages are selectable; a missing locale is shown as an automatic, unpublished preview. The console locale is the default, and the document's language selector selects an independent variant.

`manageLegalDocuments` now offers a field-projected `catalog` workspace response, including the initially selected document in one request. Full bodies are fetched only for the selected variant; history loads when expanded. A session-scoped 30-second detail cache avoids repeated navigation requests. Shimmer covers list/detail fetches, history, mutations and translations; late responses cannot restore data after session reset.

The editor accepts Markdown, with an offline, pinned markdown-it browser bundle for live preview. Server Markdown rendering disables raw HTML and images, then passes through the existing HTML allowlist. Imported HTML is converted by Turndown with GFM support. All 108 baseline texts are checked for text preservation through the complete conversion. Existing HTML API clients remain supported. Public pages continue receiving sanitized published HTML only.

`translateLegalDocument` follows the chef biography translator's Google Cloud Translation v3 / ADC approach. It accepts catalog IDs and stored revisions, never arbitrary user-supplied text or destinations. READ permits an ephemeral translation preview; WRITE is mandatory for persisted translated drafts. Saving a source automatically updates the other languages when the default checkbox is enabled; the separate update button retries remaining translations. Existing manual drafts and published manual variants are protected, current source-hash translations are skipped, and machine output never publishes automatically.

A request has 1–15 distinct targets, at most four provider requests in flight, a shared 45-second provider abort signal, a 60-second server deadline and a 120-second client deadline. Long HTML is split at DOM boundaries. Every output is sanitized, converted through the editor's Markdown renderer, size-validated and checked for unchanged legal URLs. Partial failures retain successful drafts. Source/target revisions and source hashes are rechecked transactionally; current panel authorization is rechecked after the provider call. Every persisted translation creates an immutable audit entry with source provenance. No source text, provider tokens or credentials are logged.

Separate transactional budgets use Europe/Istanbul days: per user 5 batches/minute, 25/day and 600,000 input code points/day; globally 100 batches/day and 2,000,000 code points/day. Accepted attempts consume budget even on provider failure. Quota documents have no client write path. No changes to biography quotas or deployment are required.

Deploy only `manageLegalDocuments`, `getPublicLegalDocument` and `translateLegalDocument` through the selected-functions workflow, then deploy the console. Curia READ / Core WRITE remains unchanged. No existing policy is automatically published or rewritten by this rollout. Existing published language baselines appear immediately; missing locale previews are translated on demand, and full translation refreshes happen after saving a source.


## Sensitive-area refinement (14 November 2026)

Legal visibility now has an explicit Curia/Core membership boundary in both the runtime permission resolver and the console. Matrix wildcards, presets and permission-history restoration cannot grant this area to other departments. Curia retains configurable READ/WRITE within that boundary; live Core keeps administrative authority. Deploy manageLegalDocuments, translateLegalDocument, saveDepartmentPermissions and restoreDepartmentPermissions for the gate and normalization change. Existing direct Firestore legal-document access stays denied.

The editor selects the requested document immediately, permits a newer read selection while an older read is pending, and rejects stale responses. The shared read cache deduplicates concurrent requests, retains at most 32 records for two minutes, uses session-specific keys and clears on logout/access changes and mutations. No persistent browser storage is used. History and read-only translation previews participate in the cache. Refresh bypasses it.

Document/product labels use a vertical bar. The machine-preview status is plain text without a pill border. Disclosure arrows and body heights animate together, including a resize observer for asynchronously arriving history content. Preview switching uses sandboxed iframe double buffering so the old content remains visible until the new preview has loaded, then crossfades. Rapid transitions and logout cancel pending preview layers. Published history cards expose confirmed restore-as-draft actions for editors; restore does not publish automatically.
