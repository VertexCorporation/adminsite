// js/modules/contributors.js

import { showToast, __, onLangChange, sanitizeHTML, escapeHTML } from '../utils/ui.js';
import { getVertexContributorsFn, toggleContributorVerificationFn, deleteVertexContributorFn, updateContributorApplicationFn } from '../core/firebase.js';
import { getEffectivePanelLevel, getHiddenChipsFor, DEPARTMENTS } from './roles.js';

const emailIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
const phoneIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`;
const ageIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
const dateIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
const linkedInIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>`;
const githubIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>`;
const interviewIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:#22c55e;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="m9 16 2 2 4-4"></path></svg>`;
const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;

let listContainer;
let refreshBtn;

export function initContributorsModule() {
    listContainer = document.getElementById('contributors-list-container');
    refreshBtn = document.getElementById('refresh-contributors-btn');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchContributorsData);
    }
    
    // Inject Custom CSS for verification toggle and text
    const style = document.createElement('style');
    style.innerHTML = `
        .verify-switch input:checked + .slider {
            background-color: #4caf50 !important;
        }
        .verify-switch input:checked + .slider:before {
            content: '✓';
            display: flex;
            align-items: center;
            justify-content: center;
            color: #4caf50;
            font-size: 14px;
            font-weight: bold;
        }
        .verify-status-text {
            font-size: 0.75rem; 
            margin-top: 4px; 
            font-weight: 600; 
            transition: all 0.3s ease;
        }
        .verify-status-text.unverified {
            color: var(--text-muted);
        }
        .verify-status-text.verified {
            color: #4caf50;
        }
        .delete-contributor-btn {
            background: none;
            border: none;
            color: #ff4444;
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            transition: background 0.3s ease, transform 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
        }
        .delete-contributor-btn:hover {
            background: rgba(255, 68, 68, 0.1);
            transform: scale(1.1);
        }
        .edit-contributor-btn {
            background: none;
            border: none;
            color: var(--accent-gold, #c9b08f);
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            transition: background 0.3s ease, transform 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 4px;
        }
        .edit-contributor-btn:hover {
            background: rgba(201, 176, 143, 0.12);
            transform: scale(1.1);
        }
        .contributor-edit-form {
            width: 100%;
        }
        .contributor-edit-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 10px;
        }
    `;
    document.head.appendChild(style);
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
    
    listContainer.innerHTML = '<p class="form-hint" style="text-align:center;">Loading contributors...</p>';
    if (refreshBtn) refreshBtn.disabled = true;

    try {
        const result = await getVertexContributorsFn();
        const contributors = result.data.contributors || [];
        window.loadedContributors = contributors;
        renderContributors(contributors);
    } catch (error) {
        console.error('[CONTRIBUTORS] Failed to fetch data:', error);
        listContainer.innerHTML = '<p class="form-hint" style="color:red; text-align:center;">Failed to load contributors.</p>';
        showToast(`Could not load contributors: ${error.message}`, 'error');
    } finally {
        if (refreshBtn) refreshBtn.disabled = false;
    }
}

function renderContributors(contributors) {
    if (contributors.length === 0) {
        listContainer.innerHTML = '<p class="form-hint" style="text-align:center;">No contributors found.</p>';
        return;
    }

    listContainer.innerHTML = ''; // Clear

    contributors.forEach(contributor => {
        let dateStr = 'N/A';
        // FieldValue.serverTimestamp() creates objects with _seconds when fetched via callable function
        if (contributor.createdAt) {
           const time = contributor.createdAt._seconds ? contributor.createdAt._seconds * 1000 : contributor.createdAt;
           dateStr = new Date(time).toLocaleString();
        }

        const div = document.createElement('div');
        div.style.cssText = 'padding: 15px; border-bottom: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px;';

        // Yazma yetkisi: 'contributors.list' paneli write olanlar (veya adminler)
        // kalem/toggle/silme görür; read-only kullanıcılar yalnızca rozet görür.
        const canWrite = getEffectivePanelLevel('contributors.list') === 'write';
        
        let mediaLinks = '';
        if (contributor.linkedin) mediaLinks += `<a href="${escapeHTML(contributor.linkedin)}" target="_blank" style="color:var(--primary-color); text-decoration:none; margin-right:15px;">${linkedInIcon} LinkedIn</a>`;
        if (contributor.github) mediaLinks += `<a href="${escapeHTML(contributor.github)}" target="_blank" style="color:var(--primary-color); text-decoration:none;">${githubIcon} GitHub</a>`;
        
        let extraInfo = '';
        if (contributor.age) extraInfo += `${ageIcon} Age: ${escapeHTML(String(contributor.age ?? ''))} &nbsp;&nbsp;`;
        if (mediaLinks) extraInfo += mediaLinks;

        let interviewDateStr = '';
        if (contributor.interviewDate) {
            try {
                const iDate = new Date(contributor.interviewDate);
                interviewDateStr = isNaN(iDate.getTime()) ? contributor.interviewDate : iDate.toLocaleString();
            } catch (e) {
                interviewDateStr = contributor.interviewDate;
            }
        }

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <strong style="color: var(--text-color); font-size: 1.1rem; margin-top: 4px;">${sanitizeHTML(contributor.name)}</strong>
                <div style="display: flex; align-items: flex-start;">
                    ${canWrite ? `
                    <button class="edit-contributor-btn" data-id="${contributor.id}" title="${__('contributors.edit_title')}" style="margin-top: 2px;">
                        ${editIcon}
                    </button>
                    <button class="delete-contributor-btn" data-id="${contributor.id}" title="Delete Contributor" style="margin-top: 2px;">
                        ${trashIcon}
                    </button>
                    <div style="display: flex; flex-direction: column; align-items: center; min-width: 60px;">
                        <label class="switch verify-switch" style="transform: scale(0.8); margin: 0;">
                            <input type="checkbox" class="verify-toggle" data-id="${contributor.id}" ${contributor.hasVerified ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                        <span class="verify-status-text ${contributor.hasVerified ? 'verified' : 'unverified'}" id="status-text-${contributor.id}">
                            ${contributor.hasVerified ? 'Verified' : 'Unverified'}
                        </span>
                    </div>` : `
                    <span class="verify-status-text ${contributor.hasVerified ? 'verified' : 'unverified'}" style="margin-top: 6px;" id="status-text-${contributor.id}">
                        ${contributor.hasVerified ? 'Verified' : 'Unverified'}
                    </span>`}
                </div>
            </div>
            <div style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.6; margin-top: 8px;">
                ${contributor.email ? `<div style="display:flex; align-items:center;">${emailIcon} <a href="mailto:${escapeHTML(contributor.email)}" style="color:var(--text-muted);">${escapeHTML(contributor.email)}</a></div>` : ''}
                ${contributor.phone ? `<div style="display:flex; align-items:center; margin-top:4px;">${phoneIcon} ${escapeHTML(contributor.phone)}</div>` : ''}
                ${contributor.department ? `<div style="display:flex; align-items:center; margin-top:4px; font-weight: 500; color: var(--primary-color);">Department: ${escapeHTML(contributor.department)}</div>` : ''}
                <div style="display:flex; align-items:center; margin-top:4px;">${extraInfo}</div>
                <div style="display:flex; align-items:center; margin-top:4px;">${dateIcon} ${dateStr}</div>
                ${interviewDateStr ? `
                <div class="interview-date-row" data-date-val="${interviewDateStr}" data-uid="${contributor.interviewBookingUid || ''}" style="display:flex; align-items:center; margin-top:4px; font-weight: 600; color: #22c55e;">
                    ${interviewIcon} <span>${__('contributors.interview_date')}: ${interviewDateStr}</span>
                    ${contributor.interviewBookingUid ? `<span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px; font-weight:normal;">(UID: ${contributor.interviewBookingUid})</span>` : ''}
                </div>` : ''}
            </div>
            ${contributor.about ? `<div style="font-size: 0.9rem; padding:12px; background: rgba(128,128,128,0.05); border-left: 3px solid var(--primary-color); border-radius:4px; margin-top:10px; color: var(--text-color);">${sanitizeHTML(contributor.about)}</div>` : ''}
        `;
        listContainer.appendChild(div);
    });

    // Re-translate verify status texts and interview rows when language changes
    onLangChange(() => {
        document.querySelectorAll('.verify-status-text').forEach(el => {
            const isVerif = el.classList.contains('verified');
            el.textContent = isVerif ? __('contributors.verified_label') : __('contributors.unverified_label');
        });
        document.querySelectorAll('.interview-date-row').forEach(el => {
            const dateVal = el.getAttribute('data-date-val');
            const uid = el.getAttribute('data-uid');
            if (dateVal) {
                const labelText = __('contributors.interview_date');
                const uidText = uid ? `<span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px; font-weight:normal;">(UID: ${uid})</span>` : '';
                el.innerHTML = `${interviewIcon} <span>${labelText}: ${dateVal}</span>${uidText}`;
            }
        });
    });

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
            if (confirm(__('contributors.delete_confirm'))) {
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
    const editBtns = listContainer.querySelectorAll('.edit-contributor-btn');
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
    const card = [...listContainer.children].find(el => el.querySelector(`.edit-contributor-btn[data-id="${contributor.id}"]`));
    if (!card) return;

    const deptOptions = ['', ...DEPARTMENTS.map(d => d.id)]
        .map(id => `<option value="${id}" ${contributor.department === id ? 'selected' : ''}>${id || '—'}</option>`)
        .join('');
    const langOptions = ['tr', 'en']
        .map(code => `<option value="${code}" ${contributor.language === code ? 'selected' : ''}>${code.toUpperCase()}</option>`)
        .join('');

    card.innerHTML = `
        <form class="contributor-edit-form form-stack">
            <div class="card-title-row">
                <div class="title-details">
                    <span class="material-symbols-rounded">edit</span>
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
                    <span class="material-symbols-rounded">save</span><span>${__('contributors.save_btn')}</span>
                </button>
                <button type="button" class="chrome-btn-outline ce-cancel-btn"><span>${__('contributors.cancel_btn')}</span></button>
            </div>
        </form>
    `;

    card.querySelector('.ce-cancel-btn').addEventListener('click', () => fetchContributorsData());

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
            showToast(__('contributors.edit_updated'), 'success');
            fetchContributorsData();
        } catch (error) {
            console.error('[CONTRIBUTORS] Edit failed:', error);
            showToast(`${__('system.error')}: ${error.message}`, 'error');
            submitBtn.disabled = false;
        }
    });
}
