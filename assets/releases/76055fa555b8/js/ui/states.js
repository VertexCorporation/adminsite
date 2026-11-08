import { showToast, __ } from '../utils/ui.js';
import { setButtonState } from './controls.js';
import { crossfade } from './transition.js';

// One state surface across modules. Render with textContent, never server HTML;
// exit and entrance share the same inert crossfade as loading and filtered lists.
export function renderUiState(container, {kind = 'empty', title = '', description = '',
    retry = null, retryLabel = null} = {}) {
    if (!container) return null;
    const state = document.createElement('div');
    state.className = 'state-block';
    state.dataset.stateKind = kind;
    state.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    const heading = document.createElement('h4');
    heading.textContent = String(typeof title === 'function' ? title() : (title || ''));
    state.append(heading);
    if (description) {
        const copy = document.createElement('p');
        copy.textContent = String(typeof description === 'function' ? description() : description);
        state.append(copy);
    }
    if (typeof retry === 'function') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chrome-btn-outline';
        button.textContent = String(retryLabel || __('common.retry'));
        button.addEventListener('click', async () => {
            if (button.disabled || button.dataset.state === 'loading') return;
            setButtonState(button,'loading');
            try {
                await retry();
            } catch (_error) {
                // Never expose infrastructure details or blindly repeat a
                // potentially non-idempotent mutation.
                showToast(() => __('errors.service'), 'error');
            } finally {
                setButtonState(button,'idle');
            }
        });
        state.append(button);
    }
    crossfade(container, () => container.replaceChildren(state));
    return state;
}

// A failed refresh must never erase known-good records.
export function showLoadError(container, message, retry, {staleSelector = null, retryLabel = null} = {}) {
    if (!container) return;
    const panel=container.closest('[data-panel]')?.dataset.panel;
    if(panel)document.dispatchEvent(new CustomEvent('vertex:workspace-load-error',{detail:{panel}}));
    container.classList.remove('is-refreshing');
    container.removeAttribute('aria-busy');
    const stale = staleSelector && container.querySelector(staleSelector);
    if (stale) {
        showToast(message, 'error');
        return 'stale';
    }
    renderUiState(container, {kind:'error', title:message, retry, retryLabel});
    return 'error';
}

export function showEmptyState(container, title, description = '') {
    return renderUiState(container, {kind:'empty', title, description});
}

export function showSuccessState(container, title, description = '') {
    return renderUiState(container, {kind:'success', title, description});
}
