'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const {readConsoleSource}=require('./helpers/console-source.cjs');
const {sourceFiles}=require('../scripts/source-files.cjs');
test('home is the initial active route and runtime build includes its modules and assets',()=>{
 const dom=new JSDOM(readConsoleSource('index.html'));assert.equal(dom.window.document.querySelector('.tab-panel.active').id,'tab-home');assert.equal(dom.window.document.querySelector('.dock-btn.active').dataset.target,'tab-home');for(const name of ['js/modules/home.js','css/home.css'])assert(sourceFiles(process.cwd()).includes(name));dom.window.close();
});
test('home brand assets contain inert SVG artwork',()=>{for(const name of ['firebase','google-drive','zapier','cal']){const svg=fs.readFileSync('assets/technology/'+name+'.svg','utf8');const dom=new JSDOM(svg,{contentType:'image/svg+xml'});assert.equal(dom.window.document.documentElement.tagName,'svg');assert.equal(dom.window.document.querySelectorAll('script,foreignObject,[onload]').length,0);dom.window.close();}});
