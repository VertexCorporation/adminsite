const {readConsoleSource}=require('./helpers/console-source.cjs');
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source = relative => fs.readFileSync(path.join(__dirname,'..',relative),'utf8');

test('critical sidebar shell initializes before optional workspaces', () => {
  const js=source('js/main.js');
  const shell=js.indexOf('initShell();');
  const optional=js.indexOf('const featureInitializers = [');
  const auth=js.indexOf('auth.onAuthStateChanged(async (user) =>');
  assert(shell>0 && optional>shell && auth>optional);
  assert.match(js,/for \s*\(\s*const \[name\s*,\s* initialize\] of featureInitializers\s*\)\s* \s*\{\s*\s*try \s*\{\s*\s*initialize\s*\(\s*\s*\)\s*/);
  assert.match(js,/console\.error\s*\(\s*'\[INIT\] Optional workspace failed to initialize\s*:\s*'\s*,\s* name\s*,\s* error\s*\)\s*/);
  assert.match(js,/\['adaptive-grid'\s*,\s* initAdaptiveGrids\]/);
});

test('adaptive panel count responds to visible elements and viewport size', () => {
  const js=source('js/modules/views.js');
  const css=readConsoleSource('css/layout.css');
  assert.match(js,/Math\.floor\s*\(\s*\s*\(\s*width \+ 16\s*\)\s* \/ 316\s*\)\s*/);
  assert.match(js,/grid\.dataset\.visiblePanels/);
  assert.match(js,/attributeFilter\s*:\s*\[\s*'hidden'\s*,\s*'style'\]/);
  assert.match(css,/repeat\s*\(\s*var\s*\(\s*--panel-columns\s*,\s* 1\s*\)\s*\s*,\s* minmax\s*\(\s*0\s*,\s* 1fr\s*\)\s*\s*\)\s*/);
  assert.match(css,/\.grid-layout > \.panel-card\[hidden\] \s*\{\s*display\s*:\s*none !important\s*;\s*\s*\}\s*/);
});
