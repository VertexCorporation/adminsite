'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source = relative => fs.readFileSync(path.join(__dirname,'..',relative),'utf8');

test('critical sidebar shell initializes before optional workspaces', () => {
  const js=source('js/main.js');
  const shell=js.indexOf('    initShell();');
  const optional=js.indexOf('    const featureInitializers = [');
  const auth=js.indexOf('    auth.onAuthStateChanged(async (user) =>');
  assert(shell>0 && optional>shell && auth>optional);
  assert.match(js,/for \(const \[name, initialize\] of featureInitializers\) \{\s*try \{\s*initialize\(\)/);
  assert.match(js,/console\.error\('\[INIT\] Optional workspace failed to initialize:', name, error\)/);
  assert.match(js,/\['adaptive-grid', initAdaptiveGrids\]/);
});

test('adaptive panel count responds to visible elements and viewport size', () => {
  const js=source('js/modules/views.js');
  const css=source('css/layout.css');
  assert.match(js,/Math\.floor\(\(width \+ 16\) \/ 316\)/);
  assert.match(js,/grid\.dataset\.visiblePanels/);
  assert.match(js,/attributeFilter:\['hidden','style'\]/);
  assert.match(css,/repeat\(var\(--panel-columns, 1\), minmax\(0, 1fr\)\)/);
  assert.match(css,/\.grid-layout > \.panel-card\[hidden\] \{display:none !important;\}/);
});
