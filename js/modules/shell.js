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

/* ==================================================================
   TEMA
   ================================================================== */

const THEME_META_DARK = '#0B0C0E';
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
    updateThemeButton();
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
    if (el.isConnected) el.remove();
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
    closeDrawer(false);

    const el = document.createElement('div');
    el.className = `vx-popover ${opts.className || ''}`;
    el.setAttribute('role', 'dialog');

    const unbind = [];
    const position = () => {
        // Mobil (<=720px): CSS bottom sheet devralır; sadece temizle.
        if (window.innerWidth <= 720) { el.style.left = ''; el.style.top = ''; return; }
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
    scrim.classList.remove('is-open');
    setTimeout(() => { root.remove(); scrim.remove(); }, 240);
    document.body.style.overflow = '';
    unregisterSurface('drawer');
    if (restoreFocus && previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
    }
    onAfterClose?.();
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
    document.body.style.overflow = 'hidden';

    const body = root.querySelector('.vx-drawer-body');
    opts.render?.(body);

    requestAnimationFrame(() => {
        root.classList.add('is-open');
        scrim.classList.add('is-open');
    });

    registerSurface('drawer');

    const unbind = [];
    const onKey = (e) => {
        if (document.querySelector('.vx-modal')) return;
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
    root.remove();
    overlay.remove();
    document.body.style.overflow = '';
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
    closePopover({ restoreFocus: true });

    const previouslyFocused = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'vx-overlay';
    const root = document.createElement('div');
    root.className = 'vx-modal';
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
    document.body.style.overflow = 'hidden';
    const body = root.querySelector('.vx-modal-body');
    opts.render?.(body);
    requestAnimationFrame(() => { overlay.classList.add('is-open'); root.classList.add('is-open'); });

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
    activeModal = { root, overlay, unbind, onAfterClose: opts.onAfterClose, previouslyFocused };

    const focusable = root.querySelector(FOCUSABLE);
    (focusable || root).focus({ preventScroll: true });

    opts.onOpen?.(body);
    return body;
}


/**
 * Onay diyaloğu (yıkıcı işlemler / sertifika gönderimi).
 * resolve(true) yalnızca açık onayda döner.
 * @param {object} opts { title, rows:[{label,value}], warning, confirmLabel, cancelLabel, danger, async }
 * @returns {Promise<boolean>}
 */
export function confirmDialog(options = {}) {
    return new Promise(resolve => {
        let body;
        const getOptions=()=>typeof options==='function'?options():options;
        function paint(){
            if(!body?.isConnected)return;
            const opts=getOptions();
            const root=body.parentElement;
            root.querySelector('.vx-modal-title').textContent=opts.title || __('common.confirm');
            root.setAttribute('aria-label',opts.title || __('common.confirm'));
            const rows=(opts.rows || []).map(row=>`<div class="confirm-row"><dt>${row.label}</dt><dd>${row.value}</dd></div>`).join('');
            body.innerHTML=`${rows?`<dl class="confirm-list">${rows}</dl>`:''}${opts.warning?`<div class="confirm-warn">${icon('alert-triangle')}<span>${opts.warning}</span></div>`:''}`;
            root.querySelector('.confirm-ok').textContent=opts.confirmLabel || __('common.confirm');
            root.querySelector('.confirm-cancel').textContent=opts.cancelLabel || __('common.cancel');
        }
        const unsubscribe=onLangChange(paint);
        body=openModal({title:getOptions().title || __('common.confirm'),footerHTML:'<button type="button" class="chrome-btn-outline confirm-cancel"></button><button type="button" class="chrome-btn-primary confirm-ok"></button>',onAfterClose:()=>{unsubscribe();resolve(false);}});
        paint();
        const root=body.parentElement;
        root.querySelector('.confirm-ok').onclick=()=>{resolve(true);closeModal();};
        root.querySelector('.confirm-cancel').onclick=()=>closeModal();
    });
}

/* ==================================================================
   UYGULAMA KABUĞU BAŞLATMA
   ================================================================== */

function syncTopbarTitle() {
    const activeBtn = document.querySelector('.sidebar-nav .dock-btn.active');
    const title = document.querySelector('.topbar-page-title');
    if (activeBtn && title) title.textContent = activeBtn.querySelector('.dock-label')?.textContent || '';
}

function initNavigation() {
    const nav = document.getElementById('navigation-tabs-dock');
    const sidebar = document.querySelector('.app-sidebar');
    const toggle = document.getElementById('nav-toggle');

    const closeSidebarDrawer = () => {
        sidebar?.classList.remove('open');
        toggle?.setAttribute('aria-expanded', 'false');
    };

    nav?.addEventListener('click', (e) => {
        const btn = e.target.closest('.dock-btn');
        if (!btn) return;
        const targetId = btn.getAttribute('data-target');
        const targetPanel = document.getElementById(targetId);
        if (!targetPanel) return;
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        targetPanel.classList.add('active');
        document.querySelectorAll('.sidebar-nav .dock-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        syncTopbarTitle();
        closeSidebarDrawer();
    });

    toggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = sidebar?.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(!!isOpen));
    });
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeSidebarDrawer(); });
    document.addEventListener('click', (e) => {
        if (sidebar?.classList.contains('open') &&
            !sidebar.contains(e.target) && !toggle.contains(e.target)) {
            closeSidebarDrawer();
        }
    });
    window.addEventListener('resize', () => { if (window.innerWidth > 1024) closeSidebarDrawer(); });
    syncTopbarTitle();
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
                        <button type="button" class="icon-action-btn small popover-x">${icon('x', { size: 16 })}</button></div>
                    <div class="menu-list" role="menu">
                        ${modes.map(m => `<button type="button" class="menu-item ${m === current ? 'is-selected' : ''}" data-theme-mode="${m}" role="menuitemradio" aria-checked="${m === current}">
                            ${icon(m === 'light' ? 'sun' : m === 'dark' ? 'moon' : 'device-desktop', { size: 16 })}
                            <span>${__(`theme.${m}`)}</span>
                            <span class="menu-item-check">${icon('check', { size: 16 })}</span>
                        </button>`).join('')}
                    </div>`;
                el.querySelector('.popover-x').addEventListener('click', () => closePopover());
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
        const next = getLang() === 'tr' ? 'en' : 'tr';
        setLang(next);
    });
}

export function initShell() {
    initTheme();
    initNavigation();
    initTopbarMenus();
    onLangChange(() => { syncTopbarTitle(); updateThemeButton(); });
}

/* ==================================================================
   YÜZEN YÜZEY KAYIT YÖNETİMİ (tek seferde tek yüzey)
   ================================================================== */

const openSurfaces = new Set();
function registerSurface(id) { openSurfaces.add(id); }
function unregisterSurface(id) { openSurfaces.delete(id); }

/** Açık yüzey var mı? */
export function hasOpenSurface() { return openSurfaces.size > 0; }
