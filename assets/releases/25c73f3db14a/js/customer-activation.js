import {__, getLang, setLang, onLangChange} from './lang.js';
import {fetchFirebaseConfig} from './core/appConfig.js';

// The fragment is never sent to the host. Remove it from browser history;
// retain the bearer token in this page's memory only, never in logs/storage.
const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
history.replaceState(null, '', location.pathname);
const button = document.getElementById('activation-begin');
const status = document.getElementById('activation-status');
const language = document.getElementById('activation-language');
let state = /^[A-Za-z0-9_-]{43}$/.test(token) ? '' : 'customer.activationInvalid';
let exchange;
function render() {language.value = getLang(); status.textContent = state ? __(state) : ''; button.hidden = state === 'customer.activationInvalid';}
language.addEventListener('change', () => setLang(language.value));
onLangChange(render); render();
button.addEventListener('click', async () => {
  if (button.disabled || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  button.disabled = true; state = 'customer.activationWorking'; render();
  try {
    if (!exchange) {
      const [{initializeApp}, {getFunctions, httpsCallable}, config] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js'),
        fetchFirebaseConfig({}),
      ]);
      exchange = httpsCallable(getFunctions(initializeApp(config), 'europe-west1'), 'exchangePersonnelInvitation');
    }
    const {data} = await exchange({token});
    const url = new URL(data.url);
    if (url.origin !== 'https://vertexishere.com' || url.pathname !== '/actions.html' || url.searchParams.get('mode') !== 'resetPassword' || !url.searchParams.get('oobCode') || url.searchParams.has('personnel')) throw Error('Invalid destination');
    url.searchParams.set('lang', getLang());
    location.replace(url.href);
  } catch (error) {
    state = error.code === 'functions/resource-exhausted' ? 'customer.activationThrottled' : error.code === 'functions/permission-denied' ? 'customer.activationExpired' : 'customer.activationError';
    button.disabled = false; render();
  }
});
