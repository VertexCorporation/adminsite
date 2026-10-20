const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('js/utils/workspace-loader.js','utf8').replace('export function','function');
const context={};vm.runInNewContext(code+'\nthis.create=createWorkspaceLoader;',context);
test('one loader shared by multiple panels runs once while pending and after success',async()=>{
 let count=0,finish;const load=()=>{count++;return new Promise(r=>finish=r);};
 const loader=context.create({tasks:[['a',load],['b',load]],canLoad:()=>true});
 const first=loader.load(['a','b']),second=loader.load(['a']);
 await Promise.resolve();assert.equal(count,1);finish();await Promise.all([first,second]);
 await loader.load(['b']);assert.equal(count,1);
});
test('a failed first visit retries when opened again and unauthorized panels never load',async()=>{
 let attempts=0;const errors=[];
 const loader=context.create({tasks:[['a',async()=>{if(++attempts===1)throw Error('offline');}]],
  canLoad:key=>key==='a',onError:key=>errors.push(key)});
 await loader.load(['private']);assert.equal(attempts,0);
 await loader.load(['a']);await loader.load(['a']);
 assert.equal(attempts,2);assert.deepEqual(errors,['a']);
});
test('an internally handled error can invalidate the workspace for its next visit',async()=>{
 let count=0,loader;
 loader=context.create({tasks:[['a',()=>{if(++count===1)loader.invalidate('a');}]],canLoad:()=>true});
 await loader.load(['a']);await loader.load(['a']);await loader.load(['a']);
 assert.equal(count,2);
});
test('logout cancels queued initialization and allows a fresh session to load',async()=>{
 let count=0;const loader=context.create({tasks:[['a',()=>count++]],canLoad:()=>true});
 const stale=loader.load(['a']);loader.clear();await stale;assert.equal(count,0);
 await loader.load(['a']);assert.equal(count,1);
});
