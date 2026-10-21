import { __, onLangChange } from '../utils/ui.js';
import { isPanelAdmin, getEffectivePanelLevel } from './roles.js';
const sections={permissions:['dept-perms-manager'],departments:['dept-assign-manager','dept-users-manager'],verification:['manual-verify-manager','team-log-manager','team-cards-manager'],server:['gcs-backup-status','server-status-manager'],attributions:['attributions-manager'],export:['data-exporter-manager','attributions-manager']};
export function initSystemSections(){
    const system=document.getElementById('tab-system');
    if(!system)return;
    const grid=system.querySelector('.grid-layout');
    const nav=document.createElement('nav');nav.className='system-sections';nav.hidden=true;nav.setAttribute('aria-label',__('nav.system'));
    grid.before(nav);
    let selected='permissions';
    function render(){
        const visible=Object.keys(sections).filter(key=>sections[key].some(id=>{const card=document.getElementById(id);return card&&(isPanelAdmin() || (card.dataset.panel&&getEffectivePanelLevel(card.dataset.panel)!=='none'));}));
        if(!visible.includes(selected))selected=visible[0];
        nav.innerHTML=visible.map(key=>`<button type="button" class="filter-chip ${selected===key?'active':''}" data-section="${key}" aria-pressed="${selected===key}">${__('system.'+key)}</button>`).join('');
        const selectedIds=new Set(sections[selected] || []);
        for(const id of new Set(Object.values(sections).flat())){const card=document.getElementById(id);if(card){const show=selectedIds.has(id);const changed=card.hidden;card.hidden=!show;if(show&&changed){card.classList.remove('workspace-enter');void card.offsetWidth;card.classList.add('workspace-enter');}}}
        document.querySelectorAll('[data-nav-module=system] .sidebar-sub-btn').forEach(button=>{if(button.dataset.navAction===selected || (button.dataset.navAction==='export' && selected==='attributions'))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
        system.dataset.activeSection=selected || '';document.dispatchEvent(new CustomEvent('vertex:workspace',{detail:{keys:(sections[selected]||[]).map(id=>document.getElementById(id)?.dataset.panel).filter(Boolean)}}));document.dispatchEvent(new CustomEvent('vertex:system-page',{detail:selected}));
        nav.querySelectorAll('button').forEach(button=>button.onclick=()=>{selected=button.dataset.section;document.querySelector(`[data-nav-action="${selected}"]`)?.click();render();});
    }
    document.addEventListener('vertex:system-section', event => {if(sections[event.detail]){selected=event.detail;render();}});
    onLangChange(render);document.addEventListener('vertex:departments',()=>queueMicrotask(render));render();
}
