'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/core/workspace-features.js','utf8').replace('export function','function');
const context={};vm.runInNewContext(source+'\nglobalThis.create=createFeatureRegistry;',context);
test('concurrent routes share import/binding and unrelated features stay unloaded',async()=>{
 let imports=0,bindings=0,other=0,release;
 const wait=new Promise(resolve=>release=resolve);
 const registry=context.create([{id:'models',scopes:['models.'],load:async()=>{imports++;await wait;return {init(){bindings++;},read:()=>42};},init:'init'},
  {id:'legal',scopes:['legal.documents'],load:async()=>{other++;return {init(){}};},init:'init'}]);
 assert.equal(registry.ready(['models.library']),false);
 const first=registry.ensure(['models.library']),second=registry.ensure(['models.manage']);release();await Promise.all([first,second]);
 assert.equal(imports,1);assert.equal(bindings,1);assert.equal(other,0);
 assert.equal(registry.ready(['models.library','models.manage']),true);
 assert.equal((await registry.get('models')).read(),42);assert.equal(bindings,1);
});
test('a failed import can retry without reinitializing successfully loaded siblings',async()=>{
 let tries=0,bindings=0,stable=0;
 const registry=context.create([{id:'retry',scopes:['users.'],load:async()=>{if(++tries===1)throw Error('temporary');return {init(){bindings++;}};},init:'init'},
  {id:'stable',scopes:['users.'],load:async()=>({init(){stable++;}}),init:'init'}]);
 await assert.rejects(registry.ensure(['users.directory']),/temporary/);
 await registry.ensure(['users.directory']);assert.equal(tries,2);assert.equal(bindings,1);assert.equal(stable,1);
});
