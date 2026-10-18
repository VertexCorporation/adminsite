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
test('both languages include pending cleanup text',()=>{
 const s=fs.readFileSync('js/lang.js','utf8');
 assert.equal([...s.matchAll(/"models.cleanup_pending":/g)].length,2);
});
