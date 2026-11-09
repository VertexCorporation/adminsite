'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('certificate recipient picker filters cached rows immediately while preserving debounced server search',()=>{
 const source=fs.readFileSync('js/modules/contributors/surfaces.js','utf8');
 const block=source.slice(source.indexOf("function openCertificateSelector("));
 assert(/const visible\s*=\s*normalized\s*\?\s*people\.filter\s*\(\s*/.test(block));
 assert(/list\.innerHTML\s*=\s*visible\s*\.map\s*\(\s*/.test(block));
 const input=block.slice(block.indexOf('search.oninput ='),block.indexOf('search.focus()'));
 assert(input.indexOf('render();')>=0);
 assert(input.indexOf('render();')<input.indexOf('debounce = setTimeout('));
 assert(/loadPage\s*\(\s*true\s*\)\s*/.test(input));
});

test('recipient picker uses existing application data until fresh paginated results arrive',()=>{
 const source=fs.readFileSync('js/modules/contributors/surfaces.js','utf8');
 const picker=source.slice(source.indexOf('function openCertificateSelector('));
 assert.match(picker,/people\s*=\s*Array\.isArray\s*\(\s*contributorsStore\.value\s*\)\s*/);
 assert.match(picker,/if\s*\(\s*reset\s*\)\s*\s*\{\s*cursor\s*=\s*null\s*;\s*scroll\s*=\s*0\s*;\s*\s*\}\s*/);
 assert.match(picker,/people\s*=\s*reset\s*\?\s*\s*data\.contributors\s*\|\|\s*\[\]/);
 assert.match(picker,/render\s*\(\s*\s*\)\s*\s*;\s*void loadPage\s*\(\s*true\s*\)\s*/);
});
