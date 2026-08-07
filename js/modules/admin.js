// js/modules/admin.js

import { showToast, __ } from '../utils/ui.js';
import * as dom from '../utils/dom.js';
import { addAdminRoleFn, getServerStatusFn, setServerStatusFn, triggerAttributionsUpdateFn, toggleVertexStatusFn, toggleContributorVerificationFn, removeAdminRoleFn, listAdminsFn } from '../core/firebase.js';

// --- Module state for attributions ---
let attributionsOutOfSync = false;

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
    const contributorId = document.getElementById('verify-user-id').value;
    const btn = document.querySelector('#verify-user-form button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span>${__('system.saving')}</span>`;

    try {
        const result = await toggleContributorVerificationFn({ contributorId, hasVerified: true });
        showToast("Contributor successfully verified.", 'success');
        document.getElementById('verify-user-form').reset();
    } catch (error) {
        console.error("[CLIENT] Error verifying contributor:", error);
        showToast(`Error: ${error.message}`, 'error');
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
        showToast(result.data.message, 'success');
        document.getElementById('remove-admin-form').reset();
        loadAdminsList(); // Refresh the list
    } catch (error) {
        console.error("[CLIENT] Error removing admin role:", error);
        showToast(`Error: ${error.message}`, 'error');
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
        const admins = result.data.admins;
        
        if (!admins || admins.length === 0) {
            container.innerHTML = `<p class="form-hint" style="text-align:center; padding: 1rem;">Sistem yöneticisi bulunamadı.</p>`;
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
        container.innerHTML = `<p class="form-hint" style="text-align:center; padding: 1rem; color: var(--accent-clay);">Hata: ${error.message}</p>`;
    }
}

/**
 * Initializes all event listeners and logic for the admin management module.
 */
export function initAdminModule() {
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
    
    // Load admins list initially
    loadAdminsList();
}