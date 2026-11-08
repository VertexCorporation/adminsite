import tr from '../l10n/tr.js';
import en from '../l10n/en.js';

const LANG = { tr, en };

const supportedLang = lang => lang === 'tr' || lang === 'en';
let currentLang = 'tr';
try {
  const stored = localStorage.getItem('siteLang');
  if (supportedLang(stored)) currentLang = stored;
} catch { /* Storage is optional, including in private browsing. */ }
const missingKeys = new Set();

export function __(key) {
  const lang = supportedLang(currentLang) ? currentLang : 'tr';
  const value = Object.hasOwn(LANG[lang], key) ? LANG[lang][key] : undefined;
  if (value !== undefined) return value;
  if (['localhost', '127.0.0.1'].includes(location.hostname) && !missingKeys.has(`${lang}:${key}`)) {
    missingKeys.add(`${lang}:${key}`);
    console.error(`[i18n] missing ${lang}:${key}`);
  }
  return LANG[lang]['common.unavailable'];
}
window.__ = __;
export function getLang() { return currentLang; }
export function setLang(lang) {
  currentLang = supportedLang(lang) ? lang : 'tr';
  try { localStorage.setItem('siteLang', currentLang); } catch { /* Keep the session usable. */ }
  translatePage();
  dispatchLangChange();
}
const langChangeCallbacks = [];
export function onLangChange(callback) {
  langChangeCallbacks.push(callback);
  return () => { const i = langChangeCallbacks.indexOf(callback); if (i >= 0) langChangeCallbacks.splice(i, 1); };
}
function dispatchLangChange() {
  [...langChangeCallbacks].forEach(cb => { try { cb(currentLang); } catch (e) { console.error(e); } });
}
let lastTranslatedTitle;
export function translatePage() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.tagName === 'TITLE' || el.tagName === 'META') return;
    const translation = __(el.getAttribute('data-i18n'));
    if (el.tagName === 'OPTGROUP') el.label = translation;
    else if (translation.includes('<')) el.innerHTML = translation;
    else el.textContent = translation;
  });
  for (const attribute of ['placeholder', 'title', 'value', 'aria-label']) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach(el => {
      el.setAttribute(attribute, __(el.getAttribute(`data-i18n-${attribute}`)));
      if (attribute === 'value') el.value = __(el.getAttribute(`data-i18n-${attribute}`));
    });
  }
  const titleKey = document.querySelector('title')?.getAttribute('data-i18n');
  // A page controller may own the title. Do not overwrite its dynamic title.
  if (titleKey && ((lastTranslatedTitle === undefined && ['tr', 'en'].some(lang => document.title === LANG[lang][titleKey])) || document.title === lastTranslatedTitle)) {
    document.title = __(titleKey);
    lastTranslatedTitle = document.title;
  }
  const metaDesc = document.querySelector('meta[name="description"][data-i18n]');
  if (metaDesc) metaDesc.content = __(metaDesc.getAttribute('data-i18n'));
  document.documentElement.dataset.translationReady = 'true';
}
// No Firebase, configuration, authentication or feature-module dependency here.
export const translationsReady = new Promise(resolve => {
  const ready = () => { translatePage(); resolve(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
});
