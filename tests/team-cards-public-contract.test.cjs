const {readConsoleSource} = require('./helpers/console-source.cjs');
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const get = readConsoleSource;

test('public team editor is one canonical management surface',()=>{
 const source=get('js/modules/teamCards.js');
 assert.match(source,/listSiteTeamFn\s*\(\s*\s*\{\s*manage\s*:\s*true\s*\}\s*\s*\)\s*/);
 assert.match(source,/setSiteTeamEntryFn\s*\(\s*\s*\{\s*kind\s*:\s*'card'/);
 assert.match(source,/deleteSiteTeamEntryFn\s*\(\s*\s*\{\s*kind\s*:\s*'card'/);
 assert.match(source,/setSiteTeamEntryFn\s*\(\s*\s*\{\s*kind\s*:\s*'photo'/);
 assert.match(source,/mountBiographyEditor/);
 assert.match(source,/\.\.\.biographies.read\s*\(\s*\s*\)\s*/);
 assert.match(get('js/modules/teamBiographies.js'),/maxlength\s*=\s*"6000"/);
 assert.match(source,/if \s*\(\s*auth\.currentUser\s*\)\s* void loadTeamCards/);
 assert.doesNotMatch(source,/export async function initTeamProfilePanel/);
 assert.match(source,/initWeeklyStarsPanel/);
 const roles=source.match(/POSITIONS\s*=\s*Object\.freeze\s*\(\s*\[([^\]]+)\]\s*\)\s*/)?.[1]||'';
 assert.equal(roles.split(',').length,10);
});
test('console panel explains unified biographies and is no longer founder-only',()=>{
 const html=get('index.html');
 assert.match(html,/id\s*=\s*"team-cards-manager"/);
 assert.match(html,/id\s*=\s*"team-cards-list"/);
 assert.doesNotMatch(html,/id\s*=\s*"team-profile-container"/);
});
