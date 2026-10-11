# product stabilization and mobile audit — 2026-10-11

Scope: the two latest stabilization/mobile attachments. Existing neutral theme, Tabler icons, Soft Sweep, certificate idempotency and backend authorization contracts are retained. Checkpoint: `checkpoint/stabilization-mobile-20261011` at `3584053`.

## Findings and corrections

| Requested item | Status and evidence |
| --- | --- |
| 1. Certificate loading | Corrected error/retry/invalid-envelope handling. Existing authenticated production detail drawer loaded successfully before changes. Generated Cloud Run URI verified against deployed service. App Check header added when available; backend enforcement unchanged. No evidence that App Check caused the observed incident. |
| 2. Certificate drawer | Recipient selector, awards, joining-date editor and history reuse the right drawer. Locale changes preserve the date input. Final confirmation remains an accessible dialog. Issuance tests use mocks only. |
| 3. Vertex membership | Three row actions remain visible on mobile; unknown Auth mappings are disabled. Production aggregate: 237 records, 12 matched accounts, 225 unknown mappings. Matched UID/pending/confirmation/filter contracts retained. |
| 4. Login errors | Required fields, credentials, permissions, throttling, network and session errors use safe localized messages; form supports Enter and autocomplete. |
| 5. Backend audit | Eight deployed URIs and anonymous authorization responses verified. Public model data returned HTTP 200 with the expected catalog envelope. Department 500/503 logs identify regional CPU quota and unavailable instances, not malformed payload. Regional capacity remains an external blocker. |
| 6. Mobile navigation | Hamburger hidden throughout the mobile range; More opens its own shared modal bottom sheet, independently of legacy sidebar toggling. Permission filtering, Escape, outside click, focus trap and safe-area tested. Desktop sidebar retained. |
| 7. Actual subpages | News editor/list, model library/management, notifications sender/scheduled, subscriptions assignment/list and contributor status/list select separate existing workspaces. DOM/form state, URL, back navigation and focus preserved. |
| 8. Subpage motion | 170ms opacity/translate transitions; reduced-motion override. No bounce or decorative cursor animation. |
| 9. Permissions blank detail | Root cause: workspace created before async permissions arrived, then initialization returned early without rendering details. Explicit repaint fixes the zero-height detail pane; missing load has an error/retry state. |
| 10. System navigation | Duplicate section controls hidden; sidebar/More select sections. Export and attributions remain reachable together. No readonly visit auto-saves default permissions. |
| 11. Brand | Single-line Title Case `Vertex Konsol`, Ubuntu brand only. Original local SVG geometry matches official vertexite asset. |
| 12–13. Login layout | Login container now uses flex instead of overriding it with block. Centered at normal mobile/desktop heights, safe scrolling on short screens. Subtitle removed; labels remain accessible. |
| 14. Social image | Local static 1200×630 PNG and canonical OG/Twitter metadata. Visually inspected; contains no authenticated or personal information. |
| 15–17. Toasts | No close X; whole toast dismisses with pointer/Enter/Space. Duplicate messages coalesce, locale callbacks update visible text. Adaptive 4/3/2 limits, reduced short-height limit, 180ms FLIP shifts and calm semantic colors. |
| 18. Maintenance semantics | Actual `status-off/on/pending` classes now map to success/warning/neutral. Confirmation and payload preserved. |
| 19. Backup health | Static ACTIVE claim removed. Configured label is separate from explicitly unverified health; no monitoring source was confirmed. This is not a verified healthy backup. |
| 20. Department users | Inline localized retry differs from an empty result. Pagination detects repeated tokens/bounded iteration and invalid response arrays. Regional quota incident remains unresolved at infrastructure level. |
| 21. Contributor fog | Header lies outside the row scroll/fog region; no header mask. Mobile cards reflow the name, metadata and three 44px action targets. Filters scroll horizontally without wrapping the whole page. |
| 22. Models | Compact rows retain contextual menus, translations, edit and publish confirmation. |
| 23. News | Published/editor workspaces are separate; unsaved draft and upload/publish contract preserved. |
| 24. Localization | Server error text is not shown directly in changed flows. Unknown certificate statuses are readable localized fallbacks. Dictionary parity, duplicates and literal keys audited. |
| 25. Responsive verification | Browser matrix covers 320, 360, 375, 390, 430, 768, 1024, 1440, 1920 × TR/EN × Dark/Light, long names, input/button/document bounds. Permission matrix reflows through 1280px; 1024px overflow found and corrected. 200% viewport/text reflow is simulated, not a claim of native browser-menu zoom. |
| 26. Safe regression | Browser backend calls are fixtures; no production certificate, membership, notification, admin, maintenance or permission write used. Auth and callable classification tests cover transport failures, malformed envelopes, attestation backoff and no blind retries. |
| 27. Release | Immutable hashed JS/CSS/font graph plus import map and cache headers. Final release and live source/hash verification recorded separately. |
| 28. Completion limits | Frontend and mock contracts verified as listed below. Regional backend quota, alternate-domain TLS, and unverified Zapier readiness remain explicit blockers; no claim that the whole infrastructure incident is resolved. |

## Mobile/loading attachment

All six specified mobile widths are covered. Contributors use actual card reflow rather than page scaling, tiny fonts or hiding overflow. More is a separate bottom sheet. Pending icon buttons keep their SVG/image node, text and size: 820ms shape-mask sweep, aria-busy, disabled guard, reduced-motion behavior, original disabled restoration. Contributor refresh, membership and department refresh use this helper; certificate writes use it too. Text buttons keep their labels. Other existing feature loading paths were preserved rather than rewritten wholesale.

Certificate readiness is handled by structured `details.reason`; the frontend also recognizes only the exact known legacy response of `issueVertexCertificate`. Unknown errors remain safe and localized. Eight TR/EN award background assets returned HTTP 200/image-webp; they are **not missing**. Delivery verification/readiness still blocks expanded issuance. No webhook, secret or production policy was changed.

## Targeted backend deployment and rollback

The only backend delta adds `{reason:'certificate-delivery-not-ready'}` to the existing failed-precondition guard in `Fulcrum/functions/src/certificates.js`. See `stabilization-backend.patch`; source remains in the existing Fulcrum checkout with unrelated changes preserved.

Attempted only `firebase deploy --only functions:issueVertexCertificate --project vertex-ai-1618`. New revision `issuevertexcertificate-00002-jag` could not start because the region exceeded Cloud Run CPU quota. Traffic was explicitly restored to `issuevertexcertificate-00001-red=100`. RoutesReady is true; the failed newest configuration remains recorded. Memory/CPU, instance limits, timeout, ingress, service account, environment, secrets and VPC settings compare unchanged. No newly deployed backend function is claimed successful.

Automatic approval review rejected a production POST availability probe of the issuance endpoint because of possible side effects. It was not executed; subsequent verification used readonly service metadata. Zapier was never called. Existing public/anonymous read checks of the eight specified functions are in `stabilization-backend-read.json`.

Canonical `https://admin.vertexishere.com` has valid TLS/HTTP 200. Alternate `https://adminsite.vertexishere.com` fails TLS validation (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`); certificate verification was not bypassed. DNS/certificate configuration was not changed.

## Reproduction and evidence

`npm test` — 12 unit tests. `node tests/i18n-audit.cjs` — 733 dictionary keys, zero missing literal references. All 24 source modules parse; `git diff --check` clean.

`CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' VERTEX_STABILIZATION_ONLY=1 node tests/browser.cjs`

`PLAYWRIGHT_BROWSERS_PATH=/private/tmp/vertex-playwright VERTEX_BROWSER=webkit VERTEX_STABILIZATION_ONLY=1 node tests/browser.cjs`

`node tests/startup-i18n.cjs` with each browser — clean profile/session, tr/en/invalid language, denied storage, slow network, SDK/config/initializer/module errors, startup timeout, cache failure, refresh after language change.

`node --test test/certificate-authorization.test.js test/certificates.test.js certificate-recovery.test.js` in Fulcrum/functions — 25 passing tests.

Screenshots: `tests/results/stabilization-chromium/` and `tests/results/stabilization-webkit/` (local ignored test artifacts). JSON results retained in docs after verification. Most recent package also gets a shorter workflow/error regression run after non-layout text/polling changes; layout CSS is identical to the full viewport matrix package. Native 200% browser zoom, physical devices, and actual certificate delivery are not represented as completed tests.

Verified results: full matrix 16 grouped checks in each browser, no uncaught errors or unexpected console errors; final package 17 grouped workflow/error checks. Startup 15 scenarios per browser. Unit 12/12; certificate backend 25/25. The later package changes only readiness wording, trailing whitespace and inactive-chat polling; matrix CSS matches byte-for-byte.
