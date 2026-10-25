// Shared asynchronous action state without rewriting a button's icon or label.
const tracked = new WeakMap();
const allowed = new Set(['idle','loading','success','error']);
export function setButtonState(button, state, { resetAfter = 0 } = {}) {
    if (!button || !allowed.has(state)) return;
    const previous = tracked.get(button);
    if (previous?.timer) clearTimeout(previous.timer);
    const snapshot = previous || {
        disabled: button.disabled,
        minWidth: button.style.minWidth
    };
    if (state === 'idle') {
        if (!previous) return;
        button.disabled = snapshot.disabled;
        button.style.minWidth = snapshot.minWidth;
        button.removeAttribute('aria-busy');
        button.classList.remove('button-pending');
        button.removeAttribute('data-state');
        tracked.delete(button);
        return;
    }
    if (!previous) {
        button.style.minWidth = Math.ceil(button.getBoundingClientRect().width) + 'px';
    }
    const pending = state === 'loading';
    button.dataset.state = state;
    button.disabled = pending ? true : snapshot.disabled;
    button.classList.toggle('button-pending', pending);
    if (pending) button.setAttribute('aria-busy','true');
    else button.removeAttribute('aria-busy');
    if (resetAfter > 0 && !pending) {
        snapshot.timer = setTimeout(() => setButtonState(button,'idle'), resetAfter);
    }
    tracked.set(button,snapshot);
}
export function isButtonPending(button) {
    return button?.dataset.state === 'loading';
}
