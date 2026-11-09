const {readConsoleSource} = require('./helpers/console-source.cjs');
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const strings=readConsoleSource('js/lang.js');
const html=readConsoleSource('index.html');
const {LANG}=require('./i18n-audit.cjs');
const dictionaries=[LANG.tr,LANG.en];
const expected={
 'catalog.users':['Kullanıcılar','Users'],
 'catalog.contributors':['Adaylar','Applicants'],
 'catalog.models':['Hizmetler','Services'],
 'catalog.publications':['Yayınlar','Publications'],
 'catalog.subscriptions':['Abonelikler','Subscriptions'],
 'catalog.scene':['Sahne','Stage'],
 'catalog.system':['Sistem','System'],
 'catalog.transfer':['Aktarım','Transfer'],
};
for(const [key,values] of Object.entries(expected)){
 test('sidebar '+key+' is translated consistently',()=>{
  assert(html.includes('data-i18n="'+key+'"'),'sidebar must use translation key '+key);
  dictionaries.forEach((dict,lang)=>{
   assert.equal(dict[key],values[lang]);
  });
 });
}
test('every sidebar key is backed by TR and EN translations',()=>{
 const keys=[...html.matchAll(/class="sidebar-sub-btn"[^>]*data-i18n="([^"]+)"/g)].map(m=>m[1]);
 assert(keys.length>=15,'expected all sidebar subnavigation actions');
 for(const key of keys){
  for(const dict of dictionaries){
   assert(Object.hasOwn(dict,key),'missing sidebar translation '+key);
  }
 }
});
