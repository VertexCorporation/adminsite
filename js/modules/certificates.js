import { setVertexContributorJoiningDateFn, issueVertexCertificateFn, getVertexCertificateDetailsFn, revokeVertexCertificateFn } from '../core/firebase.js';
import { escapeHTML as esc, showToast, userErrorMessage, __, getLang, onLangChange } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
import { openDrawer, openModal, closeModal, confirmDialog } from './shell.js';
import { createLoadingController, skeletonRows, skeletonCertificate, setButtonLoading } from '../utils/loading.js';
import { isPanelAdmin } from './roles.js';
const awards = [{type:'tenacity',months:1,icon:'award',tr:'Dirayet',en:'Tenacity'},{type:'constancy',months:3,icon:'shield',tr:'Metanet',en:'Constancy'},{type:'majesty',months:6,icon:'diamond',tr:'Azamet',en:'Majesty'},{type:'nobility',months:12,icon:'crown',tr:'Asalet',en:'Nobility'}];
const pending = new Set();
const unresolved = new Set();
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
function typeName(type, types) { return types?.[type]?.[getLang()] || awards.find(a=>a.type===type)?.[getLang()] || type; }
function statusName(status) { if(status==='succeeded')return __('cert.success');if(status==='pending')return __('cert.processing');return ['processing','failed','revoked','delivered'].includes(status) ? __('cert.'+status) : status==='uncertain' ? __('cert.status_uncertain') : status; }

export function openCertificates(person, refresh, anchor = document.activeElement, options = {}) {
    if (!isPanelAdmin() || !person) return;
    let details, selected, generation = 0, alive = true, unsubscribe;
    const dispose=()=>{alive=false;generation++;unsubscribe?.();};
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
        loader.success(`<div class="cert-recipient"><strong>${esc(person.name)}</strong><small>${esc(person.email)}</small></div><dl class="cert-facts"><div><dt>${__('cert.joined')}</dt><dd>${esc(formatCertificateDate(e.joinedAt))}</dd></div><div><dt>${__('cert.participation')}</dt><dd>${e.participationDays===undefined?'—':esc(e.participationDays)}</dd></div></dl><p class="cert-notice">${esc(eligibilityText())}</p><div class="cert-options">${awards.map(a=>`<button type="button" class="cert-option ${selected===a.type?'is-selected':''}" data-award="${a.type}" aria-pressed="${selected===a.type}" ${blocked(a.type)?'disabled':''}>${icon(a.icon)}<span class="cert-option-main"><strong>${esc(typeName(a.type,details.types))}</strong></span><span class="cert-option-tenure">${a.months} ${__(a.months===1?'cert.month':'cert.months')}</span><span class="cert-option-check">${icon('check')}</span></button>`).join('')}</div>`);
        footer.innerHTML=`<button class="chrome-btn-primary" data-review ${!selected||blocked(selected)?'disabled':''}>${__('cert.review')}</button><div class="cert-secondary-actions"><button class="chrome-btn-outline" data-date>${__('cert.date_edit')}</button><button class="chrome-btn-outline" data-history>${__('cert.history')}</button></div>`;
        pop.querySelectorAll('[data-award]').forEach(b=>b.onclick=()=>{
            selected=b.dataset.award;
            // Keep card nodes alive: the check's opacity/scale transition must run.
            pop.querySelectorAll('[data-award]').forEach(item=>{const active=item.dataset.award===selected;item.classList.toggle('is-selected',active);item.setAttribute('aria-pressed',String(active));});
            footer.querySelector('[data-review]').disabled=blocked(selected);
        });
        footer.querySelector('[data-review]').onclick=()=>review(selected,false,footer.querySelector('[data-review]'));
        footer.querySelector('[data-date]').onclick=editDate;
        footer.querySelector('[data-history]').onclick=history;
        if(focusedAward)pop.querySelector(`[data-award="${focusedAward}"]`)?.focus({preventScroll:true});
        else if(!root.contains(document.activeElement)&&!document.querySelector('.vx-modal'))pop.querySelector('[data-award]:not([disabled])')?.focus({preventScroll:true});
    }
    async function load() {
        const token=++generation; setTitle('cert.title'); loader.start();
        try { const {data}=await getVertexCertificateDetailsFn({contributorId:person.id}); if(!alive||token!==generation)return; details=data; render(); }
        catch(error) { if(alive&&token===generation)loader.error(__('cert.error'),load,__('common.retry')); }
    }
    async function execute(type, retry, button) {
        const key=person.id+':'+type;
        if(pending.has(key)||unresolved.has(key)) return;
        pending.add(key); setButtonLoading(button,true,__('cert.processing'));
        try {
            const {data}=await issueVertexCertificateFn({contributorId:person.id,certificateType:type,...(retry?{retry:true}:{})});
            showToast(()=>statusName(data.status || 'processing'),'info');
            await refresh?.();
        } catch(error) { unresolved.add(key); showToast(()=>userErrorMessage(error),'error'); }
        finally { pending.delete(key); setButtonLoading(button,false); await reloadHistory(); if(alive)render(); }
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
        let body;
        const unsubscribeDate=onLangChange(()=>paint());
        function paint(){
            const saved=body?.querySelector('input')?.value ?? dateValue(details.eligibility?.joinedAt);
            if(!body)return;
            body.parentElement.querySelector('.vx-modal-title').textContent=__('cert.date_edit');
            body.innerHTML=`<form id="joining-date-form" class="join-date-form"><p>${__('cert.current_date')}: ${esc(formatCertificateDate(details.eligibility?.joinedAt))}</p><label for="joined-at">${__('cert.joined')}</label><input type="date" id="joined-at" value="${esc(saved)}"><p class="form-hint">${__('cert.date_help')}</p><div class="form-submit-row"><button type="submit" class="chrome-btn-primary">${__('common.save')}</button><button type="button" data-cancel class="chrome-btn-outline">${__('common.cancel')}</button></div></form>`;
            body.querySelector('[data-cancel]').onclick=()=>closeModal();
            body.querySelector('form').onsubmit=async event=>{
                event.preventDefault(); const button=body.querySelector('[type=submit]'); if(button.disabled)return;
                const joinedAt=body.querySelector('input').value || null; setButtonLoading(button,true,__('cert.processing'));
                try { await setVertexContributorJoiningDateFn({contributorId:person.id,joinedAt}); await reloadHistory(); await refresh?.(); closeModal();if(alive)render(); }
                catch(error){showToast(()=>userErrorMessage(error),'error');setButtonLoading(button,false);}
            };
        }
        body=openModal({title:__('cert.date_edit'),onAfterClose:unsubscribeDate});paint();
    }
    function history() {
        historyOpen=true;
        let body=pop;
        const unsubscribeHistory=onLangChange(()=>paint());
        function paint(){
            if(!body?.isConnected)return;
            setTitle('cert.history');back(()=>{historyOpen=false;unsubscribeHistory();render();});footer.innerHTML='';
            body.innerHTML=`<div class="cert-history-list">${(details.history || []).map(job=>`<article class="cert-history-item"><div class="cert-history-head"><strong>${esc(typeName(job.certificateType,details.types))}</strong><span class="status-badge is-${esc(job.status)}">${esc(statusName(job.status))}</span></div><small>${esc(formatCertificateDate(job.issuedAt || job.createdAt))}</small><a class="cert-history-link" href="https://vertexishere.com/verify/${encodeURIComponent(job.id)}" target="_blank" rel="noopener">${__('cert.verify')}</a>${job.status==='uncertain'?`<p>${__('cert.uncertain')}</p>`:''}${job.status==='failed'&&!job.retrySafe?`<p>${__('cert.retry_block')}</p>`:''}<details><summary>${__('cert.attempts')}</summary>${(job.attempts || []).map(a=>`<p>${esc(a.id)} · ${esc(statusName(a.status))} · ${esc(formatCertificateDate(a.createdAt || a.startedAt))}</p>`).join('')}</details><div class="cert-history-actions">${job.status==='failed'&&job.retrySafe?`<button class="chrome-btn-outline" data-retry="${esc(job.certificateType)}">${__('common.retry')}</button>`:''}${job.status!=='revoked'?`<button class="chrome-btn-outline" data-revoke="${esc(job.id)}">${__('cert.revoke')}</button>`:''}</div></article>`).join('') || `<p class="state-block">${__('cert.empty')}</p>`}</div>`;
            body.querySelectorAll('[data-retry]').forEach(b=>b.onclick=async()=>{await review(b.dataset.retry,true,b);paint();});
            body.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{
                if(b.disabled)return;
                if(!await confirmDialog(()=>({title:__('cert.revoke'),warning:__('cert.revoke_warn')})))return;
                setButtonLoading(b,true,__('cert.processing'));
                try { await revokeVertexCertificateFn({id:b.dataset.revoke});await reloadHistory();await refresh?.();paint(); }
                catch(error){showToast(()=>userErrorMessage(error),'error');setButtonLoading(b,false);}
            });
        }
        paint();
        const previous=unsubscribe;unsubscribe=()=>{previous?.();unsubscribeHistory();};
    }
    let historyOpen=false;
    const paintManagement=()=>{if(!historyOpen)render();};
    unsubscribe=onLangChange(paintManagement);
    load();
}
