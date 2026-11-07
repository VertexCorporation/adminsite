import { __, getLang } from '../utils/ui.js';

// One gesture and request lifecycle for every refreshable surface. The owning
// module still owns authorization, fetching, stale-response guards and rendering.
const surfaces = new WeakMap();
const threshold = 96;
const interactive = 'button,a,input,textarea,select,[contenteditable="true"],[role="slider"]';
function atTop(target, host) {
    for (let node = target; node && host.contains(node); node = node.parentElement) {
        if (node.scrollHeight > node.clientHeight + 1 && node.scrollTop > 1) return false;
        if (node === host) break;
    }
    return true;
}
export function registerListRefresh(host, refresh, { button = null } = {}) {
    if (!host) return;
    if (button) { button.hidden = true; button.dataset.refreshControl = ''; }
    if (surfaces.has(host)) { surfaces.get(host).refresh = refresh; return; }
    const entry = { refresh, pending: false, gesture: null, suppressClickUntil:0 };
    surfaces.set(host, entry);
    host.dataset.refreshSurface = '';
    if (!host.hasAttribute('tabindex')) host.tabIndex = 0;
    host.setAttribute('aria-keyshortcuts', 'Alt+R');
    const label = () => getLang() === 'tr'
        ? 'Yenilemek için aşağı çekin veya Alt+R tuşlarına basın.'
        : 'Pull down to refresh, or press Alt+R.';
    host.addEventListener('focus', () => host.setAttribute('aria-description', label()));
    const reset = () => {
        entry.gesture = null;
        host.classList.remove('is-pulling');
        host.style.removeProperty('--pull-progress');
    };
    const run = async () => {
        if (entry.pending || host.getAttribute('aria-busy') === 'true' ||
            !host.isConnected || !host.getClientRects().length || host.closest('[inert]')) { reset(); return; }
        entry.pending = true;
        reset();
        host.classList.add('is-refreshing');
        host.setAttribute('aria-busy', 'true');
        try { await entry.refresh(); }
        finally {
            entry.pending = false;
            host.classList.remove('is-refreshing');
            host.removeAttribute('aria-busy');
        }
    };
    const begin = (target, x, y, id) => {
        if (entry.pending || host.getAttribute('aria-busy') === 'true' ||
            target.closest(interactive) || !atTop(target, host)) return;
        entry.gesture = { x, y, id, progress: 0, locked: false };
    };
    const move = (event, x, y) => {
        const gesture = entry.gesture;
        if (!gesture) return;
        const dx = x - gesture.x, dy = y - gesture.y;
        if (!gesture.locked) {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { reset(); return; }
            if (dy < -8) { reset(); return; }
            if (dy < 8) return;
            gesture.locked = true;
        }
        if (event.cancelable) event.preventDefault();
        gesture.progress = Math.min(1, Math.max(0, dy / threshold));
        host.classList.add('is-pulling');
        host.style.setProperty('--pull-progress', String(gesture.progress));
    };
    const end = () => {
        const ready = entry.gesture?.progress >= 1;
        if(entry.gesture?.locked)entry.suppressClickUntil=Date.now()+400;
        reset();
        if (ready) void run().catch(() => {}); // Owners render their own retry/error state.
    };
    // Touch uses a non-passive move only after a vertical pull is recognized;
    // horizontal tables/filter chips and normal upward scrolling stay native.
    host.addEventListener('touchstart', event => {
        if (event.touches.length !== 1) { reset(); return; }
        const point = event.touches[0]; begin(event.target, point.clientX, point.clientY, point.identifier);
    }, { passive: true });
    host.addEventListener('touchmove', event => {
        if (event.touches.length !== 1) { reset(); return; }
        const point = event.touches[0]; move(event, point.clientX, point.clientY);
    }, { passive: false });
    host.addEventListener('touchend', end);
    host.addEventListener('touchcancel', reset);
    host.addEventListener('pointerdown', event => {
        if (event.pointerType === 'touch' || event.button !== 0) return;
        begin(event.target, event.clientX, event.clientY, event.pointerId);

    });
    host.addEventListener('pointermove', event => {
        if (event.pointerType !== 'touch' && entry.gesture?.id === event.pointerId)
            {move(event, event.clientX, event.clientY);if(entry.gesture?.locked)host.setPointerCapture(event.pointerId);}
    });
    host.addEventListener('pointerup', event => { if (event.pointerType !== 'touch') end(); });
    host.addEventListener('pointercancel', reset);
    host.addEventListener('click',event=>{if(Date.now()<entry.suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
    host.addEventListener('keydown', event => {
        if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'r') {
            event.preventDefault(); void run().catch(() => {});
        }
    });
}
