# Vertex Konsol — complete UI polish and workflow correction

## Product acceptance status

| Item | Status and evidence |
| --- | --- |
| 1. Actual subpage titles | Complete. Topbar and browser title use selected destinations; live locale, initial route, back/forward and System Attributions are tested. |
| 2. Theme favicon | Complete. Official SVG geometry, Dark/Light/System including OS changes; PNG and Apple touch fallbacks. |
| 3. Wordmark | Complete. Two lines VERTEX / KONSOL; locally hosted Ubuntu 500 only for the wordmark, with upstream license. |
| 4. Contributor table | Complete. Rounded rows and sticky header, consistent columns/actions; application createdAt is used. |
| 5. Certificate workflow | Complete. All entry points use a right drawer; selector and management share its root, preserve back/search state, retain fixed footer, review confirmation, joining-date editor and history. Selection changes existing cards with 160ms check animation. |
| 6. Automatic loading | Complete. Admin/read-only auto loading, first-load layout skeleton, concurrent refresh coalescing, retained rows and inline retry after failure. |
| 7. Application date | Complete. Main column uses createdAt; interview date remains separately editable. |
| 8. Active Vertex status | Complete. Separate filter and action; verified email resolves Auth UID, unknown mapping is blocked. Expected-status transaction prevents reversing a duplicate request. |
| 9. Interview JSON | Complete. Raw editor removed; omitted update field preserves existing backend payload. |
| 10. Department editor | Complete. Canonical case/spacing matching, unknown values preserved, correct grid spacing and fixed save/cancel footer; no duplicate form heading. |
| 11. Scroll fog | Complete. Internal scroll regions only, scroll/resize/content-aware top and bottom edges. |
| 12. Admin revocation | Complete. Inline list action replaces old form. Email contract preserved; self/last/concurrent revocation safety is enforced server-side, other claims retained, Auth users never deleted. |
| 13. Snackbar | Complete. Bottom center, mobile dock clearance, calm fade/slide, subtle success/error/neutral colors, icons, deduplication, close/timeout cleanup and live localization. |
| 14. Consistency | Complete within requested scope. Existing palette/sidebar/motion retained; shared drawers, focus, tokens and reduced-motion behavior reused. |

## Root causes addressed

Module-level navigation labels were used as document titles; selected System sections were also not represented consistently. Theme changes did not update an official SVG favicon. The wordmark relied on generic typography.

Certificate management still opened a popover and rebuilt selection cards. Contributor refreshes could race and used the certificate error fallback; manual first-load prompting replaced automatic loading. The date column represented the interview instead of application creation. Application document IDs were incorrectly treated as user identities; verified Auth/email/profile mapping is now authoritative.

The editor exposed raw interview data, exact department matching failed for case/spacing variants, and its grid lacked display:grid so intended spacing did not apply. Scroll edges lacked state-aware internal-region handling. Administrator revocation remained a separate form without the required server safeguards. Old toast placement/style/cleanup and literal messages prevented the requested consistent behavior.

## Verification

Chromium and WebKit acceptance suites: 13 groups each, no uncaught errors or unexpected console errors. Required matrix: 390×844, 768×1024, 1440×900, 1920×1080; TR/EN; Dark/Light. Eight main modules plus recipient selection, certificate drawer and snackbar screenshots; editor additionally checked on desktop/mobile. Theme System and OS changes are separate behavioral checks. Screenshots were inspected and form spacing corrected.

Existing Chromium product regression: 43 groups passed, including seven exact viewport sizes and the prior precision suite. Startup reliability: 15 cases per Chromium and WebKit (storage denial/invalid language, slow/failing SDK/config, failed initializer/module, timeout, cache faults, refresh). Localization unit tests: 7 passed; 721 dictionary keys, 575 literal references, zero missing references; 40 unreferenced candidates retained in the audit because dynamic keys exist. Backend targeted tests: 49 passed, including certificate authorization, claims preservation, last/self/concurrent administrator protection and duplicate membership requests. Syntax and whitespace checks passed.

Expected mocked 503 responses exercise error handling and are not production failures. No real certificate, notification, membership update or administrator revocation was executed. Authenticated behavior is verified with mocks, not with real production accounts.

## Backend and deployment

Four functions individually deployed to vertex-ai-1618 / europe-west1: getVertexContributors, listAdmins, removeAdminRole, toggleVertexStatus. Every new revision is ACTIVE. Existing environment variables, secret bindings, service account, memory, CPU, timeout, maximum instances and ingress were compared with pre-deploy metadata and preserved. Rollback revision names and anonymous 401/403 checks are in complete-polish-deploy.json. No local environment file was uploaded and no unrelated function or Worker was deployed.

Fulcrum already contained unrelated uncommitted work. Only the required functions and new helper/test were edited; that repository was not blanket-committed or reset. This task's exact backend delta is saved in complete-polish-backend.patch. Sources: functions/src/user.js, functions/src/contributors.js, functions/src/consoleAccountSafety.js, functions/test/console-account-safety.test.js.

An initial deployment credential/quota issue was resolved using the existing authorized session. A verification request used the wrong region and returned 404; it was repeated against the recorded europe-west1 region successfully. These did not modify production data or service permissions.

## Changed frontend files

index.html; favicon.png; assets/favicon-dark.svg; assets/favicon-light.svg; assets/apple-touch-icon.png; assets/fonts/ubuntu-medium.ttf and UFL.txt; css/{tokens,layout,components,modules,certificates}.css; js/lang.js; js/main.js; js/modules/{shell,system,contributors,certificates,admin}.js; js/utils/{departments,loading,ui,scrollEdges}.js; tests/{browser,complete-polish,final-polish,precision,startup-i18n}.cjs; docs acceptance/audit/deployment reports.

## Limits and live verification

No requested test is intentionally left failed. Real issuing remains untested because Zapier is not configured and production issuance was forbidden. Missing/unverified/ambiguous Auth-to-profile mappings remain safely unknown; no speculative UID or database migration is introduced. Previous notification 500 investigation is outside this polish delta; this report does not claim a new notification server fix.

Frontend commit 6e69ae4 was pushed to main and published. Fourteen related production assets matched local SHA-256 hashes; real mobile TR/EN login startup passed with zero uncaught errors, failed responses or horizontal overflow. Read-only evidence is in complete-polish-live.json. The known reachable production hostname is admin.vertexishere.com; adminsite.vertexishere.com returned UNABLE_TO_VERIFY_LEAF_SIGNATURE during this run, so its live browser check is blocked by TLS; certificate verification was not disabled.
