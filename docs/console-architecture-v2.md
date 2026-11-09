# Console architecture and deployment

The console uses native ES modules. Navigation lives in `modules/shell.js`; theme/menu controls live in `ui/appearance.js`, and keyboard navigation in `ui/commandPalette.js`. HTML fragments define layout; controllers
bind behavior; feature services call Vertex's existing backend; area stores own
loaded data. `core/session.js` invalidates stores on identity or access-revision
changes and rejects responses captured in an older session. Exporters read from
the owning stores and require both exporter and source-area access.

## Reports

The standalone `reports/index.html`, iframe, duplicated auth state, public seed,
local persistence and whole-workspace autosave are removed. Old /reports URLs redirect to the authenticated Console report workspace. The Reports sidebar
expands Department → Overview / Daily / People / Tasks / Weekly. The native
controller, renderers, editor, service and store are separate modules. Members
read their assigned departments; Core edits all; moderators/chefs edit their own
primary department. The server's `canEdit` governs controls; generic read-only
panel handling leaves report navigation and week filters usable.

The corresponding Fulcrum change is PR #97. Deploy its six report callables and
Firestore rules **before** publishing this frontend. Each entry/task is a
separate document. The first authorized department read performs a leased,
resumable migration; old documents remain preserved. See Fulcrum's
`docs/console-reports-v2.md` for schema, roles, historical-name reconciliation and
rollback instructions. This frontend fails closed if the server returns an old
schema. No migration runs as part of the static build.

## Localization

`lang.js` orchestrates `l10n/tr.js` and `l10n/en.js`, each composed of feature
files. UI copy belongs only in those dictionaries, including placeholders,
accessible names, modal labels, notifications, empty states and export headings.
Keys identify their owning feature; runtime content and protocol identifiers
remain data. `formatMessage` interpolates named placeholders. Do not translate
CSS class names, selection attributes, database keys or tokenizer tokens.

`check:localization` parses JS and HTML, detects literal UI assignments/markup,
inline language branches, unlocalized attributes, duplicate/empty dictionary
keys and TR/EN placeholder mismatch. `audit:i18n` validates static references.
The runtime suite additionally switches language and renders actual modules.
These automated scans target defined UI sinks; new rendering APIs must extend
the audit rather than bypass it.

## Styles

| Owner | Responsibility |
| --- | --- |
| `css/tokens.css` | Shared colors, typography and spacing |
| `css/base.css` | Document baseline |
| `css/layout/` | Login, shell, responsive grid and interaction layout |
| `css/components/`, `css/ui/` | Shared controls, forms, cards, overlays, focus, motion and states |
| `css/modules/`, `css/reports.css`, `css/home.css` | Feature-scoped presentation |
| Root `layout.css`, `components.css`, `modules.css`, `certificates.css` | Ordered import entry points |

The former `stabilization.css` is now the explicitly scoped
`layout/interaction.css`; generic fixes must go to the owning component rather
than a new override file. Feature selectors must stay under their feature root.
The split preserves the existing cascade order. Source JS/CSS/HTML is formatted
by the pinned formatter and checked against a 700-line limit.

## Reproducible build

Run `npm ci`, `npm run build`, then `npm run verify:release`. Configure static
hosting's build command as `npm run build` and output directory as `dist`.
The build copies one content-addressed runtime to `dist/assets/runtime/<hash>`
and creates an import map for both entry points. The source checkout is never
modified. All 141 checked-in release snapshots are deleted. The old workflow
that committed snapshots back to main now uploads a temporary build artifact;
it has read-only GitHub permissions and cannot recreate repository snapshots.
The package lock contains exact resolved dependencies and registry integrities.

## Validation

`npm test` runs all repository-local suites. Four existing certificate/Zapier
contract suites require the private Fulcrum fixture and continue running in the
existing private cross-repository CI. No test failures are masked. Legacy
function-extraction tests now select syntax nodes instead of indentation or
compressed spelling; retained structural assertions tolerate formatting. Native
DOM tests exercise session invalidation, export access, report pagination,
stale department responses, escaping, localization, nested navigation and
save/conflict acknowledgement. Browser CI runs the existing whole-console
regressions plus TR/EN member/moderator/Core report flows.
