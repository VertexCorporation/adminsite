'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('js/modules/siteTeam.js','utf8');

test('Honor Roll reads the privileged managed honors API, never the public moderators list',()=>{
    assert.match(src,/listSiteTeamFn\s*\(\s*\s*\{\s*manage\s*:\s*true\s*\}\s*\s*\)\s*/);
    assert.match(src,/result\.data\.honors/);
    assert.doesNotMatch(src,/result\.data\.mods/);
    assert.doesNotMatch(src,/listSiteTeamFn\s*\(\s*\s*\{\s*\s*\}\s*\s*\)\s*/);
});

test('Honor Roll writes only honor-kind entries; deletions stay scoped to server-managed ids',()=>{
    assert.equal((src.match(/setSiteTeamEntryFn\s*\(\s*\s*\{\s* kind\s*:\s* 'honor'/g)||[]).length,2);
    assert.doesNotMatch(src,/kind\s*:\s* 'mod'/);
    assert.match(src,/deleteSiteTeamEntryFn\s*\(\s*\s*\{\s* id \s*\}\s*\s*\)\s*/);
    assert.match(src,/showLoadError\s*\(\s*list\s*,\s*\s*\(\s*\s*\)\s*\s*=>\s*userErrorMessage\s*\(\s*error\s*\)\s*\s*,\s*loadTeam/);
});
