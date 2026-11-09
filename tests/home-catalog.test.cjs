'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {harness}=require('./helpers/module-harness.cjs');
const html=fs.readFileSync('partials/panels/home.html','utf8');
function homeHarness(){return harness(html,{'js/modules/roles.js':{getEffectivePanelLevel:()=> 'none',isPanelAdmin:()=>false}});}
test('home renders all sixteen technology assets and four products in TR and EN',async()=>{
 const h=homeHarness();try{const home=await h.load('js/modules/home.js'),lang=await h.load('js/lang.js');home.initHomeModule();for(const locale of ['tr','en']){lang.setLang(locale);home.updateHome({displayName:'Mustafa'},false,['Array']);assert.equal(h.document.querySelectorAll('.home-tech-card').length,16);assert.equal(h.document.querySelectorAll('.home-product-card').length,4);for(const name of ['Cortex','Ally','Mergen','Fulcrum'])assert(h.document.getElementById('home-root').textContent.includes(name));for(const img of h.document.querySelectorAll('.home-tech-card img')){const src=img.getAttribute('src');if(!src.startsWith('http'))assert(fs.existsSync(src));}assert(h.document.querySelector('.home-title').textContent.includes('Mustafa'));assert(!h.document.getElementById('home-root').textContent.includes('Unavailable'));}}finally{h.close();}
});
test('department guidance follows assigned departments and logout clears private identity',async()=>{
 const h=homeHarness();try{const home=await h.load('js/modules/home.js');home.initHomeModule();home.updateHome({displayName:'Private Name'},false,['Array']);const text=h.document.getElementById('home-root').textContent;assert(text.includes('Array'));assert(!text.includes('Senatus'));home.updateHome(null,false,[]);assert(!h.document.getElementById('home-root').textContent.includes('Private Name'));}finally{h.close();}
});
