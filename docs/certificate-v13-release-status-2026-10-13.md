# Certificate v13 release status — 2026-10-13

## Production state

Targeted Firebase deployment succeeded for `issueVertexCertificate`, `getVertexCertificateDetails`, `verifyVertexCertificate`, `toggleContributorVerification`, and `zapierContributorCallback` in project `vertex-ai-1618`, region `europe-west1`.

New certificate callback and signing credentials are in Secret Manager. The existing Zap webhook remains the transport destination. No credential values are included here. The new API by Zapier connection is named `vertex certificates v13`.

Expanded issuance remains disabled: neither `CERTIFICATE_EXPANSION_READY=true` nor `CERTIFICATE_ZAPIER_CONTRACT_VERSION=vertex-tenure-v2` was activated. The legacy callback grace setting remains enabled for v12 callbacks. The exposed old credential cannot validate events, claim delivery, or acknowledge tenure issuance. Final retirement of the old credential still requires checking in-flight v12 work and disabling the legacy grace setting.

No v13 publication, Mustafa Çakı issuance, or real Gmail delivery was performed. Published v12 was retained.

## Saved draft changes

Same Zap `371351372`; no second Zap was created.

The global validation step uses `preflight-step.mjs` and the new callback connection. Both former Gmail steps now use `delivery-step.mjs`, with `certificate_callback` and the existing Gmail account `mustafa@vertexishere.com #2` as `certificate_gmail`. The Turkish input file references its CustomJS PDF; the English input references its own CustomJS PDF. Both PDF error handlers use `pdf-error-step.mjs` and the new callback connection. Both old trailing Webhooks callback steps were removed from the recoverable draft.

The delivery code loads and checks the PDF before acquiring a permanent claim. PDF-stage acknowledgement and tenure delivery claim occur atomically in the backend. Every execution of the same Code action rechecks the claim before its single Gmail API request. SDK automatic network retries are disabled. An uncertain Gmail result is recorded as uncertain and never automatically resent. Gmail submission is not represented as confirmed delivery.

## Publication blocker and next action

**Preparation step 2 still has a literal isolated PDF test event in `originalJson`. It must be replaced with actual trigger data before publication.** Do not publish the current draft as-is.

The deployed transport emits `eventJson`, a string containing the original logical event, including its signature and original field types. The current historical trigger sample does not expose this new field in its mapper. The visible sample editor only permitted editing existing field values. Do not emit a tenure test event to the existing hook while v12 is published: v12 could process it as a legacy event.

One potential direct UI solution is mapping the trigger's complete `Step Output` to preparation and explicitly extracting its `eventJson` carrier before validation. This has not been implemented or tested; do not assume Zapier's whole-output serialization behavior. Alternatively obtain a safe draft-only sample exposing the actual deployed field. No invented mapping token should be used.

After binding the real carrier, verify both language paths and the actual callback authentication in the Zapier runtime, then publish v13. Only afterward activate the two readiness settings and target-deploy the issuer. Issue Mustafa's requested `majesty` certificate once through the admin UI; check the actual job, Gmail submission result, verification page and callback status. Do not retry any ambiguous delivery.

The SDK package in the draft remains `latest`; the inspected npm release was `0.115.1`. The UI version edit did not persist the requested pin. Verify/pin the real runtime version before relying on inspected retry behavior. A local direct SDK transport probe returned no usable evidence and is not counted as a successful test.

## Verified evidence

Backend atomic delivery and callback HTTP tests: **8 passed**. Exact saved production Code source with mocked SDK and in-memory certificate service: **3 passed**, covering Majesty and Merit replay after a lost Gmail response, and replay after a lost success callback. These tests observed two fresh claims and only one Gmail attempt.

The actual Turkish Code step ran in Zapier with an invalid isolated event and returned `claim_uncertain`, `gmailAttempted=false`. This demonstrates that the test did not reach Gmail; it does not prove successful production claim/authentication or a real Gmail API submission.

All ten isolated CustomJS PDF combinations had been generated and downloaded. Local PDF checks after the QR change passed for all ten. Dark Majesty/Asalet certificates use a white QR frame; other designs retain their dark frame. QR background, 2px thickness, position and certificate geometry were preserved. Real CustomJS PDFs scale the original 2000×1414 design to landscape A4; no real recipient certificate was generated in these checks.

Source files and prior test outputs were preserved. No Git push was made during this release attempt. The one-hour time budget elapsed before the trigger binding and publication could be completed.
