# vertex console verification

For the latest interface refinement and its 35 browser check groups, see [precision-refinement.md](precision-refinement.md) and [precision-verification.json](precision-verification.json). The results below describe the preceding reconstruction and backend repair.

The existing vanilla JavaScript application and Firebase/Curator contracts are retained. The initial reconstruction checkpoint is `24d8b21`.

## interface

The shell uses centralized tokens, Tabler SVGs, an accessible mobile sidebar, and dark/light/system themes. Contributors use compact rows and detail drawers. Model editing uses a drawer; translations and destructive confirmations share the console's modal and focus management. Catalog refresh and publishing use contextual controls, with explicit confirmation before publishing. System administration is organized into seven sections.

Certificate selection supports tenacity, constancy, majesty and nobility. Selection alone never sends a certificate. Joining dates and history have separate surfaces. Processing and uncertain records block resending; failed records only offer retry when the backend marks them retrySafe. Zapier readiness remains unchanged.

Design references: [Linear's March 12, 2026 UI refresh](https://linear.app/changelog/2026-03-12-ui-refresh), [ElevenLabs UI components](https://ui.elevenlabs.io/docs/components), and [ElevenLabs flat message variant](https://ui.elevenlabs.io/docs/components/message). These informed hierarchy, consistent navigation, and compact surfaces; no React dependency was introduced.

## verification

Run `npm ci`, then `npm run test:browser`. Install Playwright's Chromium or set `CHROME_PATH` to a local Chrome executable. Set `VERTEX_SCREENSHOTS=tests/results/screenshots` to capture screenshots. Browser tests isolate Firebase, uploads and all remote traffic with mocks; they never notify actual users or issue actual certificates.

The browser suite covers six widths (360, 390, 768, 1024, 1440 and 1920), light/dark/system, navigation, login/logout, role visibility, hidden fields, contributors, certificates, models, news, notification scheduling, subscriptions, chat and System. It also exercises delayed skeletons, empty/error states, stale responses, confirmation cancellation, focus restoration, uncertain delivery and duplicate submission protection.

## notification root cause

Read-only production logs show repeated `sendTargetedNotification` container termination at the 256 MiB limit on October 9–10, 2026. A broadcast collected roughly 33,498 device tokens and used 500-token FCM batches. Logs also show Cloud Run CPU allocation quota failures in `scheduleNotification` on October 10.

The repair uses 512 MiB, single request concurrency, 100-token sequential FCM batches, bounded invalid-token cleanup, a 540-second delivery timeout and limited fractional CPU instances. Scheduling/cancellation use bounded fractional CPU instances. The client now sends `SUBSCRIPTION_TIER` with the actual free/plus/pro/ultra plan, matching the server contract. A failed immediate request is treated as potentially partially delivered, and this session blocks blind resubmission.

Scheduling no longer creates a Cloud Task inside a Firestore transaction callback that may rerun. Processing claims SCHEDULED records transactionally and acknowledges missing/already claimed/failed tasks without redelivery. The endpoint was observed to permit allUsers at IAM; signed Cloud Tasks OIDC service identity is now validated before database access, without changing IAM roles. Internal failure details are kept out of client responses.

Backend mock tests include a 33,498-token broadcast, authorization, invalid payloads, scheduling failure/timeout, scheduler replay, failed delivery and error redaction. These demonstrate logic and bounded batch size; they are not a live broadcast load test.

The joining-date function was FAILED because its Cloud Run service was missing. Only that certificate function is redeployed. No certificate issuance function is deployed or invoked against real participants.

Deployments use `--only functions:<individual-name>` against verified project `vertex-ai-1618` and region `europe-west1`. Live custom environment values are preserved in isolated deployment packages. Previous source generations, revisions and configuration are saved in the Fulcrum docs directory. No Worker, database schema, user privileges or production records are changed by test execution.

## final local results

28 browser check groups passed with no unexpected console or module errors. The complete backend certificate/notification/permission suite passed 41 tests, and the local department adapter passed 4 tests. JavaScript syntax, CSS structure and clean dependency installation were verified.

The five individually deployed functions are sendTargetedNotification, scheduleNotification, cancelScheduledNotification, processScheduledNotification and setVertexContributorJoiningDate. No real notification or certificate was sent during verification. Production authentication and delivery are checked through safe denial probes; successful authenticated mutations are covered by mocks.

## live results and joining-date access verification

Commit `69854e8` was pushed normally and deployed through the verified Cloudflare Pages `adminsite` project to https://admin.vertexishere.com/. Real Firebase startup and the login screen passed desktop/mobile browser checks with no failed requests, uncaught errors or overflow. Successful authenticated write operations remain mock tested; no real notifications or certificates were sent.

Four notification services are verified live. After explicit human approval on October 11, 2026, only the joining-date service received the standard allUsers roles/run.invoker binding. A safe anonymous callable request now returns HTTP 401 with UNAUTHENTICATED, confirming requests reach Firebase authentication instead of the platform HTML 403. The serving revision remains setvertexcontributorjoiningdate-00001-jat; no container rollout or production data mutation occurred. Admin authorization and joining-date mutations remain covered by mock tests, rather than authenticated production writes. Earlier configuration rollout attempts failed because of regional CPU quota; the invocation fix did not require another rollout. Other user privileges, secrets, schemas and unrelated services were not changed.
