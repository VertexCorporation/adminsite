// Shared observer for internal vertical and horizontal scrollers.
// Never apply a mask to the page viewport or the document root.
const SELECTOR = [
    '[data-scroll-fog]', '.contributor-table-rows', '.vx-drawer-body',
    '.vx-popover-body.is-scrollable', '.translation-modal-body',
    '.certificate-person-list', '.scrollable-list-box',
    '#admin-list-container', '.models-list',
    '.scroll-chips-row', '.toolbar-chips', '#tab-contributors .filter-chips'
].join(',');

export function initScrollEdges() {
    const tracked = new Map();
    const paint = element => {
        if (!element.isConnected) return;
        const x = element.scrollWidth > element.clientWidth + 2;
        const y = element.scrollHeight > element.clientHeight + 2 &&
            !element.querySelector('.contributor-table-head');
        const horizontal = x && (!y || element.matches('.scroll-chips-row,.toolbar-chips,#tab-contributors .filter-chips'));
        element.classList.toggle('scroll-fog-x', horizontal);
        element.classList.toggle('scroll-fog', y && !horizontal);
        element.dataset.fogTop = String(y && !horizontal && element.scrollTop > 2);
        element.dataset.fogBottom = String(y && !horizontal && element.scrollTop + element.clientHeight < element.scrollHeight - 2);
        element.dataset.fogLeft = String(horizontal && element.scrollLeft > 2);
        element.dataset.fogRight = String(horizontal && element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
    };
    const resize = new ResizeObserver(entries => entries.forEach(({target}) => paint(target)));
    let frame = 0;
    const scan = () => {
        frame = 0;
        document.querySelectorAll(SELECTOR).forEach(element => {
            if (!tracked.has(element)) {
                const listener = () => paint(element);
                tracked.set(element, listener);
                element.addEventListener('scroll', listener, { passive: true });
                resize.observe(element);
            }
            paint(element);
        });
        for (const [element, listener] of tracked) {
            if (element.isConnected) continue;
            element.removeEventListener('scroll', listener);
            resize.unobserve(element);
            tracked.delete(element);
        }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(scan); };
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    scan();
}
