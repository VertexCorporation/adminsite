'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const src=fs.readFileSync('js/modules/siteTeam.js','utf8');

test('Honor Roll reads the privileged managed honors API, never the public moderators list',()=>{
    assert.match(src,/listSiteTeamFn\(\{manage:true\}\)/);
    assert.match(src,/result\.data\.honors/);
    assert.doesNotMatch(src,/result\.data\.mods/);
    assert.doesNotMatch(src,/listSiteTeamFn\(\{\}\)/);
});

test('Honor Roll writes only honor-kind entries; deletions stay scoped to server-managed ids',()=>{
    assert.equal((src.match(/setSiteTeamEntryFn\(\{ kind: 'honor'/g)||[]).length,2);
    assert.doesNotMatch(src,/kind: 'mod'/);
    assert.match(src,/deleteSiteTeamEntryFn\(\{ id \}\)/);
    assert.match(src,/showLoadError\(list,\(\)=>userErrorMessage\(error\),loadTeam/);
});
