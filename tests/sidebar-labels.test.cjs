'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const strings=fs.readFileSync(path.join(root,'js/lang.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const boundary=strings.indexOf('\n  en: {');
assert(boundary>0,'Turkish and English translation sections should both exist');
const dictionaries=[strings.slice(0,boundary),strings.slice(boundary)];
const expected={
 'navgroup.workspace':['Çalışma Alanı','Workspace'],
 'subnav.vertex_status':['Vertex Durumu','Vertex Status'],
 'subnav.catalog':['Model Kataloğu','Model Catalog'],
 'subnav.manage_models':['Modelleri Yönet','Manage Models'],
 'subnav.active_subscriptions':['Aktif Abonelikler','Active Subscriptions'],
 'subnav.server':['Sunucu','Server'],
 'subnav.exports_attributions':['Dışa Aktarma','Exports'],
};
for(const [key,values] of Object.entries(expected)){
 test('sidebar '+key+' is translated consistently',()=>{
  assert(html.includes('data-i18n="'+key+'"'),'sidebar must use translation key '+key);
  dictionaries.forEach((dict,lang)=>{
   const line=dict.split('\n').filter(s=>s.includes('"'+key+'":'));
   assert.equal(line.length,1,'exactly one '+key+' translation in '+['tr','en'][lang]);
   assert.equal(line[0].trim(),JSON.stringify(key)+': '+JSON.stringify(values[lang])+',');
  });
 });
}
test('every sidebar key is backed by TR and EN translations',()=>{
 const keys=[...html.matchAll(/class="sidebar-sub-btn"[^>]*data-i18n="([^"]+)"/g)].map(m=>m[1]);
 assert(keys.length>=15,'expected all sidebar subnavigation actions');
 for(const key of keys){
  for(const dict of dictionaries){
   assert(dict.includes(JSON.stringify(key)+':')||dict.includes("'"+key+"':"),'missing sidebar translation '+key);
  }
 }
});
