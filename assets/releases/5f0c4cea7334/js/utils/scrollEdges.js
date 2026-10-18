// Central scroll-edge registry. Observe internal scrollers on both axes, never
// the viewport, login form, or virtualized contributor header.
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
const EXCLUDE = '.contributor-table-head, .app-main, .tab-panel, html, body';

export function initScrollEdges() {
    const tracked = new Map();
    const paint = element => {
        if (!element.isConnected || element.matches(EXCLUDE)) return;
        const style = getComputedStyle(element);
        const x = /auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 2;
        const y = /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2;
        const left = x && element.scrollLeft > 2;
        const right = x && element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
        const top = y && element.scrollTop > 2;
        const bottom = y && element.scrollTop + element.clientHeight < element.scrollHeight - 2;
        element.classList.toggle('scroll-fog-x', x);
        element.classList.toggle('scroll-fog', y);
        element.dataset.fogLeft = String(left);
        element.dataset.fogRight = String(right);
        element.dataset.fogTop = String(top);
        element.dataset.fogBottom = String(bottom);
    };
    const resize = new ResizeObserver(entries => entries.forEach(({target})=>paint(target)));
    let frame = null;
    const scan = () => {
        frame = null;
        document.querySelectorAll(SELECTOR).forEach(element => {
            if (element.matches(EXCLUDE)) return;
            if (!tracked.has(element)) {
                const handler = () => paint(element);
                tracked.set(element, handler);
                element.addEventListener('scroll', handler, {passive:true});
                resize.observe(element);
            }
            paint(element);
        });
        for (const [element, handler] of tracked) {
            if (element.isConnected) continue;
            element.removeEventListener('scroll', handler);
            resize.unobserve(element);
            tracked.delete(element);
        }
    };
    const schedule = () => {if(frame===null) frame=requestAnimationFrame(scan);};
    const observer = new MutationObserver(records => {
        if (records.some(record => record.type === 'childList')) schedule();
    });
    observer.observe(document.body, {childList:true, subtree:true});
    window.addEventListener('resize', schedule, {passive:true});
    document.addEventListener('vertex:workspace', schedule);
    document.addEventListener('vertex:theme', schedule);
    scan();
}
