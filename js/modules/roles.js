// js/modules/roles.js

import { db, saveDepartmentPermissionsFn } from '../core/firebase.js';
import { showToast, __ } from '../utils/ui.js';

const TABS = [
    { id: 'contributors', icon: 'group', key: 'nav.contributors' },
    { id: 'models', icon: 'smart_toy', key: 'nav.models' },
    { id: 'news', icon: 'newspaper', key: 'nav.news' },
    { id: 'notifications', icon: 'notifications_active', key: 'nav.notifications' },
    { id: 'system', icon: 'settings_ethernet', key: 'nav.system' }
];

const DEPARTMENTS = [
    { id: 'Essence', group: 'ust', nameKey: 'dept.essence' },
    { id: 'Core', group: 'ust', nameKey: 'dept.core' },
    { id: 'Senatus', group: 'ust', nameKey: 'dept.senatus' },
    { id: 'Pulse', group: 'orta', nameKey: 'dept.pulse' },
    { id: 'Chroma', group: 'orta', nameKey: 'dept.chroma' },
    { id: 'Catalyst', group: 'orta', nameKey: 'dept.catalyst' },
    { id: 'Envoy', group: 'orta', nameKey: 'dept.envoy' },
    { id: 'Aero', group: 'orta', nameKey: 'dept.aero' },
    { id: 'Array', group: 'orta', nameKey: 'dept.array' },
    { id: 'Scout', group: 'alt', nameKey: 'dept.scout' },
    { id: 'Vertest', group: 'alt', nameKey: 'dept.vertest' }
];

const DEFAULT_PERMISSIONS = {
    Essence: ['contributors', 'models', 'news', 'notifications', 'system'],
    Core: ['contributors', 'models', 'news', 'notifications', 'system'],
    Senatus: ['contributors', 'models', 'news', 'notifications', 'system'],
    Pulse: ['news', 'notifications'],
    Chroma: ['models'],
    Catalyst: [],
    Envoy: ['contributors', 'notifications'],
    Aero: ['contributors'],
    Array: ['models'],
    Scout: ['contributors'],
    Vertest: ['models']
};

let departmentPermissions = null;
let permissionDocRef = null;

const ALL_TAB_IDS = TABS.map(t => t.id);

function defaultPerms(deptId) {
    return DEFAULT_PERMISSIONS[deptId] || [];
}

export function getAccessibleTabs(department) {
    if (!departmentPermissions) return [];
    const departments = Array.isArray(department) ? department : [department];
    return [...new Set(departments.flatMap(id => departmentPermissions[id] || []))];
}

export function departmentHasAccess(department, tabId) {
    if (!department) return false;
    const tabs = getAccessibleTabs(department);
    return tabs.includes(tabId);
}

export async function saveDepartmentPermissions(permissions) {
    try {
        await saveDepartmentPermissionsFn({ departments: permissions });
        departmentPermissions = permissions;
    } catch (error) {
        console.error('[ROLES] Failed to save permissions:', error);
        showToast(`Yetkiler kaydedilemedi: ${error.message}`, 'error');
        throw error;
    }
}

export function getDepartmentPermissions() {
    return departmentPermissions;
}

function renderPermissionsTable() {
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

    let html = '<div class="dept-perms-table">';
    html += '<div class="dept-perms-header">';
    html += '<span></span>';
    TABS.forEach(tab => {
        html += `<span class="dept-perm-th"><span class="material-symbols-rounded">${tab.icon}</span> ${__(tab.key)}</span>`;
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
        TABS.forEach(tab => {
            const checked = departmentPermissions[dept.id]?.includes(tab.id) ? 'checked' : '';
            html += `<label class="dept-perm-check"><input type="checkbox" data-dept="${dept.id}" data-tab="${tab.id}" ${checked}><span class="perm-checkmark"></span></label>`;
        });
        html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', debouncedSavePermissions);
    });
}

let saveTimeout = null;
function debouncedSavePermissions() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        const newPermissions = {};
        DEPARTMENTS.forEach(dept => {
            newPermissions[dept.id] = [];
        });

        const container = document.getElementById('dept-permissions-container');
        if (!container) return;

        container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            const deptId = cb.dataset.dept;
            const tabId = cb.dataset.tab;
            if (newPermissions[deptId]) {
                newPermissions[deptId].push(tabId);
            }
        });

        saveDepartmentPermissions(newPermissions).then(() => {
            showToast(__('dept.saved'), 'success');
        }).catch(() => {});
    }, 600);
}

export async function loadDepartmentPermissions() {
    try {
        permissionDocRef = db.collection('config').doc('departmentPermissions');
        const doc = await permissionDocRef.get();

        if (doc.exists && doc.data().departments) {
            departmentPermissions = doc.data().departments;
            for (const dept of DEPARTMENTS) {
                if (!departmentPermissions[dept.id]) {
                    departmentPermissions[dept.id] = defaultPerms(dept.id);
                }
            }
        } else {
            departmentPermissions = {};
            DEPARTMENTS.forEach(dept => {
                departmentPermissions[dept.id] = defaultPerms(dept.id);
            });
            await saveDepartmentPermissionsFn({ departments: departmentPermissions });
        }
        console.log('[ROLES] Department permissions loaded:', departmentPermissions);
    } catch (error) {
        console.error('[ROLES] Failed to load department permissions:', error);
        departmentPermissions = {};
        DEPARTMENTS.forEach(dept => {
            departmentPermissions[dept.id] = defaultPerms(dept.id);
        });
        showToast(`Departman yetkileri yüklenemedi: ${error.message}`, 'error');
    }
}

export function initRolesModule() {
    loadDepartmentPermissions().then(() => {
        renderPermissionsTable();
    });
}

export { TABS, DEPARTMENTS };
