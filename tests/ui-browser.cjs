const {chromium} = require('playwright');
const {strict:assert} = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname,'..');
const fixture = [
 '<!doctype html><html lang="en"><head><meta charset="utf-8">',
 '<link rel="stylesheet" href="/css/tokens.css">',
 '<link rel="stylesheet" href="/css/base.css">',
 '<link rel="stylesheet" href="/css/ui/controls.css">',
 '<link rel="stylesheet" href="/css/ui/overlay.css">',
 '<link rel="stylesheet" href="/css/loading.css">',
 '<link rel="stylesheet" href="/css/ui/toast.css">',
 '<link rel="stylesheet" href="/css/ui/scroll.css">',
 '<link rel="stylesheet" href="/css/ui/layout.css">',
 '<style>#vertical{height:100px;width:220px;overflow:auto;border:1px solid}',
 '#horizontal{width:220px;overflow-x:auto;display:flex;gap:16px}',
 '#horizontal>span{flex:0 0 180px;padding:12px}',
 '#content{width:240px;min-height:70px;border:1px solid}',
 '#both{width:220px;height:80px;overflow:auto}',
 '#dense .contributor-table-rows{max-height:180px;overflow-y:auto}',
 '#dense .contributor-row{height:36px}</style></head><body>',
 '<div id="toast-container"></div>',
 '<button id="action" class="chrome-btn-outline">Save</button>',
 '<label><input id="choice" type="checkbox"> Selection</label>',
 '<div id="vertical" data-scroll-fog><div style="height:420px">Scrollable vertical content</div></div>',
 '<div id="horizontal" data-scroll-fog><span>First</span><span>Second</span><span>Third</span></div>',
 '<div id="both" data-scroll-fog><div style="width:440px;height:250px">Both axes</div></div>',
 '<div id="auto-discovered" style="height:70px;width:160px;overflow:auto"><div style="height:230px">Dynamic scrollport</div></div>',
 '<div id="state-host"><p>Previous error content</p></div>',
 '<input id="required-field" required value="x">',
 '<section class="panel-card" id="focus-panel" tabindex="-1"><div class="form-group-field"><input id="focus-text" value="text"><textarea id="focus-area">text</textarea><select id="focus-select"><option>One</option></select><input id="focus-error" aria-invalid="true"></div></section>',
 '<div id="content"><p>Outgoing content</p></div>',
 '<div id="delay-host"></div>',
 '<div id="view-host"><section id="old-tab" class="active"><h2>Old page</h2><input id="retained-value" value="keep me"></section><section id="new-tab" style="display:none"><h2>New page</h2></section></div>',
 ' <div id="generic"><ul></ul></div>',
 ' <div id="workspace" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px"><article>Old card</article><article hidden>Hidden card</article></div>',
 ' <div id="dense"><div class="contributor-table-head">Applicant list</div><div class="contributor-table-rows"></div></div></body></html>'
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
  for(const width of [320,360,390,768,1024,1440,1920]){
   const page=await browser.newPage({viewport:{width,height:820}});
   const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.evaluate(async()=>{
    const [ui,transition,loading,scroll,feedback]=await Promise.all([
     import('/js/utils/ui.js'),import('/js/ui/transition.js'),
     import('/js/utils/loading.js'),import('/js/utils/scrollEdges.js'),import('/js/ui/feedback.js')
    ]);
    window.uiTest={ui,transition,loading};
    scroll.initScrollEdges();
    feedback.initUiFeedback();
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
   await page.evaluate(()=>{
     const host=document.getElementById('workspace');
     window.uiTest.transition.crossfade(host,()=>{
       host.innerHTML='<article>New workspace card</article>';
     });
   });
   assert.equal(await page.locator('#workspace > .ui-crossfade-ghost').count(),1);
   assert.equal(await page.locator('#workspace > .ui-crossfade-ghost > article').count(),1);
   assert.equal(await page.locator('#workspace > .ui-crossfade-ghost').evaluate(el=>getComputedStyle(el).display),'grid');
   await page.waitForTimeout(250);
   // A real exit+entry pair must overlap, remain inert, and never replace the
   // existing input (including across rapid navigation).
   await page.evaluate(()=>{
     const old=document.getElementById('old-tab'),next=document.getElementById('new-tab');
     window.uiTest.transition.animateViewSwitch(old,next,()=>{
       old.classList.remove('active');old.style.display='none';
       next.classList.add('active');next.style.display='block';
     });
   });
   assert.equal(await page.locator('#view-host > .ui-view-ghost').count(),0);
   assert.equal(await page.locator('#old-tab #retained-value').inputValue(),'keep me');
   assert.equal(await page.locator('#old-tab').isVisible(),false);
   assert.equal(await page.locator('#new-tab').isVisible(),true);
   assert(await page.locator('#new-tab').evaluate(el=>el.getAnimations().length>0));
   await page.evaluate(()=>{
     const old=document.getElementById('old-tab'),next=document.getElementById('new-tab');
     window.uiTest.transition.animateViewSwitch(next,old,()=>{
       next.classList.remove('active');next.style.display='none';
       old.classList.add('active');old.style.display='block';
     });
   });
   assert.equal(await page.locator('#view-host > .ui-view-ghost').count(),0);
   assert.equal(await page.locator('#new-tab').isVisible(),false);
   assert.equal(await page.locator('#old-tab').isVisible(),true);
   await page.waitForTimeout(270);
   assert.equal(await page.locator('#view-host > .ui-view-ghost').count(),0);
   assert.equal(await page.locator('#old-tab #retained-value').inputValue(),'keep me');
   // Generic result sets must also animate when their nested DOM gets large.
   await page.evaluate(()=>{
     const host=document.getElementById('generic');
     host.querySelector('ul').innerHTML=Array.from({length:70},(_,i)=>
       '<li><strong>Row '+i+'</strong><span><i>Detail</i></span></li>').join('');
     window.uiTest.transition.crossfade(host,()=>{
       host.querySelector('ul').innerHTML='<li><strong>Filtered</strong></li>';
     });
   });
   assert.equal(await page.locator('#generic > .ui-crossfade-ghost').count(),1);
   assert.equal(await page.locator('#generic > ul li').count(),1);
   assert(await page.locator('#generic > ul').evaluate(el=>el.getAnimations().length>0));
   await page.waitForTimeout(250);
   assert.equal(await page.locator('#generic > .ui-crossfade-ghost').count(),0);
   // 90 rows used to exceed the 140-descendant cutoff and silently skip fade.
   await page.evaluate(()=>{
     const host=document.getElementById('dense');
     const rows=host.querySelector('.contributor-table-rows');
     rows.innerHTML=Array.from({length:90},(_,i)=>
       '<div class="contributor-row" data-row="'+i+'"><button type="button"><span>Applicant '+i+'</span><i>✓</i></button><span><b>Active</b></span></div>').join('');
     rows.scrollTop=350;
     window.uiTest.transition.crossfade(host,()=>{
       rows.innerHTML=Array.from({length:38},(_,i)=>
         '<div class="contributor-row" data-row="'+i+'"><button type="button"><span>Filtered '+i+'</span><i>✓</i></button><span><b>Active</b></span></div>').join('');
     });
   });
   assert.equal(await page.locator('#dense > .ui-crossfade-ghost').count(),1);
   const dense=await page.evaluate(()=>{
     const host=document.getElementById('dense');
     return {
       outgoing:host.querySelector('.ui-crossfade-ghost .contributor-table-rows').children.length,
       incoming:host.querySelector(':scope > .contributor-table-rows').children.length,
       animating:host.querySelector(':scope > .contributor-table-rows').getAnimations().length > 0
     };
   });
   assert(dense.outgoing <= 29,JSON.stringify(dense));
   assert.equal(dense.incoming,38);
   assert.equal(dense.animating,true);
   await page.evaluate(()=>{
     const host=document.getElementById('dense');
     window.uiTest.transition.crossfade(host,()=>{
       host.querySelector(':scope > .contributor-table-rows').innerHTML=
         '<div class="contributor-row">Final result</div>';
     });
   });
   assert.equal(await page.locator('#dense > .ui-crossfade-ghost').count(),1);
   await page.waitForTimeout(300);
   assert.equal(await page.locator('#dense > .ui-crossfade-ghost').count(),0);
   assert.equal(await page.locator('#dense > .contributor-table-rows > .contributor-row').count(),1);
   await page.evaluate(()=>{
     const host=document.getElementById('dense');
     window.uiTest.transition.crossfade(host,()=>{
       host.querySelector(':scope > .contributor-table-rows').innerHTML=
         '<div class="contributor-row">Incoming applicant</div>';
     },{mode:'enter'});
   });
   assert.equal(await page.locator('#dense > .ui-crossfade-ghost').count(),0);
   assert.equal(await page.locator('#dense > .contributor-table-rows').innerText(),'Incoming applicant');
   await page.waitForFunction(()=>document.getElementById('auto-discovered').dataset.fogBottom==='true');
   await page.evaluate(()=>{
     const host=document.getElementById('auto-discovered');
     host.scrollTop=200;host.dispatchEvent(new Event('scroll'));
   });
   assert.equal(await page.locator('#auto-discovered').getAttribute('data-fog-top'),'true');
   await page.evaluate(async()=>{
     const {showLoadError,showEmptyState,showSuccessState}=await import('/js/ui/states.js');
     const host=document.getElementById('state-host');
     showLoadError(host,'Service unavailable',async()=>{});
     if(!host.querySelector('[role="alert"]'))throw Error('animated error surface missing');
     if(!host.querySelector('button'))throw Error('retry action missing');
     showEmptyState(host,'No records');
     if(!host.querySelector('[role="status"]'))throw Error('empty state missing');
     showSuccessState(host,'Completed');
     if(!host.textContent.includes('Completed'))throw Error('success state missing');
   });
   await page.waitForTimeout(230);
   assert.equal(await page.locator('#state-host .ui-crossfade-ghost').count(),0);
   await page.waitForFunction(()=>document.getElementById('vertical').dataset.fogBottom==='true');
   assert.equal(await page.locator('#horizontal').getAttribute('data-fog-right'),'true');
   await page.evaluate(()=>{
    const v=document.getElementById('vertical'),h=document.getElementById('horizontal');
    v.scrollTop=v.scrollHeight;h.scrollLeft=h.scrollWidth;
    v.dispatchEvent(new Event('scroll'));h.dispatchEvent(new Event('scroll'));
   });
   assert.equal(await page.locator('#vertical').getAttribute('data-fog-bottom'),'false');
   await page.waitForFunction(()=>document.getElementById('both').dataset.fogRight==='true'&&document.getElementById('both').dataset.fogBottom==='true');
   assert.equal(await page.locator('#horizontal').getAttribute('data-fog-right'),'false');
   const button=page.locator('#action');
   const startWidth=await button.evaluate(el=>el.getBoundingClientRect().width);
   await page.evaluate(()=>window.uiTest.loading.setButtonLoading(document.getElementById('action'),true));
   assert.equal(await button.isDisabled(),true);
   assert(await button.evaluate(el=>el.getBoundingClientRect().width)>=startWidth);
   await page.evaluate(()=>window.uiTest.loading.setButtonLoading(document.getElementById('action'),false));
   assert.equal(await button.isDisabled(),false);

   await page.evaluate(async()=>{
    const {lockScroll,unlockScroll}=await import('/js/ui/overlay.js');
    document.body.style.overflow='auto';
    lockScroll('drawer');lockScroll('modal');
    if(document.body.style.overflow!=='hidden')throw Error('scroll should be locked');
    unlockScroll('modal');
    if(document.body.style.overflow!=='hidden')throw Error('drawer lock lost');
    unlockScroll('drawer');
    if(document.body.style.overflow!=='auto')throw Error('scroll original state lost');
    document.body.style.overflow='';
    window.uiTest.loading.setButtonState(document.getElementById('action'),'success');
   });
   assert.equal(await button.getAttribute('data-state'),'success');
   await page.evaluate(()=>window.uiTest.loading.setButtonState(document.getElementById('action'),'error'));
   assert.equal(await button.getAttribute('data-state'),'error');
   await page.evaluate(()=>window.uiTest.loading.setButtonState(document.getElementById('action'),'idle'));
   assert.equal(await button.getAttribute('data-state'),null);
   // Validation messages and aria-invalid are owned by the shared form layer.
   await page.evaluate(()=>{
    const field=document.getElementById('required-field');
    field.value='';
    field.dispatchEvent(new Event('invalid',{bubbles:false}));
    if(field.getAttribute('aria-invalid')!=='true')throw Error('invalid state missing');
    field.value='valid';
    field.dispatchEvent(new Event('input',{bubbles:true}));
    if(field.hasAttribute('aria-invalid'))throw Error('invalid state was not cleared');
   });

   // The first load cannot flash skeleton for a response under 150ms,
   // but a genuine slow request must show its skeleton before crossfading.
   await page.evaluate(()=>{
     const host=document.getElementById('delay-host');
     window.uiTest.delayed=window.uiTest.loading.createLoadingController(host);
     window.uiTest.delayed.start();
   });
   assert.equal(await page.locator('#delay-host .skeleton').count(),0);
   await page.waitForTimeout(180);
   assert(await page.locator('#delay-host .skeleton').count()>0);
   await page.evaluate(()=>window.uiTest.delayed.success('<p>Loaded data</p>'));
   await page.waitForTimeout(240);
   assert.equal(await page.locator('#delay-host .skeleton').count(),0);
   assert.equal(await page.locator('#delay-host p').innerText(),'Loaded data');
   // Shared list loader cancels superseded requests; stale refresh never
   // destroys the existing nodes or reattaches them from serialized markup.
   await page.evaluate(()=>{
     const host=document.getElementById('content');
     host.innerHTML='<button id="old-live-button">Existing interactive record</button>';
     const original=host.firstElementChild;
     const stale=window.uiTest.loading.beginPanelLoading(host);
     if(!host.classList.contains('is-refreshing'))throw Error('stale refresh not visible');
     const next=window.uiTest.loading.beginPanelLoading(host);
     stale();
     if(host.firstElementChild!==original || host.getAttribute('aria-busy')!=='true')
        throw Error('old request disrupted the latest refresh');
     next();
     if(host.firstElementChild!==original || host.hasAttribute('aria-busy'))
        throw Error('live node was overwritten or busy state was left behind');
     host.innerHTML='<strong>Incoming content</strong>';
   });
   // Async content preserves stale data, and skeletons are not shown instantly.
   await page.evaluate(async()=>{
    const host=document.getElementById('content');
    const ctl=window.uiTest.loading.createLoadingController(host);
    ctl.start();
    if(!host.textContent.includes('Incoming content'))throw Error('stale content vanished');
    if(!host.classList.contains('is-refreshing'))throw Error('refresh state missing');
    ctl.error('Network unavailable',()=>{});
    if(!host.textContent.includes('Incoming content'))throw Error('stale error erased the data');
    ctl.start();
    ctl.success('<strong>Fresh content</strong>');
    if(!host.textContent.includes('Fresh content'))throw Error('fresh content not rendered');
    ctl.destroy();
   });
   await page.waitForTimeout(240);
   assert.equal(await page.locator('.ui-crossfade-ghost').count(),0);

   for(const theme of ['light','dark']){
    await page.evaluate(theme=>{
     if(theme==='light')document.documentElement.setAttribute('data-theme','light');
     else document.documentElement.removeAttribute('data-theme');
    },theme);
    const actual=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg-app').trim().toLowerCase());
    assert.equal(actual,theme==='light'?'#f8f9fa':'#0f0f10');
    await page.locator('#focus-panel').focus();
    assert.equal(await page.locator('#focus-panel').evaluate(el=>getComputedStyle(el).boxShadow),'none');
    for(const id of ['focus-text','focus-area','focus-select','focus-error']){
     const field=page.locator('#'+id),before=await field.boundingBox();
     await field.focus();
     await page.waitForTimeout(260);
     const style=await field.evaluate(el=>{const s=getComputedStyle(el);return {shadow:s.boxShadow,outline:s.outlineStyle,border:s.borderColor,duration:s.transitionDuration,error:getComputedStyle(document.documentElement).getPropertyValue('--status-error').trim()};});
     assert.equal(style.shadow,'none');assert.equal(style.outline,'none');
     assert.notEqual(style.duration,'0s');
     const after=await field.boundingBox();assert.equal(after.width,before.width);assert.equal(after.height,before.height);
     if(id==='focus-error')assert.equal(style.border,await field.evaluate(el=>{const color=document.createElement('span');color.style.color='var(--status-error)';el.parentElement.append(color);const value=getComputedStyle(color).color;color.remove();return value;}));
    }
   }

   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.locator('#focus-text').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   await page.evaluate(()=>window.uiTest.transition.crossfade(document.getElementById('dense'),()=>{document.querySelector('#dense > .contributor-table-rows').textContent='Reduced motion result';}));
   assert.equal(await page.locator('#dense > .ui-crossfade-ghost').count(),0);
   assert.equal(await page.locator('#dense > .contributor-table-rows').innerText(),'Reduced motion result');
   assert.equal(await page.locator('.toast').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
   assert.deepEqual(exceptions,[]);
   await page.close();
  }
  console.log('PASS ui smoke: 7 widths, light/dark, toast, crossfade, stale data, two-axis scroll, forms, actions, reduced motion');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
