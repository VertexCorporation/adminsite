import { getEffectivePanelLevel } from './roles.js';
import { reducedMotion } from '../ui/motion.js';

// Commit workspace visibility in a single synchronous update. Previous
// outgoing-card crossfades rendered the old page on top of the requested one.
export function showWorkspace(tab, keys) {
    if (!tab || tab.id === 'tab-system') return;
    const cards = [...tab.querySelectorAll('.panel-card[data-panel]')];
    const selected = keys.filter(key => getEffectivePanelLevel(key) !== 'none');
    const next = selected.join(',');
    const changed = !!tab.dataset.workspace && tab.dataset.workspace !== next;
    const enteringTab = tab.classList.contains('ui-tab-entering');
    for (const card of cards) {
        card.classList.remove('workspace-enter');
        card.hidden = !(selected.includes(card.dataset.panel) && card.style.display !== 'none');
    }
    updateGridVisibleCounts(tab);
    tab.dataset.workspace = next;
    if (changed && !enteringTab && !reducedMotion() && tab.classList.contains('active')) {
        for (const card of cards) {
            if (!card.hidden && card.getClientRects().length)
                card.animate([{opacity:.88},{opacity:1}],
                    {duration:120,easing:'cubic-bezier(.2,.8,.2,1)'});
        }
    }
    document.dispatchEvent(new CustomEvent('vertex:workspace',{detail:{keys:selected}}));
}

/** Every grid records its actual number of visible panels. */
export function updateGridVisibleCounts(scope) {
    const root = scope || document;
    root.querySelectorAll('.grid-layout').forEach(grid => {
        const visible = [...grid.children].filter(el =>
            !el.hidden && getComputedStyle(el).display !== 'none'
        ).length;
        grid.dataset.visiblePanels = String(visible);
        const width = grid.getBoundingClientRect().width || window.innerWidth;
        const maximum = width < 680 ? 1 : width < 1080 ? 2 : width < 1500 ? 3 : 4;
        grid.style.setProperty('--panel-columns', String(Math.max(1, Math.min(visible, maximum))));
    });
}

let adaptiveGridsInitialized = false;
export function initAdaptiveGrids() {
    if (adaptiveGridsInitialized) return;
    adaptiveGridsInitialized = true;
    for(const grid of document.querySelectorAll('.grid-layout')) {
        const observer = new MutationObserver(() => updateGridVisibleCounts(grid.parentElement || document));
        observer.observe(grid,{childList:true,subtree:false});
        // Attribute watches belong to cards, not grids: computed column writes
        // must never trigger their own observer in an endless render loop.
        for(const card of grid.children)observer.observe(card,{
            attributes:true,attributeFilter:['hidden','style']
        });
    }
    window.addEventListener('resize',()=>updateGridVisibleCounts());
    updateGridVisibleCounts();
}
