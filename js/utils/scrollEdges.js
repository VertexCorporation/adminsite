// Only internal scroll regions receive edge fades; never mask the page viewport.
export function initScrollEdges() {
    const tracked = new Set();
    const paint = el => {
        if (!el.isConnected) { resize.unobserve(el);tracked.delete(el);return; }
        const overflow = el.scrollHeight > el.clientHeight + 2;
        el.classList.toggle('scroll-fog', overflow);
        el.dataset.fogTop = String(overflow && el.scrollTop > 2);
        el.dataset.fogBottom = String(overflow && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    };
    const resize = new ResizeObserver(entries => entries.forEach(({target}) => paint(target)));
    let frame;
    const scan = () => {
        frame = null;
        document.querySelectorAll('.vx-drawer-body,.certificate-person-list,.scrollable-list-box,#admin-list-container,.models-list').forEach(el => {
            if (!tracked.has(el)) {tracked.add(el);resize.observe(el);el.addEventListener('scroll',()=>paint(el),{passive:true});}
            paint(el);
        });
        tracked.forEach(el=>{if(!el.isConnected){resize.unobserve(el);tracked.delete(el);}});
    };
    new MutationObserver(()=>{if(!frame)frame=requestAnimationFrame(scan);}).observe(document.body,{childList:true,subtree:true});
    scan();
}
