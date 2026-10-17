# Vertex Merit Certificate v12 — same-Zap draft integration contract

## Scope and safety

Preserve published v12 of **Vertex Merit Certificate**, Zap `371351372`. Update only its existing draft; do not create another Zap. This contract describes verified **local backend candidate code**, not an already deployed API upgrade. Do not publish, deploy, push, rotate credentials, send real certificates/Gmail, call production callbacks or write production Firestore during preparation.

Source of truth: Fulcrum `functions/src/certificateService.js`, `certificateTransport.js`, `certificateEvents.js`, `certificatePolicy.js`, `certificates.js`, `contributors.js`; vertexite `verify.html`; certificate unit/HTTP/transport tests. The published v12 and both draft PDF fields were inspected read-only. URL segments such as `draft/371601034/fields` identify a selected step; **371601034 is a callback step ID, not a verified draft version ID**.

Placeholders `<EXISTING_CATCH_HOOK>`, `<CALLBACK_CREDENTIAL>`, `<BACKEND_SIGNATURE>`, `<ORIGINAL_EVENT>` and `<ATTEMPT_ID>` are not usable credentials or samples. Never print real values in a report, shared response or Code output.

## 1. Existing trigger and event contract

The existing trigger is **Webhooks by Zapier**, step 1 / ID `371351372`. Its displayed title “New Document Within a Firestore Collection” does not establish a Firestore trigger. The backend sends a JSON HTTP POST to the **same existing catch hook**, read from Secret Manager binding `ZAPIER_CONTRIBUTOR_WEBHOOK_URL`. No second hook/Zap is required. The transport makes one request with a 15-second timeout and never automatically retries; non-2xx/timeout records an uncertain operation.

Tenure issuance comes through authenticated/admin-only `issueVertexCertificate`, then the shared ledger service and transport. Legacy verification comes through admin-authorized `toggleContributorVerification`, preserving verification semantics. The trigger should receive the original object intact, not a callable `data` envelope.

All tenure event fields below are JSON **strings**. All canonical fields are required. This illustrative object uses only dummy/placeholder values:

```json
{
  "eventKind": "tenure_certificate_issuance",
  "contractVersion": "vertex-tenure-v2",
  "certificateType": "tenacity",
  "certificateJobId": "qa-person--tenacity",
  "contributorId": "qa-person",
  "recipientName": "Deniz Example",
  "recipientEmail": "certificate-qa@example.invalid",
  "language": "en",
  "issuedAt": "2026-10-11T12:00:00.000Z",
  "verificationId": "qa-person--tenacity",
  "verificationUrl": "https://vertexishere.com/verify/qa-person--tenacity",
  "backgroundUrl": "https://vertexishere.com/assets/certificates/tenacity.webp",
  "formattedDate": "11/10/2026",
  "attemptId": "<ATTEMPT_ID>",
  "eventSignature": "<BACKEND_SIGNATURE>",
  "id": "qa-person--tenacity",
  "issuanceId": "qa-person--tenacity",
  "name": "Deniz Example",
  "email": "certificate-qa@example.invalid"
}
```

`eventSignature` is a backend-generated 64-character lowercase hexadecimal HMAC. The placeholder above is deliberately invalid. The signing secret stays exclusively on the backend. Do not fabricate a valid signature in Zapier.

| Field | Exact meaning / validation |
| --- | --- |
| `certificateType` | Case-sensitive `tenacity`, `constancy`, `majesty`, `nobility` for tenure; no trimming/lowercasing fallback |
| `certificateJobId` | Real `certificates/{id}` document ID: `${contributorId}--${certificateType}` |
| `contributorId` | Actual `contributors/{id}` ID, not Firebase Auth UID or recipient email; `[A-Za-z0-9_-]`, 1–128 characters |
| `verificationId` | Exactly the same tenure certificate/job ID |
| `verificationUrl` | Exactly `https://vertexishere.com/verify/{verificationId}`; never reconstruct a tenure QR from contributor ID |
| `attemptId` | Actual stored attempt; production generates a UUID; validator allows ID characters above, 1–128 characters |
| `recipientName` / `recipientEmail` | Actual contributor `name` / `email`; use these canonical fields for tenure PDF/Gmail |
| `language` | Tenure: exactly `tr` or `en`; backend normalizes non-TR input to EN |
| `issuedAt` | Backend-controlled first issue time, ISO UTC with milliseconds; unchanged on retry |
| `formattedDate` | Server-provided issuance date; TR Istanbul / EN London timezone, day/month/year; do not reformat in Zapier |
| `backgroundUrl` | Exact type/language asset mapping below; signed and matched against ledger |
| `id`, `issuanceId`, `name`, `email` | Compatibility aliases; **not signed canonical inputs**. Do not use aliases instead of canonical tenure fields after validation |

Ledger path: `certificates/{certificateJobId}`; attempt path: `certificates/{certificateJobId}/attempts/{attemptId}`. Repeated issue calls reuse the same job and do not dispatch again. An explicitly approved safe retry gets a new attempt ID but retains certificate ID, payload and original issue date. Joining date is separate and does not replace issuance date.

## 2. Legacy Merit fallback and language mapping

Merit certificate ID remains the contributor ID; old `/verify/{contributorId}` QR links are preserved. Legacy events use `name`, `email`, `id`, `contributorId`, `issuanceId`, `attemptId`, `language`, `formattedDate`, `backgroundUrl`, `verificationUrl`; `certificateType` may genuinely be absent in older events. They have no tenure `eventKind`, `certificateJobId` or `contractVersion`.

A missing type means Merit **only after `validateLegacyEvent` proves a real active Merit dispatch**. `null`, empty string, unknown/case-modified types, or any tenure marker—even blank—must not default to Merit. Generic issuance requires explicit type; missing-type issuance fallback exists only in the internal legacy verification context.

Legacy `formattedDate` is the contributor application's `createdAt` formatted by the existing language timezone, **not the new tenure issue date**. Legacy payload also retains phone/age/department/interview/application fields; these are not needed by the PDF or Gmail mapping and must not be exposed publicly. Legacy languages retain their existing behavior: `tr` uses Turkish, other languages use the existing English branch.

Use public asset base `https://vertexishere.com/assets/certificates/`:

| Type | TR title / file | EN title / file |
| --- | --- | --- |
| `merit` | Liyakat / `liyakat.webp` | Merit / `merit.webp` |
| `tenacity` | Dirayet / `dirayet.webp` | Tenacity / `tenacity.webp` |
| `constancy` | Metanet / `metanet.webp` | Constancy / `constancy.webp` |
| `majesty` | Asalet / `asalet.webp` | Majesty / `majesty.webp` |
| `nobility` | Azamet / `azamet.webp` | Nobility / `nobility.webp` |

Tenure PDF name/date/Gmail recipient: `recipientName` / `formattedDate` / `recipientEmail`. Legacy: `name` / original `formattedDate` / `email`. For both, QR encodes the validated complete `verificationUrl`. Tenure emails need the type/language certificate subject/body; preserve the existing welcome email only for Merit.

**Authoritative owner policy:** certificates pair by recognition level, not literal translation: tenacity=Dirayet/Tenacity (1 month), constancy=Metanet/Constancy (3 months), nobility=Azamet/Nobility (6 months), majesty=Asalet/Majesty (12 months). The artwork files are correct and were not changed. The previous mismatch diagnosis is withdrawn; corrected software mappings remove that publication blocker. Recognition duration is exposed in type metadata (`months`); existing approved `minimumDays` eligibility rules remain unchanged and must be audited before release, not silently converted from months to days.

## 3. Authenticated validation before PDF

All validation, claims and callbacks use the same existing public endpoint:

`https://europe-west1-vertex-ai-1618.cloudfunctions.net/zapierContributorCallback`

Use POST, `Content-Type: application/json`, `Authorization: Bearer <CALLBACK_CREDENTIAL>`. This is an HTTP endpoint, **not** a Firebase callable envelope: no outer `data`, request array or form-encoded body. Existing body `secret` authentication remains compatible; new steps should use the secure bearer configuration. Do not paste a real credential into Copilot or ordinary test samples. An invalid bearer header is not rescued by a valid body credential.

Tenure preflight request:

```json
{"action":"validateEvent","event":"<ORIGINAL_EVENT>"}
```

Replace the placeholder with the **nested original JSON object**, not its stringified text. Preserve every original field and type; do not normalize/edit signed values. Server verifies HMAC and matches signed fields with the stored active job/attempt. Success response:

```json
{"valid":true,"eventKind":"tenure_certificate_issuance","certificateJobId":"qa-person--tenacity","certificateType":"tenacity","attemptId":"<ATTEMPT_ID>"}
```

Legacy preflight uses `{"action":"validateLegacyEvent","event":<ORIGINAL_EVENT_OBJECT>}`. Success:

```json
{"valid":true,"certificateType":"merit","issuanceId":"qa-person","contributorId":"qa-person","attemptId":"<ATTEMPT_ID>"}
```

Proceed only on HTTP 200 **and** boolean `valid === true`. Neither action writes data. Legacy validation requires an existing active Merit job, actual attempt, and matching `id`, `contributorId`, `name`, `email`, `language`, `formattedDate`, `backgroundUrl`, `verificationUrl`. Historical pre-ledger/no-attempt queued runs cannot pass this guard: reconcile them separately; do not invent identifiers or blindly resend. Existing historical callback behavior remains preserved in backend code.

## 4. PDF preparation without document JavaScript

Before CustomJS PDF, resolve a complete HTML string: validated background, escaped name/date, Ubuntu Bold font and a real QR image `src`. Do not use hidden input divs or `<script>` to assign background/QR. Do not leave Zap tokens, unavailable sample messages or `{{...}}` placeholders in final HTML.

Create the QR PNG before PDF from the exact validated `verificationUrl`. The isolated test generates it locally and embeds a PNG data URI. Production needs a verified QR-generation mechanism and a resolvable PNG/data URI; if keeping a URL-based QR service, URL-encode the complete verification URL before constructing the image URL and confirm image loading. The renderer's JavaScript execution must not be required. Embed/trust-load actual Ubuntu Bold and ensure it is loaded before conversion.

Preserve v12 geometry for **all ten combinations**, regardless of source asset resolution:

| Element | Exact legacy geometry |
| --- | --- |
| Page | 2000×1414 CSS px, zero margins; equivalent 1500×1060.5 PDF points |
| Background | `background-size: 100% 100%`, centered, no-repeat |
| Name | Ubuntu Bold 700, 64pt, letter spacing 2px; top 43%, left 50%, translate(-50%,-50%), width 80%, centered, nowrap |
| Date | Ubuntu Bold 700, 32pt; bottom 356px, left 562px, translateX(-50%) |
| QR frame | bottom 24px, left 50%, translateX(-50%); content 144×144px, padding 10px, border 2px, radius 8px, white background |
| QR outer/image rectangle | outer `(916,1222,168,168)`; image `(928,1234,144,144)` |

Tenure source images are 3510×2482; scale them into the existing 2000×1414 canvas, not a new page size. Earlier audit advice suggesting different tenure page geometry is superseded.

For current dark assets `majesty/en` and `majesty/tr`, pre-resolve name/date foreground to white; others use `#111111`. This changes no position/font/size and fixes illegible black-on-black text. Foreground is a PDF preparation value, **not an existing backend event field**. HTML-escape names/dates; stop on missing image/font/QR or name overflow rather than silently clipping or sending an incomplete PDF.

Verified local resolved template: `tests/fixtures/certificate-v12-resolved.html`; reproducible QA: `tests/certificate-pdf.cjs` and `tests/certificate-pdf-qa.py`. Their placeholders are filled before conversion and all assets are embedded. These are isolated test helpers, not deployed preparation steps in Zapier.

## 5. PDF status, permanent Gmail claim and sequencing

For tenure, successful PDF generation must POST a stage callback **before claiming Gmail**:

```json
{"certificateJobId":"qa-person--tenacity","contributorId":"qa-person","attemptId":"<ATTEMPT_ID>","status":"pdf_generated"}
```

Expected response: `{"success":true,"status":"processing","deliveryStatus":"not-submitted"}` for a normal active job; `status` can remain `uncertain` after an earlier trigger timeout. Duplicate acknowledgement may be `{"ignored":true,"duplicate":true}`. Never treat arbitrary HTTP 200 as permission to send Gmail.

After PDF completion and its accepted stage acknowledgement, immediately before Gmail, POST the claim:

```json
{"action":"claimDelivery","certificateJobId":"qa-person--tenacity","contributorId":"qa-person","attemptId":"<ATTEMPT_ID>"}
```

Legacy claim uses `issuanceId` instead of `certificateJobId`:

```json
{"action":"claimDelivery","issuanceId":"qa-person","contributorId":"qa-person","attemptId":"<ATTEMPT_ID>"}
```

Continue to Gmail only on HTTP 200 with **boolean** `{"proceed":true}`. Matching job/contributor/attempt is required. Tenure additionally requires `pdfStatus: generated` and the canonical job ID. A transaction permanently records `deliveryClaimedAttempt` once. Terminal/replayed claims return `{"proceed":false}`; malformed/mismatched/not-found requests reject.

Stop on false, missing/non-boolean response, timeout, 4xx or 5xx. There is no claim expiry, lease reset or automatic reclaim. An ambiguous claim response may have persisted: do not send or reset it. Disable automatic Gmail replay and replay-from-Gmail bypass; a cached previous `proceed:true` must never authorize a second Gmail action. A webhook success/PDF success alone is insufficient.

## 6. Gmail final callback and failure contract

After Gmail positively acknowledges submission, tenure POST:

```json
{"certificateJobId":"qa-person--tenacity","contributorId":"qa-person","certificateType":"tenacity","attemptId":"<ATTEMPT_ID>","status":"gmail_submitted"}
```

Success response: `{"success":true,"status":"submitted","deliveryStatus":"submitted"}`. A matching permanent claim and generated PDF are required. This means **submitted to Gmail**, not confirmed delivery. It does not modify contributor `hasVerified`/`emailSent`.

Use the same correlated body for the following stage variants:

| `status` / extra field | Backend result / safe behavior |
| --- | --- |
| `pdf_failed`, `deliveryNotSent:true` | Before PDF completion/Gmail claim only: `failed`, `failureStage: pdf`, `retrySafe:true`; explicit admin retry permitted, never automatic |
| `pdf_failed` without explicit true | Failed/PDF stage, `retrySafe:false` |
| `gmail_failed` | `uncertain`, Gmail failure stage, delivery uncertain, `retrySafe:false`; even `deliveryNotSent:true` does not enable retry |
| `uncertain` | `uncertain`, external failure stage, delivery uncertain, `retrySafe:false`; use for unknown network/external outcome |
| `gmail_submitted` | `submitted`; no resend; may reconcile a late result on the same claimed uncertain attempt |

PDF error request example:

```json
{"certificateJobId":"qa-person--tenacity","contributorId":"qa-person","attemptId":"<ATTEMPT_ID>","status":"pdf_failed","deliveryNotSent":true}
```

Use `deliveryNotSent:true` only when Gmail was never attempted and no claim exists. A PDF failure cannot undo a generated/claimed/submitted operation. An unconfirmed PDF-stage callback must halt before Gmail. Do not invent a PDF failure to resolve a later Gmail timeout.

Legacy final callback remains:

```json
{"contributorId":"qa-person","issuanceId":"qa-person","attemptId":"<ATTEMPT_ID>","status":"success"}
```

Legacy PDF failure uses `status: failed` and truthful `deliveryNotSent:true` before any possible send; legacy `success` records `succeeded` and existing contributor verification/email flags. These are historical semantics, not proof of actual delivery. Legacy has no separate tenure Gmail-failure stage: after a potentially sent/ambiguous Gmail action, halt/reconcile rather than posting `failed` and rolling back verification.

**Legacy callback JSON must omit `certificateJobId`, `eventKind` and `contractVersion` entirely, even when blank.** Those keys route the request to tenure handling. Do not send one shared callback object with empty tenure fields. The current draft's `certificateJobId + status: success` is invalid for tenure and may also break Merit routing.

Exact duplicate current-stage callbacks acknowledge without processing again. Stale attempts, different types/contexts, invalid transitions and revoked operations reject. Error HTTP codes: unauthorized/bad signature 403; invalid arguments/preconditions 400; missing operation 404; unexpected internal failure 500 with generic message; non-POST 405. Never continue Gmail after an error. Return bodies are plain JSON, no callable envelope.

## 7. Verification compatibility

Legacy `/verify/{contributorId}` remains Merit. Tenure `/verify/{contributorId}--{type}` identifies the individual ledger certificate. The local page uses public-safe GET `verifyVertexCertificate?id=...`, not browser reads of contributor/private certificate documents. Valid response includes ID, recipient name, language/type, formatted date, issuance timestamp, revocation and submission status; no email, phone, credential or private attempt data.

`submitted` tenure or successful legacy ledger is valid independently of email delivery confirmation. Revoked response: `{"valid":false,"revoked":true,"certificateId":"..."}`. Unknown/unissued records return invalid. The restricted page/backend changes still need an approved release and live availability/CORS/legacy QR verification; local success does not establish publication.

## 8. Existing steps to update, preserving published v12

Numbers below are the current visible numbers; inserting guards will renumber them. Identify by stable IDs too.

| Current step | Stable ID | Required draft change |
| --- | --- | --- |
| 1 — Webhooks trigger | `371351372` | Keep existing trigger/hook; establish isolated tenure and legacy sample mappings without a real production event |
| 2 — language split | `parallel_371352830` | Insert strict mode selection, authenticated preflight and validity filter before PDF paths |
| 3 / 8 — conditions | `371352832` / `371352834` | Preserve TR / other-language legacy routing; tenure only TR/EN |
| 4 / 9 — CustomJS PDF | `371352833` / `371352835` | Feed fully resolved, script-free HTML; dynamic validated type/background/QR; exact legacy geometry and font; dark-background contrast |
| 5 / 10 — PDF error POST | `371602654` / `371602658` | Distinct legacy `failed` vs tenure `pdf_failed`; actual attempt ID; truthful not-sent flag |
| 6 / 11 — Gmail | `371352867` / `371352888` | Insert PDF acknowledgement, permanent claim and strict proceed filter immediately before; canonical recipient, generated attachment, type/language subject/body; block replay |
| 7 / 12 — final POST | `371601033` / `371601034` | Distinct legacy/tenure JSON; tenure `gmail_submitted` + actual job/attempt; preserve legacy success |
| New error handling | new draft steps | Correlated `gmail_failed`/`uncertain`, halt and reconciliation; no resend |

Observed HTML blockers: published TR v12 assigns QR `src` only in script. Published and current draft EN also assign QR in script and contain an extra unmatched closing brace; draft EN still has fixed `merit.webp`. Current draft TR dynamically assigns background/QR in script, uses unsafe blank-to-Merit fallback, and shows unavailable sample mappings for type/verification URL. Neither draft is presently proven compatible with JavaScript-disabled PDF conversion. Do not trust the editor's “ready” message.

## 9. Isolated PDF results and remaining dependencies

Five types × TR/EN: **10/10 rendering, exact page geometry, embedded Ubuntu Bold, correct name/date and decoded QR tests passed with document JavaScript disabled and zero external requests.** Final PDFs were rendered back to PNG and visually inspected. Dark-background name/date contrast was corrected in the local template. Backend certificate tests: **52/52 passed again**; previous admin/browser evidence retained.

| Type | TR / EN PDF mechanics | Content approval |
| --- | --- | --- |
| Merit | passed / passed | consistent legacy content |
| Tenacity | passed / passed | 1 month / 1 month |
| Constancy | passed / passed | 3 months / 3 months |
| Majesty | passed / passed | consistent: 12 months / 12 months |
| Nobility | passed / passed | consistent: 6 months / 6 months |

Outputs: `output/pdf/certificates/{type}-{tr|en}.pdf`, corresponding `-render.png`, `manifest.json`, `results.json`. Dummy recipients are Deniz Örnek/Deniz Example; test email is `.invalid`; jobs live only in an in-memory fixture. These are proposed resolved-template outputs in local Chromium, **not successful CustomJS cloud runs or sent certificates**. Exact CustomJS renderer/font/data-URI/QR-loading behavior and both rebuilt Zap mappings require isolated draft validation with Gmail/callback actions replaced by mocks. Do not run the production catch hook/callback for test data.

Publication remains blocked until all of these are complete:

1. Complete read-only issued-record and approved eligibility-rule audit after restoring CLI authentication. Owner policy and artwork consistency are resolved; no artwork swap or production data migration has been performed.
2. Implement script-free PDF preparation in this draft and test all ten actual CustomJS outputs safely, including names with Turkish characters, overflow, asset/font failures and decoded QR URLs.
3. Add strict routing/preflights, PDF stage callbacks, permanent claims/proceed filters, separate final bodies and Gmail failure/replay policy. Replace unavailable sample references with actual field mappings from isolated samples.
4. Approve and provision backend-only `ZAPIER_CONTRIBUTOR_WEBHOOK_URL` with the **same** existing hook and `ZAPIER_CERTIFICATE_EVENT_SIGNING_SECRET` (minimum 32 characters); verify secret bindings. Neither was provisioned by this work.
5. Coordinate rotation of exposed `ZAPIER_CONTRIBUTOR_CALLBACK_SECRET`: approval/maintenance window; pause new requests, reconcile queued/claimed runs; new Secret Manager version; update both language success/error/preflight/claim consumers; targeted backend release; test new accepted/old rejected auth safely; disable compromised version only after migration. No dual-credential grace period exists in candidate code. User completes credential entry if a browser form is used. Do not restore the compromised value on rollback.
6. Approved targeted backend and restricted verification-site/admin releases, with serving revision/traffic rollback snapshots and availability/legacy QR checks. Local implementation is not already deployed. Do not bulk-deploy unrelated functions.
7. Full isolated end-to-end mock evidence and explicit approval for publishing this existing draft. Only then acknowledge `CERTIFICATE_ZAPIER_CONTRACT_VERSION=vertex-tenure-v2` and readiness. The issuer requires both exact version acknowledgement and `CERTIFICATE_EXPANSION_READY=true`, plus validated secret configuration. These settings were not changed and must not be fabricated to remove the blocker.

No production state, credentials, published Zap version, Firestore records or real delivery were changed for this handoff. Preserve v12 until the same-Zap draft and all dependencies are approved.


## 10. Signed-event and issued-record migration protection

New events use **vertex-tenure-v2**, so corrected recognition-level mappings cannot be confused with earlier signed v1 payloads. Signed field order, canonical type IDs, job IDs and attempts are unchanged. The backend can still verify original vertex-tenure-v1 HMACs against the original asset map; it never edits a received event's version, asset or signature. The new-event preflight accepts only v2. Old callbacks remain correlated to their stored operation; an existing job is reused without mutation, and an old-version retry is blocked for explicit reconciliation.

For old issued records, verification and admin history derive `certificateName` and `recognitionMonths` from the original stored `payload.backgroundUrl`, with `historicalMapping:true`. This is a read-only display snapshot: an old Majesty/TR printed as Azamet stays Azamet/6 months, and an old Nobility/TR printed as Asalet stays Asalet/12 months. Canonical record IDs/types are retained. Do not rewrite old payloads, rename jobs, regenerate signatures or resend mail automatically.

Read-only production audit was attempted with the existing CLI account, but authentication requires renewal. Therefore issued-record counts and current `config/certificateEligibility` rule values are **unverified**, not assumed empty. Audit before release, hold any old pending/uncertain/claimed v1 jobs, and obtain explicit approval for any record/policy migration. No production Firestore write or credential change was performed.

Draft preparation must use the authoritative mapping in both PDF and both email branches. Do not rewrite v1 inputs to v2. Legacy Merit templates/IDs/callback semantics remain unchanged. Remaining blockers are secure secret configuration/rotation coordination, authenticated draft guards and claims, exact CustomJS/mock end-to-end validation, historical record/policy audit and explicit release approval—not artwork equivalence.

## 11. Owner-policy implementation and actual draft status

Local backend assets/type metadata, HMAC validation, admin selection names/order/durations, verifier labels and tests now use the owner map. The images themselves are untouched. Majesty uses a white name/date foreground in both languages; Nobility uses the existing dark foreground on the pink Azamet/Nobility assets. All ten local PDFs were regenerated; 52 backend tests, 14 admin tests and 48 Chromium + 48 WebKit verification cases passed, including historical names/immutability.

Exact proposed tenure email subjects: TR `Vertex {TR_AWARD} Sertifikanız`; EN `Your Vertex {EN_AWARD} Certificate`. Bodies are:

```html
<p>Merhaba {ESCAPED_NAME},</p><p>{MONTHS} aylık katkınız için {TR_AWARD} sertifikanız ektedir.</p><p><a href="{VALIDATED_URL}">Sertifikayı doğrulayın</a></p><p>Teşekkürler,<br>Vertex</p>
```

```html
<p>Hello {ESCAPED_NAME},</p><p>Your {EN_AWARD} certificate recognizing {MONTHS} months of contribution is attached.</p><p><a href="{VALIDATED_URL}">Verify your certificate</a></p><p>Thank you,<br>Vertex</p>
```

These strings and escaping/type/month checks are tested in `tests/fixtures/certificate-email-templates.cjs` and `tests/certificate-owner-policy.test.cjs`; they do not send mail. Retain the original Merit welcome templates. Do not invent a `durationMonths` event field: months are resolved from the authoritative type map in the preparation step.

The corrected sanitized contract and exact email text were sent to the existing Editor Copilot with explicit draft-only/no-execution instructions. Its edit tools reported **needs-fetching/step-validation failures** and failed to save usable updates. A partial attempt left only the trigger visible; its checkpoint/Undo was used to restore the existing full two-language draft. The old trigger, split, conditions, PDFs, PDF-error branches, Gmail and final callback nodes were verified again by their original IDs. Published v12 remained unchanged. Therefore no new PDF/email/guard/claim scaffolding is claimed as saved in the actual Zap. Resolve the editor tool failure or safely configure the existing draft manually before marking these changes complete. No live step test, email or production callback was executed as a workaround.
