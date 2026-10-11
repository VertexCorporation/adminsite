import { escapeHTML } from './ui.js';
import { icon } from './icons.js';
// js/utils/loading.js
//
// Merkezi yükleme sistemi: skeleton + shimmer + boş/hata durumları.
// Kurallar:
//  - 150ms'den kısa isteklerde skeleton gösterilmez (flashing önlenir).
//  - Veri gelince içerik ~180ms fade ile girer (bekletme yapılmaz).
//  - Konteyner doluysa (stale data) içerik boşaltılmaz; yalnızca
//    bağlamsal göstergeler (ör. refresh spinner) kullanılır.
//  - Skeleton konteynerleri aria-busy alır; ekran okuyucusuna gereksiz
//    tekrar duyuru gönderilmez.

const SKELETON_DELAY = 150;

/** Tek satır iskelet bloğu. */
export function skeletonText(widthClass = 'w-80') {
    return `<div class="skeleton sk-text ${widthClass}"></div>`;
}

export function skeletonAvatar() {
    return `<div class="skeleton sk-avatar"></div>`;
}

export function skeletonButton() {
    return `<div class="skeleton sk-button"></div>`;
}

/** Tablo satır iskeleti — gerçek satır geometrisi korunur. */
export function skeletonTableRow() {
    return `<div class="contributor-skeleton-row" aria-hidden="true"><div class="sk-contributor-name"><div class="skeleton sk-avatar"></div><div class="skeleton sk-text w-60"></div></div><div class="skeleton sk-text w-60"></div><div class="skeleton sk-text w-40"></div><div class="skeleton sk-text w-80"></div><div class="skeleton sk-text w-80"></div><div class="skeleton sk-button"></div></div>`;
}

export function skeletonListItem() {
    return `<div class="sk-list-item" aria-hidden="true">
        <div class="skeleton sk-avatar"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
            <div class="skeleton sk-text w-60"></div>
            <div class="skeleton sk-text w-40"></div>
        </div>
    </div>`;
}

export function skeletonCard() {
    return `<div class="sk-card" aria-hidden="true">
        <div class="skeleton sk-title"></div>
        <div class="skeleton sk-text w-80"></div>
        <div class="skeleton sk-text w-full"></div>
        <div class="skeleton sk-text w-60"></div>
    </div>`;
}

export function skeletonFormField() {
    return `<div class="sk-field" aria-hidden="true">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
    </div>`;
}

export function skeletonCertificate() {
    return `<div class="sk-cert-row" aria-hidden="true">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton" style="width:44px;height:12px;"></div>
    </div>`;
}

export function skeletonChatMessage() {
    return `<div class="sk-chat-msg" aria-hidden="true">
        <div class="skeleton"></div>
        <div class="skeleton" style="width:85%"></div>
        <div class="skeleton" style="width:60%"></div>
    </div>`;
}

/** N adet satır iskeleti üretir. */
export function skeletonRows(count = 6, rowFactory = skeletonTableRow) {
    let html = '';
    for (let i = 0; i < count; i++) html += rowFactory();
    return html;
}


/**
 * Yükleme durum makinesi.
 * @param {HTMLElement} container İçeriğin basılacağı eleman.
 * @param {object} opts { skeletonHTML, onSkeleton }
 */
export function createLoadingController(container, opts = {}) {
    let timer = null;
    let skeletonShown = false;

    function start() {
        if (!container || timer) return;
        // Konteynerde canlı veri varsa: stale data gösterilmeye devam eder,
        // tam sayfa iskelet basılmaz.
        const hasContent = container.children.length > 0 &&
            !container.querySelector('.skeleton') &&
            !container.querySelector('.state-block');
        container.setAttribute('aria-busy','true');
        if (hasContent) return;
        timer = setTimeout(() => {
            timer = null;
            skeletonShown = true;
            container.setAttribute('aria-busy', 'true');
            container.innerHTML = opts.skeletonHTML || skeletonRows(6);
            opts.onSkeleton?.();
        }, opts.skeletonDelay ?? SKELETON_DELAY);
    }

    function cancelTimer() {
        if (timer) { clearTimeout(timer); timer = null; }
    }

    /** Veri geldi: iskeleti kaldır, içeriği fade ile bas. */
    function success(renderHTML) {
        cancelTimer();
        const wasSkeleton = skeletonShown || !!container.querySelector('.skeleton');
        skeletonShown = false;
        container.removeAttribute('aria-busy');
        container.innerHTML = renderHTML;
        if (wasSkeleton) {
            container.classList.add('content-fade-in');
            requestAnimationFrame(() => setTimeout(() => container.classList.remove('content-fade-in'), 200));
        }
    }

    /** Hata durumu: açıklayıcı mesaj + Retry. */
    function error(message, retryFn, retryLabel = 'Retry') {
        cancelTimer();
        skeletonShown = false;
        container.removeAttribute('aria-busy');
        container.innerHTML = `<div class="state-block">
            ${icon('alert-circle',{size:28})}
            <h4>${escapeHTML(message)}</h4>
            ${retryFn ? `<button type="button" class="chrome-btn-outline retry-btn">${retryLabel}</button>` : ''}
        </div>`;
        container.querySelector('.retry-btn')?.addEventListener('click', retryFn);
    }

    /** Boş durum: iskelet gösterilmez, gerçek empty state basılır. */
    function empty(title, description = '') {
        cancelTimer();
        skeletonShown = false;
        container.removeAttribute('aria-busy');
        container.innerHTML = `<div class="state-block">
            ${icon('users-group',{size:28})}
            <h4>${escapeHTML(title)}</h4>
            ${description ? `<p>${escapeHTML(description)}</p>` : ''}
        </div>`;
    }

    function destroy() {
        cancelTimer();
        skeletonShown = false;
        container?.removeAttribute('aria-busy');
    }

    return { start, success, error, empty, destroy };
}

/** Butonu işlem sırasında spinner'lı disabled durumuna alır. */
export function setButtonLoading(btn, loading, loadingLabel = null) {
    if (!btn) return;
    if (loading) {
        btn.dataset.originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${loadingLabel ? `<span>${loadingLabel}</span>` : ''}`;
    } else {
        btn.disabled = false;
        if (btn.dataset.originalHTML) btn.innerHTML = btn.dataset.originalHTML;
        delete btn.dataset.originalHTML;
    }
}

/** İstek sırası damgası: stale response koruması. */
export function createRequestGuard() {
    let latest = 0;
    return {
        begin() { return ++latest; },
        isCurrent(token) { return token === latest; }
    };
}

export function beginPanelLoading(container, rowFactory = skeletonListItem) {
    if (!container) return () => {};
    container.setAttribute('aria-busy','true');
    const current = container.innerHTML;
    const stale = container.children.length && !container.querySelector('.form-hint,.state-block,.skeleton');
    let shown=false;
    const timer=setTimeout(()=>{if(!stale){shown=true;container.innerHTML=skeletonRows(5,rowFactory);}},150);
    return () => {clearTimeout(timer);container.removeAttribute('aria-busy');if(shown){if(container.querySelector('.skeleton'))container.innerHTML=current;container.classList.add('content-fade-in');setTimeout(()=>container.classList.remove('content-fade-in'),200);}};
}
