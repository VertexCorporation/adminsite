'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('certificate recipient picker filters cached rows immediately while preserving debounced server search',()=>{
 const source=fs.readFileSync('js/modules/contributors.js','utf8');
 const block=source.slice(source.indexOf("function openCertificateSelector("));
 assert(block.includes("const visible=normalized?people.filter("));
 assert(block.includes("list.innerHTML=visible.map("));
 const input=block.slice(block.indexOf('search.oninput='),block.indexOf('search.focus()'));
 assert(input.indexOf('render();')>=0);
 assert(input.indexOf('render();')<input.indexOf('debounce=setTimeout('));
 assert(input.includes('loadPage(true)'));
});
