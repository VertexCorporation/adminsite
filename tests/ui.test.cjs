const {readConsoleSource} = require('./helpers/console-source.cjs');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = readConsoleSource;
test('central ui sheets are included in the release source',()=>{
 const html=read('index.html');
 for(const name of ['controls','overlay','toast','scroll','layout']){
  assert.ok(html.includes('css/ui/'+name+'.css'));
  assert.ok(read('css/ui/'+name+'.css').length>100);
 }
});
test('toast slots avoid clipped host and transform conflicts',()=>{
 assert.match(read('css/ui/toast.css'), /#toast-container\s*\s*\{\s*[\s\S]*overflow\s*:\s* visible/);
 assert.match(read('js/ui/toast.js'), /slot\.animate/);
 assert.match(read('js/ui/toast.js'), /slot\.appendChild\s*\(\s*toast\s*\)\s*/);
 assert.doesNotMatch(read('css/components.css'), /#toast-container\s*\s*\{\s*/);
});
test('overlay cleanup uses CSS motion and lifecycle events',()=>{
 assert.match(read('js/modules/shell.js'), /afterMotion\s*\(\s*root/);
 assert.match(read('js/ui/motion.js'), /getComputedStyle\s*\(\s*element\s*\)\s*/);
 assert.match(read('js/ui/motion.js'), /transitionend/);
});
test('long applicant filters retain an optimized visible crossfade',()=>{
 const src=read('js/ui/transition.js');
 assert.match(src,/contributor-table-rows/);
 assert.match(src,/rows\.children\.length > 0/);
 assert.match(src,/snapshot\.appendChild/);
 assert.doesNotMatch(src,/oldChildren\.length > 0[^;]+container\.querySelectorAll\s*\(\s*'\*'\s*\)\s*\.length < 140\s*;\s*/);
});

test('content crossfade preserves stale data but workspace navigation never clones old cards',()=>{
 assert.match(read('js/utils/loading.js'),/crossfade\s*\(\s*container/);
 assert.match(read('js/utils/loading.js'),/if \s*\(\s*stale && container\.children\.length\s*\)\s*/);
 assert.match(read('js/ui/transition.js'),/ghost\.inert \s*=\s* true/);
 assert.doesNotMatch(read('js/modules/views.js'),/crossfade\s*\(\s*host\s*,\s* update/);
});
test('scroll observer handles horizontal and vertical internal regions',()=>{
 const src=read('js/utils/scrollEdges.js');
 for(const value of ['ResizeObserver','MutationObserver','fogLeft','fogRight','removeEventListener'])
  assert.ok(src.includes(value));
});

test('action state module supports loading, success and failure',()=>{
 const src=read('js/ui/controls.js');
 assert.match(src,/new WeakMap/);
 for(const state of ['idle','loading','success','error'])assert.ok(src.includes("'"+state+"'"));
 assert.match(read('js/utils/loading.js'),/setButtonState\s*\(\s*btn/);
});

test('navigation and scroll enhancements preserve all module families',()=>{
 const main=read('js/main.js');
 assert.match(main,/initUiFeedback\s*\(\s*\s*\)\s*/);
 const nav=read('js/modules/shell.js');
 assert.match(nav,/lockScroll\s*\(\s*'navigation'\s*\)\s*/);
 assert.match(nav,/unlockScroll\s*\(\s*'navigation'\s*\)\s*/);
 assert.match(nav,/animateViewEntry\s*\(\s*target\s*\)\s*/);
 const scroller=read('js/utils/scrollEdges.js');
 for(const selector of ['chat-messages','people-table-wrap','dept-perms-table','sidebar-scroll','vx-modal-body'])
    assert.ok(scroller.includes(selector),selector);
 assert.match(read('css/ui/scroll.css'),/-webkit-mask-composite\s*:\s*source-in/);
});

test('list refresh transitions are centralized across modules',()=>{
 for(const name of ['news','notification','subscriptions','siteTeam','consoleChat']){
  const source=read('js/modules/'+name+'.js');
  assert.match(source,/import \s*\{\s* crossfade \s*\}\s* from '\.\.\/ui\/transition\.js'/,name);
  assert.match(source,/crossfade\s*\(\s*/,name);
 }
});

test('motion and controls have one style owner rather than layered overrides',()=>{
 const stabilization=read('css/layout/interaction.css');
 assert.doesNotMatch(stabilization,/^\.button-pending/m);
 assert.doesNotMatch(stabilization,/@keyframes iconSweep/);
 assert.doesNotMatch(stabilization,/@keyframes workspaceEnter/);
 assert.match(read('css/ui/controls.css'),/@keyframes iconSweep/);
 assert.match(read('css/motion.css'),/@keyframes workspaceEnter/);
});

test('models and administration use the centralized async action state',()=>{
 for(const name of ['admin','models']){
   const src=read('js/modules/'+name+'.js');
   assert.match(src,/setButtonLoading\s*\(\s*/);
 }
 const models=read('js/modules/models.js');
 assert.doesNotMatch(models,/saveButton\.disabled \s*=\s* true/);
});

test('overlay and confirm dialog styles live in one sheet with correct stacking',()=>{
 const overlay=read('css/ui/overlay.css');
 const components=read('css/components.css');
 const modules=read('css/modules.css');
 assert.match(overlay,/z-index\s*:\s* 139/);
 assert.match(overlay,/\.confirm-dialog-footer/);
 assert.match(overlay,/\.vx-drawer-footer\s*:\s*has\s*\(\s*\[data-more\]\s*\)\s*/);
 assert.doesNotMatch(components,/\.vx-overlay\s*\s*\{\s*/);
 assert.doesNotMatch(components,/\.confirm-dialog-footer/);
 assert.doesNotMatch(modules,/\.vx-drawer-footer\s*:\s*has\s*\(\s*\[data-more\]\s*\)\s*/);
});

test('retry states keep stale business data and never display raw server messages',()=>{
 const states=read('js/ui/states.js');
 assert.match(states,/staleSelector/);
 assert.match(states,/textContent/);
 assert.match(states,/setButtonState\s*\(\s*button\s*,\s*'loading'\s*\)\s*/);
 for(const name of ['admin','subscriptions','siteTeam','consoleChat','news']){
  const src=read('js/modules/'+name+'.js');
  assert.match(src,/showLoadError\s*\(\s*/,name);
 }
 assert.doesNotMatch(read('js/modules/siteTeam.js'),/escapeHTML\s*\(\s*error\.message\s*\)\s*/);
});

test('page and workspace navigation do not run competing translations',()=>{
 assert.doesNotMatch(read('css/layout.css'),/\.tab-panel\s*\s*\{\s*[^}]*animation\s*:\s*/);
 const nav=read('js/ui/transition.js');
 assert.match(nav,/ui-tab-entering/);
 const views=read('js/modules/views.js');
 assert.match(views,/const enteringTab \s*=\s* tab\.classList\.contains\s*\(\s*'ui-tab-entering'\s*\)\s*/);
 assert.doesNotMatch(views,/crossfade\s*\(\s*host\s*,\s* update/);
});
test('generic long lists use bounded visual snapshots, not animation suppression',()=>{
 const transition=read('js/ui/transition.js');
 assert.match(transition,/function boundedClone\s*\(\s*/);
 assert.match(transition,/largeList \? boundedClone\s*\(\s*child\s*,\s* budget\s*\)\s*/);
 assert.doesNotMatch(transition,/\s*\(\s*denseList \|\| container\.querySelectorAll\s*\(\s*'\*'\s*\)\s*\.length < 140\s*\)\s*/);
});

test('contributor editing and manual applicant intake share safe async button states',()=>{
 const contributor=read('js/modules/contributors.js');
 const intake=read('js/modules/manualApplication.js');
 assert.match(contributor,/setButtonLoading\s*\(\s*submitBtn\s*,\s*true\s*\)\s*/);
 assert.match(contributor,/if\s*\(\s*submitBtn\.isConnected\s*\)\s*setButtonLoading\s*\(\s*submitBtn\s*,\s*false\s*\)\s*/);
 assert.doesNotMatch(contributor,/submitBtn\.disabled\s*\s*=\s*\s*true/);
 assert.match(intake,/setButtonLoading\s*\(\s*save\s*,\s*true\s*\)\s*/);
 assert.match(intake,/setButtonLoading\s*\(\s*save\s*,\s*false\s*\)\s*/);
 assert.doesNotMatch(intake,/save\.disabled\s*\s*=\s*\s*true/);
});

test('navigation never displays outgoing page snapshots',()=>{
 const transitions=read('js/ui/transition.js'), shell=read('js/modules/shell.js');
 assert.match(transitions,/export function animateViewSwitch\s*\(\s*/);
 assert.match(transitions,/mutate\s*\(\s*\s*\)\s*\s*;\s* \/\/ exactly one active tab/);
 assert.match(transitions,/to\.animate\s*\(\s*/);
 assert.doesNotMatch(transitions,/ghost\.classList\.add\s*\(\s*'ui-view-ghost'/);
 assert.match(transitions,/viewSwitches\.get\s*\(\s*host\s*\)\s*\?\.\s*\(\s*\s*\)\s*/);
 assert.match(shell,/animateViewSwitch\s*\(\s*outgoing\s*,\s*target\s*,\s*update\s*\)\s*/);
});
test('shared panel loading preserves live nodes and cancels superseded refreshes',()=>{
 const src=read('js/utils/loading.js');
 assert.match(src,/const panelLoaders \s*=\s* new WeakMap\s*\(\s*\s*\)\s*/);
 assert.match(src,/panelLoaders\.get\s*\(\s*container\s*\)\s*\?\.cancel\s*\(\s*\s*\)\s*/);
 assert.match(src,/container\.replaceChildren\s*\(\s*\.\.\.originalNodes\s*\)\s*/);
 assert.doesNotMatch(src,/container\.innerHTML \s*=\s* current/);
});
test('models and chat render via centralized crossfade, not only an entrance fade',()=>{
 for (const name of ['models','consoleChat']) {
  const src=read('js/modules/'+name+'.js');
  assert.match(src,/crossfade\s*\(\s*/,name);
 }
 const src=read('js/modules/models.js');
 assert.match(src,/crossfade\s*\(\s*dom\.manualModelsListContainer/);
 assert.match(src,/crossfade\s*\(\s*dom\.allModelsListContainer/);
});
test('async admin and notification buttons do not replace the label while pending',()=>{
 const adm=read('js/modules/admin.js'),notif=read('js/modules/notification.js');
 assert.doesNotMatch(adm,/grantBtn\.innerHTML \s*=\s* .*admin\.granting/);
 assert.doesNotMatch(notif,/submitBtn\.textContent \s*=\s* __\s*\(\s*'notif\.submitting'\s*\)\s*/);
 assert.doesNotMatch(read('js/modules/events.js'),/events-preview'[\s\S]{0\s*,\s*750}finally\s*\{\s*setButtonLoading\s*\(\s*button\s*,\s*false\s*\)\s*/);
});

test('workspace outgoing snapshots retain grid geometry and exclude hidden panels',()=>{
 const src=read('js/ui/transition.js');
 assert.match(src,/ghost\.style\.gridTemplateColumns \s*=\s* containerStyle\.gridTemplateColumns/);
 assert.match(src,/child\.hidden \|\| getComputedStyle\s*\(\s*child\s*\)\s*\.display \s*===\s* 'none'/);
});

test('events use shared content crossfade and restore registration button state',()=>{
 const src=read('js/modules/events.js');
 assert.match(src,/crossfade\s*\(\s*list\s*,\s* \s*\(\s*\s*\)\s* \s*=>\s* \s*\{\s*/);
 assert.match(src,/crossfade\s*\(\s*box\s*,\s*\s*\(\s*\s*\)\s*\s*=>\s*\s*\{\s*/);
 assert.match(src,/finally\s*\{\s*setButtonLoading\s*\(\s*button\s*,\s*false\s*\)\s*\s*;\s*\s*\}\s*\s*\}\s*\s*;\s*/);
});
test('notification listener uses central stale-data retry instead of appending errors',()=>{
 const src=read('js/modules/notification.js');
 assert.match(src,/showLoadError\s*\(\s*dom\.scheduledTasksListContainer/);
 assert.doesNotMatch(src,/insertAdjacentHTML\s*\(\s*'beforeend'\s*,\s*`<div class\s*=\s*"task-error"/);
});
test('contributors suppress skeleton flashes for sub-150ms responses',()=>{
 const src=read('js/modules/contributors.js');
 assert.doesNotMatch(src,/skeletonDelay\s*:\s*0/);
});

test('browser regressions reject intermediate pages rather than expecting them',()=>{
 const browser=read('tests/browser.cjs');
 assert.match(browser,/Navigation never displays the outgoing screen above its destination/);
 assert.match(browser,/!navMotion\.ghost&&navMotion\.incoming>0/);
});
test('legacy people directory also uses one shared loading and crossfade controller',()=>{
 const src=read('js/modules/people.js');
 assert.match(src,/const peopleLoaders \s*=\s* new WeakMap\s*\(\s*\s*\)\s*/);
 assert.match(src,/createLoadingController\s*\(\s*host/);
 assert.match(src,/loader\s*\(\s*host\s*\)\s*\.success\s*\(\s*/);
 assert.match(src,/loader\s*\(\s*host\s*\)\s*\.error\s*\(\s*/);
 assert.doesNotMatch(src,/function loading\s*\(\s*host\s*\)\s*\s*\{\s*[^}]*host\.innerHTML/);
});

test('error, empty and success states share the inert animated state renderer',()=>{
 const src=read('js/ui/states.js'), loading=read('js/utils/loading.js');
 assert.match(src,/export function renderUiState/);
 assert.match(src,/crossfade\s*\(\s*container\s*,\s* \s*\(\s*\s*\)\s* \s*=>\s* container\.replaceChildren\s*\(\s*state\s*\)\s*\s*\)\s*/);
 assert.match(src,/export function showEmptyState/);
 assert.match(src,/export function showSuccessState/);
 assert.match(loading,/showLoadError\s*\(\s*container\s*,\s* message\s*,\s* retryFn/);
 assert.match(loading,/showEmptyState\s*\(\s*container\s*,\s* title\s*,\s* description\s*\)\s*/);
});
test('scroll fog discovers dynamic internal scrollports and avoids scrolling the table header',()=>{
 const src=read('js/utils/scrollEdges.js');
 assert.match(src,/const DISCOVER \s*=\s*/);
 assert.match(src,/\[style\*\s*=\s*"overflow"\]/);
 assert.match(src,/attributeFilter\s*:\s*/);
 assert.match(src,/scrollable\s*\(\s*style\.overflowX\s*\)\s*/);
 assert.match(read('css/ui/scroll.css'),/\.contributor-table-head/);
 assert.doesNotMatch(read('css/layout/interaction.css'),/\.contributor-table-head\s*\{\s*/);
});
test('form, responsive and panel interaction owners use shared accessible states',()=>{
 const form=read('css/ui/controls.css');
 assert.match(form,/input\[type\s*=\s*["']checkbox["']\]\[role\s*=\s*["']switch["']\]\s*:\s*checked\s*::\s*after/);
 assert.match(form,/\.chip-checkbox\s*:\s*has\s*\(\s*input\s*:\s*focus-visible\s*\)\s*/);
 assert.match(read('js/ui/feedback.js'),/stopImmediatePropagation\s*\(\s*\s*\)\s*/);
 assert.match(read('css/ui/layout.css'),/--form-section-gap/);
 assert.match(read('css/ui/overlay.css'),/safe-area-inset-bottom/);
});

test('sub-navigation renders the chosen workspace before the incoming tab',()=>{
 const shell=read('js/modules/shell.js');
 assert.match(shell,/const activateTab \s*=\s* \s*\(\s*button\s*,\s* destination \s*=\s* null\s*\)\s*/);
 assert.match(shell,/destination\.setAttribute\s*\(\s*'data-nav-selected'\s*,\s* ''\s*\)\s*/);
 assert.match(shell,/activateTab\s*\(\s*parent\s*,\s* child\s*\)\s*/);
 assert.doesNotMatch(shell,/showWorkspace\s*\(\s*document\.getElementById\s*\(\s*parent\.dataset\.target\s*\)\s*\s*,\s*keys\s*\)\s*/);
});
test('applicant filters use incoming-only animation and fixed hydration viewport',()=>{
 assert.match(read('js/ui/transition.js'),/mode \s*===\s* 'enter'/);
 assert.match(read('js/utils/loading.js'),/opts\.crossfadeOptions/);
 assert.match(read('js/modules/contributors.js'),/crossfadeOptions\s*:\s*\s*\{\s*mode\s*:\s*'enter'\s*\}\s*/);
 const css=read('css/ui/layout.css');
 assert.match(css,/min-height\s*:\s* 464px/);
 assert.match(css,/overflow-anchor\s*:\s* none/);
 assert.match(read('tests/browser.cjs'),/Stable applicant viewport through delayed first hydration/);
});

test('quick navigation palette uses only currently authorized sidebar actions', () => {
 const shell=read('js/modules/shell.js');
 assert.match(shell,/function initCommandPalette\s*\(\s*\s*\)\s*/);
 assert.match(shell,/event\.key\.toLowerCase\s*\(\s*\s*\)\s* !\s*==\s* 'k'/);
 assert.match(shell,/hasOpenSurface\s*\(\s*\s*\)\s*/);
 assert.match(shell,/\.nav-module \.dock-btn\s*,\s* \.nav-module \[data-nav-panel\]/);
 assert.match(shell,/getEffectivePanelLevel\s*\(\s*key\s*\)\s* !\s*==\s* 'none'/);
 assert.match(shell,/closeModal\s*\(\s*\s*\)\s*/);
 assert.match(shell,/initCommandPalette\s*\(\s*\s*\)\s*/);
});
