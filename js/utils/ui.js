import { icon } from './icons.js';
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
const liveToasts = new Set();
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const text = () => String(typeof message === 'function' ? message() : message);
    const initial = text();
    const duplicate = [...liveToasts].find(item => item.type === type && item.text() === initial && Date.now()-item.created < 1200);
    if (duplicate) return duplicate.dismiss;
    const toast = document.createElement('div');
    toast.className = `toast ${['success','error','warning'].includes(type)?type:'info'}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerHTML = `${icon(type==='success'?'circle-check':type==='error'?'alert-circle':'info-circle')}<span class="toast-message"></span><button type="button" class="toast-dismiss icon-action-btn">${icon('x',{size:16})}</button>`;
    const label = toast.querySelector('.toast-message'),close = toast.querySelector('button');
    const paint = () => {label.textContent=text();close.setAttribute('aria-label',__('toast.dismiss_hint'));close.title=__('toast.dismiss_hint');};
    paint();
    const unsubscribe = onLangChange(paint);
    let timer, exitTimer, dismissed = false;
    const item = {type,text,created:Date.now(),dismiss};
    function dismiss() {
        if (dismissed) return;
        dismissed=true;clearTimeout(timer);unsubscribe();liveToasts.delete(item);
        toast.classList.remove('show');toast.classList.add('is-leaving');
        exitTimer=setTimeout(()=>toast.remove(),matchMedia('(prefers-reduced-motion: reduce)').matches?0:160);
    }
    const schedule = () => {clearTimeout(timer);if(!dismissed)timer=setTimeout(dismiss,type==='error'?7500:5000);};
    close.onclick=dismiss;
    toast.addEventListener('mouseenter',()=>clearTimeout(timer));toast.addEventListener('mouseleave',schedule);
    toast.addEventListener('focusin',()=>clearTimeout(timer));toast.addEventListener('focusout',schedule);
    container.prepend(toast);liveToasts.add(item);
    if(liveToasts.size>4)[...liveToasts][0].dismiss();
    requestAnimationFrame(()=>{if(!dismissed)toast.classList.add('show');});schedule();
    return dismiss;
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
