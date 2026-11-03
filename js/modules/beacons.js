import {consolePeopleCall,auth} from '../core/firebase.js';
import {getEffectivePanelLevel} from './roles.js';
import {showToast,userErrorMessage,getLang,escapeHTML,__,onLangChange} from '../utils/ui.js';
import {confirmDialog,openDrawer} from './shell.js';
export function initBeaconsModule(){
 const host=document.getElementById('beacon-admin-list');if(!host)return;
 let cursor=null,rows=[],busy=false,generation=0,filter='all';const tr=()=>getLang()==='tr';
 const statusText=s=>__('beacons.'+s);
 const elem=(tag,text,cls='')=>{const e=document.createElement(tag);e.textContent=text;e.className=cls;return e};
 function details(row){
  let body;const paint=()=>{body.replaceChildren();const dl=elem('dl','','people-drawer-section');
   const labels={email:'E-mail',phone:__('beacons.phone'),birthDate:__('beacons.birthDate'),linkedin:'LinkedIn',github:'GitHub',institution:__('beacons.institution'),institutionType:__('beacons.type'),institutionFoundingYear:__('beacons.year'),location:__('beacons.location'),role:__('beacons.role'),website:'Website',motivation:__('beacons.motivation'),plan:__('beacons.plan'),reviewReason:__('beacons.reviewReason')};
   for(const [key,label] of Object.entries(labels))if(row[key]){dl.append(elem('dt',label),elem('dd',String(row[key])))}body.append(dl);
   if(getEffectivePanelLevel('users.beacons')==='write')for(const status of ['approved','rejected','suspended'])if(status!==row.status){const button=elem('button',__('beacons.'+({approved:'approve',rejected:'reject',suspended:'suspend'}[status])),'chrome-btn-outline');button.type='button';button.disabled=busy;button.addEventListener('click',()=>review(row,status));body.append(button)}
  };const unsubscribe=onLangChange(()=>{if(body)paint()});body=openDrawer({title:row.name,onAfterClose:unsubscribe});paint();
 }
 function render(){host.replaceChildren();const query=document.getElementById('beacon-admin-search').value.trim().toLocaleLowerCase();
 const visible=rows.filter(r=>(filter==='all'||r.status===filter)&&(!query||[r.name,r.email,r.institution].some(v=>(v||'').toLocaleLowerCase().includes(query))));
 const header=elem('div','','contributor-table-head');for(const key of ['name','institution','year','status','type','details'])header.append(elem('span',__('beacons.'+key)));host.append(header);
 const list=elem('div','','contributor-table-rows');host.append(list);
 if(!visible.length)list.append(elem('p',__('beacons.empty'),'state-block'));
 for(const row of visible){const card=elem('div','','contributor-row');const button=elem('button','','contributor-cell-name');button.type='button';button.setAttribute('aria-label',row.name+' · '+__('beacons.details'));button.append(elem('span',(row.name||'?').slice(0,1),'contributor-avatar'),elem('strong',row.name,'contributor-name'));button.addEventListener('click',()=>details(row));card.append(button,elem('span',row.institution||'—','contributor-cell-dept'),elem('span',String(row.institutionFoundingYear||'—'),'contributor-cell-age'),elem('span',statusText(row.status),'contributor-cell-status status-badge'+(row.status==='approved'?' success':'')),elem('span',row.institutionType||'—','contributor-cell-interview'));const action=elem('button',__('beacons.details'),'chrome-btn-outline');action.type='button';action.disabled=busy;action.addEventListener('click',()=>details(row));const cell=elem('span','','contributor-cell-actions');cell.append(action);card.append(cell);list.append(card);}
 document.getElementById('beacon-admin-next').hidden=!cursor;
 }
 async function load(next=false){if(busy||!auth?.currentUser||getEffectivePanelLevel('users.beacons')==='none')return;busy=true;const request=++generation;host.setAttribute('aria-busy','true');
 try{const result=await consolePeopleCall('listBeaconApplications',{limit:40,...(next&&cursor?{afterId:cursor}:{})});if(request!==generation)return;const data=result.data||result;rows=next?rows.concat(data.applications||[]):data.applications||[];cursor=data.nextCursor||null;busy=false;render();}
 catch(error){if(request!==generation)return;host.replaceChildren(elem('p',userErrorMessage(error)));showToast(()=>userErrorMessage(error),'error');}
 finally{busy=false;host.removeAttribute('aria-busy');}}
 async function review(row,status){if(busy||getEffectivePanelLevel('users.beacons')!=='write')return;
 const reason=window.prompt(tr()?'Karar gerekçesi (onay dışında zorunlu):':'Reason (required except for approval):','');if(reason===null||status!=='approved'&&!reason.trim())return;
 if(!await confirmDialog({title:tr()?'Beacon başvurusunu güncelle':'Update Beacon application',body:escapeHTML(row.name+' → '+statusText(status)),confirmLabel:tr()?'Kaydet':'Save'}))return;
 busy=true;render();try{await consolePeopleCall('reviewBeaconApplication',{applicationId:row.id,status,expectedRevision:row.revision||0,reason});showToast(tr()?'Karar kaydedildi.':'Decision saved.','success');}catch(error){showToast(()=>userErrorMessage(error),'error');}finally{busy=false;await load();}}
 document.getElementById('beacon-admin-refresh').addEventListener('click',()=>load());document.getElementById('beacon-admin-next').addEventListener('click',()=>load(true));document.getElementById('beacon-admin-search').addEventListener('input',render);document.querySelectorAll('[data-beacon-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.beaconFilter;document.querySelectorAll('[data-beacon-filter]').forEach(chip=>{chip.classList.toggle('active',chip===button);chip.setAttribute('aria-pressed',String(chip===button))});render()}));
 onLangChange(()=>{document.getElementById('beacon-admin-search').setAttribute('aria-label',__('beacons.search'));render()});
 document.addEventListener('vertex:workspace',e=>{if(e.detail?.keys?.includes('users.beacons'))load()});
 auth?.onAuthStateChanged(()=>{generation++;rows=[];cursor=null;host.replaceChildren();});
}

