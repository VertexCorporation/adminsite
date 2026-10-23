import { certificateAccepted, certificateInFlight, watchCertificateDelivery } from './certificateDelivery.js';
import { openCertificateEmailTemplates } from './certificateEmailTemplates.js';
import { auth, setVertexContributorJoiningDateFn, issueVertexCertificateFn, getVertexCertificateDetailsFn, revokeVertexCertificateFn } from '../core/firebase.js';
import { escapeHTML as esc, showToast, userErrorMessage, __, getLang, onLangChange } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
import { openDrawer, confirmDialog } from './shell.js';
import { createLoadingController, skeletonRows, skeletonCertificate, setButtonLoading } from '../utils/loading.js';
import { isPanelAdmin } from './roles.js';
const awards = [{type:'merit',days:7,icon:'award',tr:'Liyakat',en:'Merit'},{type:'tenacity',months:1,icon:'award',tr:'Dirayet',en:'Tenacity'},{type:'constancy',months:3,icon:'shield',tr:'Metanet',en:'Constancy'},{type:'nobility',months:6,icon:'diamond',tr:'Azamet',en:'Nobility'},{type:'majesty',months:12,icon:'crown',tr:'Asalet',en:'Majesty'}];
const pending = new Set();
const unresolved = new Set();
const deliveryWatchers = new Map();
function monitorDelivery(person, data) {
    const key=person.id, viewerUid=auth.currentUser?.uid;
    deliveryWatchers.get(key)?.stop();
    deliveryWatchers.delete(key);
    if(!viewerUid)return;
    const watcher=watchCertificateDelivery({keepWatching:true,
        read:async()=>(await getVertexCertificateDetailsFn({contributorId:key})).data,
        currentUser:()=>auth.currentUser?.uid,viewerUid,
        update:next=>{
            if(next===data)return; // Initial state is already rendered; avoid a duplicate transition.
            document.dispatchEvent(new CustomEvent('vertex:certificate-status',{detail:{contributorId:key,data:next}}));

        },
        failure:job=>showToast(()=>`${typeName(job.certificateType)}: ${statusName(job.status)}`,'error')
    });
    deliveryWatchers.set(key,watcher);watcher.start(data);
}
export function formatCertificateDate(value) {
    if (!value) return __('cert.unknown');
    const stamp = value._seconds ?? value.seconds;
    const date = stamp !== undefined ? new Date(stamp * 1000) : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value+'T12:00:00Z' : value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(getLang()==='tr'?'tr-TR':'en-GB',{timeZone:'UTC'});
}
function dateValue(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0,10);
    return new Date((value._seconds ?? value.seconds)*1000).toISOString().slice(0,10);
}
function typeName(type, types) { return types?.[type]?.[getLang()] || awards.find(a=>a.type===type)?.[getLang()] || __('cert.status_unknown'); }
function statusName(status) { if(status==='succeeded')return __('cert.success');if(status==='submitted')return __('cert.submitted');if(status==='pending')return __('cert.processing');return ['processing','failed','revoked','delivered'].includes(status) ? __('cert.'+status) : status==='uncertain' ? __('cert.status_uncertain') : __('cert.status_unknown'); }

export function openCertificates(person, refresh, anchor = document.activeElement, options = {}) {
    if (!isPanelAdmin() || !person) return;
    let details, selected, generation = 0, alive = true, unsubscribe, paintHistory;
    const onDelivery=event=>{if(event.detail.contributorId!==person.id)return;details=event.detail.data;if(!historyOpen)render();else paintHistory?.();};
    document.addEventListener('vertex:certificate-status',onDelivery);
    const dispose=()=>{deliveryWatchers.get(person.id)?.stop();deliveryWatchers.delete(person.id);alive=false;generation++;unsubscribe?.();document.removeEventListener('vertex:certificate-status',onDelivery);};
    const pop=options.body || openDrawer({title:__('cert.title'),onAfterClose:dispose});
    options.onDispose?.(dispose);
    const root=pop.closest('.vx-drawer');root.classList.add('certificate-drawer');
    let footer=root.querySelector('.vx-drawer-footer');
    if(!footer){footer=document.createElement('div');footer.className='vx-drawer-footer';root.append(footer);}
    const setTitle=key=>{root.querySelector('.vx-drawer-title').textContent=__(key);root.setAttribute('aria-label',__(key));};
    const back=(callback)=>{root.querySelector('[data-cert-back]')?.remove();if(!callback)return;const b=document.createElement('button');b.className='icon-action-btn';b.dataset.certBack='';b.innerHTML=icon('chevron-left');b.setAttribute('aria-label',__('common.back'));b.onclick=callback;root.querySelector('.vx-drawer-header').prepend(b);};
    const loader = createLoadingController(pop,{skeletonHTML:skeletonRows(4,skeletonCertificate)});
    const eligibilityText = () => details.eligibility?.status === 'configured' ? (details.eligibility.eligibleTypes || []).map(t=>typeName(t,details.types)).join(', ') || '—' : __('cert.policy');
    const blocked = type => {
        const key=person.id+':'+type;
        return pending.has(key) || unresolved.has(key) || (details.history || []).some(job=>job.certificateType===type && job.status!=='revoked');
    };
    function render() {
        if (!alive || !details) return;
        const focusedAward=document.activeElement?.dataset.award;
        const e=details.eligibility || {};
        setTitle('cert.title');back(options.onBack ? ()=>{dispose();options.onBack();}:null);
        loader.success(`<div class="cert-recipient"><strong>${esc(person.name)}</strong><small>${esc(person.email)}</small></div><dl class="cert-facts"><div><dt>${__('cert.joined')}</dt><dd>${esc(formatCertificateDate(e.joinedAt))}</dd></div><div><dt>${__('cert.participation')}</dt><dd>${e.participationDays===undefined?'—':esc(e.participationDays)}</dd></div></dl><p class="cert-notice">${details.automationEnabled?esc(__('cert.automatic'))+' · ':''}${esc(eligibilityText())}</p><div class="cert-options">${awards.map(a=>`<button type="button" class="cert-option ${selected===a.type?'is-selected':''} ${(details.history || []).some(job=>job.certificateType===a.type&&certificateAccepted(job.status))?'is-issued':''}" data-award="${a.type}" aria-pressed="${selected===a.type}" ${blocked(a.type)?'disabled':''}>${icon(a.icon)}<span class="cert-option-main"><strong>${esc(typeName(a.type,details.types))}</strong></span><span class="cert-option-tenure">${a.days?__('cert.week'):a.months+' '+__(a.months===1?'cert.month':'cert.months')}</span><span class="cert-option-check">${icon('check')}</span></button>`).join('')}</div>`);
        footer.innerHTML=`<button class="chrome-btn-primary" data-review ${!selected||blocked(selected)?'disabled':''}>${__('cert.review')}</button><div class="cert-secondary-actions"><button class="chrome-btn-outline" data-date>${__('cert.date_edit')}</button><button class="chrome-btn-outline" data-history>${__('cert.history')}</button></div><button class="chrome-btn-outline" data-email-templates>${__('email_templates.title')}</button>`;
        pop.querySelectorAll('[data-award]').forEach(b=>b.onclick=()=>{
            selected=b.dataset.award;
            // Keep card nodes alive: the check's opacity/scale transition must run.
            pop.querySelectorAll('[data-award]').forEach(item=>{const active=item.dataset.award===selected;item.classList.toggle('is-selected',active);item.setAttribute('aria-pressed',String(active));});
            footer.querySelector('[data-review]').disabled=blocked(selected);
        });
        footer.querySelector('[data-review]').onclick=()=>review(selected,false,footer.querySelector('[data-review]'));
        footer.querySelector('[data-date]').onclick=editDate;
        footer.querySelector('[data-history]').onclick=history;
        footer.querySelector('[data-email-templates]').onclick=openCertificateEmailTemplates;
        if(focusedAward)pop.querySelector(`[data-award="${focusedAward}"]`)?.focus({preventScroll:true});
        else if(!root.contains(document.activeElement)&&!document.querySelector('.vx-modal'))pop.querySelector('[data-award]:not([disabled])')?.focus({preventScroll:true});
    }
    async function load() {
        const token=++generation; setTitle('cert.title'); loader.start();
        try { const {data}=await getVertexCertificateDetailsFn({contributorId:person.id}); if(!alive||token!==generation)return; if(!data||typeof data!=='object'||!Array.isArray(data.history))throw Object.assign(new Error('Invalid certificate response'),{code:'functions/internal'}); details=data; render();monitorDelivery(person,data); }
        catch(error) { console.error('[CERTIFICATES] Details failed',{code:error.code,status:error.httpStatus});if(alive&&token===generation){footer.innerHTML='';loader.error(userErrorMessage(error),load,__('common.retry'));} }
    }
    async function execute(type, retry, button) {
        const key=person.id+':'+type;
        if(pending.has(key)||unresolved.has(key)) return;
        pending.add(key); setButtonLoading(button,true,__('cert.processing'));
        try {
            const {data}=await issueVertexCertificateFn({contributorId:person.id,certificateType:type,...(retry?{retry:true}:{})});
            if(!data?.id || typeof data.status!=='string')throw Object.assign(new Error('Invalid issuance response'),{code:'functions/internal'});
            const accepted=certificateAccepted(data.status);
            showToast(()=>accepted?__('cert.success'):statusName(data.status),accepted?'success':certificateInFlight(data.status)?'info':'error');
            selected=undefined;
            details.history=[...(details.history || []).filter(job=>job.id!==data.id),{id:data.id,certificateType:type,status:data.status}];
            pending.delete(key);
            if(alive)render();
            monitorDelivery(person,details);
            // Directory refresh is independent of the accepted issuance UI.
            Promise.resolve(refresh?.()).catch(error=>console.warn('[CERTIFICATES] Directory refresh failed',error.code));
        } catch(error) { selected=undefined;if(alive&&!historyOpen)render();if(!error.httpStatus || ['functions/internal','functions/deadline-exceeded','functions/unavailable'].includes(error.code))unresolved.add(key);showToast(()=>userErrorMessage(error),'error'); }
        finally { pending.delete(key); setButtonLoading(button,false); }
    }
    async function review(type, retry=false, button=anchor) {
        if(!type || (!retry&&blocked(type)))return;
        const e=details.eligibility || {};
        const confirmed=await confirmDialog(()=>({title:__('cert.review'),rows:[{label:__('cert.recipient'),value:esc(person.name)},{label:__('cert.email'),value:esc(person.email)},{label:__('cert.type'),value:esc(typeName(type,details.types))},{label:__('cert.joined'),value:esc(formatCertificateDate(e.joinedAt))},{label:__('cert.eligible'),value:esc(eligibilityText())}],warning:__('cert.effect')}));
        if(confirmed)await execute(type,retry,button);
    }
    async function reloadHistory() {
        try { const {data}=await getVertexCertificateDetailsFn({contributorId:person.id}); details=data; } catch(error){ showToast(()=>userErrorMessage(error),'error'); }
    }
    function editDate() {
        historyOpen=true;paintHistory=undefined;
        let busy=false, saved=dateValue(details.eligibility?.joinedAt);
        const unsubscribeDate=onLangChange(paint);
        const leave=()=>{if(busy)return;historyOpen=false;unsubscribeDate();render();};
        function paint(){
            if(!alive)return;
            saved=pop.querySelector('#joined-at')?.value ?? saved;
            setTitle('cert.date_edit');back(leave);footer.innerHTML='';
            pop.innerHTML=`<form id="joining-date-form" class="join-date-form"><p>${__('cert.current_date')}: ${esc(formatCertificateDate(details.eligibility?.joinedAt))}</p><label for="joined-at">${__('cert.joined')}</label><input type="date" id="joined-at" value="${esc(saved)}"><p class="form-hint">${__('cert.date_help')}</p><div class="form-submit-row"><button type="submit" class="chrome-btn-primary">${__('common.save')}</button><button type="button" data-cancel class="chrome-btn-outline">${__('common.cancel')}</button></div></form>`;
            const button=pop.querySelector('[type=submit]');setButtonLoading(button,busy);
            pop.querySelector('[data-cancel]').onclick=leave;
            pop.querySelector('form').onsubmit=async event=>{
                event.preventDefault();if(busy)return;busy=true;saved=pop.querySelector('input').value;
                setButtonLoading(button,true);
                try {await setVertexContributorJoiningDateFn({contributorId:person.id,joinedAt:saved || null});await reloadHistory();await refresh?.();busy=false;if(alive)leave();}
                catch(error){busy=false;showToast(()=>userErrorMessage(error),'error');if(alive)setButtonLoading(pop.querySelector('[type=submit]'),false);}
            };
        }
        const previous=unsubscribe;unsubscribe=()=>{previous?.();unsubscribeDate();};paint();
    }
    function history() {
        historyOpen=true;
        let body=pop;
        const unsubscribeHistory=onLangChange(()=>paint());
        function paint(){
            if(!body?.isConnected)return;
            setTitle('cert.history');back(()=>{historyOpen=false;unsubscribeHistory();render();});footer.innerHTML='';
            body.innerHTML=`<div class="cert-history-list">${(details.history || []).map(job=>`<article class="cert-history-item"><div class="cert-history-head"><strong>${esc(job.certificateName || typeName(job.certificateType,details.types))}</strong><span class="status-badge is-${esc(job.status)}">${esc(statusName(job.status))}</span></div><small>${esc(formatCertificateDate(job.issuedAt || job.createdAt))}</small><a class="cert-history-link" href="https://vertexishere.com/verify/${encodeURIComponent(job.id)}" target="_blank" rel="noopener">${__('cert.verify')}</a>${job.status==='uncertain'?`<p>${__('cert.uncertain')}</p>`:''}${job.status==='failed'&&!job.retrySafe?`<p>${__('cert.retry_block')}</p>`:''}<details><summary>${__('cert.attempts')}</summary>${(job.attempts || []).map(a=>`<p>${esc(a.id)} · ${esc(statusName(a.status))} · ${esc(formatCertificateDate(a.createdAt || a.startedAt))}</p>`).join('')}</details><div class="cert-history-actions">${job.status==='failed'&&job.retrySafe?`<button class="chrome-btn-outline" data-retry="${esc(job.certificateType)}">${__('common.retry')}</button>`:''}${job.status!=='revoked'?`<button class="chrome-btn-outline" data-revoke="${esc(job.id)}">${__('cert.revoke')}</button>`:''}</div></article>`).join('') || `<p class="state-block">${__('cert.empty')}</p>`}</div>`;
            body.querySelectorAll('[data-retry]').forEach(b=>b.onclick=async()=>{await review(b.dataset.retry,true,b);paint();});
            body.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{
                if(b.disabled)return;
                if(!await confirmDialog(()=>({title:__('cert.revoke'),warning:__('cert.revoke_warn')})))return;
                setButtonLoading(b,true,__('cert.processing'));
                try { await revokeVertexCertificateFn({id:b.dataset.revoke});await reloadHistory();await refresh?.();paint(); }
                catch(error){showToast(()=>userErrorMessage(error),'error');setButtonLoading(b,false);}
            });
        }
        paintHistory=paint;paint();
        const previous=unsubscribe;unsubscribe=()=>{previous?.();unsubscribeHistory();};
    }
    let historyOpen=false;
    const paintManagement=()=>{if(!historyOpen)render();};
    unsubscribe=onLangChange(paintManagement);
    load();
}
