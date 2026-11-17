import tr from '../../l10n/tr/common.js';
import en from '../../l10n/en/common.js';
import trIndex from '../../l10n/tr/ui-index.js';
import enIndex from '../../l10n/en/ui-index.js';

// Sign-in is a public, lightweight surface. The private console and its
// security SDKs start on sign-in intent, or immediately for a returning visit.
// Storage is only a prefetch hint: it never grants access or replaces Auth.
const bootstrapURL = new URL('./bootstrap.js', import.meta.url);
const login = document.getElementById('login-container');
const loader = document.getElementById('app-loader');
let lang = 'tr',
  returning = false,
  signedOut = false;
try {
  lang = localStorage.getItem('siteLang') === 'en' ? 'en' : 'tr';
  const hint = localStorage.getItem('vertexConsoleSession');
  signedOut = hint === 'signed-out';
  returning = hint === 'active' || (hint === null && localStorage.length > 0);
} catch {
  returning = true; // Preserve automatic session recovery when storage is restricted.
}
const messages = lang === 'en' ? { ...en, ...enIndex } : { ...tr, ...trIndex };
document.documentElement.lang = lang;
document.title = messages['page.title'];
for (const node of login.querySelectorAll('[data-i18n]')) node.textContent = messages[node.dataset.i18n];
for (const attribute of ['aria-label', 'placeholder']) {
  for (const node of login.querySelectorAll(`[data-i18n-${attribute}]`)) {
    node.setAttribute(attribute, messages[node.getAttribute(`data-i18n-${attribute}`)]);
  }
}
document.documentElement.dataset.translationReady = 'true';
document.documentElement.dataset.loginReady = 'true';

let startup,
  ready = false,
  replayPending = false;
function loadStyles() {
  const template = document.getElementById('console-styles');
  if (!template) return Promise.resolve();
  const pending = [...template.content.querySelectorAll('link')].map((source) => {
    const link = source.cloneNode(true);
    // Third-party typography is optional; an unavailable font must never
    // prevent session recovery or leave the sign-in action waiting.
    if (link.rel !== 'stylesheet' || new URL(link.href, location.href).origin !== location.origin) {
      document.head.append(link);
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Console stylesheet timed out')), 15000);
      link.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      link.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Console stylesheet unavailable'));
      };
      document.head.append(link);
    });
  });
  template.remove();
  return Promise.all(pending);
}
function showFailure() {
  if (!loader.isConnected) document.body.append(loader);
  loader.hidden = false;
  if (document.querySelector('[data-startup-retry]')) return;
  document.documentElement.dataset.startupFailed = 'true';
  login.style.display = 'none';
  loader.hidden = false;
  loader.setAttribute('role', 'alert');
  loader.replaceChildren();
  const block = document.createElement('div');
  block.className = 'state-block';
  const title = document.createElement('strong'),
    detail = document.createElement('p'),
    retry = document.createElement('button');
  title.textContent = messages['init.error'];
  detail.textContent = messages['init.retry'];
  retry.textContent = messages['common.retry'];
  retry.className = 'chrome-btn-outline';
  retry.dataset.startupRetry = '';
  retry.onclick = () => location.reload();
  block.append(title, detail, retry);
  loader.append(block);
  retry.focus();
}
function startConsole(blocking = false) {
  if (startup) return startup;
  if (!loader.isConnected) document.body.append(loader);
  // Preparing while someone types must not cover or replace the sign-in form.
  loader.hidden = !blocking;
  startup = loadStyles()
    .then(() => import(bootstrapURL.href))
    .then(() => {
      if (document.documentElement.dataset.startupFailed === 'true') throw new Error('Console startup failed');
      ready = true;
    })
    .catch((error) => {
      showFailure();
      throw error;
    });
  return startup;
}
const warm = () => {
  void startConsole().catch(() => {});
};
const restore = () => {
  void startConsole(true).catch(() => {});
};
window.addEventListener('storage', (event) => {
  if (event.key === 'vertexConsoleSession' && event.newValue === 'active') restore();
});
login.addEventListener('focusin', warm, { once: true });
login.addEventListener('pointerdown', warm, { once: true });
async function replay(event, target) {
  if (ready) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (replayPending) return;
  replayPending = true;
  target.setAttribute('aria-busy', 'true');
  try {
    await startConsole();
    target.removeAttribute('aria-busy');
    if (target.tagName === 'FORM') target.requestSubmit();
    else target.click();
  } catch {
    target.removeAttribute('aria-busy');
    /* The explicit startup error owns recovery. Never replay a failed initialization. */
  } finally {
    replayPending = false;
  }
}
document
  .getElementById('login-form')
  .addEventListener('submit', (event) => void replay(event, event.currentTarget), true);
for (const id of ['google-login-btn', 'apple-login-btn']) {
  document.getElementById(id).addEventListener('click', (event) => void replay(event, event.currentTarget), true);
}

// Existing Firebase sessions can use IndexedDB without a preference in
// localStorage. Inspect database presence only, never credentials or tokens.
if (signedOut) loader.remove();
else if (returning) restore();
else if (typeof window.indexedDB?.databases === 'function') {
  indexedDB
    .databases()
    .then((databases) => {
      if (databases.some((database) => database.name)) restore();
      else if (!startup) loader.remove();
    })
    .catch(restore);
} else restore();
