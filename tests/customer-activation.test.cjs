'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(token='a'.repeat(43),destination='https://vertexishere.com/actions.html?mode=resetPassword&oobCode=fixture'){
 const handlers={},calls=[],redirects=[],history=[],elements=new Map();let fail=null;
 for(const id of ['activation-begin','activation-status','activation-language'])elements.set(id,{textContent:'',value:'',hidden:false,disabled:false,addEventListener:(event,fn)=>handlers[id+event]=fn});
 const context={URL,URLSearchParams,location:{hash:'#token='+token,pathname:'/customer-activate.html',replace:url=>redirects.push(url)},history:{replaceState:(...args)=>history.push(args)},document:{getElementById:id=>elements.get(id)},__:key=>key,getLang:()=> 'en',setLang:()=>{},onLangChange:()=>{},fetchFirebaseConfig:async()=>assert.fail('not needed'),mockExchange:async input=>{calls.push(input);if(fail)throw fail;return {data:{url:destination}};}};
 const source=fs.readFileSync('js/customer-activation.js','utf8').replace(/^import .*;\n/gm,'').replace('let exchange;', 'let exchange = mockExchange;');vm.runInNewContext(source,context);
 return {elements,calls,redirects,history,click:()=>handlers['activation-beginclick'](),fail:code=>fail={code}};
}
test('activation removes token from history, uses bounded exchange, and routes to the native customer action in selected language',async()=>{
 const f=fixture();assert.deepEqual(f.history,[ [null,'','/customer-activate.html'] ]);await f.click();assert.equal(f.calls.length,1);assert.equal(f.calls[0].token,'a'.repeat(43));const target=new URL(f.redirects[0]);assert.equal(target.searchParams.get('lang'),'en');assert.equal(target.searchParams.get('mode'),'resetPassword');assert(!target.searchParams.has('personnel'));
});
test('invalid invitations do not call backend and hide the action',async()=>{
 const f=fixture('invalid');await f.click();assert.equal(f.calls.length,0);assert.equal(f.elements.get('activation-begin').hidden,true);assert.equal(f.elements.get('activation-status').textContent,'customer.activationInvalid');
});
test('activation rejects untrusted and personnel destinations without redirecting',async()=>{
 for(const target of ['https://other.example/actions.html?mode=resetPassword&oobCode=x','https://vertexishere.com/actions.html?mode=resetPassword&oobCode=x&personnel=1','https://vertexishere.com/actions.html?mode=verifyEmail&oobCode=x']){
  const f=fixture('a'.repeat(43),target);await f.click();assert.equal(f.redirects.length,0);assert.equal(f.elements.get('activation-status').textContent,'customer.activationError');assert.equal(f.elements.get('activation-begin').disabled,false);
 }
});
test('expired and throttled links have distinct recoverable status messages',async()=>{
 for(const [code,message]of [['functions/permission-denied','customer.activationExpired'],['functions/resource-exhausted','customer.activationThrottled']]){
 const f=fixture();f.fail(code);await f.click();assert.equal(f.elements.get('activation-status').textContent,message);assert.equal(f.redirects.length,0);
 }
});
