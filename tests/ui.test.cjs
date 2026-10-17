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
