import { registerListRefresh } from '../ui/listRefresh.js';
import { auth, consolePeopleCall, verifyUserEmailFn } from '../core/firebase.js';
import { isPanelAdmin, getEffectivePanelLevel } from './roles.js';
import { openDrawer, closeDrawer, confirmDialog } from './shell.js';
import { createLoadingController, skeletonRows, skeletonListItem, setButtonLoading } from '../utils/loading.js';
import { __, getLang, onLangChange, escapeHTML as esc, userErrorMessage, showToast } from '../utils/ui.js';
const el=id=>document.getElementById(id);
const state={users:[],cursor:null,next:null,history:[],page:1,busy:false,epoch:0,loaded:false,selected:null,stats:null,statsEpoch:0};
const loaders=new Map();
function loader(id){if(!loaders.has(id))loaders.set(id,createLoadingController(el(id),{skeletonHTML:skeletonRows(5,skeletonListItem),crossfadeOptions:{mode:'enter'}}));return loaders.get(id);}
const date=value=>value?new Intl.DateTimeFormat(getLang()==='tr'?'tr-TR':'en-GB',{dateStyle:'medium'}).format(new Date(value)):'—';
const yes=value=>__(value?'catalog.yes':'catalog.no');
function field(label,value){return `<div><dt>${esc(__(label))}</dt><dd>${esc(value||'—')}</dd></div>`;}
function identity(user){return `<strong>${esc(user.name||__('catalog.unnamed_user'))}</strong><small>${esc(user.email||__('catalog.no_email'))}</small>`;}
function paintPager(){el('directory-previous').disabled=state.busy||!state.history.length;el('directory-next').disabled=state.busy||!state.next;el('directory-page').textContent=__('catalog.page').replace('{page}',state.page).replace('{count}',state.users.length);}
function paintRows(){
 const html=state.users.length?`<div class="people-table-wrap"><table class="people-table"><thead><tr>${['people.person','people.email_status','catalog.account','people.membership','people.created'].map(k=>`<th>${esc(__(k))}</th>`).join('')}</tr></thead><tbody>${state.users.map((u,i)=>`<tr data-directory-row="${i}" tabindex="0"><td class="catalog-identity">${identity(u)}</td><td>${yes(u.emailVerified)}</td><td>${esc(__(u.disabled?'catalog.banned':'catalog.enabled'))}</td><td>${esc(__('people.'+(u.membership||'unlinked')))}</td><td>${esc(date(u.authCreatedAt))}</td></tr>`).join('')}</tbody></table></div>`:`<p class="state-block">${esc(__('people.no_users'))}</p>`;
 loader('directory-list').success(html);
 el('directory-list').querySelectorAll('[data-directory-row]').forEach(row=>{const open=()=>openUser(state.users[Number(row.dataset.directoryRow)]);row.onclick=open;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};});paintPager();
}
async function load(reset=false){
 if(!isPanelAdmin()||!auth.currentUser)return;
 const before={cursor:state.cursor,history:[...state.history],page:state.page};
 if(reset){state.cursor=null;state.history=[];state.page=1;}
 const epoch=++state.epoch;state.busy=true;paintPager();loader('directory-list').start();setButtonLoading(el('directory-refresh'),true);
 try{
  const {data}=await consolePeopleCall('listConsoleUsers',{pageSize:100,search:el('directory-search').value.trim(),cursor:state.cursor});
  if(epoch!==state.epoch)return;
  if(data.indexReady===false){loader('directory-list').success(`<div class="state-block"><p>${esc(__('catalog.prepare_desc'))}</p><button type="button" class="chrome-btn-outline" id="directory-prepare">${esc(__('people.prepare_index'))}</button></div>`);state.next=null;el('directory-prepare').onclick=prepare;return;}
  state.users=data.users||[];state.next=data.nextCursor||null;state.loaded=true;paintRows();return true;
 }catch(error){if(epoch===state.epoch){Object.assign(state,before);loader('directory-list').error(userErrorMessage(error),()=>load(reset),__('common.retry'));return false;}}
 finally{if(epoch===state.epoch){state.busy=false;paintPager();setButtonLoading(el('directory-refresh'),false);}}
}
async function prepare(){
 const actor=auth.currentUser?.uid,epoch=state.epoch;let stopped=false;
 loader('directory-list').success(`<p role="status" id="directory-progress"></p><button type="button" id="directory-pause" class="chrome-btn-outline">${esc(__('people.pause'))}</button>`);
 el('directory-pause').onclick=()=>{stopped=true;};state.busy=true;paintPager();
 try{let result;do{if(stopped||actor!==auth.currentUser?.uid||!isPanelAdmin()||epoch!==state.epoch)return;result=(await consolePeopleCall('prepareConsoleUserDirectory',{})).data;if(el('directory-progress'))el('directory-progress').textContent=__('people.index_progress').replace('{count}',result.indexed);}while(!result.complete&&!stopped);state.busy=false;await load(true);}
 catch(error){if(actor===auth.currentUser?.uid&&epoch===state.epoch)loader('directory-list').error(userErrorMessage(error),()=>load(true),__('common.retry'));}
 finally{state.busy=false;paintPager();}
}
function navigate(panel,action=''){
 const target=[...document.querySelectorAll('.sidebar-sub-btn')].find(b=>b.dataset.navPanel.split(',').includes(panel)&&b.dataset.navAction===action&&!b.hidden);
 if(!target)return false;target.click();return true;
}
function showStatus(user){closeDrawer(false);state.selected=user;if(navigate('users.status')){el('account-status-search').value=user.email||__('catalog.no_email');paintStatus(user);}}
function subscription(user){
 closeDrawer(false);
 if(!navigate('subscriptions.assign'))return;
 el('sub-user-email').value=user.email||'';el('sub-username').value=user.name||'';
 const form=el('subscription-form');let back=el('subscription-return-user');if(!back){back=document.createElement('button');back.id='subscription-return-user';back.type='button';back.className='chrome-btn-outline';form.prepend(back);}
 back.textContent=__('catalog.return_user');back.onclick=()=>{if(navigate('users.directory'))void openUser(user);};
 el('sub-plan').focus({preventScroll:true});
}
async function openUser(summary){
 const actor=auth.currentUser?.uid;let closed=false;
 const body=openDrawer({title:__('people.details'),titleKey:'people.details',onAfterClose:()=>{closed=true;},render:host=>host.innerHTML=skeletonRows(4,skeletonListItem)});
 try{const {data}=await consolePeopleCall('getConsoleUser',{uid:summary.uid});if(closed||!body.isConnected||actor!==auth.currentUser?.uid)return;const u=data.user;
 body.innerHTML=`<div class="catalog-identity catalog-user-heading">${identity(u)}</div><dl class="profile-details">${field('profile.uid',u.uid)}${field('people.created',date(u.authCreatedAt))}${field('people.email_status',yes(u.emailVerified))}${field('catalog.account',__(u.disabled?'catalog.banned':'catalog.enabled'))}${field('people.membership',__('people.'+u.membership))}${field('people.department',u.departments?.join(', ')||u.department)}${field('people.subscription',(u.subscription?.tier||'free').toUpperCase())}</dl><div class="catalog-actions"><button type="button" class="chrome-btn-outline" id="directory-manage-status">${esc(__('catalog.status'))}</button>${getEffectivePanelLevel('subscriptions.assign')==='write'?`<button type="button" class="chrome-btn-outline" id="directory-assign-subscription">${esc(__('subs.assign_btn'))}</button>`:''}</div>`;
 body.querySelector('#directory-manage-status').onclick=()=>showStatus(u);body.querySelector('#directory-assign-subscription')?.addEventListener('click',()=>subscription(u));
 }catch(error){if(!closed&&body.isConnected&&actor===auth.currentUser?.uid)body.textContent=userErrorMessage(error);}
}
function paintStatus(u){
 state.selected=u;
 el('account-status-result').innerHTML=`<div class="catalog-selected-user"><div class="catalog-identity">${identity(u)}</div><span>${esc(__(u.disabled?'catalog.banned':'catalog.enabled'))}</span></div><div class="catalog-actions"><button type="button" class="chrome-btn-outline" data-account-action="ban">${esc(__(u.disabled?'catalog.unban':'catalog.ban'))}</button><button type="button" class="chrome-btn-outline" data-account-action="verify" ${u.emailVerified?'disabled':''}>${esc(__('catalog.verify'))}</button><button type="button" class="chrome-btn-outline" data-account-action="vertex">${esc(__('catalog.vertex'))}</button><button type="button" class="chrome-btn-outline" data-account-action="reset" ${!u.email||u.disabled?'disabled':''}>${esc(__('catalog.reset'))}</button><button type="button" class="chrome-btn-outline" data-account-action="delete">${esc(__('deleteAccount.title'))}</button></div><p class="form-hint" data-i18n="catalog.vertex_hint">${esc(__('catalog.vertex_hint'))}</p>`;
 el('account-status-result').querySelectorAll('[data-account-action]').forEach(button=>button.onclick=()=>act(button,u));
}
async function act(button,u){
 if(!isPanelAdmin()||state.selected?.uid!==u.uid)return;
 const action=button.dataset.accountAction;
 if(action==='delete'){el('account-deletion-email').value=u.email||'';el('account-deletion-email').dispatchEvent(new Event('input'));el('account-deletion-search-form').requestSubmit();el('account-deletion-search-form').scrollIntoView({behavior:'smooth',block:'center'});return;}
 if(action==='vertex'){if(navigate('contributors.list')){el('contributor-search').value=u.email||u.uid;el('contributor-search').dispatchEvent(new Event('input'));window.searchContributorsLocal?.();}return;}
 if(!await confirmDialog(()=>({title:button.textContent,body:__('catalog.action_confirm'),rows:[{label:__('people.email'),value:esc(u.email||u.uid)}],danger:action==='ban'&&!u.disabled})))return;
 if(!isPanelAdmin()||state.selected?.uid!==u.uid)return;
 const actor=auth.currentUser?.uid;setButtonLoading(button,true);
 try{
  if(action==='verify')await verifyUserEmailFn({identifier:u.uid});
  if(action==='reset'){auth.languageCode=getLang();await auth.sendPasswordResetEmail(u.email);}
  if(action==='ban')await consolePeopleCall('setConsoleAccountDisabled',{uid:u.uid,disabled:!u.disabled,expectedDisabled:u.disabled===true});
  if(actor!==auth.currentUser?.uid)return;
  showToast(()=>__('catalog.saved'),'success');
  const {data}=await consolePeopleCall('getConsoleUser',{uid:u.uid});if(actor!==auth.currentUser?.uid)return;paintStatus(data.user);state.loaded=false;
 }catch(error){if(actor===auth.currentUser?.uid)showToast(()=>userErrorMessage(error),'error');}
 finally{if(button.isConnected)setButtonLoading(button,false);}
}
async function statistics(){
 if(!isPanelAdmin()||!auth.currentUser)return;const epoch=++state.statsEpoch;loader('directory-statistics').start();
 try{const {data}=await consolePeopleCall('getConsoleUserStatistics',{});if(epoch!==state.statsEpoch)return;state.stats=data;loader('directory-statistics').success(`<div class="catalog-stat-grid">${[['catalog.total',data.total],['catalog.verified',data.verified],['catalog.banned',data.disabled]].map(([key,value])=>`<div class="catalog-stat"><span>${esc(__(key))}</span><strong>${Number(value||0).toLocaleString(getLang())}</strong></div>`).join('')}</div><p class="form-hint">${esc(__('catalog.statistics_hint'))}</p>`);}
 catch(error){if(epoch===state.statsEpoch)loader('directory-statistics').error(userErrorMessage(error),statistics,__('common.retry'));}
}
export function initDirectoryModule(){
 registerListRefresh(el('directory-list'),()=>load(true),{button:el('directory-refresh')});
 registerListRefresh(el('directory-statistics'),statistics,{button:el('directory-statistics-refresh')});
 if(!el('directory-list'))return;
 el('directory-refresh').onclick=()=>load(true);el('directory-search-form').onsubmit=e=>{e.preventDefault();void load(true);};
 el('directory-next').onclick=async()=>{if(state.busy||!state.next)return;const before={cursor:state.cursor,history:[...state.history],page:state.page};state.history.push(state.cursor);state.cursor=state.next;state.page++;if(await load()===false){Object.assign(state,before);paintPager();}};
 el('directory-previous').onclick=()=>{if(state.busy||!state.history.length)return;const before={cursor:state.cursor,history:[...state.history],page:state.page};state.cursor=state.history.pop();state.page--;void load().then(ok=>{if(ok===false){Object.assign(state,before);paintPager();}});};
 el('account-status-form').onsubmit=async e=>{e.preventDefault();const epoch=++statusEpoch,actor=auth.currentUser?.uid;loader('account-status-result').start();try{const {data}=await consolePeopleCall('listConsoleUsers',{search:el('account-status-search').value.trim()});if(epoch!==statusEpoch||actor!==auth.currentUser?.uid)return;loader('account-status-result').success('');if(data.users?.[0])paintStatus(data.users[0]);else el('account-status-result').textContent=__('people.no_users');}catch(error){if(epoch===statusEpoch)loader('account-status-result').error(userErrorMessage(error),()=>el('account-status-form').requestSubmit(),__('common.retry'));}};
 el('account-status-search').oninput=()=>{statusEpoch++;state.selected=null;el('account-status-result').replaceChildren();};
 el('directory-statistics-refresh').onclick=statistics;
 document.addEventListener('vertex:workspace',e=>{if(e.detail.keys.includes('users.directory')&&!state.loaded&&!state.busy)void load();if(e.detail.keys.includes('users.statistics')&&!state.stats)void statistics();});
 const clearDirectory=()=>{state.epoch++;state.statsEpoch++;statusEpoch++;Object.assign(state,{users:[],cursor:null,next:null,history:[],page:1,busy:false,loaded:false,selected:null,stats:null});for(const l of loaders.values())l.destroy();loaders.clear();['directory-list','account-status-result','directory-statistics'].forEach(id=>el(id).replaceChildren());el('subscription-return-user')?.remove();};
 auth.onAuthStateChanged(clearDirectory);
 document.addEventListener('vertex:access-changed',()=>{if(!isPanelAdmin()){clearDirectory();closeDrawer(false);}});
 onLangChange(()=>{if(state.users.length)paintRows();else paintPager();if(state.selected)paintStatus(state.selected);if(state.stats)void statistics();});
}
let statusEpoch=0;
