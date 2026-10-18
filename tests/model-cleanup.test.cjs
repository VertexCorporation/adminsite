'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Curator deletion stages image cleanup and confirms only after successful response',()=>{
 const s=fs.readFileSync('js/modules/models.js','utf8');
 const body=s.slice(s.indexOf('async function handleDeleteModel('),s.indexOf('async function handleBlockOnlineModel('));
 assert(body.indexOf('prepareModelImageCleanupFn(')<body.indexOf("method: 'DELETE'"));
 assert(body.indexOf('confirmModelImageCleanupFn(')>body.indexOf('if (!response.ok)'));
 assert(body.includes('journalImageCleanup(cleanupId)'));
 assert(body.includes('clearImageCleanup(cleanupId)'));
 assert(!body.includes('storageError.message'));
});
test('incomplete cleanup remains retryable rather than silently acknowledged',()=>{
 const models=fs.readFileSync('js/modules/models.js','utf8');
 const fn=models.slice(models.indexOf('async function resumeImageCleanups()'),models.indexOf('async function handleDeleteModel('));
 assert.match(fn,/state===['"]complete['"]/);
 assert(!fn.includes('processed===false'),'an in-progress lease is not confirmed deletion');
 const backendLinked=fs.readFileSync('js/core/firebase.js','utf8');
 assert(backendLinked.includes("callable('prepareModelImageCleanup')"));
 assert(backendLinked.includes("callable('confirmModelImageCleanup')"));
});
test('both languages include pending cleanup text',()=>{
 const s=fs.readFileSync('js/lang.js','utf8');
 assert.equal([...s.matchAll(/"models.cleanup_pending":/g)].length,2);
});
