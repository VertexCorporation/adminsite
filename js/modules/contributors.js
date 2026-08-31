// js/modules/contributors.js

import { showToast, __, onLangChange } from '../utils/ui.js';
import { getVertexContributorsFn, toggleContributorVerificationFn, deleteVertexContributorFn } from '../core/firebase.js';

const emailIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
const phoneIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`;
const ageIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
const dateIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
const linkedInIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>`;
const githubIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:var(--primary-color)"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>`;
const interviewIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom; margin-right:5px; color:#22c55e;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="m9 16 2 2 4-4"></path></svg>`;
const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

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
    `;
    document.head.appendChild(style);
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
        
        let mediaLinks = '';
        if (contributor.linkedin) mediaLinks += `<a href="${contributor.linkedin}" target="_blank" style="color:var(--primary-color); text-decoration:none; margin-right:15px;">${linkedInIcon} LinkedIn</a>`;
        if (contributor.github) mediaLinks += `<a href="${contributor.github}" target="_blank" style="color:var(--primary-color); text-decoration:none;">${githubIcon} GitHub</a>`;
        
        let extraInfo = '';
        if (contributor.age) extraInfo += `${ageIcon} Age: ${contributor.age} &nbsp;&nbsp;`;
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
                <strong style="color: var(--text-color); font-size: 1.1rem; margin-top: 4px;">${contributor.name}</strong>
                <div style="display: flex; align-items: flex-start;">
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
                    </div>
                </div>
            </div>
            <div style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.6; margin-top: 8px;">
                <div style="display:flex; align-items:center;">${emailIcon} <a href="mailto:${contributor.email}" style="color:var(--text-muted);">${contributor.email}</a></div>
                ${contributor.phone ? `<div style="display:flex; align-items:center; margin-top:4px;">${phoneIcon} ${contributor.phone}</div>` : ''}
                ${contributor.department ? `<div style="display:flex; align-items:center; margin-top:4px; font-weight: 500; color: var(--primary-color);">Department: ${contributor.department.charAt(0).toUpperCase() + contributor.department.slice(1)}</div>` : ''}
                <div style="display:flex; align-items:center; margin-top:4px;">${extraInfo}</div>
                <div style="display:flex; align-items:center; margin-top:4px;">${dateIcon} ${dateStr}</div>
                ${interviewDateStr ? `
                <div class="interview-date-row" data-date-val="${interviewDateStr}" data-uid="${contributor.interviewBookingUid || ''}" style="display:flex; align-items:center; margin-top:4px; font-weight: 600; color: #22c55e;">
                    ${interviewIcon} <span>${__('contributors.interview_date')}: ${interviewDateStr}</span>
                    ${contributor.interviewBookingUid ? `<span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px; font-weight:normal;">(UID: ${contributor.interviewBookingUid})</span>` : ''}
                </div>` : ''}
            </div>
            ${contributor.about ? `<div style="font-size: 0.9rem; padding:12px; background: rgba(128,128,128,0.05); border-left: 3px solid var(--primary-color); border-radius:4px; margin-top:10px; color: var(--text-color);">${contributor.about}</div>` : ''}
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
}
