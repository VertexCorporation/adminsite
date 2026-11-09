import { __ } from '../utils/ui.js';
import { getEffectivePanelLevel, isPanelAdmin } from '../modules/roles.js';
import { openModal, closeModal, hasOpenSurface } from './surfaces.js';

export function initCommandPalette() {
  document.addEventListener('keydown', (event) => {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.altKey ||
      !(event.ctrlKey || event.metaKey) ||
      event.key.toLowerCase() !== 'k'
    )
      return;
    if (hasOpenSurface()) return;
    const eligible = [...document.querySelectorAll('.nav-module .dock-btn, .nav-module [data-nav-panel]')].filter(
      (button) => {
        const module = button.closest('.nav-module');
        if (
          !module ||
          module.hidden ||
          button.hidden ||
          button.disabled ||
          module.querySelector('.dock-btn')?.style.display === 'none' ||
          button.style.display === 'none'
        )
          return false;
        const keys = button.dataset.navPanel?.split(',');
        return (
          !keys ||
          keys.some((key) => (key !== 'system.deptPerms' || isPanelAdmin()) && getEffectivePanelLevel(key) !== 'none')
        );
      },
    );
    if (!eligible.length) return;
    event.preventDefault();
    openModal({
      title: __('console.ui.quickNavigation'),
      titleKey: 'console.ui.quickNavigation',
      render(body) {
        const input = document.createElement('input');
        input.type = 'search';
        input.className = 'search-input-field';
        input.setAttribute('aria-label', __('console.ui.findAModule'));
        input.placeholder = __('console.ui.findAModuleOrWorkspace');
        const results = document.createElement('div');
        results.className = 'form-grid';
        results.setAttribute('role', 'group');
        results.setAttribute('aria-label', __('console.ui.availableWorkspaces'));
        const render = () => {
          const needle = input.value.trim().toLocaleLowerCase();
          results.replaceChildren();
          for (const target of eligible) {
            // Permissions may change while the palette is open.
            if (
              !target.isConnected ||
              target.hidden ||
              target.disabled ||
              target.closest('.nav-module')?.hidden ||
              target.closest('.nav-module')?.querySelector('.dock-btn')?.style.display === 'none'
            )
              continue;
            const title = target.textContent.trim().replace(/\s+/g, ' ');
            if (!title || !title.toLocaleLowerCase().includes(needle)) continue;
            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'chrome-btn-outline';
            action.textContent = title;
            action.addEventListener('click', () => {
              const keys = target.dataset.navPanel?.split(',');
              if (
                keys &&
                !keys.some(
                  (key) => (key !== 'system.deptPerms' || isPanelAdmin()) && getEffectivePanelLevel(key) !== 'none',
                )
              )
                return;
              closeModal();
              requestAnimationFrame(() => {
                if (target.isConnected && !target.hidden) target.click();
              });
            });
            results.append(action);
          }
          if (!results.children.length) {
            const empty = document.createElement('p');
            empty.className = 'form-hint';
            empty.textContent = __('console.ui.noMatchingWorkspace');
            results.append(empty);
          }
        };
        input.addEventListener('input', render);
        input.addEventListener('keydown', (key) => {
          if (key.key === 'Enter') {
            const first = results.querySelector('button');
            if (first) {
              key.preventDefault();
              first.click();
            }
          } else if (key.key === 'ArrowDown') {
            const first = results.querySelector('button');
            if (first) {
              key.preventDefault();
              first.focus();
            }
          }
        });
        body.append(input, results);
        render();
      },
    });
  });
}
