import { openPopover, closePopover } from './surfaces.js';
import { __, getLang, setLang, onLangChange } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
const THEME_META_DARK = '#0F0F10';
const THEME_META_LIGHT = '#F8F9FA';

export function applyTheme(mode) {
  const html = document.documentElement;
  html.classList.add('theme-anim');
  if (mode === 'dark') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', mode);
  try {
    localStorage.setItem('theme', mode);
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (meta) meta.setAttribute('content', isDark ? THEME_META_DARK : THEME_META_LIGHT);
  document.dispatchEvent(new CustomEvent('vertex:theme', { detail: { mode } }));
  setTimeout(() => html.classList.remove('theme-anim'), 200);
  updateThemeButton();
}

export function getThemeMode() {
  try {
    return localStorage.getItem('theme') || 'dark';
  } catch {
    return 'dark';
  }
}

export function updateThemeButton() {
  const label = document.querySelector('#theme-menu-btn .topbar-select-label');
  if (label) label.textContent = __(`theme.${getThemeMode()}`);
  const svg = document.querySelector('#theme-menu-btn .icon');
  if (svg) {
    const holder = document.createElement('template');
    holder.innerHTML = icon(getThemeMode() === 'light' ? 'sun' : getThemeMode() === 'dark' ? 'moon' : 'device-desktop');
    svg.replaceWith(holder.content.firstChild);
  }
}

export function initTheme() {
  // Başlangıç: head içindeki inline script temayı yazmıştır (FOUC önlenir).
  const mode = getThemeMode();
  const html = document.documentElement;
  if (mode === 'light') html.setAttribute('data-theme', 'light');
  else if (mode === 'system') html.setAttribute('data-theme', 'system');
  else html.removeAttribute('data-theme');
  // Sistem tercihi değişirse System modunda anında uygula.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemeMode() === 'system') applyTheme('system');
  });
  applyTheme(mode);
}

/* ==================================================================
   UYGULAMA KABUĞU BAŞLATMA
   ================================================================== */

export function initTopbarMenus() {
  const themeBtn = document.getElementById('theme-menu-btn');
  themeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    openPopover(themeBtn, {
      className: 'theme-popover',
      render(el) {
        const modes = ['light', 'dark', 'system'];
        const current = getThemeMode();
        el.innerHTML = `<div class="vx-popover-header"><span class="vx-popover-title">${__('theme.select')}</span>
                        </div>
                    <div class="menu-list" role="menu">
                        ${modes
                          .map(
                            (
                              m,
                            ) => `<button type="button" class="menu-item ${m === current ? 'is-selected' : ''}" data-theme-mode="${m}" role="menuitemradio" aria-checked="${m === current}">
                            ${icon(m === 'light' ? 'sun' : m === 'dark' ? 'moon' : 'device-desktop', { size: 16 })}
                            <span>${__(`theme.${m}`)}</span>
                            <span class="menu-item-check">${icon('check', { size: 16 })}</span>
                        </button>`,
                          )
                          .join('')}
                    </div>`;
        el.querySelectorAll('[data-theme-mode]').forEach((item) => {
          item.addEventListener('click', () => {
            applyTheme(item.dataset.themeMode);
            closePopover({ restoreFocus: false });
          });
        });
      },
    });
  });

  const langBtn = document.getElementById('lang-toggle-btn');
  langBtn?.addEventListener('click', () => {
    openPopover(langBtn, {
      className: 'language-popover',
      render(el) {
        el.innerHTML = `<div class="menu-list" role="menu">${[
          ['tr', __('language.tr')],
          ['en', __('language.en')],
        ]
          .map(
            ([lang, label]) =>
              `<button type="button" class="menu-item ${getLang() === lang ? 'is-selected' : ''}" role="menuitemradio" aria-checked="${getLang() === lang}" data-language="${lang}"><span>${label}</span><span class="menu-item-check">${icon('check')}</span></button>`,
          )
          .join('')}</div>`;
        el.querySelectorAll('[data-language]').forEach(
          (button) =>
            (button.onclick = () => {
              setLang(button.dataset.language);
              closePopover();
            }),
        );
      },
    });
  });
}

export function initFileControls() {
  const controls = [];
  document.querySelectorAll('input[type="file"]').forEach((input) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'file-control';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chrome-btn-outline file-select-btn write-only';
    button.setAttribute('aria-controls', input.id);
    const label = document.createElement('span');
    label.className = 'file-control-name';
    label.setAttribute('aria-live', 'polite');
    input.before(wrapper);
    wrapper.append(input, button, label);
    input.classList.add('file-control-input');
    input.tabIndex = -1;
    button.onclick = () => input.click();
    const paint = () => {
      button.textContent = __('common.choose_file');
      label.textContent = input.files?.[0]?.name || __('common.no_file');
      button.disabled = input.disabled;
    };
    input.addEventListener('change', paint);
    controls.push(paint);
    paint();
  });
  onLangChange(() => controls.forEach((paint) => paint()));
}
