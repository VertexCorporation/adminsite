import { auth,consolePeopleCall } from '../core/firebase.js';
import { isPanelAdmin } from './roles.js';
import { __,escapeHTML as esc,userErrorMessage,showToast } from '../utils/ui.js';
import { confirmDialog } from './shell.js';
export function mountAccountLoginAliases(host,uid){
 const actor=auth.currentUser?.uid;
 const current=()=>host.isConnected&&auth.currentUser?.uid===actor&&isPanelAdmin();
 host.innerHTML=`<h3>${esc(__('loginAliases.title'))}</h3><p class="form-hint">${esc(__('loginAliases.hint'))}</p><div data-alias-list></div><button type="button" class="chrome-btn-outline" data-alias-more hidden>${esc(__('loginAliases.more'))}</button><form data-alias-form><label>${esc(__('loginAliases.email'))}<input type="email" name="email" autocomplete="off" required maxlength="254"></label><button type="submit" class="chrome-btn-outline">${esc(__('loginAliases.add'))}</button></form><p role="status" data-alias-status></p>`;
 const list=host.querySelector('[data-alias-list]'),more=host.querySelector('[data-alias-more]'),form=host.querySelector('[data-alias-form]'),status=host.querySelector('[data-alias-status]');
 let after=null,busy=false;
 async function load(reset=false){
  if(!current()||busy)return;busy=true;more.disabled=true;
  try{
   const {data}=await consolePeopleCall('listAccountLoginAliases',{uid,...(!reset&&after?{after}: {})});if(!current())return;
   if(reset)list.replaceChildren();
   for(const alias of data.aliases||[]){
    if(alias.state!=='active')continue;
    const row=document.createElement('div');row.className='catalog-actions';
    const label=document.createElement('span');label.textContent=alias.email;row.append(label);
    const button=document.createElement('button');button.type='button';button.className='chrome-btn-outline';button.textContent=__('loginAliases.remove');
    button.onclick=async()=>{
     if(!current()||busy)return;
     if(!await confirmDialog(()=>({title:__('loginAliases.remove'),body:__('loginAliases.remove_confirm'),rows:[{label:__('people.email'),value:esc(alias.email)}],danger:true})))return;
     if(!current()||busy)return;await change(alias.email,false);
    };row.append(button);list.append(row);
   }
   after=data.nextCursor||null;more.hidden=!after;status.textContent='';
  }catch(error){if(current())status.textContent=userErrorMessage(error);}
  finally{busy=false;if(current())more.disabled=false;}
 }
 async function change(email,enabled){
  if(!current()||busy)return;busy=true;const button=form.querySelector('button');button.disabled=true;
  try{
   await consolePeopleCall('manageAccountLoginAlias',{uid,email,enabled});if(!current())return;
   if(enabled)form.reset();showToast(()=>__('catalog.saved'),'success');busy=false;await load(true);
  }catch(error){if(current())status.textContent=userErrorMessage(error);}
  finally{busy=false;if(current())button.disabled=false;}
 }
 form.onsubmit=async event=>{
  event.preventDefault();const email=form.elements.email.value.trim();if(!email||!current()||busy)return;
  if(!await confirmDialog(()=>({title:__('loginAliases.add'),body:__('loginAliases.add_confirm'),rows:[{label:__('people.email'),value:esc(email)}]})))return;
  await change(email,true);
 };
 more.onclick=()=>load();void load(true);
}
