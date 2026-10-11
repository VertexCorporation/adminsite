import { icon } from '../utils/icons.js';
import { openDrawer, closeDrawer, confirmDialog } from './shell.js';
import { createLoadingController, skeletonRows, createRequestGuard } from '../utils/loading.js';
import { formatCertificateDate } from './certificates.js';
import { openCertificates } from './certificates.js';
// js/modules/contributors.js

import { showToast, __, onLangChange, sanitizeHTML, escapeHTML } from '../utils/ui.js';
import { getVertexContributorsFn, toggleContributorVerificationFn, deleteVertexContributorFn, updateContributorApplicationFn } from '../core/firebase.js';
import { getEffectivePanelLevel, getHiddenChipsFor, DEPARTMENTS, isPanelAdmin, getHiddenFieldsFor } from './roles.js';

const editIcon = icon('pencil');
const requestGuard = createRequestGuard();
let loading;
let activeFilter = 'all';
let listContainer;
let refreshBtn;

export function initContributorsModule() {
    listContainer = document.getElementById('contributors-list-container');
    const header=document.createElement('div');header.className='contributor-table-head';header.innerHTML=['name','department','age','status','interview','actions'].map(h=>`<span>${__('contributors.col_'+h)}</span>`).join('');listContainer.before(header);
    loading = createLoadingController(listContainer,{skeletonHTML:skeletonRows()});
    window.filterContributors = filter => { activeFilter=filter; renderContributors(window.loadedContributors || []); };
    window.searchContributorsLocal = () => renderContributors(window.loadedContributors || []);
    refreshBtn = document.getElementById('refresh-contributors-btn');
    onLangChange(() => { const headers=['name','department','age','status','interview','actions']; document.querySelectorAll('.contributor-table-head span').forEach((el,i)=>el.textContent=__('contributors.col_'+headers[i])); if(window.loadedContributors && !document.querySelector('.cert-popover')) renderContributors(window.loadedContributors); });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchContributorsData);
    }

}

/** Rank bazli gizlenen filtre ciplerini uygula (adminler hepsini gorur). */
export function applyChipVisibility() {
    const hidden = new Set(getHiddenChipsFor('contributors.list'));
    document.querySelectorAll('.filter-chip').forEach(chip => {
        const filter = chip.getAttribute('data-filter');
        if (filter && filter !== 'all') chip.style.display = hidden.has(filter) ? 'none' : '';
    });
}

export async function fetchContributorsData() {
    if (!listContainer) return;

    const request = requestGuard.begin();
    loading.start();
    if (refreshBtn) refreshBtn.disabled = true;

    try {
        const result = await getVertexContributorsFn();
        if (!requestGuard.isCurrent(request)) return;
        loading.destroy();
        const contributors = result.data.contributors || [];
        window.loadedContributors = contributors;
        renderContributors(contributors);
    } catch (error) {
        console.error('[CONTRIBUTORS] Failed to fetch data:', error);
        if (!requestGuard.isCurrent(request)) return;
        loading.error(__('cert.error'),fetchContributorsData,__('common.retry'));
        showToast(`Could not load contributors: ${error.message}`, 'error');
    } finally {
        if (requestGuard.isCurrent(request) && refreshBtn) refreshBtn.disabled = false;
    }
}

function renderContributors(contributors) {
    const query = document.getElementById('contributor-search')?.value.toLowerCase().trim() || '';
    const hidden = new Set(getHiddenFieldsFor('contributors.list'));
    contributors = contributors.filter(p => {
        const match = ({all:true,verified:!!p.hasVerified,unverified:!p.hasVerified,'age-14-15':p.age>=14&&p.age<=15,'age-16-17':p.age>=16&&p.age<=17,'age-18':p.age>=18,linkedin:!!p.linkedin,github:!!p.github,interview:!!p.interviewDate})[activeFilter];
        return match && [p.name,p.email,p.department].some(v=>String(v || '').toLowerCase().includes(query));
    });
    document.querySelectorAll('.filter-chip').forEach(b=>b.classList.toggle('active',b.dataset.filter===activeFilter));
    const canWrite = getEffectivePanelLevel('contributors.list')==='write';
    const admin = isPanelAdmin();
    const headers = ['name','department','age','status','interview','actions'];
    loading.success(contributors.map(p=>`<div class="contributor-row" data-contributor-id="${escapeHTML(p.id)}"><button type="button" class="contributor-cell-name" data-details="${escapeHTML(p.id)}"><span class="contributor-avatar">${escapeHTML((p.name||'?').slice(0,1))}</span><strong class="contributor-name">${escapeHTML(p.name)}</strong></button><span class="contributor-cell-dept">${escapeHTML(p.department||'—')}</span><span class="contributor-cell-age">${hidden.has('age')?'—':escapeHTML(p.age??'—')}</span><span class="contributor-cell-status status-badge">${p.hasVerified?__('contributors.verified_label'):__('contributors.unverified_label')}</span><span class="contributor-cell-interview">${!hidden.has('interview')&&p.interviewDate?escapeHTML(formatCertificateDate(p.interviewDate)):'—'}</span><span class="contributor-cell-actions">${canWrite?`<button type="button" class="edit-contributor-btn icon-action-btn" data-id="${escapeHTML(p.id)}" aria-label="${__('contributors.edit_title')}">${icon('pencil')}</button>`:''}${admin?`<button type="button" class="certificate-manage-btn cert-trigger" data-id="${escapeHTML(p.id)}" aria-label="${__('cert.title')}">${icon('award')}</button>`:''}</span></div>`).join('')+(contributors.length?'':`<p class="state-block">${__('contributors.empty')}</p>`));
    listContainer.querySelectorAll('[data-details]').forEach(b=>b.onclick=()=>openContributorDetails(contributors.find(p=>p.id===b.dataset.details)));
    listContainer.querySelectorAll('.certificate-manage-btn').forEach(b=>b.onclick=()=>openCertificates(contributors.find(p=>p.id===b.dataset.id),fetchContributorsData,b));
    // Add event listeners to toggles
    const toggles = listContainer.querySelectorAll('.verify-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const id = e.target.getAttribute('data-id');
            const isChecked = e.target.checked;
            const statusText = document.getElementById(`status-text-${id}`);

            e.target.disabled = true; // disable while updating

            try {
                await toggleContributorVerificationFn({ contributorId: id, hasVerified: isChecked });
                showToast(__('contributors.verify_updated'), 'success');

                // Animate text update
                if (statusText) {
                    statusText.style.opacity = 0;
                    setTimeout(() => {
                        statusText.innerText = isChecked ? __('contributors.verified_label') : __('contributors.unverified_label');
                        statusText.className = `verify-status-text ${isChecked ? 'verified' : 'unverified'}`;
                        statusText.style.opacity = 1;
                    }, 150);
                }
            } catch (err) {
                console.error('[CONTRIBUTORS] Toggle failed:', err);
                e.target.checked = !isChecked; // revert
                showToast(`Update failed: ${err.message}`, 'error');
            } finally {
                e.target.disabled = false;
            }
        });
    });

    // Add event listeners to delete buttons
    const deleteBtns = listContainer.querySelectorAll('.delete-contributor-btn');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.getAttribute('data-id');
            if (await confirmDialog(()=>({title:__('common.delete'),body:__('contributors.delete_confirm')}))) {
                btn.disabled = true;
                try {
                    await deleteVertexContributorFn({ contributorId: id });
                    showToast('Contributor deleted successfully.', 'success');
                    fetchContributorsData(); // Refresh list
                } catch (err) {
                    console.error('[CONTRIBUTORS] Delete failed:', err);
                    showToast(`Delete failed: ${err.message}`, 'error');
                    btn.disabled = false;
                }
            }
        });
    });

    // Add event listeners to edit (pencil) buttons
    const editBtns = listContainer.querySelectorAll('.edit-contributor-btn:not(.certificate-manage-btn)');
    editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const contributor = (window.loadedContributors || []).find(item => item.id === id);
            if (contributor) openContributorEditor(contributor);
        });
    });
}

// --- Kalem düzenleme: başvurunun temel alanlarını komple değiştirme ---

function toDatetimeLocalValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function openContributorEditor(contributor) {
    if (getEffectivePanelLevel('contributors.list') !== 'write') return;
    const card = openDrawer({title:__('contributors.edit_title')});
    const deptOptions = ['', ...DEPARTMENTS.map(d => d.id)]
        .map(id => `<option value="${id}" ${contributor.department === id ? 'selected' : ''}>${id || '—'}</option>`)
        .join('');
    const langOptions = [...new Set([contributor.language || 'en', 'tr', 'en'])]
        .map(code => `<option value="${code}" ${contributor.language === code ? 'selected' : ''}>${code.toUpperCase()}</option>`)
        .join('');

    card.innerHTML = `
        <form class="contributor-edit-form form-stack">
            <div class="card-title-row">
                <div class="title-details">
                    <i class="" data-icon="edit"></i>
                    <h3>${__('contributors.edit_title')}</h3>
                </div>
            </div>
            <div class="contributor-edit-grid">
                <div class="form-group-field">
                    <label for="ce-name">${__('contributors.field_name')}</label>
                    <input type="text" id="ce-name" value="${escapeHTML(contributor.name || '')}" required>
                </div>
                <div class="form-group-field">
                    <label for="ce-email">${__('contributors.field_email')}</label>
                    <input type="email" id="ce-email" value="${escapeHTML(contributor.email || '')}">
                </div>
                <div class="form-group-field">
                    <label for="ce-phone">${__('contributors.field_phone')}</label>
                    <input type="text" id="ce-phone" value="${escapeHTML(contributor.phone || '')}">
                </div>
                <div class="form-group-field">
                    <label for="ce-age">${__('contributors.field_age')}</label>
                    <input type="number" id="ce-age" value="${escapeHTML(String(contributor.age ?? ''))}">
                </div>
                <div class="form-group-field">
                    <label for="ce-dept">${__('contributors.field_department')}</label>
                    <select id="ce-dept">${deptOptions}</select>
                </div>
                <div class="form-group-field">
                    <label for="ce-lang">${__('contributors.field_language')}</label>
                    <select id="ce-lang">${langOptions}</select>
                </div>
                <div class="form-group-field">
                    <label for="ce-linkedin">${__('contributors.field_linkedin')}</label>
                    <input type="url" id="ce-linkedin" value="${escapeHTML(contributor.linkedin || '')}">
                </div>
                <div class="form-group-field">
                    <label for="ce-github">${__('contributors.field_github')}</label>
                    <input type="url" id="ce-github" value="${escapeHTML(contributor.github || '')}">
                </div>
                <div class="form-group-field">
                    <label for="ce-interview">${__('contributors.field_interview')}</label>
                    <input type="datetime-local" id="ce-interview" value="${toDatetimeLocalValue(contributor.interviewDate)}">
                </div>
            </div>
            <div class="form-group-field">
                <label for="ce-about">${__('contributors.field_about')}</label>
                <textarea id="ce-about" rows="4">${escapeHTML(contributor.about || '')}</textarea>
            </div>
            <div class="form-group-field">
                <label for="ce-details">${__('contributors.field_interview_details')}</label>
                <textarea id="ce-details" rows="2">${escapeHTML(contributor.interviewDetails || '')}</textarea>
            </div>
            <div class="form-submit-row">
                <button type="submit" class="chrome-btn-accent">
                    <i class="" data-icon="save"></i><span>${__('contributors.save_btn')}</span>
                </button>
                <button type="button" class="chrome-btn-outline ce-cancel-btn"><span>${__('contributors.cancel_btn')}</span></button>
            </div>
        </form>
    `;

    card.querySelector('.ce-cancel-btn').addEventListener('click', () => closeDrawer());

    card.querySelector('.contributor-edit-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitBtn = event.currentTarget.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const updates = {
            name: card.querySelector('#ce-name').value.trim(),
            email: card.querySelector('#ce-email').value.trim(),
            phone: card.querySelector('#ce-phone').value.trim(),
            age: card.querySelector('#ce-age').value,
            department: card.querySelector('#ce-dept').value,
            language: card.querySelector('#ce-lang').value,
            linkedin: card.querySelector('#ce-linkedin').value.trim(),
            github: card.querySelector('#ce-github').value.trim(),
            interviewDate: card.querySelector('#ce-interview').value,
            about: card.querySelector('#ce-about').value.trim(),
            interviewDetails: card.querySelector('#ce-details').value.trim()
        };

        try {
            await updateContributorApplicationFn({ contributorId: contributor.id, ...updates });
            closeDrawer();
            showToast(__('contributors.edit_updated'), 'success');
            fetchContributorsData();
        } catch (error) {
            console.error('[CONTRIBUTORS] Edit failed:', error);
            showToast(`${__('system.error')}: ${error.message}`, 'error');
            submitBtn.disabled = false;
        }
    });
}

function openContributorDetails(person) {
    const hidden = new Set(getHiddenFieldsFor('contributors.list'));
    let body;
    function paint() {
        if(!body?.isConnected)return;
        const rows = [['contributors.field_department',person.department],...(!hidden.has('contact')?[['contributors.field_email',person.email],['contributors.field_phone',person.phone]]:[]),...(!hidden.has('age')?[['contributors.field_age',person.age]]:[]),['contributors.field_language',person.language],['contributors.col_status',person.hasVerified?__('contributors.verified_label'):__('contributors.unverified_label')],['contributors.applied_at',formatCertificateDate(person.createdAt)],...(!hidden.has('interview')?[['contributors.field_interview',formatCertificateDate(person.interviewDate)]]:[]),['cert.joined',formatCertificateDate(person.joinedAt)]];
        body.innerHTML=`<dl class="detail-list">${rows.map(([label,value])=>`<div class="detail-row"><dt>${__(label)}</dt><dd>${escapeHTML(String(value??'—'))}</dd></div>`).join('')}</dl>${!hidden.has('about')?`<p class="drawer-bio">${escapeHTML(person.about||'')}</p>`:''}${!hidden.has('links')?['linkedin','github'].filter(k=>/^https?:\/\//.test(person[k]||'')).map(k=>`<a href="${escapeHTML(person[k])}" target="_blank" rel="noopener">${k}</a>`).join(' · '):''}<div class="form-submit-row">${getEffectivePanelLevel('contributors.list')==='write'?`<button class="chrome-btn-outline" data-edit>${__('contributors.edit_title')}</button>`:''}${isPanelAdmin()?`<button class="cert-trigger" data-certificate aria-label="${__('cert.title')}">${icon('award')}</button><details><summary>${__('contributors.col_actions')}</summary><button class="chrome-btn-outline" data-delete>${__('contributors.delete_confirm')}</button><label><input type="checkbox" data-verify ${person.hasVerified?'checked':''}>${__('contributors.verified_label')}</label></details>`:''}</div>`;
        body.querySelector('[data-edit]')?.addEventListener('click',()=>openContributorEditor(person));
        body.querySelector('[data-certificate]')?.addEventListener('click',event=>openCertificates(person,fetchContributorsData,event.currentTarget));
        body.querySelector('[data-delete]')?.addEventListener('click',async event=>{if(!await confirmDialog(()=>({title:__('common.delete'),body:__('contributors.delete_confirm')})))return;event.currentTarget.disabled=true;try{await deleteVertexContributorFn({contributorId:person.id});closeDrawer();await fetchContributorsData();}catch(error){showToast(error.message,'error');paint();}});
        body.querySelector('[data-verify]')?.addEventListener('change',async event=>{const toggle=event.currentTarget;toggle.disabled=true;try{await toggleContributorVerificationFn({contributorId:person.id,hasVerified:toggle.checked});person.hasVerified=toggle.checked;await fetchContributorsData();}catch(error){toggle.checked=!toggle.checked;showToast(error.message,'error');}finally{toggle.disabled=false;}});
    }
    const unsubscribe=onLangChange(paint);
    body=openDrawer({title:person.name,onAfterClose:unsubscribe});paint();
}
