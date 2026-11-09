'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {architectureFixture}=require('./helpers/architecture-fixture.cjs');
const root=path.resolve(__dirname,'..');
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://localhost');
 if(url.pathname==='/'){response.setHeader('Content-Type','text/html');return response.end(architectureFixture({lang:url.searchParams.get('lang')||'en',reportAccess:url.searchParams.get('access')||'core'}));}
 const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)){response.writeHead(403);return response.end();}
 fs.readFile(file,(error,content)=>{response.statusCode=error?404:200;response.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');response.end(error?'':content);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true});const base='http://127.0.0.1:'+server.address().port;
 try{for(const access of ['member','moderator','core'])for(const lang of ['tr','en']){
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.goto(base+'/?access='+access+'&lang='+lang);await page.locator('#app-loader').waitFor({state:'detached'});
  await page.locator('.dock-btn[data-target="tab-reports"]').click();
  const department=page.locator('[data-report-department="Array"]');await department.click();
  await page.locator('#reports-content[aria-busy="false"]').waitFor();assert.equal(await department.getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#report-nav-Array button').count(),5);assert.equal(await page.locator('iframe').count(),0);
  if(access==='core')assert.equal(await page.locator('[data-report-department]').count(),10);else assert.equal(await page.locator('[data-report-department]').count(),1);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#report-nav-Array')).opacity==='1');
  const bounds=await page.evaluate(()=>{
    const toggle=document.querySelector('[data-report-department="Array"]');
    const list=document.querySelector('#report-nav-Array');
    const child=list.querySelector('button');
    const host=document.querySelector('#nav-sub-reports .sidebar-submenu-inner');
    return {toggle:toggle.getBoundingClientRect().toJSON(),child:child.getBoundingClientRect().toJSON(),host:host.getBoundingClientRect().toJSON(),padding:parseFloat(getComputedStyle(host).paddingRight),transition:getComputedStyle(list).transitionProperty};
  });
  assert(Math.abs(bounds.toggle.right-(bounds.host.right-bounds.padding))<1);
  assert(Math.abs(bounds.child.right-bounds.toggle.right)<1);
  assert(bounds.child.left>bounds.toggle.left,'keep the indented guide line');
  assert(bounds.transition.includes('grid-template-rows'));
  await department.click();assert.equal(await department.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#report-nav-Array').evaluate(el=>el.inert),true);
  await page.waitForFunction(()=>document.querySelector('#report-nav-Array').getBoundingClientRect().height<1);
  await department.click();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#report-nav-Array')).opacity==='1');
  const field=page.locator('#reports-week');assert.equal(await field.isEnabled(),true);await field.fill('2026-11-02');await field.dispatchEvent('change');
  await page.locator('[data-nav-action="Array:weekly"]').click();await page.locator('.report-stats').waitFor();
  const nextLang=lang==='en'?'tr':'en';
  await page.locator('#lang-toggle-btn').click();
  await page.locator(`[data-language="${nextLang}"]`).click();
  const weeklyLabel=nextLang==='en'?'Weekly report':'Haftalık rapor';
  await page.waitForFunction(label=>document.querySelector('.topbar-page-title').textContent===label,weeklyLabel);
  assert.equal(await page.locator('[data-nav-action="Array:weekly"]').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('#reports-week').inputValue(),'2026-11-02');
  assert.equal(await department.getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#reports-new-task').isVisible(),access!=='member');
  if(access!=='member'){await page.locator('#reports-new-task').click();await page.locator('.report-editor [name="title"]').fill('Browser task');await page.locator('.report-editor [name="project"]').fill('Console');await page.locator('.report-editor [type="submit"]').click();await page.locator('.vx-modal').waitFor({state:'detached'});}
  await page.reload();await page.locator('#app-loader').waitFor({state:'detached'});
  await page.locator('#reports-content[aria-busy="false"]').waitFor({timeout:10000});
  assert.equal(await page.locator('[data-nav-action="Array:weekly"]').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('.report-stats').count(),1);
  assert.deepEqual(errors,[]);await page.close();console.log('Reports browser:',access,lang);
 }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
