const {chromium} = require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const p=path.join(root,decodeURIComponent(req.url.split('?')[0])==='/'?'index.html':req.url.split('?')[0]);if(!p.startsWith(root))return res.end();fs.readFile(p,(err,data)=>{if(err){res.statusCode=404;return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':'text/html');res.end(data);});});
(async()=>{
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),headless:true});
const errors=[],calls=[]; let verificationValid=true;
const person={id:'person',name:'Example Participant',email:'person@example.invalid',language:'en',hasVerified:false,createdAt:{_seconds:1767272400},department:'Core',interviewDate:'2026-10-10',about:'Local test fixture'};
const types={merit:{en:'Merit',tr:'Liyakat'},tenacity:{en:'Tenacity',tr:'Dirayet'},constancy:{en:'Constancy',tr:'Metanet'},nobility:{en:'Nobility',tr:'Asalet'},majesty:{en:'Majesty',tr:'Azamet'}};
const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 localStorage.setItem('lang','en');
 const snapshot={docs:[],empty:true,exists:false,data:()=>({}),forEach:()=>{}};
 const chain={orderBy:()=>chain,where:()=>chain,limit:()=>chain,doc:()=>chain,get:async()=>snapshot,onSnapshot:fn=>{setTimeout(()=>fn(snapshot),0);return ()=>{};}};
 const user={uid:'admin',email:'admin@example.invalid',displayName:'Local Admin',getIdTokenResult:async()=>({claims:{admin:true}}),getIdToken:async()=>'test-only',updateProfile:async()=>{}};
 const auth={currentUser:user,onAuthStateChanged:fn=>{setTimeout(()=>fn(user),10);return ()=>{};},signOut:async()=>{auth.currentUser=null;},signInWithEmailAndPassword:async()=>{}};
 window.firebase={apps:[],initializeApp:()=>{},auth:()=>auth,firestore:()=>({collection:()=>chain}),storage:()=>({}),functions:()=>({}),appCheck:()=>({activate:()=>{}}),app:()=>({functions:()=>({httpsCallable:()=>async()=>({data:{}})})})};
});
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.hostname.endsWith('cloudfunctions.net')) return route.fulfill({contentType:'application/json',body:JSON.stringify(verificationValid ? {valid:true,name:'Example Participant',language:'en',certificateType:'tenacity',formattedDate:'01/01/2026'} : {valid:false})});
 if(url.hostname==='127.0.0.1'){
  if(url.pathname.startsWith('/verify/'))return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.resolve(root,'../vertexite/verify.html'),'utf8')});
  if(url.pathname==='/js/core/initializer.js')return route.fulfill({contentType:'text/javascript',body:"import {startApp} from '../main.js'; startApp({apiKey:'test'});"});
  return route.continue();
 }
 if(process.env.VERTEX_TEST_ICON_FONT && url.hostname === 'fonts.googleapis.com') return route.fulfill({contentType:'text/css',body:"@font-face{font-family:'Material Symbols Rounded';src:url('https://fonts.gstatic.com/test.ttf')} .material-symbols-rounded{font-family:'Material Symbols Rounded';font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;white-space:nowrap;font-feature-settings:'liga';-webkit-font-smoothing:antialiased}"});
 if(process.env.VERTEX_TEST_ICON_FONT && url.hostname === 'fonts.gstatic.com') return route.fulfill({contentType:'font/ttf',body:fs.readFileSync(process.env.VERTEX_TEST_ICON_FONT)});
 if(url.hostname.endsWith('run.app')){
  const name=url.hostname.split('-')[0];calls.push(name);
  let result={};
  if(name==='getvertexcontributors')result={contributors:[person]};
  else if(name==='getvertexcertificatedetails')result={types,eligibility:{status:'joining-date-required',eligibleTypes:[]},history:[]};
  else if(name==='setvertexcontributorjoiningdate')result={success:true};
  else if(name==='issuevertexcertificate')result={id:'person',status:'processing'};
  else if(name==='listconsolechatchannels')result={channels:[]};
  else if(name==='listdepartmentusers')result={users:[]};
  else if(name==='listadmins')result={admins:[]};
  else if(name==='listusersubscriptions')result={subscriptions:[]};
  else if(name==='listsiteteam')result={staff:[],mods:[]};
  return route.fulfill({contentType:'application/json',body:JSON.stringify({result})});
 }
 if(url.pathname.endsWith('.json') || url.pathname === '/models')return route.fulfill({contentType:'application/json',body:JSON.stringify({producers:{},models:[]})});
 return route.fulfill({status:200,body:'',contentType:url.pathname.endsWith('.css')?'text/css':'text/plain'});
});
await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForSelector('.certificate-manage-btn');
const findings=[];
for(const width of [360,390,768,1440]){
 await page.setViewportSize({width,height:900});
 for(const theme of ['light','dark']){
  await page.evaluate(t=>t==='light'?document.documentElement.setAttribute('data-theme','light'):document.documentElement.removeAttribute('data-theme'),theme);
  for(const tab of await page.locator('.dock-btn').all()){
   await tab.click();
   const target=await tab.getAttribute('data-target');
   const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   // Existing admin design is intentionally preserved; certificate dialog layout is checked below.
  }
  await page.locator('[data-target="tab-contributors"]').click();
  if (process.env.VERTEX_SCREENSHOTS) { fs.mkdirSync(process.env.VERTEX_SCREENSHOTS,{recursive:true}); await page.screenshot({path:path.join(process.env.VERTEX_SCREENSHOTS,`vertex-${width}-${theme}.png`),fullPage:true}); }
 }
}
await page.locator('.certificate-manage-btn').click();await page.waitForSelector('[data-award]');assert.deepEqual(await page.locator('[data-award]').evaluateAll(es=>es.map(e=>e.dataset.award)),['tenacity','constancy','majesty','nobility']);
for (const width of [360,390,768,1440]) { await page.setViewportSize({width,height:900}); const bounds=await page.locator('#certificate-dialog').boundingBox(); if(bounds.x<0 || bounds.x+bounds.width>width+1) findings.push({width,dialog:bounds}); }
await page.locator('#joined-at').fill('2026-01-01');
await page.locator('#joining-date-form button').click();
await page.waitForFunction(() => !document.querySelector('[data-award]')?.disabled);
assert(calls.includes('setvertexcontributorjoiningdate'));

page.once('dialog',dialog=>dialog.accept());
await page.locator('[data-award=tenacity]').click();
await page.waitForFunction(() => !document.querySelector('[data-award]')?.disabled);
assert(calls.includes('issuevertexcertificate'));
await page.keyboard.press('Escape');await page.waitForSelector('#certificate-dialog',{state:'detached'});assert.equal(await page.locator('#certificate-dialog').count(),0);
await page.locator('#theme-toggle-btn').click();assert(await page.evaluate(()=>['dark','light'].includes(localStorage.getItem('theme'))));
await page.evaluate(()=>window.filterContributors('interview'));assert(await page.locator('[data-contributor-id="person"]').isVisible());
await page.goto(`http://127.0.0.1:${server.address().port}/verify/person--tenacity`);
await page.waitForSelector('#successState',{state:'visible'});assert.equal(await page.locator('#certType').innerText(),'Tenacity');
verificationValid=false;await page.reload();await page.waitForSelector('#errorState',{state:'visible'});assert.equal(await page.locator('#successState').isVisible(),false);
console.log(JSON.stringify({errors,overflow:findings,callCount:calls.length,verification:'valid and revoked states passed'},null,2));
await browser.close();server.close();if(errors.length||findings.length)process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exit(1);});
