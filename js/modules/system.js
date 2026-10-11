import { __, onLangChange } from '../utils/ui.js';
import { isPanelAdmin, getEffectivePanelLevel } from './roles.js';
const sections={permissions:['dept-perms-manager'],departments:['dept-assign-manager','dept-users-manager'],administrators:['admin-manager','remove-admin-manager','admin-list-manager'],verification:['vertex-status-manager','manual-verify-manager','team-log-manager'],server:['gcs-backup-status','server-status-manager'],attributions:['attributions-manager'],export:['data-exporter-manager']};
export function initSystemSections(){
    const system=document.getElementById('tab-system');
    if(!system)return;
    const grid=system.querySelector('.grid-layout');
    for(const id of ['admin-manager','vertex-status-manager']){const card=document.getElementById(id);if(card)grid.append(card);}
    const nav=document.createElement('nav');nav.className='system-sections';nav.setAttribute('aria-label',__('nav.system'));
    grid.before(nav);
    let selected='permissions';
    function render(){
        const visible=Object.keys(sections).filter(key=>sections[key].some(id=>{const card=document.getElementById(id);return card&&(isPanelAdmin() || (card.dataset.panel&&getEffectivePanelLevel(card.dataset.panel)!=='none'));}));
        if(!visible.includes(selected))selected=visible[0];
        nav.innerHTML=visible.map(key=>`<button type="button" class="filter-chip ${selected===key?'active':''}" data-section="${key}" aria-pressed="${selected===key}">${__('system.'+key)}</button>`).join('');
        for(const [key,ids] of Object.entries(sections))for(const id of ids){const card=document.getElementById(id);if(card)card.hidden=key!==selected;}
        nav.querySelectorAll('button').forEach(button=>button.onclick=()=>{selected=button.dataset.section;render();});
    }
    onLangChange(render);document.addEventListener('vertex:departments',()=>queueMicrotask(render));render();
}
