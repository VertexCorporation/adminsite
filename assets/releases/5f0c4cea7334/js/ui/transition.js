import { reducedMotion } from './motion.js';

// Opt-in true crossfade. Live form controls are never cloned into the active tree;
// the outgoing inert image is visual-only and is removed after animation settles.
const running = new WeakMap();

// Generic lists can contain hundreds of nested elements. Keep the outgoing
// visual snapshot bounded while the new live content always fades in.
function boundedClone(node, budget) {
    if (node.nodeType !== 1) return node.cloneNode(true);
    if (budget.remaining <= 0) return null;
    budget.remaining--;
    const copy = node.cloneNode(false);
    for (const child of node.childNodes) {
        if (budget.remaining <= 0) break;
        const clone = boundedClone(child, budget);
        if (clone) copy.appendChild(clone);
    }
    return copy;
}
export function crossfade(container, mutate, { duration = 190 } = {}) {
    running.get(container)?.();
    const focus = document.activeElement;
    const activeField = focus && container.contains(focus) &&
        focus.matches?.('input,textarea,select,[contenteditable],button');
    const oldChildren = [...container.childNodes];
    // A contributor row has many descendant nodes. The former global 140-node
    // cutoff silently disabled transitions as soon as the applicant list grew.
    // Snapshot only visible rows, never hundreds of buttons; apply the same
    // path to small filtered lists that contain complex SVG action icons.
    const rows = container.querySelector('.contributor-table-rows');
    const denseList = !!rows && rows.children.length > 0;
    const largeList = !denseList && container.querySelectorAll('*').length >= 140;
    const animate = !reducedMotion() && !activeField && container.isConnected &&
        oldChildren.length > 0 && container.getBoundingClientRect().height > 0;
    if (!animate) { mutate(); return; }

    const rect = container.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'ui-crossfade-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    let savedScroll = null;
    const budget = {remaining:160};
    for (const child of oldChildren) {
        if (denseList && child === rows) {
            const snapshot = rows.cloneNode(false);
            const rowHeight = Math.max(1, rows.firstElementChild?.getBoundingClientRect().height || 52);
            const visible = Math.min(28, Math.max(14,
                Math.ceil(Math.min(rows.clientHeight || window.innerHeight, window.innerHeight) / rowHeight) + 4));
            const start = Math.max(0, Math.min(rows.children.length - visible,
                Math.floor(rows.scrollTop / rowHeight) - 2));
            if (start) {
                const spacer = document.createElement('div');
                const first = rows.children[start];
                const offset = first.getBoundingClientRect().top -
                    rows.getBoundingClientRect().top + rows.scrollTop;
                spacer.style.height = Math.max(0, offset) + 'px';
                spacer.setAttribute('aria-hidden', 'true');
                snapshot.appendChild(spacer);
            }
            for (let i = start; i < Math.min(rows.children.length, start + visible); i++)
                snapshot.appendChild(rows.children[i].cloneNode(true));
            ghost.appendChild(snapshot);
            savedScroll = {snapshot, top:rows.scrollTop, left:rows.scrollLeft};
        } else {
            const snapshot = largeList ? boundedClone(child, budget) : child.cloneNode(true);
            if (snapshot) ghost.appendChild(snapshot);
        }
    }
    ghost.querySelectorAll('[id],[name]').forEach(node => {
        node.removeAttribute('id'); node.removeAttribute('name');
    });

    const originalPosition = container.style.position;
    const originalHeight = container.style.minHeight;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    mutate();
    // Avoid a huge empty region on mobile when 100 rows become a short result.
    const newHeight = container.getBoundingClientRect().height;
    container.style.minHeight = (denseList || largeList
        ? Math.min(rect.height, Math.max(newHeight, 160))
        : Math.max(rect.height, newHeight)) + 'px';
    ghost.style.width = '100%';
    container.appendChild(ghost);
    if (savedScroll) {
        savedScroll.snapshot.scrollTop = savedScroll.top;
        savedScroll.snapshot.scrollLeft = savedScroll.left;
    }
    const options = { duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' };
    const outgoing = ghost.animate([{ opacity: 1 }, { opacity: 0 }], options);
    const incoming = [...container.children].filter(node => node !== ghost).slice(0, 35)
        .map(node => node.animate([{ opacity: 0 }, { opacity: 1 }], options));
    let finished = false;
    const cleanup = () => {
        if (finished) return;
        finished = true;
        ghost.remove();
        container.style.position = originalPosition;
        container.style.minHeight = originalHeight;
        if (running.get(container) === cancel) running.delete(container);
    };
    const cancel = () => { outgoing.cancel(); incoming.forEach(anim => anim.cancel()); cleanup(); };
    running.set(container, cancel);
    Promise.allSettled([outgoing.finished,...incoming.map(anim => anim.finished)]).then(cleanup);
}


// For navigation panels, keep the *real* DOM and its focus/listeners intact.
// Crossfade is reserved for replaced content; navigation uses a cheap native
// opacity entrance after the old panel becomes hidden.
const viewAnimations = new WeakMap();
export function animateViewEntry(view) {
    if (!view?.isConnected || reducedMotion()) return;
    viewAnimations.get(view)?.cancel();
    view.classList.add('ui-tab-entering');
    const animation = view.animate(
        [{opacity:0.35, transform:'translateY(4px)'},{opacity:1, transform:'translateY(0)'}],
        {duration:190, easing:'cubic-bezier(.2,.8,.2,1)'}
    );
    viewAnimations.set(view, animation);
    animation.finished.catch(()=>{}).finally(()=>{
        if (viewAnimations.get(view)===animation) {
            viewAnimations.delete(view);
            view.classList.remove('ui-tab-entering');
        }
    });
}

export function animateContent(container) {
    if (!container?.isConnected || reducedMotion()) return;
    // Animate a host rather than cloning controls or rewriting their values.
    container.animate([{opacity:0.55},{opacity:1}], {
        duration:180, easing:'cubic-bezier(.2,.8,.2,1)'
    });
}
