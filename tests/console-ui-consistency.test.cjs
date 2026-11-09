const {readConsoleSource} = require('./helpers/console-source.cjs');
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src = readConsoleSource;

test('event refresh shares a header row with the title and remains accessible',()=>{
 const html=src('index.html');
 const section=html.match(/<section class\s*=\s*"panel-card col-span-12" data-panel\s*=\s*"events.list">([\s\S]*?)<\/section>/)?.[1]||'';
 assert.match(section,/class\s*=\s*"card-title-row events-section-header"/);
 assert.match(section,/<h3[^>]*data-i18n\s*=\s*"panel.events.list"[^>]*>\s*<\/h3>/);
 assert.match(section,/<button[^>]*id\s*=\s*"events-refresh"[^>]*data-i18n-aria-label\s*=\s*"common.refresh"/);
 assert.match(section,/data-icon\s*=\s*"refresh"/);
});
test('event action groups and registrations respond to narrow screens',()=>{
 const html=src('index.html');
 const css=src('css/modules.css')+src('css/ui/layout.css');
 for(const id of ['events-preview','events-editor-submit','events-new','events-load-registrations'])
  assert.ok(html.includes('id="'+id+'"'),id);
 for(const cls of ['events-editor-actions','event-registration-controls','event-row-actions','ui-list-actions','event-registration-table'])
  assert.ok(css.includes('.'+cls),cls);
 assert.match(css,/@media\s*\s*\(\s*\s*max-width\s*:\s*\s*600px\s*\s*\)\s*/);
});
test('registration refresh preserves stale rows and delayed shared skeleton',()=>{
 const js=src('js/modules/events.js');
 assert.match(js,/beginPanelLoading\s*\(\s*box\s*\)\s*/);
 assert.match(js,/staleSelector\s*:\s*'\.event-registration-table'/);
 assert.match(js,/finishLoading\s*\(\s*\s*\)\s*/);
 assert.doesNotMatch(js,/box\.replaceChildren\s*\(\s*\s*\)\s*\s*;\s*\s*const heading\s*=\s*document\.createElement/);
});
test('existing button pending effect and shimmer wave are preserved, no spinner injected',()=>{
 assert.match(src('css/ui/controls.css'),/@keyframes iconSweep/);
 assert.match(src('css/loading.css'),/@keyframes skeletonWave/);
 assert.match(src('js/utils/loading.js'),/setButtonState\s*\(\s*btn\s*,\s* loading \? 'loading' \s*:\s* 'idle'\s*\)\s*/);
 assert.doesNotMatch(src('js/modules/events.js'),/className\s*\s*=\s*\s*['"]spinner/);
});
test('workspace entrances remain single-screen and lightweight',()=>{
 assert.match(src('js/modules/views.js'),/card\.animate\s*\(\s*/);
 assert.doesNotMatch(src('js/modules/views.js'),/crossfade\s*\(\s*host/);
 assert.match(src('js/ui/transition.js'),/duration \s*=\s* 220/);
});

test('overlays establish their initial geometry before entering',()=>{
 const js=src('js/modules/shell.js');
 assert.match(js,/opts\.render\?\.\s*\(\s*body\s*\)\s*\s*;\s*\s*\/\/[\s\S]*?void root\.offsetWidth\s*;\s*\s*void scrim\.offsetWidth/);
 assert.match(js,/opts\.render\?\.\s*\(\s*body\s*\)\s*\s*;\s*\s*void root\.offsetWidth\s*;\s*\s*void overlay\.offsetWidth/);
 assert.match(js,/paint\s*\(\s*\s*\)\s*\s*;\s*\s*void root\.offsetWidth\s*;\s*\s*void overlay\.offsetWidth/);
 assert.match(src('css/ui/layout.css'),/\.panel-header/);
});
test('paging and CSV actions retain the existing pending sweep instead of adding spinners',()=>{
 const js=src('js/modules/events.js');
 for(const action of ['loadMore','loadAll','exportButton']){
  assert.ok(new RegExp('setButtonLoading\\s*\\('+action+'\\s*,\\s*true\\)').test(js),action);
  assert.ok(new RegExp('setButtonLoading\\s*\\('+action+'\\s*,\\s*false\\)').test(js),action);
 }
 assert.doesNotMatch(js,/createElement\s*\(\s*['"]div['"]\s*\)\s*[^\n]*spinner/);
});
