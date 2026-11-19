'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/core/firebase.js','utf8');const context={};
vm.runInNewContext(source.slice(source.indexOf('export function createDeferredFirestore'),source.indexOf('let sendTargetedNotificationFn')).replace('export function','function')+'\nthis.create=createDeferredFirestore;',context);
test('deferred Firestore preserves query paths and awaits real reads',async()=>{
 let release;const calls=[];const target={collection(name){calls.push(['collection',name]);return this;},doc(id){calls.push(['doc',id]);return this;},get:async()=>({exists:true})};
 const db=context.create(()=>new Promise(resolve=>release=()=>resolve(target)));
 const read=db.collection('users').doc('current').get();assert.deepEqual(calls,[]);release();assert.equal((await read).exists,true);assert.deepEqual(calls,[['collection','users'],['doc','current']]);
});
test('cancellation before SDK arrival never attaches a stale private listener',async()=>{
 let release,attached=0;const target={collection(){return this;},doc(){return this;},onSnapshot(){attached++;return()=>{};}};
 const db=context.create(()=>new Promise(resolve=>release=()=>resolve(target)));
 const stop=db.collection('users').doc('old-user').onSnapshot(()=>{});stop();release();await new Promise(resolve=>setImmediate(resolve));assert.equal(attached,0);
});
test('live listeners unsubscribe and SDK failures reach the existing error handler',async()=>{
 let stopped=0,error;const db=context.create(async()=>({onSnapshot(){return()=>stopped++;}}));
 const stop=db.onSnapshot(()=>{});await new Promise(resolve=>setImmediate(resolve));stop();assert.equal(stopped,1);
 const failure=new Error('SDK unavailable'),broken=context.create(async()=>{throw failure;});
 broken.onSnapshot(()=>{},value=>error=value);await new Promise(resolve=>setImmediate(resolve));assert.equal(error,failure);await assert.rejects(broken.get(),/SDK unavailable/);
});
