# Console source architecture

The console remains a static application with native ES modules and the existing
Firebase/Fulcrum backend contracts. Application source files must stay within
700 lines; `npm run check:architecture` enforces this in CI. Historical immutable
releases, external assets, generated output and documentation are not source
modules and are outside this limit.

## Entry points and HTML

`index.html` owns metadata, initial theme, loading and sign-in UI, the header and
the application layout. It declares `template[data-fragment]` slots for the
sidebar and workspaces:

- `partials/navigation.html`: desktop/sidebar navigation.
- `partials/panels/*.html`: one workspace per HTML fragment.
- `js/core/bootstrap.js`: mounts HTML, translates the mounted DOM, initializes
  local data export, then imports the existing Firebase initializer.
- `js/core/htmlFragments.js`: fetches fragments concurrently and mounts them
  only after every fragment has loaded and passed validation. Failed requests
  leave the slots intact, stop startup and expose a localized retry action.
- `js/core/initializer.js`: Firebase SDK/configuration startup and recovery.
- `js/main.js`: authentication, authorization and feature orchestration.

All fragments mount before feature modules evaluate their DOM references. This
is intentionally startup composition, not per-navigation lazy loading; existing
event registration, form IDs and permission gates remain available together.
HTML fragments contain markup only; executable behavior belongs in JS modules.
The previous inline export handler lives in `js/modules/dataExport.js` and keeps
the existing `window.exportDataLocal` contract.

## Localization

`js/lang.js` owns language selection, storage, fallback text, translation of the
DOM and language-change listeners. It retains the existing exported API:
`__`, `getLang`, `setLang`, `onLangChange`, `translatePage`, `translationsReady`.

`l10n/tr.js` and `l10n/en.js` compose matching feature dictionaries from their
language directories: `common`, `models`, `people`, `publishing`, `programs`,
and `system`. Add each key to both languages in the matching feature file.
Both small locale bundles load as static ES module dependencies so startup and
language switching keep their existing synchronous behavior.

## Shell and surfaces

`js/modules/shell.js` owns navigation, routes, responsive sidebar behavior,
theme/language menus, file controls and the command palette.

`js/ui/surfaces.js` owns popovers, drawers, modals, confirmations, focus trapping
and the open-surface registry. `shell.js` re-exports its public APIs so existing
feature imports continue to work. Surface state has a single owner.

## Models

`js/modules/models.js` owns one feature state object, catalogue refresh and
event wiring. Feature factories receive state and explicit callbacks; they do
not import the orchestration module back:

| Module | Responsibility |
| --- | --- |
| `models/form.js` | Create/edit form, image upload and chat-format fields |
| `models/catalog.js` | Manual list, catalogue index, filters and action menus |
| `models/translations.js` | Model and series translation editors and saves |
| `models/actions.js` | Delete/block models, durable image cleanup and series visibility |
| `models/constants.js` | API URLs, model types and chat-format templates |
| `models/access.js` | Shared permission checks |

The orchestration entry point keeps `initModelsModule` and
`fetchFullModelsData` exports. Curator API payloads, server image-cleanup order,
permission checks and backend endpoints are unchanged.

## Releases and verification

`scripts/source-files.cjs` is the shared inventory for release generation and
verification: `js/`, `css/`, `l10n/`, `partials/`, the font and Firebase config.
`node scripts/release.cjs` writes a content-addressed snapshot and updates the
HTML import map. `node scripts/verify-release.cjs` checks its hash, import map
and every immutable byte against current source. Fragment URLs resolve from
their loader module so markup and code come from the same immutable release.
Never edit `assets/releases/` by hand.

Useful checks:

```bash
npm run check:architecture
npm run check:syntax
node scripts/release.cjs
npm run verify:release
node --test tests/html-fragments.test.cjs tests/i18n.test.cjs
node tests/architecture-browser.cjs
```

The browser architecture suite uses synthetic Auth and service data and covers
both languages, complete fragment mounting, catalogue filtering, the offline
model form, translation saves, language switching and atomic failure recovery.
Four existing backend-contract suites require the private Fulcrum checkout;
the console CI continues to run these separately in Fulcrum as documented in
the workflow. Source-contract tests use `tests/helpers/console-source.cjs` to
inspect logical features across module boundaries. Browser tests load the real
ES module graph and actual HTML fragments.

The report workspace's UI, storage model and behavior are unchanged in this
refactor; its functional redesign is a separate change.
