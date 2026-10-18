'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('js/modules/consoleChat.js','utf8');
const model=fs.readFileSync('js/modules/models.js','utf8');

test('chat realtime subscriptions only observe server-provided channel metadata',()=>{
  assert.match(source,/db\.collection\('chatHints'\)\.doc\(id\)\.onSnapshot/);
  assert.doesNotMatch(source,/\.collection\(['"]messages['"]\)\.onSnapshot/);
  assert.match(source,/function stopRealtime\(/);
  assert.match(source,/auth\?\.onAuthStateChanged\(user=>/);
  assert.match(source,/stopRealtime\(\);\s*channels=\[\]/);
  assert.match(source,/Legacy rules and offline mode continue to use guarded polling/);
  assert.match(source,/cachedMessageVersion/);
  assert.match(source,/realtimeLatestVersion/);
});

test('model deletion never falls back to unsafely deleting a Storage image',()=>{
  const block=model.slice(model.indexOf('async function handleDeleteModel('),model.indexOf('async function handleBlockOnlineModel('));
  assert.match(block,/await prepareModelImageCleanupFn\(/);
  assert.match(block,/await confirmModelImageCleanupFn\(/);
  assert.doesNotMatch(block,/storage\.ref\(/);
  assert.doesNotMatch(block,/legacyCleanup/);
  assert(block.indexOf('await prepareModelImageCleanupFn(')<block.indexOf("method: 'DELETE'"));
});
