// js/modules/dashboardLayout.js

/**
 * @fileoverview
 * Physics-like dashboard layout engine — vanilla JS, no dependencies.
 *
 * Each tab's .grid-layout becomes an absolutely-positioned canvas driven by a
 * layout model (x in 12 columns, w in columns, hPx measured from content):
 *
 *   - Drag (title-row handle): dragged card follows the pointer 1:1 (no
 *     transition), a dashed placeholder marks its packed slot, every other
 *     panel reflows live via Web Animations API spring keyframes and
 *     collision packing guarantees zero overlap.
 *   - Drop: panel snaps to the nearest valid slot (nearestValidY), layout
 *     auto-compacts.
 *   - Resize (bottom-right corner): width in columns, height in px; others
 *     reflow live; resized panels scroll their content.
 *   - Persistence: x/w/userH per tab in localStorage ('vertex-dash-layout'),
 *     restored on load. Heights are always re-measured so dynamic panels
 *     never clip.
 *   - Hidden tabs are skipped; their layout runs on first dock activation.
 *   - <768px: engine disengages, natural flow returns.
 *
 * All repositioning uses WAAPI (element.animate) instead of CSS transitions —
 * animations chain from the current mid-flight value and can never get stuck.
 * Visual design untouched; positioning only.
 */

import { showToast } from '../utils/ui.js';

const STORAGE_KEY = 'vertex-dash-layout-v2'; // v2: bozuk eski konumlar yok sayilir
const COLS = 12;
const GAP = 20;
const MIN_W = 3;
const MIN_H = 140;
const SPRING = 'cubic-bezier(.22, 1.32, .36, 1)';

const tabs = new Map();   // tabId -> { grid, items: [], colW }
let drag = null;
let resize = null;
let bound = false;
let ro = null;
let rafPending = false;
let pendingPointer = null;
let settleUntil = 0;

const enabled = () => window.innerWidth >= 768;
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } };
const persistData = (data) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* kota dolu */ } };
const xOverlap = (x1, w1, x2, w2) => x1 < x2 + w2 && x1 + w1 > x2;
const colWidth = (tab) => Math.max(40, (tab.grid.clientWidth - GAP * (COLS - 1)) / COLS);

function spanOf(el) {
    const m = /col-span-(\d+)/.exec(el.className);
    return m ? Math.max(MIN_W, Math.min(COLS, +m[1])) : COLS;
}

// --- Ölçüm / yerleşim çekirdeği ---

function measureHeights(tab) {
    tab.items.forEach(it => {
        if (it.userH) {
            it.hPx = it.userH;
            it.el.classList.add('dash-userh');
            it.el.style.height = it.userH + 'px';
        } else {
            it.el.classList.remove('dash-userh');
            it.el.style.height = '';
            const h = it.el.offsetHeight;
            if (h > 0 && h < 20000) it.hPx = h; // saglik siniri: olcusuz buyumeyi engelle
        }
    });
}

function computeLayout(tab, dragRect, dragKey) {
    measureHeights(tab);
    const others = tab.items
        .filter(it => it.key !== dragKey)
        .sort((a, b) => a.y - b.y || a.index - b.index);
    const rects = [];
    if (dragRect) rects.push({ ...dragRect, key: dragKey });
    for (const it of others) {
        const wPx = it.w * tab.colW + (it.w - 1) * GAP;
        const xPx = it.x * (tab.colW + GAP);
        const h = it.hPx + GAP;
        let y = 0;
        for (;;) {
            const hit = rects.find(r => xOverlap(xPx, wPx, r.x, r.w) && y < r.y + r.h && y + h > r.y);
            if (!hit) break;
            y = hit.y + hit.h;
        }
        it.y = y;
        rects.push({ x: xPx, w: wPx, y, h });
    }
    return Math.max(200, ...tab.items.map(it => it.y + it.hPx), 0);
}

/**
 * Bir paneli hedef konuma taşır. Değişiklik varsa WAAPI ile mevcut
 * (animasyon ortasındaki) değerden hedefe spring keyframes başlatır; inline
 * style hedefe yazılır — animasyon bitince zaten hedef geçerli olur.
 */
function applyItem(tab, it, animate = true) {
    const xPx = it.x * (tab.colW + GAP);
    const wPx = it.w * tab.colW + (it.w - 1) * GAP;
    const toT = `translate(${Math.round(xPx)}px, ${Math.round(it.y)}px)`;
    const toW = Math.round(wPx) + 'px';
    const toH = it.userH ? it.userH + 'px' : '';

    const cur = getComputedStyle(it.el);
    const fromT = cur.transform === 'none' ? 'translate(0px, 0px)' : cur.transform;
    const changed = it.el.style.transform !== toT || it.el.style.width !== toW ||
        (toH ? it.el.style.height !== toH : it.el.style.height !== '');
    void cur;

    it.el.style.width = toW;
    if (toH) it.el.style.height = toH; else it.el.style.height = '';
    it.el.style.transform = toT;

    it._anim?.cancel();
    it._anim = null;
    if (!animate || !changed) return;

    // Yalnizca transform animasyonu — width/height animasyonu ResizeObserver
    // ile geri besleme dongusu yaratir; boyutlar aninda uygulanir.
    it._anim = it.el.animate(
        [{ transform: fromT }, { transform: toT }],
        { duration: 380, easing: SPRING }
    );
}

function renderTab(tab, excludeKey, animate = true) {
    tab.items.forEach(it => {
        if (it.key === excludeKey) return;
        applyItem(tab, it, animate);
    });
    const maxBottom = Math.max(200, ...tab.items.map(it => it.y + it.hPx));
    tab.grid.style.height = Math.round(maxBottom) + 'px';
}

function layoutTab(tabId, animate = true) {
    const tab = tabs.get(tabId);
    if (!tab || !enabled()) return;
    if (!tab.grid.clientWidth) return; // gizli sekme — dock click'te yapılır
    tab.colW = colWidth(tab);
    // Kritik: eski inline grid yuksekligini temizle — aksi halde dogal akista
    // satirlar dev yuksekligi stretch'leyerek kartlari sisirir (olcum dongusu).
    tab.grid.style.height = '';
    measureHeights(tab);
    tab.grid.classList.add('dash-grid');
    computeLayout(tab, null, null);
    renderTab(tab, null, animate);
}

function scheduleLayout(tabId) {
    if (Date.now() < settleUntil) {
        // Settle penceresinde gelen olayları kaybetme — pencere bitince uygula.
        setTimeout(() => scheduleLayout(tabId), settleUntil - Date.now() + 60);
        return;
    }
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
        rafPending = false;
        layoutTab(tabId);
    });
}

// --- Sürükleme ---

function ensureHandle(el, tabId) {
    const row = el.querySelector('.card-title-row');
    if (!row) return;
    let handle = row.querySelector('.panel-drag-handle');
    if (!handle) {
        handle = document.createElement('span');
        handle.className = 'material-symbols-rounded panel-drag-handle';
        handle.textContent = 'drag_indicator';
        handle.title = __('perms.drag_hint');
        row.insertBefore(handle, row.querySelector('.panel-collapse-chevron'));
    }
    if (!handle.dataset.dashBound) {
        handle.dataset.dashBound = '1';
        handle.addEventListener('pointerdown', (e) => startDrag(e, el, tabId));
    }
}

function ensurePlaceholder(tab, item) {
    let ph = tab.grid.querySelector('.dash-placeholder');
    if (!ph) {
        ph = document.createElement('div');
        ph.className = 'dash-placeholder';
        tab.grid.appendChild(ph);
    }
    ph.style.width = (item.w * tab.colW + (item.w - 1) * GAP) + 'px';
    ph.style.height = item.hPx + 'px';
    ph.style.transform = `translate(${item.x * (tab.colW + GAP)}px, ${item.y}px)`;
}

function removePlaceholder() {
    document.querySelectorAll('.dash-placeholder').forEach(el => el.remove());
}

function startDrag(e, el, tabId) {
    if (!enabled() || drag || resize) return;
    const tab = tabs.get(tabId);
    if (!tab.grid.clientWidth) return;
    const item = tab.items.find(i => i.el === el);
    if (!item) return;
    e.preventDefault();
    tab.colW = colWidth(tab);
    const elRect = el.getBoundingClientRect();
    drag = { tabId, item, grabDX: e.clientX - elRect.left, grabDY: e.clientY - elRect.top };
    item.el.classList.add('dash-dragging');
    document.body.classList.add('dash-drag-active');
    ensurePlaceholder(tab, item);
}

function moveDrag() {
    const tab = tabs.get(drag.tabId);
    const item = drag.item;
    const { clientX, clientY } = pendingPointer;
    const gridRect = tab.grid.getBoundingClientRect();
    const px = clientX - gridRect.left - drag.grabDX;
    const py = clientY - gridRect.top - drag.grabDY;

    const wPx = item.w * tab.colW + (item.w - 1) * GAP;
    const maxPx = Math.max(0, tab.colW * COLS + GAP * (COLS - 1) - wPx);
    const pxV = Math.max(0, Math.min(maxPx, px));
    const pyV = Math.max(0, py);

    item.x = Math.max(0, Math.min(COLS - item.w, Math.round(pxV / (tab.colW + GAP))));
    item.y = pyV;

    // Sürüklenen panel 1:1 takip eder — animasyon yok.
    item.el.style.transform = `translate(${Math.round(pxV)}px, ${Math.round(pyV)}px)`;
    item.el.style.width = Math.round(wPx) + 'px';

    const maxBottom = computeLayout(tab, {
        x: item.x * (tab.colW + GAP),
        w: wPx,
        y: item.y,
        h: item.hPx + GAP
    }, item.key);
    renderTab(tab, item.key);      // diğerleri canlı + spring
    ensurePlaceholder(tab, item);
    tab.grid.style.height = Math.round(maxBottom) + 'px';
}

/** Bırakılan panel için, diğer panellere çakışmadan en yakın geçerli y. */
function nearestValidY(tab, item) {
    const myX = item.x * (tab.colW + GAP);
    const myW = item.w * tab.colW + (item.w - 1) * GAP;
    const myH = item.hPx + GAP;
    const rects = tab.items
        .filter(i => i !== item)
        .map(i => ({
            x: i.x * (tab.colW + GAP),
            w: i.w * tab.colW + (i.w - 1) * GAP,
            y: i.y,
            h: i.hPx + GAP
        }))
        .filter(r => xOverlap(myX, myW, r.x, r.w));
    const desired = Math.max(0, item.y);
    if (!rects.length) return desired;
    const candidates = [0, ...rects.map(r => r.y + r.h), desired];
    const valid = candidates.filter(c => !rects.some(r => c < r.y + r.h && c + myH > r.y));
    if (!valid.length) return desired;
    return valid.reduce((best, c) => Math.abs(c - desired) < Math.abs(best - desired) ? c : best, valid[0]);
}

function endDrag() {
    const { tabId, item } = drag;
    const tab = tabs.get(tabId);
    item.el.classList.remove('dash-dragging');
    removePlaceholder();
    document.body.classList.remove('dash-drag-active');
    item.y = nearestValidY(tab, item); // en yakın geçerli yuva
    persistTab(tabId);
    settleUntil = Date.now() + 450;    // tek yumuşak animasyon penceresi
    layoutTab(tabId, true);            // yumuşak snap
    // Pencere sonunda gerçek içerik yükseklikleriyle bir kez daha hizala.
    setTimeout(() => { if (!drag && !resize) scheduleLayout(tabId); }, 500);
    drag = null;
}

// --- Yeniden boyutlandırma ---

function ensureResizer(el, tabId) {
    if (el.querySelector('.panel-resize-handle')) return;
    const handle = document.createElement('span');
    handle.className = 'panel-resize-handle';
    handle.title = __('perms.resize_hint');
    el.appendChild(handle);
    handle.addEventListener('pointerdown', (e) => {
        if (!enabled() || drag || resize) return;
        const tab = tabs.get(tabId);
        if (!tab.grid.clientWidth) return;
        e.preventDefault();
        e.stopPropagation();
        tab.colW = colWidth(tab);
        const item = tab.items.find(i => i.el === el);
        resize = {
            tabId,
            item,
            startX: e.clientX,
            startY: e.clientY,
            startW: item.w,
            startH: item.userH || item.hPx
        };
        item.el.classList.add('dash-resizing');
        document.body.classList.add('dash-drag-active');
    });
}

function moveResize() {
    const tab = tabs.get(resize.tabId);
    const item = resize.item;
    const { clientX, clientY } = pendingPointer;
    item.w = Math.max(MIN_W, Math.min(COLS - item.x, resize.startW + Math.round((clientX - resize.startX) / (tab.colW + GAP))));
    item.userH = Math.max(MIN_H, Math.round(resize.startH + (clientY - resize.startY)));
    item.hPx = item.userH;
    renderTab(tab);
    const maxBottom = Math.max(200, ...tab.items.map(it => it.y + it.hPx));
    tab.grid.style.height = Math.round(maxBottom) + 'px';
}

function endResize() {
    const { tabId } = resize;
    tabs.get(tabId).items.forEach(it => it.el.classList.remove('dash-resizing'));
    document.body.classList.remove('dash-drag-active');
    persistTab(tabId);
    settleUntil = Date.now() + 450;
    layoutTab(tabId, true);
    setTimeout(() => { if (!drag && !resize) scheduleLayout(tabId); }, 500);
    resize = null;
}

// --- Kalıcılık ---

function persistTab(tabId) {
    const tab = tabs.get(tabId);
    if (!tab) return;
    const data = loadSaved();
    const entry = {};
    tab.items.forEach(it => {
        entry[it.key] = { x: it.x, w: it.w, ...(it.userH ? { userH: it.userH } : {}) };
    });
    data[tabId] = entry;
    persistData(data);
}

export function resetTabLayout(tabId) {
    const data = loadSaved();
    delete data[tabId];
    persistData(data);
    const tab = tabs.get(tabId);
    if (!tab) return;
    tab.items.forEach((it, i) => {
        it.x = 0;
        it.w = spanOf(it.el);
        it.userH = 0;
        it.y = i * 10;
        it.index = i;
    });
    layoutTab(tabId, true);
    showToast(__('dept.saved'), 'success');
}

// --- Bağlama ---

function onPointerMove(e) {
    // Senkron işleme: en düşük gecikme (rAF arka plan sekmelerinde donar).
    if (drag) {
        pendingPointer = { clientX: e.clientX, clientY: e.clientY };
        moveDrag();
    } else if (resize) {
        pendingPointer = { clientX: e.clientX, clientY: e.clientY };
        moveResize();
    }
}

function onPointerUp() {
    if (drag) endDrag();
    else if (resize) endResize();
}

function deactivateAll() {
    tabs.forEach(tab => {
        tab.grid.classList.remove('dash-grid');
        tab.grid.style.height = '';
    });
}

export function initDashboardLayout() {
    if (bound) return;
    bound = true;

    document.querySelectorAll('.tab-panel .grid-layout').forEach(grid => {
        const tabId = grid.closest('.tab-panel')?.id.replace('tab-', '');
        if (!tabId) return;
        const cards = [...grid.querySelectorAll('[data-panel]')];
        if (!cards.length) return;
        const savedTab = loadSaved()[tabId] || {};
        // Kaydedilmemiş öğeler varsayılan masonry sırasına dizilir (8+4, 7+5, 6+6...)
        let cursorX = 0;
        const items = cards.map((el, i) => {
            const key = el.getAttribute('data-panel');
            const s = savedTab[key] || {};
            const w = s.w || spanOf(el);
            let x = 0;
            if (Number.isInteger(s.x)) {
                x = s.x;
            } else {
                x = cursorX;
                cursorX += w;
                if (cursorX + MIN_W > COLS) cursorX = 0;
            }
            return {
                key, el, index: i,
                x,
                w,
                userH: s.userH || 0,
                hPx: 0,
                y: i * 20
            };
        });
        tabs.set(tabId, { grid, tabId, items, colW: 0 });
        cards.forEach(el => {
            ensureHandle(el, tabId);
            ensureResizer(el, tabId);
        });
    });

    if (!ro) {
        ro = new ResizeObserver((entries) => {
            if (drag || resize) return;
            for (const entry of entries) {
                const el = entry.target;
                for (const [tabId, tab] of tabs) {
                    const item = tab.items.find(i => i.el === el);
                    if (item && !item.userH && el.offsetHeight > 0 && el.offsetHeight < 20000 && Math.abs(el.offsetHeight - item.hPx) > 2) {
                        item.hPx = el.offsetHeight;
                        scheduleLayout(tabId);
                    }
                }
            }
        });
    }
    tabs.forEach(tab => tab.items.forEach(it => ro.observe(it.el)));

    if (!document.body.dataset.dashBound) {
        document.body.dataset.dashBound = '1';
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        window.addEventListener('resize', () => {
            if (!enabled()) { deactivateAll(); return; }
            tabs.forEach((tab, id) => { if (tab.grid.clientWidth) layoutTab(id, false); });
        });
        document.querySelectorAll('.dock-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = (btn.dataset.target || '').replace('tab-', '');
                if (enabled()) layoutTab(id, false);
                setTimeout(() => { if (enabled()) layoutTab(id, false); }, 90);
            });
        });
    }

    // Görünür sekme(n)ler — doğal akıştan ölçerek yerleş
    tabs.forEach((tab, id) => { if (tab.grid.clientWidth) layoutTab(id, false); });
}
