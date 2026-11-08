import { loadHtmlFragments } from './htmlFragments.js';
import { translationsReady, translatePage } from '../lang.js';
import { initDataExport } from '../modules/dataExport.js';

await translationsReady;
try {
    await loadHtmlFragments();
    translatePage();
    initDataExport();
    // DOM references in feature modules are evaluated only after mounting HTML.
    await import('./initializer.js');
} catch (error) {
    document.documentElement.dataset.startupFailed = 'true';
    document.documentElement.dataset.startupStage = 'markup';
    document.querySelectorAll('#login-container,#admin-panel').forEach(el => {el.style.display = 'none';});
    const loader = document.getElementById('app-loader');
    loader.setAttribute('role', 'alert');
    loader.innerHTML = '<div class="state-block"><strong data-i18n="init.error"></strong>' +
        '<p data-i18n="init.retry"></p><small>CONSOLE/MARKUP</small>' +
        '<button class="chrome-btn-outline" data-i18n="common.retry" data-startup-retry></button></div>';
    translatePage();
    const retry = loader.querySelector('[data-startup-retry]');
    retry.onclick = () => location.reload();
    retry.focus();
    console.error('[INIT] HTML bootstrap failed.', error);
}
