// One registry for scroll-edge fades. Explicit hooks stay supported, but any
// qualifying internal scroller can opt in automatically as modules evolve.
const SELECTOR = [
    '[data-scroll-fog]',
    '.contributor-table-rows', '.vx-drawer-body', '.vx-modal-body',
    '.vx-popover-body.is-scrollable', '.cert-popover .vx-popover-body',
    '.translation-modal-body', '.certificate-person-list',
    '.scrollable-list-box', '.scrollable-list-box-small',
    '#admin-list-container', '.models-list', '.chat-messages',
    '.sidebar-scroll', '.dept-perms-table', '.permission-panel-nav',
    '.people-table-wrap', '.scroll-chips-row', '.toolbar-chips',
    '#tab-contributors .filter-chips'
].join(',');
// Look for overflow-capable regions, then inspect computed overflow. Do not
// observe every row of a potentially enormous list just because it exists.
const DISCOVER = [
    '[style*="overflow"]', '[role="listbox"]',
    '.app-main [class*="scroll"]', '.app-main [class*="list"]',
    '.app-main [class*="table"]', '.app-main [class*="wrap"]',
    '.app-sidebar [class*="scroll"]',
    '.vx-drawer [class*="scroll"]', '.vx-drawer [class*="body"]',
    '.vx-modal [class*="scroll"]', '.vx-modal [class*="body"]',
    '.vx-popover [class*="scroll"]', '.vx-popover [class*="body"]'
].join(',');
const EXCLUDE = '.contributor-table-head, .app-main, .tab-panel, html, body';
const scrollable = value => /auto|scroll|overlay/.test(value);

export function initScrollEdges() {
    const tracked = new Map();
    const paint = element => {
        if (!element.isConnected || element.matches(EXCLUDE)) return;
        const style = getComputedStyle(element);
        const visible = element.getClientRects().length > 0 && element.clientWidth > 0 && element.clientHeight > 0;
        const x = visible && scrollable(style.overflowX) && element.scrollWidth > element.clientWidth + 2;
        const y = visible && scrollable(style.overflowY) && element.scrollHeight > element.clientHeight + 2;
        const maxX = Math.max(0, element.scrollWidth - element.clientWidth);
        // Chromium/Firefox use negative scrollLeft for RTL; the positive form
        // used by older engines is handled too.
        const physicalLeft = style.direction === 'rtl'
            ? (element.scrollLeft <= 0 ? maxX + element.scrollLeft : maxX - element.scrollLeft)
            : element.scrollLeft;
        const left = x && physicalLeft > 2;
        const right = x && physicalLeft < maxX - 2;
        const top = y && element.scrollTop > 2;
        const bottom = y && element.scrollTop + element.clientHeight < element.scrollHeight - 2;
        element.classList.toggle('scroll-fog-x', !!x);
        element.classList.toggle('scroll-fog', !!y);
        element.dataset.fogLeft = String(!!left);
        element.dataset.fogRight = String(!!right);
        element.dataset.fogTop = String(!!top);
        element.dataset.fogBottom = String(!!bottom);
    };
    const resize = new ResizeObserver(entries => entries.forEach(({target}) => paint(target)));
    let frame = null;
    const scan = () => {
        frame = null;
        const candidates = document.querySelectorAll(SELECTOR + ',' + DISCOVER);
        for (const element of candidates) {
            if (element.matches(EXCLUDE)) continue;
            const style = getComputedStyle(element);
            if (!element.hasAttribute('data-scroll-fog') &&
                !scrollable(style.overflowX) && !scrollable(style.overflowY)) continue;
            if (!tracked.has(element)) {
                const handler = () => paint(element);
                tracked.set(element, handler);
                element.addEventListener('scroll', handler, {passive:true});
                resize.observe(element);
            }
            paint(element);
        }
        for (const [element, handler] of tracked) {
            if (element.isConnected) continue;
            element.removeEventListener('scroll', handler);
            resize.unobserve(element);
            tracked.delete(element);
        }
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(scan); };
    // Changes in hidden state, overflow classes and dynamic list contents must
    // update fades without manually registering every new module.
    const observer = new MutationObserver(records => {
        if (records.some(record => record.type === 'childList' ||
            ['class','style','hidden'].includes(record.attributeName))) schedule();
    });
    observer.observe(document.body, {
        childList:true, subtree:true, attributes:true,
        attributeFilter:['class','style','hidden']
    });
    window.addEventListener('resize', schedule, {passive:true});
    document.addEventListener('vertex:workspace', schedule);
    document.addEventListener('vertex:theme', schedule);
    scan();
}
