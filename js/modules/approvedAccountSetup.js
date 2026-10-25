import {auth,consolePeopleCall} from '../core/firebase.js';
import {isPanelAdmin} from './roles.js';
import {userErrorMessage,onLangChange} from '../utils/ui.js';

export function initApprovedAccountSetup(){
 const form=document.getElementById('password-reset-form');if(!form)return;
 const section=document.createElement('section');section.className='mt-4';
 const button=document.createElement('button');button.type='button';button.className='chrome-btn-outline';button.id='prepare-approved-accounts';
 const status=document.createElement('p');status.id='approved-accounts-status';status.setAttribute('role','status');
 const hint=document.createElement('p');
 const output=document.createElement('textarea');output.id='approved-accounts-messages';output.readOnly=true;output.rows=12;output.hidden=true;output.style.width='100%';
 output.setAttribute('aria-label','Prepared account messages — not sent');
 const label=()=>{const en=document.documentElement.lang==='en';button.textContent=en?'Prepare approved member accounts':'Onaylı üyelerin hesaplarını hazırla';hint.textContent=en?'Enter approved member emails above to prepare only those accounts. Leave empty for the full approved roster.':'Yalnızca belirli onaylı üyelerin hesaplarını hazırlamak için yukarıya e-postalarını girin. Onaylı listenin tamamı için boş bırakın.';};label();onLangChange(label);
 section.hidden=true;auth.onAuthStateChanged(user=>{section.hidden=user?.email?.toLowerCase()!=='mustawtfa@gmail.com';});
 section.append(hint,button,status,output);form.after(section);
 let busy=false,requestId=null,messages=[];
 const permissionsButton=document.createElement('button');permissionsButton.type='button';permissionsButton.className='chrome-btn-outline';
 const permissionsStatus=document.createElement('p');permissionsStatus.id='approved-permissions-status';permissionsStatus.setAttribute('role','status');
 const permissionOutput=document.createElement('textarea');permissionOutput.readOnly=true;permissionOutput.hidden=true;permissionOutput.rows=12;permissionOutput.style.width='100%';permissionOutput.setAttribute('aria-label','Approved permission results');
 const permissionLabel=()=>{permissionsButton.textContent=document.documentElement.lang==='en'?'Apply approved console permissions':'Onaylı konsol izinlerini uygula';};permissionLabel();onLangChange(permissionLabel);
 section.append(permissionsButton,permissionsStatus,permissionOutput);
 let permissionResults=[];
 permissionsButton.addEventListener('click',async()=>{
  if(busy||!auth.currentUser||!isPanelAdmin())return;
  busy=true;permissionsButton.disabled=true;button.disabled=true;permissionResults=[];
  const show=()=>{permissionOutput.value=JSON.stringify(permissionResults,null,2);permissionOutput.hidden=permissionResults.length===0;};show();
  try{
   permissionsStatus.textContent='Checking approved permissions…';
   const preview=await consolePeopleCall('sendConsolePasswordResets',{applyApprovedPermissions:true,preview:true});
   const ids=preview.data.applicationIds;if(!Array.isArray(ids)||ids.length!==58||preview.data.chiefs!==9||preview.data.moderators!==10)throw Error('Approved permission roster changed.');
   for(const id of ids){
    permissionsStatus.textContent='Applying approved permissions: '+permissionResults.length+'/'+ids.length;
    const {data}=await consolePeopleCall('sendConsolePasswordResets',{applyApprovedPermissions:true,provisionLinkedAccounts:true,applicationIds:[id]});
    if(!Array.isArray(data.results)||data.results.length!==1)throw Error('Permission result needs review.');
    permissionResults.push(...data.results);show();
   }
   const ready=permissionResults.filter(r=>r.ready).length,corporate=permissionResults.filter(r=>r.corporateUid&&r.corporateUid!==r.uid).length;
   permissionsStatus.textContent=document.documentElement.lang==='en'
    ?permissionResults.length+' members assigned. Chiefs: 9. Moderators: 10. Primary accounts ready: '+ready+'. Accounts needing review: '+(permissionResults.length-ready)+'. Additional corporate accounts ready: '+corporate+'.'
    :permissionResults.length+' üyeye izin atandı. Şef: 9. Moderatör: 10. Erişimi hazır ana hesap: '+ready+'. İnceleme gereken hesap: '+(permissionResults.length-ready)+'. Ek kurumsal hesap: '+corporate+'.';
  }catch(error){console.error('[APPROVED_PERMISSIONS]',error.code||'client-error');permissionsStatus.textContent=permissionResults.length+'/58 completed. '+userErrorMessage(error)+(error.code?' ('+error.code+')':' '+String(error.message||'').slice(0,160));}
  finally{busy=false;permissionsButton.disabled=false;button.disabled=false;}
 });
 button.addEventListener('click',async()=>{
  if(busy||!auth.currentUser||!isPanelAdmin())return;
  busy=true;button.disabled=true;requestId||='approved-'+crypto.randomUUID();
  try{
   status.textContent=document.documentElement.lang==='en'?'Checking approved roster…':'Onaylı üye listesi kontrol ediliyor…';
   const emails=document.getElementById('password-reset-emails')?.value.trim()||'';
   const preview=await consolePeopleCall('sendConsolePasswordResets',{prepareApproved:true,preview:true,...(emails?{emails}:{})});
   const ids=preview.data.applicationIds;
   if(emails&&preview.data.filtered!==true)throw Error('Selected account preparation requires the updated server.');
   if(!Array.isArray(ids)||!ids.length||ids.length>200||preview.data.total!==ids.length)throw Error('Approved roster changed ('+(Array.isArray(ids)?ids.length:'missing')+').');
   let processed=0,created=0;
   for(let at=0;at<ids.length;at+=1){
    status.textContent=(document.documentElement.lang==='en'?'Preparing accounts: ':'Hesaplar hazırlanıyor: ')+processed+'/'+ids.length;
    const {data}=await consolePeopleCall('sendConsolePasswordResets',{prepareApproved:true,applicationIds:ids.slice(at,at+1),requestId});
    processed+=(data.results||[]).length;created+=(data.results||[]).filter(row=>row.created).length;
    messages.push(...(data.messages||[]));
    output.value=messages.map(mail=>'To: '+mail.to+'\nSubject: '+mail.subject+'\n\n'+mail.text).join('\n\n-----\n\n');output.hidden=messages.length===0;
   }
   status.textContent=document.documentElement.lang==='en'
    ?processed+' accounts checked; '+created+' created. '+messages.length+' messages prepared. Email has not been sent.'
    :processed+' hesap kontrol edildi; '+created+' hesap oluşturuldu. '+messages.length+' ileti hazırlandı. Henüz posta gönderilmedi.';
  }catch(error){console.error('[APPROVED_ACCOUNT_SETUP]',error.code||'client-error',error.name||'Error',error.code?'':String(error.message||'').slice(0,160));status.textContent=userErrorMessage(error)+(error.code?' ('+error.code+')':' '+String(error.message||'').slice(0,160));}
  finally{busy=false;button.disabled=false;}
 });
}
