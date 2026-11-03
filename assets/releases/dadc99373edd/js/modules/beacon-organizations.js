import {consolePeopleCall,auth} from '../core/firebase.js';
import {getEffectivePanelLevel} from './roles.js';
import {__,onLangChange,showToast,userErrorMessage} from '../utils/ui.js';
export function initBeaconOrganizations(){
 const host=document.getElementById('beacon-organizations-list');if(!host)return;
 let rows=[],generation=0,pending=new Set();
 const el=(tag,text,cls='')=>{const node=document.createElement(tag);node.textContent=text;node.className=cls;return node};
 function render(){host.replaceChildren();if(!rows.length)host.append(el('p',__('beacons.org_empty'),'state-block'));
  for(const row of rows){const card=el('div','','contributor-row');card.style.gridTemplateColumns='minmax(0,1fr) auto';const identity=el('div','','contributor-cell-name');if(row.logoUrl){const image=document.createElement('img');image.src=row.logoUrl;image.alt=row.name;image.width=64;image.height=40;image.style.objectFit='contain';identity.append(image);}identity.append(el('strong',row.name,'contributor-name'));card.append(identity);
   const tools=el('div','','contributor-cell-actions');if(getEffectivePanelLevel('users.beacons')==='write'){const button=el('button',pending.has(row.id)?__('beacons.org_uploading'):row.logoUrl?__('beacons.org_replace'):__('beacons.org_add'),'chrome-btn-outline');button.type='button';button.disabled=pending.has(row.id);const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.hidden=true;input.setAttribute('aria-label',row.name+' · '+__('beacons.org_add'));button.addEventListener('click',()=>input.click());input.addEventListener('change',()=>{if(input.files?.[0])upload(row,input.files[0]);});tools.append(button,input);}card.append(tools);host.append(card);}
 }
 async function load(){if(!auth.currentUser||getEffectivePanelLevel('users.beacons')==='none')return;const version=++generation;host.setAttribute('aria-busy','true');try{const result=await consolePeopleCall('listBeaconOrganizations',{});if(version!==generation)return;rows=(result.data||result).organizations||[];render();}catch(error){if(version===generation)host.replaceChildren(el('p',userErrorMessage(error),'state-block'));}finally{if(version===generation)host.removeAttribute('aria-busy');}}
 async function upload(row,file){if(pending.has(row.id)||getEffectivePanelLevel('users.beacons')!=='write')return;const version=generation;pending.add(row.id);render();try{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error(__('beacons.org_image_error'));
   const image=await createImageBitmap(file);let blob;try{const scale=Math.min(1,1024/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));}finally{image.close();}
   if(!blob||blob.size>2*1024*1024)throw Error(__('beacons.org_image_error'));
   const imageData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error(__('beacons.org_image_error')));reader.readAsDataURL(blob);});
   if(version!==generation||!auth.currentUser)return;
   await consolePeopleCall('setBeaconOrganizationImage',{organizationId:row.id,imageData,contentType:blob.type});showToast(__('beacons.org_saved'),'success');await load();
  }catch(error){showToast(()=>userErrorMessage(error),'error');}finally{pending.delete(row.id);render();}}
 document.getElementById('beacon-admin-refresh')?.addEventListener('click',load);
 document.addEventListener('vertex:workspace',event=>{if(event.detail?.keys?.includes('users.beacons'))load();});document.addEventListener('vertex:beacons-updated',load);onLangChange(render);auth.onAuthStateChanged(()=>{generation++;rows=[];pending.clear();host.replaceChildren();});
}
