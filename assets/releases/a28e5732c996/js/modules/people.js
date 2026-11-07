import { createLoadingController, skeletonRows, skeletonListItem, setButtonLoading } from '../utils/loading.js';
import { displayDepartmentName } from '../utils/departments.js';
import { consolePeopleCall, getVertexContributorsFn, auth } from '../core/firebase.js';
import { deploymentCapabilities } from '../core/deployment-capabilities.js';
import { showToast, __, escapeHTML as esc, userErrorMessage, getLang, onLangChange } from '../utils/ui.js';
import { openDrawer, closeDrawer, confirmDialog } from './shell.js';
import { isPanelAdmin } from './roles.js';
import { icon } from '../utils/icons.js';
const departments=['Array','Aero','Catalyst','Chroma','Core','Curia','Envoy','Pulse','Senatus','Tensor'];
const state={users:[],applications:[],cursor:null,next:null,history:[],page:1,busy:false,epoch:0,appEpoch:0,loaded:new Set()};
const el=id=>document.getElementById(id);
const date=value=>{const d=value?.toDate?.() || new Date(value?._seconds?value._seconds*1000:value);return value&&Number.isFinite(d.getTime())?new Intl.DateTimeFormat(getLang()==='tr'?'tr-TR':'en-GB',{dateStyle:'medium'}).format(d):'—';};
const membership=person=>person.isVertex===true?'active':person.isVertex===false?'inactive':'missing';
const badge=(status)=>`<span class="people-badge ${status==='active'?'is-active':''}">${status==='active'?'<img src="assets/vertex-logo.svg" width="13" height="13" alt="">':''}${esc(__('people.'+status))}</span>`;
// The directory, linked accounts and drawer all share the same delayed
// skeleton/stale-data/error state machine. No immediate skeleton flashing.
const peopleLoaders = new WeakMap();
function loader(host){
 let controller=peopleLoaders.get(host);
 if(!controller){
  controller=createLoadingController(host,{
   skeletonHTML:skeletonRows(5,skeletonListItem)
  });
  peopleLoaders.set(host,controller);
 }
 return controller;
}
function empty(host,title,description,action){
 const html=`<div class="people-empty">${icon('users-group',{size:28})}<h4>${esc(title)}</h4><p>${esc(description)}</p>${action?`<button type="button" class="chrome-btn-outline" data-state-action>${esc(action.label)}</button>`:''}</div>`;
 loader(host).success(html);
 if(action)host.querySelector(':scope > .people-empty [data-state-action]')?.addEventListener('click',action.run);
}
function loading(host){if(host)loader(host).start();}
function errorState(host,error,retry){
 // A failing refresh leaves existing rows intact; first-load failures
 // render the shared accessible retry state.
 loader(host).error(userErrorMessage(error),retry,__('common.retry'));
}
function rowName(user){return `<span class="people-identity"><span class="people-avatar">${esc((user.name||user.email||'?').slice(0,1).toLocaleUpperCase(getLang()))}</span><span><strong>${esc(user.name||__('people.unnamed'))}</strong><small>${esc(user.email||__('people.no_email'))}</small></span></span>`;}
function renderUsers(){const host=el('console-users-list');host.removeAttribute('aria-busy');host.classList.remove('is-refreshing');if(!state.users.length){empty(host,__('people.no_users'),__('people.try_search'));return;}
 loader(host).success(`<div class="people-table-wrap"><table class="people-table"><thead><tr><th>${esc(__('people.person'))}</th><th>${esc(__('people.membership'))}</th><th>${esc(__('people.department'))}</th><th>${esc(__('people.role'))}</th><th>${esc(__('people.created'))}</th><th><span class="sr-only">${esc(__('people.details'))}</span></th></tr></thead><tbody>${state.users.map((user,i)=>`<tr data-user-row="${i}" tabindex="0" aria-label="${esc(user.name||user.email||user.uid)}"><td>${rowName(user)}</td><td>${badge(user.membership||'unlinked')}</td><td>${esc(displayDepartmentName(user.department))}</td><td>${esc(user.role?__('people.role_'+user.role):'—')}</td><td class="people-meta">${esc(date(user.authCreatedAt))}</td><td>${icon('chevron-right',{size:16})}</td></tr>`).join('')}</tbody></table></div>`);
 host.querySelectorAll(':scope > .people-table-wrap [data-user-row]').forEach(row=>{const show=()=>openUser(state.users[Number(row.dataset.userRow)]);row.onclick=show;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};});
}
function pagination(){el('console-users-previous').disabled=state.busy||!state.history.length;el('console-users-next').disabled=state.busy||!state.next;el('console-users-page').textContent=__('people.page').replace('{page}',state.page).replace('{count}',state.users.length);}
export async function loadConsoleUsers(reset=false){if(!isPanelAdmin())return;if(reset){state.cursor=null;state.history=[];state.page=1;}
 const host=el('console-users-list');if(!deploymentCapabilities.consolePeople){empty(host,__('people.preparing_title'),__('people.preparing_desc'));pagination();return;}
 const epoch=++state.epoch;state.busy=true;loading(host);pagination();
 try{const response=(await consolePeopleCall('listConsoleUsers',{search:el('console-user-search').value.trim(),cursor:state.cursor,department:el('console-user-department')?.value||'',role:el('console-user-role')?.value||''})).data;if(epoch!==state.epoch)return;
  state.users=response.users||[];state.next=response.nextCursor||null;
  if(response.indexReady===false){empty(host,__('people.index_title'),__('people.index_desc').replace('{count}',response.indexed||0),{label:__('people.prepare_index'),run:prepareIndex});return;}
  renderUsers();
 }catch(error){if(epoch===state.epoch)errorState(host,error,()=>loadConsoleUsers());}finally{if(epoch===state.epoch){state.busy=false;host.classList.remove('is-refreshing');host.removeAttribute('aria-busy');pagination();}}
}
async function prepareIndex(){if(!await confirmDialog(()=>({title:__('people.prepare_index'),body:__('people.index_confirm')})))return;
 const host=el('console-users-list');state.busy=true;pagination();let stop=false;empty(host,__('people.index_running'),__('people.index_safe'),{label:__('people.pause'),run:()=>{stop=true;}});
 try{let result;do{if(!auth.currentUser||!isPanelAdmin())return;result=(await consolePeopleCall('prepareConsoleUserDirectory',{})).data;const p=host.querySelector('p');if(p)p.textContent=__('people.index_progress').replace('{count}',result.indexed);if(!result.complete&&!stop)await new Promise(r=>setTimeout(r,300));}while(!result.complete&&!stop);if(result.complete)await loadConsoleUsers(true);else empty(host,__('people.index_paused'),__('people.index_desc').replace('{count}',result.indexed),{label:__('people.prepare_index'),run:prepareIndex});}
 catch(error){errorState(host,error,prepareIndex);}finally{state.busy=false;pagination();}
}
function detailField(label,value){return `<div class="people-detail-field"><dt>${esc(label)}</dt><dd>${esc(value||'—')}</dd></div>`;}
async function openUser(summary){let closed=false;const body=openDrawer({title:__('people.details'),titleKey:'people.details',onAfterClose:()=>{closed=true;},render:host=>loading(host)});
 try{const user=(await consolePeopleCall('getConsoleUser',{uid:summary.uid})).data.user;if(closed||!body.isConnected)return;
 loader(body).destroy();
 body.innerHTML=`<div class="people-profile">${rowName(user)}${badge(user.membership)}</div><dl class="people-details">${detailField(__('people.email'),user.email)}${detailField(__('people.created'),date(user.authCreatedAt))}${detailField(__('people.department'),displayDepartmentName(user.department))}${detailField(__('people.role'),user.role?__('people.role_'+user.role):null)}${detailField(__('people.subscription'),(user.subscription?.tier||'free').toUpperCase())}${detailField(__('people.email_status'),__(user.emailVerified?'people.verified':'people.not_verified'))}${detailField(__('people.link'),__('people.link_'+user.linkStatus))}${detailField(__('people.signin'),user.providers?.join(', '))}</dl><div class="people-drawer-section"><h4>${esc(__('people.application'))}</h4><p class="people-description">${esc(user.contributor?user.contributor.name:__('people.no_link'))}</p>${user.contributor?`<button type="button" class="chrome-btn-outline" id="people-open-application">${esc(__('people.view_application'))}</button>`:''}</div>${user.linkStatus==='linked'&&user.membership==='active'&&deploymentCapabilities.consolePersonnelWrites?`<form class="form-stack people-drawer-section" id="people-personnel-form"><h4>${esc(__('people.manage_personnel'))}</h4><label for="people-personnel-department">${esc(__('people.department'))}</label><select id="people-personnel-department" required><option value="" disabled ${departments.includes(user.department)?'':'selected'}>${esc(__('people.select_department'))}</option>${departments.map(d=>`<option ${user.department===d?'selected':''}>${d}</option>`).join('')}</select><label for="people-personnel-role">${esc(__('people.role'))}</label><select id="people-personnel-role">${['member','moderator','chef'].map(r=>`<option value="${r}" ${user.role===r?'selected':''}>${esc(__('people.role_'+r))}</option>`).join('')}</select><button class="chrome-btn-outline">${esc(__('people.save_personnel'))}</button></form>`:''}<div class="people-notice">${esc(__('people.actions_pending'))}</div>`;
 body.querySelector('#people-personnel-form')?.addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button'),department=body.querySelector('#people-personnel-department').value,role=body.querySelector('#people-personnel-role').value;if(!await confirmDialog(()=>({title:__('people.save_personnel'),body:__('people.personnel_confirm'),rows:[{label:__('people.email'),value:user.email},{label:__('people.department'),value:department},{label:__('people.role'),value:__('people.role_'+role)}]})))return;setButtonLoading(button,true);try{await consolePeopleCall('updateConsolePersonnel',{uid:user.uid,department,role,expectedVersion:user.authzVersion||0});showToast(()=>__('people.saved'),'success');closeDrawer(false);openUser(user);loadConsoleUsers();}catch(error){showToast(()=>userErrorMessage(error),'error');}finally{if(button.isConnected)setButtonLoading(button,false);}});
 body.querySelector('#people-open-application')?.addEventListener('click',()=>{closeDrawer(false);const app=state.applications.find(p=>p.id===user.contributor.id)||{...user.contributor,email:user.email};openApplication(app);});
 }catch(error){if(!closed&&body.isConnected)errorState(body,error,()=>{closeDrawer(false);openUser(summary);});}
}
function renderApplications(){const host=el('vertex-accounts-list');host.removeAttribute('aria-busy');host.classList.remove('is-refreshing');const query=el('vertex-accounts-search').value.trim().toLocaleLowerCase(getLang()),filter=el('vertex-membership-filter').value;
 const rows=state.applications.filter(p=>(filter==='all'||membership(p)===filter)&&[p.name,p.email,p.phone,p.department].some(v=>String(v||'').toLocaleLowerCase(getLang()).includes(query)));
 if(!rows.length){empty(host,__('people.no_applications'),__('people.try_search'));return;}
 loader(host).success(`<div class="people-table-wrap"><table class="people-table"><thead><tr><th>${esc(__('people.person'))}</th><th>${esc(__('people.department'))}</th><th>${esc(__('people.membership'))}</th><th>${esc(__('people.applied'))}</th><th></th></tr></thead><tbody>${rows.map((p,i)=>`<tr data-application-row="${i}" tabindex="0"><td>${rowName(p)}</td><td>${esc(displayDepartmentName(p.department))}</td><td>${badge(membership(p))}</td><td class="people-meta">${esc(date(p.createdAt))}</td><td>${icon('chevron-right',{size:16})}</td></tr>`).join('')}</tbody></table></div><p class="people-list-footnote">${esc(__('people.application_count').replace('{count}',rows.length))}</p>`);
 host.querySelectorAll(':scope > .people-table-wrap [data-application-row]').forEach(row=>{const show=()=>openApplication(rows[Number(row.dataset.applicationRow)]);row.onclick=show;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};});
}
export async function loadVertexAccounts(){if(!isPanelAdmin())return;const host=el('vertex-accounts-list'),epoch=++state.appEpoch;loading(host);try{const r=await getVertexContributorsFn();if(epoch!==state.appEpoch)return;state.applications=r.data.contributors||[];renderApplications();}catch(error){if(epoch===state.appEpoch)errorState(host,error,loadVertexAccounts);}}
function openApplication(person){const body=openDrawer({title:__('people.application'),titleKey:'people.application',render:host=>{host.innerHTML=`<div class="people-profile">${rowName(person)}${badge(membership(person))}</div><dl class="people-details">${detailField(__('people.department'),displayDepartmentName(person.department))}${detailField(__('people.phone'),person.phone)}${detailField(__('people.applied'),date(person.createdAt))}${detailField(__('people.joined'),date(person.joinedAt))}</dl><div class="people-drawer-section"><h4>${esc(__('people.account_link'))}</h4><p class="people-description">${esc(__('people.link_explainer'))}</p><div id="people-account-match"></div>${person.email&&deploymentCapabilities.consolePeople?`<button class="chrome-btn-outline" type="button" id="people-check-account">${esc(__('people.check_account'))}</button>`:''}</div>${deploymentCapabilities.consoleMembershipWrites?`<div class="people-drawer-section"><button type="button" id="people-change-membership" class="chrome-btn-outline">${esc(__(person.isVertex===true?'people.deactivate':'people.activate'))}</button></div>`:''}<div class="people-notice">${esc(__('people.actions_pending'))}</div>`;}});
 body.querySelector('#people-change-membership')?.addEventListener('click',async event=>{
  const button=event.currentTarget;if(button.disabled)return;const next=person.isVertex!==true;
  if(!await confirmDialog(()=>({title:__(next?'people.activate':'people.deactivate'),body:__('people.membership_confirm'),rows:[{label:__('people.email'),value:person.email||'—'},{label:__('people.person'),value:person.name||'—'}]})))return;
  setButtonLoading(button,true);
  try{const result=(await consolePeopleCall('setConsoleContributorMembership',{contributorId:person.id,isVertex:next,expectedStatus:person.isVertex===true,expectedFieldExists:Object.hasOwn(person,'isVertex')})).data;person.isVertex=result.isVertex;showToast(()=>__('people.saved'),'success');closeDrawer();renderApplications();document.dispatchEvent(new CustomEvent('vertex:personnel-changed'));}catch(error){showToast(()=>userErrorMessage(error),'error');}finally{if(button.isConnected)setButtonLoading(button,false);}
 });
 body.querySelector('#people-check-account')?.addEventListener('click',async event=>{const button=event.currentTarget;setButtonLoading(button,true);const host=body.querySelector('#people-account-match');try{const data=(await consolePeopleCall('previewConsoleAccounts',{emails:person.email})).data,row=data.rows[0];if(!body.isConnected)return;host.innerHTML=`<p class="people-match-result">${esc(__('people.preview_'+(row?.status||'invalid')))}</p>${row?.uid?`<button class="chrome-btn-outline" data-inspect-candidate>${esc(__('people.view_account'))}</button>`:''}`;host.querySelector('[data-inspect-candidate]')?.addEventListener('click',()=>{closeDrawer(false);openUser({uid:row.uid});});}catch(error){if(host.isConnected)host.textContent=userErrorMessage(error);}finally{if(button.isConnected)setButtonLoading(button,false);}});
}
function openBulkPreview(){openDrawer({title:__('people.bulk_preview'),titleKey:'people.bulk_preview',render:body=>{
 body.innerHTML=`<p class="people-description">${esc(__('people.bulk_desc'))}</p><form class="form-stack" id="people-bulk-form"><label for="people-bulk-emails">${esc(__('people.email_addresses'))}</label><textarea id="people-bulk-emails" rows="8" autocomplete="off" spellcheck="false" placeholder="name@example.com" required></textarea><button class="chrome-btn-accent" ${deploymentCapabilities.consolePeople?'':'disabled'}>${esc(__('people.preview'))}</button></form><div id="people-bulk-result" aria-live="polite"></div><div class="people-notice">${esc(__('people.bulk_safe'))}</div>`;
 body.querySelector('form').onsubmit=async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button'),host=body.querySelector('#people-bulk-result');setButtonLoading(button,true);loading(host);try{const data=(await consolePeopleCall('previewConsoleAccounts',{emails:body.querySelector('textarea').value})).data;if(!body.isConnected)return;loader(host).destroy();host.removeAttribute('aria-busy');host.innerHTML=`<p class="people-list-footnote">${esc(__('people.preview_summary').replace('{valid}',data.emails.length).replace('{duplicate}',data.duplicates.length).replace('{invalid}',data.invalid.length))}</p>${data.invalid.length?`<p class="people-validation">${esc(__('people.invalid_addresses'))}: ${esc(data.invalid.join(', '))}</p>`:''}<div class="people-preview-list">${data.rows.map(row=>`<div><strong>${esc(row.email)}</strong><small>${esc(__('people.preview_'+row.status))}</small></div>`).join('')}</div>`;}catch(error){if(host.isConnected)errorState(host,error,()=>body.querySelector('form').requestSubmit());}finally{if(button.isConnected)setButtonLoading(button,false);}};
 }});}
export function initPeopleModule(){
 // This legacy directory only initializes when its entire view is mounted.
 // The current contributors workspace uses different controls and remains active.
 const requiredIds = [
  'refresh-console-users', 'refresh-vertex-accounts', 'console-users-list',
  'vertex-accounts-list', 'console-user-search-form', 'console-user-search',
  'console-users-next', 'console-users-previous', 'console-users-page',
  'console-user-department', 'console-user-role', 'vertex-accounts-search',
  'vertex-membership-filter', 'preview-account-bulk'
 ];
 if (!requiredIds.every(id => el(id))) {
  console.info('[PEOPLE] Legacy directory view not mounted; skipping its event bindings.');
  return;
 }
 el('refresh-console-users').onclick=()=>loadConsoleUsers(true);el('refresh-vertex-accounts').onclick=loadVertexAccounts;
 el('console-user-search-form').onsubmit=event=>{event.preventDefault();loadConsoleUsers(true);};
 el('console-users-next').onclick=()=>{if(state.busy||!state.next)return;state.history.push(state.cursor);state.cursor=state.next;state.page++;loadConsoleUsers();};
 el('console-users-previous').onclick=()=>{if(state.busy||!state.history.length)return;state.cursor=state.history.pop();state.page--;loadConsoleUsers();};
 el('console-user-department').onchange=()=>loadConsoleUsers(true);el('console-user-role').onchange=()=>loadConsoleUsers(true);
 el('vertex-accounts-search').oninput=renderApplications;el('vertex-membership-filter').onchange=renderApplications;el('preview-account-bulk').onclick=openBulkPreview;
 document.addEventListener('vertex:workspace',event=>{if(!auth.currentUser||!isPanelAdmin())return;for(const[key,load]of [['contributors.users',loadConsoleUsers],['contributors.vertexStatus',loadVertexAccounts]])if(event.detail.keys.includes(key)&&!state.loaded.has(key)){state.loaded.add(key);load();}});
 auth.onAuthStateChanged(()=>{state.epoch++;state.appEpoch++;state.users=[];state.applications=[];state.cursor=null;state.next=null;state.history=[];state.loaded.clear();closeDrawer();});
 onLangChange(()=>{if(state.users.length)renderUsers();if(state.applications.length)renderApplications();pagination();});
}
