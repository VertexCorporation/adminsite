'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const files={
  '/js/utils/ui.js':`export const getLang=()=>window.lang||'tr';export const escapeHTML=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');export const showToast=(s,t)=>window.toasts.push([s(),t]);export const userErrorMessage=()=> 'Service unavailable';`,
  '/js/core/firebase.js':`export const translateTeamBiographyFn=async data=>{window.calls.push(data);return new Promise((resolve,reject)=>{window.finish=resolve;window.fail=reject;});};`,
  '/js/utils/loading.js':`export const setButtonLoading=(button,busy)=>{button.disabled=busy;};`
 };
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/css/base.css"><style>[hidden]{display:none!important}body{max-width:600px;margin:20px}textarea,select{width:100%;box-sizing:border-box}textarea{resize:vertical}</style><div id="editor"></div><script>window.toasts=[];window.calls=[];</script>');return;}
 res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'text/javascript');
 if(files[req.url]){res.end(files[req.url]);return;}
 const file=path.join(root,req.url.split('?')[0]);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;res.end();return;}
 res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(async()=>{const {mountBiographyEditor}=await import('/js/modules/teamBiographies.js');window.mount=card=>window.editor=mountBiographyEditor(document.querySelector('#editor'),card);window.mount({bio:'Legacy biography',bioSourceLang:'en',biographies:{tr:'Türkçe metin',fr:'Texte vérifié'}});});
 assert.equal(await page.locator('[data-bio-lang]').count(),16);
 assert.equal(await page.locator('[data-bio-lang=en]').inputValue(),'Legacy biography');
 await page.locator('#team-bio-translate').click();
 assert(await page.evaluate(()=>editor.busy));
 const request=await page.evaluate(()=>calls.at(-1));assert.equal(request.sourceLang,'en');assert.equal(request.targetLangs.length,13);assert(!request.targetLangs.includes('fr'));
 await page.locator('#team-bio-language').selectOption('de');await page.locator('[data-bio-lang=de]').fill('Manual edit during request');
 await page.evaluate(()=>finish({data:{translations:{de:'Replace me',ja:'日本語',ar:'العربية'}}}));
 await page.waitForFunction(()=>!editor.busy);
 assert.equal(await page.locator('[data-bio-lang=de]').inputValue(),'Manual edit during request');
 assert.equal(await page.locator('[data-bio-lang=ja]').inputValue(),'日本語');
 assert.equal(await page.locator('[data-bio-lang=fr]').inputValue(),'Texte vérifié');
 await page.locator('#team-bio-language').selectOption('ar');assert.equal(await page.locator('[data-bio-lang=ar]').getAttribute('dir'),'rtl');
 assert(await page.locator('[data-bio-lang=ar]').isVisible());assert(!(await page.locator('[data-bio-lang=en]').isVisible()));
 // A source edit invalidates every in-flight result.
 await page.locator('#team-bio-translate').click();await page.locator('#team-bio-language').selectOption('en');await page.locator('[data-bio-lang=en]').fill('Changed source');
 await page.evaluate(()=>finish({data:{translations:{es:'Old source translation'}}}));await page.waitForFunction(()=>!editor.busy);
 assert.equal(await page.locator('[data-bio-lang=es]').inputValue(),'');
 // Explicit overwrite includes existing translations, but a failed request preserves drafts.
 await page.locator('#team-bio-overwrite').check();await page.locator('#team-bio-translate').click();
 assert.equal(await page.evaluate(()=>calls.at(-1).targetLangs.length),15);
 await page.evaluate(()=>fail(new Error('Provider error')));await page.waitForFunction(()=>!editor.busy);
 const saved=await page.evaluate(()=>editor.read());assert.equal(saved.biographies.fr,'Texte vérifié');assert.equal(saved.bio,'Changed source');assert.equal(saved.bioSourceLang,'en');assert.equal(Object.keys(saved.biographies).length,16);
 assert.equal(await page.evaluate(()=>toasts.at(-1)[1]),'error');
 // Untagged legacy text must be assigned to a language before editing localized fields.
 await page.evaluate(()=>mount({bio:'Untagged legacy'}));
 assert.equal(await page.locator('#team-bio-source').inputValue(),'');
 assert(await page.locator('#team-bio-language').isDisabled());
 assert(!(await page.locator('[data-bio-lang=tr]').isVisible()));
 await page.locator('#team-bio-source').selectOption('en');
 assert.equal(await page.locator('[data-bio-lang=en]').inputValue(),'Untagged legacy');
 assert(await page.locator('#team-bio-language').isEnabled());
 // Untrusted biography text remains literal, including textarea close tags.
 await page.evaluate(()=>mount({bio:'</textarea><img src=x onerror=alert(1)>',bioSourceLang:'tr'}));assert.equal(await page.locator('#editor img').count(),0);
 await page.locator('[data-bio-lang=tr]').fill('');const callCount=await page.evaluate(()=>calls.length);await page.locator('#team-bio-translate').click();assert.equal(await page.evaluate(()=>calls.length),callCount);
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);console.log('PASS 16 fields, language selection, legacy preservation, partial results, manual edits, stale source, overwrite, failure, RTL and XSS');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
