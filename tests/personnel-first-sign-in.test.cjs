const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/main.js'),'utf8');
const start=source.indexOf("if(ownProfile?.personnelOwnership==='pending'){");
const end=source.indexOf('const accessResult=',start);
assert(start>=0&&end>start);
const run=new Function('user','ownProfile','consolePeopleCall','showToast','auth','hideBootstrapLoader','document',
 'return(async()=>{'+source.slice(start,end)+"return 'ready';})()");
test('Google/password-action ownership activates automatically without sending a second verification email',async()=>{
 for(const verified of [true,false]){
  let activation=0,mail=0,signedOut=0,reloaded=0,notice='';
  const user={emailVerified:false,reload:async()=>{reloaded++;user.emailVerified=verified;},sendEmailVerification:async()=>{mail++;}};
  const result=await run(user,{personnelOwnership:'pending'},async name=>{assert.equal(name,'completePersonnelActivation');activation++;},text=>{notice=text();},{signOut:async()=>{signedOut++;}},()=>{},{documentElement:{lang:'tr'}});
  assert.equal(reloaded,1);assert.equal(mail,0);
  if(verified){assert.equal(result,'ready');assert.equal(activation,1);assert.equal(signedOut,0);}
  else{assert.equal(activation,0);assert.equal(signedOut,1);assert.match(notice,/Google/);assert.match(notice,/şifrenizi belirleyin/);}
 }
});
