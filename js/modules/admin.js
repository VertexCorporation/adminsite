// js/modules/admin.js

import { showToast, __ } from '../utils/ui.js';
import * as dom from '../utils/dom.js';
import { addAdminRoleFn, getServerStatusFn, setServerStatusFn, triggerAttributionsUpdateFn } from '../core/firebase.js';

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
}