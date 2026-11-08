'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const policy=fs.readFileSync('js/utils/weekly-stars-policy.js','utf8').replace(/^export .*;$/m,'');
const {starSearchText}=vm.runInNewContext(policy+';({starSearchText})');
test('member search tolerates Turkish accents, case and extra spaces',()=>{
 for(const [name,query] of [['Mustafa Çakı','mustafa caki'],['İNCİ ŞAHİN','inci sahin'],['Güneri Gözüaçık','guneri gozuacik'],['  Çağrı   Işık ','cagri isik']])
  assert.equal(starSearchText(name),starSearchText(query));
});
const source=fs.readFileSync('js/modules/teamCards.js','utf8');
const {nodes}=require('./helpers/source-ast.cjs');
const node=nodes(source,n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='drawResults'))[0];
const draw=source.slice(node.start,node.end);
const {LANG}=require('./i18n-audit.cjs');

function render(query=''){
 const node=()=>({children:[],append(...children){this.children.push(...children);},setAttribute(){},replaceChildren(){this.children=[];}});
 const results=node(),directory=[{id:'a',name:'Çağrı Işık',isVertex:true,department:'Array'},
  {id:'core',name:'Core Üyesi',isVertex:true,department:'Core'},
  {id:'unknown',name:'Departmansız Üye',isVertex:true},
  {id:'second',name:'İkinci Array',isVertex:true,department:'array'}];
 const context={document:{createElement:node},directory,selected:[{id:'second'}],results,search:{value:query},
  __:key=>LANG.tr[key],getLang:()=> 'tr',starId:p=>p?.id};
 vm.runInNewContext(policy+'\n'+draw+';drawResults();',context);
 return results.children;
}
test('all active department categories remain visible, with ineligible choices disabled',()=>{
 const buttons=render();assert.equal(buttons.length,3);
 assert.equal(buttons[0].disabled,true); // Array already selected
 assert.equal(buttons[1].disabled,true); // Core excluded from nominations
 assert.equal(buttons[2].disabled,true); // Missing department
 assert(buttons[1].children[1].textContent.includes('uygun değil'));
});
test('accentless search finds the active member instead of an empty list',()=>{
 const buttons=render('cagri isik');assert.equal(buttons.length,1);
 assert.equal(buttons[0].children[0].textContent,'Çağrı Işık');
});
