'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/utils/weekly-stars-save.js','utf8').replace('export async function','async function');
const persist=vm.runInNewContext(source+';persistWeeklyStars',{Set,Error});
const expected=()=>({year:2026,weekNumber:44,title:'Week 44',contributors:[{id:'person-a',name:'A'}]});
const current=()=>({...expected(),contributors:[{id:'person-a',name:'Verified A'}]});
const failure=code=>Object.assign(Error(code),{code});

test('a confirmed save finishes directly without reloading candidates or reading the selection',async()=>{
 let writes=0,reads=0;
 const result=await persist(expected(),{write:async()=>{writes++;return {data:{success:true,current:current()}};},
  read:async()=>{reads++;throw Error('Unnecessary read');}});
 assert.equal(result.current.contributors[0].name,'Verified A');assert.equal(writes,1);assert.equal(reads,0);
});
test('a lost write response is recovered by reading the matching selection, never repeating the write',async()=>{
 let writes=0,reads=0;
 const result=await persist(expected(),{write:async()=>{writes++;throw failure('functions/deadline-exceeded');},
  read:async()=>{reads++;return {data:{current:current(),history:[]}};}});
 assert.equal(writes,1);assert.equal(reads,1);assert.equal(result.current.weekNumber,44);
});
test('a malformed success response must be verified before reporting success',async()=>{
 let reads=0;
 const result=await persist(expected(),{write:async()=>({data:{success:true}}),
  read:async()=>{reads++;return {data:{current:current()}};}});
 assert.equal(reads,1);assert.equal(result.current.year,2026);
});
test('a different saved selection is not reported as success after a timeout',async()=>{
 for(const patch of [{weekNumber:43},{title:'Other'},{contributors:[{id:'someone-else'}]}]){
  await assert.rejects(persist(expected(),{write:async()=>{throw failure('functions/unavailable');},
   read:async()=>({data:{current:{...current(),...patch}}})}),e=>e.reason==='weekly-stars-save-unconfirmed');
 }
});
test('permission and validation failures report the actual rejection without reconciliation',async()=>{
 for(const code of ['functions/permission-denied','functions/invalid-argument']){
  let reads=0;
  await assert.rejects(persist(expected(),{write:async()=>{throw failure(code);},read:async()=>{reads++;}}),e=>e.code===code);
  assert.equal(reads,0);
 }
});
test('failed verification remains uncertain instead of claiming either success or a rejected save',async()=>{
 await assert.rejects(persist(expected(),{write:async()=>{throw failure('functions/internal');},
  read:async()=>{throw failure('functions/unavailable');}}),e=>e.reason==='weekly-stars-save-unconfirmed');
});

const moduleSource=fs.readFileSync('js/modules/teamCards.js','utf8');
const handler=moduleSource.slice(moduleSource.indexOf('    form.onsubmit = async e => {'),
 moduleSource.indexOf('\n    };\n}',moduleSource.indexOf('    form.onsubmit = async e => {'))+7);
function uiFixture(save){
 const events=[],status={textContent:''},button={disabled:false},field={disabled:false};
 const nodes={'#stars-week':{value:'44'},'#stars-year':{value:'2026'},'#stars-title':{value:'Week 44'},
  '#save-weekly-stars-btn':button,'#weekly-stars-save-status':status};
 const form={elements:[button,field],setAttribute(){},removeAttribute(){}};
 const context={form,container:{querySelector:key=>nodes[key]},selected:expected().contributors,auth:{currentUser:{uid:'core'}},
  persistWeeklyStars:save,setWeeklyStarsFn:()=>{},getWeeklyStarsFn:()=>{},
  setButtonLoading:(_button,loading)=>{events.push(loading?'pending':'idle');button.disabled=loading;},
  renderWeeklyStars:(_container,data)=>events.push({render:data}),
  showToast:(_message,type)=>events.push('toast:'+type),__:key=>key,getLang:()=> 'tr',userErrorMessage:e=>e.message};
 vm.createContext(context);
 vm.runInContext('let weeklySaveRequest=null,weeklyLoadEpoch=0,weeklyDirectory=[],weeklyCache={current:null,history:[]};'+handler,context);
 return {run:()=>form.onsubmit({preventDefault(){}}),events,status,button,field};
}
test('the button is idle before saved confirmation is rendered and announced',async()=>{
 const fx=uiFixture(async()=>({success:true,current:current()}));await fx.run();
 assert.equal(fx.events[0],'pending');assert.equal(fx.events[1],'idle');
 assert.equal(fx.events[2].render.saveStatus,true);assert.equal(fx.events[3],'toast:success');
 assert.equal(fx.button.disabled,false);assert.equal(fx.field.disabled,false);
});
test('repeated submissions cannot overlap, and fields stay locked until the save completes',async()=>{
 let release,calls=0;
 const fx=uiFixture(()=>{calls++;return new Promise(resolve=>{release=resolve;});});
 const pending=fx.run();assert.equal(fx.field.disabled,true);await fx.run();assert.equal(calls,1);
 release({success:true,current:current()});await pending;
 assert.equal(fx.field.disabled,false);assert.equal(fx.events.filter(x=>x==='toast:success').length,1);
});
test('a failed save releases shimmer before presenting its error and retains the editable form',async()=>{
 const fx=uiFixture(async()=>{throw failure('functions/permission-denied');});await fx.run();
 assert.deepEqual(fx.events,['pending','idle','toast:error']);
 assert.equal(fx.button.disabled,false);assert.equal(fx.field.disabled,false);assert(fx.status.textContent);
});
