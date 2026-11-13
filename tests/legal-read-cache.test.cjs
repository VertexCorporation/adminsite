'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness}=require('./helpers/module-harness.cjs');
test('legal cache deduplicates pending reads, clones records, expires entries and bounds memory',async()=>{
 const h=harness();try{
  const {createLegalReadCache}=await h.load('js/services/legalReadCache.js');let time=0,reads=0,release;
  const cache=createLegalReadCache({ttl:10,max:2,now:()=>time});
  const loader=()=>{reads++;return new Promise(r=>release=r);};
  const a=cache.load('a',loader),b=cache.load('a',loader);await Promise.resolve();assert.equal(reads,1);release({value:'A'});
  const first=await a;await b;first.value='edited';assert.equal(cache.get('a').value,'A');
  cache.set('b',{value:'B'});cache.set('c',{value:'C'});assert.equal(cache.get('a'),null);
  time=11;assert.equal(cache.get('b'),null);assert.equal(cache.get('c'),null);
 }finally{h.close();}
});
test('logout or mutation invalidation prevents late reads from repopulating the cache',async()=>{
 const h=harness();try{
  const {createLegalReadCache}=await h.load('js/services/legalReadCache.js');const cache=createLegalReadCache();let release;
  const old=cache.load('document',()=>new Promise(r=>release=r));await Promise.resolve();
  cache.clear();await cache.load('document',async()=>({revision:2}));release({revision:1});await old;
  assert.equal(cache.get('document').revision,2);cache.clear();assert.equal(cache.get('document'),null);
 }finally{h.close();}
});
