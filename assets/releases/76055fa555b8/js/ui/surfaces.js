import { afterMotion } from './motion.js';
import { lockScroll, unlockScroll } from './overlay.js';
import { __, onLangChange } from '../utils/ui.js';
import { icon } from '../utils/icons.js';

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

// Keyboard focus stays inside the active dialog, even after asynchronous
// updates remove a focused control or disable all visible controls.
function trapDialogTab(root,event){
    if(event.key!=='Tab')return;
    const items=[...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
        .filter(el=>!el.closest('[inert],[aria-hidden="true"]')&&el.getClientRects().length);
    if(!items.length){event.preventDefault();root.focus({preventScroll:true});return;}
    const first=items[0],last=items[items.length-1],active=document.activeElement;
    if(!root.contains(active)){event.preventDefault();(event.shiftKey?last:first).focus({preventScroll:true});}
    else if(event.shiftKey&&active===first){event.preventDefault();last.focus({preventScroll:true});}
    else if(!event.shiftKey&&active===last){event.preventDefault();first.focus({preventScroll:true});}
}

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
    const previousDrawerFocus=activeDrawer?.previouslyFocused;
    if (activeDrawer) closeDrawer(false);
    closePopover({ restoreFocus: true });

    const previouslyFocused = previousDrawerFocus && document.contains(previousDrawerFocus) ? previousDrawerFocus : document.activeElement;
    const root = document.createElement('div');
    root.tabIndex=-1;
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
    // Establish the closed geometry before starting the CSS transition.
    // A single rAF without this paint boundary can skip the entrance motion.
    void root.offsetWidth;
    void scrim.offsetWidth;

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
        trapDialogTab(root,e);
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
    const previousModalFocus=activeModal?.previouslyFocused;
    if (activeModal) closeModal();
    document.querySelectorAll('.vx-modal[aria-hidden=true],.vx-overlay.is-closing').forEach(surface=>surface.remove());
    closePopover({ restoreFocus: true });

    const previouslyFocused = previousModalFocus && document.contains(previousModalFocus) ? previousModalFocus : document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'vx-overlay';
    const root = document.createElement('div');
    root.className = `vx-modal${opts.size === 'large' ? ' vx-modal--large' : ''}`;
    root.tabIndex=-1;
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
    void root.offsetWidth;
    void overlay.offsetWidth;
    requestAnimationFrame(() => { if(activeModal?.root !== root)return;overlay.classList.add('is-open'); root.classList.add('is-open'); });

    registerSurface('modal');

    const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const trapFocus = e => trapDialogTab(root,e);
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
        root.tabIndex=-1;
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
        void root.offsetWidth;
        void overlay.offsetWidth;

        requestAnimationFrame(() => {
            if (!root.isConnected) return;
            overlay.classList.add('is-open');
            root.classList.add('is-open');
        });

        // Focus tuzağı + Escape / dış tıklama → false
        const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const trapFocus = e => trapDialogTab(root,e);
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
