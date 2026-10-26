const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function fixture(failure){
 let initializations=0,calls=[],bindings=[];
 const user={uid:'fixture'},listeners=[];
 const auth={currentUser:user,onAuthStateChanged:fn=>listeners.push(fn)};
 const functions={httpsCallable:(name,options)=>{bindings.push({name,options});return async data=>{calls.push({name,data});if(failure)throw failure;await Promise.resolve();return {data:{ok:true}};};}};
 const firebase={apps:[{}],initializeApp:()=>initializations++,auth:()=>auth,
  firestore:()=>({}),storage:()=>({}),appCheck:()=>({activate(){}}),app:()=>({functions:()=>functions})};
 const source=fs.readFileSync('js/core/firebase.js','utf8')
  .replace(/^export\s*\{[\s\S]*?\};/m,'').replace(/^export /gm,'');
 const context={firebase,console:{log(){},error(){}},setTimeout};
 vm.runInNewContext(source+'\nthis.api={initFirebase,callable,getAuth:()=>auth};',context);
 context.api.initFirebase({functionsRegion:'europe-west1'});
 return {api:context.api,calls,bindings,auth,get initializations(){return initializations;}};
}
test('an existing Firebase app still binds the console service handles',async()=>{
 const f=fixture();assert.equal(f.initializations,0);assert.equal(f.api.getAuth(),f.auth);
 const result=await f.api.callable('getServerStatus')({});assert.equal(result.data.ok,true);
 assert.equal(f.calls.length,1);
});
test('simultaneous identical reads share one request while mutations remain separate',async()=>{
 const f=fixture(),read=f.api.callable('listSiteTeam');
 await Promise.all([read({manage:true}),read({manage:true})]);
 assert.equal(f.calls.length,1);
 const write=f.api.callable('setSiteTeamEntry');
 await Promise.all([write({kind:'honor',name:'Fixture'}),write({kind:'honor',name:'Fixture'})]);
 assert.equal(f.calls.length,3);
});

test('biography translation allows cold startup without extending other deadlines or retrying',async()=>{
 const f=fixture();
 await f.api.callable('translateTeamBiography')({});
 await f.api.callable('getServerStatus')({});
 await f.api.callable('sendConsolePasswordResets')({});
 assert.equal(f.bindings.find(b=>b.name==='translateTeamBiography').options.timeout,60000);
 assert.equal(f.bindings.find(b=>b.name==='getServerStatus').options.timeout,20000);
 assert.equal(f.bindings.find(b=>b.name==='sendConsolePasswordResets').options.timeout,540000);
 const failed=fixture(Object.assign(new Error('Timed out'),{code:'functions/deadline-exceeded'}));
 await assert.rejects(failed.api.callable('translateTeamBiography')({}),{code:'functions/deadline-exceeded'});
 assert.equal(failed.calls.length,1);
});
