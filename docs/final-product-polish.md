# Final product polish — 2026-10-11

The existing vanilla JavaScript console and neutral design were preserved. Checkpoint: `checkpoint/final-polish-20261011` at `0340fff`. Previous production Pages deployment: `7d0a4b4f-a91d-4c7e-8f9b-47cab4b2e3ed`, source `0340fff`, URL https://7d0a4b4f.adminsite-b1x.pages.dev.

## Changes and verified root causes

- `index.html`, `assets/vertex-logo.svg`, `css/layout.css`, `js/main.js`: product identity is VERTEX KONSOL in both locales. Official logo copied without geometric edits; SHA-256 matches the GitHub source: `ca3fecabb21bc698cbd9da826a2bae140db57380ba7dc497c72428b6e2b5945b`. Exact 2100 ms Soft Sweep uses the two images and gradient mask. Bootstrap exits after the first auth view, with 180 ms opacity transition and a removal fallback.
- `shell.js` and layout tokens: parent/child surfaces separated, 5 px submenu spacing, remembered child selection, full language names, compact theme menu, five-button mobile dock. Drawer menus previously sat behind the drawer because popovers had z-index 95 while drawers used 130; attached menus now use 135 and preserve their drawer.
- `contributors.js` and `modules.css`: sticky shared table header/row scroll area fixes a measured 3 px status-axis error. Text and column centering are checked with browser bounding boxes in both languages. Department names use a display helper. Biography participates in search; hidden contact/about fields do not.
- Contributor drawer has a sticky action toolbar, edit action, certificate management and a contextual verification/delete menu. Verification only changes its displayed state after the callable resolves, blocks repeats and retains the previous state on failure. Deletion requires a separate explicit irreversible confirmation.
- Certificates navigation previously clicked the first participant's award control. It now opens a recipient search/selection drawer and passes the selected ID to the existing certificate flow. Four types, final confirmation, history, joining-date editor and processing/failed/uncertain/revoked safeguards remain intact.
- `admin.js`: maintenance fetch failures previously kept the checking label, disabled retry and replaced the shared button class with `secondary-btn`. Explicit off/on/unknown states, working read retry, write permission gate, pending state and confirmation now replace that behavior. Initial status fetch runs after authorized auth readiness.
- Vertex status validates UID and confirms the toggle. It displays the submitted UID and actual returned boolean. There is no current-status lookup contract in the existing toggle callable; the confirmation explains that limitation instead of inventing a pre-operation status.
- `lang.js`, `ui.js`, admin/models/news/notifications/chat/contributors: aligned locale key sets, development missing-key diagnostics, native topbar language names, localized dynamic labels/dates and safe remote error messages. Profile language changes previously reloaded the input from the account and erased an unsaved name; locale repaint now preserves the draft. Restored action labels, contributor editor fields and model translation labels update without resetting form inputs.

All prior static DOM IDs and the 21-panel permission catalog were preserved. No framework change, backend deployment, secrets/schema/production-data change, real certificate, notification, subscription, permission or maintenance write was performed.

## Verification

- `node --test tests/i18n.test.cjs server/department-functions.test.cjs`: 9 passed. Locale parity/nonempty values, literal DOM/module key references, critical reset labels, brand identity and unknown-key development/production handling are covered.
- All JavaScript/test syntax checks and `git diff --check` passed.
- Chrome and Safari WebKit full mock regression suites passed 42 groups each; separate final regression runs passed 18 groups in each engine and verify subsequent profile/action localization changes and preserve the unsaved drafts. The final toolbar adjustment also passed 18 Chrome spot-check groups.
- Exact matrix: 320×700, 360×800, 390×844, 768×1024, 1024×768, 1440×900 and 1920×1080; TR/EN × Dark/Light, plus System and reduced motion. Each engine generated 224 module screenshots and 28 contributor drawer screenshots, with additional certificate/permission/menu captures. Selected mobile and desktop, light/dark screenshots were visually inspected; bounds/overflow, text centering and access policies are also asserted.
- All remote mutation traffic was intercepted. Deliberate 500/503 fixtures test uncertainty, rollback and retry; unexpected app console errors and uncaught errors are strict failures.
- The first WebKit attempt found an incorrect CSS MIME type in the font mock; the mock was corrected and the full WebKit suite was rerun successfully.

Commands use `CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser` or `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/vertex-playwright VERTEX_BROWSER=webkit npm run test:browser`. `VERTEX_POLISH_ONLY=1` runs the final polish, permission/auth and responsive regressions; `VERTEX_QUICK=1` narrows only the visual matrix to the final 320/1440 spot checks.

## Production boundaries

The supplied https://adminsite.vertexishere.com fails strict Chrome TLS validation with `ERR_CERT_AUTHORITY_INVALID`; Node also reports `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. No TLS bypass or unrelated domain/account change was made. The configured existing Pages production domain https://admin.vertexishere.com is accessible.

The earlier production App Check attestation 403 is documented in `precision-refinement.md`. A mock pass does not establish authenticated production operations. Publication and read-only live verification results are recorded separately after the push.
