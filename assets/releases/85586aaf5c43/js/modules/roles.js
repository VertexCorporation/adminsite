import { beginPanelLoading } from '../utils/loading.js';
// js/modules/roles.js

import { icon } from '../utils/icons.js';
import { openPopover, closePopover } from './shell.js';
import { db, saveDepartmentPermissionsFn, getPanelPermissionsFn } from '../core/firebase.js';
import { userErrorMessage, showToast, __, onLangChange } from '../utils/ui.js';

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

const LEVELS = ['none', 'read', 'write'];
import { PERMISSION_CATEGORIES, normalizeScreenPermissions, screenPermissionLevel, categoryPermissionLevel, setScreenPermission } from '../core/permissionCatalog.js';
export { PERMISSION_CATEGORIES } from '../core/permissionCatalog.js';
const LEVEL_RANK = { none: 0, read: 1, write: 2 };
const LEVEL_ICON = { none: 'close', read: 'visibility', write: 'edit' };
const LEVEL_CLASS = { none: 'perm-none', read: 'perm-read', write: 'perm-write' };

let departmentPermissions = null; // Existing server scopes, grouped by navigation screen.
let currentUser = { isAdmin: false, departments: [] };
let saveTimeout = null;
let needsScreenMigration = false;

const wildcardKey = tabId => `${tabId}.*`;

function levelFor(dept, panelKey) {
    const entry = departmentPermissions?.[dept];
    if (!entry?.panels) return 'none';
    const direct = entry.panels[panelKey];
    const wildcard = entry.panels[wildcardKey(panelKey.split('.')[0])];
    return direct ?? wildcard ?? 'none';
}

function bestLevel(panelKey, deptList) {
    // READ is additive; WRITE requires every assigned department to allow it.
    const assigned = [...new Set(deptList || [])];
    if (!assigned.length) return 'none';
    let anyRead = false, allWrite = true;
    for (const dept of assigned) {
        const level = levelFor(dept, panelKey);
        if (LEVEL_RANK[level] >= LEVEL_RANK.read) anyRead = true;
        if (level !== 'write') allWrite = false;
    }
    return allWrite ? 'write' : anyRead ? 'read' : 'none';
}

function nextLevel(level) {
    return LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length];
}

// --- Kullanıcı bağlamı ---

export function setCurrentUser(isAdmin, departments) {
    const allowed = Array.isArray(departments) ? [...new Set(departments.filter(d => DEPARTMENTS.some(x=>x.id===d)))] : [];
    currentUser = Object.freeze({
        // Only the server-confirmed Core grant is privileged; tokens are not.
        isAdmin: isAdmin === true && allowed.includes('Core'),
        departments: Object.freeze(allowed)
    });
    document.dispatchEvent(new CustomEvent('vertex:access-changed', {detail: getCurrentUserAccess()}));
}
export function getCurrentUserAccess() {
    return {isCore: currentUser.isAdmin, departments: [...currentUser.departments]};
}
export function isPanelAdmin() {
    return currentUser.isAdmin;
}
export function getEffectivePanelLevel(panelKey) {
    if(currentUser.isAdmin)return 'write';
    if(panelKey.startsWith('users.') || ['contributors.users','contributors.vertexStatus','system.deptPerms','subscriptions.assign'].includes(panelKey))return 'none';
    if(!departmentPermissions)return 'none';
    return bestLevel(panelKey,currentUser.departments);
}
export function getAccessibleTabs(departments) {
    if (currentUser.isAdmin && departments.includes('Core')) return PERMISSION_CATEGORIES.map(category=>category.id);
    return PERMISSION_CATEGORIES.filter(category=>category.screens.some(screen=>
        !screen.coreOnly && screen.scopes.some(scope=>bestLevel(scope,departments)!=='none'))).map(category=>category.id);
}

export function departmentHasAccess(department, categoryId) {
    const category=PERMISSION_CATEGORIES.find(item=>item.id===categoryId);
    const departments=Array.isArray(department)?department:[department];
    return !!category && category.screens.some(screen=>!screen.coreOnly && screen.scopes.some(scope=>bestLevel(scope,departments)!=='none'));
}

// --- Doküman normalize (eski tab-dizisi şekli de desteklenir) ---

const stableSettings = value => JSON.stringify(value, (_key,item) =>
    item && typeof item==='object' && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))) : item);
function normalizeDoc(raw) {
    const clean=normalizeScreenPermissions(raw);
    const source=raw?.departments ?? raw ?? {};
    needsScreenMigration=stableSettings(source)!==stableSettings(clean);
    return clean;
}

let permissionLoad = null;let permissionError=null;
let serverRevision = 0;
let permissionsWatcher = null;
function watchPermissionRevision() {
    if (permissionsWatcher || !db) return;
    permissionsWatcher = db.collection('config').doc('departmentPermissions').onSnapshot(snapshot => {
        const remoteRevision = Number.isSafeInteger(snapshot.data()?.revision) ? snapshot.data().revision : 0;
        if (remoteRevision === serverRevision) return;
        // Never silently merge two administrators' drafts.
        if (saving) return; // The pending transaction's revision check resolves races.
        if (permissionRevision > 0 && saveState !== 'saved') {
            saveState = 'failed';paintSaveState();
            showToast(() => __('perms.failed') + ' — ' + (document.documentElement.lang==='en'?'Permissions changed in another session. Refresh.':'Yetkiler başka bir oturumda değişti. Yenileyin.'), 'error');
            return;
        }
        void loadDepartmentPermissions().then(()=>{renderMatrixTable();document.dispatchEvent(new CustomEvent('vertex:permissions-updated'));});
    }, () => { /* Callable is the fallback when config reads are blocked. */ });
}
export function loadDepartmentPermissions() {
    if (!permissionLoad) permissionLoad = readDepartmentPermissions().finally(() => {permissionLoad=null;});
    return permissionLoad;
}
async function readDepartmentPermissions() {
    permissionError=null;
    try {
        const doc = await db.collection('config').doc('departmentPermissions').get();
        departmentPermissions = doc.exists ? normalizeDoc(doc.data()) : {};
        serverRevision = Number.isSafeInteger(doc.data()?.revision) ? doc.data().revision : 0;
        // No implicit local defaults: absent server configuration is deny-by-default.
        watchPermissionRevision();
        console.log('[ROLES] Screen permissions loaded.');
    } catch (directError) {
        // Firestore 'config' okuma kuralı engelliyse callable'a düş (deploy edilmişse).
        console.warn('[ROLES] Direkt okuma başarısız, callable fallback deneniyor:', directError.message);
        try {
            const result = await getPanelPermissionsFn();
            departmentPermissions = normalizeDoc(result.data.departments || {});
            serverRevision = Number.isSafeInteger(result.data.revision) ? result.data.revision : 0;
            console.log('[ROLES] Screen permissions loaded via fallback.');
        } catch (fallbackError) {
            console.error('[ROLES] Panel permissions yüklenemedi:', fallbackError);
            departmentPermissions = {};permissionError=fallbackError;
            showToast(() => userErrorMessage(fallbackError), 'error');
        }
    }
}

export async function saveDepartmentPermissions(permissions, expectedRevision = serverRevision) {
    try {
        const result = await saveDepartmentPermissionsFn({ departments: permissions, expectedRevision });
        // Acknowledging this snapshot must not overwrite a newer local draft.
        serverRevision = result.data.revision;
        return result.data;
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
    const container=document.getElementById('dept-permissions-container');
    if(container){
        container.dataset.saveState=saveState;
        container.setAttribute('aria-busy',String(saving));
    }
}
const escapeText=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const screenTitle=screen=>screen.group?`${__(screen.group)} · ${__(screen.key)}`:__(screen.key);
function renderMatrixTable() {
    const container = document.getElementById('dept-permissions-container');
    if (!container || !departmentPermissions) return;
    if(permissionError){
        container.innerHTML=`<div class="state-block"><p>${escapeText(userErrorMessage(permissionError))}</p><button class="chrome-btn-outline" data-permission-retry>${__('common.retry')}</button></div>`;
        container.querySelector('button').onclick=()=>initRolesModule();return;
    }
    const focus = {...document.activeElement?.dataset};
    let html='<div class="dept-perms-table screen-matrix" role="table" style="--permission-module-count:'+PERMISSION_CATEGORIES.length+'" aria-label="'+__('dept.title')+'"><div class="dept-perms-header" role="row"><span role="columnheader">'+__('perms.dept_col')+'</span>';
    PERMISSION_CATEGORIES.forEach(category=>{html+=`<span class="dept-perm-th" role="columnheader">${__(category.key)}</span>`;});
    html+='<span role="columnheader" class="sr-only">'+__('common.actions')+'</span></div>';
    let group=null;
    DEPARTMENTS.forEach(dept=>{
        if(dept.group!==group){group=dept.group;html+=`<div class="dept-perm-group-header">${__('dept.group_'+group)}</div>`;}
        html+=`<div class="dept-perm-row" role="row"><span class="dept-perm-label" role="rowheader">${__(dept.nameKey)}</span>`;
        PERMISSION_CATEGORIES.forEach(category=>{
            const level=categoryPermissionLevel(departmentPermissions,dept.id,category);
            const locked=dept.id==='Core'||category.screens.every(screen=>screen.coreOnly);
            const title=locked?__('people.admin_only'):__('perms.cycle_hint');
            html+=`<span class="perm-cell" role="cell" data-module-label="${__(category.key)}"><span class="permission-category-control"><button type="button" class="perm-cycle ${LEVEL_CLASS[level]||'perm-mixed'}" data-dept="${dept.id}" data-category="${category.id}" data-level="${level}" ${locked?'disabled':''} aria-label="${__(dept.nameKey)} · ${__(category.key)}: ${levelLabel(level)}" title="${escapeText(title)}">${level==='mixed'?icon('adjustments',{size:14})+'<span>'+__('perms.level_mixed')+'</span>':cycleIcon(level)}</button>${!locked&&category.screens.filter(screen=>!screen.coreOnly).length>1?`<button type="button" class="permission-screens-trigger" data-screen-dept="${dept.id}" data-screen-category="${category.id}" aria-haspopup="dialog" aria-label="${__(dept.nameKey)} · ${__(category.key)} · ${__('perms.screens')}">${icon('chevron-down',{size:14})}</button>`:''}</span></span>`;
        });
        html+=`<span role="cell">${dept.id==='Core'?'':`<button type="button" class="icon-action-btn perm-presets-trigger" data-preset-dept="${dept.id}" aria-haspopup="dialog" aria-label="${__(dept.nameKey)} · ${__('common.actions')}">${icon('dots')}</button>`}</span></div>`;
    });
    container.innerHTML=html+'</div>';
    paintSaveState();
    container.querySelectorAll('.perm-cycle').forEach(button=>button.onclick=()=>handleMatrixCycle(button));
    container.querySelectorAll('[data-screen-category]').forEach(button=>button.onclick=()=>openScreenPermissions(button));
    container.querySelectorAll('[data-preset-dept]').forEach(button=>button.onclick=()=>openPopover(button,{render(pop){
        pop.innerHTML='<div class="menu-list permission-presets-menu">'+LEVELS.map(level=>`<button type="button" class="menu-item" data-dept="${button.dataset.presetDept}" data-preset="${level}">${icon(level==='none'?'circle-off':level==='read'?'eye':'pencil')}<span>${__('perms.preset_'+level)}</span></button>`).join('')+'</div>';
        pop.querySelectorAll('[data-preset]').forEach(item=>item.onclick=()=>{closePopover();handlePreset(item);});
    }}));
    if(focus.dept&&focus.category)container.querySelector(`[data-dept="${focus.dept}"][data-category="${focus.category}"]`)?.focus({preventScroll:true});
}
function paintCategoryLevel(dept,category) {
    const button=document.querySelector(`[data-dept="${dept}"][data-category="${category.id}"]`);
    if(!button)return;
    const level=categoryPermissionLevel(departmentPermissions,dept,category);
    button.dataset.level=level;
    button.className='perm-cycle '+(LEVEL_CLASS[level]||'perm-mixed');
    button.innerHTML=level==='mixed'?icon('adjustments',{size:14})+'<span>'+__('perms.level_mixed')+'</span>':cycleIcon(level);
    button.setAttribute('aria-label',`${__(DEPARTMENTS.find(item=>item.id===dept).nameKey)} · ${__(category.key)}: ${levelLabel(level)}`);
}
function openScreenPermissions(button) {
    const {screenDept:dept,screenCategory:id}=button.dataset;
    const category=PERMISSION_CATEGORIES.find(item=>item.id===id);
    openPopover(button,{render(pop){
        const paint=()=>{
            pop.innerHTML=`<div class="permission-screen-menu"><h4>${__(category.key)}</h4>`+category.screens.map(screen=>{
                const level=screenPermissionLevel(departmentPermissions,dept,screen);
                return `<div class="permission-screen-row"><span>${screenTitle(screen)}${screen.coreOnly?`<small>${__('people.admin_only')}</small>`:''}</span><button type="button" class="perm-cycle ${LEVEL_CLASS[level]}" data-screen-id="${screen.id}" ${screen.coreOnly?'disabled':''} aria-label="${escapeText(screenTitle(screen))}: ${levelLabel(level)}">${cycleIcon(level)}</button></div>`;
            }).join('')+'</div>';
            pop.querySelectorAll('[data-screen-id]').forEach(control=>control.onclick=()=>{
                if(!currentUser.isAdmin)return;
                const screen=category.screens.find(item=>item.id===control.dataset.screenId);
                const next=nextLevel(screenPermissionLevel(departmentPermissions,dept,screen));
                setScreenPermission(departmentPermissions,dept,screen,next);
                scheduleSave();paintCategoryLevel(dept,category);paint();
                pop.querySelector(`[data-screen-id="${screen.id}"]`)?.focus({preventScroll:true});
            });
        };
        paint();
    }});
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
        await saveDepartmentPermissions(snapshot, serverRevision);
        confirmedPermissions=structuredClone(snapshot);
        saveState=revision===permissionRevision?'saved':'pending';
    } catch (error) {
        if (error.code === 'functions/aborted') {
            // Keep neither a stale approval nor an accidental overwrite.
            clearTimeout(saveTimeout);
            permissionRevision = revision;
            await readDepartmentPermissions();
            confirmedPermissions = structuredClone(departmentPermissions);
            saveState='failed';closePopover();renderMatrixTable();
            showToast(() => document.documentElement.lang==='en'
                ? 'Permissions were changed elsewhere. The latest server version was loaded.'
                : 'Yetkiler başka bir oturumda değişti. Güncel sunucu sürümü yüklendi.', 'error');
            return;
        }
        // Only roll back the failed draft if it has not been superseded.
        if (revision===permissionRevision) {
            departmentPermissions=structuredClone(confirmedPermissions || {});
            saveState='failed';closePopover();renderMatrixTable();
        } else saveState='pending';
    } finally {
        saving=false;paintSaveState();
        if(revision!==permissionRevision){clearTimeout(saveTimeout);saveTimeout=setTimeout(flushPermissions,600);}
    }
}
function handleMatrixCycle(button) {
    if(!currentUser.isAdmin || button.disabled)return;
    const {dept,category:id}=button.dataset;
    const category=PERMISSION_CATEGORIES.find(item=>item.id===id);
    const level=categoryPermissionLevel(departmentPermissions,dept,category);
    const next=level==='mixed'?'none':nextLevel(level);
    category.screens.forEach(screen=>setScreenPermission(departmentPermissions,dept,screen,next));
    scheduleSave();renderMatrixTable();
}
function handlePreset(button) {
    if(!currentUser.isAdmin)return;
    const {dept,preset}=button.dataset;
    PERMISSION_CATEGORIES.forEach(category=>category.screens.forEach(screen=>setScreenPermission(departmentPermissions,dept,screen,preset)));
    scheduleSave();renderMatrixTable();
}
let rolesInitialized=false;let rolesLoad=null;
export function initRolesModule() {
    if(!rolesLoad)rolesLoad=initializeRoles().finally(()=>{rolesLoad=null;});
    return rolesLoad;
}
async function initializeRoles() {
    const finish=beginPanelLoading(document.getElementById('dept-permissions-container'));
    try {
        await loadDepartmentPermissions();
        confirmedPermissions=structuredClone(departmentPermissions);
        // Only opening the Core-owned permission editor can retire old settings.
        // Reads elsewhere never write configuration or invent access defaults.
        if(currentUser.isAdmin && needsScreenMigration && !permissionError && !saving){
            saving=true;saveState='saving';paintSaveState();
            try {
                await saveDepartmentPermissions(departmentPermissions,serverRevision);
                needsScreenMigration=false;saveState='saved';
            } catch(error){
                await readDepartmentPermissions();
                confirmedPermissions=structuredClone(departmentPermissions);
                saveState='failed';
            } finally {saving=false;}
        }
    } finally {finish();renderMatrixTable();}
    if(!rolesInitialized){rolesInitialized=true;onLangChange(renderMatrixTable);}
}
export {DEPARTMENTS};
