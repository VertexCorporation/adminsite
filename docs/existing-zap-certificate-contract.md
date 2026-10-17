# Existing Vertex Merit Zap: certificate integration audit

Status: local implementation candidate, not deployed or activated. Completed 13 October 2026. Production writes, certificate sends, Zap publication and credential rotation were not performed. Existing unrelated working changes in Fulcrum and vertexite were preserved.

## What was actually inspected

- Fulcrum: `functions/src/certificates.js`, `certificateService.js`, `certificatePolicy.js`, `contributors.js`, `functions/index.js`, `firebase.json`, and certificate tests.
- Adminsite: `js/modules/certificates.js`, `js/lang.js` and existing callable/error handling.
- Vertexite: `verify.html`, `_redirects`, all ten certificate assets, and the published verification page.
- Read-only deployed function metadata for project `vertex-ai-1618`, region `europe-west1`: issuer, callback and verifier. Expansion readiness was false at inspection. The callback binds `ZAPIER_CONTRIBUTOR_CALLBACK_SECRET`. A function's latest revision is not proof of its serving traffic; no traffic or deployment changes were made in this task.
- The existing Zap editor, Zap `371351372`, draft `371601034`, titled **Vertex Merit Certificate**. It was inspected without editing, testing actions or publishing. Copilot's completion messages were not treated as configuration proof.

The editor showed these actual nodes:

| Purpose | Existing step IDs |
| --- | --- |
| Webhooks by Zapier trigger | `371351372` |
| Language split | `parallel_371352830` |
| Turkish condition / CustomJS PDF / Gmail / final callback | `371352832` / `371352833` / `371352867` / `371601033` |
| Other-language condition / CustomJS PDF / Gmail / final callback | `371352834` / `371352835` / `371352888` / `371601034` |
| PDF error callbacks, Turkish / English | `371602654` / `371602658` |

The trigger's displayed label says “New Document Within a Firestore Collection”, but its app is Webhooks by Zapier and the inspected producer sends an HTTP webhook. That label does not establish a separate Firestore trigger. The canvas showed no validation preflight, permanent delivery claim or `proceed === true` filter. The selected English final callback contained `certificateJobId`, `contributorId` and `status: success`; no `attemptId` was visible. This is incompatible with the proposed tenure stage protocol. PDF configuration visibly includes tenure type names, but complete rendered PDFs and actual Gmail behavior were not exercised.

## Actual paths and identifiers

These paths existed in the inspected service before this change:

- `contributors/{contributorId}`: recipient application and legacy `hasVerified`, `emailSent`, `certificateRevoked` flags.
- `certificates/{certificateId}`: certificate operation ledger.
- `certificates/{certificateId}/attempts/{attemptId}`: per-attempt history.
- `contributors/{contributorId}/admissionHistory/{historyId}`: separate audited joining-date changes.
- `config/certificateEligibility`: optional approved tenure policy/rules. Application `createdAt` is not membership `joinedAt`. No tenure thresholds were invented or changed.

Merit identifier: contributor ID. Tenure identifier: `${contributorId}--${certificateType}`. There is one ledger job per contributor/type; retries get a new random UUID attempt, not a second certificate job. The public QR remains `/verify/{certificateId}`. Existing Merit `/verify/{contributorId}` links remain supported. `_redirects` routes `/verify/*` to `/verify` with status 200.

The actual legacy event producer is `toggleContributorVerification`. It retains contributor panel write authorization and a strict admin claim for issue/revoke. Its missing-type fallback is allowed only through the internal `legacyVerification: true` context. Tenure is explicitly rejected on that legacy callable. The generic `issueVertexCertificate` callable now requires an explicit whitelisted type. All certificate administration callables retain admin authorization.

## Field mapping: existing versus candidate

| Preferred field | Existing service field | Local tenure candidate |
| --- | --- | --- |
| `eventKind` | none | `tenure_certificate_issuance`; required for tenure |
| `certificateType` | `payload.certificateType` | exact four-type whitelist; no blank fallback |
| `certificateJobId` | ledger document ID; issue response `id`; webhook `issuanceId` / `id` | same real ledger ID, canonical primary key |
| `contributorId` | `job.contributorId`, `payload.contributorId` | unchanged; additional callback context |
| `recipientName` | `contributors.name` → `payload.name` | canonical recipient name, with `name` compatibility alias |
| `recipientEmail` | `contributors.email` → `payload.email` | canonical recipient email, with `email` compatibility alias |
| `language` | `contributors.language`, payload language | tenure normalized to `tr` or `en`; legacy language behavior preserved |
| `issuedAt` | job `createdAt` was server timestamp; legacy `formattedDate` came from application creation | first backend-controlled issue time, ISO UTC in payload and Timestamp in ledger; reused on retry |
| `verificationId` | certificate ledger ID embedded in URL | equal to `certificateJobId` |
| `verificationUrl` | `https://vertexishere.com/verify/{id}` | same route with actual tenure ID |
| `attemptId` | UUID sent with webhook and stored in ledger/attempt | still required for every new tenure callback and Gmail claim |
| `backgroundUrl` | policy type/language asset mapping | same mapping, strictly checked against type/language |
| `formattedDate` | legacy application date formatted in local language timezone | tenure issuance date, day/month/year; never substituted with joining date |
| `contractVersion` | none | `vertex-tenure-v2` |
| `eventSignature` | none | HMAC-SHA256 of the ordered canonical field array; backend-only signing secret |

Tenure events omit legacy phone, age, department and interview details. Legacy payload shape/date remains compatible. No real recipient payload or credentials are included in this report.

## Callback and operation semantics

Existing authentication was a constant-time comparison of body `secret` with a Secret Manager value. The local candidate additionally accepts `Authorization: Bearer`, retaining body authentication for existing callbacks. An incorrect bearer header cannot be rescued by a valid body secret. POST is required; unauthenticated calls stop before database work.

Existing legacy callback: `{contributorId, issuanceId?, attemptId?, status: "success" | "failed", deliveryNotSent?}`. Existing first-Merit uncorrelated callbacks and legacy probes retain their behavior. A tenure job cannot be updated with this legacy success callback. New marker fields, even blank or malformed, never fall through to Merit.

New authenticated actions on the **same callback endpoint**:

1. `validateEvent`: body `{action:"validateEvent", event:<complete tenure trigger object>}`. Server verifies its HMAC and matches every signed field against the stored, active job and attempt. Read-only; returns routing identifiers, not recipient data. The Zap does not need the signing secret.
2. `validateLegacyEvent`: body `{action:"validateLegacyEvent", event:<original legacy trigger object>}`. Server requires an active Merit dispatch and its actual attempt/payload. A missing `certificateType` may normalize to Merit only after this validation. Incomplete tenure markers, forged recipients and unrelated events reject. Historical pre-ledger runs lacking an attempt cannot be proven by this new guard: preserve their existing callback compatibility, hold any such queued unsent runs for reconciliation during migration, and do not manufacture correlation or automatically resend them.
3. `claimDelivery`: tenure body `{action:"claimDelivery", certificateJobId, contributorId, attemptId}`; legacy uses existing `issuanceId`, `contributorId`, `attemptId`. Transaction sets the permanent `deliveryClaimedAttempt` once. Only the response `proceed: true` permits a Gmail action. Missing/ambiguous claim responses must stop the Zap; replays return false.

Tenure stage callbacks use `{certificateJobId, contributorId?, certificateType?, attemptId, status, deliveryNotSent?}`. Type/context, when supplied, must match the stored job.

| Stage | Preconditions / recorded result |
| --- | --- |
| `pdf_generated` | active dispatch before Gmail claim; sets `pdfStatus: generated` |
| `pdf_failed` | before claim/PDF completion; records failed/PDF stage; explicit retry only if `deliveryNotSent: true` |
| `gmail_submitted` | generated PDF and matching permanent claim; records **submitted**, not delivered |
| `gmail_failed` | records uncertain/Gmail failure; never assumes mail was not sent |
| `uncertain` | records unresolved external outcome; blocks resend |

The previous ledger lifecycle was `pending → processing → succeeded/failed/uncertain/revoked`. Tenure now uses `submitted` instead of legacy `succeeded` for Gmail acknowledgement and adds `stage`, `pdfStatus`, `deliveryStatus`, `lastCallbackStatus`, `lastCallbackAttemptId`, `failureStage`, `submittedAt`. Legacy semantics and flags are retained; tenure never toggles contributor `hasVerified` or `emailSent`.

Exact duplicate stage callbacks on the same attempt are acknowledged without processing again. Stale attempts, invalid transitions and revoked operations reject. A late correlated Gmail acknowledgement may reconcile an uncertain job without performing another send. No network/trigger/Gmail ambiguity is automatically retried. A safe PDF retry resets stage bookkeeping and retains the certificate identifier and original issuance date.

## Verification and published-site discrepancy

At public GET inspection, the published `/verify.html` and `/verify/{id}` pages still used direct contributor Firestore lookup. The local working copy already had a restricted verifier integration; it has now been hardened further. This report does not claim that candidate is published.

The candidate page reads only `verifyVertexCertificate?id=...`. The backend response is limited to validity, certificate ID, recipient name, language, type, date, revocation and submission status. It never returns email, phone, application/interview data, callback credentials or attempt details. Public users get no access to the private certificate collection. Unknown types cannot silently display Merit. Certificate identity is visible; revoked results get a localized TR/EN screen. Long IDs wrap on mobile. The HTML language is updated for correct Turkish casing.

Tenure verification accepts a completed `submitted` job as an authentic issued certificate; that validity is independent of confirmed email delivery. Existing successful Merit ledger and legacy contributor QR verification remain compatible. Revoked jobs return `{valid:false, revoked:true, certificateId}` without recipient details.

## Assets and activation blocker

All ten public GETs returned 200 `image/webp`; SHA-256 comparisons matched the corresponding local files. Tenure assets are 3510×2482, Merit assets 2000×1414. The mapping is:

| Type | English asset | Turkish asset |
| --- | --- | --- |
| merit | merit.webp | liyakat.webp |
| tenacity | tenacity.webp | dirayet.webp |
| constancy | constancy.webp | metanet.webp |
| majesty | majesty.webp | asalet.webp |
| nobility | nobility.webp | azamet.webp |

The original expansion blocker was `(type !== "merit" || retry) && CERTIFICATE_EXPANSION_READY !== "true"`, with the message “Expanded issuance awaits certificate assets and verified Zapier configuration.” It did not automatically inspect assets or prove Zap configuration. The structured admin message in the inspected work retained the same readiness condition.

The candidate keeps expansion disabled unless readiness is true **and** `CERTIFICATE_ZAPIER_CONTRACT_VERSION` exactly acknowledges `vertex-tenure-v2`. It additionally validates the configured existing catch-hook URL and signing secret before job creation. Neither flag was set, and no acknowledgement was fabricated. URL validation restricts HTTPS to the existing Zapier catch-hook service. These checks do not establish that the Zap draft actually works; the external workflow must still pass the approval/release checklist below.

Existing secret: `ZAPIER_CONTRIBUTOR_CALLBACK_SECRET`. Candidate new bindings, **not provisioned**:

- `ZAPIER_CONTRIBUTOR_WEBHOOK_URL`: move the same existing catch-hook URL into Secret Manager; no second Zap or replacement trigger.
- `ZAPIER_CERTIFICATE_EVENT_SIGNING_SECRET`: backend-only event signing and validation secret, at least 32 characters. Never put it in Zap sample data, a Code step input, frontend or Git.

Do not deploy these new bindings until their approved secret configuration exists. This includes the legacy toggle, which must retain the same destination during the coordinated deployment.

## Required Zapier Copilot draft changes

Modify the existing draft only. Do not publish, run a live Gmail test, create a second Zap, or use real recipient sample data.

1. Insert strict routing ahead of the existing TR/other-language paths. Exact `eventKind: tenure_certificate_issuance` requires the complete signed contract and one of the four supported types. Missing/unknown/blank markers reject. Genuine legacy events may omit type only after `validateLegacyEvent` succeeds. Never use `certificateType || "merit"` for arbitrary input.
2. For tenure, POST the untouched trigger object to authenticated `validateEvent`; filter on HTTP success and `valid === true` before PDF generation. Keep signing credentials exclusively on the backend. For legacy, use `validateLegacyEvent` and retain the original Merit recipient/date/template behavior. Keep both operations in this Zap and the existing language branches.
3. Turkish PDF `371352833` and English PDF `371352835`: bind the validated type/language background, `recipientName` (legacy `name`), issuance `formattedDate` (legacy original date), and exact `verificationUrl` for QR. HTML-escape names and other interpolated content; never inject an unvalidated URL. Use the appropriate page geometry for 3510×2482 tenure versus 2000×1414 Merit assets. All eight tenure PDF renders need actual draft/mock inspection: name, date, QR placement/readability, page count and scale. This has not been completed by backend mocks.
4. Immediately after tenure PDF completion, send correlated `pdf_generated`. PDF error steps `371602654` / `371602658` must send `pdf_failed` with `deliveryNotSent: true` only when Gmail has not been attempted. Retain original legacy failure callbacks on their own branch.
5. Before Gmail `371352867` / `371352888`, obtain the permanent `claimDelivery` and require `proceed === true`. A false, failed or missing result must halt. Disable automatic replay/retry of Gmail or the entire run after a claim. A cached earlier `proceed:true` must never authorize a replayed Gmail step; replay policy is part of the release check, not solved by the claim endpoint alone.
6. Map tenure Gmail recipient to `recipientEmail`, attach the generated PDF and use the correct TR/EN certificate title/body. Do not send the legacy contributor welcome message for tenure. Preserve legacy welcome behavior in its own mode.
7. Final callbacks `371601033` / `371601034`: tenure sends the actual `certificateJobId`, `contributorId`, `attemptId`, and `status: gmail_submitted`. The current `status: success` tenure draft is insufficient. Do not label Gmail acknowledgement as delivery confirmation. Legacy retains `status: success` and its existing identifiers.
8. Explicit Gmail error handling must use `gmail_failed`; timeout/unknown external results must use `uncertain` and require reconciliation. Do not mark them safe to resend, and do not rollback contributor verification from a tenure error. Keep failure handlers separate from legacy handlers.
9. Every new validation, claim and callback uses the approved rotated callback credential through secure configuration and preferably the bearer header. Do not output the credential in Code results, shared responses or samples. Do not change it until the coordinated rotation is approved.

## Credential rotation plan — approval required

The reported shared-response exposure is sufficient to treat the existing callback credential as compromised. It was not read or changed during this audit. Do not quote or paste it again.

1. Obtain explicit approval for rotation and a coordinated Zap/backend maintenance window. Inventory every callback, error handler and future validation/claim consumer, including both language branches. Snapshot current serving revisions/traffic and the published Zap version without copying secrets into reports.
2. Quiesce new certificate requests and stop/reconcile queued or replayable mail runs. Identify already-claimed operations; do not retry them. Secret rotation alone must not cause Gmail replay.
3. Generate and store a replacement as a new Secret Manager version of the existing callback secret using secure administrative tooling. Prepare the same existing webhook URL binding and a separate backend signing secret. Do not put values in commits, shell arguments, screenshots or frontend code. If a browser credential form is used, its entry/submission must be completed by the user.
4. Coordinate the restricted callback deployment with both language success/error/validation/claim credential updates. Prefer a brief controlled pause over extending trust in the exposed value. No dual-credential grace period was implemented in this candidate; do not assume both versions will work.
5. Verify accepted new authentication and rejected old/incorrect authentication in isolated tests first; then approved non-delivery checks only. Resume workflow only after the entire contract is compatible. Disable the compromised secret version after all consumers are migrated and queued runs reconciled. Retain rollback code/traffic, but do not restore a compromised credential.
6. Remove exposed values from shared responses and sample/task data under an approved cleanup plan. Restrict log access and preserve only sanitized incident evidence. No production credential or sharing change was performed here.

## Test evidence and limitations

- **49 backend tests passed**: existing Merit compatibility and legacy blank-type validation; four tenure types × TR/EN; canonical signing and tampering; unknown/missing/hostile fields; authorization; callback HTTP errors; secret configuration; concurrent repeated issue; duplicate claims/stages; PDF failures; explicit safe retry and stale attempts; Gmail failure/timeout; no resend after external claim; late reconciliation; revoked verification; no private fields in public response.
- **12 admin unit/i18n tests passed**, including dictionary parity and literal key coverage. The candidate adds “Submitted to the email service; delivery unconfirmed” in both languages.
- **40 Chromium and 40 WebKit isolated browser cases**: desktop/mobile, TR/EN, legacy Merit and all tenure types, visible ID/type/date, invalid/revoked/unknown/malformed responses and network failure. All requests are locally fulfilled; no Firestore browser requests. Final mobile screenshot was inspected after its opening animation.
- Syntax checked for each changed backend module. Ten public asset GET/hash checks passed.

Reproduction:

```sh
cd /Users/baba/Documents/Fulcrum
node --test functions/test/certificate*.test.js functions/certificate-recovery.test.js
cd /Users/baba/Documents/adminsite
node --test tests/*.test.cjs
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tests/certificate-verification.cjs
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/vertex-playwright VERTEX_BROWSER=webkit node tests/certificate-verification.cjs
```

These are mocks/transaction fixtures, not a running Firestore emulator, live CustomJS PDF rendering or Gmail/Zap delivery tests. The changed functions have not been deployed. No full unrelated Fulcrum test suite is claimed. The immutable admin release snapshot has not been rebuilt or published with the new submitted label. Zap settings were inspected, not updated.

## Approval and release requirements

Before enabling expanded issuance: approve credential rotation and new secret bindings; update the existing Zap draft guards, correlation, claim/replay policy and stage callbacks; verify eight actual PDF outputs with dummy recipients and mock Gmail/callback targets; complete full isolated end-to-end test evidence; publish the restricted verification page; verify endpoint availability/CORS and legacy QR behavior; snapshot rollback revisions/traffic; deploy only the changed functions individually in project `vertex-ai-1618`, codebase `default`; build/test the admin candidate; then approve Zap publication and the exact version/readiness acknowledgement. Never set readiness merely because assets are present or Copilot says “ready”.

Affected function names for an approved targeted release: `issueVertexCertificate`, `toggleContributorVerification`, `zapierContributorCallback`, `verifyVertexCertificate`. Use `firebase deploy --only functions:FUNCTION_NAME --project vertex-ai-1618` one function at a time after checking the codebase selector. Do not deploy all Functions. No IAM, Firestore security rule, production contributor data, eligibility policy, unrelated service or Worker changes are needed for this candidate.

Production remains intentionally unactivated pending those explicit approvals and external workflow evidence.

## Subsequent PDF/Copilot handoff correction

See `zapier-copilot-handoff.md` for the current handoff. The user's explicit geometry requirement supersedes the earlier suggestion of separate tenure page dimensions: preserve the v12 2000×1414 canvas, Ubuntu Bold and existing name/date/QR coordinates for all ten combinations. `371601034` is the selected English callback step ID, not a proven draft-version ID.

Ten resolved-template local PDF renders now pass JavaScript-disabled page/font/name/date/QR checks. Dark Majesty/EN and Majesty/TR assets require white name/date text for contrast. The owner has clarified recognition-level pairing; Majesty=Asalet/12 months and Nobility=Azamet/6 months. Artwork is correct and unchanged; the earlier mismatch diagnosis is withdrawn. The existing Zap's actual CustomJS outputs have not been safely rerun, and the draft still requires script-free PDF preparation and callback/claim corrections. Previous backend, admin and browser test evidence remains preserved.


## Owner policy correction and migration hold

Authoritative recognition levels: tenacity Dirayet/Tenacity 1 month; constancy Metanet/Constancy 3 months; nobility Azamet/Nobility 6 months; majesty Asalet/Majesty 12 months. Corrected software and new v2 signatures use this mapping. Original v1 signatures are still verified with their historical asset mapping; old records are displayed from the stored artifact and never silently rewritten/retried. Existing approved minimumDays policies were not altered. Live old-record/policy inspection remains unverified because CLI authentication requires renewal. See the current handoff for release and migration safeguards.
