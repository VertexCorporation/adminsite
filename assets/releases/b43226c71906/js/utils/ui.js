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
const toastLimit=()=>Math.max(1,Math.min(innerWidth<721?2:innerWidth<1024?3:4,Math.floor((innerHeight-150)/85)));
function toastLayout(change) {
    const host=document.getElementById('toast-container');if(!host)return;
    const before=new Map([...host.children].map(el=>[el,el.getBoundingClientRect().top]));change();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    requestAnimationFrame(()=>before.forEach((top,el)=>{if(el.isConnected&&!el.classList.contains('is-leaving')){const delta=top-el.getBoundingClientRect().top;if(Math.abs(delta)>1)el.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'});}}));
}
export function dismissToasts(){[...liveToasts].forEach(item=>item.dismiss());}
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');if(!container)return;
    const text=()=>{try{const value=typeof message==='function'?message():message;return typeof value==='string'&&!/\[object Object\]|\(\)\s*=>|functions\/|PERMISSION_DENIED|auth\//.test(value)?value:__('errors.service');}catch{return __('errors.service');}};
    const duplicate=[...liveToasts].find(item=>item.type===type&&item.text()===text());if(duplicate)return duplicate.dismiss;
    const toast=document.createElement('div');toast.className=`toast ${['success','error','warning'].includes(type)?type:'info'}`;toast.tabIndex=0;
    toast.setAttribute('role',type==='error'?'alert':'status');
    toast.innerHTML=`${icon(type==='success'?'circle-check':type==='error'?'alert-circle':type==='warning'?'alert-triangle':'info-circle')}<span class="toast-message"></span>`;
    const paint=()=>{toast.querySelector('.toast-message').textContent=text();toast.setAttribute('aria-label',text()+' · '+__('toast.dismiss_hint'));};paint();const unsubscribe=onLangChange(paint);
    let timer,dismissed=false;const item={type,text,dismiss};
    function dismiss(){if(dismissed)return;dismissed=true;clearTimeout(timer);unsubscribe();liveToasts.delete(item);toast.classList.remove('show');toast.classList.add('is-leaving');setTimeout(()=>toastLayout(()=>toast.remove()),matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);}
    const schedule=()=>{clearTimeout(timer);if(!dismissed)timer=setTimeout(dismiss,type==='error'?7500:5000);};
    toast.onclick=dismiss;toast.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();dismiss();}};
    toast.onmouseenter=()=>clearTimeout(timer);toast.onmouseleave=schedule;toast.onfocus=()=>clearTimeout(timer);toast.onblur=schedule;
    toastLayout(()=>container.prepend(toast));liveToasts.add(item);while(liveToasts.size>toastLimit())[...liveToasts][0].dismiss();
    requestAnimationFrame(()=>{if(!dismissed)toast.classList.add('show');});schedule();return dismiss;
}
window.addEventListener('resize',()=>{while(liveToasts.size>toastLimit())[...liveToasts][0].dismiss();});

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
    if(reason==='certificate-delivery-not-ready')return __('cert.delivery_not_ready');
    const keys={'permission-denied':'errors.permission','insufficient-permission':'auth.denied','unauthenticated':'errors.auth','user-token-expired':'auth.session_expired','invalid-user-token':'auth.session_expired','resource-exhausted':'errors.capacity','too-many-requests':'errors.capacity','invalid-argument':'errors.validation','failed-precondition':'errors.precondition','not-found':'errors.not_found','unavailable':'errors.network','deadline-exceeded':'errors.network','network-request-failed':'errors.network','invalid-credential':'auth.credentials','wrong-password':'auth.credentials','user-not-found':'auth.credentials','invalid-email':'auth.credentials','user-disabled':'auth.denied'};
    return __(keys[code]||'errors.service');
}
