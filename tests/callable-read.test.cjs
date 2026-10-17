'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../js/utils/callable-read.js'),'utf8');
const load=()=>import('data:text/javascript,'+encodeURIComponent(source));

test('read-only callable completes without a timeout', async()=>{
  const {withReadTimeout}=await load();
  assert.deepEqual(await withReadTimeout(Promise.resolve({data:{ok:true}}),100),{data:{ok:true}});
});
test('read-only callable timeout is classified and never retried',async()=>{
  const {withReadTimeout}=await load();
  let called=0;
  const pending=()=>{called++;return new Promise(()=>{});};
  await assert.rejects(withReadTimeout(pending(),10),error=>error.code==='functions/deadline-exceeded');
  assert.equal(called,1);
});
test('read-only callable preserves original rejection',async()=>{
  const {withReadTimeout}=await load();
  const error=Object.assign(new Error('denied'),{code:'functions/permission-denied'});
  await assert.rejects(withReadTimeout(Promise.reject(error),100),reason=>reason===error);
});
