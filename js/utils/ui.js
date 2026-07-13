// js/utils/ui.js

// Re-export translation functions from lang.js
export { __, getLang, setLang, onLangChange, translatePage } from '../lang.js';

/**
 * Sanitizes a string to prevent XSS attacks by replacing HTML special characters.
 * This should be used before inserting any dynamic data into .innerHTML.
 * @param {string} str The string to sanitize.
 * @returns {string} The sanitized, HTML-safe string.
 */
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
 * @param {string} message The message to display.
 * @param {'info' | 'success' | 'error'} type The type of toast.
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    // Trigger the animation
    setTimeout(() => toast.classList.add('show'), 100);

    // Set timeout to hide and then remove the toast
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentElement) {
                container.removeChild(toast);
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
        showToast("Authentication session expired. Please log in again.", "error");
        auth.signOut(); // Sign out the user on token failure
        throw new Error("Failed to get a valid auth token.");
    }
}