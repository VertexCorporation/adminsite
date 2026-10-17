import { reducedMotion } from './motion.js';

// Opt-in true crossfade. Live form controls are never cloned into the active tree;
// the outgoing inert image is visual-only and is removed after animation settles.
const running = new WeakMap();
export function crossfade(container, mutate, { duration = 190 } = {}) {
    running.get(container)?.();
    const focus = document.activeElement;
    const activeField = focus && container.contains(focus) &&
        focus.matches?.('input,textarea,select,[contenteditable],button');
    const oldChildren = [...container.childNodes];
    const animate = !reducedMotion() && !activeField && container.isConnected &&
        oldChildren.length > 0 && container.getBoundingClientRect().height > 0 &&
        container.querySelectorAll('*').length < 140;
    if (!animate) { mutate(); return; }

    const rect = container.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'ui-crossfade-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    for (const child of oldChildren) ghost.appendChild(child.cloneNode(true));
    ghost.querySelectorAll('[id],[name]').forEach(node => {
        node.removeAttribute('id'); node.removeAttribute('name');
    });

    const originalPosition = container.style.position;
    const originalHeight = container.style.minHeight;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    mutate();
    container.style.minHeight = Math.max(rect.height, container.getBoundingClientRect().height) + 'px';
    ghost.style.width = '100%';
    container.appendChild(ghost);
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
