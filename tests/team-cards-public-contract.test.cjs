'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const get=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('public team editor is one canonical management surface',()=>{
 const source=get('js/modules/teamCards.js');
 assert.match(source,/listSiteTeamFn\(\{manage:true\}\)/);
 assert.match(source,/setSiteTeamEntryFn\(\{kind:'card'/);
 assert.match(source,/deleteSiteTeamEntryFn\(\{kind:'card'/);
 assert.match(source,/setSiteTeamEntryFn\(\{kind:'photo'/);
 assert.match(source,/mountBiographyEditor/);
 assert.match(source,/\.\.\.biographies.read\(\)/);
 assert.match(get('js/modules/teamBiographies.js'),/maxlength="6000"/);
 assert.match(source,/if \(auth\.currentUser\) void loadTeamCards/);
 assert.doesNotMatch(source,/export async function initTeamProfilePanel/);
 assert.match(source,/initWeeklyStarsPanel/);
 const roles=source.match(/POSITIONS=Object\.freeze\(\[([^\]]+)\]\)/)?.[1]||'';
 assert.equal(roles.split(',').length,10);
});
test('the published immutable console release contains the current team editor',()=>{
 const html=get('index.html');
 const map=html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
 assert.ok(map,'Missing import map');
 const imports=JSON.parse(map[1]).imports;
 const publicPath=imports['/js/modules/teamCards.js'];
 assert.ok(publicPath?.startsWith('/assets/releases/'));
 assert.equal(get(publicPath.slice(1)),get('js/modules/teamCards.js'));
});
test('console panel explains unified biographies and is no longer founder-only',()=>{
 const html=get('index.html');
 assert.match(html,/id="team-cards-manager"/);
 assert.match(html,/id="team-cards-list"/);
 assert.doesNotMatch(html,/id="team-profile-container"/);
});
