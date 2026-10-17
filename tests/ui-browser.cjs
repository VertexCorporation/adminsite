const {chromium} = require('playwright');
const {strict:assert} = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname,'..');
const fixture = [
 '<!doctype html><html lang="en"><head><meta charset="utf-8">',
 '<link rel="stylesheet" href="/css/tokens.css">',
 '<link rel="stylesheet" href="/css/base.css">',
 '<link rel="stylesheet" href="/css/ui/controls.css">',
 '<link rel="stylesheet" href="/css/ui/toast.css">',
 '<link rel="stylesheet" href="/css/ui/scroll.css">',
 '<link rel="stylesheet" href="/css/ui/layout.css">',
 '<style>#vertical{height:100px;width:220px;overflow:auto;border:1px solid}',
 '#horizontal{width:220px;overflow-x:auto;display:flex;gap:16px}',
 '#horizontal>span{flex:0 0 180px;padding:12px}',
 '#content{width:240px;min-height:70px;border:1px solid}</style></head><body>',
 '<div id="toast-container"></div>',
 '<button id="action" class="chrome-btn-outline">Save</button>',
 '<label><input id="choice" type="checkbox"> Selection</label>',
 '<div id="vertical" data-scroll-fog><div style="height:420px">Scrollable vertical content</div></div>',
 '<div id="horizontal" data-scroll-fog><span>First</span><span>Second</span><span>Third</span></div>',
 '<div id="content"><p>Outgoing content</p></div></body></html>'
].join('');
const server = http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
 if(!/^\/(css|js)\//.test(pathname)){res.writeHead(404);res.end();return;}
 const target=path.resolve(root,'.'+pathname);
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(target,(err,data)=>{
  if(err){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':'text/css');
  res.end(data);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:820}});
   const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.evaluate(async()=>{
    const [ui,transition,loading,scroll]=await Promise.all([
     import('/js/utils/ui.js'),import('/js/ui/transition.js'),
     import('/js/utils/loading.js'),import('/js/utils/scrollEdges.js')
    ]);
    window.uiTest={ui,transition,loading};
    scroll.initScrollEdges();
   });
   const count=width<721?2:3;
   for(const type of ['info','success','warning'].slice(0,count))
    await page.evaluate(type=>window.uiTest.ui.showToast('Fixture '+type,type),type);
   assert.equal(await page.locator('.toast-slot').count(),count);
   assert.equal(await page.locator('#toast-container').evaluate(el=>getComputedStyle(el).overflowY),'visible');
   await page.waitForTimeout(280);
   assert.equal(await page.locator('.toast.show').count(),count);
   await page.locator('.toast').first().click();
   await page.waitForTimeout(320);
   assert.equal(await page.locator('.toast-slot').count(),count-1);
   await page.evaluate(()=>{
    const el=document.getElementById('content');
    window.uiTest.transition.crossfade(el,()=>{el.innerHTML='<strong>Incoming content</strong>';});
   });
   assert.equal(await page.locator('.ui-crossfade-ghost').count(),1);
   await page.waitForTimeout(300);
   assert.equal(await page.locator('.ui-crossfade-ghost').count(),0);
   assert.equal(await page.locator('#content strong').innerText(),'Incoming content');
   await page.waitForFunction(()=>document.getElementById('vertical').dataset.fogBottom==='true');
   assert.equal(await page.locator('#horizontal').getAttribute('data-fog-right'),'true');
   await page.evaluate(()=>{
    const v=document.getElementById('vertical'),h=document.getElementById('horizontal');
    v.scrollTop=v.scrollHeight;h.scrollLeft=h.scrollWidth;
    v.dispatchEvent(new Event('scroll'));h.dispatchEvent(new Event('scroll'));
   });
   assert.equal(await page.locator('#vertical').getAttribute('data-fog-bottom'),'false');
   assert.equal(await page.locator('#horizontal').getAttribute('data-fog-right'),'false');
   const button=page.locator('#action');
   const startWidth=await button.evaluate(el=>el.getBoundingClientRect().width);
   await page.evaluate(()=>window.uiTest.loading.setButtonLoading(document.getElementById('action'),true));
   assert.equal(await button.isDisabled(),true);
   assert(await button.evaluate(el=>el.getBoundingClientRect().width)>=startWidth);
   await page.evaluate(()=>window.uiTest.loading.setButtonLoading(document.getElementById('action'),false));
   assert.equal(await button.isDisabled(),false);
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.locator('.toast').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   assert.deepEqual(exceptions,[]);
   await page.close();
  }
  console.log('PASS ui smoke: mobile/desktop toast, crossfade, scroll, buttons, reduced motion');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
