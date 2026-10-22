const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixture=`<!doctype html><html><head><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/ui/layout.css"></head><body>
<div id="surface" style="width:300px;min-height:180px;margin:40px;border:1px solid;padding:20px"><div id="rows">Original data</div><input id="input" aria-label="Search"><div id="scroll" style="height:40px;overflow:auto"><div style="height:180px">Scroll content</div></div></div>
<script type="module">
import {registerListRefresh} from '/js/ui/listRefresh.js';import {crossfade} from '/js/ui/transition.js';
window.requests=0;window.paints=0;window.errors=0;window.fail=false;
window.host=document.querySelector('#surface');
registerListRefresh(host,async()=>{requests++;await new Promise(r=>setTimeout(r,180));if(fail){errors++;return;}crossfade(host,()=>{host.querySelector('#rows').textContent='Updated '+requests;});});
host.addEventListener('vertex:list-painted',()=>paints++);window.ready=true;
</script></body></html>`;
const server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(fixture);}const f=path.join(root,req.url);if(!f.startsWith(root+path.sep)){res.statusCode=403;return res.end();}fs.readFile(f,(e,b)=>{res.statusCode=e?404:200;res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':'text/css');res.end(e?'':b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}:{} )});try{
 const page=await browser.newPage({viewport:{width:390,height:820},hasTouch:true});const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready);
 const gesture=async(dx,dy,target='#rows',end=true)=>page.evaluate(({dx,dy,target,end})=>{const el=document.querySelector(target),point=(x,y)=>new Touch({identifier:1,target:el,clientX:x,clientY:y});el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[point(80,100)]}));el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[point(80+dx,100+dy)]}));if(end)el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]}));},{dx,dy,target,end});
 await gesture(0,48,'#rows',false);assert.equal(await page.locator('#surface').evaluate(el=>el.style.getPropertyValue('--pull-progress')),'0.5');assert.equal(await page.locator('#surface').evaluate(el=>getComputedStyle(el,'::before').animationName),'none');await page.evaluate(()=>host.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[]})));assert.equal(await page.evaluate(()=>requests),0);
 await gesture(100,12);await gesture(0,120,'#input');assert.equal(await page.evaluate(()=>requests),0);
 await page.locator('#scroll').evaluate(el=>{el.scrollTop=30;});await gesture(0,120,'#scroll');assert.equal(await page.evaluate(()=>requests),0);
 await gesture(0,110);assert.equal(await page.evaluate(()=>requests),1);assert.equal(await page.locator('#rows').textContent(),'Original data');assert.equal(await page.locator('#surface').getAttribute('aria-busy'),'true');await gesture(0,130);assert.equal(await page.evaluate(()=>requests),1);
 await page.waitForFunction(()=>!host.hasAttribute('aria-busy'));assert.equal(await page.locator('#rows').textContent(),'Updated 1');assert.equal(await page.evaluate(()=>paints),1);assert.equal(await page.locator('#surface .ui-crossfade-ghost').count(),0);
 await page.locator('#surface').focus();await page.keyboard.press('Alt+r');await page.waitForFunction(()=>requests===2&&!host.hasAttribute('aria-busy'));assert.equal(await page.evaluate(()=>paints),2);
 await page.evaluate(()=>{fail=true;});await page.keyboard.press('Alt+r');await page.waitForFunction(()=>errors===1&&!host.hasAttribute('aria-busy'));assert.equal(await page.locator('#rows').textContent(),'Updated 2');
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{fail=false;});await page.keyboard.press('Alt+r');assert.equal(await page.locator('#surface').evaluate(el=>getComputedStyle(el,'::before').animationName),'none');await page.waitForFunction(()=>requests===4&&!host.hasAttribute('aria-busy'));assert.deepEqual(exceptions,[]);
 console.log('PASS pull threshold, fill progress, horizontal/input/scroll exclusions, coalescing, stale data, one fade, keyboard, error recovery and reduced motion');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
