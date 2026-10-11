# i18n startup reliability — 2026-10-11

## Cause and changes

Localization previously ran at the end of `startApp`, behind SDK/configuration loading and synchronous feature initialization. An unguarded storage read or invalid locale could prevent the language module from evaluating or throw during missing-key fallback. A static import of the entire app also placed module evaluation failures outside the bootstrap error boundary.

The standalone language entry now translates at DOM ready, independently of Firebase/authentication. The initializer waits only for that local translation readiness before loading SDKs and configuration, and dynamically imports the app inside its error boundary. Storage reads/writes are optional; unsupported locales use Turkish. Missing translations produce `Kullanılamıyor`/`Unavailable` in the current language, with deduplicated diagnostics on localhost. Prototype property names cannot masquerade as locales or translations.

The existing Soft Sweep animation remains unchanged. Initial translations precede loader dismissal. SDK/configuration requests and overall startup are bounded; failures show a localized, keyboard-focused retry screen. A late auth callback cannot reveal the app after a startup timeout. Corrupt or inaccessible session caches fall back to the configuration request.

Page controllers own dynamic browser titles; generic translation cannot reset them. Navigation changes and locale changes synchronize the active page/browser title. Tooltip, placeholder, accessible-label and declarative open-surface text updates remain supported. Existing localized toasts now use render callbacks, updating while visible and unsubscribing on removal. Persistent module empty/error labels are declarative; raw server errors are replaced with localized error categories. Existing form-preservation callbacks remain intact.

## Key audit

`i18n-duplicates.json` records 10 repeated keys per language (20 duplicate declarations removed), preserving the previously effective last value. `i18n-key-audit.json` scans repository HTML/JS, records 712 dictionary keys, 575 distinct static translation references, 13 dynamic expressions and no missing static references. It separately records variable/catalogue key usage and 37 unreferenced candidates. Candidates are retained because absence from static references alone does not establish that deletion is safe.

## Validation

- Seven unit tests pass: parity, complete static reference scan, no duplicates, denied/invalid storage, current-language fallback and diagnostics, dynamic-title ownership, branding.
- Real initializer Playwright suite: 15 cases each in Chromium and WebKit. Clean profile, existing admin session, Turkish, English, invalid locale, denied localStorage, slow SDK, SDK failure, config failure, feature initializer exception, module evaluation failure, startup timeout, corrupt cache, denied sessionStorage, locale change plus refresh. Remote services are mocked; no user notifications or certificate delivery occur.
- Visible declarative texts match the active dictionary; navigation labels are nonempty. Failure screens switch locale, expose retry and focus it. Existing-session checks also cover active/browser title and live toast translation.
- Existing Chromium product suite passes 18 groups, including the seven-viewport TR/EN dark/light matrix, overlays, permissions, certificates, forms, auth and reduced motion. A final two-viewport spot run covers the subsequent dynamic-status changes.
- All JavaScript module syntax and Git whitespace checks pass. Screenshots inspected: mobile retry screen and desktop admin page, including the stale-language toast discovered and corrected during inspection.

## Scope

No backend, Firebase IAM/secrets, production data, or notification delivery changes. The previously observed production App Check attestation failure remains outside this frontend fix; mocked authenticated coverage does not establish production authenticated access.
