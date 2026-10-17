import { icon } from '../utils/icons.js';
import { confirmDialog } from './shell.js';
import { displayDepartmentName } from '../utils/departments.js';
import { beginPanelLoading, skeletonListItem, skeletonChatMessage, setButtonLoading } from '../utils/loading.js';
// js/modules/admin.js

import { showToast, userErrorMessage, __, onLangChange, sanitizeHTML } from '../utils/ui.js';
import * as dom from '../utils/dom.js';
import { auth, addAdminRoleFn, getServerStatusFn, setServerStatusFn, getBackupHealthStatusFn, triggerAttributionsUpdateFn, toggleVertexStatusFn, toggleContributorVerificationFn, removeAdminRoleFn, listAdminsFn, verifyUserEmailFn, setUserDepartmentFn, setUserDepartmentsFn, listDepartmentUsersFn, setUserSubscriptionFn, bulkSetUserSubscriptionsFn } from '../core/firebase.js';
import { DEPARTMENTS, getEffectivePanelLevel, isPanelAdmin } from './roles.js';

// --- Module state for attributions ---
let attributionsOutOfSync = false;
let departmentUsers = [];

// --- Premium Abonelik Atama (grantPremium) ---
// Admin panelinin abonelik atama akışı: Fulcrum'daki setUserSubscription
// Cloud Function'ını çağırır. 1 yıl sınırı burada da zorlanır; asıl garanti
// sunucu tarafındadır (validateAdminGrant).
const MAX_GRANT_TOLERANCE_MS = 60 * 1000;

/**
 * Kullanıcının hesabına Plus/Pro/Ultra abonelik tanımlar.
 * @param {object} input
 * @param {string} input.email Hesabın Gmail adresi (zorunlu).
 * @param {string} [input.displayName] Panel listesinde görünen kullanıcı ismi.
 * @param {'plus'|'pro'|'ultra'} input.tier Abonelik seviyesi (zorunlu).
 * @param {string|Date|number} input.expiresAt Bitiş zamanı (zorunlu, en fazla 1 yıl).
 * @returns {Promise<object>} Sunucudan dönen { success, uid, tier, expiresAtMillis }.
 */
export async function grantPremium({ email, displayName = '', tier, expiresAt }) {
    if (!email || !tier || !expiresAt) {
        throw new Error(__('subs.required'));
    }
    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime())) {
        throw new Error(__('subs.invalid_date'));
    }
    const maxExpiry = new Date();
    maxExpiry.setFullYear(maxExpiry.getFullYear() + 1);
    if (expiryDate.getTime() - maxExpiry.getTime() > MAX_GRANT_TOLERANCE_MS) {
        throw new Error(__('subs.max_one_year'));
    }

    const result = await setUserSubscriptionFn({
        email: String(email).trim(),
        displayName: displayName ? String(displayName).trim() : null,
        tier,
        expiresAt: expiryDate.toISOString(),
    });
    return result.data;
}

/**
 * Toplu abonelik atama: ham postalistesini sunucuya ilettiği gibi gönderir;
 * ayırma/dogrulama/batch sunucuda yapılır (bulkSetUserSubscriptions).
 * Seviye ve bitiş zamanı tüm adreslere uygulanır; süre sınırı burada da kontrol edilir.
 * @param {object} input
 * @param {string} input.raw Yapıştırılan ham posta listesi (virgül/boşluk/alt alta — karışık olabilir).
 * @param {'plus'|'pro'|'ultra'} input.tier Abonelik seviyesi (zorunlu).
 * @param {string|Date|number} input.expiresAt Bitiş zamanı (zorunlu, en fazla 1 yıl).
 * @returns {Promise<object>} { success, valid, grantedCount, failedCount, failed, invalidTokens }
 */
export async function grantPremiumBulk({ raw, tier, expiresAt }) {
    if (!raw || !tier || !expiresAt) {
        throw new Error(__('subs.required'));
    }
    const expiryDate = new Date(expiresAt);
    if (isNaN(expiryDate.getTime())) {
        throw new Error(__('subs.invalid_date'));
    }
    const maxExpiry = new Date();
    maxExpiry.setFullYear(maxExpiry.getFullYear() + 1);
    if (expiryDate.getTime() - maxExpiry.getTime() > MAX_GRANT_TOLERANCE_MS) {
        throw new Error(__('subs.max_one_year'));
    }

    const result = await bulkSetUserSubscriptionsFn({
        raw: String(raw),
        tier,
        expiresAt: expiryDate.toISOString(),
    });
    return result.data;
}

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
                <div class="dept-badges">${user.departments.map(id => `<span class="dept-badge">${sanitizeHTML(displayDepartmentName(id))}</span>`).join('')}</div>
            </div>
            ${getEffectivePanelLevel('system.deptUsers') === 'write' ? `<button type="button" class="dept-user-edit chrome-btn-outline" data-uid="${sanitizeHTML(user.uid)}">${__('dept.edit')}</button>` : ''}
        </div>
    `).join('');
}

async function loadDepartmentUsers() {
    const container = document.getElementById('dept-users-list');
    const button = document.getElementById('refresh-dept-users-btn');
    const finishLoading = beginPanelLoading(container);
    setButtonLoading(button,true);
    try {
        const users = [];
        let pageToken;const tokens=new Set();
        do {
            const result = await listDepartmentUsersFn({ pageToken: pageToken || null });
            if(!Array.isArray(result.data?.users))throw Object.assign(new Error('Invalid user list'),{code:'functions/internal'});
            users.push(...result.data.users);
            pageToken = result.data.nextPageToken || null;
            if(pageToken){if(tokens.has(pageToken)||tokens.size>=100)throw Object.assign(new Error('Invalid pagination'),{code:'functions/internal'});tokens.add(pageToken);}
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
        finishLoading();
        console.error('[CLIENT] Error loading department users:', error);
        container.innerHTML = `<div class="state-block"><p data-i18n="dept.load_error">${__('dept.load_error')}</p><button type="button" class="chrome-btn-outline" data-i18n="common.retry">${__('common.retry')}</button></div>`;container.querySelector('button').onclick=loadDepartmentUsers;
    } finally {
        finishLoading();
        setButtonLoading(button,false);
    }
}

/**
 * Updates the maintenance mode UI based on the server's status.
 * @param {boolean} isEnabled - True if maintenance mode is active.
 */
let maintenanceState = null;
let maintenancePending = false;
function updateMaintenanceUI(isEnabled = maintenanceState) {
    maintenanceState = isEnabled;
    const button = dom.maintenanceActionBtn;
    if (!button || !dom.maintenanceStatusIndicator) return;

    dom.maintenanceStatusIndicator.querySelector('.status-dot').className =
        'status-dot ' + (isEnabled === null ? 'status-pending' : isEnabled ? 'status-on' : 'status-off');
    dom.maintenanceStatusIndicator.querySelector('.status-text').textContent =
        __(isEnabled === null ? 'system.status_unavailable' : isEnabled ? 'system.maintenance_on' : 'system.live');

    button.classList.add('chrome-btn-outline');
    button.classList.remove('secondary-btn');
    button.classList.toggle('is-maintenance-active', isEnabled === true);
    button.classList.toggle('is-pending', maintenancePending);
    button.classList.toggle('retry-btn', isEnabled === null);
    button.disabled = maintenancePending || (isEnabled !== null && getEffectivePanelLevel('system.serverStatus') !== 'write');
    button.textContent = __(maintenancePending ? 'system.saving' : isEnabled === null ? 'common.retry' : isEnabled ? 'system.disable_maint' : 'system.enable_maint');

    // Bakım modu açıkken panelde belirgin ve açık uyarı kutusu göster
    const panel = document.getElementById('server-status-manager');
    if (panel) {
        let warningBox = panel.querySelector('#maintenance-warning-box');
        if (isEnabled === true) {
            if (!warningBox) {
                warningBox = document.createElement('div');
                warningBox.id = 'maintenance-warning-box';
                warningBox.className = 'confirm-dialog-warning';
                warningBox.style.marginTop = '12px';
                warningBox.setAttribute('role', 'alert');
                panel.querySelector('.status-action-box')?.after(warningBox);
            }
            warningBox.innerHTML = `<strong>${icon('alert-triangle', { size: 16 })}</strong> <span>${__('system.maintenance_warning_banner')}</span>`;
            warningBox.hidden = false;
        } else if (warningBox) {
            warningBox.hidden = true;
        }
    }
}

export async function initializeMaintenanceStatus() {
    if (maintenancePending) return;
    maintenancePending = true;
    updateMaintenanceUI();
    try {
        const result = await getServerStatusFn();
        maintenanceState = typeof result?.data?.isUnderMaintenance === 'boolean' ? result.data.isUnderMaintenance : null;
    } catch {
        maintenanceState = null;
        showToast(() => __('system.status_unavailable'), 'error');
    } finally {
        maintenancePending = false;
        updateMaintenanceUI();
    }
}

async function handleMaintenanceToggle() {
    if (maintenancePending) return;
    if (maintenanceState === null) return initializeMaintenanceStatus();
    if (getEffectivePanelLevel('system.serverStatus') !== 'write') return;

    const next = !maintenanceState;
    const confirmed = await confirmDialog(() => ({
        title: next ? __('system.enable_maint') : __('system.disable_maint'),
        body: next ? __('system.maintenance_confirm') : __('system.disable_maint_confirm'),
        confirmLabel: next ? __('system.enable_maint') : __('system.disable_maint'),
        danger: next // Bakım modunu açmak tehlikeli (girişleri durdurur)
    }));
    if (!confirmed) return;

    const button = dom.maintenanceActionBtn;
    maintenancePending = true;
    updateMaintenanceUI();
    setButtonLoading(button, true);

    try {
        await setServerStatusFn({ maintenanceEnabled: next });
        maintenanceState = next;
        showToast(() => __('system.maint_updated'), 'success');
    } catch (err) {
        // Hata durumunda durum bozulmaz; kullanıcıya gerçek hata bildirilir
        showToast(() => userErrorMessage(err), 'error');
    } finally {
        maintenancePending = false;
        setButtonLoading(button, false);
        updateMaintenanceUI();
    }
}

/**
 * GCS Yedekleme Sağlık Kontrolü (Madde 14)
 * Yapılandırma varlığı ile gerçek yedekleme sağlığını ayırır.
 */
export async function loadBackupHealthStatus() {
    const card = document.getElementById('gcs-backup-status');
    if (!card) return;
    const description = document.getElementById('gcs-backup-desc');
    const badge = document.getElementById('gcs-backup-badge');
    const refresh = document.getElementById('refresh-backup-btn');
    if (refresh) setButtonLoading(refresh, true);
    try {
        const {data} = await getBackupHealthStatusFn({});
        if (!data || typeof data !== 'object') throw Object.assign(new Error('Invalid backup response'), {code:'functions/internal'});
        // Previous deployed versions only checked object age; never label those verified.
        const verified = data.healthy === true && data.status === 'healthy' && data.evidence?.verified === true;
        const status = verified ? 'healthy' : data.configured === false ? 'unconfigured' :
            data.status === 'stale' ? 'stale' : data.status === 'empty' ? 'empty' : 'unverifiable';
        const keys = {healthy:'system.backup_healthy',stale:'system.backup_stale',
            empty:'system.backup_empty',unconfigured:'system.backup_unconfigured',
            unverifiable:'system.backup_unverifiable'};
        if (badge) {
            badge.className = 'status-badge' + (status === 'healthy' ? ' status-badge--success' : status === 'stale' ? ' status-badge--warning' : '');
            badge.textContent = __(keys[status]);
        }
        const locale = document.documentElement.lang === 'tr' ? 'tr-TR' : 'en-GB';
        const date = value => {
            const d = value && new Date(value);
            return d && Number.isFinite(d.getTime()) ? d.toLocaleString(locale) : '—';
        };
        const fields = [];
        fields.push(__('system.backup_checked') + ' ' + date(data.checkedAt));
        if (data.lastBackupDate) fields.push(__(verified ? 'system.backup_last_success' : 'system.backup_last_observed') + ' ' + date(data.lastBackupDate));
        if (Number.isFinite(data.sizeBytes)) fields.push(__('system.backup_size') + ' ' + Math.round(data.sizeBytes / 1024) + ' KB');
        fields.push(__('system.backup_restore') + ' ' + (data.restoreStatus === 'verified' ? __('system.backup_restore_verified') : __('system.backup_restore_unknown')));
        if (status === 'unverifiable' || status === 'empty' || status === 'unconfigured')
            fields.push(__(keys[status]));
        if (status === 'stale') fields.push(__('system.backup_stale'));
        if (description) description.textContent = fields.join(' · ');
    } catch (error) {
        if (badge) {badge.className = 'status-badge';badge.textContent = __('system.backup_unverifiable');}
        if (description) description.textContent = userErrorMessage(error);
    } finally {
        if (refresh) setButtonLoading(refresh, false);
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
    grantBtn.innerHTML = `<span data-i18n="admin.granting">${__('admin.granting')}</span>`;

    try {
        const result = await addAdminRoleFn({ email: newAdminEmail });
        showToast(() => __('admin.grant_success'), 'success');
        dom.adminForm.reset();
    } catch (error) {
        console.error("[CLIENT] Error granting admin role:", error);
        showToast(() => userErrorMessage(error), 'error');
    } finally {
        grantBtn.disabled = false;
        grantBtn.textContent = __('admin.grant_btn');
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
        actionBtn.classList.add('chrome-btn-outline','btn-update');
        actionBtn.innerHTML = `<span data-i18n="system.attributions_publish">${__('system.attributions_publish')}</span>`;
    } else {
        statusDot.className = 'status-dot status-synced';
        statusText.textContent = __('system.attributions_synced');
        actionBtn.disabled = true;
        actionBtn.classList.add('chrome-btn-outline');actionBtn.classList.remove('secondary-btn','btn-update');
        actionBtn.innerHTML = `<span data-i18n="system.attributions_uptodate">${__('system.attributions_uptodate')}</span>`;
    }
}

/**
 * Public function to be called from other modules to flag that an update is needed.
 */
export function setAttributionsOutOfSync() {
    if (attributionsOutOfSync === false) {
        attributionsOutOfSync = true;
        updateAttributionsUI();
        showToast(() => __('system.attributions_hint'), 'info');
    }
}

/**
 * Handles the click event to trigger the GitHub Action workflow.
 */
async function handleAttributionsUpdate() {
    const actionBtn = document.getElementById('attributions-action-btn');
    actionBtn.disabled = true;
    actionBtn.innerHTML = `<span data-i18n="system.attributions_trigger">${__('system.attributions_trigger')}</span>`;
    
    try {
        const result = await triggerAttributionsUpdateFn();
        showToast(() => __('system.attributions_synced'), 'success');
        // On success, reset the state
        attributionsOutOfSync = false;
        updateAttributionsUI();
    } catch (error) {
        console.error("[CLIENT] Error triggering attributions update:", error);
        showToast(() => userErrorMessage(error), 'error');
        // Re-enable the button on failure so the user can try again
        actionBtn.disabled = false;
        actionBtn.textContent = __('common.retry');
    }
}


/**
 * Handles the submission of the form to toggle a user's isVertex status.
 * @param {Event} e - The form submission event.
 */
let vertexPending=false;
function updateVertexResult(){const output=document.getElementById('vertex-operation-result');if(output)output.textContent=output.dataset.uid+' · '+__(output.dataset.state==='true'?'system.vertex_enabled':output.dataset.state==='false'?'system.vertex_disabled':'system.vertex_result_unknown');}
async function handleVertexStatusToggle(e) {
    e.preventDefault();
    const targetUid=document.getElementById('vertex-target-uid').value.trim();
    const button=document.getElementById('toggle-vertex-btn');
    if(button.disabled||getEffectivePanelLevel('contributors.vertexStatus')!=='write')return;
    if(!targetUid||targetUid.length>128||/\s/.test(targetUid)){showToast(() => __('system.uid_invalid'),'error');return;}
    if(!await confirmDialog(()=>({title:__('panel.contributors.vertexStatus'),body:__('system.vertex_confirm'),rows:[{label:'UID',value:targetUid}]})))return;
    vertexPending=true;button.disabled=true;button.textContent=__('system.saving');
    try{const result=await toggleVertexStatusFn({targetUid});
        let output=document.getElementById('vertex-operation-result');if(!output){output=document.createElement('p');output.id='vertex-operation-result';output.className='form-hint';output.setAttribute('role','status');button.after(output);}
        output.dataset.uid=targetUid;output.dataset.state=String(result.data.isVertex);updateVertexResult();
    }catch{showToast(() => __('system.error'),'error');}
    finally{vertexPending=false;button.disabled=false;button.textContent=__('panel.contributors.vertexStatus');}
}

/**
 * Handles the submission to manually verify a contributor by ID.
 */
async function handleManualVerifySubmit(e) {
    e.preventDefault();
    const identifier = document.getElementById('verify-user-id').value;
    const btn = document.querySelector('#verify-user-form button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span data-i18n="system.saving">${__('system.saving')}</span>`;

    try {
        const result = await verifyUserEmailFn({ identifier });
        showToast(() => __('system.verify_success'), 'success');
        document.getElementById('verify-user-form').reset();
    } catch (error) {
        console.error("[CLIENT] Error verifying email:", error);
        showToast(() => userErrorMessage(error), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span data-i18n="system.verify_btn">${__('system.verify_btn')}</span>`;
    }
}

/**
 * Handles the submission to remove admin privileges from a user.
 */
/**
 * Fetches and displays the list of active administrators.
 */
export async function loadAdminsList() {
    const container = document.getElementById('admin-list-container');
    if (!container) return;
    
    const finishLoading = beginPanelLoading(container);

    try {
        const result = await listAdminsFn();
        console.log("[CLIENT] listAdmins response:", result);
        const admins = result.data.admins;
        const debug = result.data.debug;
        
        if (!admins || admins.length === 0) {
            container.innerHTML = `<p class="form-hint dept-list-message" data-i18n="system.admins_empty">${__('system.admins_empty')}</p>`;
            return;
        }

        container.innerHTML=admins.map(admin=>`<div class="admin-user-row"><div><strong>${sanitizeHTML(admin.email)}</strong><small>${sanitizeHTML(admin.uid||'')}</small></div>${isPanelAdmin()?`<button type="button" class="icon-action-btn" data-revoke-admin="${sanitizeHTML(admin.uid||'')}" title="${__('system.remove_admin')}" aria-label="${__('system.remove_admin')}" ${admins.length<2||admin.uid===auth.currentUser?.uid||!admin.uid||!admin.email?'disabled':''}>${icon('user-minus')}</button>`:''}</div>`).join('');
        container.querySelectorAll('[data-revoke-admin]').forEach(button=>button.onclick=async()=>{
            const target=admins.find(admin=>admin.uid===button.dataset.revokeAdmin);
            if(!isPanelAdmin()||!target||target.uid===auth.currentUser?.uid||admins.length<2||button.disabled)return;
            button.disabled=true;
            try {
                if(!await confirmDialog(()=>({title:__('system.remove_admin'),warning:__('admin.revoke_confirm'),rows:[{label:__('contributors.field_email'),value:sanitizeHTML(target.email)}]})))return;
                await removeAdminRoleFn({email:target.email});showToast(()=>__('system.remove_success'),'success');await loadAdminsList();
            } catch(error){showToast(()=>userErrorMessage(error),'error');}
            finally{if(button.isConnected)button.disabled=false;}
        });
    } catch (error) {
        finishLoading();
        console.error("[CLIENT] Error loading admins list:", error);
        container.innerHTML=`<div class="state-block"><p data-i18n="errors.service">${__('errors.service')}</p><button class="chrome-btn-outline" data-i18n="common.retry">${__('common.retry')}</button></div>`;container.querySelector('button').onclick=loadAdminsList;
    } finally { finishLoading(); }
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
        showToast(() => __('dept.select_hint'), 'error');
        return;
    }
    const btn = document.querySelector('#dept-assign-form button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = `<span data-i18n="system.saving">${__('system.saving')}</span>`;

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
        showToast(() => __('dept.assign_success'), 'success');
        document.getElementById('dept-assign-form').reset();
        await loadDepartmentUsers();
    } catch (error) {
        console.error("[CLIENT] Error assigning department:", error);
        showToast(() => userErrorMessage(error), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="" data-icon="assignment_ind"></i><span data-i18n="dept.assign_btn">${__('dept.assign_btn')}</span>`;
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
        document.querySelectorAll('[data-revoke-admin]').forEach(button=>{button.title=__('system.remove_admin');button.setAttribute('aria-label',__('system.remove_admin'));});
        renderDepartmentOptions();
        updateMaintenanceUI();updateAttributionsUI();
        const grant=document.getElementById('grant-admin-btn');grant.textContent=__(grant.disabled?'admin.granting':'admin.grant_btn');
        const vertex=document.getElementById('toggle-vertex-btn');if(vertex)vertex.textContent=__(vertexPending?'system.saving':'panel.contributors.vertexStatus');
        updateVertexResult();
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


    const refreshAdminsBtn = document.getElementById('refresh-admins-btn');
    if (refreshAdminsBtn) {
        refreshAdminsBtn.addEventListener('click', loadAdminsList);
    }
    
    const refreshBackupBtn = document.getElementById('refresh-backup-btn');
    if (refreshBackupBtn) {
        refreshBackupBtn.addEventListener('click', loadBackupHealthStatus);
    }

    const deptAssignForm = document.getElementById('dept-assign-form');
    if (deptAssignForm) deptAssignForm.addEventListener('submit', handleDeptAssignSubmit);
    
    // Load admins list initially (giris oncesi cagrilmaz; login akisi yeniden cagirir)
    if (auth && auth.currentUser) {
        loadAdminsList();
        loadBackupHealthStatus();
    }
}
