'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/firebase.js','utf8');
test('failed callable records bounded diagnostics without payloads or secrets',async()=>{
 const errors=[],token='SECRET_DO_NOT_LOG',payload='PRIVATE_APPLICATION_DATA';
 const context={auth:{currentUser:{getIdToken:async()=>token}},appCheck:{getToken:async()=>({token:'PRIVATE_APPCHECK_TOKEN'})},
  fetch:async()=>({ok:false,status:403,json:async()=>({error:{status:'PERMISSION_DENIED',message:'PRIVATE_BACKEND_MESSAGE'}})}),
  AbortSignal,setTimeout,clearTimeout,console:{warn(){},error:(label,metadata)=>errors.push([label,metadata])}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('let attestationPending'),source.indexOf('// httpsCallable')),context);
 await assert.rejects(context.callCallable('setServerStatus',{payload}),e=>e.code==='functions/permission-denied'&&Boolean(e.requestId));
 assert.equal(errors.length,1);
 assert.equal(errors[0][0],'[CONSOLE_OPERATION]');
 assert.equal(errors[0][1].category,'authorization');
 assert.equal(errors[0][1].function,'setServerStatus');
 assert(Number.isFinite(errors[0][1].durationMs));
 const serialized=JSON.stringify(errors);
 for(const secret of [token,payload,'PRIVATE_APPCHECK_TOKEN','PRIVATE_BACKEND_MESSAGE'])assert(!serialized.includes(secret));
});
