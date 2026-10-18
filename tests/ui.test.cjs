const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
test('central ui sheets are included in the release source',()=>{
 const html=read('index.html');
 for(const name of ['controls','overlay','toast','scroll','layout']){
  assert.ok(html.includes('css/ui/'+name+'.css'));
  assert.ok(read('css/ui/'+name+'.css').length>100);
 }
});
test('toast slots avoid clipped host and transform conflicts',()=>{
 assert.match(read('css/ui/toast.css'), /#toast-container\s*\{[\s\S]*overflow: visible/);
 assert.match(read('js/ui/toast.js'), /slot\.animate/);
 assert.match(read('js/ui/toast.js'), /slot\.appendChild\(toast\)/);
 assert.doesNotMatch(read('css/components.css'), /#toast-container\s*\{/);
});
test('overlay cleanup uses CSS motion and lifecycle events',()=>{
 assert.match(read('js/modules/shell.js'), /afterMotion\(root/);
 assert.match(read('js/ui/motion.js'), /getComputedStyle\(element\)/);
 assert.match(read('js/ui/motion.js'), /transitionend/);
});
test('long applicant filters retain an optimized visible crossfade',()=>{
 const src=read('js/ui/transition.js');
 assert.match(src,/contributor-table-rows/);
 assert.match(src,/rows\.children\.length > 0/);
 assert.match(src,/snapshot\.appendChild/);
 assert.doesNotMatch(src,/oldChildren\.length > 0[^;]+container\.querySelectorAll\('\*'\)\.length < 140;/);
});

test('crossfade is visual only and stale data is preserved',()=>{
 assert.match(read('js/utils/loading.js'), /crossfade\(container/);
 assert.match(read('js/utils/loading.js'), /if \(stale && container\.children\.length\)/);
 assert.match(read('js/ui/transition.js'), /ghost\.inert = true/);
 assert.match(read('js/modules/views.js'), /crossfade\(host, update/);
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
 assert.match(read('js/utils/loading.js'),/setButtonState\(btn/);
});

test('navigation and scroll enhancements preserve all module families',()=>{
 const main=read('js/main.js');
 assert.match(main,/initUiFeedback\(\)/);
 const nav=read('js/modules/shell.js');
 assert.match(nav,/lockScroll\('navigation'\)/);
 assert.match(nav,/unlockScroll\('navigation'\)/);
 assert.match(nav,/animateViewEntry\(target\)/);
 const scroller=read('js/utils/scrollEdges.js');
 for(const selector of ['chat-messages','people-table-wrap','dept-perms-table','sidebar-scroll','vx-modal-body'])
    assert.ok(scroller.includes(selector),selector);
 assert.match(read('css/ui/scroll.css'),/-webkit-mask-composite:source-in/);
});

test('list refresh transitions are centralized across modules',()=>{
 for(const name of ['news','notification','subscriptions','siteTeam','consoleChat']){
  const source=read('js/modules/'+name+'.js');
  assert.match(source,/import \{ crossfade \} from '\.\.\/ui\/transition\.js'/,name);
  assert.match(source,/crossfade\(/,name);
 }
});

test('motion and controls have one style owner rather than layered overrides',()=>{
 const stabilization=read('css/stabilization.css');
 assert.doesNotMatch(stabilization,/^\.button-pending/m);
 assert.doesNotMatch(stabilization,/@keyframes iconSweep/);
 assert.doesNotMatch(stabilization,/@keyframes workspaceEnter/);
 assert.match(read('css/ui/controls.css'),/@keyframes iconSweep/);
 assert.match(read('css/motion.css'),/@keyframes workspaceEnter/);
});

test('models and administration use the centralized async action state',()=>{
 for(const name of ['admin','models']){
   const src=read('js/modules/'+name+'.js');
   assert.match(src,/setButtonLoading\(/);
 }
 const models=read('js/modules/models.js');
 assert.doesNotMatch(models,/saveButton\.disabled = true/);
});

test('overlay and confirm dialog styles live in one sheet with correct stacking',()=>{
 const overlay=read('css/ui/overlay.css');
 const components=read('css/components.css');
 const modules=read('css/modules.css');
 assert.match(overlay,/z-index: 139/);
 assert.match(overlay,/\.confirm-dialog-footer/);
 assert.match(overlay,/\.vx-drawer-footer:has\(\[data-more\]\)/);
 assert.doesNotMatch(components,/\.vx-overlay\s*\{/);
 assert.doesNotMatch(components,/\.confirm-dialog-footer/);
 assert.doesNotMatch(modules,/\.vx-drawer-footer:has\(\[data-more\]\)/);
});

test('retry states keep stale business data and never display raw server messages',()=>{
 const states=read('js/ui/states.js');
 assert.match(states,/staleSelector/);
 assert.match(states,/textContent/);
 assert.match(states,/setButtonState\(button,'loading'\)/);
 for(const name of ['admin','subscriptions','siteTeam','consoleChat','news']){
  const src=read('js/modules/'+name+'.js');
  assert.match(src,/showLoadError\(/,name);
 }
 assert.doesNotMatch(read('js/modules/siteTeam.js'),/escapeHTML\(error\.message\)/);
});

test('navigation and workspace do not run competing opacity animations',()=>{
 assert.doesNotMatch(read('css/layout.css'),/\.tab-panel\s*\{[^}]*animation:/);
 const nav=read('js/ui/transition.js');
 assert.match(nav,/ui-tab-entering/);
 const views=read('js/modules/views.js');
 assert.match(views,/!isSwitchingTab/);
 assert.match(views,/if \(animateWorkspace\) crossfade/);
});

test('generic long lists use bounded visual snapshots, not animation suppression',()=>{
 const transition=read('js/ui/transition.js');
 assert.match(transition,/function boundedClone\(/);
 assert.match(transition,/largeList \? boundedClone\(child, budget\)/);
 assert.doesNotMatch(transition,/\(denseList \|\| container\.querySelectorAll\('\*'\)\.length < 140\)/);
});

test('contributor editing and manual applicant intake share safe async button states',()=>{
 const contributor=read('js/modules/contributors.js');
 const intake=read('js/modules/manualApplication.js');
 assert.match(contributor,/setButtonLoading\(submitBtn,true\)/);
 assert.match(contributor,/if\(submitBtn\.isConnected\)setButtonLoading\(submitBtn,false\)/);
 assert.doesNotMatch(contributor,/submitBtn\.disabled\s*=\s*true/);
 assert.match(intake,/setButtonLoading\(save,true\)/);
 assert.match(intake,/setButtonLoading\(save,false\)/);
 assert.doesNotMatch(intake,/save\.disabled\s*=\s*true/);
});

test('navigation tabs use simultaneous outgoing and incoming animation with live DOM retained',()=>{
 const transitions=read('js/ui/transition.js');
 const shell=read('js/modules/shell.js');
 assert.match(transitions,/export function animateViewSwitch\(/);
 assert.match(transitions,/ghost\.animate\(\[\{opacity:1\},\{opacity:0\}\]/);
 assert.match(transitions,/to\.animate\(/);
 assert.match(transitions,/ghost\.inert = true/);
 assert.match(transitions,/viewSwitches\.get\(host\)\?\.\(\)/);
 assert.match(shell,/animateViewSwitch\(outgoing,target,update\)/);
 assert.doesNotMatch(shell,/if \(changed\) animateViewEntry\(target\);\s*refreshNavigation\(\)/);
});

test('shared panel loading preserves live nodes and cancels superseded refreshes',()=>{
 const src=read('js/utils/loading.js');
 assert.match(src,/const panelLoaders = new WeakMap\(\)/);
 assert.match(src,/panelLoaders\.get\(container\)\?\.cancel\(\)/);
 assert.match(src,/container\.replaceChildren\(\.\.\.originalNodes\)/);
 assert.doesNotMatch(src,/container\.innerHTML = current/);
});
test('models and chat render via centralized crossfade, not only an entrance fade',()=>{
 for (const name of ['models','consoleChat']) {
  const src=read('js/modules/'+name+'.js');
  assert.match(src,/crossfade\(/,name);
 }
 const src=read('js/modules/models.js');
 assert.match(src,/crossfade\(dom\.manualModelsListContainer/);
 assert.match(src,/crossfade\(dom\.allModelsListContainer/);
});
test('async admin and notification buttons do not replace the label while pending',()=>{
 const adm=read('js/modules/admin.js'),notif=read('js/modules/notification.js');
 assert.doesNotMatch(adm,/grantBtn\.innerHTML = .*admin\.granting/);
 assert.doesNotMatch(notif,/submitBtn\.textContent = __\('notif\.submitting'\)/);
 assert.doesNotMatch(read('js/modules/events.js'),/events-preview'[\s\S]{0,750}finally\{setButtonLoading\(button,false\)/);
});

test('workspace outgoing snapshots retain grid geometry and exclude hidden panels',()=>{
 const src=read('js/ui/transition.js');
 assert.match(src,/ghost\.style\.gridTemplateColumns = containerStyle\.gridTemplateColumns/);
 assert.match(src,/child\.hidden \|\| getComputedStyle\(child\)\.display === 'none'/);
});

test('events use shared content crossfade and restore registration button state',()=>{
 const src=read('js/modules/events.js');
 assert.match(src,/crossfade\(list, \(\) => \{/);
 assert.match(src,/crossfade\(box,\(\)=>\{/);
 assert.match(src,/finally\{setButtonLoading\(button,false\);\}\};/);
});
test('notification listener uses central stale-data retry instead of appending errors',()=>{
 const src=read('js/modules/notification.js');
 assert.match(src,/showLoadError\(dom\.scheduledTasksListContainer/);
 assert.doesNotMatch(src,/insertAdjacentHTML\('beforeend',`<div class="task-error"/);
});
test('contributors suppress skeleton flashes for sub-150ms responses',()=>{
 const src=read('js/modules/contributors.js');
 assert.doesNotMatch(src,/skeletonDelay:0/);
});

test('the real application browser regression verifies overlapping tab transitions',()=>{
 const browser=read('tests/browser.cjs');
 assert.match(browser,/Real navigation animates outgoing and incoming tabs simultaneously/);
 assert.match(browser,/navMotion\.ghost&&navMotion\.inert&&navMotion\.outgoing>0/);
});

test('legacy people directory also uses one shared loading and crossfade controller',()=>{
 const src=read('js/modules/people.js');
 assert.match(src,/const peopleLoaders = new WeakMap\(\)/);
 assert.match(src,/createLoadingController\(host/);
 assert.match(src,/loader\(host\)\.success\(/);
 assert.match(src,/loader\(host\)\.error\(/);
 assert.doesNotMatch(src,/function loading\(host\)\{[^}]*host\.innerHTML/);
});

test('error, empty and success states share the inert animated state renderer',()=>{
 const src=read('js/ui/states.js'), loading=read('js/utils/loading.js');
 assert.match(src,/export function renderUiState/);
 assert.match(src,/crossfade\(container, \(\) => container\.replaceChildren\(state\)\)/);
 assert.match(src,/export function showEmptyState/);
 assert.match(src,/export function showSuccessState/);
 assert.match(loading,/showLoadError\(container, message, retryFn/);
 assert.match(loading,/showEmptyState\(container, title, description\)/);
});
test('scroll fog discovers dynamic internal scrollports and avoids scrolling the table header',()=>{
 const src=read('js/utils/scrollEdges.js');
 assert.match(src,/const DISCOVER =/);
 assert.match(src,/\[style\*="overflow"\]/);
 assert.match(src,/attributeFilter:/);
 assert.match(src,/scrollable\(style\.overflowX\)/);
 assert.match(read('css/ui/scroll.css'),/\.contributor-table-head/);
 assert.doesNotMatch(read('css/stabilization.css'),/\.contributor-table-head\{/);
});
test('form, responsive and panel interaction owners use shared accessible states',()=>{
 const form=read('css/ui/controls.css');
 assert.match(form,/input\[type="checkbox"\]\[role="switch"\]:checked::after/);
 assert.match(form,/\.chip-checkbox:has\(input:focus-visible\)/);
 assert.match(read('js/ui/feedback.js'),/stopImmediatePropagation\(\)/);
 assert.match(read('css/ui/layout.css'),/--form-section-gap/);
 assert.match(read('css/ui/overlay.css'),/safe-area-inset-bottom/);
});

test('sub-navigation renders the chosen workspace before the incoming tab',()=>{
 const shell=read('js/modules/shell.js');
 assert.match(shell,/const activateTab = \(button, destination = null\)/);
 assert.match(shell,/destination\.setAttribute\('data-nav-selected', ''\)/);
 assert.match(shell,/activateTab\(parent, child\)/);
 assert.doesNotMatch(shell,/showWorkspace\(document\.getElementById\(parent\.dataset\.target\),keys\)/);
});
test('applicant crossfade does not retain outgoing list height',()=>{
 assert.match(read('js/ui/transition.js'),/preserveHeight = true/);
 assert.match(read('js/utils/loading.js'),/opts\.crossfadeOptions/);
 assert.match(read('js/modules/contributors.js'),/crossfadeOptions:\{preserveHeight:false\}/);
 assert.match(read('css/ui/layout.css'),/overflow-anchor: none/);
});
