// Delegated enhancement for asynchronously rendered controls. The owner of
// each overlay remains responsible for its actions and permission decisions.
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
    document.addEventListener('click', event => {
        const button = event.target.closest?.('button[aria-expanded],button[aria-controls]');
        if (!button || button.disabled) return;
        // Do not allow a second action to sneak through while a controller is
        // already pending; never re-enable a permission-disabled control.
        if (button.matches('[aria-busy="true"],[data-state="loading"]')) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        queueMicrotask(() => {
            if (!button.isConnected) return;
            const expanded = button.getAttribute('aria-expanded');
            if (expanded === 'true') button.dataset.uiActive = 'true';
            else if (expanded === 'false') delete button.dataset.uiActive;
        });
    }, true);
}
