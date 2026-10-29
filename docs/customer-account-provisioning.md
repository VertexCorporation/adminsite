# Cortex customer account management

The new Users → Status section creates standard customer accounts through Fulcrum's `createConsoleCustomerAccount` callable. It has email/name, optional Free/Plus/Pro/Ultra, 7/30/90-day or custom expiration, an optional invitation and a server preview followed by confirmation. Existing account, plan/source and disabled state are shown; existing identities and rights are preserved. Use the normal user/subscription controls after reviewing an existing account.

The form reuses current themed controls, confirmation dialog, callable Auth/App Check transport and TR/EN dictionary. Dynamic identity values are escaped in the dialog. Request IDs survive ambiguous failures. Per-stage results distinguish created/existing account, ready profile, grant, expiry scheduling, invitation not configured, SMTP acceptance and uncertainty. SMTP acceptance is never described as confirmed delivery.

`customer-activate.html` is a separate public customer landing page. It uses the public same-origin Firebase configuration and the existing bounded invitation exchange; it never loads the Console authentication initializer or grants personnel access. Its token stays in memory, is removed from history, and is never logged. It validates the destination before continuing to the existing native password handler. Expired and throttled invitations have distinct TR/EN messages. The page uses system light/dark theme and a no-referrer/no-store policy.

## Product decisions

- Subscription starts when the account is prepared. Activation-deferred trials are not implemented.
- Invitations expire within 20 hours of account creation, ahead of the existing 24-hour unverified-account cleanup. The console and email disclose this constraint. Creating without email does not bypass cleanup.
- Existing accounts never receive a new grant or password invitation through this creation flow. Prior incomplete customer jobs can resume using their original options.
- Ambiguous SMTP delivery is never automatically resent. Review account and delivery state before using the existing password-reset screen.

## Validation

- 25 targeted tests passed: creation form, safe confirmation, request identity, authorization UI guards, Free/no-mail option, activation URL validation, expiration/throttling copy, translations and existing callable/reset behavior.
- Final full adminsite test run: 221 total, 220 passed. The existing certificate-owner contract expected four awards while current source has five; this feature does not change certificates or the verifier.
- JavaScript syntax checks passed. The final immutable release builder/verifier passed: `844c37119f83`, 84 assets. Generated test snapshots are not committed; the existing release workflow will build from the merged sources.
- Local Playwright browser installation failed because downloaded Chromium archives were truncated/corrupt. No visual screenshot/mobile rendering validation is claimed. The form shares existing theme tokens; the activation page uses system theme tokens.
- No production deployment or real customer operation has been performed. See the companion Fulcrum report for backend and emulator coverage and deployment constraints.

## Publication

The form changes source modules; the current checked-in index still references its existing immutable release until the normal main-only `console-release-snapshot` workflow generates the new snapshot. Publish backend and frontend as a coordinated release. Include `customer-activate.html`, the new JS/CSS and `_headers`; verify the activation page is publicly reachable before any real invitation. Do not present an unmerged branch or local build as live Console functionality.
