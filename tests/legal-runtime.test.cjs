'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./helpers/module-harness.cjs');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,0));
const published={title:'Current legal text',html:'<h1>Current legal text</h1><p>Published clauses.</p>',version:0};
function fixture(level="write"){
 let reset,access=true,state={id:'vertex-terms--tr',product:'vertex',locale:'tr',kind:'terms',revision:0,version:0,title:published.title,published:{...published},draft:null,sources:[{repository:'vertexite',path:'tr/hizmet-sartlari.html',url:'https://vertexishere.com/tr/hizmet-sartlari'}]};
 const calls=[];
 const h=harness(fs.readFileSync('partials/panels/legal.html','utf8'),{
  'js/modules/roles.js':{getEffectivePanelLevel:()=>level},
  'js/core/firebase.js':{consolePeopleCall:async(name,data)=>{
   calls.push({name,data});assert.equal(name,'manageLegalDocuments');
   if(data.action==='list')return {data:{schemaVersion:1,documents:[state]}};
   if(data.action==='get')return {data:structuredClone(state)};
   if(data.action==='history')return {data:{versions:[],baseline:{version:0,note:'baseline'},nextCursor:null}};
   if(data.expectedRevision!==state.revision)throw Object.assign(new Error('conflict'),{code:'functions/aborted'});
   state.revision++;
   if(data.action==='save'){state.draft={title:data.title,html:data.html};state.hasDraft=true;}
   if(data.action==='publish'){state.published=state.draft;state.draft=null;state.hasDraft=false;state.version++;}
   return {data:{revision:state.revision,version:state.version}};
  }},
  'js/core/session.js':{captureSession:()=>({uid:'core'}),sessionIsCurrent:()=>access,canReadArea:()=>access,onSessionReset:cb=>{reset=cb;}},
  'js/utils/ui.js':{__:k=>k,onLangChange:()=>{},userErrorMessage:e=>e.message},
  'js/ui/surfaces.js':{confirmDialog:async()=>true},
 });
 return {...h,calls,reset:()=>{access=false;reset();},state:()=>state};
}
test('legal workspace loads lazily, saves drafts, requires save before publication, previews published text and clears session data',async()=>{
 const h=fixture();try{
  const mod=await h.load('js/modules/legal.js');mod.initLegalModule();assert.equal(h.calls.length,0);
  h.document.dispatchEvent(new h.window.CustomEvent('vertex:workspace',{detail:{keys:['legal.documents']}}));await tick();
  h.document.querySelector('#legal-list button').click();await tick();await tick();
  const get=id=>h.document.getElementById('legal-'+id);
  assert.equal(get('detail').hidden,false);assert.equal(get('publish').disabled,true);
  assert.equal(get('sources').querySelector('a').hostname,'vertexishere.com');
  get('html').value='<h1>Draft change</h1>';get('html').dispatchEvent(new h.window.Event('input'));
  get('save').click();await tick();await tick();assert.equal(h.state().draft.html,'<h1>Draft change</h1>');assert.equal(h.state().published.html,published.html);
  get('preview-published').click();assert.match(get('preview').srcdoc,/Published clauses/);assert.equal(get('preview').getAttribute('sandbox'),'');
  get('note').value='Reviewed';get('publish').click();await tick();await tick();assert.equal(h.state().version,1);
  assert.equal(h.state().draft,null);assert.equal(h.calls.filter(c=>c.data.action==='publish').length,1);
  h.reset();assert.equal(get('html').value,'');assert.equal(get('detail').hidden,true);assert.equal(get('list').children.length,0);assert.equal(get('preview').hasAttribute('srcdoc'),false);
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

test('read-only legal access keeps document navigation and previews available while blocking mutations',async()=>{
 const h=fixture('read');try{
  const mod=await h.load('js/modules/legal.js');mod.initLegalModule();
  h.document.dispatchEvent(new h.window.CustomEvent('vertex:workspace',{detail:{keys:['legal.documents']}}));await tick();
  h.document.querySelector('#legal-list button').click();await tick();await tick();
  for(const name of ['title','html','note','save','publish'])assert.equal(h.document.getElementById('legal-'+name).disabled,true,name);
  assert.equal(h.document.querySelector('#legal-list button').disabled,false);
  assert.equal(h.document.getElementById('legal-preview-published').disabled,false);
  assert.equal(h.document.querySelector('#legal-history button').disabled,true);
  h.document.getElementById('legal-save').dispatchEvent(new h.window.Event('click'));await tick();
  assert(!h.calls.some(c=>['save','publish','restore'].includes(c.data.action)));
 }finally{h.close();}
});
