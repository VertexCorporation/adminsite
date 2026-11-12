const {readConsoleSource} = require('./helpers/console-source.cjs');
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const roles=fs.readFileSync('js/modules/roles.js','utf8');
const css=readConsoleSource('css/modules.css');
const html=readConsoleSource('index.html');
const source=fs.readFileSync('js/core/permissionCatalog.js','utf8');
const catalog=()=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('permission editor matches all current sidebar categories and every current screen',async()=>{
 const {PERMISSION_CATEGORIES:categories}=await catalog();
 assert.deepEqual(categories.map(c=>c.id),['users','origin','contributors','models','publications','subscriptions','scene','reports','legal','system']);
 const scopes=new Set(categories.flatMap(c=>c.screens.flatMap(s=>s.scopes)));
 const nav=[...html.matchAll(/data-nav-panel\s*=\s*"([^"]+)"/g)].flatMap(m=>m[1].split(','));
 assert.deepEqual([...scopes].sort(),[...new Set(nav)].sort());
 assert.match(roles,/PERMISSION_CATEGORIES\.forEach\s*\(\s*\(?category\)?\s*=>\s*/);
 assert.match(css,/repeat\s*\(\s*var\s*\(\s*--permission-module-count\s*,\s* 7\s*\)\s*\s*,\s*minmax\s*\(\s*108px\s*,\s*1fr\s*\)\s*\s*\)\s*/);
 assert.doesNotMatch(roles,/permission-workspace|permission-history-trigger|permission-save-status|CONTENT_OPTIONS|showPermissionHistory/);
});
test('cleanup is idempotent, removes obsolete settings and preserves denials',async()=>{
 const {normalizeScreenPermissions:clean}=await catalog();
 const result=clean({departments:{Aero:['contributors'],Senatus:{panels:{'news.*':'read','news.editor':'none','system.*':'write'},hiddenChips:{'contributors.list':['github']}},Scout:['news']}});
 assert.equal(result.Aero.panels['contributors.list'],'read');
 assert.equal(result.Senatus.panels['news.editor'],'none');
 assert.equal(result.Senatus.panels['news.published'],'read');
 assert.equal(result.Senatus.panels['users.directory'],'none');
 assert.equal(result.Senatus.panels['system.deptPerms'],'none');
 assert.equal(result.Scout,undefined);
 assert.deepEqual(Object.keys(result.Senatus),['panels']);
 assert(!Object.keys(result.Senatus.panels).some(key=>key.endsWith('.*')));
 assert.deepEqual(clean(result),result);
});
test('merging panels into a screen never exposes denied cards or previously masked fields',async()=>{
 const {normalizeScreenPermissions:clean}=await catalog();
 const result=clean({Senatus:{panels:{'system.exporter':'write','system.attributions':'none','contributors.list':'write'},hiddenFields:{'contributors.list':['contact']}}});
 assert.equal(result.Senatus.panels['system.exporter'],'none');
 assert.equal(result.Senatus.panels['system.attributions'],'none');
 assert.equal(result.Senatus.panels['contributors.list'],'none');
 assert.equal(result.Senatus.hiddenFields,undefined);
});
test('custom category levels and screen edits cannot modify Core-only scopes',async()=>{
 const m=await catalog(),category=m.PERMISSION_CATEGORIES.find(c=>c.id==='publications');
 const result=m.normalizeScreenPermissions({Senatus:['news','events','notifications']});
 assert.equal(m.categoryPermissionLevel(result,'Senatus',category),'read');
 m.setScreenPermission(result,'Senatus',category.screens.find(s=>s.id==='news-editor'),'write');
 assert.equal(m.categoryPermissionLevel(result,'Senatus',category),'mixed');
 assert.equal(result.Senatus.panels['news.published'],'read');
 m.setScreenPermission(result,'Senatus',m.PERMISSION_CATEGORIES[0].screens[0],'write');
 assert.equal(result.Senatus.panels['users.directory'],'none');
 m.setScreenPermission(result,'Core',category.screens[0],'none');
 assert.equal(result.Core,undefined);
 assert.equal(m.categoryPermissionLevel(result,'Core',category),'write');
});


test('Origin operations and finance are Core-only in every department',async()=>{const m=await catalog();const screens=[...m.PERMISSION_CATEGORIES.find(c=>c.id==='origin').screens,m.PERMISSION_CATEGORIES.find(c=>c.id==='models').screens.find(s=>s.id==='origin-finance')];for(const screen of screens){assert.equal(screen.coreOnly,true);for(const department of m.PERMISSION_DEPARTMENTS.filter(d=>d!=='Core'))assert.equal(m.screenPermissionLevel({[department]:{panels:Object.fromEntries(screen.scopes.map(s=>[s,'write']))}},department,screen),'none');}});
