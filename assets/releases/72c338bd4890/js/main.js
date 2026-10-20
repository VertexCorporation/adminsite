import { createWorkspaceLoader } from './utils/workspace-loader.js';
import { initEventsModule } from './modules/events.js';
import { initPeopleModule } from './modules/people.js';
import { initHomeModule, updateHome } from './modules/home.js';
import { initScrollEdges } from './utils/scrollEdges.js';
import { normalizeConsoleAccessResponse } from './utils/console-access.js';
import { initUiFeedback } from './ui/feedback.js';
import { displayDepartmentName } from './utils/departments.js';
import { initSystemSections } from './modules/system.js';
import { initIcons } from './utils/icons.js';
import { initShell, refreshNavigation, closePopover, closeDrawer, closeModal } from './modules/shell.js';
// js/main.js

import { deploymentCapabilities } from './core/deployment-capabilities.js';
import { initFirebase, auth, db, consolePeopleCall } from './core/firebase.js';
import * as dom from './utils/dom.js';
import { userErrorMessage, showToast, __, getLang, setLang, translatePage, onLangChange } from './utils/ui.js';

// Import module initializers
import { initAdminModule, initializeMaintenanceStatus, refreshDepartmentUsers } from './modules/admin.js';
import { initModelsModule, fetchFullModelsData } from './modules/models.js';
import { initNewsModule, listenForArticles, stopListeningForArticles } from './modules/news.js';
import { initNotificationModule, listenForScheduledTasks, stopListeningForScheduledTasks } from './modules/notification.js';
import { initContributorsModule, fetchContributorsData, applyChipVisibility } from './modules/contributors.js';
import { initSubscriptionsModule, refreshSubscriptions } from './modules/subscriptions.js';
import { loadDepartmentPermissions, getAccessibleTabs, initRolesModule, setCurrentUser, getCurrentUserAccess, getEffectivePanelLevel, initPanelMenus, PANELS } from './modules/roles.js';
import { initSiteTeamPanel, loadTeam } from './modules/siteTeam.js';
import { initTeamCardsPanel, loadTeamCards } from './modules/teamCards.js';
import { updateGridVisibleCounts, initAdaptiveGrids } from './modules/views.js';
import { initUserMenu } from './modules/userMenu.js';
import { initConsoleChat, refreshConsoleChat } from './modules/consoleChat.js';

/**
 * The main application function.
 * This is called by the initializer after all SDKs and the Firebase config are loaded.
 * @param {object} firebaseConfig The secure Firebase configuration object.
 */
export function startApp(firebaseConfig) {
    // --- Step 1: Initialize Firebase ---
    initFirebase(firebaseConfig);
    initScrollEdges();
    initUiFeedback();
    console.log('[APP] Main application started.');

    // --- Step 2: Bring up the critical navigation shell first. ---
    // A feature workspace may be temporarily unavailable (for example while a
    // backend contract is being deployed). That must never disable sidebar
    // expansion, theme/language menus, navigation animations or authentication.
    initShell();

    // Bind independent features without allowing one broken optional module
    // to prevent other workspaces and the central auth listener from starting.
    const featureInitializers = [
        ['admin', initAdminModule],
        ['people', initPeopleModule],
        ['models', initModelsModule],
        ['news', initNewsModule],
        ['events', initEventsModule],
        ['notifications', initNotificationModule],
        ['contributors', initContributorsModule],
        ['subscriptions', initSubscriptionsModule],
        ['user-menu', initUserMenu],
        ['chat', initConsoleChat],
        ['profile', initProfileMenu],
        ['site-team', initSiteTeamPanel],
        ['team-cards', initTeamCardsPanel],
        ['home', initHomeModule],
        ['system-sections', initSystemSections],
        ['icons', initIcons],
        ['adaptive-grid', initAdaptiveGrids],
    ];
    // Intentionally not asynchronous: listeners are installed synchronously.
    for (const [name, initialize] of featureInitializers) {
        try {
            initialize();
        } catch (error) {
            console.error('[INIT] Optional workspace failed to initialize:', name, error);
        }
    }
    const readOnlyObserver = new MutationObserver(records => {
        const panels = new Set();
        for(const record of records) for(const node of record.addedNodes) {
            if(node.nodeType !== 1) continue;
            const panel=node.closest('.panel-readonly');if(panel)panels.add(panel);
        }
        panels.forEach(disableReadOnlyControls);
    });
    readOnlyObserver.observe(dom.adminPanel,{childList:true,subtree:true});
    onLangChange(() => {
        if (!auth.currentUser) return;
        const access=getCurrentUserAccess();
        renderProfile(auth.currentUser,access.isCore,access.departments,true);
    });
    document.getElementById('profile-form').addEventListener('submit', async event => {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        const name = document.getElementById('profile-display-name').value.trim();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            await user.updateProfile({ displayName: name });
            document.getElementById('profile-name').textContent = name || user.email || '—';
            showToast(() => __('profile.saved'), 'success');
        } catch (error) {
            showToast(() => userErrorMessage(error), 'error');
        } finally {
            button.disabled = false;
        }
    });

    const loadRolesWorkspace=()=>{initRolesModule();initPanelMenus();};
    const loadedWorkspaces=createWorkspaceLoader({
        tasks:[['contributors.list',fetchContributorsData],['models.library',fetchFullModelsData],['models.manage',fetchFullModelsData],['news.published',listenForArticles],['news.editor',listenForArticles],['notifications.scheduled',listenForScheduledTasks],['subscriptions.list',refreshSubscriptions],['system.deptUsers',refreshDepartmentUsers],['system.serverStatus',initializeMaintenanceStatus],['system.teamLog',loadTeamCards],['system.teamLog',loadTeam],['system.deptPerms',loadRolesWorkspace],['chat.channels',refreshConsoleChat]],
        canLoad:key=>!!auth.currentUser&&dom.adminPanel.style.display!=='none'&&
            (key==='chat.channels'||getEffectivePanelLevel(key)!=='none'),
        onError:(key,error)=>console.error('[WORKSPACE] Load failed',key,error.code||'unknown')
    });
    document.addEventListener('vertex:workspace',event=>{void loadedWorkspaces.load(event.detail?.keys||[]);});
    document.addEventListener('vertex:workspace-load-error',event=>loadedWorkspaces.invalidate(event.detail?.panel));
    // --- Step 3: Set up the Core Authentication State Listener ---
    // This is the central control point that reacts to user login/logout.
    let authEpoch=0,personnelUnsubscribe=null,hadAuthorizedSession=false;
    auth.onAuthStateChanged(async (user) => {
        const epoch=++authEpoch;personnelUnsubscribe?.();personnelUnsubscribe=null;
        if(document.documentElement.dataset.startupFailed === 'true') return;
        if (user) {
            console.log(`[AUTH] User signed in: ${user.email}`);
            try {
                const idTokenResult = await user.getIdTokenResult(true);
                if(epoch!==authEpoch || document.documentElement.dataset.startupFailed === 'true')return;
                // Authentication token establishes identity only; Core and
                // departments must be checked against current server records.
                if(!deploymentCapabilities.consolePeople)throw new Error('Console authorization endpoint is unavailable.');
                const access=normalizeConsoleAccessResponse((await consolePeopleCall('getMyConsoleAccess',{})).data);
                let isAdmin=access.isCore;
                let departments=access.departments;
                if(epoch!==authEpoch)return;
                if (!isAdmin && !departments.length) {
                    const denied=new Error('Console access denied');denied.code='auth/insufficient-permission';throw denied;
                }
                hadAuthorizedSession=true;
                setCurrentUser(isAdmin, departments);
                document.body.classList.toggle('admin-mode', isAdmin);
                document.dispatchEvent(new CustomEvent('vertex:departments', { detail: departments }));
                dom.loginContainer.style.display = 'none';
                dom.adminPanel.style.display = 'grid';
                renderProfile(user, isAdmin, departments);

                if (isAdmin) {
                    console.log("[AUTH] Access Level: Core. Full panel enabled.");
                    resetTabFilter();
                    applyPanelGate(true);
                    applyChipVisibility();
                    } else {
                    console.log(`[AUTH] Access Level: Department (${departments.join(', ')}). Limited panel.`);
                    await loadDepartmentPermissions();
                    if(epoch!==authEpoch || document.documentElement.dataset.startupFailed === 'true')return;

                    const allowedTabs = getAccessibleTabs(departments);
                    console.log(`[AUTH] Allowed tabs for ${departments.join(', ')}:`, allowedTabs);
                    applyTabFilter(allowedTabs);
                    applyPanelGate(false);
                    applyChipVisibility();

                    document.dispatchEvent(new CustomEvent('vertex:departments', { detail: departments }));
                }

                updateHome(user, isAdmin, departments);
                if(deploymentCapabilities.consolePeople){
                  let revision=null;
                  personnelUnsubscribe=db.collection('users').doc(user.uid).onSnapshot(async snapshot=>{
                    const profile=snapshot.data()||{};if(!profile.contributorId&&!profile.personnelManaged&&!profile.consoleAccessManaged)return;
                    const next=profile.authzVersion||0;if(next===revision)return;revision=next;
                    try{const access=normalizeConsoleAccessResponse((await consolePeopleCall('getMyConsoleAccess',{})).data);if(epoch!==authEpoch)return;if(!access.isCore&&!access.departments.length){await auth.signOut();return;}setCurrentUser(access.isCore,access.departments);document.body.classList.toggle('admin-mode',access.isCore);if(access.isCore)resetTabFilter();else{await loadDepartmentPermissions();applyTabFilter(getAccessibleTabs(access.departments));}applyPanelGate(access.isCore);applyChipVisibility();renderProfile(user,access.isCore,access.departments,true);updateHome(user,access.isCore,access.departments);document.dispatchEvent(new CustomEvent('vertex:departments',{detail:access.departments}));}
                    catch(error){if(epoch===authEpoch&&error.code==='functions/permission-denied')auth.signOut();}
                  },error=>console.warn('[PERSONNEL] Access subscription unavailable',error.code));
                }

            } catch (error) {
                console.error("[AUTH] Access check failed:", error.message);
                if(epoch!==authEpoch)return;showToast(() => userErrorMessage(error), 'error');
                auth.signOut();
            }
        } else {
            // --- User is LOGGED OUT ---
            document.title = __('page.title');
            loadedWorkspaces.clear();setCurrentUser(false,[]);updateHome(null,false,[]);
            if(hadAuthorizedSession){history.replaceState({vertexRoute:{panel:'home',action:''}},'',location.pathname+'?panel=home&view=');hadAuthorizedSession=false;}
            document.dispatchEvent(new CustomEvent('vertex:close-navigation'));document.body.classList.remove('admin-mode');
            closePopover({restoreFocus:false});closeModal();closeDrawer(false);
            console.log("[AUTH] No user signed in. Displaying login page.");
            dom.loginContainer.style.display = 'flex';
            dom.adminPanel.style.display = 'none';

            // Clean up: Stop all real-time listeners to prevent memory leaks
            // and unnecessary background operations.
            stopListeningForArticles();
            stopListeningForScheduledTasks();
        }
        hideBootstrapLoader();
    });

    // --- Step 4: Bind Login/Logout Button Listeners ---
    let loginPending=false;
    async function submitLogin(event){
        event?.preventDefault();if(loginPending)return;
        const email=document.getElementById('email').value.trim(),password=document.getElementById('password').value;
        if(!email||!password){showToast(()=>__('auth.required'),'info');return;}
        loginPending=true;dom.loginBtn.disabled=true;dom.loginBtn.setAttribute('aria-busy','true');
        try{await auth.signInWithEmailAndPassword(email,password);}catch(error){console.error('[AUTH] Login failed',error.code);showToast(()=>userErrorMessage(error),'error');}
        finally{loginPending=false;dom.loginBtn.disabled=false;dom.loginBtn.removeAttribute('aria-busy');}
    }
    document.getElementById('login-form').addEventListener('submit',submitLogin);

    // --- Google Sign-In ---
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (googleLoginBtn.classList.contains('is-loading')) return;
            googleLoginBtn.classList.add('is-loading');
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider)
                .then(() => {
                    // Success - auth state listener will handle the rest
                })
                .catch(error => {
                    console.error('[AUTH] Google sign-in error:', error);
                    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                        showToast(() => userErrorMessage(error), 'error');
                    }
                })
                .finally(() => {
                    googleLoginBtn.classList.remove('is-loading');
                });
        });
    }

    // --- Apple Sign-In ---
    const appleLoginBtn = document.getElementById('apple-login-btn');
    if (appleLoginBtn) {
        appleLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (appleLoginBtn.classList.contains('is-loading')) return;
            appleLoginBtn.classList.add('is-loading');
            const provider = new firebase.auth.OAuthProvider('apple.com');
            provider.addScope('email');
            provider.addScope('name');
            auth.signInWithPopup(provider)
                .then(() => {
                    // Success - auth state listener will handle the rest
                })
                .catch(error => {
                    console.error('[AUTH] Apple sign-in error:', error);
                    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                        showToast(() => userErrorMessage(error), 'error');
                    }
                })
                .finally(() => {
                    appleLoginBtn.classList.remove('is-loading');
                });
        });
    }

    dom.logoutBtn.addEventListener('click', () => auth.signOut());

    translatePage();
    document.getElementById('lang-indicator').textContent = (getLang() === 'tr' ? 'Türkçe' : 'English');
    onLangChange(() => { document.getElementById('lang-indicator').textContent = (getLang() === 'tr' ? 'Türkçe' : 'English'); });

}

function resetTabFilter() {
    document.querySelectorAll('.dock-btn, .tab-panel').forEach(element => {
        element.style.display = '';
        element.classList.remove('active');
    });
    document.querySelector('[data-target="tab-home"]').classList.add('active');
    document.getElementById('tab-home').classList.add('active');
}

function applyTabFilter(allowedTabs) {
    const visibleTabs = new Set([...allowedTabs, 'home', 'profile', 'chat']);
    const dockButtons = document.querySelectorAll('.dock-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    [...dockButtons, ...tabPanels].forEach(element => {
        element.style.display = '';
        element.classList.remove('active');
    });

    dockButtons.forEach(btn => {
        const targetId = btn.getAttribute('data-target');
        const tabId = targetId?.replace('tab-', '');
        if (tabId && !visibleTabs.has(tabId)) {
            btn.style.display = 'none';
        }
    });

    tabPanels.forEach(panel => {
        const tabId = panel.id.replace('tab-', '');
        if (!visibleTabs.has(tabId)) {
            panel.classList.remove('active');
            panel.style.display = 'none';
        }
    });

    const firstTab = 'home';
    const firstBtn = document.querySelector(`.dock-btn[data-target="tab-${firstTab}"]`);
    const firstPanel = document.getElementById(`tab-${firstTab}`);
    if (firstBtn && firstPanel) {
        firstBtn.classList.add('active');
        firstPanel.classList.add('active');
    }

    if (allowedTabs.includes('contributors')) {
        fetchContributorsData();
    }
    if (allowedTabs.includes('subscriptions')) {
        refreshSubscriptions();
    }
    if (allowedTabs.includes('models')) {
        fetchFullModelsData();
    }
    if (allowedTabs.includes('news')) {
        listenForArticles();
    }
    if (allowedTabs.includes('notifications')) {
        listenForScheduledTasks();
    }
}

/**
 * Panel kartlarını kullanıcının efektif panel seviyesine göre aç/kapa.
 * Adminler her şeyi görür; departman kullanıcılarında 'none' olan paneller
 * tamamen gizlenir. Yetki editörü (dept-perms-manager) her zaman admin-only.
 */
function applyPanelGate(isAdmin) {
    document.querySelectorAll('[data-panel]').forEach(el => {
        if (isAdmin) {
            el.style.display = '';
            el.classList.remove('panel-readonly');
            el.querySelectorAll('[data-role-disabled]').forEach(control=>{control.disabled=false;delete control.dataset.roleDisabled;});
            return;
        }
        const level = getEffectivePanelLevel(el.getAttribute('data-panel'));
        if (level === 'none') {
            el.style.display = 'none';
        } else {
            el.style.display = '';
            // Salt-okunur kartlar: içerik görünür, düzenleme öğeleri CSS ile gizli.
            el.classList.toggle('panel-readonly', level !== 'write');
            if(level !== 'write') disableReadOnlyControls(el);
        }
    });
    if (!isAdmin) {
        const permsCard = document.getElementById('dept-perms-manager');
        if (permsCard) permsCard.style.display = 'none';
    }
    refreshNavigation();
}

function renderProfile(user, isAdmin, departments, preserveForm = false) {
    document.getElementById('profile-name').textContent = user.displayName || user.email || '—';
    document.getElementById('profile-email').textContent = user.email || '—';
    if(!preserveForm)document.getElementById('profile-display-name').value = user.displayName || '';
    document.getElementById('profile-role').textContent = isAdmin ? __('profile.admin') : __('profile.member');
    document.getElementById('profile-departments').textContent = departments.map(displayDepartmentName).join(', ') || __('profile.none');
    document.getElementById('profile-uid').textContent = user.uid;
    renderPermSummary();
}

// UID'yi panoya kopyala
document.getElementById('copy-uid-btn')?.addEventListener('click', () => {
    const uid = document.getElementById('profile-uid').textContent;
    if (!uid || uid === '—') return;
    navigator.clipboard?.writeText(uid).then(
        () => showToast(() => __('profile.uid_copied'), 'success'),
        () => showToast(() => __('profile.uid_copied_fail'), 'error')
    );
});

/** Profil menusu: 8 sablon ogeli (icerikler sonradan doldurulacak). */
function initProfileMenu() {
    const btn = document.getElementById('profile-menu-btn');
    const pop = document.getElementById('profile-menu-pop');
    if (!btn || !pop) return;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = pop.style.display !== 'none';
        if (open) { pop.style.display = 'none'; return; }
        pop.innerHTML = `<button type="button" class="menu-item">${__('header.logout')}</button>`;
        pop.style.display = 'block';
        pop.querySelector('button').onclick = () => auth.signOut();
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#profile-menu-pop') && !e.target.closest('#profile-menu-btn')) {
            pop.style.display = 'none';
        }
    });
}

/** Profil kartinda kullanacinin sekmeler bazindaki efektif yetkileri. */
function renderPermSummary() {
    const container = document.getElementById('profile-perms');
    if (!container) return;
    container.innerHTML = PANELS ? Object.entries(PANELS).map(([tabId, panels]) => {
        const best = panels.reduce((acc, p) => {
            const lvl = getEffectivePanelLevel(`${tabId}.${p.id}`);
            return ({ none: 0, read: 1, write: 2 })[lvl] > ({ none: 0, read: 1, write: 2 })[acc] ? lvl : acc;
        }, 'none');
        const label = best === 'write' ? __('perms.level_write') : best === 'read' ? __('perms.level_read') : __('perms.level_none');
        const cls = best === 'write' ? 'perm-write' : best === 'read' ? 'perm-read' : 'perm-none';
        return `<div class="perm-summary-row"><span>${__(`nav.${tabId}`)}</span><span class="perm-badge ${cls}">${label}</span></div>`;
    }).join('') : '';
}

function disableReadOnlyControls(panel) {
    panel.querySelectorAll('input,textarea,select,button').forEach(control => {
        if(control.id.includes('search') || control.matches('.btn-refresh,.filter-chip,.contributor-cell-name,.retry-btn,[data-read-action]'))return;
        if(!control.disabled)control.dataset.roleDisabled='true';
        control.disabled=true;
    });
}

function hideBootstrapLoader() {
    const loader=dom.appLoader;
    if(!loader?.isConnected||loader.classList.contains('is-leaving')||document.documentElement.dataset.startupFailed === 'true')return;
    translatePage();
    loader.classList.add('is-leaving');
    loader.addEventListener('transitionend',()=>loader.remove(),{once:true});
    setTimeout(()=>loader.remove(),window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:220);
}
