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
