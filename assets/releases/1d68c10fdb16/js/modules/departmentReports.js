// Embedded Vertex Konsol department reports. No separate login, iframe or Firebase app.
import { consolePeopleCall, auth } from '../core/firebase.js';
import { getCurrentUserAccess } from './roles.js';
import { escapeHTML as esc, showToast, userErrorMessage } from '../utils/ui.js';

const DEPTS=['Core','Senatus','Tensor','Curia','Pulse','Chroma','Catalyst','Envoy','Aero','Array'];
const LABELS={urgent:'Acil',normal:'Normal',low:'Acil değil',todo:'Tamamlanmadı',doing:'Devam ediyor',done:'Tamamlandı',pending:'Bekliyor',approved:'Onaylandı',rejected:'Reddedildi'};
const DAYS=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
let active=false,mode='weekly',dept='',weekStart='',roster=[],reports=[],tasks=[],requests=[],epoch=0,busy=false,pendingLoad=false;
const $=id=>document.getElementById(id);
const call=async(name,body)=> (await consolePeopleCall(name,body)).data;
const warn=(error)=>showToast(()=>userErrorMessage(error),'error');
const monday=date=>{const d=new Date(`${date}T12:00:00Z`);if(!Number.isFinite(d.getTime()))return '';d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const isoShift=(date,days)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const dateLabel=date=>new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR',{day:'numeric',month:'short'});
const fmt=val=>esc(String(val??''));
const me=()=>getCurrentUserAccess();
const canEdit=()=>me().isCore;
const nameOf=uid=>roster.find(user=>user.uid===uid)?.name||'Üye ('+String(uid||'').slice(0,7)+')';
const allowed=()=>me().isCore?DEPTS:DEPTS.filter(d=>me().departments.includes(d));
const recordFor=(uid,date)=>reports.find(item=>item.uid===uid&&item.date===date);
function rootWeekControls(current){document.querySelectorAll('#tab-reports [data-ar-week]').forEach(el=>{el.hidden=current!=='weekly';});}
function renderHeader(){
 const options=allowed();if(!options.length){$('ar-workspace').innerHTML='<div class="ar-empty">Aktif departman üyeliği bulunamadı.</div>';return false;}
 if(!options.includes(dept))dept=options.includes('Array')?'Array':options.find(d=>d!=='Core')||options[0];
 if(!weekStart)weekStart=monday(new Date().toISOString().slice(0,10));
 const shell=$('tab-reports');shell.dataset.arDepartment=dept.toLowerCase();
 const selector=$('ar-department');selector.innerHTML=options.map(d=>`<option value="${fmt(d)}" ${dept===d?'selected':''}>${fmt(d)}</option>`).join('');
 $('ar-current-department').textContent=dept;
 $('ar-week-display').textContent=`${dateLabel(weekStart)} – ${dateLabel(isoShift(weekStart,5))}`;
 $('ar-create').hidden=!canEdit();
 $('ar-member-counter').textContent=`${roster.length} üye`;
 $('ar-create').textContent=mode==='weekly'?'Rapor ekle':'Görev oluştur';
 $('ar-summary-btn').hidden=mode!=='weekly';
 rootWeekControls(mode);
 return true;
}
const msg=message=>{$('ar-workspace').innerHTML=`<div class="ar-empty">${fmt(message)}</div>`;};
async function load({reloadRoster=false}={}){
 if(!active)return;if(busy){pendingLoad=true;return;}const current=++epoch;busy=true;msg('Yükleniyor…');
 try{
  if(reloadRoster||!roster.length){const data=await call('listDepartmentReportRoster',{department:dept});if(current!==epoch)return;roster=data.users||[];roster.sort((a,b)=>a.name.localeCompare(b.name,'tr'));}
  if(mode==='weekly'){const data=await call('listDepartmentWeekReports',{department:dept,weekStart});if(current!==epoch)return;reports=data.reports||[];}
  else{const data=await call('listDepartmentWorkTasks',{department:dept});if(current!==epoch)return;tasks=data.tasks||[];requests=data.requests||[];}
  renderHeader();renderBody();
 }catch(error){if(current===epoch){warn(error);msg('Veriler alınamadı. Fulcrum fonksiyonlarını dağıttığınızdan ve erişim yetkilerinizden emin olun.');}}
 finally{busy=false;if(pendingLoad){pendingLoad=false;void load();}}
}
const pill=(text,kind='normal')=>`<span class="ar-pill ar-pill-${fmt(kind)}">${fmt(text)}</span>`;
function renderWeek(){
 const dateList=DAYS.map((_,i)=>isoShift(weekStart,i));
 const hasRecords=reports.some(r=>dateList.includes(r.date));
 if(!roster.length){msg('Bu departmanda doğrulanmış kullanıcı bulunamadı. Üyeler Vertex Konsol hesaplarından alınır.');return;}
 const count=reports.filter(r=>r.status==='reported').length;
 $('ar-workspace').innerHTML=`<div class="ar-info">${roster.length} kayıtlı üye · ${count} raporlu gün · ${reports.filter(r=>r.status==='no-report').length} rapor yok kaydı. Kaydı olmayan günler otomatik olarak devamsız sayılmaz.</div>
  <div class="ar-table-scroll"><table class="ar-table"><thead><tr><th class="ar-person-head">Kişi</th>${DAYS.map((day,i)=>`<th>${fmt(day)}<small>${fmt(dateLabel(dateList[i]))}</small></th>`).join('')}</tr></thead>
  <tbody>${roster.map(person=>`<tr><th scope="row" class="ar-person">${fmt(person.name)}</th>${dateList.map(date=>{const record=recordFor(person.uid,date);
   return `<td><div class="ar-day-entry">${record?`<span class="ar-report-status">${record.status==='no-report'?'Rapor yok':'Raporlandı'}</span>${record.project?`<small class="ar-project">${fmt(record.project)}</small>`:''}<p>${fmt(record.summary)}</p>${record.next?`<small>${fmt(record.next)}</small>`:''}`:'<span class="ar-pending">Kayıt bulunmuyor</span>'}${canEdit()?`<button class="ar-text-button" type="button" data-ar-action="edit-report" data-uid="${fmt(person.uid)}" data-date="${date}">${record?'Düzenle':'Ekle'}</button>`:''}</div></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>
  ${!hasRecords?'<p class="ar-info">Bu hafta için henüz rapor eklenmedi.</p>':''}`;
}
function renderTasks(){
 $('ar-workspace').innerHTML=`<div class="ar-toolbar ar-task-toolbar"><label>Durum <select id="ar-task-filter"><option value="all">Tümü</option><option value="todo">Tamamlanmadı</option><option value="doing">Devam ediyor</option><option value="done">Tamamlandı</option></select></label><label>Öncelik <select id="ar-priority-filter"><option value="all">Tümü</option><option value="urgent">Acil</option><option value="normal">Normal</option><option value="low">Acil değil</option></select></label></div><div id="ar-task-list"></div>`;
 paintTaskList();
}
function paintTaskList(){
 const status=$('ar-task-filter')?.value||'all',priority=$('ar-priority-filter')?.value||'all';
 const selected=tasks.filter(t=>(status==='all'||status===t.status)&&(priority==='all'||priority===t.priority));
 const root=$('ar-task-list');if(!root)return;
 root.innerHTML=selected.length?selected.map(task=>{
  const myClaim=requests.find(r=>r.taskId===task.id&&r.uid===auth?.currentUser?.uid); // uid is not an authorization source
  const pending=requests.filter(r=>r.taskId===task.id&&r.status==='pending');
  const assigned=Array.isArray(task.assignees)?task.assignees:[];
  return `<article class="ar-task-card"><div class="ar-task-heading"><h3>${fmt(task.title)}</h3><div>${pill(LABELS[task.priority]||'Normal',task.priority)} ${pill(LABELS[task.status]||'Tamamlanmadı',task.status)}</div></div>
    ${task.description?`<p>${fmt(task.description)}</p>`:''}<div class="ar-task-footer"><span>${fmt(task.project||dept)}</span><span>${assigned.length?assigned.map(uid=>fmt(nameOf(uid))).join(' · '):'Henüz kimse atanmadı'}</span></div>
    <div class="ar-task-actions">${canEdit()?`<button type="button" class="ar-secondary" data-ar-action="edit-task" data-id="${fmt(task.id)}">Düzenle</button><button type="button" class="ar-text-button" data-ar-action="delete-task" data-id="${fmt(task.id)}">Sil</button>`:task.status==='done'?'':assigned.includes(auth?.currentUser?.uid)?'Göreve atandın':myClaim?.status==='pending'?'Üstlenme isteğin bekliyor':myClaim?.status==='approved'?'İsteğin onaylandı':`<button type="button" class="ar-secondary" data-ar-action="request-task" data-id="${fmt(task.id)}">Bu görevi almak istiyorum</button>`}</div>
    ${canEdit()&&pending.length?`<div class="ar-requests"><strong>Görev istekleri</strong>${pending.map(r=>`<div>${fmt(nameOf(r.uid))}<button type="button" data-ar-action="review-task" data-id="${fmt(task.id)}" data-uid="${fmt(r.uid)}" data-decision="approved">Onayla</button><button type="button" class="ar-text-button" data-ar-action="review-task" data-id="${fmt(task.id)}" data-uid="${fmt(r.uid)}" data-decision="rejected">Reddet</button></div>`).join('')}</div>`:''}
  </article>`;
 }).join(''):'<div class="ar-empty">Bu filtreye uygun görev bulunamadı.</div>';
}
function renderBody(){if(mode==='weekly')renderWeek();else renderTasks();}
function modalClose(){$('ar-modal').hidden=true;}
function showModal(type,model={}){
 if(!canEdit())return;
 $('ar-modal-title').textContent=type==='report'?'Günlük rapor':'Görev';
 $('ar-report-fields').hidden=type!=='report';$('ar-task-fields').hidden=type!=='task';
 for(const id of ['ar-report-fields','ar-task-fields']){const enabled=(id==='ar-report-fields')===(type==='report');$(id).querySelectorAll('input,select,textarea').forEach(control=>{control.disabled=!enabled;});}
 const form=$('ar-form');form.dataset.type=type;form.reset();form.dataset.id=model.id||'';
 if(type==='report'){
  $('ar-person').innerHTML=roster.map(r=>`<option value="${fmt(r.uid)}">${fmt(r.name)}</option>`).join('');
  $('ar-person').value=model.uid||roster[0]?.uid||'';
  $('ar-date').value=model.date||weekStart;
  $('ar-status').value=model.status||'reported';$('ar-project').value=model.project||'';
  $('ar-summary').value=model.summary||'';$('ar-next').value=model.next||'';
  $('ar-delete-report').hidden=!model.id;
 }else{
  $('ar-task-title').value=model.title||'';$('ar-task-desc').value=model.description||'';
  $('ar-task-priority').value=model.priority||'normal';$('ar-task-status').value=model.status||'todo';$('ar-task-project').value=model.project||'';
  $('ar-assignees').innerHTML=roster.map(user=>`<label class="ar-check"><input type="checkbox" value="${fmt(user.uid)}" ${(model.assignees||[]).includes(user.uid)?'checked':''}> ${fmt(user.name)}</label>`).join('');
  $('ar-delete-report').hidden=true;
 }
 $('ar-modal').hidden=false;
 $('ar-form').querySelector(type==='report'?'#ar-summary':'#ar-task-title')?.focus();
}
function summary(){
 const reportCounts=roster.map(r=>({name:r.name,logs:reports.filter(x=>x.uid===r.uid)}));
 return [`${dept} · Haftalık rapor (${dateLabel(weekStart)} – ${dateLabel(isoShift(weekStart,5))})`,'',
  ...reportCounts.flatMap(p=>[p.name,...DAYS.map((day,i)=>{const entry=p.logs.find(x=>x.date===isoShift(weekStart,i));return `${day}: ${entry?entry.summary+(entry.next?' | Sonraki adım: '+entry.next:''):'Kayıt bulunmuyor'}`;}),'']),
  'Bu rapor yalnızca kaydedilmiş faaliyetleri içerir; kayıt yokluğu çalışılmadığının kanıtı değildir.'].join('\n');
}
const download=(name,content)=>{const blob=new Blob([content],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
export function initDepartmentReports(){
 const root=$('tab-reports');if(!root)return;
 root.addEventListener('change',e=>{
  if(e.target.id==='ar-department'){epoch++;dept=e.target.value;roster=[];reports=[];tasks=[];requests=[];renderHeader();void load({reloadRoster:true});}
  if(e.target.id==='ar-task-filter'||e.target.id==='ar-priority-filter')paintTaskList();
 });
 root.addEventListener('click',async e=>{
  const control=e.target.closest('[data-ar-action]');if(!control||control.disabled)return;
  const action=control.dataset.arAction;
  try{
   if(action==='previous'||action==='next'){weekStart=isoShift(weekStart,action==='previous'?-7:7);renderHeader();void load();}
   else if(action==='refresh')void load({reloadRoster:true});
   else if(action==='summary')download(`haftalik-${dept.toLowerCase()}-${weekStart}.txt`,summary());
   else if(action==='create')showModal(mode==='weekly'?'report':'task');
   else if(action==='edit-report'){const record=recordFor(control.dataset.uid,control.dataset.date);showModal('report',{...record,uid:control.dataset.uid,date:control.dataset.date,id:record?.id});}
   else if(action==='edit-task'){showModal('task',tasks.find(t=>t.id===control.dataset.id));}
   else if(action==='cancel')modalClose();
   else if(action==='delete-report'){
    if(!window.confirm('Bu rapor silinsin mi?'))return;
    const uid=$('ar-person').value,date=$('ar-date').value;
    await call('deleteDepartmentDayReport',{department:dept,uid,date});modalClose();void load();
   }
   else if(action==='delete-task'){
    if(!window.confirm('Bu görev silinsin mi?'))return;
    await call('deleteDepartmentWorkTask',{department:dept,taskId:control.dataset.id});void load();
   }
   else if(action==='request-task'){
    control.disabled=true;await call('requestDepartmentTask',{department:dept,taskId:control.dataset.id});showToast('Üstlenme isteğin Core ekibine iletildi.','success');void load();
   }
   else if(action==='review-task'){
    control.disabled=true;await call('reviewDepartmentTaskRequest',{department:dept,taskId:control.dataset.id,uid:control.dataset.uid,decision:control.dataset.decision});void load();
   }
  }catch(err){warn(err);control.disabled=false;}
 });
 $('ar-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!canEdit()||busy)return;
  const form=e.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;
  try{
   if(form.dataset.type==='report')await call('saveDepartmentDayReport',{department:dept,uid:$('ar-person').value,date:$('ar-date').value,status:$('ar-status').value,summary:$('ar-summary').value,project:$('ar-project').value,next:$('ar-next').value});
   else await call('saveDepartmentWorkTask',{department:dept,taskId:form.dataset.id||undefined,title:$('ar-task-title').value,description:$('ar-task-desc').value,priority:$('ar-task-priority').value,status:$('ar-task-status').value,project:$('ar-task-project').value,assignees:[...$('ar-assignees').querySelectorAll('input:checked')].map(x=>x.value)});
   modalClose();showToast('Kaydedildi.','success');void load();
  }catch(err){warn(err);}finally{button.disabled=false;}
 });
 
 document.addEventListener('vertex:workspace',event=>{
  const keys=event.detail?.keys||[];
  if(!keys.some(k=>k.startsWith('reports.')))return;
  active=true;epoch++;mode=keys.includes('reports.tasks')?'tasks':'weekly';
 
  if(!renderHeader())return;void load();
 });
 document.addEventListener('vertex:access-changed',()=>{epoch++;active=false;dept='';roster=[];reports=[];tasks=[];requests=[];modalClose();});
}
