# Department Cloud Functions integration

This repository contains the static admin panel, not the deployed Firebase Functions project. Copy `department-functions.cjs` into that project's functions directory and register its exports in the existing entry point:

```js
Object.assign(exports, require('./department-functions.cjs')(functions, admin));
```

Deploy `listDepartmentUsers` and `setUserDepartments` in `europe-west1`. They require an authenticated user whose ID token has `admin: true`. The list endpoint pages through Firebase Auth users and returns only accounts with department claims. The save endpoint replaces the selected departments while retaining other custom claims. It keeps the first department in the legacy `department` claim for older clients.

Other backend authorization checks and Firestore/Storage rules that currently read only `department` must also accept `departments` and use the union of each department's permissions. Until those are migrated, the first department remains the only one recognized by older backend checks. Users receive updated claims when their ID token refreshes; this panel already forces a refresh on sign-in.

# Subscription Cloud Functions integration

The subscription backend no longer lives here. It is implemented in the **Fulcrum** functions project (`vertex-ai-1618`), file `functions/src/adminSubscriptions.js`, registered in `functions/index.js`, with the pure one-year-cap rules in `functions/src/adminGrantRules.js`:

- `setUserSubscription` — grants (or replaces) a promotional `plus`/`pro`/`ultra` entitlement from the panel. Writes the nested `users/{uid}.subscription` map (`mode: 'promotional'`, `source: 'admin'`, `status: 'active'`, `tier`, `expiresAt`, `updatedAt`), tier daily credits, reset markers and `creditLimits`, and schedules the standard source-agnostic expiry chain. Rejects durations beyond one calendar year and never races an active store-managed entitlement.
- `removeUserSubscription` — terminal `status: 'revoked'`, drops `expiresAt`, restores free-tier `creditLimits`.
- `listUserSubscriptions` — every `users` doc with `subscription.status == 'active'` for the panel list.

The panel calls them through `grantPremium` (`js/modules/admin.js`), which also enforces the one-year cap client-side before invoking the callable.

Deploy from the Fulcrum repository root:

```bash
firebase deploy --only functions:setUserSubscription,functions:removeUserSubscription,functions:listUserSubscriptions
```
