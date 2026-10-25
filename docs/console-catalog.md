# Console catalog migration

The sidebar has seven work areas: Users, Applicants, Services, Publications,
Subscriptions, Stage, and System. Home, Chat, and Profile are independent entries.

Existing backend permission keys are retained. Publications groups `news.*`,
`events.*`, and `notifications.*`. Stage exposes separate honor, chefs, and
stars screens using the existing `system.teamLog` authorization contract.
No department gains access from a category rename. All `users.*` screens remain
Core-only. Legacy user-directory and membership URLs redirect to Users; the old
System verification route containing teamLog redirects to the honor roll.

Users requests `listConsoleUsers` with `pageSize:100`. The server provides cursor
pagination; only the current batch is hydrated. Search accepts an exact email or
UID, not partial names. Users without a Firestore profile are included through the
Auth-backed directory. Initial directory preparation is an explicit operation and
supports stopping between batches. Counts come from directory aggregation, not
from the current page or an Auth-wide scan on each refresh.

Account Status offers ban/unban, email verification, account deletion, Vertex
approval, and password reset. Vertex approval opens the matching application and
uses its existing membership action. Deletion retains exact-email confirmation
and the existing deferred deletion flow. Password resets use Firebase's normal
email flow and require a confirmed user action. Subscription assignment receives
the selected user's email/name and offers a return link without losing list state.

## Coordinated rollout

Deploy the companion Fulcrum changes before publishing this UI:
`listConsoleUsers`, `getConsoleUserStatistics`, `setConsoleAccountDisabled`,
and `verifyUserEmail`. Ensure the existing Auth-create/delete directory triggers
are deployed and the directory is complete. No endpoint or index preparation was
executed against production as part of implementation.

Run `node scripts/release.cjs` and `node scripts/verify-release.cjs` to build and
verify the immutable frontend assets. CI also runs the catalog browser suite.

Validation includes repository-local unit tests, the catalog browser flow at
390/768/1440px in light/dark mode, the legacy browser regression, and backend unit
coverage for 100-account cursors, old 50-account clients, expiry, Core authorization,
ban audit/session revocation, and deletion/Core-account protections. Browser
fixtures use synthetic accounts and intercept all service requests.
