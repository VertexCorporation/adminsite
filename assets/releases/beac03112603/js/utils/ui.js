import { showToast } from '../ui/toast.js';
import { __, getLang } from '../lang.js';
export { showToast, dismissToasts } from '../ui/toast.js';
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
export function userErrorMessage(error, context='') {
    const code=String(error?.code||'').replace('functions/','').replace('auth/','');
    const reason=error?.details?.reason;
    if(reason==='personnel-rollout-pending') return __('errors.personnel_rollout');
    if(reason==='personnel-membership-review') return __('errors.personnel_membership');
    if(reason==='personnel-version-conflict') return __('errors.personnel_stale');
    if(reason==='certificate-delivery-not-ready') {
        const blockers={
            'expansion-disabled':'cert.delivery_expansion_disabled',
            'contract-version-mismatch':'cert.delivery_contract_mismatch',
            'webhook-not-configured':'cert.delivery_webhook_missing',
            'webhook-invalid':'cert.delivery_webhook_invalid',
            'signing-secret-not-configured':'cert.delivery_signing_missing',
            'transport-not-ready':'cert.delivery_transport_unavailable'
        };
        const detail=blockers[error?.details?.blocker];
        return detail ? __('cert.delivery_not_ready')+' '+__(detail) : __('cert.delivery_not_ready');
    }
    if(error?.reason==='app-check-unavailable' || reason==='app-check-unavailable')
        return getLang()==='en' ? 'Security verification could not be completed. Check your connection and try again.' : 'Güvenlik doğrulaması tamamlanamadı. Bağlantınızı kontrol edip yeniden deneyin.';
    if(error?.reason==='authentication-unavailable' || reason==='authentication-unavailable')
        return __('errors.auth');
    if(reason==='permission-revision-conflict' || code==='aborted')
        return getLang()==='en' ? 'This record changed in another session. Reload before saving.' : 'Bu kayıt başka bir oturumda değişti. Kaydetmeden önce yenileyin.';
    const keys={'permission-denied':'errors.permission','insufficient-permission':'auth.denied','unauthenticated':'errors.auth','user-token-expired':'auth.session_expired','invalid-user-token':'auth.session_expired','resource-exhausted':'errors.capacity','too-many-requests':'errors.capacity','invalid-argument':'errors.validation','failed-precondition':'errors.precondition','not-found':'errors.not_found','unavailable':'errors.network','deadline-exceeded':'errors.network','network-request-failed':'errors.network','invalid-credential':'auth.credentials','wrong-password':'auth.credentials','user-not-found':'auth.credentials','invalid-email':'auth.credentials','user-disabled':'auth.denied'};
    return __(keys[code]||'errors.service');
}
