import {getCurrentUserAccess,getEffectivePanelLevel} from './roles.js';

const DEPARTMENTS=['Core','Senatus','Tensor','Curia','Pulse','Chroma','Catalyst','Envoy','Aero','Array'];

function departmentsFor(access){
    return access.isCore?DEPARTMENTS:[...new Set(access.departments||[])].filter(item=>DEPARTMENTS.includes(item));
}
function openDepartment(department){
    const frame=document.getElementById('reports-frame');
    if(!frame)return;
    const target='/reports/index.html?department='+encodeURIComponent(department);
    if(frame.getAttribute('src')!==target)frame.setAttribute('src',target);
    frame.dataset.department=department;
}
function renderReportNavigation(){
    const container=document.querySelector('#nav-sub-reports .sidebar-submenu-inner');
    if(!container)return;
    const level=getEffectivePanelLevel('reports.workspace');
    const departments=level==='none'?[]:departmentsFor(getCurrentUserAccess());
    container.innerHTML=departments.map(department=>`<button type="button" class="sidebar-sub-btn" data-nav-panel="reports.workspace" data-nav-action="${department}" data-report-department="${department}">Rapor tablosu ${department}</button>`).join('');
    container.querySelectorAll('[data-report-department]').forEach(button=>button.addEventListener('click',()=>openDepartment(button.dataset.reportDepartment)));
    const module=container.closest('.nav-module');
    module.hidden=!departments.length;
    if(departments.length&&!document.getElementById('reports-frame')?.dataset.department)openDepartment(departments[0]);
}

export function initReportsModule(){
    renderReportNavigation();
    document.addEventListener('vertex:access-changed',renderReportNavigation);
    document.addEventListener('vertex:permissions-updated',renderReportNavigation);
    document.addEventListener('vertex:departments',renderReportNavigation);
}

