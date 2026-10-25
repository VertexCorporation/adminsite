const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/utils/account-email-login.js'),'utf8');
const signIn=new Function(source.replace('export async function','async function')+';return signInWithAccountEmail;')();
test('all addresses use server resolution and the returned canonical session without native password fallback',async()=>{
 for(const email of ['personal@example.invalid','work@vertexishere.com','third@example.invalid']){
  const calls=[],auth={signInWithEmailAndPassword:()=>assert.fail('native-first bypass'),signInWithCustomToken:async token=>{calls.push(token);return {uid:'canonical'};}};
  const result=await signIn(auth,async(name,data)=>{assert.equal(name,'signInWithPersonnelEmail');assert.deepEqual(data,{email,password:'one-password'});return {data:{token:'canonical-token'}};},email,'one-password');
  assert.equal(result.uid,'canonical');assert.deepEqual(calls,['canonical-token']);
 }
});
test('invalid responses and unavailable/denied backend never fall back to a duplicate native identity',async()=>{
 for(const call of [async()=>({data:{}}),async()=>{throw Object.assign(Error('denied'),{code:'functions/unauthenticated'});},async()=>{throw Object.assign(Error('offline'),{code:'functions/unavailable'});}]){
  await assert.rejects(signIn({signInWithEmailAndPassword:()=>assert.fail(),signInWithCustomToken:()=>assert.fail()},call,'alias@example.invalid','password'));
 }
});
