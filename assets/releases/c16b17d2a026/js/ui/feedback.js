// Shared progressive enhancement for dynamically rendered forms and actions.
// No automatic request submission or permission-state mutation is performed.
let initialized = false;
export function initUiFeedback() {
    if (initialized) return;
    initialized = true;
    const clearInvalid = event => {
        const control = event.target;
        if (!control?.matches?.('input,select,textarea')) return;
        if (control.validity?.valid) control.removeAttribute('aria-invalid');
    };
    document.addEventListener('input', clearInvalid, true);
    document.addEventListener('change', clearInvalid, true);
    document.addEventListener('invalid', event => {
        if (event.target?.matches?.('input,select,textarea'))
            event.target.setAttribute('aria-invalid','true');
    }, true);
    // Esc closes browser-native disclosure only when a custom overlay is absent.
    // Each owned overlay handles its own Escape and focus restoration.
    document.addEventListener('click', event => {
        const btn = event.target.closest?.('button[aria-expanded="true"]');
        if (!btn || btn.disabled) return;
        btn.dataset.uiActive = 'true';
    }, true);
}
