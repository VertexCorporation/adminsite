import { getEffectivePanelLevel } from './roles.js';
import { reducedMotion } from '../ui/motion.js';

// Commit workspace visibility in a single synchronous update. Previous
// outgoing-card crossfades rendered the old page on top of the requested one.
export function showWorkspace(tab, keys, action = '') {
  if (!tab || tab.id === 'tab-system') return;
  const cards = [...tab.querySelectorAll('.panel-card[data-panel]')];
  const selected = keys.filter((key) => getEffectivePanelLevel(key) !== 'none');
  const next = selected.join(',') + ':' + action;
  const changed = !!tab.dataset.workspace && tab.dataset.workspace !== next;
  const enteringTab = tab.classList.contains('ui-tab-entering');
  for (const card of cards) {
    card.classList.remove('workspace-enter');
    card.hidden = !(
      selected.includes(card.dataset.panel) &&
      (!card.dataset.workspaceAction || card.dataset.workspaceAction === action) &&
      card.style.display !== 'none'
    );
  }
  updateGridVisibleCounts(tab);
  tab.dataset.workspace = next;
  if (changed && !enteringTab && !reducedMotion() && tab.classList.contains('active')) {
    for (const card of cards) {
      if (!card.hidden && card.getClientRects().length)
        card.animate(
          [
            { opacity: 0.84, transform: 'translateY(3px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          { duration: 170, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
    }
  }
  document.dispatchEvent(new CustomEvent('vertex:workspace', { detail: { keys: selected, action } }));
}

/** Every grid records its actual number of visible panels. */
export function updateGridVisibleCounts(scope) {
  const root = scope || document;
  // Measure the entire group before writing any columns. Interleaving reads
  // and writes forces another layout for each grid during a resize.
  const layouts = [...root.querySelectorAll('.grid-layout')].map((grid) => {
    const visible = [...grid.children].filter((el) => !el.hidden && getComputedStyle(el).display !== 'none').length;
    const width = grid.getBoundingClientRect().width || window.innerWidth;
    const maximum = Math.max(1, Math.floor((width + 16) / 316));
    return { grid, visible: String(visible), columns: String(Math.max(1, Math.min(visible, maximum))) };
  });
  layouts.forEach(({ grid, visible, columns }) => {
    if (grid.dataset.visiblePanels !== visible) grid.dataset.visiblePanels = visible;
    if (grid.style.getPropertyValue('--panel-columns') !== columns) grid.style.setProperty('--panel-columns', columns);
  });
}

let adaptiveGridsInitialized = false;
export function initAdaptiveGrids() {
  if (adaptiveGridsInitialized) return;
  adaptiveGridsInitialized = true;
  let frame = null;
  const schedule = () => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      updateGridVisibleCounts();
    });
  };
  const observer = new MutationObserver(schedule);
  for (const grid of document.querySelectorAll('.grid-layout')) {
    observer.observe(grid, { childList: true, subtree: false });
    // Attribute watches belong to cards, not grids: computed column writes
    // must never trigger their own observer in an endless render loop.
    for (const card of grid.children)
      observer.observe(card, {
        attributes: true,
        attributeFilter: ['hidden', 'style'],
      });
  }
  window.addEventListener('resize', schedule, { passive: true });
  updateGridVisibleCounts();
}
