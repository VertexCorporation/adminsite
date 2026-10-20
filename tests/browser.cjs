const {chromium,webkit} = require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const p=path.join(root,decodeURIComponent(req.url.split('?')[0])==='/'?'index.html':req.url.split('?')[0]);if(!p.startsWith(root))return res.end();fs.readFile(p,(err,data)=>{if(err){res.statusCode=404;return res.end();}res.setHeader('Content-Type',p.endsWith('.woff2')?'font/woff2':p.endsWith('.ttf')?'font/ttf':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':p.endsWith('.svg')?'image/svg+xml':'text/html');res.end(data);});});
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await (process.env.VERTEX_BROWSER==='webkit'?webkit:chromium).launch({...(process.env.VERTEX_BROWSER!=='webkit'&&process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),headless:true});
const errors=[],consoleErrors=[],calls=[],payloads=[]; let verificationValid=true,history=[],people=null,contributorDelay=0,failContributors=false,failNotification=false; let joiningDate=null,failPermissionSave=false,failMaintenance=false,maintenanceState=false,failVerify=false;

let failMembership=false,failAdmin=false,failContributorReadOnce=0,failChatReadOnce=0;let adminRoster=[{uid:'admin',email:'admin@example.invalid'},{uid:'other-admin',email:'other@example.invalid'}];
const person={membership:{status:'matched',uid:'auth-person',isVertex:true},id:'person',name:'Example Participant',email:'person@example.invalid',language:'en',hasVerified:false,createdAt:{_seconds:1767272400},department:'Core',interviewDate:'2026-10-10',about:'Local test fixture'};
const types={merit:{en:'Merit',tr:'Liyakat'},tenacity:{en:'Tenacity',tr:'Dirayet'},constancy:{en:'Constancy',tr:'Metanet'},nobility:{en:'Nobility',tr:'Azamet'},majesty:{en:'Majesty',tr:'Asalet'}};
const page=await browser.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR:',e.message);});page.on('console',m=>{if(m.type()==='error'){if(!/503|500|\[AUTH\] Login failed auth\/(?:invalid-credential|too-many-requests|network-request-failed)|Fixture unavailable|Mock delivery outcome uncertain|Fixture permission rejection|Fixture verification unavailable|Fixture maintenance unavailable|400 \(Bad Request\)|functions\/failed-precondition|\[CERTIFICATES\]|\[CONSOLE_OPERATION\] \{operation: firebase\.callable, function: (?:getVertexContributors|sendTargetedNotification|toggleContributorVerification|getServerStatus|saveDepartmentPermissions), category: (?:transport|server)/.test(m.text()))consoleErrors.push(m.text());console.error('CONSOLE:',m.text());}});page.setDefaultTimeout(12000);
if(process.env.VERTEX_TRACE)await page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
await page.addInitScript(()=>{
 localStorage.setItem('siteLang','en');
 const snapshot={docs:[],empty:true,exists:false,data:()=>({}),forEach:()=>{}};
 // Seed a real policy fixture; production never invents write permissions.
 const tabs=['contributors','models','news','notifications','events','subscriptions','system'];
 const grants=level=>Object.fromEntries(tabs.map(tab=>[tab+'.*',level]));
 const policy={revision:0,departments:{Core:{panels:grants('write')},Senatus:{panels:grants('read')}}};
 const configSnapshot=()=>({exists:true,data:()=>policy});
 const configDoc={get:async()=>configSnapshot(),onSnapshot:fn=>{setTimeout(()=>fn(configSnapshot()),0);return ()=>{};}};
 const chain={orderBy:()=>chain,where:()=>chain,limit:()=>chain,doc:()=>chain,get:async()=>snapshot,onSnapshot:fn=>{setTimeout(()=>fn(snapshot),0);return ()=>{};}};
 const article={translations:{en:{title:'Saved Fixture',summary:'Summary',content:'Content'},tr:{title:'Kayıtlı Haber',summary:'Özet',content:'İçerik'}},cover:{en:'news/covers/fixture/en.png',tr:'news/covers/fixture/tr.png'},tags:[],references:[],revision:0};
 const doc={id:'fixture-article',data:()=>article};
 const newsSnapshot={empty:false,docs:[doc],forEach:fn=>fn(doc)};
 const newsChain={...chain};newsChain.orderBy=()=>newsChain;newsChain.onSnapshot=fn=>{setTimeout(()=>fn(newsSnapshot),0);return()=>{};};
 const collection=name=>name==='news'?newsChain:name==='config'?{...chain,doc:id=>id==='departmentPermissions'?configDoc:chain}:chain;
 const user={uid:'admin',email:'admin@example.invalid',displayName:'Local Admin',getIdTokenResult:async()=>({claims:window.__testClaims || {admin:true}}),getIdToken:async()=>'test-only',updateProfile:async()=>{}};
 const listeners=[];const auth={currentUser:user,onAuthStateChanged:fn=>{listeners.push(fn);setTimeout(()=>fn(user),10);return ()=>{};},signOut:async()=>{auth.currentUser=null;listeners.forEach(fn=>fn(null));},signInWithEmailAndPassword:async()=>{if(window.__testAuthError)throw Object.assign(new Error('Private authentication detail'),{code:window.__testAuthError});auth.currentUser=user;listeners.forEach(fn=>fn(user));}};
 window.firebase={apps:[],initializeApp:()=>{},auth:()=>auth,firestore:()=>({collection}),storage:()=>({}),functions:()=>({}),appCheck:()=>({activate:()=>{},getToken:async()=>({token:'fixture-app-check'})}),app:()=>({functions:()=>({httpsCallable:(name)=>async data=>{
   if(name==='getMyConsoleAccess'){
     // A real callable resolves CURRENT server-owned membership on every
     // authentication change. The synthetic fixture follows the test's
     // server identity scenario, not a permanently privileged Core account.
     const account=window.__testClaims || {admin:true};
     const isCore=account.admin===true;
     return {data:{uid:'admin',departments:isCore?['Core']:(account.departments||[]),
       isAdmin:isCore,isCore,authzVersion:0}};
   }
   const response=await fetch('https://'+name.toLowerCase()+'-o5h7dmtija-ew.a.run.app',{
     method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:data||{}})
   });
   const payload=await response.json();
   if(!response.ok || payload.error){
     const error=new Error(payload.error?.message||'Fixture service unavailable');
     const status=payload.error?.status||'INTERNAL';
     error.code='functions/'+status.toLowerCase().replaceAll('_','-');
     throw error;
   }
   return {data:payload.result};
 }})})};
});
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.hostname.endsWith('cloudfunctions.net')) return route.fulfill({contentType:'application/json',body:JSON.stringify(verificationValid ? {valid:true,name:'Example Participant',language:'en',certificateType:'tenacity',formattedDate:'01/01/2026'} : {valid:false})});
 if(url.hostname==='127.0.0.1'){
  if(url.pathname.endsWith('/js/core/deployment-capabilities.js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'js/core/deployment-capabilities.js'),'utf8').replace(/(newsRevisions|notificationStatus|chatReadPositions|bulkSubscriptionPreview): false/g,'$1: true')});
  if(url.pathname.startsWith('/verify/'))return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.resolve(root,'../vertexite/verify.html'),'utf8')});
  if(url.pathname.endsWith('/js/core/initializer.js'))return route.fulfill({contentType:'text/javascript',body:"import {startApp} from '../main.js'; startApp({apiKey:'test'});"});
  return route.continue();
 }
 if(url.hostname.endsWith('run.app')){
  const name=url.hostname.split('-')[0];calls.push(name);payloads.push({name,data:route.request().postDataJSON()?.data});
  if(name==='sendtargetednotification' && failNotification)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{status:'INTERNAL',message:'Mock delivery outcome uncertain'}})});
  if(name==='getserverstatus'&&failMaintenance)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Fixture maintenance unavailable'}})});
  if(name==='togglecontributorverification'&&failVerify)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Fixture verification unavailable'}})});
  let result={};
  if(name==='togglecontributorverification'){
    const request=route.request().postDataJSON().data;
    const target=(people||[person]).find(p=>p.id===request.contributorId);
    if(target){target.hasVerified=request.hasVerified;target.certificateDeliveryStatus=request.hasVerified?'succeeded':'revoked';}
    result={hasVerified:request.hasVerified,status:request.hasVerified?'succeeded':'revoked'};
  }
  if(name==='getserverstatus')result={isUnderMaintenance:maintenanceState};
  if(name==='setserverstatus'){maintenanceState=route.request().postDataJSON().data.maintenanceEnabled;result={success:true};}
  if(name==='togglevertexstatus'){if(failMembership)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Fixture unavailable'}})});const data=route.request().postDataJSON().data;const next=typeof data.expectedStatus==='boolean'?!data.expectedStatus:true;if(data.contributorId){const target=(people||[person]).find(p=>p.id===data.contributorId);if(target)target.membership.isVertex=next;}result={isVertex:next};}
  if(name==='savedepartmentpermissions'){
    if(failPermissionSave)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Fixture permission rejection'}})});
    result={saved:true,revision:(route.request().postDataJSON()?.data?.expectedRevision||0)+1};
  }
  if(name==='getvertexcontributors' && failContributorReadOnce-->0)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Temporary contributors service outage'}})});
  if(name==='listconsolechatchannels' && failChatReadOnce-->0)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Temporary chat service outage'}})});
  if(name==='getvertexcontributors'){
    const input=route.request().postDataJSON()?.data||{};
    const text=String(input.search||'').trim().toLocaleLowerCase('tr');
    const filter=input.filter||'all';
    const thisYear=new Date().getFullYear();
    const fixture=(people||[person]).filter(p=>{
      const active=p.membership?.isVertex===true||p.isVertex===true;
      const year=Number(p.birthYear||String(p.birthDate||'').slice(0,4))||null;
      const accepted=({
        all:true,vertex:active,verified:p.hasVerified===true,unverified:p.hasVerified!==true,
        'age-14-15':year!==null&&year>=thisYear-15&&year<=thisYear-14,
        'age-16-17':year!==null&&year>=thisYear-17&&year<=thisYear-16,
        'age-18':year!==null&&year<=thisYear-18,
        linkedin:!!p.linkedin,github:!!p.github,interview:!!p.interviewDate
      })[filter];
      return !!accepted&&(!text||[p.name,p.email,p.department,p.about]
        .some(v=>String(v||'').toLocaleLowerCase('tr').includes(text)));
    });
    if(contributorDelay)await new Promise(r=>setTimeout(r,contributorDelay));
    if(failContributors)return route.fulfill({contentType:'application/json',status:503,body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Fixture unavailable'}})});
    result={contributors:fixture};
  }
  else if(name==='getvertexcertificatedetails')result={types,eligibility:{status:'joining-date-required',eligibleTypes:[],joinedAt:joiningDate},history};
  else if(name==='setvertexcontributorjoiningdate'){joiningDate=route.request().postDataJSON().data.joinedAt;result={success:true};}
  else if(name==='issuevertexcertificate'){history=[{id:'person--tenacity',certificateType:'tenacity',status:'processing',attempts:[]}];result={id:'person',status:'processing'};}
  else if(name==='revokevertexcertificate'){history=history.map(j=>({...j,status:'revoked'}));result={success:true};}
  else if(name==='listconsolechatchannels')result={isAdmin:true,channels:[{id:'general',name:'General',canPost:true,canManage:true,lastMessageSeq:2,lastReadSequence:0,unreadCount:2}]};
  else if(name==='listconsolechatmessages')result={messages:[{id:'m1',authorUid:'admin',authorName:'Local Admin',authorEmail:'admin@example.invalid',text:'Fixture message',sequence:2,createdAt:'2026-10-11T00:00:00Z'}]};
  else if(name==='previewbulkusersubscriptions')result={replaceable:1,protected:2,missing:1,unavailable:0,invalidTokens:[]};
  else if(name==='bulksetusersubscriptions')result={grantedCount:1,failedCount:1,failed:[{email:'missing@example.invalid',error:'User not found'}],invalidTokens:[]};
  else if(name==='listdepartmentusers')result={users:[]};
  else if(name==='listadmins')result={admins:adminRoster};
  else if(name==='removeadminrole'){if(failAdmin)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Fixture unavailable'}})});adminRoster=adminRoster.filter(a=>a.email!==route.request().postDataJSON().data.email);result={success:true};}
  else if(name==='listusersubscriptions')result={subscriptions:[{uid:'sub-fixture',displayName:'Example Subscriber',email:'subscriber@example.invalid',tier:'pro',source:'admin',canRemove:true,expiresAt:'2027-01-01T12:00:00Z'}]};
  else if(name==='listsiteteam')result=route.request().postDataJSON()?.data?.manage
    ? {cards:[],honors:[]}
    : {staff:[],mods:[],chefs:[],honors:[],cards:[]};
  else if(name==='markconsolechatread')result={sequence:2};
  else if(name==='schedulenotification')result={success:true,queued:true,kind:'SCHEDULED'};
  else if(name==='getnotificationdeliverystatus')result={status:'SCHEDULED',kind:'SCHEDULED',successCount:0,failureCount:0};
  else if(name==='listnewsrevisions')result={revisions:[{id:'fixtureHistory',revision:0,at:Date.now(),title:'Previous Fixture'}]};
  else if(name==='getweeklystars')result={current:null,history:[]};
  else if(name==='getcoveruploadurl')result={signedUrl:'https://upload.example.invalid/cover',filePath:'test-cover.png'};
  return route.fulfill({contentType:'application/json',body:JSON.stringify({result})});
 }
 if(url.pathname.endsWith('.json') || url.pathname === '/models')return route.fulfill({contentType:'application/json',body:JSON.stringify({producers:{Vertex:{Fixture:{Example:{id:'fixture-model',source:'manual',type:'offline',details:{en:{title:'Fixture Model'},tr:{title:'Örnek Model'}}}}}},models:[]})});
 return route.fulfill({status:200,body:'',contentType:url.hostname==='fonts.googleapis.com'||url.pathname.endsWith('.css')?'text/css':'text/plain'});
});

console.log("Starting page");await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:"domcontentloaded",timeout:15000});console.log("Page loaded");
// Home is the default workspace. Open contributors before waiting for its lazy controls.
await page.locator('.dock-btn[data-target="tab-contributors"]').click();
await page.waitForSelector('.certificate-manage-btn');
assert.equal(errors.length,0);
const checks=[];
const note=x=>{checks.push(x);console.log('PASS',x);};
// Never show a cloned outgoing page while navigating. Our former regression
// incorrectly demanded this exact source of the user's stray-screen flash.
await page.locator('.dock-btn[data-target="tab-news"]').click();
// The legacy server's admin boolean must not leave a visible main nav with
// disabled, empty submenus. Every authorized destination has live content.
assert.equal(await page.locator('[data-nav-module="news"]').getAttribute('aria-hidden'),null);
assert.equal(await page.locator('[data-nav-module="news"] .dock-btn').getAttribute('aria-expanded'),'true');
assert.equal(await page.locator('[data-nav-module="news"] .sidebar-submenu').getAttribute('inert'),null);
assert.equal(await page.locator('#tab-news .panel-card[data-panel="news.editor"]').isVisible(),true);
await page.locator('[data-nav-module="news"] [data-nav-panel="news.published"]').click();
assert.equal(await page.locator('#tab-news .panel-card[data-panel="news.published"]').isVisible(),true);
assert.equal(await page.locator('#tab-news .panel-card[data-panel="news.editor"]').isVisible(),false);
await page.locator('[data-nav-module="news"] [data-nav-panel="news.editor"]').click();
await page.locator('.dock-btn[data-target="tab-contributors"]').click();
await page.locator('.dock-btn[data-target="tab-news"]').click();
const navMotion=await page.evaluate(()=>{
 const host=document.getElementById('tab-scroll-container'), incoming=document.getElementById('tab-news');
 return {ghost:!!host.querySelector(':scope > .ui-view-ghost'),
   incoming:incoming.getAnimations().length,
   visible:[...host.querySelectorAll(':scope > .tab-panel')]
      .filter(t=>getComputedStyle(t).display!=='none').map(t=>t.id),
   liveOld:!!document.getElementById('tab-contributors')};
});
assert(!navMotion.ghost&&navMotion.incoming>0&&navMotion.liveOld,JSON.stringify(navMotion));
assert.deepEqual(navMotion.visible,['tab-news']);
await page.locator('.dock-btn[data-target="tab-contributors"]').click();
assert.equal(await page.locator('#tab-scroll-container > .ui-view-ghost').count(),0);
note('Navigation never displays the outgoing screen above its destination');
// Fast consecutive clicks must still leave only the final tab visible.
const rapidNav=await page.evaluate(()=>{
 for(const id of ['tab-models','tab-notifications','tab-news','tab-contributors'])
   document.querySelector('.dock-btn[data-target="'+id+'"]').click();
 return {visible:[...document.querySelectorAll('.tab-panel')]
    .filter(t=>getComputedStyle(t).display!=='none').map(t=>t.id),
   ghosts:document.querySelectorAll('.ui-view-ghost').length};
});
assert.deepEqual(rapidNav.visible,['tab-contributors']);
assert.equal(rapidNav.ghosts,0);
note('Rapid navigation never cycles through intermediate screens');
// Deep sub-navigation must select the final workspace before the new page
// enters. No intermediary contributor panel may be rendered.
await page.locator('.dock-btn[data-target="tab-news"]').click();
await page.waitForFunction(()=>!document.querySelector('#tab-scroll-container > .ui-view-ghost'));
const atomicDestination=await page.evaluate(()=>{
 const seen=[];
 const listener=event=>{const keys=event.detail?.keys||[];if(keys.some(k=>k.startsWith('contributors.')))seen.push(keys.join(','));};
 document.addEventListener('vertex:workspace',listener);
 document.querySelector('[data-nav-panel="contributors.vertexStatus"]').click();
 document.removeEventListener('vertex:workspace',listener);
 const tab=document.getElementById('tab-contributors');
 return {seen,workspace:tab.dataset.workspace,active:tab.classList.contains('active'),
  nestedGhost:!!tab.querySelector('.grid-layout > .ui-crossfade-ghost')};
});
assert.deepEqual(atomicDestination.seen,['contributors.vertexStatus'],JSON.stringify(atomicDestination));
assert.equal(atomicDestination.workspace,'contributors.vertexStatus');
assert(atomicDestination.active&&!atomicDestination.nestedGhost,JSON.stringify(atomicDestination));
await page.waitForFunction(()=>!document.querySelector('#tab-scroll-container > .ui-view-ghost'));
await page.locator('[data-nav-panel="contributors.list"][data-nav-action=""]').click();
note('Contributor sub-navigation enters its final workspace without an intermediate layout');
const issueCount=()=>calls.filter(n=>n==='issuevertexcertificate').length;
const openCert=async()=>{if(await page.locator('.certificate-drawer').count()){await page.keyboard.press('Escape');await page.waitForSelector('.vx-drawer',{state:'detached'});}await page.waitForSelector('.vx-popover.is-closing',{state:'detached'});await page.waitForSelector('.vx-modal[aria-hidden=true]',{state:'detached'});await page.locator('.certificate-manage-btn').first().click();await page.waitForSelector('[data-award]');};
const selectTab=async id=>{if(await page.evaluate(()=>innerWidth<1024)){const dock=page.locator(`[data-mobile-tab="tab-${id}"]`);if(await dock.count()&&await dock.isVisible())await dock.click();else{await page.locator('[data-mobile-more]').click();if(id==='profile')await page.locator('[data-more-profile]').click();else await page.locator(`.mobile-more-pages section[data-more-module="tab-${id}"] button`).first().click();await page.waitForSelector('.vx-modal',{state:'detached'});}}else await page.locator(`[data-target="tab-${id}"]`).click();};
// Recover a transient 503 for both data-heavy screens without reloading the page.
{
 const contributorBefore=calls.filter(name=>name==='getvertexcontributors').length;
 failContributorReadOnce=1;
 await page.locator('#refresh-contributors-btn').click();
 await page.waitForFunction(()=>document.querySelector('#contributors-list-container .contributor-row') &&
   !document.querySelector('#contributors-list-container[aria-busy="true"]'));
 assert(calls.filter(name=>name==='getvertexcontributors').length-contributorBefore>=2);
 note('Contributors recover automatically from a transient read failure');
 const chatBefore=calls.filter(name=>name==='listconsolechatchannels').length;
 failChatReadOnce=1;
 await selectTab('chat');
 await page.waitForSelector('#chat-channel-list .chat-channel-item');
 assert(calls.filter(name=>name==='listconsolechatchannels').length-chatBefore>=2);
 note('Chat channels recover automatically from a transient read failure');
 await page.waitForTimeout(150);const readPosition=payloads.find(p=>p.name==='markconsolechatread');assert(readPosition);assert.deepEqual(readPosition.data,{channelId:'general',sequence:2});note('Personal read positions contain no client-selected user identity');
 await selectTab('contributors');
}
if(!process.env.VERTEX_POLISH_ONLY&&!process.env.VERTEX_COMPLETE_ONLY&&!process.env.VERTEX_STABILIZATION_ONLY){
for(const width of [360,390,768,1024,1440,1920]){
 await page.setViewportSize({width,height:900});
 for(const theme of ['light','dark']){console.log('VIEW',width,theme);
  await page.evaluate(async mode=>(await import('/js/modules/shell.js')).applyTheme(mode),theme);
  await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),theme==='light'?'rgb(248, 249, 250)':'rgb(15, 15, 16)');
  for(const id of ['contributors','models','news','notifications','subscriptions','chat','system','profile']){
   await selectTab(id);
   assert(await page.locator('#tab-'+id).isVisible(),id);
   const dims=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
   if(dims.scroll>dims.w+1)console.error(await page.evaluate(()=>[...document.querySelectorAll("body *")].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,id:el.id,cls:el.className,right:el.getBoundingClientRect().right})).slice(0,20)));assert(dims.scroll<=dims.w+1,`${width}/${theme}/${id}: overflow ${dims.scroll}`);
  }
  await selectTab('contributors');if(process.env.VERTEX_SCREENSHOTS){await page.waitForTimeout(250);fs.mkdirSync(process.env.VERTEX_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.VERTEX_SCREENSHOTS,`before-${width}-${theme}.png`)});}await openCert();
  await page.waitForFunction(()=>{
   const r=document.querySelector('.certificate-drawer')?.getBoundingClientRect();
   return !!r&&r.left>=-0.5&&r.right<=innerWidth+0.5&&r.top>=-0.5&&r.bottom<=innerHeight+0.5;
  },null,{timeout:4000});
  const box=await page.locator('.certificate-drawer').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=901,JSON.stringify(box));
  if(process.env.VERTEX_SCREENSHOTS){fs.mkdirSync(process.env.VERTEX_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.VERTEX_SCREENSHOTS,`vertex-${width}-${theme}.png`)});}
  await page.keyboard.press('Escape');
 }
}
note('8 navigation tabs, light/dark, 6 viewport widths, popover bounds');
await page.setViewportSize({width:1440,height:900});
await page.locator('[data-details]').first().click();await page.waitForSelector('.vx-drawer.is-open');await page.keyboard.press('Escape');await page.waitForSelector('.vx-drawer',{state:'detached'});note('Contributor drawer');
const waitCrossfade = () => page.waitForFunction(() => !document.querySelector('.ui-crossfade-ghost'));
await page.locator('#contributor-search').fill('nobody');await page.evaluate(()=>window.searchContributorsLocal());await waitCrossfade();assert.equal(await page.locator('.contributor-row').count(),0);
await page.locator('#contributor-search').fill('Example');await page.evaluate(()=>window.filterContributors('interview'));await waitCrossfade();assert.equal(await page.locator('.contributor-row').count(),1);
await page.evaluate(()=>window.filterContributors('verified'));await waitCrossfade();assert.equal(await page.locator('.contributor-row').count(),0);await page.evaluate(()=>window.filterContributors('all'));note('Combined search and filters');
await waitCrossfade();
// Real contributor renderer: switching between populated chips must animate,
// not just the single-row fixture used in the historic regression.
await page.locator('#contributor-search').fill('');
people=Array.from({length:85},(_,i)=>({
  ...person,id:'filter-fixture-'+i,name:'Applicant '+i,
  email:'applicant'+i+'@example.invalid',hasVerified:i%2===0
}));
await page.evaluate(fixtures=>{
 window.__savedContributors=window.loadedContributors;
 window.loadedContributors=fixtures;
 window.filterContributors('all');
},people);
await waitCrossfade();
const listTopBefore=await page.locator('#contributors-list-container').evaluate(el=>el.getBoundingClientRect().top);
await page.evaluate(()=>window.filterContributors('verified'));
const listTopAfter=await page.locator('#contributors-list-container').evaluate(el=>el.getBoundingClientRect().top);
assert(Math.abs(listTopAfter-listTopBefore)<1,'Filter moved its list header vertically');
const filterTransition=await page.evaluate(()=>{
 const host=document.getElementById('contributors-list-container');
 return {ghost:!!host.querySelector('.ui-crossfade-ghost'),
  newRows:host.querySelector(':scope > .contributor-table-rows')?.children.length,
  animating:!!host.querySelector(':scope > .contributor-table-rows')?.getAnimations().length,
  height:host.getBoundingClientRect().height};
});
assert.equal(filterTransition.ghost,false,JSON.stringify(filterTransition));
assert.equal(filterTransition.newRows,43);
assert.equal(filterTransition.animating,true);
assert(filterTransition.height>=460,JSON.stringify(filterTransition));
assert.equal(await page.locator('#contributors-list-container').evaluate(el=>el.style.minHeight),'');
assert.equal(await page.locator('#tab-contributors .filter-chip[data-filter="verified"]').getAttribute('aria-pressed'),'true');
await waitCrossfade();
people=null;
await page.evaluate(()=>{
 window.loadedContributors=window.__savedContributors;
 delete window.__savedContributors;
 window.filterContributors('all');
});
await waitCrossfade();
assert.equal(await page.locator('#tab-contributors .filter-chip[data-filter="all"]').getAttribute('aria-pressed'),'true');
note('Applicant filtering replaces rows without ghosts or height jumps');
await openCert();assert.deepEqual(await page.locator('[data-award]').evaluateAll(es=>es.map(e=>e.dataset.award)),['tenacity','constancy','nobility','majesty']);
await page.locator('[data-award=tenacity]').click();assert.equal(issueCount(),0);await page.locator('[data-review]').click();await page.waitForSelector('.confirm-ok');assert.equal(issueCount(),0);
await page.locator('.confirm-ok').focus();await page.keyboard.press('Tab');assert(await page.locator('.confirm-cancel').evaluate(el=>el===document.activeElement));await page.keyboard.press('Shift+Tab');assert(await page.locator('.confirm-ok').evaluate(el=>el===document.activeElement));await page.evaluate(async()=>{(await import('/js/lang.js')).setLang('tr');});assert.equal(await page.locator('.vx-modal-title').innerText(),'Sertifikayı İncele');await page.evaluate(async()=>{(await import('/js/lang.js')).setLang('en');});await page.locator('.confirm-cancel').click();assert.equal(issueCount(),0);note('Selection and cancellation never issue certificates; confirmation focus trap and live language');
await openCert();await page.locator('[data-date]').click();await page.locator('#joined-at').fill('2026-01-01');await page.locator('#joining-date-form [type=submit]').click();await page.waitForSelector('[data-award]');assert.equal(payloads.find(p=>p.name==='setvertexcontributorjoiningdate').data.joinedAt,'2026-01-01');note('Separate joining date editor and exact date payload');
await page.locator('[data-award=tenacity]').click();await page.locator('[data-review]').click();await page.waitForSelector('.confirm-ok');await page.locator('.confirm-ok').click();await page.waitForFunction(()=>document.querySelectorAll('.certificate-manage-btn').length>0);await page.waitForTimeout(150);assert.equal(issueCount(),1);assert.deepEqual(payloads.find(p=>p.name==='issuevertexcertificate').data,{contributorId:'person',certificateType:'tenacity'});note('Explicit confirmation and correct issue payload');
await openCert();assert(await page.locator('[data-award=tenacity]').isDisabled());await page.locator('[data-history]').click();assert(await page.locator('.is-processing').isVisible());await page.locator('[data-revoke]').click();await page.waitForSelector('.confirm-ok');assert(!calls.includes('revokevertexcertificate'));await page.locator('.confirm-ok').click();await page.waitForSelector('.is-revoked');await page.keyboard.press('Escape');await page.waitForSelector('.vx-drawer',{state:'detached'});note('Processing history and explicit revoke confirmation');
history=[{id:'uncertain',certificateType:'tenacity',status:'uncertain',attempts:[]}];await openCert();assert(await page.locator('[data-award=tenacity]').isDisabled());await page.locator('[data-history]').click();assert.equal(await page.locator('[data-retry]').count(),0);await page.keyboard.press('Escape');await page.waitForSelector('.vx-drawer',{state:'detached'});note('Uncertain blocks resending');
for(const retrySafe of [false,true]){history=[{id:'failed',certificateType:'tenacity',status:'failed',retrySafe,attempts:[]}];await openCert();assert(await page.locator('[data-award=tenacity]').isDisabled());await page.locator('[data-history]').click();assert.equal(await page.locator('[data-retry]').count(),retrySafe?1:0);if(retrySafe){await page.locator('[data-retry]').click();await page.waitForSelector('.confirm-ok');await page.locator('.confirm-ok').click();await page.waitForTimeout(150);assert.equal(payloads.filter(p=>p.name==='issuevertexcertificate').at(-1).data.retry,true);}await page.keyboard.press('Escape');await page.waitForSelector('.vx-drawer',{state:'detached'});}
note('Failed retrySafe gate and retry:true contract');
history=[];await openCert();await page.evaluate(async()=>{(await import('/js/lang.js')).setLang('tr');});assert.equal(await page.locator('.certificate-drawer .vx-drawer-title').innerText(),'Sertifika Tanımla');await page.evaluate(async()=>{(await import('/js/lang.js')).setLang('en');});await page.keyboard.press('Escape');note('Live TR/EN popover localization');
for(let i=0;i<8;i++){await openCert();await page.keyboard.press('Escape');assert.equal(await page.locator('.certificate-drawer:not([aria-hidden=true])').count(),0);}assert(await page.locator('.certificate-manage-btn').first().evaluate(el=>el===document.activeElement));note('Repeated open/close and focus restoration');
await page.emulateMedia({colorScheme:'light'});await page.evaluate(async()=>{(await import('/js/modules/shell.js')).applyTheme('system');});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(248, 249, 250)');await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(15, 15, 16)');note('System theme follows OS');
people=[];await page.locator('#refresh-contributors-btn').click();await page.waitForSelector('#contributors-list-container .state-block');note('Empty state');
failContributors=true;await page.locator('#refresh-contributors-btn').click();await page.waitForSelector('#contributors-list-container .contributors-inline-error button');failContributors=false;people=null;await page.locator('#contributors-list-container .contributors-inline-error button').click();await page.waitForFunction(()=>!document.querySelector('#contributors-list-container .contributors-inline-error')&&!!document.querySelector('#contributors-list-container .contributor-row'));note('Error and retry state');
// Close any contributor drawer left open by the preceding certificate/focus tests.
await page.keyboard.press('Escape');
await page.waitForSelector('.vx-drawer.is-open',{state:'detached'});
await page.evaluate(()=>{document.getElementById('contributors-list-container').replaceChildren();});
const blankHeight=await page.locator('#contributors-list-container').evaluate(el=>el.getBoundingClientRect().height);
contributorDelay=500;
await page.locator('#refresh-contributors-btn').click();
await page.waitForSelector('#contributors-list-container .skeleton');
const skeletonHeight=await page.locator('#contributors-list-container').evaluate(el=>el.getBoundingClientRect().height);
await page.waitForSelector('.contributor-row');
const loadedHeight=await page.locator('#contributors-list-container').evaluate(el=>el.getBoundingClientRect().height);
assert(Math.abs(blankHeight-skeletonHeight)<1&&Math.abs(skeletonHeight-loadedHeight)<1,
 'Contributor list jumped on load: '+JSON.stringify({blankHeight,skeletonHeight,loadedHeight}));
assert.equal(await page.locator('#contributors-list-container .skeleton').count(),0);
contributorDelay=0;
note('Stable applicant viewport through delayed first hydration')
people=[{...person,name:'Old Response'}];contributorDelay=500;
await page.evaluate(()=>{import('/js/modules/contributors.js').then(m=>m.fetchContributorsData());});await page.waitForTimeout(75);people=[{...person,name:'Latest Response'}];contributorDelay=0;
await page.evaluate(async()=>{await(await import('/js/modules/contributors.js')).fetchContributorsData();});await page.waitForTimeout(550);assert.equal(await page.locator('.contributor-name').innerText(),'Old Response');await page.locator('#refresh-contributors-btn').click();await page.waitForFunction(()=>document.querySelector('.contributor-name')?.textContent==='Latest Response');people=null;note('Concurrent refreshes coalesce and subsequent refresh loads latest data');
// Draft-preview integration: the real-site iframe handshake may not trigger
// publication or registration, and must deliver unsaved form edits securely.
await page.route('https://events.vertexishere.com/**',route=>route.fulfill({
 contentType:'text/html',
 body:'<!doctype html><html><body><script>'+
 'const origin=new URL(document.referrer).origin;'+
 'window.addEventListener("message",e=>{if(e.origin!==origin||e.data?.type!=="vertex:event-preview:render")return;'+
 'document.body.textContent=e.data.event.title;'+
 'parent.postMessage({type:"vertex:event-preview:rendered",version:1,id:e.data.event.id},origin);});'+
 'parent.postMessage({type:"vertex:event-preview:ready",version:1},origin);'+
 '</scr'+'ipt></body></html>'
}));
await selectTab('events');
await page.locator('[data-nav-panel="events.editor"]').click();
await page.locator('#event-id').fill('preview_fixture');
await page.locator('#event-title').fill('Unpublished draft preview');
await page.locator('#event-desc').fill('Draft details');
await page.locator('#event-date').fill('2099-06-10');
await page.locator('#event-location').fill('Online');
const callsBeforePreview=calls.length;
await page.locator('#events-preview').click();
await page.waitForSelector('#events-preview-content .ui-eventsite-frame:not([hidden])');
assert.equal(await page.frameLocator('#events-preview-content iframe').locator('body').innerText(),
  'Unpublished draft preview');
assert.equal(calls.length,callsBeforePreview,'Preview must never persist or publish drafts');
note('Eventsite draft iframe uses origin-checked postMessage without publication');
await selectTab('models');await page.locator('[data-model-create]').click();await page.locator('#model-id').fill('fixture-model');assert.equal(await page.locator('#model-id').inputValue(),'fixture-model');await page.keyboard.press('Escape');await page.waitForSelector('.vx-drawer',{state:'detached'});note('Model editor drawer remains editable');
await page.locator('#manual-models-list-container .model-actions-trigger').click();await page.locator('.model-menu .menu-item').filter({hasText:'Translations'}).click();await page.waitForSelector('#translation-modal-overlay');assert(await page.locator('#translation-modal-overlay input').count()>0);await page.keyboard.press('Escape');await page.waitForSelector('.vx-modal',{state:'detached'});await page.locator('[data-model-publish]').click();await page.waitForSelector('.confirm-ok');await page.locator('.confirm-cancel').click();assert(!calls.includes('updatemodelslist'));await page.locator('[data-model-publish]').click();await page.waitForSelector('.confirm-ok');await page.locator('.confirm-ok').click();await page.waitForTimeout(150);assert(calls.includes('updatemodelslist'));note('Catalog actions, translation focus surface and explicit publish confirmation (mock)');
for(const width of [360,1440]){await page.setViewportSize({width,height:900});for(const id of ['models','news','notifications','subscriptions','chat','system']){await selectTab(id);await page.waitForTimeout(300);if(process.env.VERTEX_SCREENSHOTS){fs.mkdirSync(path.resolve(root,process.env.VERTEX_SCREENSHOTS),{recursive:true});await page.screenshot({path:path.resolve(root,process.env.VERTEX_SCREENSHOTS,`vertex-${id}-${width}.png`),fullPage:true});}}}await selectTab('news');for(const id of ['title-en','title-tr','summary-en','summary-tr','content-en','content-tr'])await page.locator('#'+id).fill('Fixture Article');for(const lang of ['en','tr'])await page.locator('#cover-image-'+lang).setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('fixture')});await page.locator('#news-form').evaluate(form=>form.requestSubmit());await page.waitForTimeout(150);assert(calls.includes('createnewsarticle'));note('News image upload and publish payload remain functional (mock)');
await page.locator('[data-nav-panel="news.published"][data-nav-action=""]').click();
await page.waitForSelector('.news-edit-btn');await page.locator('.news-edit-btn').first().click();
await page.waitForSelector('#news-editing-hint');
assert.equal(await page.locator('#cover-image-en').getAttribute('required'),null);
await page.locator('#title-en').fill('Edited Fixture');
await page.locator('#news-form').evaluate(form=>form.requestSubmit());
await page.waitForFunction(()=>!document.getElementById('submit-btn').disabled);
const editPayload=payloads.find(p=>p.name==='updatenewsarticle').data;
assert.equal(editPayload.revision,0);assert.equal(editPayload.article.cover.en,'news/covers/fixture/en.png');
note('News edits preserve the original slug, revision and unchanged cover paths');

await selectTab('notifications');await page.locator('#notification-template-selector').selectOption('appUpdate');await page.locator('#notification-target-type').selectOption('ALL_USERS');await page.locator('#notification-schedule-switch').check();await page.locator('#notification-schedule-time').fill('2027-01-01T12:00');await page.locator('#notification-form').evaluate(form=>form.requestSubmit());await page.waitForTimeout(150);assert(calls.includes('schedulenotification'));note('Notification template and scheduling payload (mock)');await page.locator('#notification-template-selector').selectOption('appUpdate');await page.locator('#notification-target-type').selectOption('SUBSCRIPTION_LEVEL');await page.locator('#notification-target-level').selectOption('3');await page.locator('#notification-schedule-switch').check();await page.locator('#notification-schedule-time').fill('2027-01-01T12:00');await page.locator('#notification-form').evaluate(f=>f.requestSubmit());await page.waitForTimeout(150);assert.deepEqual(payloads.filter(p=>p.name==='schedulenotification').at(-1).data.target,{type:'SUBSCRIPTION_TIER',tier:'ultra'});note('Notification subscription tier contract includes Ultra');failNotification=true;await page.locator('#notification-template-selector').selectOption('appUpdate');await page.locator('#notification-target-type').selectOption('ALL_USERS');await page.locator('#notification-form').evaluate(f=>{f.requestSubmit();f.requestSubmit();});await page.waitForTimeout(150);assert.equal(payloads.filter(p=>p.name==='sendtargetednotification').length,1);assert(await page.locator('#submit-notification-btn').isDisabled());note('Uncertain immediate delivery blocks duplicate submission and blind retry');
await selectTab('subscriptions');await page.locator('#sub-user-email').fill('fixture@example.invalid');await page.locator('#sub-plan').selectOption('pro');await page.locator('#subscription-form').evaluate(form=>form.requestSubmit());await page.waitForTimeout(150);assert.equal(payloads.find(p=>p.name==='setusersubscription').data.tier,'pro');note('Subscription Pro assignment contract (mock)');
await page.locator('#sub-bulk-toggle').click();
await page.locator('#sub-bulk-input').fill('fixture@example.invalid');
await page.locator('#sub-bulk-submit').click();
await page.locator('.confirm-dialog-modal .confirm-cancel').click();
assert(!calls.includes('bulksetusersubscriptions'));
await page.locator('#sub-bulk-submit').click();
await page.locator('.confirm-dialog-modal .confirm-ok').click();
await page.waitForTimeout(150);
assert.equal(calls.filter(n=>n==='previewbulkusersubscriptions').length,2);
assert.equal(calls.filter(n=>n==='bulksetusersubscriptions').length,1);
note('Bulk subscriptions preview current server data and cancellation performs no write');

await selectTab('chat');await page.locator('#chat-input').fill('Mock message');await page.locator('#chat-send').click();await page.waitForTimeout(150);assert(calls.includes('postconsolechatmessage'));note('Chat channels, messages and posting (mock)');
await selectTab('system');await page.locator('[data-section=departments]').dispatchEvent('click');
const choices=await page.locator('#dept-options .dept-choice').evaluateAll(labels=>labels.map(label=>{
 const a=label.querySelector('input').getBoundingClientRect(),b=label.querySelector('span').getBoundingClientRect();
 return {center:Math.abs((a.top+a.bottom-b.top-b.bottom)/2),gap:b.left-a.right,width:a.width};
}));
assert(choices.length>=10);assert(choices.every(c=>c.center<1.5&&c.gap>=8&&c.width===16),JSON.stringify(choices));
note('Department checkboxes are vertically centered with horizontal label spacing');
assert.equal(await page.locator('[data-section]').count(),6);assert.equal(await page.locator('#admin-manager,#admin-list-manager,[data-nav-action=administrators]').count(),0);assert(!calls.some(name=>['addadminrole','removeadminrole','listadmins'].includes(name)));await page.locator('[data-section=export]').dispatchEvent('click');assert(await page.locator('#data-exporter-manager').isVisible());note('6 functional System sections; legacy administrator UI and calls retired');
await selectTab('contributors');
}
// Functional regressions are run without transient visual clones. Dedicated UI
// smoke tests separately assert animated crossfades and reduced-motion behavior.
await page.emulateMedia({reducedMotion:'reduce'});
if(process.env.VERTEX_STABILIZATION_ONLY)await require('./stabilization.cjs')({page,selectTab,note,calls,payloads,person,setPeople:value=>{people=value;},failMembership:value=>{failMembership=value;},failAdmin:value=>{failAdmin=value;},setAdmins:value=>{adminRoster=value;},setContributorDelay:value=>{contributorDelay=value;},failContributors:value=>{failContributors=value;},setHistory:value=>{history=value;}});
if(process.env.VERTEX_COMPLETE_ONLY)await require('./complete-polish.cjs')({page,selectTab,note,calls,payloads,person,setPeople:value=>{people=value;},failMembership:value=>{failMembership=value;},failAdmin:value=>{failAdmin=value;},setAdmins:value=>{adminRoster=value;},setContributorDelay:value=>{contributorDelay=value;},failContributors:value=>{failContributors=value;},setHistory:value=>{history=value;}});
if(!process.env.VERTEX_COMPLETE_ONLY&&!process.env.VERTEX_STABILIZATION_ONLY)await require('./final-polish.cjs')({page,selectTab,note,calls,payloads,setPeople:value=>{people=value;},person,failMaintenance:value=>{failMaintenance=value;},failVerify:value=>{failVerify=value;}});
if(!process.env.VERTEX_COMPLETE_ONLY&&!process.env.VERTEX_STABILIZATION_ONLY)await require('./precision.cjs')({page,selectTab,note,payloads,calls,failPermissions:value=>{failPermissionSave=value;}});
await selectTab('contributors');
// Role presentation uses the same masked DTO contract as the backend.
 // In production, masked fields are removed BEFORE the browser receives them.
 people=[{...person,email:undefined,phone:undefined,about:undefined,
   age:undefined,birthDate:undefined,birthYear:undefined,
   linkedin:undefined,github:undefined,interviewDate:undefined}];
 await page.evaluate(async()=>{
   const roles=await import('/js/modules/roles.js');
   roles.setCurrentUser(false,['Senatus']);
   await roles.loadDepartmentPermissions();
   const permissions=roles.getDepartmentPermissions();
   permissions.Senatus.hiddenFields={'contributors.list':['contact','age','links','interview']};
   permissions.Senatus.hiddenChips={'contributors.list':['github']};
   await (await import('/js/modules/contributors.js')).fetchContributorsData();
 });
 assert.equal(await page.locator('.certificate-manage-btn').count(),0);
 assert.equal(await page.locator('.edit-contributor-btn').count(),0);
 assert.equal(await page.evaluate(async()=> (await import('/js/modules/roles.js')).getEffectivePanelLevel('contributors.list')),'read');
 assert.equal(await page.locator('.contributor-cell-age').innerText(),'—');
 await page.locator('#contributor-search').fill('person@example.invalid');
 assert.equal(await page.locator('.contributor-row').count(),0);
 await page.locator('#contributor-search').fill('Local test fixture');
 assert.equal(await page.locator('.contributor-row').count(),0);
 await page.locator('#contributor-search').fill('Example Participant');
 await page.waitForSelector('.contributor-row');
 assert.equal(await page.locator('.contributor-row').count(),1);
 assert.equal(await page.evaluate(()=>Object.hasOwn(window.loadedContributors[0],'email') && window.loadedContributors[0].email!==undefined),false);
 await page.locator('#contributor-search').fill('');
 await page.locator('[data-details]').click();
 assert.equal(await page.locator('.vx-drawer-body').innerText().then(s=>s.includes('person@example.invalid')),false);
 await page.keyboard.press('Escape');
 people=null;
 note('Department read-only actions and server-masked fields stay private');
 await page.locator('[data-details]').click();await page.waitForSelector('.vx-drawer');await page.evaluate(()=>document.getElementById('logout-btn').click());await page.waitForSelector('.vx-drawer',{state:'detached'});await page.waitForSelector('#login-container',{state:'visible'});assert.equal(await page.locator('#admin-panel').isVisible(),false);await page.locator('#email').fill('admin@example.invalid');await page.locator('#password').fill('test-only');await page.locator('#login-btn').click();await page.waitForSelector('#admin-panel',{state:'visible'});await selectTab('contributors');await page.waitForSelector('.certificate-manage-btn');note('Logout and admin login auth state');
for(const claims of [{admin:false,departments:['Senatus']},{admin:false,departments:['Aero']}]) {
 const before=calls.filter(name=>name==='savedepartmentpermissions').length;
 await page.evaluate(async value=>{window.__testClaims=value;await window.firebase.auth().signOut();},claims);
 await page.waitForSelector('#login-container',{state:'visible'});
 await page.locator('#email').fill('member@example.invalid');await page.locator('#password').fill('test-only');await page.locator('#login-btn').click();
 await page.waitForSelector('#admin-panel',{state:'visible'});await page.waitForTimeout(200);
 assert.equal(await page.locator('[data-nav-action=certificates]').isVisible(),false);
 assert.equal(await page.locator('[data-nav-action=model-editor]').isVisible(),false);
 assert.equal(await page.locator('[data-i18n="subnav.permissions"]').isVisible(),false);
 if(claims.departments[0]==='Aero')assert.equal(await page.locator('[data-target=tab-system]').isVisible(),false);
 assert.equal(calls.filter(name=>name==='savedepartmentpermissions').length,before);
}
await page.evaluate(async()=>{window.__testClaims={admin:true};await window.firebase.auth().signOut();});
await page.waitForSelector('#login-container',{state:'visible'});await page.locator('#email').fill('admin@example.invalid');await page.locator('#password').fill('test-only');await page.locator('#login-btn').click();await page.waitForSelector('#admin-panel',{state:'visible'});await selectTab('contributors');await page.waitForSelector('.certificate-manage-btn');
note('Real auth flow hides inaccessible submenus for read-only and contributor-only departments without saving defaults');
await page.emulateMedia({reducedMotion:'reduce'});assert(await page.locator('.tab-panel.active').evaluate(el=>parseFloat(getComputedStyle(el).animationDuration)<0.001));note('Reduced motion removes transitions and animations');assert.equal(await page.locator('.material-symbols-rounded').count(),0);assert.equal(errors.length,0,errors.join('\n'));assert.deepEqual(consoleErrors,[]);
const report={suite:process.env.VERTEX_STABILIZATION_ONLY?'stabilization':'regression',browser:process.env.VERTEX_BROWSER||'chromium',checks,uncaughtErrors:errors,unexpectedConsoleErrors:consoleErrors,viewportWidths:process.env.VERTEX_QUICK?[390]:process.env.VERTEX_STABILIZATION_ONLY?[320,360,375,390,430,768,1024,1440,1920]:process.env.VERTEX_COMPLETE_ONLY?[390,768,1440,1920]:[320,360,390,768,1024,1440,1920],themes:['light','dark','system'],mockCalls:calls.length};fs.mkdirSync(path.join(root,'tests/results'),{recursive:true});fs.writeFileSync(path.join(root,'tests/results/'+(process.env.VERTEX_BROWSER||'chromium')+(process.env.VERTEX_STABILIZATION_ONLY?'-stabilization':'')+'-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(process.env.VERTEX_TRACE)await page.context().tracing.stop({path:path.join(root,'tests/results/precision-trace.zip')});await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1);});
