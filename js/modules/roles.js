// js/modules/roles.js

import { db, saveDepartmentPermissionsFn } from '../core/firebase.js';
import { showToast, __, onLangChange } from '../utils/ui.js';

const TABS = [
    { id: 'contributors', icon: 'group', key: 'nav.contributors' },
    { id: 'models', icon: 'smart_toy', key: 'nav.models' },
    { id: 'news', icon: 'newspaper', key: 'nav.news' },
    { id: 'notifications', icon: 'notifications_active', key: 'nav.notifications' },
    { id: 'subscriptions', icon: 'workspace_premium', key: 'nav.subscriptions' },
    { id: 'system', icon: 'settings_ethernet', key: 'nav.system' }
];

const DEPARTMENTS = [
    { id: 'Essence', group: 'ust', nameKey: 'dept.essence' },
    { id: 'Core', group: 'ust', nameKey: 'dept.core' },
    { id: 'Senatus', group: 'ust', nameKey: 'dept.senatus' },
    { id: 'Tensor', group: 'ust', nameKey: 'dept.tensor' },
    { id: 'Curia', group: 'ust', nameKey: 'dept.curia' },
    { id: 'Pulse', group: 'orta', nameKey: 'dept.pulse' },
    { id: 'Chroma', group: 'orta', nameKey: 'dept.chroma' },
    { id: 'Catalyst', group: 'orta', nameKey: 'dept.catalyst' },
    { id: 'Envoy', group: 'orta', nameKey: 'dept.envoy' },
    { id: 'Aero', group: 'orta', nameKey: 'dept.aero' },
    { id: 'Array', group: 'orta', nameKey: 'dept.array' },
    { id: 'Scout', group: 'alt', nameKey: 'dept.scout' },
    { id: 'Vertest', group: 'alt', nameKey: 'dept.vertest' }
];

// Panel kataloğu: her sekmenin "kanalları" (panelleri). Matrix hücresi
// `${tabId}.*` genel seviyesini, Ayar paneli ise `${tabId}.${panelId}`
// özel seviyesini yazar. Seviyeler: none < read < write.
export const PANELS = {
    contributors: [
        { id: 'list', key: 'panel.contributors.list', icon: 'group_work' },
        { id: 'adminRole', key: 'panel.contributors.adminRole', icon: 'shield_person' },
        { id: 'vertexStatus', key: 'panel.contributors.vertexStatus', icon: 'verified_user' }
    ],
    models: [
        { id: 'manage', key: 'panel.models.manage', icon: 'add_circle' },
        { id: 'library', key: 'panel.models.library', icon: 'list_alt' }
    ],
    news: [
        { id: 'editor', key: 'panel.news.editor', icon: 'post_add' },
        { id: 'published', key: 'panel.news.published', icon: 'article' }
    ],
    notifications: [
        { id: 'sender', key: 'panel.notifications.sender', icon: 'campaign' },
        { id: 'scheduled', key: 'panel.notifications.scheduled', icon: 'calendar_month' }
    ],
    subscriptions: [
        { id: 'assign', key: 'panel.subscriptions.assign', icon: 'workspace_premium' },
        { id: 'list', key: 'panel.subscriptions.list', icon: 'history' }
    ],
    system: [
        { id: 'deptPerms', key: 'panel.system.deptPerms', icon: 'admin_panel_settings' },
        { id: 'deptAssign', key: 'panel.system.deptAssign', icon: 'person_add' },
        { id: 'deptUsers', key: 'panel.system.deptUsers', icon: 'groups' },
        { id: 'manualVerify', key: 'panel.system.manualVerify', icon: 'verified_user' },
        { id: 'removeAdmin', key: 'panel.system.removeAdmin', icon: 'person_remove' },
        { id: 'adminList', key: 'panel.system.adminList', icon: 'admin_panel_settings' },
        { id: 'serverStatus', key: 'panel.system.serverStatus', icon: 'dns' },
        { id: 'attributions', key: 'panel.system.attributions', icon: 'sync' },
        { id: 'exporter', key: 'panel.system.exporter', icon: 'download' }
    ]
};

const LEVELS = ['none', 'read', 'write'];
const LEVEL_RANK = { none: 0, read: 1, write: 2 };
const LEVEL_ICON = { none: 'close', read: 'visibility', write: 'edit' };
const HIDDEN_FIELD_OPTIONS = {
    contributors: [
        { tag: 'contact', key: 'perms.hidden_contact' },
        { tag: 'age', key: 'perms.hidden_age' },
        { tag: 'links', key: 'perms.hidden_links' },
        { tag: 'interview', key: 'perms.hidden_interview' }
    ]
};
const LEVEL_CLASS = { none: 'perm-none', read: 'perm-read', write: 'perm-write' };

let departmentPermissions = null; // { [deptId]: { panels: { [key]: level } } }
let currentUser = { isAdmin: false, departments: [] };
let detailTab = null;
let saveTimeout = null;

const wildcardKey = tabId => `${tabId}.*`;

function levelFor(dept, panelKey) {
    const entry = departmentPermissions?.[dept];
    if (!entry?.panels) return 'none';
    const direct = entry.panels[panelKey];
    const wildcard = entry.panels[wildcardKey(panelKey.split('.')[0])];
    return direct ?? wildcard ?? 'none';
}

function bestLevel(panelKey, deptList) {
    let best = 'none';
    for (const dept of deptList || []) {
        const level = levelFor(dept, panelKey);
        if (LEVEL_RANK[level] > LEVEL_RANK[best]) best = level;
    }
    return best;
}

function nextLevel(level) {
    return LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length];
}

// --- Current user context (main.js auth akışından beslenir) ---

export function setCurrentUser(isAdmin, departments) {
    currentUser = {
        isAdmin: !!isAdmin,
        departments: Array.isArray(departments) ? departments : []
    };
}

export function isPanelAdmin() {
    return currentUser.isAdmin;
}

/** Panel kartlarının (görünürlük + yazma affordansları) kullanacağı efektif seviye. */
export function getEffectivePanelLevel(panelKey) {
    if (currentUser.isAdmin) return 'write';
    if (!departmentPermissions) return 'none';
    return bestLevel(panelKey, currentUser.departments);
}

/** Sekme görünürlüğü: tab'ın herhangi bir paneli none değilse sekme açılır. */
export function getAccessibleTabs(departments) {
    if (!departmentPermissions) return [];
    return TABS
        .filter(tab => (PANELS[tab.id] || []).some(panel => bestLevel(`${tab.id}.${panel.id}`, departments) !== 'none'))
        .map(tab => tab.id);
}

export function departmentHasAccess(department, tabId) {
    if (!departmentPermissions) return false;
    const deptList = Array.isArray(department) ? department : [department];
    return (PANELS[tabId] || []).some(panel => bestLevel(`${tabId}.${panel.id}`, deptList) !== 'none');
}

// --- Document normalize (eski tab-dizisi şekli de desteklenir) ---

function normalizeDoc(raw) {
    const source = raw && typeof raw.departments === 'object' && raw.departments !== null
        ? raw.departments
        : (raw && typeof raw === 'object' ? raw : {});
    const departments = {};
    for (const [dept, value] of Object.entries(source)) {
        if (!dept) continue;
        if (Array.isArray(value)) {
            const panels = {};
            value.forEach(tabId => {
                if (typeof tabId === 'string' && tabId) panels[wildcardKey(tabId)] = 'read';
            });
            departments[dept] = { panels };
        } else if (value && typeof value === 'object') {
            const panels = {};
            const rawPanels = value.panels && typeof value.panels === 'object' ? value.panels : {};
            for (const [key, level] of Object.entries(rawPanels)) {
                if (typeof key === 'string' && key && LEVELS.includes(level)) panels[key] = level;
            }
            const entry = { panels };
            // hiddenFields: panel bazında gizlenecek alan grupları (PII maskeleme).
            if (value.hiddenFields && typeof value.hiddenFields === 'object' && !Array.isArray(value.hiddenFields)) {
                const hiddenFields = {};
                for (const [key, tags] of Object.entries(value.hiddenFields)) {
                    if (typeof key === 'string' && key && Array.isArray(tags)) {
                        const valid = tags.filter(tag => typeof tag === 'string' && tag);
                        if (valid.length) hiddenFields[key] = valid;
                    }
                }
                if (Object.keys(hiddenFields).length) entry.hiddenFields = hiddenFields;
            }
            departments[dept] = entry;
        }
    }
    return departments;
}

function seedDefaults() {
    const panels = {};
    TABS.forEach(tab => { panels[wildcardKey(tab.id)] = 'write'; });
    const readPanels = {};
    TABS.forEach(tab => { readPanels[wildcardKey(tab.id)] = 'read'; });
    return {
        Core: { panels },
        Senatus: { panels: readPanels },
        Aero: { panels: { 'contributors.list': 'write' } }
    };
}

export async function loadDepartmentPermissions() {
    try {
        const doc = await db.collection('config').doc('departmentPermissions').get();
        departmentPermissions = doc.exists ? normalizeDoc(doc.data()) : {};
        if (!doc.exists || !Object.keys(departmentPermissions).length) {
            departmentPermissions = seedDefaults();
            await saveDepartmentPermissionsFn({ departments: departmentPermissions });
        }
        console.log('[ROLES] Panel permissions loaded:', departmentPermissions);
    } catch (error) {
        console.error('[ROLES] Failed to load panel permissions:', error);
        departmentPermissions = {};
        showToast(`Departman yetkileri yüklenemedi: ${error.message}`, 'error');
    }
}

export async function saveDepartmentPermissions(permissions) {
    try {
        await saveDepartmentPermissionsFn({ departments: permissions });
        departmentPermissions = permissions;
    } catch (error) {
        console.error('[ROLES] Failed to save permissions:', error);
        let message = `Yetkiler kaydedilemedi: ${error.message}`;
        // 'internal'/'not-found' = sunucudaki saveDepartmentPermissions eski
        // sekli (tab dizisi) dogruluyor veya yok; yeni panel-map seklini kabul
        // etmesi icin drop-in guncellenmeli.
        if (error.code === 'internal' || error.code === 'not-found' || error.code === 'unknown' ||
            /must be an array/i.test(String(error.message))) {
            message = `${message} — ${__('perms.save_hint')}`;
        }
        showToast(message, 'error');
        throw error;
    }
}

export function getDepartmentPermissions() {
    return departmentPermissions;
}

// --- Matrix render ---

const cycleIcon = level => `<span class="material-symbols-rounded">${LEVEL_ICON[level]}</span>`;

function renderMatrixTable() {
    const container = document.getElementById('dept-permissions-container');
    if (!container) return;

    if (!departmentPermissions) {
        container.innerHTML = `<p class="form-hint" style="text-align:center;padding:1rem;">${__('dept.loading')}</p>`;
        return;
    }

    const groupLabels = {
        ust: __('dept.group_ust'),
        orta: __('dept.group_orta'),
        alt: __('dept.group_alt')
    };

    let html = '<div class="dept-perms-table panel-matrix">';
    html += '<div class="dept-perms-header">';
    html += `<span class="perm-dept-col">${__('perms.dept_col')}</span><span class="perm-preset-col"></span>`;
    TABS.forEach(tab => {
        html += `<span class="dept-perm-th perm-th-cell"><span class="material-symbols-rounded">${tab.icon}</span> ${__(tab.key)}` +
            `<button type="button" class="panel-detail-btn" data-tab="${tab.id}" title="${__('perms.detail_btn')}"><span class="material-symbols-rounded">tune</span></button></span>`;
    });
    html += '</div>';

    let currentGroup = null;
    DEPARTMENTS.forEach(dept => {
        if (dept.group !== currentGroup) {
            currentGroup = dept.group;
            html += `<div class="dept-perm-group-header">${groupLabels[currentGroup] || currentGroup}</div>`;
        }

        html += '<div class="dept-perm-row">';
        html += `<span class="dept-perm-label">${__(dept.nameKey)}</span>`;
        html += '<span class="perm-preset-col">' +
            `<button type="button" class="perm-preset-btn" data-dept="${dept.id}" data-preset="none" title="${__('perms.preset_none')}"><span class="material-symbols-rounded">block</span></button>` +
            `<button type="button" class="perm-preset-btn" data-dept="${dept.id}" data-preset="read" title="${__('perms.preset_read')}"><span class="material-symbols-rounded">visibility</span></button>` +
            `<button type="button" class="perm-preset-btn" data-dept="${dept.id}" data-preset="write" title="${__('perms.preset_write')}"><span class="material-symbols-rounded">edit</span></button>` +
            '</span>';
        TABS.forEach(tab => {
            const level = levelFor(dept.id, wildcardKey(tab.id));
            const hasOverride = Object.keys(departmentPermissions[dept.id]?.panels || {})
                .some(key => key.startsWith(`${tab.id}.`) && key !== wildcardKey(tab.id));
            html += `<span class="perm-cell"><button type="button" class="perm-cycle ${LEVEL_CLASS[level]}" data-dept="${dept.id}" data-tab="${tab.id}" data-level="${level}" title="${__('perms.cycle_hint')}">${cycleIcon(level)}</button>` +
                `${hasOverride ? `<span class="perm-override-dot" title="${__('perms.override_hint')}"></span>` : ''}</span>`;
        });
        html += '</div>';
    });

    html += '</div>';
    html += `<div id="panel-detail-container">${detailTab ? renderDetailPanel(detailTab) : ''}</div>`;
    container.innerHTML = html;

    container.querySelectorAll('.perm-cycle').forEach(btn => {
        btn.addEventListener('click', () => handleMatrixCycle(btn));
    });
    container.querySelectorAll('.perm-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => handlePreset(btn));
    });
    container.querySelectorAll('.panel-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            detailTab = detailTab === btn.dataset.tab ? null : btn.dataset.tab;
            renderMatrixTable();
        });
    });
    const detail = container.querySelector('#panel-detail-container');
    if (detail) {
        detail.querySelectorAll('.perm-cycle-panel').forEach(btn => {
            btn.addEventListener('click', () => handlePanelCycle(btn));
        });
        detail.querySelectorAll('.perm-reset-btn').forEach(btn => {
            btn.addEventListener('click', () => handlePanelReset(btn));
        });
        detail.querySelectorAll('.perm-hidden-choice input').forEach(input => {
            input.addEventListener('change', () => handleHiddenToggle(input));
        });
    }
}

function renderDetailPanel(tabId) {
    const panels = PANELS[tabId] || [];
    const tab = TABS.find(t => t.id === tabId);
    let html = `<div class="panel-detail-box">`;
    html += `<div class="panel-detail-title"><span class="material-symbols-rounded">${tab?.icon || 'tune'}</span> ` +
        `${__('perms.detail_title')}: <strong>${__(tab?.key || tabId)}</strong></div>`;
    html += `<p class="intro-description">${__('perms.detail_hint')}</p>`;
    html += '<div class="panel-detail-grid">';
    html += `<div class="panel-detail-row panel-detail-head"><span class="dept-perm-label">${__('perms.dept_col')}</span>`;
    panels.forEach(panel => {
        html += `<span class="panel-detail-col"><span class="material-symbols-rounded">${panel.icon}</span> ${__(panel.key)}</span>`;
    });
    html += '</div>';

    DEPARTMENTS.forEach(dept => {
        html += `<div class="panel-detail-row"><span class="dept-perm-label">${__(dept.nameKey)}</span>`;
        panels.forEach(panel => {
            const key = `${tabId}.${panel.id}`;
            const explicit = departmentPermissions?.[dept.id]?.panels?.[key];
            const effective = levelFor(dept.id, key);
            html += '<span class="perm-cell">';
            html += `<button type="button" class="perm-cycle perm-cycle-panel ${LEVEL_CLASS[effective]}" data-dept="${dept.id}" data-panel="${key}" data-level="${effective}" title="${__('perms.cycle_hint')}">${cycleIcon(effective)}</button>`;
            if (explicit) {
                html += `<button type="button" class="perm-reset-btn" data-dept="${dept.id}" data-panel="${key}" title="${__('perms.reset_btn')}"><span class="material-symbols-rounded">restart_alt</span></button>`;
            } else {
                html += `<span class="perm-inherit-dot" title="${__('perms.inherit_label')}"></span>`;
            }
            html += '</span>';
        });
        html += '</div>';
    });

    html += '</div>';

    // Gizlenecek alan grupları: yalnızca PII maskeleme destekleyen kanallar.
    if (HIDDEN_FIELD_OPTIONS[tabId]) {
        const tags = HIDDEN_FIELD_OPTIONS[tabId];
        html += `<div class="panel-detail-hidden"><span class="sub-block-title">${__('perms.hidden_title')}</span>`;
        html += `<p class="intro-description">${__('perms.hidden_hint')}</p>`;
        DEPARTMENTS.forEach(dept => {
            const hidden = new Set(departmentPermissions?.[dept.id]?.hiddenFields?.['contributors.list'] || []);
            const boxes = tags.map(opt =>
                `<label class="perm-hidden-choice"><input type="checkbox" data-dept="${dept.id}" data-panel="contributors.list" data-tag="${opt.tag}" ${hidden.has(opt.tag) ? 'checked' : ''}><span>${__(opt.key)}</span></label>`
            ).join('');
            html += `<div class="panel-detail-hidden-row"><span class="dept-perm-label">${__(dept.nameKey)}</span><div class="perm-hidden-boxes">${boxes}</div></div>`;
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

function ensureDeptEntry(deptId) {
    if (!departmentPermissions[deptId]) departmentPermissions[deptId] = { panels: {} };
    if (!departmentPermissions[deptId].panels) departmentPermissions[deptId].panels = {};
    return departmentPermissions[deptId].panels;
}

function clearTabOverrides(deptId, tabId) {
    const panels = departmentPermissions[deptId]?.panels || {};
    Object.keys(panels).forEach(key => {
        if (key.startsWith(`${tabId}.`) && key !== wildcardKey(tabId)) delete panels[key];
    });
}

function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveDepartmentPermissions(departmentPermissions).then(() => {
            showToast(__('dept.saved'), 'success');
        }).catch(() => {});
    }, 600);
}

function handleMatrixCycle(btn) {
    const { dept, tab } = btn.dataset;
    const panels = ensureDeptEntry(dept);
    const newLevel = nextLevel(panels[wildcardKey(tab)] ?? 'none');
    clearTabOverrides(dept, tab);
    if (newLevel === 'none') {
        delete panels[wildcardKey(tab)];
    } else {
        panels[wildcardKey(tab)] = newLevel;
    }
    scheduleSave();
    renderMatrixTable();
}

function handlePreset(btn) {
    const { dept, preset } = btn.dataset;
    const panels = ensureDeptEntry(dept);
    Object.keys(panels).forEach(key => delete panels[key]);
    if (preset !== 'none') {
        TABS.forEach(tab => { panels[wildcardKey(tab.id)] = preset; });
    }
    scheduleSave();
    renderMatrixTable();
}

function handlePanelCycle(btn) {
    const { dept, panel } = btn.dataset;
    const panels = ensureDeptEntry(dept);
    panels[panel] = nextLevel(panels[panel] ?? 'none');
    scheduleSave();
    renderMatrixTable();
}

function handlePanelReset(btn) {
    const { dept, panel } = btn.dataset;
    const panels = departmentPermissions[dept]?.panels;
    if (panels) delete panels[panel];
    scheduleSave();
    renderMatrixTable();
}

function handleHiddenToggle(input) {
    const { dept, panel, tag } = input.dataset;
    if (!departmentPermissions[dept]) departmentPermissions[dept] = { panels: {} };
    const hiddenFields = departmentPermissions[dept].hiddenFields || (departmentPermissions[dept].hiddenFields = {});
    const tags = new Set(hiddenFields[panel] || []);
    if (input.checked) tags.add(tag); else tags.delete(tag);
    if (tags.size) hiddenFields[panel] = [...tags];
    else delete hiddenFields[panel];
    if (!Object.keys(hiddenFields).length) delete departmentPermissions[dept].hiddenFields;
    scheduleSave();
}

export function initRolesModule() {
    loadDepartmentPermissions().then(() => {
        renderMatrixTable();
    });
    onLangChange(() => {
        if (departmentPermissions) renderMatrixTable();
    });
}

export { TABS, DEPARTMENTS };
