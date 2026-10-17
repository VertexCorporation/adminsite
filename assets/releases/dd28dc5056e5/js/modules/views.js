import { getEffectivePanelLevel } from './roles.js';
// Hide existing workspaces, never replace forms or their event listeners.
export function showWorkspace(tab, keys) {
    if(!tab || tab.id==='tab-system')return;
    const cards=[...tab.querySelectorAll('.panel-card[data-panel]')];
    const selected=keys.filter(key=>getEffectivePanelLevel(key)!=='none');
    for(const card of cards){const show=selected.includes(card.dataset.panel)&&card.style.display!=='none';const was=card.hidden;card.hidden=!show;if(show&&was){card.classList.remove('workspace-enter');void card.offsetWidth;card.classList.add('workspace-enter');}}
    tab.dataset.workspace=selected.join(',');document.dispatchEvent(new CustomEvent('vertex:workspace',{detail:{keys:selected}}));
}
