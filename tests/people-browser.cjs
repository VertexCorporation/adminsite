const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),fixture=fs.readFileSync(path.join(__dirname,'browser.cjs'),'utf8').split('await page.addInitScript(()=>{')[1].split('\n});')[0];
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(req.url.split('?')[0])==='/'?'index.html':req.url.split('?')[0]);if(!file.startsWith(root+path.sep)){res.statusCode=403;return res.end();}fs.readFile(file,(error,data)=>{res.statusCode=error?404:200;res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.ttf')?'font/ttf':'text/html');res.end(error?'':data);});});
const user={uid:'fixture',name:'Example Member',email:'member@example.invalid',authCreatedAt:'2026-01-01T10:00:00Z',membership:'unlinked',department:null,role:null,emailVerified:true,profileExists:true,linkStatus:'unlinked',providers:['google.com'],subscription:{tier:'pro'}};
const application={id:'application',name:'Example Applicant',email:'applicant@example.invalid',phone:'+905551234567',department:'Array',isVertex:true,createdAt:{_seconds:1767272400},joinedAt:'2020-01-01',membership:{source:'contributors',status:'matched',isVertex:true,fieldExists:true}};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];let unavailable=false,indexReady=true;page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(fixture);
await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1'){
 if(url.pathname.endsWith('/js/core/deployment-capabilities.js'))return route.fulfill({contentType:'text/javascript',body:'export const deploymentCapabilities={contributorMembershipWrites:false,contributorRoster:false,consolePeople:true,consoleMembershipWrites:true,consolePersonnelWrites:true};'});
 if(url.pathname.endsWith('/js/core/initializer.js'))return route.fulfill({contentType:'text/javascript',body:"import {startApp} from '../main.js';startApp({apiKey:'fixture'});"});return route.continue();}
 if(url.hostname.endsWith('run.app')){const name=url.hostname.split('-')[0],data=route.request().postDataJSON()?.data || {};requests.push({name,data});let result={};
 if(name==='getmyconsoleaccess')result={isAdmin:true,departments:[]};
 if(name==='getvertexcontributors'){if(unavailable)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE'}})});result={contributors:((!data.search||[application.name,application.email].some(v=>v.toLowerCase().includes(String(data.search).toLowerCase())))&&(!data.filter||data.filter==='all'||data.filter==='vertex'||(data.filter==='verified'&&application.hasVerified===true))?[application]:[])};}
 if(name==='updatecontributorapplication'){Object.assign(application,data);result={success:true};}
 if(name==='listconsoleusers'){if(unavailable)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{status:'UNAVAILABLE'}})});result=indexReady?{users:[{...user,name:data.cursor?'Second Page':user.name}],nextCursor:data.cursor?null:'cursor-2',indexReady:true}:{users:[],indexReady:false,indexed:0};}
 if(name==='getconsoleuser')result={user};
 if(name==='previewconsoleaccounts')result={emails:['applicant@example.invalid'],invalid:['bad'],duplicates:['applicant@example.invalid'],rows:[{email:'applicant@example.invalid',status:'ownership-required',uid:'fixture'}],accountCreationEnabled:false};
 if(name==='prepareconsoleuserdirectory'){indexReady=true;result={indexed:1,complete:true};}
 if(name==='setconsolecontributormembership'){application.isVertex=data.isVertex;result={isVertex:data.isVertex};}
 if(name==='listconsolechatchannels')result={channels:[],isAdmin:true};if(name==='listdepartmentusers')result={users:[]};if(name==='listadmins')result={admins:[]};if(name==='listsiteteam')result={staff:[],mods:[]};if(name==='listusersubscriptions')result={subscriptions:[]};
 return route.fulfill({contentType:'application/json',body:JSON.stringify({result})});}
 return route.fulfill({body:url.pathname.endsWith('.json')?'{}':'',contentType:url.pathname.endsWith('.json')?'application/json':'text/plain'});
});
try{
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
 // Contributor data loads on workspace entry, not at the initial home screen.
 await page.locator('.dock-btn[data-target="tab-contributors"]').click();
 await page.waitForSelector('.contributor-row',{timeout:12000}).catch(async error=>{
  console.error('PERSONNEL_FIXTURE_DIAGNOSTICS',JSON.stringify({
   pageErrors:errors,requests:requests.map(x=>x.name).slice(0,25),
   visibleText:(await page.locator('body').innerText()).slice(0,1400),
   hasFirebase:await page.evaluate(()=>Boolean(window.firebase))
  }));
  throw error;
 });page.setDefaultTimeout(10000);

 // The former contributors.users panel is intentionally retired; exercise
 // the current applicants workspace rather than creating a phantom route.
 await page.locator('[data-nav-panel="contributors.list"][data-nav-action=""]').click();
 await page.getByText('Example Applicant',{exact:true}).first().waitFor();
 assert(await page.locator('#contributors-list-container .contributor-row').count()>0);
 await page.locator('#contributor-search').fill('no-match-fixture');
 await page.waitForFunction(()=>document.querySelectorAll('#contributors-list-container .contributor-row').length===0);
 await page.locator('#contributor-search').fill('Example Applicant');
 await page.getByText('Example Applicant',{exact:true}).first().waitFor();
 await page.locator('#contributor-search').fill('');
 await page.locator('[data-filter="verified"]').click();
 await page.waitForTimeout(200);
 assert.equal(await page.locator('#contributors-list-container .contributor-row').count(),0);
 await page.locator('[data-filter="all"]').click();
 await page.locator('#contributors-list-container .contributor-row').first().waitFor();
 const edit=page.locator('#contributors-list-container .edit-contributor-btn').first();
 if(await edit.isVisible()){
  await edit.click();
  await page.locator('.vx-drawer .contributor-edit-form').waitFor();
  await page.locator('#ce-about').fill('Edited through browser regression');
  await page.locator('.vx-drawer [type="submit"]').click();
  await page.waitForTimeout(300);
  assert(requests.some(r=>r.name==='updatecontributorapplication'&&r.data.about==='Edited through browser regression'));
 }
 for(const width of [390,1440])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});
  await page.evaluate(async selected=>(await import('/js/modules/shell.js')).applyTheme(selected),theme);
  await page.waitForTimeout(150);
  assert(await page.locator('#contributors-list-container').isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.setViewportSize({width:1440,height:1000});
 unavailable=true;
 await page.locator('#refresh-contributors-btn').click();
 await page.waitForTimeout(200);
 unavailable=false;
 await page.locator('#refresh-contributors-btn').click();
 await page.getByText('Example Applicant',{exact:true}).first().waitFor();
 assert.deepEqual(errors,[]);console.log('PASS applicants, filter, drawer editing, error recovery, and responsive themes');
}finally{await browser.close();server.close();}})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
