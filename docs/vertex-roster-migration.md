# Contributor membership and roster migration

The applications screen uses flat `contributors/{documentId}` documents. Production inspection found root `phone`, `name`, `email`, `department` and `createdAt` fields; there was no nested `applications` field or subcollection. A Contributor document is the application record. `interviewBookingUid` identifies an interview booking and must not be treated as a user UID.

The old membership button resolved an email through Firebase Auth and gated activation on a Cortex profile. That was the wrong identity source for this workflow. The Contributor endpoint now reads only Contributors, including records missing createdAt, and reports independent Contributor membership metadata. Neither a Cortex profile, verified email, department nor a joining date is an activation prerequisite.

`contributors/{documentId}.isVertex` is now the canonical field for this workflow. This is an explicit schema correction: the field was absent in the inspected production records, while the old button wrote account membership elsewhere. No nested application field is invented and no account field is mirrored.

## Identity and writes

`phoneTR.cjs` is the shared server normalizer, also used by the previous roster policy and future application create/edit paths. It accepts equivalent full Turkish mobile strings, Unicode whitespace/format marks and parentheses/dashes. It rejects numeric input, ambiguous/incomplete numbers, letters and extensions. Exact normalized primary phone matches only; duplicate applications, conflicting cached canonical phones or non-boolean membership fields require review. No name similarity or unverified email fallback is used. Production records had no trustworthy Contributor-to-application references beyond the same document.

`previewContributorRoster` is read-only and admin-only. `applyContributorRoster` recalculates the 61-number plan inside a transaction and compares its digest with the preview. `setContributorVertexStatus` is the admin-only single-record path with expected field presence/status checks. Both write only `isVertex` to the Contributor and create server-only `contributorMembershipRuns` audit records. Every date and other field is preserved, including on reactivation. Missing flags and false flags are activatable. Retrying an unchanged desired state does not generate another entitlement or audit change. No permissions, paid access, Cortex data or Authentication account is changed.

Audit records use a separate server-only collection, covered by the existing default-deny rules. They must never be stored under the publicly readable Contributors collection. No rule changes or deployment are part of this correction. Ship backend callables before switching the UI assets; the code in the Draft PR is not deployed by this operation.

## Approved production maintenance

The explicitly authorized Contributor-only maintenance was applied to the verified `vertex-ai-1618` default database. All 241 Contributor documents were scanned; 52 roster phones matched exactly one application, 9 matched none and none were ambiguous. All 52 flags were initially absent and were created as true. No false flag or previously true flag was encountered. The 52 true values were reread, every other field compared against its before-image, and a repeat plan produced zero writes.

The REST maintenance commit builder is project/path constrained, uses updateTime preconditions, an isVertex-only field mask, and atomically creates the run/change audit records. Private input, before-images, commit receipt and all 61 report rows are kept outside Git in an administrator-only directory. No personal data belongs in this PR, logs or CI artifacts. The missing nine applications must be obtained from their owners; no guessed documents were created.

## Validation

Contributor policy/service and maintenance-builder tests cover normalization, invisible characters, duplicates, conflicting identity, missing/false/true flags, date preservation, no account access, admin gating, stale previews, transaction failure and idempotent replay. Existing roster regression tests remain applicable to their separate legacy account workflow, which is no longer called from the applications drawer. Admin unit/CSV tests and the mocked browser test cover the Contributor request payload, 61-row preview/export, missing-field button activation and mobile/light/dark behavior.
