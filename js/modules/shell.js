import { initCommandPalette } from '../ui/commandPalette.js';
import {
  applyTheme,
  getThemeMode,
  initTheme,
  initTopbarMenus,
  initFileControls,
  updateThemeButton,
} from '../ui/appearance.js';
export { applyTheme, getThemeMode };
import {
  openPopover,
  closePopover,
  openDrawer,
  closeDrawer,
  openModal,
  closeModal,
  confirmDialog,
  hasOpenSurface,
} from '../ui/surfaces.js';
export { openPopover, closePopover, openDrawer, closeDrawer, openModal, closeModal, confirmDialog, hasOpenSurface };
import { showWorkspace } from './views.js';
import { lockScroll, unlockScroll } from '../ui/overlay.js';
import { animateViewEntry, animateViewSwitch } from '../ui/transition.js';
// js/modules/shell.js
//
// Uygulama kabuğu ve yükseltilmiş yüzey altyapısı:
//  - Tema yönetimi (Light / Dark / System) ve OS tercihini izleme
//  - Mobil sidebar drawer
//  - Anchored popover (flip + clamp + focus geri dönüşü)
//  - Sağ drawer, modal, confirmation dialog (odak tuzağı dahil)
//  - Tek seferde tek yüzey: çakışma önlenir.
// Tüm yüzeyler kapanışta DOM'dan tamamen kaldırılır; event listener
// sızıntısı bırakmaz (unbind listeleri ile).

import { __, getLang, setLang, onLangChange } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
import { getEffectivePanelLevel, isPanelAdmin } from './roles.js';

/* ==================================================================
   TEMA
   ================================================================== */

function syncTopbarTitle() {
  const activeBtn = document.querySelector('.dock-btn.active');
  const title = document.querySelector('.topbar-page-title');
  if (activeBtn && title) {
    const child = activeBtn.closest('.nav-module')?.querySelector('[aria-current=page]');
    const section =
      activeBtn.dataset.target === 'tab-system'
        ? document.querySelector('#tab-system .system-sections [aria-pressed=true]')
        : null;
    title.textContent =
      section?.textContent.trim() ||
      child?.textContent.trim() ||
      activeBtn.querySelector('.dock-label')?.textContent.trim() ||
      '';
    document.title = title.textContent ? `${title.textContent} · ${__('page.title')}` : __('page.title');
  }
}

function expandModule(module, expanded) {
  if (!module) return;
  const submenu = module.querySelector('.sidebar-submenu');
  if (!submenu) return;
  if (!expanded && submenu.contains(document.activeElement)) module.querySelector('.dock-btn').focus();
  module.classList.toggle('expanded', expanded);
  module.querySelector('.dock-btn').setAttribute('aria-expanded', String(expanded));
  submenu.inert = !expanded;
}

export function refreshNavigation() {
  document.querySelectorAll('.nav-module').forEach((module) => {
    const button = module.querySelector('.dock-btn');
    let available = button.style.display !== 'none';
    module.querySelectorAll('[data-nav-panel]').forEach((child) => {
      const keys = child.dataset.navPanel.split(',');
      child.hidden = !keys.some(
        (key) => (key !== 'system.deptPerms' || isPanelAdmin()) && getEffectivePanelLevel(key) !== 'none',
      );
      if (child.dataset.navAction === 'model-editor')
        child.hidden = getEffectivePanelLevel('models.manage') !== 'write';
      if (child.dataset.navAction === 'templates') child.hidden = !isPanelAdmin();
      if (child.dataset.navAction === 'certificates') child.hidden = !isPanelAdmin();
    });
    const children = [...module.querySelectorAll('[data-nav-panel]')];
    available = available && (!children.length || children.some((child) => !child.hidden));
    module.hidden = !available;
    module.querySelectorAll('.catalog-subheading').forEach((heading) => {
      let next = heading.nextElementSibling,
        visible = false;
      while (next && !next.classList.contains('catalog-subheading')) {
        if (next.matches('[data-nav-panel]') && !next.hidden) visible = true;
        next = next.nextElementSibling;
      }
      heading.hidden = !visible;
    });
    button
      .querySelector('.nav-chevron')
      ?.toggleAttribute('hidden', ![...module.querySelectorAll('[data-nav-panel]')].some((child) => !child.hidden));
    expandModule(module, available && button.classList.contains('active'));
  });
  document.querySelectorAll('.sidebar-sub-btn').forEach((child) => child.removeAttribute('aria-current'));
  const activeModule = document.querySelector('.nav-module .dock-btn.active')?.closest('.nav-module');
  const selected =
    activeModule?.querySelector('[data-nav-selected]:not([hidden])') ||
    activeModule?.querySelector('.sidebar-sub-btn:not([hidden])');
  selected?.setAttribute('aria-current', 'page');
  document.querySelectorAll('.sidebar-group').forEach((group) => {
    group.hidden = ![...group.querySelectorAll('.nav-module')].some((module) => !module.hidden);
  });
  if (selected)
    showWorkspace(
      document.querySelector('.tab-panel.active'),
      selected.dataset.navPanel.split(','),
      selected.dataset.navAction,
    );
  syncTopbarTitle();
  syncMobileDock();
}

function syncMobileDock() {
  // Reserve More, then fit 44px touch targets, 4px gaps and the dock's
  // padding/border inside the viewport's 12px side margins.
  const capacity = Math.max(1, Math.floor((document.documentElement.clientWidth - 34) / 48) - 1);
  let visible = 0;
  document.querySelectorAll('[data-mobile-tab]').forEach((button) => {
    const source = document.querySelector(`.dock-btn[data-target="${button.dataset.mobileTab}"]`);
    const allowed = source && source.style.display !== 'none' && !source.closest('.nav-module')?.hidden;
    button.hidden = !allowed || visible >= capacity;
    if (allowed && !button.hidden) visible++;
    button.setAttribute('aria-current', source?.classList.contains('active') ? 'page' : 'false');
    button.setAttribute('aria-label', source?.textContent.trim() || '');
  });
}

function initNavigation() {
  const nav = document.getElementById('navigation-tabs-dock');
  const sidebar = document.querySelector('.app-sidebar');
  const toggle = document.getElementById('nav-toggle');
  const scrim = document.createElement('div');
  scrim.className = 'nav-scrim';
  document.body.append(scrim);
  let mobileTrigger = null;
  const mobile = () => window.innerWidth < 1024;
  const closeSidebarDrawer = (restore = false) => {
    sidebar?.classList.remove('open');
    scrim.classList.remove('is-open');
    document.querySelectorAll('.app-main,.app-header,.mobile-bottom-dock').forEach((el) => {
      el.inert = false;
    });
    toggle?.setAttribute('aria-expanded', 'false');
    if (sidebar) sidebar.inert = mobile();
    sidebar?.removeAttribute('aria-modal');
    sidebar?.removeAttribute('role');
    unlockScroll('navigation');
    if (restore && mobileTrigger?.isConnected) mobileTrigger.focus({ preventScroll: true });
  };
  const activateTab = (button, destination = null) => {
    if (!button) return;
    const target = document.getElementById(button.dataset.target);
    if (!target || button.style.display === 'none') return;
    const changed = !target.classList.contains('active');
    const outgoing = changed ? document.querySelector('.tab-panel.active') : null;
    const update = () => {
      // Commit the exact sub-workspace before the incoming tab is painted.
      if (destination) {
        const module = button.closest('.nav-module');
        module?.querySelectorAll('[data-nav-selected]').forEach((el) => el.removeAttribute('data-nav-selected'));
        destination.setAttribute('data-nav-selected', '');
      }
      document.querySelectorAll('.tab-panel,.dock-btn').forEach((el) => el.classList.remove('active'));
      target.classList.add('active');
      button.classList.add('active');
      refreshNavigation();
    };
    if (changed && outgoing) animateViewSwitch(outgoing, target, update);
    else {
      update();
      if (changed) animateViewEntry(target);
    }
    if (target.id === 'tab-chat')
      document.dispatchEvent(new CustomEvent('vertex:workspace', { detail: { keys: ['chat.channels'] } }));
    if (changed) window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const dock = document.createElement('nav');
  dock.className = 'mobile-bottom-dock';
  dock.setAttribute('aria-label', __('navigation.main'));
  dock.innerHTML =
    [
      ['home', 'home'],
      ['users', 'users-group'],
      ['origin', 'crown'],
      ['contributors', 'user-plus'],
      ['models', 'robot'],
      ['publications', 'news'],
      ['subscriptions', 'crown'],
      ['scene', 'award'],
      ['system', 'settings'],
    ]
      .map(([id, glyph]) => `<button type="button" data-mobile-tab="tab-${id}">${icon(glyph)}</button>`)
      .join('') +
    `<button type="button" data-mobile-more aria-label="${__('contributors.more')}">${icon('dots')}</button>`;
  document.querySelector('.app-layout').append(dock);
  dock.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-mobile-more')) {
      openMore(button);
      return;
    }
    const source = document.querySelector(`.dock-btn[data-target="${button.dataset.mobileTab}"]`);
    if (source) {
      const module = source.closest('.nav-module');
      const selected =
        module?.querySelector('[data-nav-selected]:not([hidden])') ||
        module?.querySelector('.sidebar-sub-btn:not([hidden])');
      // The previous path activated a default page first, then clicked a
      // submenu and activated a second page in the same interaction.
      if (selected) selected.click();
      else {
        activateTab(source);
        if (source.dataset.target === 'tab-home' || source.dataset.target === 'tab-chat')
          recordRoute({ dataset: { navPanel: source.dataset.target.slice(4), navAction: '' } });
      }
      closeSidebarDrawer(false);
    }
  });
  onLangChange(() => {
    dock.setAttribute('aria-label', __('navigation.main'));
    dock.querySelector('[data-mobile-more]').setAttribute('aria-label', __('contributors.more'));
    syncMobileDock();
  });
  function openMore(anchor) {
    let unsubscribe = () => {};
    const body = openModal({
      title: __('navigation.more'),
      titleKey: 'navigation.more',
      onAfterClose: () => unsubscribe(),
    });
    body.closest('.vx-modal').classList.add('mobile-more-sheet');
    const paint = () => {
      body.innerHTML =
        '<nav class="mobile-more-pages" aria-label="' +
        __('navigation.more') +
        '">' +
        [...document.querySelectorAll('.nav-module:not([hidden])')]
          .map((module) => {
            const main = module.querySelector('.dock-btn');
            const children = [...module.querySelectorAll('[data-nav-panel]:not([hidden])')];
            return (
              '<section data-more-module="' +
              main.dataset.target +
              '"><h3>' +
              main.querySelector('.dock-label').textContent +
              '</h3>' +
              children
                .map(
                  (child) =>
                    '<button type="button" data-more-panel="' +
                    child.dataset.navPanel +
                    '" data-more-action="' +
                    child.dataset.navAction +
                    '" ' +
                    (child.getAttribute('aria-current') === 'page' ? 'aria-current="page"' : '') +
                    '>' +
                    child.textContent.trim() +
                    icon('chevron-right') +
                    '</button>',
                )
                .join('') +
              (children.length
                ? ''
                : '<button type="button" data-more-tab="' +
                  main.dataset.target +
                  '">' +
                  main.querySelector('.dock-label').textContent +
                  icon('chevron-right') +
                  '</button>') +
              '</section>'
            );
          })
          .join('') +
        '<section><button type="button" data-more-profile>' +
        __('nav.profile') +
        icon('chevron-right') +
        '</button></section></nav>';
      body.querySelectorAll('[data-more-panel]').forEach(
        (button) =>
          (button.onclick = () => {
            const child = [...document.querySelectorAll('.sidebar-sub-btn:not([hidden])')].find(
              (el) =>
                el.dataset.navPanel === button.dataset.morePanel && el.dataset.navAction === button.dataset.moreAction,
            );
            if (child) {
              closeModal();
              child.click();
            }
          }),
      );
      body.querySelectorAll('[data-more-tab]').forEach(
        (button) =>
          (button.onclick = () => {
            const main = document.querySelector('.dock-btn[data-target="' + button.dataset.moreTab + '"]');
            closeModal();
            activateTab(main);
          }),
      );
      body.querySelector('[data-more-profile]').onclick = () => {
        closeModal();
        document.querySelector('.sidebar-footer [data-target="tab-profile"]').click();
      };
    };
    paint();
    unsubscribe = onLangChange(paint);
    document.addEventListener(
      'vertex:departments',
      () => {
        if (body.isConnected) paint();
      },
      { once: true },
    );
  }
  let restoringRoute = false;
  const recordRoute = (child) => {
    if (restoringRoute) return;
    const route = { panel: child.dataset.navPanel, action: child.dataset.navAction || '' };
    if (JSON.stringify(history.state?.vertexRoute) !== JSON.stringify(route))
      history.pushState(
        { vertexRoute: route },
        '',
        location.pathname + '?panel=' + encodeURIComponent(route.panel) + '&view=' + encodeURIComponent(route.action),
      );
  };
  const restoreRoute = () => {
    const params = new URLSearchParams(location.search);
    const route = history.state?.vertexRoute || { panel: params.get('panel'), action: params.get('view') || '' };
    if (route.panel === 'contributors.users') route.panel = 'users.directory';
    if (['contributors.vertexStatus', 'users.status', 'users.deleteAccount'].includes(route.panel))
      route.panel = 'users.status,users.deleteAccount';
    if (route.panel?.includes('system.teamLog') && route.action === 'verification') {
      route.panel = 'system.teamLog';
      route.action = 'honor';
    }
    if (route.panel === 'home' || route.panel === 'chat') {
      const tabButton = document.querySelector('.dock-btn[data-target="tab-' + route.panel + '"]');
      if (tabButton) {
        restoringRoute = true;
        activateTab(tabButton);
        restoringRoute = false;
      }
      return;
    }
    const child = [...document.querySelectorAll('[data-nav-panel]')].find(
      (el) => el.dataset.navPanel === route.panel && el.dataset.navAction === route.action && !el.hidden,
    );
    const exportChild =
      route.action === 'attributions'
        ? [...document.querySelectorAll('[data-nav-panel]')].find(
            (el) => el.dataset.navAction === 'export' && el.dataset.navPanel === route.panel && !el.hidden,
          )
        : null;
    if (child || exportChild) {
      restoringRoute = true;
      (child || exportChild).click();
      if (exportChild) document.dispatchEvent(new CustomEvent('vertex:system-section', { detail: 'attributions' }));
      restoringRoute = false;
    }
  };
  document.addEventListener('vertex:system-page', (event) => {
    syncTopbarTitle();
    if (
      document.querySelector('.dock-btn.active')?.dataset.target === 'tab-system' &&
      event.detail === 'attributions'
    ) {
      const source = document.querySelector('[data-nav-action=export]');
      if (source) recordRoute({ dataset: { navPanel: source.dataset.navPanel, navAction: 'attributions' } });
    }
  });
  window.addEventListener('popstate', restoreRoute);
  document.addEventListener('vertex:departments', () => setTimeout(restoreRoute, 0));
  nav?.addEventListener('click', (event) => {
    const button = event.target.closest('.dock-btn');
    if (button) {
      const module = button.closest('.nav-module');
      const wasActive = button.classList.contains('active');
      const wasExpanded = module?.classList.contains('expanded');
      activateTab(button);
      const destination = module?.querySelector('[aria-current=page]');
      if (destination) recordRoute(destination);
      else if (button.dataset.target === 'tab-home' || button.dataset.target === 'tab-chat')
        recordRoute({ dataset: { navPanel: button.dataset.target.slice(4), navAction: '' } });
      if (wasActive) expandModule(module, !wasExpanded);
      // Keep mobile navigation open while choosing a contextual destination.
      if (!module?.querySelector('.sidebar-submenu')) closeSidebarDrawer(true);
      return;
    }
    const child = event.target.closest('[data-nav-panel]');
    if (!child || child.hidden) return;
    const parent = child.closest('.nav-module').querySelector('.dock-btn');
    activateTab(parent, child);
    recordRoute(child);
    syncTopbarTitle();
    const action = child.dataset.navAction;
    if (!['certificates', 'templates'].includes(action)) closeDrawer(false);
    if (parent.dataset.target === 'tab-system')
      document.dispatchEvent(new CustomEvent('vertex:system-section', { detail: action }));
    const keys = child.dataset.navPanel.split(',');
    // refreshNavigation has already rendered the destination. Avoid a
    // second content transition over the incoming page animation.
    const card = [...document.getElementById(parent.dataset.target).querySelectorAll('.panel-card[data-panel]')].find(
      (el) => keys.includes(el.dataset.panel) && !el.hidden && el.style.display !== 'none',
    );
    closeSidebarDrawer(false);
    // Restore URLs without stealing focus; pointer/touch navigation also
    // leaves focus on the chosen control. Only keyboard activation moves it.
    const focusDestination = event.isTrusted && event.detail === 0;
    if (action === 'templates') document.dispatchEvent(new CustomEvent('vertex:application-templates'));
    if (action === 'model-editor') {
      if (focusDestination) card?.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (action === 'certificates') document.dispatchEvent(new CustomEvent('vertex:certificate-selector'));
      else if (card && focusDestination) {
        card.tabIndex = -1;
        card.focus({ preventScroll: true });
      }
    }
  });
  document.querySelectorAll('.sidebar-footer .dock-btn').forEach((button) =>
    button.addEventListener('click', (event) => {
      activateTab(event.currentTarget);
      closeSidebarDrawer(true);
    }),
  );
  toggle?.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      closeSidebarDrawer(true);
      return;
    }
    mobileTrigger = document.activeElement;
    lockScroll('navigation');
    sidebar.inert = false;
    sidebar.classList.add('open');
    scrim.classList.add('is-open');
    document.querySelectorAll('.app-main,.app-header,.mobile-bottom-dock').forEach((el) => {
      el.inert = true;
    });
    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-modal', 'true');
    sidebar.setAttribute('aria-label', __('navgroup.workspace'));
    toggle.setAttribute('aria-expanded', 'true');
    (sidebar.querySelector('.dock-btn.active') || sidebar.querySelector('.dock-btn'))?.focus();
  });
  scrim.addEventListener('click', () => closeSidebarDrawer(true));
  sidebar.querySelector('.sidebar-close')?.addEventListener('click', () => closeSidebarDrawer(true));
  document.addEventListener('keydown', (event) => {
    if (!sidebar.classList.contains('open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSidebarDrawer(true);
    }
    if (event.key === 'Tab') {
      const items = [...sidebar.querySelectorAll('button:not([disabled])')].filter(
        (el) => el.getClientRects().length && !el.closest('[inert]'),
      );
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  let previousWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth !== previousWidth) {
      previousWidth = window.innerWidth;
      closeSidebarDrawer();
      syncMobileDock();
    }
  });
  document.addEventListener('vertex:close-navigation', () => closeSidebarDrawer());
  document.addEventListener('vertex:departments', () => queueMicrotask(refreshNavigation));
  closeSidebarDrawer();
  syncTopbarTitle();
  if (!history.state?.vertexRoute && !new URLSearchParams(location.search).has('panel'))
    history.replaceState({ vertexRoute: { panel: 'home', action: '' } }, '', location.pathname + '?panel=home&view=');
}

// Keyboard navigation is built from the *currently authorized* sidebar.
// It never invents a route or bypasses a hidden/disabled management command.

export function initShell() {
  initTheme();
  initFileControls();
  initNavigation();
  initTopbarMenus();
  initCommandPalette();
  onLangChange(() => {
    queueMicrotask(syncTopbarTitle);
    updateThemeButton();
    if (document.querySelector('.language-popover.is-open,.theme-popover.is-open'))
      closePopover({ restoreFocus: false });
  });
}
