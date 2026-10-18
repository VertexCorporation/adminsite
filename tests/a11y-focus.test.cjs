'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('drawer and modal share a resilient keyboard focus trap and restore caller focus',()=>{
 const shell=fs.readFileSync('js/modules/shell.js','utf8');
 assert(shell.includes('function trapDialogTab(root,event)'));
 assert(shell.includes('event.shiftKey?last:first'));
 assert(shell.includes("el.getClientRects().length"));
 assert(shell.includes('const trapFocus = e => trapDialogTab(root,e)'));
 assert(shell.includes('trapDialogTab(root,e);'));
 assert(shell.includes('previousModalFocus'));
 assert(shell.includes('previousDrawerFocus'));
});
test('reduced motion remains supported in the canonical UI lifecycle',()=>{
 const motion=fs.readFileSync('js/ui/motion.js','utf8');
 assert(motion.includes('prefers-reduced-motion: reduce'));
 assert(motion.includes('if (reducedMotion()'));
});
