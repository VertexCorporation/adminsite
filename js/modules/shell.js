import { showWorkspace } from './views.js';
import { afterMotion } from '../ui/motion.js';
import { lockScroll, unlockScroll } from '../ui/overlay.js';
import { animateViewEntry } from '../ui/transition.js';
// js/modules/shell.js
//
// Uygulama kabuğu ve yükseltilmiş yüzey altyapısı:
//  - Tema yönetimi (Light / Dark / System) ve OS tercihini izleme
//  - Mobil sidebar drawer
//  - Anchored popover (flip + clamp + focus geri dönüşü)
//  - Sağ drawer, modal, confirmation dialog (odak tuzağı dahil)
//  - Tek seferde tek yüzey: çakışma önlenir.
// Tüm yüzeyler kapanışta DOM'dan tamamen kaldırılır; event listener
// sızıntısı bırakmaz (unbind listeleri ile).

import { __, getLang, setLang, onLangChange } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
import { getEffectivePanelLevel, isPanelAdmin } from './roles.js';

/* ==================================================================
   TEMA
   ================================================================== */

const THEME_META_DARK = '#0F0F10';
const THEME_META_LIGHT = '#F8F9FA';

export function applyTheme(mode) {
    const html = document.documentElement;
    html.classList.add('theme-anim');
    if (mode === 'dark') html.removeAttribute('data-theme');
    else html.setAttribute('data-theme', mode);
    try { localStorage.setItem('theme', mode); } catch { /* ignore */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    const isDark = mode === 'dark' ||
        (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (meta) meta.setAttribute('content', isDark ? THEME_META_DARK : THEME_META_LIGHT);
    document.getElementById('vertex-favicon')?.setAttribute('href', `assets/favicon-${isDark ? 'dark' : 'light'}.svg?v=2`);
    document.dispatchEvent(new CustomEvent('vertex:theme', { detail: { mode } }));
    setTimeout(() => html.classList.remove('theme-anim'), 200);
    updateThemeButton();
}

export function getThemeMode() {
    try { return localStorage.getItem('theme') || 'dark'; } catch { return 'dark'; }
}

function updateThemeButton() {
    const label = document.querySelector('#theme-menu-btn .topbar-select-label');
    if (label) label.textContent = __(`theme.${getThemeMode()}`);
    const svg = document.querySelector('#theme-menu-btn .icon');
    if (svg) {const holder=document.createElement('template');holder.innerHTML=icon(getThemeMode()==='light'?'sun':getThemeMode()==='dark'?'moon':'device-desktop');svg.replaceWith(holder.content.firstChild);}
}

function initTheme() {
    // Başlangıç: head içindeki inline script temayı yazmıştır (FOUC önlenir).
    const mode = getThemeMode();
    const html = document.documentElement;
    if (mode === 'light') html.setAttribute('data-theme', 'light');
    else if (mode === 'system') html.setAttribute('data-theme', 'system');
    else html.removeAttribute('data-theme');
    // Sistem tercihi değişirse System modunda anında uygula.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getThemeMode() === 'system') applyTheme('system');
    });
    applyTheme(mode);
}


/* ==================================================================
   ANCHORED POPOVER
   Tetikleyiciye görsel olarak bağlı; alta sığmazsa üste geçer,
   kenarlara taşmaz. Kapanınca odak tetikleyiciye döner.
   ================================================================== */

let activePopover = null;

export function closePopover({ restoreFocus = true } = {}) {
    if (!activePopover) return;
    const { el, anchor, onAfterClose, unbind } = activePopover;
    activePopover = null;
    unbind.forEach(fn => fn());
    el.classList.remove('is-open');
    el.classList.add('is-closing');
    el.setAttribute('aria-hidden','true');
    el.inert = true;
    if (el.isConnected) afterMotion(el, () => el.remove(), 'transform');
    anchor?.classList.remove('is-open');
    anchor?.setAttribute('aria-expanded', 'false');
    unregisterSurface('popover');
    if (restoreFocus && anchor && document.contains(anchor)) anchor.focus({ preventScroll: true });
    onAfterClose?.();
}

/**
 * @param {HTMLElement} anchor Tetikleyici buton.
 * @param {object} opts { className, render(el), onOpen(el), onAfterClose() }
 * @returns {HTMLElement|null} popover elemanı.
 */
export function openPopover(anchor, opts = {}) {
    if (activePopover?.anchor === anchor) { closePopover(); return null; }
    if (activePopover) closePopover({ restoreFocus: false });
    if (!activeDrawer?.root.contains(anchor)) closeDrawer(false);

    const el = document.createElement('div');
    el.className = `vx-popover ${activeDrawer?.root.contains(anchor)?'drawer-popover':''} ${opts.className || ''}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', anchor.getAttribute('aria-label') || anchor.textContent.trim());

    const unbind = [];
    const position = () => {
        // Certificate sheets keep their compact mobile layout; utility menus stay anchored.
        if (window.innerWidth <= 720 && el.classList.contains('cert-popover')) { el.style.left = ''; el.style.top = ''; return; }
        const r = anchor.getBoundingClientRect();
        const margin = 8;
        const pw = el.offsetWidth, ph = el.offsetHeight;
        const vw = window.innerWidth, vh = window.innerHeight;
        let left = Math.min(Math.max(margin, r.left + (r.width / 2) - (pw / 2)), vw - pw - margin);
        let top = r.bottom + 6;
        if (top + ph > vh - margin) {
            const above = r.top - ph - 6;
            if (above >= margin) top = above;
            else top = Math.max(margin, vh - ph - margin);
        }
        el.style.left = `${Math.round(left)}px`;
        el.style.top = `${Math.round(top)}px`;
        el.style.transformOrigin = top >= r.bottom ? 'top center' : 'bottom center';
    };

    document.body.appendChild(el);
    opts.render?.(el);
    position();
    requestAnimationFrame(() => {
        if (activePopover?.el !== el) return;
        el.classList.add('is-open');
        position();
    });

    anchor.classList.add('is-open');
    anchor.setAttribute('aria-expanded', 'true');
    registerSurface('popover');

    const onDocMouseDown = (e) => {
        if (!el.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) closePopover();
    };
    const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); closePopover(); }
        if (el.contains(document.activeElement) && ['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
            const items=[...el.querySelectorAll('.menu-item:not([disabled])')];
            if (!items.length) return;
            e.preventDefault();
            const current=items.indexOf(document.activeElement);
            const index=e.key==='Home'?0:e.key==='End'?items.length-1:(current+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;
            items[index].focus();
        }
    };
    const onScroll = (e) => {
        if (el.contains(e.target)) return;
        position();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', position);
    unbind.push(() => {
        document.removeEventListener('mousedown', onDocMouseDown);
        document.removeEventListener('keydown', onKey, true);
        window.removeEventListener('scroll', onScroll, { capture: true, passive: true });
        window.removeEventListener('resize', position);
    });

    activePopover = { el, anchor, onAfterClose: opts.onAfterClose, unbind };
    opts.onOpen?.(el);
    el.tabIndex = -1;
    (el.querySelector('button:not([disabled])') || el).focus({preventScroll:true});
    return el;
}


/* ==================================================================
   DRAWER (sağ panel)
   ================================================================== */

let activeDrawer = null;

export function closeDrawer(restoreFocus = true) {
    if (!activeDrawer) return;
    const { root, scrim, unbind, onAfterClose, previouslyFocused } = activeDrawer;
    activeDrawer = null;
    unbind.forEach(fn => fn());
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    root.inert = true;
    scrim.style.pointerEvents = 'none';
    scrim.classList.remove('is-open');
    afterMotion(root, () => { root.remove(); scrim.remove(); onAfterClose?.(); }, 'transform');
    unlockScroll('drawer');
    unregisterSurface('drawer');
    if (restoreFocus && previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
    }
}

/**
 * @param {object} opts { title, render(el), footerHTML, onOpen(el), onAfterClose() }
 * @returns {HTMLElement} drawer body.
 */
export function openDrawer(opts = {}) {
    if (activeDrawer) closeDrawer(false);
    closePopover({ restoreFocus: true });

    const previouslyFocused = document.activeElement;
    const root = document.createElement('div');
    root.className = 'vx-drawer';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', opts.title || '');
    const scrim = document.createElement('div');
    scrim.className = 'vx-drawer-scrim';

    root.innerHTML = `
        <div class="vx-drawer-header">
            <span class="vx-drawer-title"></span>
            <button type="button" class="icon-action-btn drawer-close" aria-label="${__('common.close')}">${icon('x', { size: 18 })}</button>
        </div>
        <div class="vx-drawer-body"></div>
        ${opts.footerHTML ? `<div class="vx-drawer-footer">${opts.footerHTML}</div>` : ''}
    `;
    root.querySelector('.vx-drawer-title').textContent = opts.title || '';

    document.body.append(scrim, root);
    lockScroll('drawer');

    const body = root.querySelector('.vx-drawer-body');
    opts.render?.(body);

    requestAnimationFrame(() => {
        if (activeDrawer?.root !== root) return;
        root.classList.add('is-open');
        scrim.classList.add('is-open');
    });

    registerSurface('drawer');

    const unbind = [];
    const updateLabels=()=>{if(opts.titleKey){const title=__(opts.titleKey)+(opts.titleSuffix?' · '+opts.titleSuffix:'');root.querySelector('.vx-drawer-title,.vx-modal-title').textContent=title;root.setAttribute('aria-label',title);}root.querySelector('.drawer-close,.modal-close')?.setAttribute('aria-label',__('common.close'));};
    unbind.push(onLangChange(updateLabels));
    const onKey = (e) => {
        if (activeModal || activePopover) return;
        if (e.key === 'Escape') { e.stopPropagation(); closeDrawer(); }
        if (e.key === 'Tab') {
            const items=[...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])')];
            const first=items[0],last=items[items.length-1];
            if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
            else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
        }
    };
    document.addEventListener('keydown', onKey);
    scrim.addEventListener('mousedown', () => closeDrawer());
    root.querySelector('.drawer-close').addEventListener('click', () => closeDrawer());
    unbind.push(() => document.removeEventListener('keydown', onKey));

    activeDrawer = { root, scrim, unbind, onAfterClose: opts.onAfterClose, previouslyFocused };

    const focusable = root.querySelector('button, [href], input, select, textarea, [tabindex]');
    (focusable || root).focus({ preventScroll: true });

    opts.onOpen?.(body);
    return body;
}


/* ==================================================================
   MODAL / CONFIRMATION (odak tuzağı)
   ================================================================== */

let activeModal = null;

export function closeModal() {
    if (!activeModal) return;
    const { root, overlay, unbind, onAfterClose, previouslyFocused } = activeModal;
    activeModal = null;
    unbind.forEach(fn => fn());
    root.classList.remove('is-open');overlay.classList.remove('is-open');overlay.classList.add('is-closing');
    root.setAttribute('aria-hidden','true');root.inert=true;root.style.pointerEvents='none';overlay.style.pointerEvents='none';
    afterMotion(root, () => { root.remove(); overlay.remove(); }, 'transform');
    unlockScroll('modal');
    unregisterSurface('modal');
    if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true });
    onAfterClose?.();
}

/**
 * @param {object} opts { title, render(el), footerHTML, onOpen(el), onAfterClose() }
 * @returns {HTMLElement} modal body.
 */
export function openModal(opts = {}) {
    if (activeModal) closeModal();
    document.querySelectorAll('.vx-modal[aria-hidden=true],.vx-overlay.is-closing').forEach(surface=>surface.remove());
    closePopover({ restoreFocus: true });

    const previouslyFocused = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'vx-overlay';
    const root = document.createElement('div');
    root.className = `vx-modal${opts.size === 'large' ? ' vx-modal--large' : ''}`;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', opts.title || '');

    root.innerHTML = `
        <div class="vx-modal-header">
            <span class="vx-modal-title"></span>
            <button type="button" class="icon-action-btn modal-close" aria-label="${__('common.close')}">${icon('x', { size: 18 })}</button>
        </div>
        <div class="vx-modal-body"></div>
        ${opts.footerHTML ? `<div class="vx-modal-footer">${opts.footerHTML}</div>` : ''}
    `;
    root.querySelector('.vx-modal-title').textContent = opts.title || '';

    document.body.append(overlay, root);
    lockScroll('modal');
    const body = root.querySelector('.vx-modal-body');
    opts.render?.(body);
    requestAnimationFrame(() => { if(activeModal?.root !== root)return;overlay.classList.add('is-open'); root.classList.add('is-open'); });

    registerSurface('modal');

    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const trapFocus = (e) => {
        if (e.key !== 'Tab') return;
        const items = [...root.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } };

    document.addEventListener('keydown', trapFocus);
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('mousedown', () => closeModal());
    root.querySelector('.modal-close').addEventListener('click', () => closeModal());

    const unbind = [
        () => document.removeEventListener('keydown', trapFocus),
        () => document.removeEventListener('keydown', onKey)
    ];
    unbind.push(onLangChange(()=>{if(opts.titleKey){const title=__(opts.titleKey)+(opts.titleSuffix?' · '+opts.titleSuffix:'');root.querySelector('.vx-modal-title').textContent=title;root.setAttribute('aria-label',title);}root.querySelector('.modal-close').setAttribute('aria-label',__('common.close'));}));
    activeModal = { root, overlay, unbind, onAfterClose: opts.onAfterClose, previouslyFocused };

    const focusable = root.querySelector(FOCUSABLE);
    (focusable || root).focus({ preventScroll: true });



    opts.onOpen?.(body);
    return body;
}


/**
 * Onay diyaloğu (yıkıcı işlemler / sertifika gönderimi).
 * resolve(true) yalnızca açık onayda döner.
 * @param {(() => { title, body?, warning?, rows?, confirmLabel?, cancelLabel?, danger? }) | object} options
 * @returns {Promise<boolean>}
 */
export function confirmDialog(options = {}) {
    return new Promise(resolve => {
        document.querySelectorAll('.vx-modal[aria-hidden=true],.vx-modal.confirm-dialog-modal,.vx-overlay.is-closing').forEach(s => s.remove());
        const getOptions = () => typeof options === 'function' ? options() : options;

        // Oluşturulan dialog elementi (overlay + root ayrıca eklenir)
        const previouslyFocused = document.activeElement;
        const overlay = document.createElement('div');
        overlay.className = 'vx-overlay';
        const root = document.createElement('div');
        root.className = 'vx-modal confirm-dialog-modal';
        root.setAttribute('role', 'alertdialog');
        root.setAttribute('aria-modal', 'true');

        document.body.append(overlay, root);
        lockScroll('confirm');
        registerSurface('modal');

        let resolved = false;
        function finish(result) {
            if (resolved) return;
            resolved = true;
            cleanup();
            root.querySelectorAll('.confirm-ok, .confirm-cancel, .cancel-btn').forEach(b => {
                b.classList.remove('confirm-ok', 'confirm-cancel');
                b.disabled = true;
            });
            root.classList.remove('is-open');
            overlay.classList.remove('is-open');
            overlay.classList.add('is-closing');
            root.setAttribute('aria-hidden', 'true');
            root.inert = true;
            root.style.pointerEvents = 'none';
            overlay.style.pointerEvents = 'none';
            afterMotion(root, () => { root.remove(); overlay.remove(); }, 'transform');
            unlockScroll('confirm');
            unregisterSurface('modal');
            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus({ preventScroll: true });
            }
            resolve(result);
        }

        function paint() {
            if (!root.isConnected) return;
            const opts = getOptions();
            const isDanger = !!opts.danger;

            const dangerIconHTML = isDanger
                ? `<div class="confirm-dialog-icon danger">${icon('alert-triangle', { size: 28 })}</div>`
                : `<div class="confirm-dialog-icon">${icon('help-circle', { size: 28 })}</div>`;

            const bodyHTML = opts.body
                ? `<p class="confirm-dialog-desc">${opts.body}</p>`
                : '';

            const warningHTML = opts.warning
                ? `<div class="confirm-dialog-warning">${icon('alert-triangle')}<span>${opts.warning}</span></div>`
                : '';

            const rowsHTML = (opts.rows || []).length
                ? `<dl class="confirm-dialog-rows">${(opts.rows).map(row =>
                    `<div class="confirm-dialog-row"><dt>${row.label}</dt><dd>${row.value}</dd></div>`
                  ).join('')}</dl>`
                : '';

            const confirmLabel = opts.confirmLabel || __('common.confirm');
            const cancelLabel  = opts.cancelLabel  || __('common.cancel');
            const dangerClass  = isDanger ? ' chrome-btn-danger' : '';

            root.innerHTML = `
                <div class="confirm-dialog-body vx-modal-body">
                    ${dangerIconHTML}
                    <h2 class="confirm-dialog-title vx-modal-title"></h2>
                    ${bodyHTML}
                    ${warningHTML}
                    ${rowsHTML}
                </div>
                <div class="confirm-dialog-footer">
                    <button type="button" class="chrome-btn-outline cancel-btn confirm-cancel"></button>
                    <button type="button" class="chrome-btn-primary${dangerClass} confirm-ok"></button>
                </div>`;

            root.querySelector('.confirm-dialog-title').textContent = opts.title || __('common.confirm');
            root.setAttribute('aria-label', opts.title || __('common.confirm'));
            root.querySelector('.confirm-ok').textContent  = confirmLabel;
            root.querySelector('.cancel-btn').textContent  = cancelLabel;

            root.querySelector('.confirm-ok').onclick  = () => finish(true);
            root.querySelector('.cancel-btn').onclick  = () => finish(false);
        }

        const unsubscribeLang = onLangChange(paint);
        paint();

        requestAnimationFrame(() => {
            if (!root.isConnected) return;
            overlay.classList.add('is-open');
            root.classList.add('is-open');
        });

        // Focus tuzağı + Escape / dış tıklama → false
        const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const trapFocus = (e) => {
            if (e.key !== 'Tab') return;
            const items = [...root.querySelectorAll(FOCUSABLE)];
            if (!items.length) return;
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(false); } };
        overlay.addEventListener('mousedown', () => finish(false));
        document.addEventListener('keydown', trapFocus);
        document.addEventListener('keydown', onKey);

        function cleanup() {
            unsubscribeLang();
            document.removeEventListener('keydown', trapFocus);
            document.removeEventListener('keydown', onKey);
        }

        // İlk odak: Onayla butonu (tehlikeli işlemlerde Cancel daha güvenli olabilir ama standart UX)
        const focusTarget = root.querySelector(FOCUSABLE);
        (focusTarget || root).focus({ preventScroll: true });
    });
}


/* ==================================================================
   UYGULAMA KABUĞU BAŞLATMA
   ================================================================== */

function syncTopbarTitle() {
    const activeBtn = document.querySelector('.dock-btn.active');
    const title = document.querySelector('.topbar-page-title');
    if (activeBtn && title) {
        const child = activeBtn.closest('.nav-module')?.querySelector('[aria-current=page]');
        const section = activeBtn.dataset.target === 'tab-system' ? document.querySelector('#tab-system .system-sections [aria-pressed=true]') : null;
        title.textContent = section?.textContent.trim() || child?.textContent.trim() || activeBtn.querySelector('.dock-label')?.textContent.trim() || '';
        document.title = title.textContent ? `${title.textContent} · Vertex Konsol` : __('page.title');
    }
}

function expandModule(module, expanded) {
    if (!module) return;
    const submenu = module.querySelector('.sidebar-submenu');
    if (!submenu) return;
    if (!expanded && submenu.contains(document.activeElement)) module.querySelector('.dock-btn').focus();
    module.classList.toggle('expanded', expanded);
    module.querySelector('.dock-btn').setAttribute('aria-expanded', String(expanded));
    submenu.inert = !expanded;
}

export function refreshNavigation() {
    document.querySelectorAll('.nav-module').forEach(module => {
        const button = module.querySelector('.dock-btn');
        const available = button.style.display !== 'none';
        module.hidden = !available;
        module.querySelectorAll('[data-nav-panel]').forEach(child => {
            const keys = child.dataset.navPanel.split(',');
            child.hidden = !keys.some(key => (key !== 'system.deptPerms' || isPanelAdmin()) && getEffectivePanelLevel(key) !== 'none');
            if (child.dataset.navAction === 'model-editor') child.hidden = getEffectivePanelLevel('models.manage') !== 'write';
            if (child.dataset.navAction === 'certificates') child.hidden = !isPanelAdmin();
        });
        button.querySelector('.nav-chevron')?.toggleAttribute('hidden', ![...module.querySelectorAll('[data-nav-panel]')].some(child => !child.hidden));
        expandModule(module, available && button.classList.contains('active'));
    });
    document.querySelectorAll('.sidebar-sub-btn').forEach(child=>child.removeAttribute('aria-current'));
    const activeModule=document.querySelector('.nav-module .dock-btn.active')?.closest('.nav-module');
    const selected=activeModule?.querySelector('[data-nav-selected]:not([hidden])')||activeModule?.querySelector('.sidebar-sub-btn:not([hidden])');
    selected?.setAttribute('aria-current','page');
    document.querySelectorAll('.sidebar-group').forEach(group => { group.hidden = ![...group.querySelectorAll('.nav-module')].some(module => !module.hidden); });
    if(selected)showWorkspace(document.querySelector('.tab-panel.active'),selected.dataset.navPanel.split(','));
    syncTopbarTitle();
    syncMobileDock();
}

function syncMobileDock() {
    document.querySelectorAll('[data-mobile-tab]').forEach(button=>{
        const source=document.querySelector(`.dock-btn[data-target="${button.dataset.mobileTab}"]`);
        button.hidden=!source||source.style.display==='none';
        button.setAttribute('aria-current',source?.classList.contains('active')?'page':'false');
        button.setAttribute('aria-label',source?.textContent.trim()||'');
    });
}

function initNavigation() {
    const nav = document.getElementById('navigation-tabs-dock');
    const sidebar = document.querySelector('.app-sidebar');
    const toggle = document.getElementById('nav-toggle');
    const scrim = document.createElement('div'); scrim.className = 'nav-scrim'; document.body.append(scrim);
    let mobileTrigger = null;
    const mobile = () => window.innerWidth < 1024;
    const closeSidebarDrawer = (restore = false) => {
        sidebar?.classList.remove('open'); scrim.classList.remove('is-open');
        document.querySelectorAll('.app-main,.app-header,.mobile-bottom-dock').forEach(el => {el.inert=false;});
        toggle?.setAttribute('aria-expanded', 'false');
        if (sidebar) sidebar.inert = mobile();
        sidebar?.removeAttribute('aria-modal'); sidebar?.removeAttribute('role');
        unlockScroll('navigation');
        if (restore && mobileTrigger?.isConnected) mobileTrigger.focus({preventScroll:true});
    };
    const activateTab = button => {
        const target = document.getElementById(button.dataset.target);
        if (!target || button.style.display === 'none') return;
        const changed = !target.classList.contains('active');
        document.querySelectorAll('.tab-panel,.dock-btn').forEach(el => el.classList.remove('active'));
        target.classList.add('active'); button.classList.add('active');
        if (changed) animateViewEntry(target);

        refreshNavigation();
        if(target.id==='tab-chat')document.dispatchEvent(new CustomEvent('vertex:workspace',{detail:{keys:['chat.channels']}}));
        if (changed) window.scrollTo({top:0,behavior:'instant'});
    };
    const dock=document.createElement('nav');dock.className='mobile-bottom-dock';dock.setAttribute('aria-label',__('navigation.main'));
    dock.innerHTML=['home','contributors','models','news','notifications'].map((id,i)=>`<button type="button" data-mobile-tab="tab-${id}">${icon(['home','users-group','robot','news','bell'][i])}</button>`).join('')+`<button type="button" data-mobile-more aria-label="${__('contributors.more')}">${icon('dots')}</button>`;
    document.querySelector('.app-layout').append(dock);
    dock.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-mobile-more')){openMore(button);return;}const source=document.querySelector(`.dock-btn[data-target="${button.dataset.mobileTab}"]`);if(source){activateTab(source);const selected=source.closest('.nav-module')?.querySelector('[aria-current=page]');if(selected)selected.click();else if(source.dataset.target==='tab-home'||source.dataset.target==='tab-chat')recordRoute({dataset:{navPanel:source.dataset.target.slice(4),navAction:''}});closeSidebarDrawer(false);}});
    onLangChange(()=>{dock.setAttribute('aria-label',__('navigation.main'));dock.querySelector('[data-mobile-more]').setAttribute('aria-label',__('contributors.more'));syncMobileDock();});
    function openMore(anchor){
        let unsubscribe=()=>{};const body=openModal({title:__('navigation.more'),titleKey:'navigation.more',onAfterClose:()=>unsubscribe()});
        body.closest('.vx-modal').classList.add('mobile-more-sheet');
        const paint=()=>{
            body.innerHTML='<nav class="mobile-more-pages" aria-label="'+__('navigation.more')+'">'+[...document.querySelectorAll('.nav-module:not([hidden])')].map(module=>{
                const main=module.querySelector('.dock-btn');const children=[...module.querySelectorAll('[data-nav-panel]:not([hidden])')];
                return '<section data-more-module="'+main.dataset.target+'"><h3>'+main.querySelector('.dock-label').textContent+'</h3>'+children.map(child=>'<button type="button" data-more-panel="'+child.dataset.navPanel+'" data-more-action="'+child.dataset.navAction+'" '+(child.getAttribute('aria-current')==='page'?'aria-current="page"':'')+'>'+child.textContent.trim()+icon('chevron-right')+'</button>').join('')+(children.length?'':'<button type="button" data-more-tab="'+main.dataset.target+'">'+main.querySelector('.dock-label').textContent+icon('chevron-right')+'</button>')+'</section>';
            }).join('')+'<section><button type="button" data-more-profile>'+__('nav.profile')+icon('chevron-right')+'</button></section></nav>';
            body.querySelectorAll('[data-more-panel]').forEach(button=>button.onclick=()=>{const child=[...document.querySelectorAll('.sidebar-sub-btn:not([hidden])')].find(el=>el.dataset.navPanel===button.dataset.morePanel&&el.dataset.navAction===button.dataset.moreAction);if(child){closeModal();child.click();}});
            body.querySelectorAll('[data-more-tab]').forEach(button=>button.onclick=()=>{const main=document.querySelector('.dock-btn[data-target="'+button.dataset.moreTab+'"]');closeModal();activateTab(main);});
            body.querySelector('[data-more-profile]').onclick=()=>{closeModal();document.querySelector('.sidebar-footer .dock-btn').click();};
        };paint();
        unsubscribe=onLangChange(paint);document.addEventListener('vertex:departments',()=>{if(body.isConnected)paint();},{once:true});

    }
    let restoringRoute = false;
    const recordRoute = child => {
        if (restoringRoute) return;
        const route = {panel:child.dataset.navPanel, action:child.dataset.navAction||''};
        if (JSON.stringify(history.state?.vertexRoute) !== JSON.stringify(route)) history.pushState({vertexRoute:route}, '', location.pathname+'?panel='+encodeURIComponent(route.panel)+'&view='+encodeURIComponent(route.action));
    };
    const restoreRoute = () => {
        const params=new URLSearchParams(location.search);
        const route=history.state?.vertexRoute || {panel:params.get('panel'),action:params.get('view')||''};
        if (route.panel === 'home' || route.panel === 'chat') {
            const tabButton = document.querySelector('.dock-btn[data-target="tab-' + route.panel + '"]');
            if(tabButton){restoringRoute=true;activateTab(tabButton);restoringRoute=false;}
            return;
        }
        const child=[...document.querySelectorAll('[data-nav-panel]')].find(el=>el.dataset.navPanel===route.panel&&el.dataset.navAction===route.action&&!el.hidden);
        const exportChild=route.action==='attributions'?[...document.querySelectorAll('[data-nav-panel]')].find(el=>el.dataset.navAction==='export'&&el.dataset.navPanel===route.panel&&!el.hidden):null;
        if(child||exportChild){restoringRoute=true;(child||exportChild).click();if(exportChild)document.dispatchEvent(new CustomEvent('vertex:system-section',{detail:'attributions'}));restoringRoute=false;}
    };
    document.addEventListener('vertex:system-page',event=>{syncTopbarTitle();if(document.querySelector('.dock-btn.active')?.dataset.target==='tab-system'&&event.detail==='attributions'){const source=document.querySelector('[data-nav-action=export]');if(source)recordRoute({dataset:{navPanel:source.dataset.navPanel,navAction:'attributions'}});}});
    window.addEventListener('popstate',restoreRoute);
    document.addEventListener('vertex:departments',()=>setTimeout(restoreRoute,0));
    nav?.addEventListener('click', event => {
        const button = event.target.closest('.dock-btn');
        if (button) {
            const module = button.closest('.nav-module');
            const wasActive = button.classList.contains('active');
            const wasExpanded = module?.classList.contains('expanded');
            activateTab(button);
            const destination=module?.querySelector('[aria-current=page]');if(destination)recordRoute(destination);
            else if(button.dataset.target==='tab-home'||button.dataset.target==='tab-chat')recordRoute({dataset:{navPanel:button.dataset.target.slice(4),navAction:''}});
            if (wasActive) expandModule(module, !wasExpanded);
            // Keep mobile navigation open while choosing a contextual destination.
            if (!module?.querySelector('.sidebar-submenu')) closeSidebarDrawer(true);
            return;
        }
        const child = event.target.closest('[data-nav-panel]');
        if (!child || child.hidden) return;
        const parent = child.closest('.nav-module').querySelector('.dock-btn');
        activateTab(parent); child.closest('.nav-module').querySelectorAll('.sidebar-sub-btn').forEach(el=>{el.removeAttribute('aria-current');el.removeAttribute('data-nav-selected');});child.setAttribute('data-nav-selected','');child.setAttribute('aria-current','page');
        recordRoute(child);syncTopbarTitle();
        const action = child.dataset.navAction;
        if(action!=='certificates')closeDrawer(false);
        if (parent.dataset.target === 'tab-system') document.dispatchEvent(new CustomEvent('vertex:system-section',{detail:action}));
        const keys = child.dataset.navPanel.split(',');
        showWorkspace(document.getElementById(parent.dataset.target),keys);
        const card = [...document.querySelectorAll('.panel-card[data-panel]')].find(el => keys.includes(el.dataset.panel) && el.style.display !== 'none');
        closeSidebarDrawer(false);
        if (action === 'model-editor') {card?.focus({preventScroll:true});}
        else {
            window.scrollTo({top:0,behavior:'instant'});
            if (action === 'certificates') document.dispatchEvent(new CustomEvent('vertex:certificate-selector'));
            else if (card) { card.tabIndex = -1; card.focus({preventScroll:true}); }
        }
    });
    document.querySelector('.sidebar-footer .dock-btn')?.addEventListener('click', event => { activateTab(event.currentTarget); closeSidebarDrawer(true); });
    toggle?.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) { closeSidebarDrawer(true); return; }
        mobileTrigger = document.activeElement;
        lockScroll('navigation');
        sidebar.inert = false; sidebar.classList.add('open'); scrim.classList.add('is-open');
        document.querySelectorAll('.app-main,.app-header,.mobile-bottom-dock').forEach(el => {el.inert=true;});
        sidebar.setAttribute('role','dialog'); sidebar.setAttribute('aria-modal','true'); sidebar.setAttribute('aria-label',__('navgroup.workspace'));
        toggle.setAttribute('aria-expanded','true');
        (sidebar.querySelector('.dock-btn.active') || sidebar.querySelector('.dock-btn'))?.focus();
    });
    scrim.addEventListener('click', () => closeSidebarDrawer(true));
    sidebar.querySelector('.sidebar-close')?.addEventListener('click', () => closeSidebarDrawer(true));
    document.addEventListener('keydown', event => {
        if (!sidebar.classList.contains('open')) return;
        if (event.key === 'Escape') { event.preventDefault(); closeSidebarDrawer(true); }
        if (event.key === 'Tab') {
            const items = [...sidebar.querySelectorAll('button:not([disabled])')].filter(el => el.getClientRects().length && !el.closest('[inert]'));
            const first = items[0], last = items.at(-1);
            if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
            else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
        }
    });
    let previousWidth = window.innerWidth;
    window.addEventListener('resize', () => {if(window.innerWidth!==previousWidth){previousWidth=window.innerWidth;closeSidebarDrawer();}});
    document.addEventListener('vertex:close-navigation', () => closeSidebarDrawer());
    document.addEventListener('vertex:departments', () => queueMicrotask(refreshNavigation));
    closeSidebarDrawer(); syncTopbarTitle();
    if(!history.state?.vertexRoute&&!new URLSearchParams(location.search).has('panel')) history.replaceState({vertexRoute:{panel:'home',action:''}},'',location.pathname+'?panel=home&view=');
}

function initTopbarMenus() {
    const themeBtn = document.getElementById('theme-menu-btn');
    themeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openPopover(themeBtn, {
            className: 'theme-popover',
            render(el) {
                const modes = ['light', 'dark', 'system'];
                const current = getThemeMode();
                el.innerHTML = `<div class="vx-popover-header"><span class="vx-popover-title">${__('theme.select')}</span>
                        </div>
                    <div class="menu-list" role="menu">
                        ${modes.map(m => `<button type="button" class="menu-item ${m === current ? 'is-selected' : ''}" data-theme-mode="${m}" role="menuitemradio" aria-checked="${m === current}">
                            ${icon(m === 'light' ? 'sun' : m === 'dark' ? 'moon' : 'device-desktop', { size: 16 })}
                            <span>${__(`theme.${m}`)}</span>
                            <span class="menu-item-check">${icon('check', { size: 16 })}</span>
                        </button>`).join('')}
                    </div>`;
                el.querySelectorAll('[data-theme-mode]').forEach(item => {
                    item.addEventListener('click', () => {
                        applyTheme(item.dataset.themeMode);
                        closePopover({ restoreFocus: false });
                    });
                });
            }
        });
    });

    const langBtn = document.getElementById('lang-toggle-btn');
    langBtn?.addEventListener('click', () => {
        openPopover(langBtn, {className:'language-popover', render(el) {
            el.innerHTML = `<div class="menu-list" role="menu">${[['tr',__('language.tr')],['en',__('language.en')]].map(([lang,label]) => `<button type="button" class="menu-item ${getLang() === lang ? 'is-selected' : ''}" role="menuitemradio" aria-checked="${getLang() === lang}" data-language="${lang}"><span>${label}</span><span class="menu-item-check">${icon('check')}</span></button>`).join('')}</div>`;
            el.querySelectorAll('[data-language]').forEach(button => button.onclick = () => {setLang(button.dataset.language);closePopover();});
        }});
    });
}

function initFileControls() {
    const controls = [];
    document.querySelectorAll('input[type="file"]').forEach(input => {
        const wrapper = document.createElement('div'); wrapper.className = 'file-control';
        const button = document.createElement('button'); button.type = 'button';button.className = 'chrome-btn-outline file-select-btn write-only';
        button.setAttribute('aria-controls',input.id);
        const label = document.createElement('span');label.className='file-control-name';label.setAttribute('aria-live','polite');
        input.before(wrapper);wrapper.append(input,button,label);
        input.classList.add('file-control-input');input.tabIndex=-1;
        button.onclick=()=>input.click();
        const paint=()=>{button.textContent=__('common.choose_file');label.textContent=input.files?.[0]?.name || __('common.no_file');button.disabled=input.disabled;};
        input.addEventListener('change',paint);controls.push(paint);paint();
    });
    onLangChange(()=>controls.forEach(paint=>paint()));
}

export function initShell() {
    initTheme();
    initFileControls();
    initNavigation();
    initTopbarMenus();
    onLangChange(() => { syncTopbarTitle(); updateThemeButton(); if(document.querySelector('.language-popover.is-open,.theme-popover.is-open'))closePopover({restoreFocus:false}); });
}

/* ==================================================================
   YÜZEN YÜZEY KAYIT YÖNETİMİ (tek seferde tek yüzey)
   ================================================================== */

const openSurfaces = new Map();
function registerSurface(id) { openSurfaces.set(id, (openSurfaces.get(id) || 0) + 1); }
function unregisterSurface(id) {
    const count = openSurfaces.get(id) || 0;
    if (count <= 1) openSurfaces.delete(id);
    else openSurfaces.set(id, count - 1);
}

/** Açık yüzey var mı? */
export function hasOpenSurface() { return openSurfaces.size > 0; }
