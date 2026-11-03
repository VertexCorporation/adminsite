import {consolePeopleCall,auth} from '../core/firebase.js';
import {getEffectivePanelLevel} from './roles.js';
import {showToast,userErrorMessage,getLang,escapeHTML} from '../utils/ui.js';
import {confirmDialog} from './shell.js';
export function initBeaconsModule(){
 const host=document.getElementById('beacon-admin-list');if(!host)return;
 let cursor=null,rows=[],busy=false,generation=0;const tr=()=>getLang()==='tr';
 const statusText=s=>({pending:tr()?'Bekleyen':'Pending',approved:tr()?'Onaylı':'Approved',rejected:tr()?'Reddedilen':'Rejected',suspended:tr()?'Askıda':'Suspended'})[s]||s;
 const elem=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e};
 function render(){host.replaceChildren();const filter=document.getElementById('beacon-admin-filter').value,query=document.getElementById('beacon-admin-search').value.trim().toLocaleLowerCase();
 const visible=rows.filter(r=>(!filter||r.status===filter)&&(!query||[r.name,r.email,r.institution].some(v=>(v||'').toLocaleLowerCase().includes(query))));
 if(!visible.length)host.append(elem('p',tr()?'Bu sayfada eşleşen başvuru yok.':'No matching applications on this page.'));
 for(const row of visible){const card=elem('article','');card.className='people-drawer-section';const heading=elem('h3',row.name+' · '+statusText(row.status));card.append(heading);
 const details=elem('details','');details.append(elem('summary',(row.institution||'')+' · '+(row.institutionType||'')));
 const labels={email:'E-posta / Email',phone:'Telefon / Phone',birthDate:'Doğum tarihi / Birth date',linkedin:'LinkedIn',github:'GitHub',location:'Konum / Location',role:'Görev / Role',website:'Website',motivation:'Motivasyon / Motivation',plan:'90 günlük plan / 90-day plan',reviewReason:'Karar notu / Review reason'};
 const dl=elem('dl','');for(const [key,label] of Object.entries(labels))if(row[key]){dl.append(elem('dt',label),elem('dd',row[key]));}details.append(dl);card.append(details);
 for(const status of ['approved','rejected','suspended'])if(status!==row.status){const button=elem('button',status==='approved'?(tr()?'Onayla':'Approve'):status==='rejected'?(tr()?'Reddet':'Reject'):(tr()?'Askıya al':'Suspend'));button.type='button';button.className='chrome-btn-outline';button.disabled=busy;button.addEventListener('click',()=>review(row,status));card.append(button)}host.append(card);
 }
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
 document.getElementById('beacon-admin-refresh').addEventListener('click',()=>load());document.getElementById('beacon-admin-next').addEventListener('click',()=>load(true));document.getElementById('beacon-admin-search').addEventListener('input',render);document.getElementById('beacon-admin-filter').addEventListener('change',render);
 document.addEventListener('vertex:workspace',e=>{if(e.detail?.keys?.includes('users.beacons'))load()});
 auth?.onAuthStateChanged(()=>{generation++;rows=[];cursor=null;host.replaceChildren();});
}
