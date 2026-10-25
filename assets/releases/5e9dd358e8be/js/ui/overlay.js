// Overlay scroll coordinator. Preserves pre-existing inline styles and
// prevents a closing modal from unlocking an active drawer underneath it.
const locks = new Set();
let original = null;
export function lockScroll(owner) {
    if (locks.has(owner)) return;
    if (locks.size === 0) {
        original = {
            overflow: document.body.style.overflow,
            overscroll: document.body.style.overscrollBehavior
        };
    }
    locks.add(owner);
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
}
export function unlockScroll(owner) {
    if (!locks.delete(owner)) return;
    if (locks.size === 0 && original) {
        document.body.style.overflow = original.overflow;
        document.body.style.overscrollBehavior = original.overscroll;
        original = null;
    }
}
