import { getVertexCertificateEmailTemplatesFn, saveVertexCertificateEmailTemplateFn, previewVertexCertificateEmailTemplateFn } from '../core/firebase.js';
import { escapeHTML as esc, showToast, userErrorMessage, __, getLang, onLangChange } from '../utils/ui.js';
import { openDrawer, closeDrawer, confirmDialog } from './shell.js';
import { createLoadingController, skeletonRows, setButtonLoading } from '../utils/loading.js';
import { isPanelAdmin } from './roles.js';
import { emailTemplateValidationReason } from '../utils/email-template-validation.js';
import { normalizeVerificationLinks } from '../utils/email-template-links.js';

export function openCertificateEmailTemplates() {
    if (!isPanelAdmin()) return;
    let templates=[],type='merit',language=getLang()==='tr'?'tr':'en',current,draft,dirty=false,busy=false,alive=true,timer,previewGeneration=0;
    const body=openDrawer({title:__('email_templates.title'),titleKey:'email_templates.title',footerHTML:'<div class="template-save-state" role="status" aria-live="polite"></div><button class="chrome-btn-outline" data-restore></button><button class="chrome-btn-primary" data-save></button>',onAfterClose(){alive=false;clearTimeout(timer);unsubscribe();window.removeEventListener('beforeunload',warnLeaving);}});
    const root=body.closest('.vx-drawer');root.classList.add('email-template-drawer');
    const footer=root.querySelector('.vx-drawer-footer');
    const warnLeaving=e=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warnLeaving);
    const guardedClose=async e=>{
        if(!dirty&&!busy)return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;
        if(await confirmDialog(()=>({title:__('email_templates.discard_title'),warning:__('email_templates.discard')}))){dirty=false;closeDrawer();}
    };
    root.querySelector('.drawer-close').addEventListener('click',guardedClose,true);
    root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('.vx-modal'))guardedClose(e);},true);
    root.previousElementSibling.addEventListener('mousedown',guardedClose,true);
    const loader=createLoadingController(body,{skeletonHTML:skeletonRows(5)});
    function templateErrorMessage(error){
        const known=['subject','body','placeholder','format','link'];
        const reason=error?.details?.reason;
        if(known.includes(reason))return __('email_templates.error_'+reason);
        // Support existing deployed functions while the backend rollout is pending.
        // Never display arbitrary backend diagnostics to an end user.
        const message=String(error?.message||'');
        if(error?.code==='functions/invalid-argument'){
            if(/HTTPS or mailto|HTTPS or mailto links/i.test(message))return __('email_templates.error_link');
            if(/formatting|markup/i.test(message))return __('email_templates.error_format');
            if(/placeholder/i.test(message))return __('email_templates.error_placeholder');
            if(/subject/i.test(message))return __('email_templates.error_subject');
            if(/body|email content/i.test(message))return __('email_templates.error_body');
        }
        return userErrorMessage(error);
    }
    function showValidationError(reason){
        const error=body.querySelector('.template-error'),section=body.querySelector('.template-preview');
        if(error){error.textContent=__('email_templates.error_'+reason);error.hidden=false;}
        if(section)section.hidden=true;
    }
    const selected=()=>templates.find(t=>t.certificateType===type&&t.language===language);
    function status(){
        footer.querySelector('[role=status]').textContent=__(busy?'email_templates.saving':dirty?'email_templates.unsaved':'email_templates.saved');
        const save=footer.querySelector('[data-save]');save.textContent=__('common.save');save.disabled=busy||!dirty;setButtonLoading(save,busy);
        const restore=footer.querySelector('[data-restore]');restore.textContent=__('email_templates.restore');restore.disabled=busy;
        body.querySelectorAll('select,textarea,[data-insert],[data-format]').forEach(e=>e.disabled=busy);
        body.querySelector('[contenteditable]')?.setAttribute('contenteditable',String(!busy));
        root.querySelector('.drawer-close').disabled=busy;
    }
    async function change(nextType,nextLanguage){
        if(busy)return;
        if(dirty&&!await confirmDialog(()=>({title:__('email_templates.discard_title'),warning:__('email_templates.discard')}))){paint();return;}
        type=nextType;language=nextLanguage;current=selected();draft={subject:current.subject,html:normalizeVerificationLinks(current.html)};dirty=draft.html!==current.html;paint();
    }
    function paint(){
        if(!alive||!current)return;
        const names={merit:['Liyakat','Merit'],tenacity:['Dirayet','Tenacity'],constancy:['Metanet','Constancy'],nobility:['Azamet','Nobility'],majesty:['Asalet','Majesty']};
        loader.success(`<p class="cert-notice">${__('email_templates.help')}</p><div class="template-selection"><label>${__('cert.type')}<select data-template-type>${Object.entries(names).map(([key,n])=>`<option value="${key}" ${type===key?'selected':''}>${esc(n[getLang()==='tr'?0:1])}</option>`).join('')}</select></label><label>${__('email_templates.language')}<select data-template-language><option value="tr" ${language==='tr'?'selected':''}>Türkçe</option><option value="en" ${language==='en'?'selected':''}>English</option></select></label></div><label for="template-subject">${__('email_templates.subject')}</label><textarea id="template-subject" rows="2" maxlength="500">${esc(draft.subject)}</textarea><div class="template-label"><label for="template-body">${__('email_templates.body')}</label><span>${__('email_templates.rich_text')}</span></div><div class="template-toolbar" role="toolbar" aria-label="${__('email_templates.format')}">${['bold','italic','paragraph','link','break'].map(key=>`<button type="button" class="chrome-btn-outline" data-format="${key}">${__('email_templates.'+key)}</button>`).join('')}</div><div id="template-body" class="template-rich-editor" role="textbox" aria-label="${__('email_templates.body')}" aria-multiline="true" contenteditable="true" spellcheck="true"></div><p class="form-hint">${__('email_templates.insert_help')}</p><div class="template-placeholders">${['recipientName','certificateName','contributionMonths','verificationUrl','formattedDate'].map(key=>`<button type="button" class="chrome-btn-outline" data-insert="${key}">${__('email_templates.placeholder_'+key)}</button>`).join('')}</div><p class="template-error" role="alert" hidden></p><section class="template-preview" aria-label="${__('email_templates.preview')}"><div class="template-preview-heading"><strong>${__('email_templates.preview')}</strong><small>${__('email_templates.example')}</small></div><p data-preview-subject></p><iframe title="${__('email_templates.preview')}" sandbox="" referrerpolicy="no-referrer"></iframe></section>`);
        body.querySelector('[data-template-type]').onchange=e=>change(e.target.value,language);
        body.querySelector('[data-template-language]').onchange=e=>change(type,e.target.value);
        let target=body.querySelector('#template-body'),savedRange;
        // Sources returned by the backend are allowlisted. Native paste/drop
        // cannot introduce markup or active content into the visual editor.
        const subject=body.querySelector('#template-subject'),html=body.querySelector('#template-body');
        html.innerHTML=draft.html;
        html.onpaste=e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));};
        html.ondrop=e=>e.preventDefault();
        html.onkeyup=html.onmouseup=()=>{const selection=window.getSelection();if(selection.rangeCount&&html.contains(selection.anchorNode))savedRange=selection.getRangeAt(0).cloneRange();};
        for(const field of [subject,html]){field.onfocus=()=>target=field;field.oninput=()=>{draft={subject:subject.value,html:normalizeVerificationLinks(html.innerHTML)};dirty=draft.subject!==current.subject||draft.html!==current.html;status();schedulePreview();};}
        function insert(before,after=''){
            if(target===subject){
                const start=target.selectionStart,end=target.selectionEnd;target.setRangeText(before+target.value.slice(start,end)+after,start,end,'end');target.focus();
            }else{
                html.focus();const selection=window.getSelection();if(savedRange&&html.contains(savedRange.commonAncestorContainer)){selection.removeAllRanges();selection.addRange(savedRange);}
                if(before.startsWith('<')){document.execCommand('insertHTML',false,before+esc(selection.toString())+after);}
                else document.execCommand('insertText',false,before);
                if(selection.rangeCount)savedRange=selection.getRangeAt(0).cloneRange();
            }target.oninput();
        }
        body.querySelectorAll('[data-insert],[data-format]').forEach(b=>b.onmousedown=e=>e.preventDefault());
        body.querySelectorAll('[data-insert]').forEach(b=>b.onclick=()=>insert('{{'+b.dataset.insert+'}}'));
        function linkSelectedText(){
            target=html;html.focus();
            const selection=window.getSelection();
            if(savedRange&&html.contains(savedRange.commonAncestorContainer)){
                selection.removeAllRanges();selection.addRange(savedRange);
            }
            const range=selection.rangeCount?selection.getRangeAt(0):null;
            if(!range||range.collapsed||!html.contains(range.commonAncestorContainer)||!selection.toString().trim()){
                showToast(()=>__('email_templates.select_text_to_link'),'info');
                return;
            }
            // Give execCommand a valid absolute URL, then set the stored
            // href attribute to the literal placeholder (not the DOM .href).
            const marker='https://vertexishere.com/verify/__vertex_editor_link_marker__';
            if(!document.execCommand('createLink',false,marker)){
                showToast(()=>__('email_templates.error_format'),'error');return;
            }
            let updated=false;
            for(const anchor of html.querySelectorAll('a[href]')){
                if(anchor.getAttribute('href')===marker){
                    anchor.setAttribute('href','{{verificationUrl}}');updated=true;
                }
            }
            if(!updated){showToast(()=>__('email_templates.error_format'),'error');return;}
            html.oninput();
        }
        body.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>{
            const kind=b.dataset.format;
            if(kind==='link'){linkSelectedText();return;}
            target=html;const formats={bold:['<strong>','</strong>'],italic:['<em>','</em>'],paragraph:['<p>','</p>'],break:['<br>','']};insert(...formats[kind]);
        });
        footer.querySelector('[data-save]').onclick=()=>save(false);
        footer.querySelector('[data-restore]').onclick=async()=>{
            if(await confirmDialog(()=>({title:__('email_templates.restore'),warning:__('email_templates.restore_warning')})))save(true);
        };
        status();preview();
    }
    function schedulePreview(){previewGeneration++;clearTimeout(timer);timer=setTimeout(preview,900);}
    async function preview(){
        const generation=++previewGeneration,selection=type+'_'+language;
        const error=body.querySelector('.template-error'),section=body.querySelector('.template-preview');if(!section)return;
        const validation=emailTemplateValidationReason(draft);
        if(validation){showValidationError(validation);return;}
        section.setAttribute('aria-busy','true');
        try{
            const {data}=await previewVertexCertificateEmailTemplateFn({certificateType:type,language,...draft,html:normalizeVerificationLinks(draft.html)});
            if(!alive||generation!==previewGeneration||selection!==type+'_'+language)return;
            error.hidden=true;body.querySelector('[data-preview-subject]').textContent=data.emailSubject;
            // Backend sanitization plus an inert, network-blocked sandbox: no email is sent.
            body.querySelector('iframe').srcdoc=`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{font:15px/1.6 Arial,sans-serif;color:#202124;background:#fff;margin:18px;overflow-wrap:anywhere}a{color:#245fc7}</style></head><body>${data.emailHtml}</body></html>`;
            section.hidden=false;
        }catch(e){if(alive&&generation===previewGeneration){error.textContent=templateErrorMessage(e);error.hidden=false;section.hidden=true;}}
        finally{if(alive&&generation===previewGeneration)section.removeAttribute('aria-busy');}
    }
    async function save(restoreDefaults){
        if(busy)return;
        if(!restoreDefaults){
            const validation=emailTemplateValidationReason(draft);
            if(validation){showValidationError(validation);return;}
        }
        busy=true;status();
        let saved=false;
        try{
            const {data}=await saveVertexCertificateEmailTemplateFn({certificateType:type,language,...draft,html:normalizeVerificationLinks(draft.html),expectedRevision:current.revision,restoreDefaults});
            if(!alive)return;templates[templates.indexOf(current)]=data;current=data;draft={subject:data.subject,html:data.html};dirty=false;showToast(()=>__('email_templates.save_success'),'success');
            saved=true;
            if(root.classList.contains('is-open'))closeDrawer();
        }catch(e){if(alive){const error=body.querySelector('.template-error');error.textContent=e.code==='functions/aborted'?__('email_templates.conflict'):templateErrorMessage(e);error.hidden=false;}}
        finally{busy=false;if(alive&&!saved){status();if(!dirty)paint();}}
    }
    async function load(){
        loader.start();footer.hidden=true;
        try{const {data}=await getVertexCertificateEmailTemplatesFn({});if(!alive)return;if(!Array.isArray(data?.templates))throw Object.assign(new Error('Invalid email template response'),{code:'functions/internal'});templates=data.templates;current=selected();if(!current)throw Object.assign(new Error('Requested email template is missing'),{code:'functions/not-found'});draft={subject:current.subject,html:normalizeVerificationLinks(current.html)};dirty=draft.html!==current.html;footer.hidden=false;paint();}
        catch(e){if(alive)loader.error(userErrorMessage(e),load,__('common.retry'));}
    }
    const unsubscribe=onLangChange(paint);load();
}
