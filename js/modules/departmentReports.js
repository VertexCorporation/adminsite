// Embedded department reporting workspace for Vertex Konsol.
import { consolePeopleCall, auth } from '../core/firebase.js';
import { getCurrentUserAccess } from './roles.js';
import { escapeHTML, showToast, userErrorMessage } from '../utils/ui.js';

const departments=['Core','Senatus','Tensor','Curia','Pulse','Chroma','Catalyst','Envoy','Aero','Array'];
const days=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const labels={urgent:'Acil',normal:'Normal',low:'Acil değil',todo:'Tamamlanmadı',doing:'Devam ediyor',done:'Tamamlandı'};
const el=id=>document.getElementById(id);
const clean=v=>escapeHTML(String(v??''));
const api=async(name,data)=>(await consolePeopleCall(name,data)).data;
const access=()=>getCurrentUserAccess();
const core=()=>Boolean(access()?.isCore);
const permitted=()=>core()?departments:departments.filter(d=>(access()?.departments||[]).includes(d));
const monday=date=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const add=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const displayDate=date=>new Date(date+'T12:00:00Z').toLocaleDateString('tr-TR',{day:'numeric',month:'short'});
const state={active:false,mode:'weekly',department:'',week:monday(new Date().toISOString().slice(0,10)),roster:[],reports:[],tasks:[],requests:[],loading:false,token:0};
const nameOf=id=>state.roster.find(r=>r.uid===id)?.name||'Üye';
const button=(name,action,extra='')=>'<button type="button" class="ar-secondary" data-ar-action="'+action+'" '+extra+'>'+name+'</button>';
function header(){
  const options=permitted();
  const target=el('tab-reports');
  if(!target)return false;
  if(!options.length){el('ar-workspace').textContent='Aktif departman üyeliği bulunamadı.';return false;}
  if(!options.includes(state.department))state.department=options.includes('Array')?'Array':options[0];
  target.dataset.arDepartment=state.department.toLowerCase();
  el('ar-department').innerHTML=options.map(d=>'<option value="'+clean(d)+'">'+clean(d)+'</option>').join('');
  el('ar-department').value=state.department;
  el('ar-current-department').textContent=state.department;
  el('ar-member-counter').textContent=state.roster.length+' üye';
  el('ar-week-display').textContent=displayDate(state.week)+' – '+displayDate(add(state.week,5));
  el('ar-create').hidden=!core();
  el('ar-create').textContent=state.mode==='weekly'?'Rapor ekle':'Görev oluştur';
  el('ar-summary-btn').hidden=state.mode!=='weekly';
  target.querySelectorAll('[data-ar-week]').forEach(x=>x.hidden=state.mode!=='weekly');
  return true;
}
const notify=e=>showToast(()=>userErrorMessage(e),'error');
async function load(refresh=false){
  if(!state.active||state.loading)return;
  state.loading=true;
  const token=++state.token;
  el('ar-workspace').innerHTML='<div class="ar-empty">Yükleniyor…</div>';
  try{
    if(refresh||!state.roster.length){
      const r=await api('listDepartmentReportRoster',{department:state.department});
      if(token!==state.token)return;
      state.roster=(r.users||[]).sort((a,b)=>a.name.localeCompare(b.name,'tr'));
    }
    if(state.mode==='weekly'){
      const r=await api('listDepartmentWeekReports',{department:state.department,weekStart:state.week});
      state.reports=r.reports||[];
    }else{
      const r=await api('listDepartmentWorkTasks',{department:state.department});
      state.tasks=r.tasks||[];state.requests=r.requests||[];
    }
    if(token===state.token){header();render();}
  }catch(error){if(token===state.token){notify(error);el('ar-workspace').textContent='Veriler alınamadı. Fulcrum fonksiyonlarını kontrol edin.';}}
  finally{state.loading=false;}
}
function render(){
  if(state.mode==='weekly')renderWeekly();else renderTasks();
}
function renderWeekly(){
  const dates=days.map((_,i)=>add(state.week,i));
  const rows=state.roster.map(p=>{
    const cells=dates.map(date=>{
      const r=state.reports.find(x=>x.uid===p.uid&&x.date===date);
      const content=r?'<strong class="ar-report-status">'+(r.status==='no-report'?'Rapor yok':'Raporlandı')+'</strong>'+(r.project?'<small class="ar-project">'+clean(r.project)+'</small>':'')+'<p>'+clean(r.summary)+'</p>'+(r.next?'<small>'+clean(r.next)+'</small>':''):'<span class="ar-pending">Kayıt bulunmuyor</span>';
      const edit=core()?button(r?'Düzenle':'Ekle','edit-report','data-uid="'+clean(p.uid)+'" data-date="'+date+'"'):'';
      return '<td><div class="ar-day-entry">'+content+edit+'</div></td>';
    }).join('');
    return '<tr><th scope="row" class="ar-person">'+clean(p.name)+'</th>'+cells+'</tr>';
  }).join('');
  el('ar-workspace').innerHTML='<p class="ar-info">'+state.roster.length+' üye · '+state.reports.length+' kayıt. Kayıt yokluğu devamsızlık kanıtı değildir.</p><div class="ar-table-scroll"><table class="ar-table"><thead><tr><th class="ar-person-head">Kişi</th>'+days.map((d,i)=>'<th>'+d+'<small>'+displayDate(dates[i])+'</small></th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function renderTasks(){
  el('ar-workspace').innerHTML='<div class="ar-task-toolbar"><label>Durum<select id="ar-task-filter"><option value="all">Tümü</option><option value="todo">Tamamlanmadı</option><option value="doing">Devam ediyor</option><option value="done">Tamamlandı</option></select></label><label>Öncelik<select id="ar-priority-filter"><option value="all">Tümü</option><option value="urgent">Acil</option><option value="normal">Normal</option><option value="low">Acil değil</option></select></label></div><div id="ar-task-list"></div>';
  drawTasks();
}
function drawTasks(){
  const status=el('ar-task-filter')?.value||'all',priority=el('ar-priority-filter')?.value||'all';
  const selected=state.tasks.filter(t=>(status==='all'||t.status===status)&&(priority==='all'||t.priority===priority));
  el('ar-task-list').innerHTML=selected.map(t=>{
    const assignees=t.assignees||[];
    const pending=state.requests.filter(r=>r.taskId===t.id&&r.status==='pending');
    const mine=state.requests.find(r=>r.taskId===t.id&&r.uid===auth?.currentUser?.uid);
    let actions='';
    if(core())actions=button('Düzenle','edit-task','data-id="'+clean(t.id)+'"')+button('Sil','delete-task','data-id="'+clean(t.id)+'"');
    else if(t.status!=='done'&&!assignees.includes(auth?.currentUser?.uid)&&mine?.status!=='pending')actions=button('Bu görevi almak istiyorum','request-task','data-id="'+clean(t.id)+'"');
    else if(mine?.status==='pending')actions='İstek bekliyor';
    const reviews=core()?pending.map(r=>'<div>'+clean(nameOf(r.uid))+' '+button('Onayla','review','data-id="'+clean(t.id)+'" data-uid="'+clean(r.uid)+'" data-decision="approved"')+' '+button('Reddet','review','data-id="'+clean(t.id)+'" data-uid="'+clean(r.uid)+'" data-decision="rejected"')+'</div>').join(''):'';
    return '<article class="ar-task-card"><div class="ar-task-heading"><h3>'+clean(t.title)+'</h3><span class="ar-pill">'+clean(labels[t.priority]||'Normal')+' · '+clean(labels[t.status]||'Tamamlanmadı')+'</span></div><p>'+clean(t.description||'')+'</p><div class="ar-task-footer"><span>'+clean(t.project||state.department)+'</span><span>'+clean(assignees.map(nameOf).join(' · ')||'Henüz kimse atanmadı')+'</span></div><div class="ar-task-actions">'+actions+'</div>'+(reviews?'<div class="ar-requests"><b>Görev istekleri</b>'+reviews+'</div>':'')+'</article>';
  }).join('')||'<div class="ar-empty">Bu filtreye uygun görev bulunamadı.</div>';
}
function modalClose(){el('ar-modal').hidden=true;}
function edit(type,model={}){
  if(!core())return;
  el('ar-modal-title').textContent=type==='report'?'Günlük rapor':'Görev';
  el('ar-report-fields').hidden=type!=='report';el('ar-task-fields').hidden=type!=='task';
  for(const id of ['ar-report-fields','ar-task-fields'])el(id).querySelectorAll('input,select,textarea').forEach(x=>x.disabled=(id==='ar-report-fields')!==(type==='report'));
  const form=el('ar-form');form.reset();form.dataset.type=type;form.dataset.id=model.id||'';
  if(type==='report'){
    el('ar-person').innerHTML=state.roster.map(x=>'<option value="'+clean(x.uid)+'">'+clean(x.name)+'</option>').join('');
    el('ar-person').value=model.uid||state.roster[0]?.uid||'';
    el('ar-date').value=model.date||state.week;
    el('ar-status').value=model.status||'reported';
    el('ar-project').value=model.project||'';el('ar-summary').value=model.summary||'';el('ar-next').value=model.next||'';
    el('ar-delete-report').hidden=!model.id;
  }else{
    el('ar-task-title').value=model.title||'';el('ar-task-desc').value=model.description||'';
    el('ar-task-priority').value=model.priority||'normal';el('ar-task-status').value=model.status||'todo';
    el('ar-task-project').value=model.project||'';
    el('ar-assignees').innerHTML=state.roster.map(p=>'<label class="ar-check"><input type="checkbox" value="'+clean(p.uid)+'" '+((model.assignees||[]).includes(p.uid)?'checked':'')+'>'+clean(p.name)+'</label>').join('');
    el('ar-delete-report').hidden=true;
  }
  el('ar-modal').hidden=false;
}
function exportWeek(){
  const lines=[state.department+' Haftalık Rapor ('+state.week+')',''];
  for(const p of state.roster){
    lines.push(p.name);
    days.forEach((d,i)=>{const x=state.reports.find(r=>r.uid===p.uid&&r.date===add(state.week,i));lines.push(d+': '+(x?x.summary+(x.next?' | Sonraki adım: '+x.next:''):'Kayıt bulunmuyor'));});
    lines.push('');
  }
  lines.push('Kayıt olmaması çalışılmadığı anlamına gelmez.');
  const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rapor-'+state.department.toLowerCase()+'-'+state.week+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
export function initDepartmentReports(){
  if(!el('tab-reports'))return;
  el('tab-reports').addEventListener('change',event=>{
    if(event.target.id==='ar-department'){
      state.token++;state.department=event.target.value;state.roster=[];state.reports=[];state.tasks=[];state.requests=[];header();void load(true);
    }
    if(['ar-task-filter','ar-priority-filter'].includes(event.target.id))drawTasks();
  });
  el('tab-reports').addEventListener('click',async event=>{
    const b=event.target.closest('[data-ar-action]');if(!b)return;
    const action=b.dataset.arAction;
    try{
      if(['previous','next'].includes(action)){state.week=add(state.week,action==='next'?7:-7);header();void load();}
      else if(action==='refresh')void load(true);
      else if(action==='summary')exportWeek();
      else if(action==='create')edit(state.mode==='weekly'?'report':'task');
      else if(action==='cancel')modalClose();
      else if(action==='edit-report'){const r=state.reports.find(x=>x.uid===b.dataset.uid&&x.date===b.dataset.date);edit('report',{...r,uid:b.dataset.uid,date:b.dataset.date});}
      else if(action==='edit-task')edit('task',state.tasks.find(x=>x.id===b.dataset.id));
      else if(action==='delete-report'){
        if(!confirm('Rapor silinsin mi?'))return;
        await api('deleteDepartmentDayReport',{department:state.department,uid:el('ar-person').value,date:el('ar-date').value});modalClose();void load();
      }else if(action==='delete-task'){
        if(!confirm('Görev silinsin mi?'))return;
        await api('deleteDepartmentWorkTask',{department:state.department,taskId:b.dataset.id});void load();
      }else if(action==='request-task'){
        b.disabled=true;await api('requestDepartmentTask',{department:state.department,taskId:b.dataset.id});showToast('İstek Core ekibine iletildi.','success');void load();
      }else if(action==='review'){
        b.disabled=true;await api('reviewDepartmentTaskRequest',{department:state.department,taskId:b.dataset.id,uid:b.dataset.uid,decision:b.dataset.decision});void load();
      }
    }catch(error){notify(error);b.disabled=false;}
  });
  el('ar-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!core())return;
    const form=event.currentTarget,submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try{
      if(form.dataset.type==='report')await api('saveDepartmentDayReport',{department:state.department,uid:el('ar-person').value,date:el('ar-date').value,status:el('ar-status').value,summary:el('ar-summary').value,project:el('ar-project').value,next:el('ar-next').value});
      else await api('saveDepartmentWorkTask',{department:state.department,taskId:form.dataset.id||undefined,title:el('ar-task-title').value,description:el('ar-task-desc').value,priority:el('ar-task-priority').value,status:el('ar-task-status').value,project:el('ar-task-project').value,assignees:[...el('ar-assignees').querySelectorAll('input:checked')].map(x=>x.value)});
      modalClose();showToast('Kaydedildi.','success');void load();
    }catch(error){notify(error);}finally{submit.disabled=false;}
  });
  document.addEventListener('vertex:workspace',event=>{
    const keys=event.detail?.keys||[];if(!keys.some(k=>k.startsWith('reports.')))return;
    state.active=true;state.token++;state.mode=keys.includes('reports.tasks')?'tasks':'weekly';
    if(header())void load(true);
  });
  document.addEventListener('vertex:access-changed',()=>{state.active=false;state.token++;state.roster=[];state.reports=[];state.tasks=[];state.requests=[];modalClose();});
}
