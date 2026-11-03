import { translationsReady, translatePage } from '../lang.js';
import { fetchFirebaseConfig } from './appConfig.js';

// Localization is ready before any network or feature initialization begins.
await translationsReady;
const STARTUP_TIMEOUT = 30000;
let startupFailed = false;
const showFailure = error => {
    if (startupFailed) return;
    startupFailed = true;
    document.documentElement.dataset.startupFailed = 'true';
    console.error('[INIT] Application failed to initialize.', error);
    document.querySelectorAll('#login-container,#admin-panel').forEach(el => { el.style.display = 'none'; });
    let loader = document.getElementById('app-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'app-loader';
        loader.className = 'vx-app-loader';
        document.body.appendChild(loader);
    }
    loader.classList.remove('is-leaving');
    loader.setAttribute('role', 'alert');
    loader.setAttribute('data-i18n-aria-label', 'init.error');
    loader.innerHTML = '<div class="state-block"><strong data-i18n="init.error"></strong><p data-i18n="init.retry"></p><button class="chrome-btn-outline" data-i18n="common.retry" data-startup-retry></button></div>';
    translatePage();
    loader.querySelector('[data-startup-retry]').onclick = () => location.reload();
    loader.querySelector('[data-startup-retry]').focus();
};
// Also bound authentication/feature startup: a silent dependency must not leave an endless sweep.
const deadline = setTimeout(() => showFailure(new Error('Startup timed out')), STARTUP_TIMEOUT);
const observer = new MutationObserver(() => {
    if (!document.getElementById('app-loader') || document.getElementById('app-loader').classList.contains('is-leaving')) {
        clearTimeout(deadline);
        observer.disconnect();
    }
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
const loadScript = url => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => { script.remove(); reject(new Error('SDK load timed out')); }, 10000);
    script.src = url;
    script.async = true;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error('SDK could not load')); };
    document.head.appendChild(script);
});
try {
    if (['localhost', '127.0.0.1'].includes(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    await loadScript('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
    if (typeof firebase === 'undefined') throw new Error('Firebase core SDK unavailable');
    await Promise.all(['auth', 'firestore', 'storage', 'functions', 'app-check'].map(service =>
        loadScript(`https://www.gstatic.com/firebasejs/11.0.0/firebase-${service}-compat.js`)));
    let config;
    try { config = JSON.parse(sessionStorage.getItem('firebaseConfig')); } catch { /* Cache is optional. */ }
    if (!config?.apiKey) {
        config = await fetchFirebaseConfig();
        try { sessionStorage.setItem('firebaseConfig', JSON.stringify(config)); } catch { /* Cache is optional. */ }
    }
    if (typeof firebase.functions !== 'function') throw new Error('Firebase Functions SDK unavailable');
    // Keep feature module fetch/evaluation errors inside the bootstrap error boundary.
    const { startApp } = await import('../main.js');
    if (!startupFailed) await startApp(config);
} catch (error) {
    clearTimeout(deadline);
    observer.disconnect();
    showFailure(error);
}
