# Department Cloud Functions integration

This repository contains the static admin panel, not the deployed Firebase Functions project. Copy `department-functions.cjs` into that project's functions directory and register its exports in the existing entry point:

```js
Object.assign(exports, require('./department-functions.cjs')(functions, admin));
```

Deploy `listDepartmentUsers` and `setUserDepartments` in `europe-west1`. They require an authenticated user whose ID token has `admin: true`. The list endpoint pages through Firebase Auth users and returns only accounts with department claims. The save endpoint replaces the selected departments while retaining other custom claims. It keeps the first department in the legacy `department` claim for older clients.

Other backend authorization checks and Firestore/Storage rules that currently read only `department` must also accept `departments` and use the union of each department's permissions. Until those are migrated, the first department remains the only one recognized by older backend checks. Users receive updated claims when their ID token refreshes; this panel already forces a refresh on sign-in.
