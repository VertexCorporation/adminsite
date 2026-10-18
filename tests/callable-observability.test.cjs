'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/firebase.js','utf8');
test('SDK callable records operation context without tokens, user data or remote message',async()=>{
 const records=[],privatePayload='PRIVATE_APPLICATION_DATA',privateMessage='PRIVATE_BACKEND_MESSAGE';
 const box={
  functions:{httpsCallable:()=>async()=>{throw Object.assign(new Error(privateMessage),{code:'functions/permission-denied'});}},
  auth:{currentUser:{uid:'PRIVATE_ACCOUNT_ID'}},
  document:{querySelector:()=>({content:'fixture-release'})},
  console:{error:(...parts)=>records.push(parts),warn(){}},
  setTimeout,clearTimeout,
 };
 vm.createContext(box);
 const start=source.indexOf('const CALLABLE_TIMEOUT_MS'),end=source.indexOf('// httpsCallable');
 assert(start>=0&&end>start,'SDK wrapper must be available for testing.');
 vm.runInContext(source.slice(start,end),box);
 await assert.rejects(box.callCallable('setServerStatus',{secret:privatePayload}),e=>e.code==='functions/permission-denied'&&Boolean(e.requestId));
 assert.equal(records.length,1);
 assert.equal(records[0][0],'[CONSOLE_OPERATION]');
 const meta=records[0][1];
 assert.equal(meta.category,'authorization');
 assert.equal(meta.function,'setServerStatus');
 assert.equal(meta.release,'fixture-release');
 assert(Number.isFinite(meta.durationMs));
 const serialized=JSON.stringify(records);
 for(const secret of [privatePayload,privateMessage,'PRIVATE_ACCOUNT_ID'])assert(!serialized.includes(secret));
});
