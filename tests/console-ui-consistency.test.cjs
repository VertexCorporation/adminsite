'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('event refresh shares a header row with the title and remains accessible',()=>{
 const html=src('index.html');
 const section=html.match(/<section class="panel-card col-span-12" data-panel="events.list">([\s\S]*?)<\/section>/)?.[1]||'';
 assert.match(section,/class="card-title-row events-section-header"/);
 assert.match(section,/<h3[^>]*>Etkinlik Listesi<\/h3>/);
 assert.match(section,/<button[^>]*id="events-refresh"[^>]*aria-label="Yenile"/);
 assert.match(section,/data-icon="refresh"/);
});
test('event action groups and registrations respond to narrow screens',()=>{
 const html=src('index.html');
 const css=src('css/modules.css')+src('css/ui/layout.css');
 for(const id of ['events-preview','events-editor-submit','events-new','events-load-registrations'])
  assert.ok(html.includes('id="'+id+'"'),id);
 for(const cls of ['events-editor-actions','event-registration-controls','event-row-actions','ui-list-actions','event-registration-table'])
  assert.ok(css.includes('.'+cls),cls);
 assert.match(css,/@media\s*\(\s*max-width:\s*600px\s*\)/);
});
test('registration refresh preserves stale rows and delayed shared skeleton',()=>{
 const js=src('js/modules/events.js');
 assert.match(js,/beginPanelLoading\(box\)/);
 assert.match(js,/staleSelector:'\.event-registration-table'/);
 assert.match(js,/finishLoading\(\)/);
 assert.doesNotMatch(js,/box\.replaceChildren\(\);\s*const heading=document\.createElement/);
});
test('existing button pending effect and shimmer wave are preserved, no spinner injected',()=>{
 assert.match(src('css/ui/controls.css'),/@keyframes iconSweep/);
 assert.match(src('css/loading.css'),/@keyframes skeletonWave/);
 assert.match(src('js/utils/loading.js'),/setButtonState\(btn, loading \? 'loading' : 'idle'\)/);
 assert.doesNotMatch(src('js/modules/events.js'),/className\s*=\s*['"]spinner/);
});
test('workspace entrances remain single-screen and lightweight',()=>{
 assert.match(src('js/modules/views.js'),/card\.animate\(/);
 assert.doesNotMatch(src('js/modules/views.js'),/crossfade\(host/);
 assert.match(src('js/ui/transition.js'),/duration = 220/);
});
