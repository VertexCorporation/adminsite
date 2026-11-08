'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness}=require('./helpers/module-harness.cjs');
for(const type of ['Modal','Drawer'])test(type+' traps Tab and restores caller focus',async()=>{
 const h=harness('<button id="caller">Open</button>');
 try{const ui=await h.load('js/ui/surfaces.js'),caller=h.document.getElementById('caller');caller.focus();const body=ui['open'+type]({title:'Dialog'});body.innerHTML='<button id="first">First</button><button id="last">Last</button>';const first=body.closest('.vx-modal,.vx-drawer').querySelector('button'),last=h.document.getElementById('last');last.focus();last.dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(h.document.activeElement,first);first.dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true}));assert.equal(h.document.activeElement,last);ui['close'+type]();assert.equal(h.document.activeElement,caller);}finally{h.close();}
});
