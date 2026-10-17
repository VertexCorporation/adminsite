import { showToast, __ } from '../utils/ui.js';
import { setButtonState } from './controls.js';

// A failed refresh must not erase previously loaded records. First load renders
// a localized, focusable retry state. All message text uses textContent.
export function showLoadError(container, message, retry, {staleSelector = null} = {}) {
    if (!container) return;
    container.classList.remove('is-refreshing');
    container.removeAttribute('aria-busy');
    const stale = staleSelector && container.querySelector(staleSelector);
    if (stale) {
        showToast(message, 'error');
        return 'stale';
    }
    const state = document.createElement('div');
    state.className = 'state-block';
    state.setAttribute('role','alert');
    const heading = document.createElement('h4');
    heading.textContent = typeof message === 'function' ? message() : String(message || '');
    state.append(heading);
    if (typeof retry === 'function') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chrome-btn-outline';
        button.textContent = __('common.retry');
        button.addEventListener('click', async () => {
            if (button.disabled) return;
            setButtonState(button,'loading');
            try {
                await retry();
            } catch (error) {
                // If the caller didn't handle an unexpected rejection, retain
                // the retry surface; don't replace errors with technical text.
                showToast(() => __('errors.service'),'error');
            } finally {
                setButtonState(button,'idle');
            }
        });
        state.append(button);
    }
    container.replaceChildren(state);
    return 'error';
}
