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

test('recipient picker uses existing application data until fresh paginated results arrive',()=>{
 const source=fs.readFileSync('js/modules/contributors.js','utf8');
 const picker=source.slice(source.indexOf('function openCertificateSelector('));
 assert.match(picker,/people=Array\.isArray\(window\.loadedContributors\)/);
 assert.match(picker,/if\(reset\)\{cursor=null;scroll=0;\}/);
 assert.match(picker,/people=reset\?\(data\.contributors\|\|\[\]\)/);
 assert.match(picker,/render\(\);void loadPage\(true\)/);
});
