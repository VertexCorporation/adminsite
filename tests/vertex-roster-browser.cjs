const {chromium,webkit} = require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const p=path.join(root,decodeURIComponent(req.url.split('?')[0])==='/'?'index.html':req.url.split('?')[0]);if(!p.startsWith(root))return res.end();fs.readFile(p,(err,data)=>{if(err){res.statusCode=404;return res.end();}res.setHeader('Content-Type',p.endsWith('.woff2')?'font/woff2':p.endsWith('.ttf')?'font/ttf':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':p.endsWith('.svg')?'image/svg+xml':'text/html');res.end(data);});});
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await (process.env.VERTEX_BROWSER==='webkit'?webkit:chromium).launch({...(process.env.VERTEX_BROWSER!=='webkit'&&process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),headless:true});
const errors=[],consoleErrors=[],calls=[],payloads=[]; let verificationValid=true,history=[],people=null,contributorDelay=0,failContributors=false,failNotification=false; let joiningDate=null,failPermissionSave=false,failMaintenance=false,maintenanceState=false,failVerify=false;

let rosterApproved=false;let failMembership=false,failAdmin=false;let adminRoster=[{uid:'admin',email:'admin@example.invalid'},{uid:'other-admin',email:'other@example.invalid'}];
const person={membership:{status:'matched',uid:'auth-person',isVertex:true},id:'person',name:'Example Participant',email:'person@example.invalid',language:'en',hasVerified:false,createdAt:{_seconds:1767272400},department:'Core',interviewDate:'2026-10-10',about:'Local test fixture'};
const types={merit:{en:'Merit',tr:'Liyakat'},tenacity:{en:'Tenacity',tr:'Dirayet'},constancy:{en:'Constancy',tr:'Metanet'},nobility:{en:'Nobility',tr:'Asalet'},majesty:{en:'Majesty',tr:'Azamet'}};
const page=await browser.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR:',e.message);});page.on('console',m=>{if(m.type()==='error'){if(!/503|500|\[AUTH\] Login failed auth\/(?:invalid-credential|too-many-requests|network-request-failed)|Fixture unavailable|Mock delivery outcome uncertain|Fixture permission rejection|Fixture verification unavailable|Fixture maintenance unavailable|400 \(Bad Request\)|functions\/failed-precondition|\[CERTIFICATES\]/.test(m.text()))consoleErrors.push(m.text());console.error('CONSOLE:',m.text());}});page.setDefaultTimeout(12000);
if(process.env.VERTEX_TRACE)await page.context().tracing.start({screenshots:true,snapshots:true,sources:true});
await page.addInitScript(()=>{
 localStorage.setItem('siteLang','en');
 const snapshot={docs:[],empty:true,exists:false,data:()=>({}),forEach:()=>{}};
 const chain={orderBy:()=>chain,where:()=>chain,limit:()=>chain,doc:()=>chain,get:async()=>snapshot,onSnapshot:fn=>{setTimeout(()=>fn(snapshot),0);return ()=>{};}};
 const user={uid:'admin',email:'admin@example.invalid',displayName:'Local Admin',getIdTokenResult:async()=>({claims:window.__testClaims || {admin:true}}),getIdToken:async()=>'test-only',updateProfile:async()=>{}};
 const listeners=[];const auth={currentUser:user,onAuthStateChanged:fn=>{listeners.push(fn);setTimeout(()=>fn(user),10);return ()=>{};},signOut:async()=>{auth.currentUser=null;listeners.forEach(fn=>fn(null));},signInWithEmailAndPassword:async()=>{if(window.__testAuthError)throw Object.assign(new Error('Private authentication detail'),{code:window.__testAuthError});auth.currentUser=user;listeners.forEach(fn=>fn(user));}};
 window.firebase={apps:[],initializeApp:()=>{},auth:()=>auth,firestore:()=>({collection:()=>chain}),storage:()=>({}),functions:()=>({}),appCheck:()=>({activate:()=>{},getToken:async()=>({token:'fixture-app-check'})}),app:()=>({functions:()=>({httpsCallable:()=>async()=>({data:{}})})})};
});
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.hostname.endsWith('cloudfunctions.net')) return route.fulfill({contentType:'application/json',body:JSON.stringify(verificationValid ? {valid:true,name:'Example Participant',language:'en',certificateType:'tenacity',formattedDate:'01/01/2026'} : {valid:false})});
 if(url.hostname==='127.0.0.1'){
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
  if(name==='previewvertexroster')result={version:1,asOf:'2026-10-15T00:00:00Z',digest:'a'.repeat(64),applicationEnabled:false,activeOutside:[{uid:'outside',email:'outside@example.invalid'}],rows:Array.from({length:61},(_,i)=>({phone:'+905'+String(100000000+i),name:'Fixture '+i,email:'person'+i+'@example.invalid',emailVerified:true,application:'app'+i,cortexAccount:true,uid:'uid'+i,departments:['Chroma'],currentRoles:[],proposedRoles:[],roleReview:'member-role-mapping-requires-approval',joining:{value:'2026-09-08',estimated:true},before:{isVertex:false,joinedAt:null,tier:'free'},after:{isVertex:true,joinedAt:'2026-09-08',tier:'plus'},plus:'to-grant',result:i===60?'manual-review':'ready',reasons:i===60?['email-unverified']:[]}))};
  if(name==='getvertexrosterapproval')result={approved:rosterApproved};
  if(name==='applyvertexroster')result={completed:true,results:route.request().postDataJSON().data.preview.rows.map(r=>({phone:r.phone,result:r.result==='ready'?'successful':'manual-review'}))};
  if(name==='getserverstatus')result={isUnderMaintenance:maintenanceState};
  if(name==='setserverstatus'){maintenanceState=route.request().postDataJSON().data.maintenanceEnabled;result={success:true};}
  if(name==='togglevertexstatus'||name==='setvertexmembership'){if(failMembership)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Fixture unavailable'}})});const data=route.request().postDataJSON().data;const next=typeof data.expectedStatus==='boolean'?!data.expectedStatus:true;if(data.contributorId){const target=(people||[person]).find(p=>p.id===data.contributorId);if(target)target.membership.isVertex=next;}result={isVertex:next};}
  if(name==='savedepartmentpermissions' && failPermissionSave)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Fixture permission rejection'}})});
  if(name==='getvertexcontributors'){const fixture=people || [person];if(contributorDelay)await new Promise(r=>setTimeout(r,contributorDelay));if(failContributors)return route.fulfill({contentType:'application/json',status:503,body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Fixture unavailable'}})});result={contributors:fixture};}
  else if(name==='getvertexcertificatedetails')result={types,eligibility:{status:'joining-date-required',eligibleTypes:[],joinedAt:joiningDate},history};
  else if(name==='setvertexcontributorjoiningdate'){joiningDate=route.request().postDataJSON().data.joinedAt;result={success:true};}
  else if(name==='issuevertexcertificate'){history=[{id:'person--tenacity',certificateType:'tenacity',status:'processing',attempts:[]}];result={id:'person',status:'processing'};}
  else if(name==='revokevertexcertificate'){history=history.map(j=>({...j,status:'revoked'}));result={success:true};}
  else if(name==='listconsolechatchannels')result={isAdmin:true,channels:[{id:'general',name:'General',canPost:true,canManage:true}]};
  else if(name==='listconsolechatmessages')result={messages:[{id:'m1',authorUid:'admin',authorName:'Local Admin',authorEmail:'admin@example.invalid',text:'Fixture message',createdAt:'2026-10-11T00:00:00Z'}]};
  else if(name==='bulksetusersubscriptions')result={grantedCount:1,failedCount:1,failed:[{email:'missing@example.invalid',error:'User not found'}],invalidTokens:[]};
  else if(name==='listdepartmentusers')result={users:[]};
  else if(name==='listadmins')result={admins:adminRoster};
  else if(name==='removeadminrole'){if(failAdmin)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE',message:'Fixture unavailable'}})});adminRoster=adminRoster.filter(a=>a.email!==route.request().postDataJSON().data.email);result={success:true};}
  else if(name==='listusersubscriptions')result={subscriptions:[{uid:'sub-fixture',displayName:'Example Subscriber',email:'subscriber@example.invalid',tier:'pro',source:'admin',expiresAt:'2027-01-01T12:00:00Z'},{uid:'sponsor',displayName:'Sponsor member',email:'sponsor@example.invalid',tier:'plus',source:'vertex',expiresAt:null}]};
  else if(name==='listsiteteam')result={staff:[],mods:[]};
  else if(name==='getcoveruploadurl')result={signedUrl:'https://upload.example.invalid/cover',filePath:'test-cover.png'};
  return route.fulfill({contentType:'application/json',body:JSON.stringify({result})});
 }
 if(url.pathname.endsWith('.json') || url.pathname === '/models')return route.fulfill({contentType:'application/json',body:JSON.stringify({producers:{Vertex:{Fixture:{Example:{id:'fixture-model',source:'manual',type:'offline',details:{en:{title:'Fixture Model'},tr:{title:'Örnek Model'}}}}}},models:[]})});
 return route.fulfill({status:200,body:'',contentType:url.hostname==='fonts.googleapis.com'||url.pathname.endsWith('.css')?'text/css':'text/plain'});
});

await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
await page.waitForSelector('#vertex-roster-launch:not([hidden])');
await page.locator('#vertex-roster-launch').click();
const phones=Array.from({length:61},(_,i)=>'+905'+String(100000000+i)).join('\n');
await page.locator('#vertex-roster-phones').fill(phones);
await page.getByRole('button',{name:'Match and preview',exact:true}).click();
await page.waitForSelector('.vertex-roster-row');
assert.equal(await page.locator('.vertex-roster-row').count(),61);
assert.equal(calls.filter(n=>n==='applyvertexroster').length,0);
assert(await page.getByText('Active outside reference roster: 1',{exact:false}).count());
await page.getByRole('button',{name:'Apply approved changes',exact:true}).click();
await page.waitForTimeout(200);assert.equal(calls.filter(n=>n==='applyvertexroster').length,0);
const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV report',exact:true}).click();
const download=await downloadPromise,csv=fs.readFileSync(await download.path(),'utf8');assert(csv.includes('person0@example.invalid'));assert(csv.includes('Referans liste dışında'));
for(const width of [360,1440])for(const theme of ['light','dark']) {
 await page.setViewportSize({width,height:900});await page.evaluate(async mode=>(await import('/js/modules/shell.js')).applyTheme(mode),theme);
 await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const box=await page.locator('.vx-drawer').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);
}
rosterApproved=true;await page.getByRole('button',{name:'Apply approved changes',exact:true}).click();await page.locator('.confirm-ok').click();
await page.getByText('Completed. You can download the result report.').waitFor();assert.equal(calls.filter(n=>n==='applyvertexroster').length,1);
assert.equal(payloads.find(p=>p.name==='applyvertexroster').data.preview.rows.length,61);
await page.locator('#vertex-roster-phones').fill(phones+'\n');assert.equal(await page.locator('.vertex-roster-row').count(),0);
assert(await page.getByRole('button',{name:'Download CSV report',exact:true}).isDisabled());
await page.keyboard.press('Escape');await page.waitForSelector('.vx-drawer',{state:'detached'});
const child=page.locator('[data-nav-panel="subscriptions.list"][data-nav-action=""]'),main=child.locator('xpath=ancestor::div[contains(@class,"nav-module")]').locator('.dock-btn');if(await main.getAttribute('aria-expanded')==='false')await main.click();await child.click();
await page.getByText('Vertex sponsorship · While membership is active',{exact:true}).waitFor();
const sponsorRow=page.locator('.dept-user-row').filter({hasText:'Sponsor member'});assert.equal(await sponsorRow.locator('button[data-uid]').count(),0);
assert.deepEqual(errors,[]);await browser.close();server.close();console.log('PASS roster import, read-only preview, operator gate, 61-row CSV, atomic apply payload, invalidation, light/dark/mobile');
})().catch(e=>{console.error(e);server.close();process.exit(1);});
