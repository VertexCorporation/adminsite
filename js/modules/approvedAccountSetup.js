import {auth,consolePeopleCall} from '../core/firebase.js';
import {isPanelAdmin} from './roles.js';
import {userErrorMessage,onLangChange} from '../utils/ui.js';

export function initApprovedAccountSetup(){
 const form=document.getElementById('password-reset-form');if(!form)return;
 const section=document.createElement('section');section.className='mt-4';
 const button=document.createElement('button');button.type='button';button.className='chrome-btn-outline';button.id='prepare-approved-accounts';
 const status=document.createElement('p');status.id='approved-accounts-status';status.setAttribute('role','status');
 const output=document.createElement('textarea');output.id='approved-accounts-messages';output.readOnly=true;output.rows=12;output.hidden=true;output.style.width='100%';
 output.setAttribute('aria-label','Prepared account messages — not sent');
 const label=()=>{button.textContent=document.documentElement.lang==='en'?'Prepare approved member accounts':'Onaylı üyelerin hesaplarını hazırla';};label();onLangChange(label);
 section.hidden=true;auth.onAuthStateChanged(user=>{section.hidden=user?.email?.toLowerCase()!=='mustawtfa@gmail.com';});
 section.append(button,status,output);form.after(section);
 let busy=false,requestId=null,messages=[];
 button.addEventListener('click',async()=>{
  if(busy||!auth.currentUser||!isPanelAdmin())return;
  busy=true;button.disabled=true;requestId||='approved-'+crypto.randomUUID();
  try{
   const preview=await consolePeopleCall('sendConsolePasswordResets',{prepareApproved:true,preview:true});
   const ids=preview.data.applicationIds;if(!Array.isArray(ids)||ids.length!==57)throw Error('Approved roster changed.');
   let processed=0,created=0;
   for(let at=0;at<ids.length;at+=5){
    status.textContent=(document.documentElement.lang==='en'?'Preparing accounts: ':'Hesaplar hazırlanıyor: ')+processed+'/'+ids.length;
    const {data}=await consolePeopleCall('sendConsolePasswordResets',{prepareApproved:true,applicationIds:ids.slice(at,at+5),requestId});
    processed+=(data.results||[]).length;created+=(data.results||[]).filter(row=>row.created).length;
    messages.push(...(data.messages||[]));
    output.value=messages.map(mail=>'To: '+mail.to+'\nSubject: '+mail.subject+'\n\n'+mail.text).join('\n\n-----\n\n');output.hidden=messages.length===0;
   }
   status.textContent=document.documentElement.lang==='en'
    ?processed+' accounts checked; '+created+' created. '+messages.length+' messages prepared. Email has not been sent.'
    :processed+' hesap kontrol edildi; '+created+' hesap oluşturuldu. '+messages.length+' ileti hazırlandı. Henüz posta gönderilmedi.';
  }catch(error){status.textContent=userErrorMessage(error);}
  finally{busy=false;button.disabled=false;}
 });
}
