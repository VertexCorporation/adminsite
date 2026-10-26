'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/firebase.js','utf8');
function harness(handler,{signedIn=true}={}){
 const calls=[],definitions=[];
 const box={
   auth:{currentUser:signedIn?{uid:'test-user'}:null},
   functions:{httpsCallable(name,settings){
     definitions.push({name,settings});
     return async data=>{calls.push({name,data});return handler(name,data,calls.length);};
   }},
   console:{error(){},warn(){}},setTimeout,clearTimeout,Promise
 };
 vm.createContext(box);
 vm.runInContext(source.slice(source.indexOf('// Firebase Functions SDK owns'),source.indexOf('// httpsCallable')),box);
 return {...box,calls,definitions,call:box.callCallable};
}
test('native SDK owns region, transport, auth/app-check and timeout',async()=>{
 assert.doesNotMatch(source,/https:\/\/\$\{name\.toLowerCase\(\)\}/);
 assert.match(source,/firebase\.app\(\)\.functions\(firebaseConfig\.functionsRegion \|\| 'europe-west1'\)/);
 const h=harness(async(_,data)=>({data:{ok:true,received:data}}));
 const r=await h.call('issueVertexCertificate',{contributorId:'person-id'});
 assert.equal(r.data.received.contributorId,'person-id');
 assert.equal(h.definitions[0].name,'issueVertexCertificate');
 assert.equal(h.definitions[0].settings.timeout,20000);
 assert.equal(h.calls.length,1);
});
test('writes are never retried after an ambiguous network timeout',async()=>{
 const h=harness(async()=>{throw Object.assign(new Error('Timed out'),{code:'functions/deadline-exceeded'});});
 await assert.rejects(h.call('issueVertexCertificate',{contributorId:'x'}),e=>e.code==='functions/deadline-exceeded');
 assert.equal(h.calls.length,1);
});
test('safe reads recover from transient connectivity with bounded retry',async()=>{
 const h=harness(async(_,data,n)=>n<2
   ?Promise.reject(Object.assign(new Error('offline'),{code:'functions/unavailable'}))
   :{data:{contributors:[{id:'x'}]}}
 );
 const r=await h.call('getVertexContributors',{pageSize:20});
 assert.equal(r.data.contributors[0].id,'x');
 assert.equal(h.calls.length,2);
});
test('permission errors do not retry even for reads',async()=>{
 const h=harness(async()=>{throw Object.assign(new Error('revoked'),{code:'functions/permission-denied'});});
 await assert.rejects(h.call('getVertexContributors'),e=>e.code==='functions/permission-denied');
 assert.equal(h.calls.length,1);
});
test('auth, App Check and other errors keep distinct explanations',async()=>{
 for(const [name,expected] of [['auth/network-request-failed','functions/unauthenticated'],['app-check/token-error','functions/failed-precondition'],['fetch/error','functions/unavailable']]){
   const h=harness(async()=>{throw Object.assign(new Error('unavailable'),{code:name});});
   await assert.rejects(h.call('saveDepartmentPermissions'),e=>e.code===expected);
   assert.equal(h.calls.length,1);
 }
});
test('existing certificate readiness contract is preserved',async()=>{
 const h=harness(async()=>{throw Object.assign(new Error('Expanded issuance awaits certificate assets and verified Zapier configuration.'),{code:'functions/failed-precondition'});});
 await assert.rejects(h.call('issueVertexCertificate'),e=>e.details?.reason==='certificate-delivery-not-ready');
});
test('malformed successful payload fails safely',async()=>{
 const h=harness(async()=>({wrong:true}));
 await assert.rejects(h.call('setUserDepartments'),e=>e.code==='functions/internal');
 assert.equal(h.calls.length,1);
});

test('department preconditions retain actionable, localized error explanations',()=>{
  const ui=fs.readFileSync('js/utils/ui.js','utf8');
  const lang=fs.readFileSync('js/lang.js','utf8');
  assert(ui.includes("import { __, getLang } from '../lang.js';"));
  for(const reason of ['personnel-rollout-pending','personnel-membership-review','personnel-version-conflict'])
    assert(ui.includes(reason),reason);
  for(const key of ['errors.personnel_rollout','errors.personnel_membership','errors.personnel_stale'])
    assert.equal(lang.split("'"+key+"'").length,3,key+' must be translated to both languages');
});
