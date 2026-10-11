import { __, onLangChange } from '../lang.js';
// js/utils/ui.js

// Re-export translation functions from lang.js
export { __, getLang, setLang, onLangChange, translatePage } from '../lang.js';

/**
 * Sanitizes a string to prevent XSS attacks by replacing HTML special characters.
 * This should be used before inserting any dynamic data into .innerHTML.
 * @param {string} str The string to sanitize.
 * @returns {string} The sanitized, HTML-safe string.
 */
/** HTML özel karakterlerini kaçırır (güvenli string interpolasyonu için). */
export function escapeHTML(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function sanitizeHTML(str) {
    if (str === null || typeof str === 'undefined') {
        return '';
    }
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * Displays a toast notification message.
 * @param {string | (() => string)} message A render callback keeps translated text current.
 * @param {'info' | 'success' | 'error'} type The type of toast.
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const paint = () => {
        toast.textContent = typeof message === 'function' ? message() : message;
        toast.title = __('toast.dismiss_hint');
    };
    paint();
    const unsubscribe = onLangChange(paint);
    const remove = () => { unsubscribe(); toast.remove(); };
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => remove(), 250);
    });

    container.appendChild(toast);
    // Trigger the animation
    setTimeout(() => toast.classList.add('show'), 100);

    // Set timeout to hide and then remove the toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => remove(), 300);
        toast.addEventListener('transitionend', () => {
            if (toast.parentElement) {
                remove();
            }
        }, { once: true });
    }, 5000);
}

/**
 * Creates a simple, non-crypto hash of a string to track changes.
 * Must be identical to the one in the supervisor worker.
 * @param {string} str The string to hash.
 * @returns {string} A simple hash string.
 */
export function simpleHash(str) {
    if (!str) return 'h0';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return 'h' + hash.toString(36);
}

/**
 * A helper function to get the current user's ID token.
 * Throws an error if the user is not signed in or token fails to generate.
 * @param {object} auth - The Firebase auth service instance.
 * @returns {Promise<string>} The user's ID token.
 */
export async function getAuthToken(auth) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("No user is signed in. Cannot get auth token.");
    }
    try {
        // Force refresh the token to ensure it's not expired.
        return await user.getIdToken(true);
    } catch (error) {
        console.error("[AUTH] Error getting ID token:", error);
        showToast(() => __("auth.session_expired"), "error");
        auth.signOut(); // Sign out the user on token failure
        throw new Error("Failed to get a valid auth token.");
    }
}
/** Keep remote diagnostics out of user-facing errors. */
export function userErrorMessage(error) {
    const code=String(error?.code||'').replace('functions/','');
    return __(({ 'permission-denied':'errors.permission', 'unauthenticated':'errors.auth', 'resource-exhausted':'errors.capacity', 'invalid-argument':'errors.validation' })[code]||'errors.service');
}
