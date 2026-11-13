'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const fixture = `
window.legalAnimations=[];const nativeAnimate=Element.prototype.animate;Element.prototype.animate=function(frames,options){window.legalAnimations.push({ghost:this.classList.contains('ui-crossfade-ghost'),frames});return nativeAnimate.call(this,frames,options);};
window.fixtureCalls=[];window.fixtureReady=false;window.releaseLegal=()=>window.fixtureReady=true;
window.fixtureGroups=['vertex-privacy','vertex-terms','cortex-privacy'].map(id=>({id,product:id.split('-')[0],kind:id.includes('privacy')?'privacy':'terms',languages:['tr','en','de','ar'].map(locale=>({id:id+'--'+locale,locale,available:true,title:locale==='tr'?'Hukuki belge':'Legal document'}))}));
window.fixtureGet=id=>({id,groupId:id.split('--')[0],locale:id.split('--')[1],product:id.split('-')[0],kind:id.includes('privacy')?'privacy':'terms',revision:0,version:0,published:{title:id.endsWith('--tr')?'Gizlilik politikası':'Privacy policy',markdown:'# Gizlilik politikası\\n\\nVertex hizmetlerini kullanırken verilerinizin nasıl işlendiğini açıklıyoruz.\\n\\n## Bilgilerin kullanımı\\n\\n**Hesap bilgileriniz** yalnızca hizmeti sunmak için kullanılır.\\n\\n- Hesabınızı güvenle yönetmek\\n- Yasal yükümlülükleri yerine getirmek\\n\\nİletişim: [Vertex](https://vertexishere.com)',html:'<h1>Gizlilik politikası</h1><p>Vertex hizmetlerini kullanırken verilerinizin nasıl işlendiğini açıklıyoruz.</p><h2>Bilgilerin kullanımı</h2><p><strong>Hesap bilgileriniz</strong> yalnızca hizmeti sunmak için kullanılır.</p>'},draft:null,sources:[]});
`;
const stubs={
 '/js/modules/roles.js':"export const getEffectivePanelLevel=()=> 'write';",
 '/js/core/session.js':"export const captureSession=()=>({uid:'fixture'});export const sessionIsCurrent=()=>true;export const onSessionReset=()=>{};",
 '/js/utils/ui.js':"import tr from '/l10n/tr/legal.js';export const __=key=>key==='common.refresh'?'Yenile':tr[key]||key;export const getLang=()=> 'tr';export const onLangChange=()=>{};export const userErrorMessage=e=>e.message;",
 '/js/ui/surfaces.js':"export const confirmDialog=async()=>true;",
 '/js/services/legalService.js':"let selected=null;export const peekLegalDocument=id=>selected?.id===id?selected:null;export const clearLegalCache=()=>{selected=null;};export const legalCall=async(action,data={})=>{window.fixtureCalls.push(action);if(action==='catalog'){while(!window.fixtureReady)await new Promise(r=>setTimeout(r,10));selected=window.fixtureGet('vertex-privacy--tr');return {schemaVersion:2,documents:window.fixtureGroups,selected};}if(action==='get')return window.fixtureGet(data.id);if(action==='history')return {versions:[],baseline:{version:0,note:'İlk sürüm'},nextCursor:null};throw Error(action);};",
};
const server=http.createServer((req,res)=>{
 const url=req.url.split('?')[0];
 if(url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="tr" data-theme="light"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><link rel="stylesheet" href="/css/loading.css"><link rel="stylesheet" href="/css/legal.css"><link rel="stylesheet" href="/css/ui/layout.css"><style>body{height:auto;padding:24px}.legal-panel{display:block!important;max-width:1500px;margin:auto}[hidden]{display:none!important}input,select,textarea{padding:10px;background:var(--bg-app);color:inherit;border:1px solid var(--border-color);border-radius:8px}</style>'+fs.readFileSync(path.join(root,'partials/panels/legal.html'),'utf8')+'<script>'+fixture+'</script><script type="module">import {initLegalModule} from "/js/modules/legal.js";import {__} from "/js/utils/ui.js";document.querySelectorAll("[data-i18n]").forEach(el=>el.textContent=__(el.dataset.i18n));initLegalModule();document.dispatchEvent(new CustomEvent("vertex:workspace",{detail:{keys:["legal.documents"]}}));</script>');return;}
 res.setHeader('Content-Type',url.endsWith('.css')?'text/css':'text/javascript');
 if(stubs[url])return res.end(stubs[url]);
 const file=path.join(root,url);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1460,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForSelector('#legal-list .skeleton');assert(await page.locator('#legal-detail-skeleton').isVisible());assert.equal(await page.locator('#legal-status').innerText(),'');
  await page.evaluate(()=>releaseLegal());await page.waitForSelector('#legal-detail:not([hidden])');
  assert.equal(await page.locator('#legal-list button').count(),3);assert.equal(await page.locator('#legal-list button strong').first().innerText(),'Gizlilik Politikası | Vertex');assert.equal(await page.locator('#legal-product option[value=cortex]').innerText(),'Cortex');assert((await page.evaluate(()=>legalAnimations.filter(a=>a.ghost).length))>=2);assert.equal(await page.locator('#legal-locale').inputValue(),'tr');assert(!await page.evaluate(()=>fixtureCalls.includes('history')));assert(!await page.evaluate(()=>fixtureCalls.includes('get')));
  assert(!/<h1>/.test(await page.locator('#legal-html').inputValue()));
  await page.locator('#legal-html').fill('## Başlık\n\n**Kalın metin**');await page.locator('#legal-preview-draft').click();await page.waitForFunction(()=>document.getElementById('legal-preview').srcdoc.includes('Kalın metin'));assert.equal(await page.frameLocator('#legal-preview').locator('strong').innerText(),'Kalın metin');
  await page.waitForFunction(()=>document.querySelectorAll('.legal-preview-stage iframe').length===1);
  await page.locator('#legal-history-section summary').click();await page.waitForFunction(()=>document.querySelector('#legal-history-section').classList.contains('is-expanded'));assert.equal(await page.locator('#legal-history-section summary').getAttribute('aria-expanded'),'true');await page.locator('#legal-history button').first().waitFor({state:'visible'});await page.locator('#legal-history-section summary').click();await page.waitForFunction(()=>!document.querySelector('#legal-history-section').open);
  await page.locator('#legal-locale').selectOption('en');await page.waitForFunction(()=>document.querySelector('#legal-title').value==='Privacy policy');
  for(const width of [390,768,1460])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:1000});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+theme);
   for(const selector of ['#legal-product','#legal-locale']){
    await page.locator(selector).focus();
    const style=await page.locator(selector).evaluate(el=>{const s=getComputedStyle(el);return {appearance:s.appearance,padding:parseFloat(s.paddingInlineEnd),image:s.backgroundImage,position:s.backgroundPosition};});
    assert.equal(style.appearance,'none');assert(style.padding>=44);assert.notEqual(style.image,'none');assert(style.position.includes('16px'));
   }
   await page.screenshot({path:'/tmp/legal-workspace-'+width+'-'+theme+'.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);console.log('PASS grouped navigation, console language, one-call opening, Markdown preview, lazy history and 6 responsive theme layouts');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
