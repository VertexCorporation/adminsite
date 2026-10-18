import { beginPanelLoading } from '../utils/loading.js';
// js/modules/roles.js

import { icon } from '../utils/icons.js';
import { openPopover, closePopover } from './shell.js';
import { db, saveDepartmentPermissionsFn, getPanelPermissionsFn } from '../core/firebase.js';
import { userErrorMessage, showToast, __, onLangChange } from '../utils/ui.js';

const TABS = [
    { id: 'contributors', icon: 'group', key: 'nav.contributors' },
    { id: 'models', icon: 'smart_toy', key: 'nav.models' },
    { id: 'news', icon: 'newspaper', key: 'nav.news' },
    { id: 'notifications', icon: 'notifications_active', key: 'nav.notifications' },
    { id: 'events', icon: 'calendar_month', key: 'nav.events' },
    { id: 'subscriptions', icon: 'workspace_premium', key: 'nav.subscriptions' },
    { id: 'system', icon: 'settings_ethernet', key: 'nav.system' }
];

const DEPARTMENTS = [
    { id: 'Core', group: 'ust', nameKey: 'dept.core' },
    { id: 'Senatus', group: 'ust', nameKey: 'dept.senatus' },
    { id: 'Tensor', group: 'ust', nameKey: 'dept.tensor' },
    { id: 'Curia', group: 'ust', nameKey: 'dept.curia' },
    { id: 'Pulse', group: 'orta', nameKey: 'dept.pulse' },
    { id: 'Chroma', group: 'orta', nameKey: 'dept.chroma' },
    { id: 'Catalyst', group: 'orta', nameKey: 'dept.catalyst' },
    { id: 'Envoy', group: 'orta', nameKey: 'dept.envoy' },
    { id: 'Aero', group: 'orta', nameKey: 'dept.aero' },
    { id: 'Array', group: 'orta', nameKey: 'dept.array' }
];

// Panel kataloğu: her sekmenin "kanalları". Anahtar formatı `${tabId}.${panelId}`.
export const PANELS = {
    contributors: [
        { id: 'list', key: 'panel.contributors.list', icon: 'group_work' },
        { id: 'vertexStatus', key: 'panel.contributors.vertexStatus', icon: 'verified_user' },
        { id: 'users', key: 'people.users', icon: 'group' }
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
    events: [
        {id:'list',key:'panel.events.list',icon:'list_alt'},
        {id:'editor',key:'panel.events.editor',icon:'post_add'},
        {id:'registrations',key:'panel.events.registrations',icon:'group'}
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
        { id: 'teamLog', key: 'panel.system.teamLog', icon: 'diversity_3' },
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
    if (['contributors.users','contributors.vertexStatus'].includes(panelKey)) return 'none';
    if (!departmentPermissions) return 'none';
    return bestLevel(panelKey, currentUser.departments);
}

/** Kullanıcının rankları için gizlenen filtre çipleri (birleşim). */
export function getHiddenFieldsFor(panelKey) {
    if (currentUser.isAdmin || !departmentPermissions) return [];
    return [...new Set(currentUser.departments.flatMap(dept => departmentPermissions[dept]?.hiddenFields?.[panelKey] || []))];
}

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

let permissionLoad = null;let permissionError=null;
export function loadDepartmentPermissions() {
    if (!permissionLoad) permissionLoad = readDepartmentPermissions().finally(() => {permissionLoad=null;});
    return permissionLoad;
}
async function readDepartmentPermissions() {
    permissionError=null;
    try {
        const doc = await db.collection('config').doc('departmentPermissions').get();
        departmentPermissions = doc.exists ? normalizeDoc(doc.data()) : {};
        if (!doc.exists || !Object.keys(departmentPermissions).length) {
            departmentPermissions = seedDefaults();
            // Defaults stay local until an explicit user edit; opening this page never writes permissions.
        }
        console.log('[ROLES] Panel permissions loaded:', departmentPermissions);
    } catch (directError) {
        // Firestore 'config' okuma kuralı engelliyse callable'a düş (deploy edilmişse).
        console.warn('[ROLES] Direkt okuma başarısız, callable fallback deneniyor:', directError.message);
        try {
            const result = await getPanelPermissionsFn();
            departmentPermissions = normalizeDoc(result.data.departments || {});
            if (!Object.keys(departmentPermissions).length) {
                departmentPermissions = seedDefaults();
            }
            console.log('[ROLES] Panel permissions loaded via fallback:', departmentPermissions);
        } catch (fallbackError) {
            console.error('[ROLES] Panel permissions yüklenemedi:', fallbackError);
            departmentPermissions = {};permissionError=fallbackError;
            showToast(() => userErrorMessage(fallbackError), 'error');
        }
    }
}

export async function saveDepartmentPermissions(permissions) {
    try {
        await saveDepartmentPermissionsFn({ departments: permissions });
        // Acknowledging this snapshot must not overwrite a newer local draft.
    } catch (error) {
        console.error('[ROLES] Failed to save permissions:', error);
        const message = () => {
            let text = __('perms.failed');
            if (error.code === 'internal' || error.code === 'not-found' || error.code === 'unknown' ||
                /must be an array/i.test(String(error.message))) {
                text += ` — ${__('perms.save_hint')}`;
            }
            return text;
        };
        showToast(message, 'error');
        throw error;
    }
}

export function getDepartmentPermissions() {
    return departmentPermissions;
}

// --- Matrix render (Sistem sekmesi) ---

const levelLabel = level => __('perms.level_' + level);
const cycleIcon = level => `${icon(LEVEL_ICON[level] === 'close' ? 'x' : level === 'read' ? 'eye' : 'pencil', {size:14})}<span>${levelLabel(level)}</span>`;
let confirmedPermissions = null;
let permissionRevision = 0;
let saving = false;
let saveState = 'saved';
function paintSaveState() {
    const status = document.getElementById('permission-save-status');
    if (status) {status.textContent = __('perms.' + saveState);status.dataset.state = saveState;}
}
function renderMatrixTable() {
    const container = document.getElementById('dept-permissions-container');
    if (!container || !departmentPermissions) return;
    container.setAttribute('aria-busy','false');
    const focus = document.activeElement?.dataset;
    let html = '<div class="permission-status-row"><span id="permission-save-status" role="status" aria-live="polite"></span></div><div class="dept-perms-table panel-matrix" role="table" aria-label="'+__('perms.dept_col')+'"><div class="dept-perms-header" role="row"><span role="columnheader">'+__('perms.dept_col')+'</span>';
    TABS.forEach(tab => {html += `<span class="dept-perm-th" role="columnheader">${__(tab.key)}</span>`;});
    html += '<span role="columnheader" class="sr-only">'+__('common.actions')+'</span></div>';
    let group = null;
    DEPARTMENTS.forEach(dept => {
        if (dept.group !== group) {group=dept.group;html+=`<div class="dept-perm-group-header">${__('dept.group_' + group)}</div>`;}
        html += `<div class="dept-perm-row" role="row"><span class="dept-perm-label" role="rowheader">${__(dept.nameKey)}</span>`;
        TABS.forEach(tab => {
            const level = levelFor(dept.id, wildcardKey(tab.id));
            const overridden = Object.keys(departmentPermissions[dept.id]?.panels || {}).some(key=>key.startsWith(tab.id+'.') && key!==wildcardKey(tab.id));
            html += `<span class="perm-cell" role="cell" data-module-label="${__(tab.key)}"><button type="button" class="perm-cycle ${LEVEL_CLASS[level]}" data-dept="${dept.id}" data-tab="${tab.id}" data-level="${level}" aria-label="${__(dept.nameKey)} · ${__(tab.key)}: ${levelLabel(level)}" title="${__('perms.cycle_hint')}">${cycleIcon(level)}</button>${overridden?`<span class="perm-override-dot" title="${__('perms.override_hint')}"></span>`:''}</span>`;
        });
        html+=`<span role="cell"><button type="button" class="icon-action-btn perm-presets-trigger" data-preset-dept="${dept.id}" aria-haspopup="dialog" aria-label="${__(dept.nameKey)} · ${__('common.actions')}">${icon('dots')}</button></span></div>`;
    });
    // Keep CSS columns bound to the actual permission module catalogue.
    container.innerHTML = html + '</div>';
    // Set on the table itself: a CSS custom property declared on the table
    // would otherwise override an inherited value from the wrapper.
    container.querySelector('.dept-perms-table')?.style.setProperty(
        '--permission-columns',`minmax(132px,1.25fr) repeat(${TABS.length},minmax(108px,1fr)) 36px`
    );
    paintSaveState();
    container.querySelectorAll('.perm-cycle').forEach(button=>button.onclick=()=>handleMatrixCycle(button));
    container.querySelectorAll('[data-preset-dept]').forEach(button=>button.onclick=()=>openPopover(button,{render(pop){
        pop.innerHTML='<div class="menu-list">'+LEVELS.map(level=>`<button type="button" class="menu-item" data-dept="${button.dataset.presetDept}" data-preset="${level}">${icon(level==='none'?'circle-off':level==='read'?'eye':'pencil')}<span>${__('perms.preset_'+level)}</span></button>`).join('')+'</div>';
        pop.querySelectorAll('[data-preset]').forEach(item=>item.onclick=()=>{closePopover();handlePreset(item);});
    }}));
    if (focus?.dept && focus?.tab) container.querySelector(`[data-dept="${focus.dept}"][data-tab="${focus.tab}"]`)?.focus({preventScroll:true});
}
function ensureDeptEntry(deptId) {
    if (!departmentPermissions[deptId]) departmentPermissions[deptId] = {panels:{}};
    return departmentPermissions[deptId].panels ||= {};
}
function clearTabOverrides(deptId, tabId) {
    const panels=ensureDeptEntry(deptId);
    Object.keys(panels).forEach(key=>{if(key.startsWith(tabId+'.') && key!==wildcardKey(tabId))delete panels[key];});
}
function scheduleSave() {
    if (!currentUser.isAdmin) return;
    permissionRevision++;
    saveState='pending';paintSaveState();
    clearTimeout(saveTimeout);
    saveTimeout=setTimeout(flushPermissions,600);
}
async function flushPermissions() {
    if (saving || !currentUser.isAdmin) return;
    const revision=permissionRevision;
    const snapshot=structuredClone(departmentPermissions);
    saving=true;saveState='saving';paintSaveState();
    try {
        await saveDepartmentPermissions(snapshot);
        confirmedPermissions=structuredClone(snapshot);
        saveState=revision===permissionRevision?'saved':'pending';
    } catch {
        // Only roll back the failed draft if it has not been superseded.
        if (revision===permissionRevision) {
            departmentPermissions=structuredClone(confirmedPermissions || {});
            saveState='failed';renderMatrixTable();renderPanelMenuContent();
        } else saveState='pending';
    } finally {
        saving=false;paintSaveState();
        if(revision!==permissionRevision){clearTimeout(saveTimeout);saveTimeout=setTimeout(flushPermissions,600);}
    }
}
function handleMatrixCycle(button) {
    if (!currentUser.isAdmin) return;
    const {dept,tab}=button.dataset;
    const panels=ensureDeptEntry(dept);
    const next=nextLevel(panels[wildcardKey(tab)] || 'none');
    clearTabOverrides(dept,tab);
    if(next==='none')delete panels[wildcardKey(tab)];else panels[wildcardKey(tab)]=next;
    scheduleSave();renderMatrixTable();renderPanelMenuContent();
}
function handlePreset(button) {
    if (!currentUser.isAdmin) return;
    const {dept,preset}=button.dataset;
    const panels=ensureDeptEntry(dept);
    Object.keys(panels).forEach(key=>delete panels[key]);
    if(preset!=='none')TABS.forEach(tab=>panels[wildcardKey(tab.id)]=preset);
    delete departmentPermissions[dept].hiddenFields;
    delete departmentPermissions[dept].hiddenChips;
    scheduleSave();renderMatrixTable();renderPanelMenuContent();
}
function findPanelMeta(panelKey) {
    const [tabId,panelId]=panelKey.split('.');
    return {tabId,tab:TABS.find(tab=>tab.id===tabId),panel:(PANELS[tabId]||[]).find(panel=>panel.id===panelId)};
}
export function initPanelMenus() {
    const host=document.getElementById('dept-perms-manager');
    if(!host)return;if(host.querySelector('.permission-workspace')){paintPanelSelector();renderPanelMenuContent();return;}
    const workspace=document.createElement('div');workspace.className='permission-workspace';
    workspace.innerHTML=`<div class="permission-panel-nav" aria-label="${__('perms.panels')}"></div><div class="panel-menu-pop"></div>`;
    host.append(workspace);
    if(!openMenuPanel)openMenuPanel='contributors.list';
    paintPanelSelector();renderPanelMenuContent();
}
function paintPanelSelector() {
    const nav=document.querySelector('.permission-panel-nav');if(!nav)return;
    nav.innerHTML=`<label class="permission-mobile-picker">${__('perms.panels')}<select aria-label="${__('perms.panels')}">${Object.entries(PANELS).map(([tab,panels])=>`<optgroup label="${__('nav.'+tab)}">${panels.map(panel=>`<option value="${tab}.${panel.id}" ${openMenuPanel===tab+'.'+panel.id?'selected':''}>${__(panel.key)}</option>`).join('')}</optgroup>`).join('')}</select></label><h4>${__('perms.panels')}</h4>`+Object.entries(PANELS).map(([tab,panels])=>`<div class="permission-module-label">${__('nav.'+tab)}</div>${panels.map(panel=>`<button type="button" class="permission-panel-button ${openMenuPanel===tab+'.'+panel.id?'active':''}" data-permission-panel="${tab}.${panel.id}" aria-pressed="${openMenuPanel===tab+'.'+panel.id}">${__(panel.key)}</button>`).join('')}`).join('');
    nav.querySelector('select').onchange=event=>{openMenuPanel=event.target.value;renderPanelMenuContent();};
    nav.querySelectorAll('button').forEach(button=>button.onclick=()=>{openMenuPanel=button.dataset.permissionPanel;paintPanelSelector();renderPanelMenuContent();nav.querySelector(`[data-permission-panel="${openMenuPanel}"]`)?.focus({preventScroll:true});});
}
function renderPanelMenuContent() {
    const pop=document.querySelector('.permission-workspace .panel-menu-pop');
    if(!pop)return;if(permissionError){pop.innerHTML='<div class="state-block"><p>'+userErrorMessage(permissionError)+'</p><button class="chrome-btn-outline" data-permission-retry>'+__('common.retry')+'</button></div>';pop.querySelector('button').onclick=()=>initRolesModule();return;}if(!departmentPermissions){pop.innerHTML='<div class="skeleton sk-text"></div><p>'+__('common.loading')+'</p>';return;}if(!openMenuPanel || !findPanelMeta(openMenuPanel).panel)openMenuPanel='contributors.list';
    const focus = pop.contains(document.activeElement) ? {...document.activeElement.dataset} : null;
    const panelKey=openMenuPanel;
    const {panel}=findPanelMeta(panelKey);
    const options=CONTENT_OPTIONS[panelKey];
    if(['contributors.users','contributors.vertexStatus'].includes(panelKey)){pop.innerHTML='<h4 class="panel-menu-title">'+__(panel.key)+'</h4><p class="form-hint">'+__('people.admin_only')+'</p>';return;}
    pop.dataset.panel=panelKey;
    let html=`<h4 class="panel-menu-title">${__(panel.key)}</h4><p class="form-hint">${__('perms.panel_desc')}</p><div class="panel-menu-section-title">${__('perms.menu_access')}</div>`;
    DEPARTMENTS.forEach(dept=>{
        const explicit=departmentPermissions[dept.id]?.panels?.[panelKey];
        const effective=levelFor(dept.id,panelKey);
        html+=`<div class="panel-menu-row"><div><span class="panel-menu-rank">${__(dept.nameKey)}</span>${explicit===undefined?`<span class="permission-inherited">${__('perms.inherited')}</span>`:''}</div><span class="perm-cell"><button type="button" class="perm-cycle ${LEVEL_CLASS[effective]}" data-menu-dept="${dept.id}" data-menu-level="${effective}" aria-label="${__(dept.nameKey)}: ${levelLabel(effective)}">${cycleIcon(effective)}</button>${explicit!==undefined?`<button type="button" class="icon-action-btn small" data-menu-reset="${dept.id}" title="${__('perms.reset_btn')}" aria-label="${__('perms.reset_btn')}">${icon('refresh',{size:14})}</button>`:''}</span></div>`;
    });
    if(options) {
        const deptData=departmentPermissions[menuContentDept]||{};
        html+=`<div class="visibility-controls"><div class="permission-department-picker"><span>${__('perms.choose_department')}</span><button type="button" class="chrome-btn-outline" data-select-department aria-haspopup="dialog">${__(DEPARTMENTS.find(dept=>dept.id===menuContentDept).nameKey)}${icon('chevron-down',{size:14})}</button></div>`;
        for(const [bucket,list,title] of [['hiddenFields',options.fieldGroups,'perms.menu_content'],['hiddenChips',options.chips,'perms.menu_chips']]) {
            const hidden=new Set(deptData[bucket]?.[panelKey]||[]);
            html+=`<fieldset><legend>${__(title)}</legend>`+list.map(option=>`<label class="perm-hidden-choice"><input type="checkbox" data-cfg="${bucket}" data-tag="${option.tag||option.id}" ${hidden.has(option.tag||option.id)?'checked':''}><span>${__(option.key)}</span></label>`).join('')+'</fieldset>';
        }
        html+=`<p class="form-hint">${__('perms.hidden_hint')}</p></div>`;
    }
    pop.innerHTML=html;
    pop.querySelectorAll('[data-menu-dept]').forEach(button=>button.onclick=()=>{if(!currentUser.isAdmin)return;ensureDeptEntry(button.dataset.menuDept)[panelKey]=nextLevel(button.dataset.menuLevel);scheduleSave();renderMatrixTable();renderPanelMenuContent();});
    pop.querySelectorAll('[data-menu-reset]').forEach(button=>button.onclick=()=>{if(!currentUser.isAdmin)return;delete ensureDeptEntry(button.dataset.menuReset)[panelKey];scheduleSave();renderMatrixTable();renderPanelMenuContent();});
    const picker=pop.querySelector('[data-select-department]');
    if(picker)picker.onclick=()=>openPopover(picker,{render(menu){menu.innerHTML='<div class="menu-list">'+DEPARTMENTS.map(dept=>`<button type="button" class="menu-item ${dept.id===menuContentDept?'is-selected':''}" data-content-dept="${dept.id}">${__(dept.nameKey)}</button>`).join('')+'</div>';menu.querySelectorAll('button').forEach(button=>button.onclick=()=>{menuContentDept=button.dataset.contentDept;closePopover();renderPanelMenuContent();});}});
    pop.querySelectorAll('input[data-cfg]').forEach(input=>input.onchange=()=>{
        if(!currentUser.isAdmin)return;
        ensureDeptEntry(menuContentDept);
        const entry=departmentPermissions[menuContentDept];
        const bucket=entry[input.dataset.cfg] ||= {};
        const tags=new Set(bucket[panelKey]||[]);
        if(input.checked)tags.add(input.dataset.tag);else tags.delete(input.dataset.tag);
        if(tags.size)bucket[panelKey]=[...tags];else {delete bucket[panelKey];if(!Object.keys(bucket).length)delete entry[input.dataset.cfg];}
        scheduleSave();
    });
    const focusDept=focus?.menuDept || focus?.menuReset;
    if(focusDept)pop.querySelector(`[data-menu-dept="${focusDept}"]`)?.focus({preventScroll:true});
}
let rolesInitialized=false;
export function initRolesModule() {
    const finish=beginPanelLoading(document.getElementById('dept-permissions-container'));
    loadDepartmentPermissions().then(()=>{confirmedPermissions=structuredClone(departmentPermissions);finish();renderMatrixTable();initPanelMenus();renderPanelMenuContent();});
    if(!rolesInitialized){rolesInitialized=true;onLangChange(()=>{renderMatrixTable();paintPanelSelector();renderPanelMenuContent();});}
}
export {TABS,DEPARTMENTS};
