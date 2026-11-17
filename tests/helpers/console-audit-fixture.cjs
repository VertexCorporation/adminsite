'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
// Test-only identity. The real application and permission gates still run;
// this fixture never signs in, reads or writes a production account.
const legacy = fs.readFileSync(path.join(root, 'tests/browser.cjs'), 'utf8');
const authScript = legacy.split('await page.addInitScript(()=>{')[1].split('\n});')[0];
const person = {id:'audit-person',uid:'audit-person',name:'Example Person',email:'person@example.invalid',
  department:'Array',departments:['Array'],membership:{status:'matched',uid:'audit-person',isVertex:true},
  isVertex:true,hasVerified:true,createdAt:{_seconds:1792450000},about:'Representative test record'};
const model = {id:'audit-model',source:'manual',type:'roleplay',details:{en:{title:'Example Model',summary:'Representative model',description:'Description',role:'Helpful assistant'},tr:{title:'Örnek Model',summary:'Örnek açıklama',description:'Açıklama',role:'Yardımcı asistan'}}};
function response(name, data = {}) {
  switch(name.toLowerCase()) {
    case 'getvertexcontributors': return {contributors:[person],nextCursor:null};
    case 'listconsoleusers': return {indexReady:true,users:[{...person,membership:'active',linkStatus:'linked',contributor:{id:person.id,name:person.name},role:'member',authzVersion:1,emailVerified:true,disabled:false,providers:['password']}],nextCursor:null};
    case 'getconsoleuser': return {user:{...person,membership:'active',linkStatus:'linked',contributor:{id:person.id,name:person.name},role:'member',authzVersion:1,emailVerified:true,disabled:false,providers:['password']}};
    case 'getconsoleuserstatistics': return {total:120,verified:110,disabled:2};
    case 'getserverstatus': return {isUnderMaintenance:false};
    case 'listconsolechatchannels': return {isAdmin:true,channels:[{id:'general',name:'General',canPost:true,canManage:true,lastMessageSeq:1,lastReadSequence:0,unreadCount:1}]};
    case 'listconsolechatmessages': return {messages:[{id:'m1',authorUid:'admin',authorName:'Example Person',text:'Representative message',sequence:1,createdAt:'2026-11-17T12:00:00Z'}]};
    case 'markconsolechatread': return {sequence:1};
    case 'listusersubscriptions': return {subscriptions:[{uid:person.uid,displayName:person.name,email:person.email,tier:'pro',source:'admin',canRemove:true,expiresAt:'2027-01-01T12:00:00Z'}]};
    case 'listadmins': return {admins:[{uid:'admin',email:'admin@example.invalid'}]};
    case 'listdepartmentusers': return {users:[person]};
    case 'listsiteteam': return {staff:[],mods:[],chefs:[],honors:[],cards:[],entries:[],members:[]};
    case 'getweeklystars': return {current:null,history:[]};
    case 'getbackuphealthstatus': return {};
    case 'listbeaconapplications': return {applications:[],nextCursor:null};
    case 'manageoriginprogram': return {rows:[],nextCursor:null,models:[],summary:{}};
    case 'getreportworkspace': return {schemaVersion:2,department:data.department,weekStart:data.weekStart,ownMemberId:'admin',canEdit:true,members:[{id:'admin',name:'Example Person'}],entries:[{id:'entry-1',memberId:'admin',date:'2026-11-16',status:'done',personName:'Example Person',project:'Console',summary:'Representative weekly work',revision:1}],tasks:[{id:'task-1',title:'Example task',memberId:'admin',status:'todo',priority:'normal',assignees:['admin'],description:'Representative work',project:'Console',revision:1}],openTasks:[],availableDepartments:['Array','Senatus'],cursors:{entries:null,tasks:null,open:null}};
    case 'managelegaldocuments': {
      const selected={id:'vertex-privacy--en',groupId:'vertex-privacy',locale:'en',product:'vertex',kind:'privacy',revision:0,version:0,published:{title:'Privacy policy',markdown:'# Privacy policy\n\nRepresentative test document.',html:'<h1>Privacy policy</h1><p>Representative test document.</p>'},draft:null,sources:[]};
      return data.action==='catalog'?{schemaVersion:2,documents:[{id:'vertex-privacy',product:'vertex',kind:'privacy',languages:['tr','en'].map(locale=>({id:'vertex-privacy--'+locale,locale,available:true,title:'Privacy policy'}))}],selected}:data.action==='history'?{versions:[],nextCursor:null}:selected;
    }
    case 'listconsolescenepersonnel': return {members:[],moderators:[],chefs:[]};
    case 'getvertexcertificatedetails': return {types:{tenacity:{en:'Tenacity',tr:'Dirayet'}},eligibility:{status:'joining-date-required',eligibleTypes:[],joinedAt:null},history:[]};
    default: return {};
  }
}
module.exports = {authScript, response, model};
