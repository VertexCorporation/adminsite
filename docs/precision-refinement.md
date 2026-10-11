# vertex control precision refinement

The refinement uses the tested vanilla JavaScript reconstruction at bbc3e01. The current ZIP replacement on origin/main was reviewed independently: all functional HTML IDs are retained. Its only absent IDs are ascii-ripple, login-slats and theme-toggle-btn; the decorative effects remain removed and the theme control uses the existing shared theme-menu-btn. No new framework, backend schema or callable contract was introduced.

## function inventory

| workspace | retained function | entry point |
| --- | --- | --- |
| contributors | applications, combined filters, details and editing | workspace → contributors → applicants; existing row actions |
| contributors | vertex access status | workspace → contributors → vertex status |
| certificates | four awards, final confirmation, joining date, history, retry and revoke | workspace → contributors → certificates; participant award button |
| models | catalog, model form, model actions and translations | workspace → models → model catalog / manage models; existing drawer and action menus |
| news | published articles, editor and image upload | workspace → news → published / editor |
| notifications | composing and scheduling, scheduled list and cancellation | operations → notifications → compose / scheduled |
| subscriptions | assignment, active subscriptions, bulk assignment and removal | operations → subscriptions → assign / active subscriptions; form bulk control |
| chat | channels, messages, posting and administration | operations → chat; channel controls |
| system | department permissions and panel overrides | administration → system → permissions |
| system | department assignment and department user list | administration → system → departments |
| system | grant, remove and list administrators | administration → system → administrators |
| system | manual verification and site team records | administration → system → verification |
| system | maintenance, server status and backup information | administration → system → server & maintenance |
| system | exports and attribution publishing | administration → system → exports / attributions; existing system section controls |
| profile | account details and profile update | sidebar footer; account menu → profile |

Navigation preserves data-target, data-panel, callable payloads and none/read/write policies. Permission-specific children are hidden; model editing requires write access, certificate administration requires admin status, and the permissions editor remains admin-only.

## design and interaction

Dark tokens use the supplied neutral baseline, explicitly treated as Vertex design targets rather than official ElevenLabs tokens. Light/System remain supported. The sidebar is 256px with three groups and one expanded module, without the active vertical stripe. Topbar controls share a 38px outline family. Language, theme and account use the shared anchored popover with selected states, keyboard navigation and focus restoration.

The permission matrix uses the same grid template for headers and actual dept-perm-row elements. Levels have visible text. Department presets use a contextual menu. Panel-specific configuration uses a catalog on the left and department access/content/filter visibility on the right. Saving is serialized from cloned snapshots; a rejected draft restores the last acknowledged state without showing success.

Existing loading geometry, stale response guards, reduced motion and certificate/notification duplicate protection are retained. Popovers and drawers become inert during animated exits. Mobile navigation traps focus, makes the background inert, restores focus, and survives height-only viewport changes.

The current ElevenLabs application was not accessed; its live motion was not claimed to be directly observed. The supplied palette and detailed specification guided this refinement.

## final verification

35 browser check groups passed, covering six widths (360, 390, 768, 1024, 1440 and 1920), dark/light/system, eight modules, authenticated mock role transitions, permission failure rollback, certificates, notifications, uploads, subscriptions, chat, loading and reduced motion. No uncaught or unexpected console errors occurred. 72 screenshots and a Playwright trace are saved under tests/results; generated artifacts are ignored by Git. The department adapter passed 4 tests. All application JavaScript syntax checks and git diff whitespace checks passed.

All mutations were intercepted by mock services. No real notification or certificate was sent, and no production permission policy or backend schema was changed for this refinement.
