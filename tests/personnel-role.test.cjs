const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/module-harness.cjs');
const tick=()=>new Promise(r=>setTimeout(r,0));
const base={uid:'account',email:'member@example.invalid',linkStatus:'linked',membership:'active',disabled:false,contributor:{id:'application'},department:'Array',departments:['Array','Core'],role:'member',authzVersion:9};
function fixture(options={}){
 let core=true,confirm=true;const auth={currentUser:{uid:'actor'}},calls=[];
 const user=structuredClone({...base,...options.user});
 const h=harness('<section id="role"></section>',{
  'js/core/firebase.js':{auth,consolePeopleCall:async(name,data)=>{calls.push({name,data});await options.wait?.(name);if(name==='listConsoleUsers')return {data:{users:[user]}};if(name==='getConsoleUser')return {data:{user}};if(name==='updateConsolePersonnel'){if(options.fail)throw Error('conflict');user.role=data.role;user.authzVersion++;return {data:{}};}throw Error(name);}},
  'js/core/deployment-capabilities.js':{deploymentCapabilities:{consolePersonnelWrites:true}},
  'js/modules/roles.js':{isPanelAdmin:()=>core},
  'js/modules/shell.js':{confirmDialog:async()=>{await options.onConfirm?.();return confirm;}},
  'js/utils/loading.js':{skeletonRows:()=>'<i class="skeleton"></i>',skeletonListItem:()=>'',setButtonLoading:(b,value)=>b.disabled=value},
  'js/utils/ui.js':{__:k=>k,escapeHTML:s=>String(s),userErrorMessage:e=>e.message,showToast:()=>{}},
 });
 return {...h,auth,calls,user,core:v=>core=v,confirm:v=>confirm=v,host:h.document.getElementById('role'),async mount(args){const m=await h.load('js/modules/personnelRole.js');return m.mountPersonnelRole(h.document.getElementById('role'),args);}};
}
test('application lookup validates the server application link and writes the shared account with CAS',async()=>{
 const h=fixture();try{await h.mount({application:{id:'application',email:base.email}});assert.equal(h.calls[0].name,'listConsoleUsers');
 const select=h.host.querySelector('select');select.value='moderator';select.dispatchEvent(new h.window.Event('change'));h.host.querySelector('form').dispatchEvent(new h.window.Event('submit',{cancelable:true}));await tick();await tick();
 const write=h.calls.find(c=>c.name==='updateConsolePersonnel');assert.deepEqual(JSON.parse(JSON.stringify(write.data)),{uid:'account',department:'Array',role:'moderator',expectedVersion:9});assert.equal(h.user.departments.length,2);assert.equal(h.host.querySelector('select').value,'moderator');
 }finally{h.close();}
});
test('same email with a different application or inconsistent linked UID never enables writes',async()=>{
 for(const application of [{id:'other',email:base.email},{id:'application',linkedUid:'different'}]){const h=fixture();try{await h.mount({application});assert.equal(h.host.querySelector('form'),null);assert.match(h.host.textContent,/role_link_required/);assert(!h.calls.some(c=>c.name==='updateConsolePersonnel'));}finally{h.close();}}
});
test('department entry point reads the same account and missing roles are explicitly unassigned',async()=>{
 const h=fixture({user:{role:null}});try{await h.mount({uid:'account'});assert.equal(h.calls[0].name,'getConsoleUser');assert.equal(h.calls[0].data.uid,'account');assert.equal(h.host.querySelector('select').value,'');assert.match(h.host.textContent,/role_select/);}finally{h.close();}
});
test('inactive, disabled and missing-department accounts show a specific reason and cannot submit',async()=>{
 for(const [fields,reason]of [[{membership:'inactive'},'role_inactive'],[{disabled:true},'role_disabled'],[{department:null},'role_unavailable']]){const h=fixture({user:fields});try{await h.mount({user:h.user});assert.match(h.host.textContent,new RegExp(reason));assert(h.host.querySelector('select').disabled);assert.equal(h.host.querySelector('button'),null);}finally{h.close();}}
});
test('non-Core makes no account lookup and cancelled confirmations make no write',async()=>{
 const h=fixture();try{h.core(false);await h.mount({application:{id:'application',email:base.email}});assert.equal(h.calls.length,0);assert.match(h.host.textContent,/role_core_only/);
 h.core(true);h.confirm(false);await h.mount({user:h.user});h.host.querySelector('select').value='chef';h.host.querySelector('form').dispatchEvent(new h.window.Event('submit',{cancelable:true}));await tick();assert(!h.calls.some(c=>c.name==='updateConsolePersonnel'));
 }finally{h.close();}
});
test('logout or Core revocation during confirmation blocks the mutation',async()=>{
 for(const revoke of ['logout','core']){let release;const gate=new Promise(r=>release=r);const h=fixture({onConfirm:()=>gate});try{await h.mount({user:h.user});h.host.querySelector('select').value='chef';h.host.querySelector('form').dispatchEvent(new h.window.Event('submit',{cancelable:true}));if(revoke==='logout')h.auth.currentUser=null;else h.core(false);release();await tick();assert(!h.calls.some(c=>c.name==='updateConsolePersonnel'));}finally{release();h.close();}}
});
test('late account reads cannot repopulate a replaced or closed drawer',async()=>{
 let release;const gate=new Promise(r=>release=r),h=fixture({wait:()=>gate});try{const pending=h.mount({application:{id:'application',email:base.email}});await tick();h.host.remove();release();await pending;assert.equal(h.host.querySelector('form'),null);}finally{release();h.close();}
});
