import {openDrawer,closeDrawer} from './shell.js';
import {createManualVertexContributorFn,auth} from '../core/firebase.js';
import {getEffectivePanelLevel,DEPARTMENTS} from './roles.js';
import {displayDepartmentName} from '../utils/departments.js';
import {showToast,userErrorMessage,__,escapeHTML} from '../utils/ui.js';

function newRequestId(){
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    const parts=new Uint8Array(20);
    globalThis.crypto.getRandomValues(parts);
    return [...parts].map(value=>value.toString(16).padStart(2,'0')).join('');
}
const t = key => __('manual_application.'+key);
const input = (id,label,type,extra='')=>'<div class="form-group-field"><label for="manual-'+id+'">'+t(label)+'</label><input id="manual-'+id+'" name="'+id+'" type="'+type+'" '+extra+'></div>';

export function initManualApplication({onCreated}={}){
    const button=document.getElementById('add-manual-application');
    if(!button)return;
    // Applicant loading and permission resolution are separate. Update the
    // action as soon as the authenticated user's access is established, rather
    // than waiting for the contributors list to finish loading.
    const updateAccess=()=>{
        button.hidden=!auth.currentUser || getEffectivePanelLevel('contributors.list')!=='write';
    };
    updateAccess();
    document.addEventListener('vertex:departments',updateAccess);
    document.addEventListener('vertex:close-navigation',updateAccess);
    document.addEventListener('vertex:roles-updated',updateAccess);
    button.addEventListener('click',()=>{
        if(!auth.currentUser || getEffectivePanelLevel('contributors.list')!=='write')return;
        openManualApplication({onCreated});
    });
}

function openManualApplication({onCreated}){
    const now=new Date(),pad=n=>String(n).padStart(2,'0');
    const localNow=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const localToday=localNow.slice(0,10);
    const options=DEPARTMENTS.filter(d=>!['Core','Senatus'].includes(d.id)).map(d=>
        '<option value="'+escapeHTML(d.id.toLowerCase())+'">'+escapeHTML(displayDepartmentName(d.id))+'</option>'
    ).join('');
    const body=openDrawer({
        title:t('title'),
        footerHTML:'<button type="submit" form="manual-application-form" class="chrome-btn-primary" id="manual-application-save">'+t('save')+'</button><button type="button" class="chrome-btn-outline" id="manual-application-cancel">'+t('cancel')+'</button>'
    });
    const drawer=body.closest('.vx-drawer');
    const requestId=newRequestId();
    body.innerHTML=
        '<form id="manual-application-form" class="contributor-edit-form form-stack">'+
            '<p class="manual-application-note">'+t('description')+'</p>'+
            '<div class="contributor-edit-grid">'+
                input('name','name','text','autocomplete="name" minlength="3" maxlength="128" required')+
                input('email','email','email','autocomplete="email" maxlength="254" required')+
                input('phone','phone','tel','autocomplete="tel" maxlength="40" required')+
                input('birthDate','birth_date','date','max="'+localToday+'" required')+
                '<div class="form-group-field"><label for="manual-department">'+t('department')+'</label><select id="manual-department" name="department" required><option value="">'+t('select_department')+'</option>'+options+'</select></div>'+
                input('applicationDate','application_date','datetime-local','value="'+localNow+'"')+
                input('interviewDate','interview_date','datetime-local','value="'+localNow+'"')+
                input('linkedin','linkedin','url','maxlength="2000" placeholder="https://"')+
                input('github','github','url','maxlength="2000" placeholder="https://"')+
                '<div class="form-group-field"><label for="manual-about">'+t('about')+'</label><textarea id="manual-about" name="about" rows="4" maxlength="10000"></textarea></div>'+
            '</div>'+

            '<p class="manual-application-error" id="manual-application-error" role="alert" hidden></p>'+
        '</form>';
    const form=body.querySelector('#manual-application-form'),save=drawer.querySelector('#manual-application-save');
    drawer.querySelector('#manual-application-cancel').addEventListener('click',()=>closeDrawer());
    form.querySelector('#manual-name').focus({preventScroll:true});
    form.addEventListener('submit',async event=>{
        event.preventDefault();
        if(!form.reportValidity() || save.disabled)return;
        const values=Object.fromEntries(new FormData(form).entries());
        if(values.name.trim().split(/\s+/).length<2){
            const field=form.querySelector('#manual-name');
            field.setCustomValidity(t('full_name_required'));field.reportValidity();
            field.addEventListener('input',()=>field.setCustomValidity(''),{once:true});
            return;
        }
        if(!/^\+?[\d\s().-]{7,40}$/.test(values.phone.trim()) || values.phone.replace(/\D/g,'').length<7){
            const field=form.querySelector('#manual-phone');
            field.setCustomValidity(t('phone_invalid'));field.reportValidity();
            field.addEventListener('input',()=>field.setCustomValidity(''),{once:true});
            return;
        }
        save.disabled=true;save.setAttribute('aria-busy','true');
        const errorBox=form.querySelector('#manual-application-error');
        errorBox.hidden=true;
        try{
            const payload={
                requestId,
                ...values,
                name:values.name.trim(),email:values.email.trim(),phone:values.phone.trim(),
                applicationDate:values.applicationDate?new Date(values.applicationDate).toISOString():'',
                interviewDate:values.interviewDate?new Date(values.interviewDate).toISOString():''
            };
            const result=await createManualVertexContributorFn(payload);
            if(result.data?.success!==true || !result.data?.id)throw new Error(t('save_not_confirmed'));
            closeDrawer();
            showToast(()=>t(result.data.existing?'already_saved':'saved'),'success');
            await onCreated?.();
        }catch(error){
            console.error('[APPLICATION] Manual application failed',{code:error.code||'unknown',httpStatus:error.httpStatus||null});
            errorBox.textContent=error.code==='functions/already-exists'?t('duplicate'):userErrorMessage(error);
            errorBox.hidden=false;
            showToast(()=>errorBox.textContent,'error');
        }finally{
            if(drawer.isConnected){save.disabled=false;save.removeAttribute('aria-busy');}
        }
    });
}
