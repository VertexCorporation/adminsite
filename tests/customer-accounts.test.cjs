'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 const listeners={},fields=new Map(),nodes=new Map(),calls=[],dialogs=[];let allowed=true,fail=false,language='tr',langChange;
 for(const name of ['email','displayName','grant','tier','duration','expiresAt','sendInvite'])fields.set(name,{value:'',checked:false,disabled:false});
 fields.get('tier').value='plus';fields.get('duration').value='7';fields.get('sendInvite').checked=true;
 const elements=[...fields.values()];elements.namedItem=name=>fields.get(name);
 for(const id of ['customer-account-form','customer-account-status','customer-account-results','customer-grant-options','customer-custom-expiry'])nodes.set(id,{children:[],textContent:'',hidden:false,disabled:false,addEventListener:(name,fn)=>listeners[id+':'+name]=fn,append(item){this.children.push(item);},replaceChildren(){this.children=[];}});
 Object.assign(nodes.get('customer-account-form'),{elements,reportValidity:()=>true});
 const auth={currentUser:{uid:'core'}};
 const context={document:{documentElement:{lang:'tr'},getElementById:id=>nodes.get(id),addEventListener:(name,fn)=>listeners[name]=fn,createElement:()=>({textContent:''})},auth,isPanelAdmin:()=>allowed,
 crypto:{randomUUID:()=> 'customer-request-'+calls.length},__:key=>language+':'+key,userErrorMessage:()=> 'error',onLangChange:fn=>langChange=fn,
 confirmDialog:async fn=>{dialogs.push(fn());return true;},consolePeopleCall:async(name,data)=>{calls.push({name,data});if(data.preview)return {data:{existing:false,currentTier:'free',expiresAtMillis:Date.now()+7*86400000}};if(fail)throw Error('timeout');return {data:{uid:'customer',status:'complete',account:'created',profile:'ready',subscription:'granted',expiry:'scheduled',invitation:'accepted'}};}};
 const source=fs.readFileSync('js/modules/customerAccounts.js','utf8').replace(/^import .*;\n/gm,'').replace('export function','function');vm.runInNewContext(source+'\ninitCustomerAccounts();',context);
 return {fields,nodes,calls,dialogs,auth,submit:()=>listeners['customer-account-form:submit']({preventDefault(){}}),edit:()=>listeners['customer-account-form:input'](),revoke:()=>{allowed=false;listeners['vertex:access-changed']();},fail:v=>fail=v,lang:()=>{language='en';langChange();}};
}
test('previews then confirms escaped identity and sends optional 7-day Plus through authorized callable',async()=>{
 const f=fixture();f.fields.get('email').value='USER@example.com';f.fields.get('displayName').value='<img src=x onerror=alert(1)>';f.fields.get('grant').checked=true;f.edit();await f.submit();
 assert.equal(f.calls.length,2);assert.equal(f.calls[0].data.preview,true);assert.equal(f.calls[1].name,'createConsoleCustomerAccount');assert.equal(f.calls[1].data.email,'user@example.com');assert.equal(f.calls[1].data.days,7);assert.equal(f.calls[1].data.sendInvite,true);
 assert(f.dialogs[0].rows[1].value.includes('&lt;img'));assert(!f.dialogs[0].rows[1].value.includes('<img'));assert.equal(f.nodes.get('customer-account-results').children.length,6);assert.equal(f.fields.get('email').disabled,false);
 f.lang();assert(f.nodes.get('customer-account-status').textContent.startsWith('en:'));assert(f.nodes.get('customer-account-results').children[4].textContent.includes('customer.state.accepted'));
});
test('Free default omits grant dates and email can be disabled',async()=>{
 const f=fixture();f.fields.get('email').value='user@example.com';f.fields.get('sendInvite').checked=false;await f.submit();const data=f.calls[1].data;assert.equal(data.tier,'free');assert.equal(data.sendInvite,false);assert.equal(data.days,undefined);assert(f.fields.get('tier').disabled);
});
test('ambiguous callable errors retain request identity; revoked Core cannot submit',async()=>{
 const f=fixture();f.fields.get('email').value='user@example.com';f.fail(true);await f.submit();f.fail(false);await f.submit();assert.equal(f.calls[1].data.requestId,f.calls[3].data.requestId);f.revoke();await f.submit();assert.equal(f.calls.length,4);
});
test('form labels resolve in both languages and reuse existing themed controls',()=>{
 const html=fs.readFileSync('index.html','utf8'),section=html.split('id="customer-account-manager"')[1].split('id="password-reset-manager"')[0];
 for(const id of ['customer-email','customer-name','customer-tier','customer-duration','customer-expiry'])assert(section.includes('for="'+id+'"'));
 assert(section.includes('class="chrome-btn-outline"'));assert(section.includes('role="status"'));assert(!/style=|#[a-f0-9]{6}/i.test(section));
});
