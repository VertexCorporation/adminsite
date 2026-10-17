import { getEffectivePanelLevel } from './roles.js';
import { crossfade } from '../ui/transition.js';
// Hide existing workspaces, never replace forms or their event listeners.
export function showWorkspace(tab, keys) {
    if(!tab || tab.id==='tab-system')return;
    const cards=[...tab.querySelectorAll('.panel-card[data-panel]')];
    const selected=keys.filter(key=>getEffectivePanelLevel(key)!=='none');
    const next = selected.join(',');
    const update = () => {
        for (const card of cards) {
            const show = selected.includes(card.dataset.panel) && card.style.display !== 'none';
            const was = card.hidden;
            card.hidden = !show;
            if (show && was) {
                card.classList.remove('workspace-enter');
                card.classList.add('workspace-enter');
            }
        }
        updateGridVisibleCounts(tab);
    };
    // Preserve live DOM, listeners, focus and form state. Crossfade is visual-only.
    const host = tab.querySelector('.grid-layout');
    if (host && tab.dataset.workspace && tab.dataset.workspace !== next) crossfade(host, update, {duration:180});
    else update();
    tab.dataset.workspace = next;
    document.dispatchEvent(new CustomEvent('vertex:workspace',{detail:{keys:selected}}));
}

/** Her grid-layout için görünür (hidden olmayan) panel sayısını yazar. */
export function updateGridVisibleCounts(scope) {
    const root = scope || document;
    root.querySelectorAll('.grid-layout').forEach(grid => {
        const visible = [...grid.children].filter(el =>
            !el.hidden &&
            getComputedStyle(el).display !== 'none'
        ).length;
        grid.dataset.visiblePanels = String(visible);
    });
}
