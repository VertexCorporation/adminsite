# Vertex roster integration

The existing Applications workspace opens a drawer for the 61-number roster. There is no new page or framework. It shares the existing buttons, drawer, confirmation, theme and mobile layout. TR/EN labels are included. Input and results remain in memory; CSV export is explicit. Do not upload a roster, preview or report to GitHub, CI or public storage.

## Existing architecture and root cause

- `contributors` stores applications (`phone`, `email`, `department`, `createdAt`). Application `createdAt` is not Auth creation time or `users.createdAt`.
- The application Vertex button requires an administrator and `membership.status === matched`. It does not inspect admission dates. GitHub Fulcrum main did not return `membership`; the local recovery implementation also rejected otherwise verified accounts when `users.isVertex` was absent. The companion Fulcrum PR returns verified email-to-Auth UID mappings and treats absent membership as inactive, while rejecting malformed values.
- `contributors.joinedAt` is the admission date consumed by the existing certificate UI/service. The bulk migration uses existing admission provenance/history fields plus an explicit `joinedAtSource` marker for estimates.
- `users/{authUid}.isVertex` is membership authority. A contributor document ID is never used as an Auth UID. Normal changes now use an explicit desired state, preventing a retry from becoming an accidental inverse toggle.
- `views.js` retains existing workspace routing. `roles.js` combines `departments`/legacy `department` claims with `config/departmentPermissions`; the best panel level wins. Department identifiers are canonicalized using the panel's existing case/space/hyphen/underscore normalization. Unknown identifiers remain review items.
- `server/department-functions.cjs` is a legacy drop-in, not the deployed Cortex subscription authority. Fulcrum owns production callables. The department catalogs differ; no new department or administrator role is invented here.
- Current person/staff presentation uses approved contributors and `siteTeam` moderator entries. A name-only staff entry cannot safely link an account. Existing Auth claims are retained; membership alone never grants a department-manager claim.
- Existing subscription controls call Fulcrum `adminSubscriptions.js`; the new roster never invokes generic paid/admin grant replacement. It uses a separate signed sponsor source resolved by Fulcrum's canonical subscription and credit systems. The existing subscriptions list labels sponsor access separately and hides generic paid-subscription removal for sponsor-only rows.

## Flow and application boundary

1. Paste exactly 61 unique primary Turkish mobile numbers, one per line (newline/semicolon/comma separators supported). Only full normalized numbers match.
2. Analyze. The server scans applications, user identity fields and paginated Auth identities. No Firestore/Auth writes occur. Missing/unverified/ambiguous identities, conflicting/unknown departments and invalid dates are review items. Outsiders stay active.
3. Inspect current/proposed membership and admission dates, subscription eligibility and role proposals. Export the private CSV if needed.
4. The operator separately approves the exact preview digest in Fulcrum. The application action checks approval before confirmation. Any target state drift requires a new preview and approval. The current implementation does not automatically assign new department claims because no separate least-privilege member mapping exists.
5. Apply once: only ready rows are committed together. Admission-date estimates, activation, signed sponsorship and audit writes are atomic. A failed transaction changes nothing; completed-run receipts make repeat execution a no-op.

The client allows longer timeouts only for roster analysis/application because scanning the existing account population exceeds the normal callable timeout. Ordinary callables keep their existing timeout and no automatic write retries.

## Delivery and verification

Requires the related Fulcrum PR. The Cortex companion PR makes the sponsor entitlement visible in its shared subscription model; server verification remains authoritative.

- Unit tests: `npm test`.
- Roster browser integration: `CHROME_PATH=... node tests/vertex-roster-browser.cjs` (all external services mocked).
- Existing relevant browser regression: `VERTEX_STABILIZATION_ONLY=1 VERTEX_QUICK=1 CHROME_PATH=... node tests/browser.cjs`.
- `node scripts/release.cjs` generates the immutable assets selected by the existing HTML import map. Editing only source modules would not ship a working feature; the generated release is included.

No production deployment or member/subscription mutation is part of these PRs. Full production analysis and the supplied roster are stored separately in an owner-only directory outside all repositories.
