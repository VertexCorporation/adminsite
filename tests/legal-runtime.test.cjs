'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/module-harness.cjs');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,0));
const published={title:'Current legal text',html:'<h1>Current legal text</h1><p>Published clauses.</p>',version:0};
function fixture(level='write',options={}){
 let reset,access=true,lang='tr',languageChange;
 const states=new Map(['tr','en'].map(locale=>['vertex-terms--'+locale,{id:'vertex-terms--'+locale,groupId:'vertex-terms',product:'vertex',locale,kind:'terms',revision:0,version:0,published:{...published,markdown:'# Current legal text\n\nPublished clauses.'},draft:null,sources:[]}]));
 if(options.multiple)states.set('cortex-privacy--tr',{...structuredClone(states.get('vertex-terms--tr')),id:'cortex-privacy--tr',groupId:'cortex-privacy',product:'cortex',kind:'privacy',published:{...published,title:'Cortex policy',markdown:'# Cortex policy'}});
 const calls=[],getState=id=>states.get(id)||{id,groupId:'vertex-terms',product:'vertex',kind:'terms',locale:id.split('--')[1],revision:0,version:0,published:null,draft:null,missing:true,sources:[]};
 const h=harness(fs.readFileSync('partials/panels/legal.html','utf8'),{
  'js/modules/roles.js':{getEffectivePanelLevel:()=>level},
  'js/core/firebase.js':{consolePeopleCall:async(name,data)=>{
   calls.push({name,data});if(options.defer)await options.defer(name,data);
   if(name==='translateLegalDocument')return {data:{translations:Object.fromEntries(data.targetLangs.map(locale=>[locale,{title:'Translated '+locale,markdown:'# Translation '+locale+'\n\nTranslated clauses.',html:'<h1>Translation '+locale+'</h1>',origin:'machine',translation:{sourceId:data.id}}])),failed:{},skipped:{}}};
   assert.equal(name,'manageLegalDocuments');
   if(data.action==='catalog')return {data:{schemaVersion:2,documents:[{id:'vertex-terms',product:'vertex',kind:'terms',languages:['tr','en','de'].map(locale=>({id:'vertex-terms--'+locale,locale,available:locale!=='de',title:published.title}))},...(options.multiple?[{id:'cortex-privacy',product:'cortex',kind:'privacy',languages:[{id:'cortex-privacy--tr',locale:'tr',available:true}]}]:[])]}};
   const state=getState(data.id);
   if(data.action==='get')return {data:structuredClone(state)};
   if(data.action==='history')return {data:{versions:[],baseline:{version:0,note:'baseline'},nextCursor:null}};
   if(data.expectedRevision!==state.revision)throw Object.assign(new Error('conflict'),{code:'functions/aborted'});
   state.revision++;
   if(data.action==='save'){state.draft={title:data.title,markdown:data.markdown,html:'<h1>Draft change</h1>'};state.hasDraft=true;state.missing=false;states.set(data.id,state);}
   if(data.action==='publish'){state.published=state.draft;state.draft=null;state.hasDraft=false;state.version++;}
   return {data:{revision:state.revision,version:state.version}};
  }},
  'js/core/session.js':{captureSession:()=>({uid:'core'}),sessionIsCurrent:()=>access,canReadArea:()=>access,onSessionReset:cb=>{reset=cb;}},
  'js/utils/ui.js':{__:k=>k,getLang:()=>lang,onLangChange:cb=>{languageChange=cb;},userErrorMessage:e=>e.message},
  'js/ui/surfaces.js':{confirmDialog:async()=>true},
 });
 return {...h,calls,reset:()=>{access=false;reset();},state:()=>states.get('vertex-terms--tr'),language:value=>{lang=value;languageChange();}};
}
async function open(h){const mod=await h.load('js/modules/legal.js');mod.initLegalModule();h.document.dispatchEvent(new h.window.CustomEvent('vertex:workspace',{detail:{keys:['legal.documents']}}));for(let i=0;i<6;i++)await tick();}
test('selection highlights immediately during loading and a slower previous request cannot replace the chosen document',async()=>{
 let release;const gate=new Promise(r=>release=r);
 const h=fixture('write',{multiple:true,defer:async(_name,data)=>{if(data.action==='get'&&data.id==='cortex-privacy--tr')await gate;}});
 try{
  await open(h);const buttons=h.document.querySelectorAll('#legal-list > button');assert.equal(buttons.length,2);
  buttons[1].click();await tick();assert.equal(buttons[1].getAttribute('aria-pressed'),'true');assert.equal(buttons[0].getAttribute('aria-pressed'),'false');assert.equal(h.document.getElementById('legal-detail-skeleton').hidden,false);
  buttons[0].click();await tick();await tick();release();await tick();await tick();
  assert.equal(h.document.getElementById('legal-title').value,published.title);assert.equal(buttons[0].getAttribute('aria-pressed'),'true');
  assert.equal(h.calls.filter(c=>c.data.action==='get'&&c.data.id==='vertex-terms--tr').length,1);
 }finally{release();h.close();}
});
test('published history restores the selected language version through a confirmed draft operation',async()=>{
 const h=fixture();try{await open(h);h.document.querySelector('#legal-history-section summary').click();await tick();await tick();const button=h.document.querySelector('#legal-history button');assert(button);button.click();for(let i=0;i<5;i++)await tick();const restore=h.calls.find(c=>c.data.action==='restore');assert.equal(restore.data.id,'vertex-terms--tr');assert.equal(restore.data.version,0);assert(!h.calls.some(c=>c.data.action==='publish'));}finally{h.close();}
});
test('grouped Markdown editor defaults to console language, saves then translates private drafts, lazy-loads history and clears session',async()=>{
 const h=fixture();try{
  await open(h);const get=id=>h.document.getElementById('legal-'+id);
  assert.equal(get('list').querySelectorAll('button').length,1);assert.equal(get('locale').value,'tr');assert(!h.calls.some(c=>c.data.action==='history'));
  assert.equal(get('detail').hidden,false);assert.equal(get('publish').disabled,true);assert.doesNotMatch(get('html').value,/<h1>/);
  get('html').value='# Draft change\n\n**Bold legal clause**';get('html').dispatchEvent(new h.window.Event('input'));
  get('preview-draft').click();assert.match(get('preview').srcdoc,/<strong>Bold legal clause<\/strong>/);
  get('save').click();for(let i=0;i<6;i++)await tick();
  const saved=h.calls.find(c=>c.data.action==='save');assert.equal(saved.data.markdown,'# Draft change\n\n**Bold legal clause**');assert.equal(saved.data.html,undefined);
  assert(h.calls.some(c=>c.name==='translateLegalDocument'&&c.data.persist===true));assert.equal(h.state().published.html,published.html);
  get('preview-published').click();assert.match(get('preview').srcdoc,/Published clauses/);assert.equal(get('preview').getAttribute('sandbox'),'');
  get('history-section').open=true;await tick();await tick();assert(h.calls.some(c=>c.data.action==='history'));
  get('note').value='Reviewed';get('publish').click();for(let i=0;i<4;i++)await tick();assert.equal(h.state().version,1);
  h.reset();assert.equal(get('html').value,'');assert.equal(get('detail').hidden,true);assert.equal(get('list').children.length,0);assert.equal(get('preview').hasAttribute('srcdoc'),false);
 }finally{h.close();}
});
test('language picker stays inside one document, follows console language and automatically previews a missing translation',async()=>{
 const h=fixture();try{await open(h);const select=h.document.getElementById('legal-locale');select.value='en';select.dispatchEvent(new h.window.Event('change'));for(let i=0;i<4;i++)await tick();assert.equal(select.value,'en');assert.equal(h.document.querySelectorAll('#legal-list button').length,1);
 h.language('tr');for(let i=0;i<4;i++)await tick();assert.equal(select.value,'tr');
 select.value='de';select.dispatchEvent(new h.window.Event('change'));for(let i=0;i<6;i++)await tick();assert.equal(select.value,'de');assert.match(h.document.getElementById('legal-html').value,/Translation de/);assert.equal(h.document.getElementById('legal-publish').disabled,true);assert(h.calls.some(c=>c.name==='translateLegalDocument'&&c.data.persist===false));
 }finally{h.close();}
});
test('shimmer replaces loading copy and late results cannot repopulate a logged-out session',async()=>{
 let release;const gate=new Promise(r=>release=r);const h=fixture('write',{defer:async(_name,data)=>{if(data.action==='catalog')await gate;}});try{
 const mod=await h.load('js/modules/legal.js');mod.initLegalModule();h.document.dispatchEvent(new h.window.CustomEvent('vertex:workspace',{detail:{keys:['legal.documents']}}));await tick();assert(h.document.querySelector('#legal-list .skeleton'));assert.equal(h.document.getElementById('legal-detail-skeleton').hidden,false);assert.equal(h.document.getElementById('legal-status').textContent,'');h.reset();release();await tick();await tick();assert.equal(h.document.getElementById('legal-list').children.length,0);assert.equal(h.document.getElementById('legal-detail').hidden,true);
 }finally{release();h.close();}
});
test('READ retains navigation/preview and blocks saving, publishing and persistent translation',async()=>{
 const h=fixture('read');try{await open(h);for(const name of ['title','html','note','save','publish','translate'])assert.equal(h.document.getElementById('legal-'+name).disabled,true,name);
 assert.equal(h.document.getElementById('legal-locale').disabled,false);assert.equal(h.document.getElementById('legal-preview-draft').disabled,false);
 h.document.getElementById('legal-save').dispatchEvent(new h.window.Event('click'));h.document.getElementById('legal-translate').dispatchEvent(new h.window.Event('click'));await tick();assert(!h.calls.some(c=>['save','publish','restore'].includes(c.data.action)||c.data.persist));
 }finally{h.close();}
});
test('public reader sanitizes remote content and exposes publication version without executing active content',async()=>{
 const dom=new JSDOM('<html lang="tr"><body><div data-legal-document="vertex-terms--tr"><p>Original</p></div></body></html>',{url:'https://vertexishere.com/tr/hizmet-sartlari',runScripts:'outside-only'});
 const w=dom.window;w.fetch=async()=>({ok:true,json:async()=>({schemaVersion:1,id:'vertex-terms--tr',html:'<h1>Remote</h1><img src=x onerror="x()"><a href="javascript:x()" onclick="x()">link</a><script>x()</script>',version:2,hash:'a'.repeat(64)})});
 try{w.eval(fs.readFileSync('scripts/legal/public-reader.js','utf8'));await tick();const target=w.document.querySelector('[data-legal-document]');assert.equal(target.dataset.legalVersion,'2');assert.equal(target.dataset.legalHash,'a'.repeat(64));assert.equal(target.querySelector('script,img'),null);assert.equal(target.querySelector('a').getAttribute('href'),null);assert.equal(target.querySelector('a').hasAttribute('onclick'),false);assert.equal(target.hasAttribute('aria-busy'),false);}finally{w.close();}
});
test('public reader keeps the exact source text and shows fallback notice on network or mismatched-document failure',async()=>{
 for(const fail of [true,false]){
 const dom=new JSDOM('<html lang="tr"><body><div data-legal-document="vertex-terms--tr"><p>Original clauses</p></div></body></html>',{url:'https://vertexishere.com',runScripts:'outside-only'});const w=dom.window;
 w.fetch=async()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>({schemaVersion:1,id:'another-id',html:'<h1>Wrong</h1>',version:1,hash:'a'.repeat(64)})};};
 try{w.eval(fs.readFileSync('scripts/legal/public-reader.js','utf8'));await tick();assert.equal(w.document.querySelector('[data-legal-document]').innerHTML,'<p>Original clauses</p>');assert.equal(w.document.querySelector('[data-legal-document]').dataset.legalFallback,'true');assert.match(w.document.querySelector('[role=status]').textContent,/ulaşılamadı/);}finally{w.close();}
 }
});

