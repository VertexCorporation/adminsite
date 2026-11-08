const {readConsoleSource} = require('./helpers/console-source.cjs');
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Curator deletion stages image cleanup and confirms only after successful response',()=>{
 const s=readConsoleSource('js/modules/models.js');
 const body=s.slice(s.indexOf('async function handleDeleteModel('),s.indexOf('async function handleBlockOnlineModel('));
 assert(body.indexOf('prepareModelImageCleanupFn(')<body.indexOf("method: 'DELETE'"));
 assert(body.indexOf('confirmModelImageCleanupFn(')>body.indexOf('if (!response.ok)'));
 assert(/journalImageCleanup\s*\(\s*cleanupId\s*\)\s*/.test(body));
 assert(/clearImageCleanup\s*\(\s*cleanupId\s*\)\s*/.test(body));
 assert(!body.includes('storageError.message'));
});
test('incomplete cleanup remains retryable rather than silently acknowledged',()=>{
 const models=readConsoleSource('js/modules/models.js');
 const fn=models.slice(models.indexOf('async function resumeImageCleanups()'),models.indexOf('async function handleDeleteModel('));
 assert.match(fn,/state\s*===\s*['"]complete['"]/);
 assert(!/processed\s*===\s*false/.test(fn),'an in-progress lease is not confirmed deletion');
 const backendLinked=fs.readFileSync('js/core/firebase.js','utf8');
 assert(/callable\s*\(\s*'prepareModelImageCleanup'\s*\)\s*/.test(backendLinked));
 assert(/callable\s*\(\s*'confirmModelImageCleanup'\s*\)\s*/.test(backendLinked));
});
test('both languages include pending cleanup text',()=>{
 const s=readConsoleSource('js/lang.js');
 assert.equal([...s.matchAll(/"models.cleanup_pending"\s*:\s*/g)].length,2);
});
