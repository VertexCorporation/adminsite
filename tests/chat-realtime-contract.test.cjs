const {readConsoleSource} = require('./helpers/console-source.cjs');
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('js/modules/consoleChat.js','utf8');
const model=readConsoleSource('js/modules/models.js');

test('chat realtime subscriptions only observe server-provided channel metadata',()=>{
  assert.match(source,/db\s*\.collection\s*\(\s*'chatHints'\s*\)\s*\.doc\s*\(\s*id\s*\)\s*\.onSnapshot/);
  assert.doesNotMatch(source,/\.collection\s*\(\s*['"]messages['"]\s*\)\s*\.onSnapshot/);
  assert.match(source,/function stopRealtime\s*\(\s*/);
  assert.match(source,/auth\?\.onAuthStateChanged\s*\(\s*\(?user\)?\s*=>\s*/);
  assert.match(source,/stopRealtime\s*\(\s*\s*\)\s*\s*;\s*\s*channels\s*=\s*\[\]/);
  assert.match(source,/Legacy rules and offline mode continue to use guarded polling/);
  assert.match(source,/cachedMessageVersion/);
  assert.match(source,/realtimeLatestVersion/);
});

test('model deletion never falls back to unsafely deleting a Storage image',()=>{
  const block=model.slice(model.indexOf('async function handleDeleteModel('),model.indexOf('async function handleBlockOnlineModel('));
  assert.match(block,/await prepareModelImageCleanupFn\s*\(\s*/);
  assert.match(block,/await confirmModelImageCleanupFn\s*\(\s*/);
  assert.doesNotMatch(block,/storage\.ref\s*\(\s*/);
  assert.doesNotMatch(block,/legacyCleanup/);
  assert(block.indexOf('await prepareModelImageCleanupFn(')<block.indexOf("method: 'DELETE'"));
});
