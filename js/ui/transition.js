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
export function crossfade(container, mutate, { duration = 190, preserveHeight = true, mode = 'crossfade' } = {}) {
    running.get(container)?.();
    // Applicant filtering is an update, not a navigation: never leave the
    // outgoing list rendered over the new list.  An incoming-only opacity
    // animation preserves the table geometry and does not clone form controls.
    if (mode === 'enter') {
        const oldRows = container.querySelector(':scope > .contributor-table-rows');
        const scrollTop = oldRows?.scrollTop || 0;
        const scrollLeft = oldRows?.scrollLeft || 0;
        const hadContent = container.childElementCount > 0;
        mutate();
        const rows = container.querySelector(':scope > .contributor-table-rows');
        if (rows) {
            rows.scrollTop = Math.min(scrollTop, Math.max(0, rows.scrollHeight - rows.clientHeight));
            rows.scrollLeft = scrollLeft;
        }
        if (!hadContent || !rows || !rows.isConnected || reducedMotion() ||
            rows.getBoundingClientRect().height === 0) return;
        const animation = rows.animate([{opacity:.82},{opacity:1}],
            {duration:140,easing:'cubic-bezier(.2,.8,.2,1)'});
        let finished = false;
        const cancel = () => {
            if (finished) return;
            finished = true;
            animation.cancel();
            if (running.get(container) === cancel) running.delete(container);
        };
        running.set(container, cancel);
        animation.finished.catch(()=>{}).finally(cancel);
        return;
    }
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
    const containerStyle = getComputedStyle(container);
    // Workspace outgoing cards retain their grid geometry rather than stacking.
    if (containerStyle.display === 'grid') {
        ghost.style.display = 'grid';
        ghost.style.gridTemplateColumns = containerStyle.gridTemplateColumns;
        ghost.style.gap = containerStyle.gap;
        ghost.style.alignItems = containerStyle.alignItems;
    }
    for (const child of oldChildren) {
        if (child.nodeType === 1 &&
            (child.hidden || getComputedStyle(child).display === 'none')) continue;
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
    // For live applicant filters, reserve no outgoing height: keeping the
    // old 420px list then releasing it at animation end caused a jump.
    if (preserveHeight) {
        container.style.minHeight = (denseList || largeList
            ? Math.min(rect.height, Math.max(newHeight, 160))
            : Math.max(rect.height, newHeight)) + 'px';
    } else {
        ghost.style.maxHeight = Math.max(0, newHeight) + 'px';
    }
    ghost.style.width = '100%';
    container.appendChild(ghost);
    if (savedScroll) {
        savedScroll.snapshot.scrollTop = savedScroll.top;
        savedScroll.snapshot.scrollLeft = savedScroll.left;
        const newRows = container.querySelector(':scope > .contributor-table-rows');
        if (newRows) {
            newRows.scrollTop = Math.min(savedScroll.top, Math.max(0, newRows.scrollHeight - newRows.clientHeight));
            newRows.scrollLeft = savedScroll.left;
        }
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



// Never display a snapshot of the previously selected page. The old
// crossfade ghost was layered above the destination and looked like extra
// screens being visited, particularly during rapid navigation.
const viewSwitches = new WeakMap();
export function animateViewSwitch(from, to, mutate, {duration = 135} = {}) {
    const host = to?.parentElement;
    // Cancel *before* mutating, including rapid/reduced-motion transitions.
    if (host) viewSwitches.get(host)?.();
    const hadFocus = !!from?.contains(document.activeElement);
    if (to) to.classList.add('ui-tab-entering');
    mutate(); // exactly one active tab in the live DOM, immediately
    if (hadFocus && to && !to.contains(document.activeElement)) {
        if (!to.hasAttribute('tabindex')) to.tabIndex = -1;
        to.focus({preventScroll:true});
    }
    if (!host || !to?.isConnected || reducedMotion()) {
        to?.classList.remove('ui-tab-entering');
        return;
    }
    // A perceptible but stable screen transition: animate the incoming live
    // panel only, never an inert screenshot hiding the actual destination.
    const animation = to.animate([
        {opacity:.72,transform:'translateY(7px)'},
        {opacity:1,transform:'translateY(0)'}
    ],{duration:Math.max(duration,220),easing:'cubic-bezier(.2,.8,.2,1)'});
    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        animation.cancel();
        to.classList.remove('ui-tab-entering');
        if (viewSwitches.get(host) === cleanup) viewSwitches.delete(host);
    };
    viewSwitches.set(host, cleanup);
    animation.finished.catch(()=>{}).finally(cleanup);
}

// Entrance from a state with no previously visible panel is equally free of
// translation, so a page cannot jump while its data is hydrating.
const viewAnimations = new WeakMap();
export function animateViewEntry(view) {
    if (!view?.isConnected || reducedMotion()) return;
    viewAnimations.get(view)?.cancel();
    view.classList.add('ui-tab-entering');
    const animation = view.animate([
        {opacity:.72,transform:'translateY(7px)'},
        {opacity:1,transform:'translateY(0)'}
    ],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
    viewAnimations.set(view,animation);
    animation.finished.catch(()=>{}).finally(()=>{
        if (viewAnimations.get(view) === animation) {
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
