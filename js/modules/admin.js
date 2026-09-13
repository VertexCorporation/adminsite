// js/modules/admin.js

import { showToast, __, onLangChange, sanitizeHTML } from '../utils/ui.js';
import * as dom from '../utils/dom.js';
import { addAdminRoleFn, getServerStatusFn, setServerStatusFn, triggerAttributionsUpdateFn, toggleVertexStatusFn, toggleContributorVerificationFn, removeAdminRoleFn, listAdminsFn, verifyUserEmailFn, setUserDepartmentFn, setUserDepartmentsFn, listDepartmentUsersFn } from '../core/firebase.js';
import { DEPARTMENTS } from './roles.js';

// --- Module state for attributions ---
let attributionsOutOfSync = false;
let departmentUsers = [];

function selectedDepartments() {
    return [...document.querySelectorAll('#dept-options input:checked')].map(input => input.value);
}

function renderDepartmentOptions() {
    const container = document.getElementById('dept-options');
    const selected = new Set(selectedDepartments());
    container.replaceChildren();
    DEPARTMENTS.forEach(dept => {
        const label = document.createElement('label');
        label.className = 'dept-choice';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = dept.id;
        input.checked = selected.has(dept.id);
        label.append(input, document.createTextNode(__(dept.nameKey)));
        container.append(label);
    });
}

function renderDepartmentUsers() {
    const container = document.getElementById('dept-users-list');
    const query = document.getElementById('dept-users-search').value.trim().toLocaleLowerCase();
    const filtered = departmentUsers.filter(user =>
        [user.displayName, user.email, ...(user.departments || [])]
            .some(value => String(value || '').toLocaleLowerCase().includes(query))
    );
    if (!filtered.length) {
        container.innerHTML = `<p class="form-hint dept-list-message">${query ? __('dept.no_match') : __('dept.empty')}</p>`;
        return;
    }
    container.innerHTML = filtered.map(user => `
        <div class="dept-user-row">
            <div class="dept-user-main">
                <strong>${sanitizeHTML(user.displayName || user.email || user.uid)}</strong>
                ${user.displayName ? `<span>${sanitizeHTML(user.email || '')}</span>` : ''}
                <div class="dept-badges">${user.departments.map(id => `<span class="dept-badge">${sanitizeHTML(id)}</span>`).join('')}</div>
            </div>
            <button type="button" class="dept-user-edit chrome-btn-outline" data-uid="${sanitizeHTML(user.uid)}">${__('dept.edit')}</button>
        </div>
    `).join('');
}

async function loadDepartmentUsers() {
    const container = document.getElementById('dept-users-list');
    const button = document.getElementById('refresh-dept-users-btn');
    container.innerHTML = `<p class="form-hint dept-list-message">${__('dept.loading')}</p>`;
    button.disabled = true;
    try {
        const users = [];
        let pageToken;
        do {
            const result = await listDepartmentUsersFn({ pageToken: pageToken || null });
            users.push(...(result.data.users || []));
            pageToken = result.data.nextPageToken || null;
        } while (pageToken);
        departmentUsers = users.map(user => ({
            uid: String(user.uid || ''),
            email: String(user.email || ''),
            displayName: String(user.displayName || ''),
            departments: Array.isArray(user.departments) ? user.departments : (user.department ? [user.department] : [])
        })).filter(user => user.departments.length);
        departmentUsers.sort((a, b) => a.email.localeCompare(b.email));
        renderDepartmentUsers();
    } catch (error) {
        console.error('[CLIENT] Error loading department users:', error);
        container.innerHTML = `<p class="form-hint dept-list-message">${__('dept.load_error')}</p>`;
    } finally {
        button.disabled = false;
    }
}

/**
 * Updates the maintenance mode UI based on the server's status.
 * @param {boolean} isEnabled - True if maintenance mode is active.
 */
function updateMaintenanceUI(isEnabled) {
    const statusDot = dom.maintenanceStatusIndicator.querySelector('.status-dot');
    const statusText = dom.maintenanceStatusIndicator.querySelector('.status-text');

    if (!statusDot || !statusText || !dom.maintenanceActionBtn) return;

    statusDot.className = 'status-dot'; // Reset classes
    statusDot.classList.add(isEnabled ? 'status-on' : 'status-off');
    statusText.textContent = isEnabled ? __('system.maintenance_on') : __('system.live');

    dom.maintenanceActionBtn.innerHTML = `<span>${isEnabled ? __('system.disable_maint') : __('system.enable_maint')}</span>`;
    dom.maintenanceActionBtn.className = 'secondary-btn'; // Reset classes
    if (isEnabled) {
        dom.maintenanceActionBtn.classList.add('btn-disable');
    }
}

/**
 * Fetches the current maintenance status and sets up the interactive UI.
 */
async function initializeMaintenanceStatus() {
    const statusText = dom.maintenanceStatusIndicator.querySelector('.status-text');
    try {
        const result = await getServerStatusFn();
        const isEnabled = result.data.isUnderMaintenance;
        updateMaintenanceUI(isEnabled);
        dom.maintenanceActionBtn.disabled = false;
    } catch (error) {
        console.error('[CLIENT] Could not fetch server status:', error);
        if (statusText) statusText.textContent = __('system.checking');
        dom.maintenanceActionBtn.innerHTML = `<span>${__('system.retry')}</span>`;
        dom.maintenanceActionBtn.disabled = true;
        showToast(`Could not load server status: ${error.message}`, 'error');
    }
}

/**
 * Handles the click event on the maintenance action button to toggle the mode.
 */
async function handleMaintenanceToggle() {
    const statusDot = dom.maintenanceStatusIndicator.querySelector('.status-dot');
    const currentState = statusDot.classList.contains('status-on');
    const newState = !currentState;

    dom.maintenanceActionBtn.disabled = true;
    dom.maintenanceActionBtn.innerHTML = `<span>${__('system.saving')}</span>`;

    try {
        await setServerStatusFn({ maintenanceEnabled: newState });
        updateMaintenanceUI(newState);
        showToast(__('system.maint_updated'), 'success');
    } catch (error) {
        console.error('[CLIENT] Failed to set maintenance mode:', error);
        showToast(`Error: ${error.message}`, 'error');
        updateMaintenanceUI(currentState); // Revert UI to the last known state
    } finally {
        dom.maintenanceActionBtn.disabled = false;
    }
}

/**
 * Handles the submission of the form to grant a user admin privileges.
 * @param {Event} e - The form submission event.
 */
async function handleAdminFormSubmit(e) {
    e.preventDefault();
    const newAdminEmail = document.getElementById('new-admin-email').value;
    const grantBtn = document.getElementById('grant-admin-btn');
    grantBtn.disabled = true;
    grantBtn.innerHTML = `<span>${__('admin.granting')}</span>`;

    try {
        const result = await addAdminRoleFn({ email: newAdminEmail });
        showToast(result.data.message, 'success');
        dom.adminForm.reset();
    } catch (error) {
        console.error("[CLIENT] Error granting admin role:", error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        grantBtn.disabled = false;
        grantBtn.textContent = 'Grant Admin Role';
    }
}

/**
 * Updates the UI of the attributions manager based on the sync state.
 */
function updateAttributionsUI() {
    const statusDot = document.querySelector('#attributions-status-indicator .status-dot');
    const statusText = document.querySelector('#attributions-status-indicator .status-text');
    const actionBtn = document.getElementById('attributions-action-btn');

    if (!statusDot || !statusText || !actionBtn) return;

    if (attributionsOutOfSync) {
        statusDot.className = 'status-dot status-pending';
        statusText.textContent = __('system.attributions_pending');
        actionBtn.disabled = false;
        actionBtn.className = 'secondary-btn btn-update';
        actionBtn.innerHTML = `<span>${__('system.attributions_publish')}</span>`;
    } else {
        statusDot.className = 'status-dot status-synced';
        statusText.textContent = __('system.attributions_synced');
        actionBtn.disabled = true;
        actionBtn.className = 'secondary-btn';
        actionBtn.innerHTML = `<span>${__('system.attributions_uptodate')}</span>`;
    }
}

/**
 * Public function to be called from other modules to flag that an update is needed.
 */
export function setAttributionsOutOfSync() {
    if (attributionsOutOfSync === false) {
        attributionsOutOfSync = true;
        updateAttributionsUI();
        showToast("Attributions page needs an update. Click 'Publish Changes' when ready.", 'info');
    }
}

/**
 * Handles the click event to trigger the GitHub Action workflow.
 */
async function handleAttributionsUpdate() {
    const actionBtn = document.getElementById('attributions-action-btn');
    actionBtn.disabled = true;
    actionBtn.innerHTML = `<span>${__('system.attributions_trigger')}</span>`;
    
    try {
        const result = await triggerAttributionsUpdateFn();
        showToast(result.data.message, 'success');
        // On success, reset the state
        attributionsOutOfSync = false;
        updateAttributionsUI();
    } catch (error) {
        console.error("[CLIENT] Error triggering attributions update:", error);
        showToast(`Error: ${error.message}`, 'error');
        // Re-enable the button on failure so the user can try again
        actionBtn.disabled = false;
        actionBtn.textContent = 'Retry Publish';
    }
}


/**
 * Handles the submission of the form to toggle a user's isVertex status.
 * @param {Event} e - The form submission event.
 */
async function handleVertexStatusToggle(e) {
    e.preventDefault();
    const targetUid = document.getElementById('vertex-target-uid').value;
    const toggleBtn = document.getElementById('toggle-vertex-btn');
    toggleBtn.disabled = true;
    toggleBtn.innerHTML = `<span>Updating...</span>`;

    try {
        const result = await toggleVertexStatusFn({ targetUid });
        showToast(result.data.message, 'success');
        document.getElementById('vertex-status-form').reset();
    } catch (error) {
        console.error("[CLIENT] Error toggling vertex status:", error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        toggleBtn.disabled = false;
        toggleBtn.innerHTML = `<span class="material-symbols-rounded">swap_vert</span><span>Toggle isVertex Status</span>`;
    }
}

/**
 * Handles the submission to manually verify a contributor by ID.
 */
async function handleManualVerifySubmit(e) {
    e.preventDefault();
    const identifier = document.getElementById('verify-user-id').value;
    const btn = document.querySelector('#verify-user-form button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span>${__('system.saving')}</span>`;

    try {
        const result = await verifyUserEmailFn({ identifier });
        showToast(__('system.verify_success'), 'success');
        document.getElementById('verify-user-form').reset();
    } catch (error) {
        console.error("[CLIENT] Error verifying email:", error);
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>${__('system.verify_btn')}</span>`;
    }
}

/**
 * Handles the submission to remove admin privileges from a user.
 */
async function handleRemoveAdminSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('remove-admin-email').value;
    const btn = document.querySelector('#remove-admin-form button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span>${__('system.saving')}</span>`;

    try {
        const result = await removeAdminRoleFn({ email });
        showToast(__('system.remove_success'), 'success');
        document.getElementById('remove-admin-form').reset();
        loadAdminsList(); // Refresh the list
    } catch (error) {
        console.error("[CLIENT] Error removing admin role:", error);
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>${__('system.remove_btn')}</span>`;
    }
}

/**
 * Fetches and displays the list of active administrators.
 */
async function loadAdminsList() {
    const container = document.getElementById('admin-list-container');
    if (!container) return;
    
    container.innerHTML = `<p class="form-hint" style="text-align:center; padding: 1rem;">${__('system.loading_admins')}</p>`;

    try {
        const result = await listAdminsFn();
        console.log("[CLIENT] listAdmins response:", result);
        const admins = result.data.admins;
        const debug = result.data.debug;
        
        if (!admins || admins.length === 0) {
            let debugInfo = '';
            if (debug) {
                debugInfo = `<br><small style="color: var(--text-muted);">Scanned: ${debug.totalScanned} users | Users with claims: ${debug.usersWithClaims}</small>`;
                if (debug.claimsLog && debug.claimsLog.length > 0) {
                    debugInfo += `<br><small style="color: var(--text-muted);">Claims found: ${JSON.stringify(debug.claimsLog)}</small>`;
                }
            }
            container.innerHTML = `<p class="form-hint" style="text-align:center; padding: 1rem;">Sistem yöneticisi bulunamadı.${debugInfo}</p>`;
            return;
        }

        let html = '';
        admins.forEach(admin => {
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color);">
                    <div>
                        <strong style="color: var(--text-primary);">${admin.email}</strong>
                        <div style="color: var(--text-secondary); font-size: 0.85rem;">UID: ${admin.uid}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error("[CLIENT] Error loading admins list:", error);
        const details = error.code ? `${error.code}: ${error.message}` : error.message;
        container.innerHTML = `<p class="form-hint" style="text-align:center; padding: 1rem; color: var(--accent-clay);">Hata: ${details}</p>`;
    }
}

/**
 * Handles the submission of the form to assign a department to a user.
 * @param {Event} e - The form submission event.
 */
async function handleDeptAssignSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('dept-user-email').value.trim();
    const departments = selectedDepartments();
    if (!departments.length) {
        showToast(__('dept.select_hint'), 'error');
        return;
    }
    const btn = document.querySelector('#dept-assign-form button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span>${__('system.saving')}</span>`;

    try {
        let result;
        try {
            result = await setUserDepartmentsFn({ email, departments });
        } catch (error) {
            if (error.code !== 'functions/not-found') throw error;
            if (departments.length !== 1) {
                throw new Error(__('dept.backend_required'));
            }
            result = await setUserDepartmentFn({ email, department: departments[0] });
        }
        showToast(result.data.message || __('dept.assign_success'), 'success');
        document.getElementById('dept-assign-form').reset();
        await loadDepartmentUsers();
    } catch (error) {
        console.error("[CLIENT] Error assigning department:", error);
        showToast(`${__('system.error')}: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-rounded">assignment_ind</span><span>${__('dept.assign_btn')}</span>`;
    }
}

/**
 * Initializes all event listeners and logic for the admin management module.
 */
export function refreshDepartmentUsers() {
    return loadDepartmentUsers();
}

export function initAdminModule() {
    renderDepartmentOptions();
    onLangChange(() => {
        renderDepartmentOptions();
        if (departmentUsers.length) renderDepartmentUsers();
    });
    document.getElementById('refresh-dept-users-btn').addEventListener('click', loadDepartmentUsers);
    document.getElementById('dept-users-search').addEventListener('input', renderDepartmentUsers);
    document.getElementById('dept-users-list').addEventListener('click', event => {
        const button = event.target.closest('.dept-user-edit');
        if (!button) return;
        const user = departmentUsers.find(item => item.uid === button.dataset.uid);
        if (!user) return;
        document.getElementById('dept-user-email').value = user.email;
        document.querySelectorAll('#dept-options input').forEach(input => {
            input.checked = user.departments.includes(input.value);
        });
        document.getElementById('dept-assign-manager').scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById('dept-user-email').focus({ preventScroll: true });
    });
    dom.adminForm.addEventListener('submit', handleAdminFormSubmit);
    dom.maintenanceActionBtn.addEventListener('click', handleMaintenanceToggle);
    initializeMaintenanceStatus();

    // Add listener for the new button and initialize its UI
    const attributionsBtn = document.getElementById('attributions-action-btn');
    if (attributionsBtn) {
        attributionsBtn.addEventListener('click', handleAttributionsUpdate);
    }
    updateAttributionsUI(); // Initial UI setup

    // Add listener for the Vertex Status toggle form
    const vertexForm = document.getElementById('vertex-status-form');
    if (vertexForm) {
        vertexForm.addEventListener('submit', handleVertexStatusToggle);
    }

    const verifyForm = document.getElementById('verify-user-form');
    if (verifyForm) verifyForm.addEventListener('submit', handleManualVerifySubmit);

    const removeAdminForm = document.getElementById('remove-admin-form');
    if (removeAdminForm) removeAdminForm.addEventListener('submit', handleRemoveAdminSubmit);

    const refreshAdminsBtn = document.getElementById('refresh-admins-btn');
    if (refreshAdminsBtn) {
        refreshAdminsBtn.addEventListener('click', loadAdminsList);
    }
    
    const deptAssignForm = document.getElementById('dept-assign-form');
    if (deptAssignForm) deptAssignForm.addEventListener('submit', handleDeptAssignSubmit);
    
    // Load admins list initially
    loadAdminsList();
}
