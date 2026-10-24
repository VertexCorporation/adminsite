const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const elements=new Map(),calls=[],listeners={};
 for(const id of ['password-reset-form','password-reset-emails','password-reset-submit','password-reset-status','password-reset-results'])elements.set(id,{value:'',textContent:'',children:[],disabled:false,addEventListener:(event,fn)=>listeners[id+event]=fn,replaceChildren(){this.children=[];},append(item){this.children.push(item);}});
 let authorized=true,fail=false;const context={document:{getElementById:id=>elements.get(id),createElement:()=>({textContent:''})},crypto:{randomUUID:()=> 'batch-'+calls.length+'-1234567890'},auth:{currentUser:{uid:'core'}},isPanelAdmin:()=>authorized,__:k=>k,userErrorMessage:()=> 'error',consolePeopleCall:async(name,data)=>{calls.push({name,data});if(fail)throw Error('network');return {data:{accepted:1,rows:[{email:'a@example.com',status:'sent'},{email:'b@example.com',status:'uncertain'}]}};}};
 const source=fs.readFileSync('js/modules/passwordReset.js','utf8').replace(/^import .*;\n/gm,'').replace('export function','function');vm.runInNewContext(source+'\ninitPasswordResetModule();',context);
 return {elements,calls,submit:()=>listeners['password-reset-formsubmit']({preventDefault(){}}),edit:()=>listeners['password-reset-emailsinput'](),authorize:v=>authorized=v,fail:v=>fail=v};
}
test('bulk reset deduplicates recipients and retains the request ID after ambiguous failure',async()=>{
 const f=setup(),input=f.elements.get('password-reset-emails');input.value='A@example.com; a@example.com\nb@example.com';f.fail(true);await f.submit();f.fail(false);await f.submit();
 assert.equal(f.calls.length,2);assert.equal(f.calls[0].data.emails,'a@example.com\nb@example.com');assert.equal(f.calls[0].data.requestId,f.calls[1].data.requestId);assert.equal(f.calls[0].name,'sendConsolePasswordResets');assert.equal(f.elements.get('password-reset-results').children.length,2);assert.equal(input.disabled,false);
 input.value='c@example.com';f.edit();await f.submit();assert.notEqual(f.calls[1].data.requestId,f.calls[2].data.requestId);
});
test('invalid recipients and non-Core users cannot submit resets',async()=>{
 const f=setup(),input=f.elements.get('password-reset-emails');input.value='invalid';await f.submit();assert.equal(f.calls.length,0);input.value='a@example.com';f.authorize(false);await f.submit();assert.equal(f.calls.length,0);
});
