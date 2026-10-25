const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/main.js'),'utf8');
const start=source.indexOf('// Active application provisioning prepares membership server-side.');
const end=source.indexOf('let isAdmin=access.isCore;',start);
assert(start>=0&&end>start);
const run=new Function('consolePeopleCall','normalizeConsoleAccessResponse','user',
 'return(async()=>{'+source.slice(start,end)+'return access;})()');
test('password, Google and Apple sessions enter through server membership without activation or a client verification gate',async()=>{
 for(const providerId of ['password','google.com','apple.com']){
  const calls=[];
  const access=await run(async name=>{calls.push(name);return {data:{departments:['Aero'],isCore:false}};},data=>data,{emailVerified:false,providerData:[{providerId}],reload:()=>{throw Error('unexpected reload');}});
  assert.deepEqual(calls,['getMyConsoleAccess']);assert.deepEqual(access.departments,['Aero']);
 }
});
test('a failed membership check remains a denied session',async()=>{
 await assert.rejects(run(async()=>{throw Error('access denied');},x=>x,{}),/access denied/);
});
