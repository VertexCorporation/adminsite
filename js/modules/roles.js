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

// Panel kataloğu: her sekmenin "kanalları". Anahtar formatı `${tabId}.${panelId}`.
export const PANELS = {
    contributors: [
        { id: 'list', key: 'panel.contributors.list', icon: 'group_work' },
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
        { id: 'adminRole', key: 'panel.system.adminRole', icon: 'shield_person' },
        { id: 'manualVerify', key: 'panel.system.manualVerify', icon: 'verified_user' },
        { id: 'removeAdmin', key: 'panel.system.removeAdmin', icon: 'person_remove' },
        { id: 'adminList', key: 'panel.system.adminList', icon: 'admin_panel_settings' },
        { id: 'serverStatus', key: 'panel.system.serverStatus', icon: 'dns' },
        { id: 'attributions', key: 'panel.system.attributions', icon: 'sync' },
        { id: 'exporter', key: 'panel.system.exporter', icon: 'download' }
    ]
};

// Panel köşe menüsünde içerik ayarı sunulan paneller.
const CONTENT_OPTIONS = {
    'contributors.list': {
        fieldGroups: [
            { tag: 'contact', key: 'perms.hidden_contact' },
            { tag: 'age', key: 'perms.hidden_age' },
            { tag: 'links', key: 'perms.hidden_links' },
            { tag: 'interview', key: 'perms.hidden_interview' }
        ],
        chips: [
            { id: 'verified', key: 'contributors.filter.verified' },
            { id: 'unverified', key: 'contributors.filter.unverified' },
            { id: 'age-14-15', key: 'contributors.filter.age14' },
            { id: 'age-16-17', key: 'contributors.filter.age16' },
            { id: 'age-18', key: 'contributors.filter.age18' },
            { id: 'linkedin', key: 'contributors.filter.linkedin' },
            { id: 'github', key: 'contributors.filter.github' },
            { id: 'interview', key: 'contributors.filter.interview' }
        ]
    }
};

const LEVELS = ['none', 'read', 'write'];
const LEVEL_RANK = { none: 0, read: 1, write: 2 };
const LEVEL_ICON = { none: 'close', read: 'visibility', write: 'edit' };
const LEVEL_CLASS = { none: 'perm-none', read: 'perm-read', write: 'perm-write' };

let departmentPermissions = null; // { [deptId]: { panels, hiddenFields?, hiddenChips? } }
let currentUser = { isAdmin: false, departments: [] };
let saveTimeout = null;
let openMenuPanel = null;
let menuContentDept = 'Senatus';

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

// --- Kullanıcı bağlamı ---

export function setCurrentUser(isAdmin, departments) {
    currentUser = {
        isAdmin: !!isAdmin,
        departments: Array.isArray(departments) ? departments : []
    };
}

export function isPanelAdmin() {
    return currentUser.isAdmin;
}

export function getEffectivePanelLevel(panelKey) {
    if (currentUser.isAdmin) return 'write';
    if (!departmentPermissions) return 'none';
    return bestLevel(panelKey, currentUser.departments);
}

/** Kullanıcının rankları için gizlenen filtre çipleri (birleşim). */
export function getHiddenChipsFor(panelKey) {
    if (currentUser.isAdmin || !departmentPermissions) return [];
    const hidden = new Set();
    for (const dept of currentUser.departments) {
        (departmentPermissions[dept]?.hiddenChips?.[panelKey] || []).forEach(chip => hidden.add(chip));
    }
    return [...hidden];
}

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

// --- Doküman normalize (eski tab-dizisi şekli de desteklenir) ---

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
            continue;
        }
        if (value && typeof value === 'object') {
            const panels = {};
            const rawPanels = value.panels && typeof value.panels === 'object' ? value.panels : {};
            for (const [key, level] of Object.entries(rawPanels)) {
                if (typeof key === 'string' && key && LEVELS.includes(level)) panels[key] = level;
            }
            const entry = { panels };
            const readMap = (obj) => {
                const out = {};
                if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                    for (const [key, tags] of Object.entries(obj)) {
                        if (typeof key === 'string' && key && Array.isArray(tags)) {
                            const valid = tags.filter(tag => typeof tag === 'string' && tag);
                            if (valid.length) out[key] = valid;
                        }
                    }
                }
                return out;
            };
            const hiddenFields = readMap(value.hiddenFields);
            if (Object.keys(hiddenFields).length) entry.hiddenFields = hiddenFields;
            const hiddenChips = readMap(value.hiddenChips);
            if (Object.keys(hiddenChips).length) entry.hiddenChips = hiddenChips;
            departments[dept] = entry;
        }
    }
    return departments;
}

function seedDefaults() {
    const writePanels = {};
    const readPanels = {};
    TABS.forEach(tab => {
        writePanels[wildcardKey(tab.id)] = 'write';
        readPanels[wildcardKey(tab.id)] = 'read';
    });
    return {
        Core: { panels: writePanels },
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

// --- Matrix render (Sistem sekmesi) ---

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
    container.innerHTML = html;

    container.querySelectorAll('.perm-cycle').forEach(btn => {
        btn.addEventListener('click', () => handleMatrixCycle(btn));
    });
    container.querySelectorAll('.perm-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => handlePreset(btn));
    });
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
    if (openMenuPanel) renderPanelMenuContent();
}

function handlePreset(btn) {
    const { dept, preset } = btn.dataset;
    const panels = ensureDeptEntry(dept);
    Object.keys(panels).forEach(key => delete panels[key]);
    if (preset !== 'none') {
        TABS.forEach(tab => { panels[wildcardKey(tab.id)] = preset; });
    }
    delete departmentPermissions[dept].hiddenFields;
    delete departmentPermissions[dept].hiddenChips;
    scheduleSave();
    renderMatrixTable();
    if (openMenuPanel) renderPanelMenuContent();
}

// --- Panel köşe menüsü (her panelin sağ üstündeki ayar tuşu) ---

function findPanelMeta(panelKey) {
    const [tabId, panelId] = panelKey.split('.');
    const tab = TABS.find(t => t.id === tabId);
    const panel = (PANELS[tabId] || []).find(p => p.id === panelId);
    return { tabId, tab, panel };
}

/** Panelleri baslik satirindan acilip kapanir yapar (durum localStorage'da). */
export function initPanelCollapsers() {
    const read = () => new Set(JSON.parse(localStorage.getItem('vertex-collapsed-panels') || '[]'));
    const write = (set) => localStorage.setItem('vertex-collapsed-panels', JSON.stringify([...set]));
    const stored = read();
    document.querySelectorAll('[data-panel]').forEach(card => {
        const key = card.getAttribute('data-panel');
        const row = card.querySelector('.card-title-row');
        if (!key || !row || row.querySelector('.panel-collapse-chevron')) return;
        const chev = document.createElement('span');
        chev.className = 'material-symbols-rounded panel-collapse-chevron';
        chev.textContent = 'keyboard_arrow_up';
        row.appendChild(chev);
        if (stored.has(key)) card.classList.add('panel-collapsed');
        row.addEventListener('click', (e) => {
            if (e.target.closest('.panel-menu-btn') || e.target.closest('.panel-menu-pop')) return;
            if (e.target.closest('button') && !e.target.closest('.panel-collapse-chevron')) return;
            const collapsed = card.classList.toggle('panel-collapsed');
            chev.textContent = collapsed ? 'keyboard_arrow_down' : 'keyboard_arrow_up';
            const set = read();
            if (collapsed) set.add(key); else set.delete(key);
            write(set);
        });
    });
}

// --- Panel surukle-birak siralama (yerel, tab bazli, kalici) ---

const PANEL_ORDER_KEY = 'vertex-panel-order';
const originalPanelOrder = {};

function getPanelOrder() {
    try { return JSON.parse(localStorage.getItem(PANEL_ORDER_KEY) || '{}'); } catch { return {}; }
}

function savePanelOrder(tabId, grid) {
    const all = getPanelOrder();
    all[tabId] = [...grid.querySelectorAll('[data-panel]')].map(el => el.getAttribute('data-panel'));
    localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(all));
}

export function initPanelDragOrder() {
    document.querySelectorAll('.tab-panel .grid-layout').forEach(grid => {
        const tabId = grid.closest('.tab-panel')?.id.replace('tab-', '');
        if (!tabId) return;
        originalPanelOrder[tabId] = [...grid.querySelectorAll('[data-panel]')];
        const saved = getPanelOrder()[tabId];
        if (Array.isArray(saved)) {
            saved.forEach(key => {
                const el = grid.querySelector(`[data-panel="${key}"]`);
                if (el) grid.appendChild(el);
            });
        }
        grid.querySelectorAll('[data-panel]').forEach(card => attachPanelDrag(card, grid, tabId));
    });
}

function attachPanelDrag(card, grid, tabId) {
    const row = card.querySelector('.card-title-row');
    if (!row || row.querySelector('.panel-drag-handle')) return;
    const handle = document.createElement('span');
    handle.className = 'material-symbols-rounded panel-drag-handle';
    handle.textContent = 'drag_indicator';
    handle.title = __('perms.drag_hint');
    row.insertBefore(handle, row.querySelector('.panel-collapse-chevron'));

    handle.addEventListener('mousedown', () => { card.draggable = true; });
    handle.addEventListener('mouseup', () => { card.draggable = false; });

    card.addEventListener('dragstart', (e) => {
        if (!card.draggable) { e.preventDefault(); return; }
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', card.getAttribute('data-panel') || ''); } catch (_err) {}
    });
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        card.draggable = false;
        savePanelOrder(tabId, grid);
    });
    card.addEventListener('dragover', (e) => {
        const dragging = grid.querySelector('.dragging');
        if (!dragging || dragging === card) return;
        e.preventDefault();
        const rect = card.getBoundingClientRect();
        const dx = (e.clientX - (rect.left + rect.width / 2));
        const dy = (e.clientY - (rect.top + rect.height / 2));
        const before = Math.abs(dx) > Math.abs(dy) ? dx < 0 : dy < 0;
        if (before) grid.insertBefore(dragging, card);
        else grid.insertBefore(dragging, card.nextSibling);
    });
}

function resetPanelOrder(tabId, grid) {
    const all = getPanelOrder();
    delete all[tabId];
    localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(all));
    (originalPanelOrder[tabId] || []).forEach(el => grid.appendChild(el));
}

export function initPanelMenus() {
    document.querySelectorAll('[data-panel]').forEach(card => {
        const key = card.getAttribute('data-panel');
        const row = card.querySelector('.card-title-row');
        if (!key || !row || row.querySelector('.panel-menu-btn')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-menu-btn';
        btn.title = __('perms.panel_menu');
        btn.setAttribute('data-menu-panel', key);
        btn.innerHTML = '<span class="material-symbols-rounded">settings</span>';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (openMenuPanel === key) closePanelMenu();
            else openPanelMenu(key, card);
        });
        row.appendChild(btn);
    });
    document.addEventListener('click', (e) => {
        if (openMenuPanel && !e.target.closest('.panel-menu-pop') && !e.target.closest('.panel-menu-btn')) {
            closePanelMenu();
        }
    });
    onLangChange(() => { if (openMenuPanel) renderPanelMenuContent(); });
}

function closePanelMenu() {
    document.querySelectorAll('.panel-menu-pop').forEach(el => el.remove());
    openMenuPanel = null;
}

function openPanelMenu(panelKey, card) {
    closePanelMenu();
    openMenuPanel = panelKey;
    const pop = document.createElement('div');
    pop.className = 'panel-menu-pop';
    pop.dataset.panel = panelKey;
    card.appendChild(pop);
    renderPanelMenuContent();
}

function renderPanelMenuContent() {
    const pop = document.querySelector(`.panel-menu-pop[data-panel="${openMenuPanel}"]`);
    if (!pop || !departmentPermissions) return;
    const panelKey = openMenuPanel;
    const { panel } = findPanelMeta(panelKey);
    const contentOpts = CONTENT_OPTIONS[panelKey];

    let html = `<div class="panel-menu-title"><span class="material-symbols-rounded">${panel?.icon || 'tune'}</span> ${__(panel?.key || panelKey)}</div>`;

    // Erişim: tüm ranklar için Gizle/Gör/Düzenle
    html += `<div class="panel-menu-section-title">${__('perms.menu_access')}</div>`;
    DEPARTMENTS.forEach(dept => {
        const explicit = departmentPermissions[dept.id]?.panels?.[panelKey];
        const effective = levelFor(dept.id, panelKey);
        html += `<div class="panel-menu-row">` +
            `<span class="panel-menu-rank">${__(dept.nameKey)}</span>` +
            `<span class="perm-cell">` +
            `<button type="button" class="perm-cycle ${LEVEL_CLASS[effective]}" data-menu-dept="${dept.id}" data-menu-level="${effective}" title="${__('perms.cycle_hint')}">${cycleIcon(effective)}</button>` +
            `${explicit !== undefined ? `<button type="button" class="perm-reset-btn" data-menu-reset="${dept.id}" title="${__('perms.reset_btn')}"><span class="material-symbols-rounded">restart_alt</span></button>` : ''}` +
            `</span></div>`;
    });

    // İçerik ayarları (destekleyen panellerde)
    if (contentOpts) {
        html += `<div class="panel-menu-section-title">${__('perms.menu_content')}</div>`;
        html += `<select class="panel-menu-rank-select">` +
            DEPARTMENTS.map(d => `<option value="${d.id}" ${d.id === menuContentDept ? 'selected' : ''}>${__(d.nameKey)}</option>`).join('') +
            `</select>`;
        const deptData = departmentPermissions[menuContentDept] || {};
        const hiddenTags = new Set(deptData.hiddenFields?.[panelKey] || []);
        const hiddenChips = new Set(deptData.hiddenChips?.[panelKey] || []);

        html += `<div class="panel-menu-checks">`;
        contentOpts.fieldGroups.forEach(opt => {
            html += `<label class="perm-hidden-choice"><input type="checkbox" data-cfg="hiddenFields" data-tag="${opt.tag}" ${hiddenTags.has(opt.tag) ? 'checked' : ''}><span>${__(opt.key)}</span></label>`;
        });
        html += `</div>`;
        html += `<div class="panel-menu-section-title">${__('perms.menu_chips')}</div>`;
        html += `<div class="panel-menu-checks">`;
        contentOpts.chips.forEach(opt => {
            html += `<label class="perm-hidden-choice"><input type="checkbox" data-cfg="hiddenChips" data-tag="${opt.id}" ${hiddenChips.has(opt.id) ? 'checked' : ''}><span>${__(opt.key)}</span></label>`;
        });
        html += `</div>`;
        html += `<p class="intro-description" style="margin-top:6px;">${__('perms.hidden_hint')}</p>`;
    }

    pop.querySelectorAll('.perm-cycle[data-menu-dept]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dept = btn.dataset.menuDept;
            const panels = ensureDeptEntry(dept);
            panels[panelKey] = nextLevel(btn.dataset.menuLevel);
            scheduleSave();
            renderMatrixTable();
            renderPanelMenuContent();
        });
    });
    pop.querySelectorAll('[data-menu-reset]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dept = btn.dataset.menuReset;
            const panels = departmentPermissions[dept]?.panels;
            if (panels) delete panels[panelKey];
            scheduleSave();
            renderMatrixTable();
            renderPanelMenuContent();
        });
    });
    const select = pop.querySelector('.panel-menu-rank-select');
    if (select) {
        select.addEventListener('change', () => { menuContentDept = select.value; renderPanelMenuContent(); });
    }
    html += `<button type="button" class="perm-hidden-choice panel-order-reset" data-reset-tab="${findPanelMeta(panelKey).tabId}"><span class="material-symbols-rounded">restart_alt</span><span>${__('perms.order_reset')}</span></button>`;
    pop.innerHTML = html;

    pop.querySelector('.panel-order-reset')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = e.currentTarget.dataset.resetTab;
        const grid = document.querySelector(`#tab-${tabId} .grid-layout`);
        if (grid) resetPanelOrder(tabId, grid);
        showToast(__('dept.saved'), 'success');
        closePanelMenu();
    });

    pop.querySelectorAll('input[data-cfg]').forEach(input => {
        input.addEventListener('change', () => {
            if (!departmentPermissions[menuContentDept]) departmentPermissions[menuContentDept] = { panels: {} };
            const bucket = departmentPermissions[menuContentDept][input.dataset.cfg] || (departmentPermissions[menuContentDept][input.dataset.cfg] = {});
            const tags = new Set(bucket[panelKey] || []);
            if (input.checked) tags.add(input.dataset.tag); else tags.delete(input.dataset.tag);
            if (tags.size) bucket[panelKey] = [...tags];
            else {
                delete bucket[panelKey];
                if (!Object.keys(bucket).length) delete departmentPermissions[menuContentDept][input.dataset.cfg];
            }
            scheduleSave();
        });
    });
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
