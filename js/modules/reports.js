import { getCurrentUserAccess } from './roles.js';
import { PERMISSION_DEPARTMENTS } from '../core/permissionCatalog.js';
import { __, onLangChange, escapeHTML as esc, showToast, userErrorMessage } from '../utils/ui.js';
import { captureSession, sessionIsCurrent, onSessionReset } from '../core/session.js';
import { consolePeopleCall } from '../core/firebase.js';
import { reportsStore, loadReportWeek, selectReportView } from '../stores/reportsStore.js';
import { requestReportTask } from '../services/reportsService.js';
import { monday, addDays, reportViews, reportDepartment, reportDepartments } from './reports/domain.js';
import { renderReportContent, exportReport } from './reports/render.js';
import { openReportEditor } from './reports/editor.js';
import {
  openGovernanceView,
  leaveGovernanceView,
  openChiefReportEditor,
  openMemberReportReview,
} from './reports/governance.js';
import { downloadReportBackup, openReportRestore } from './reports/backup.js';
const t = (key) => __('reports.' + key);
let expandedDepartment = '',
  selectedDepartment = '',
  selectedView = 'overview',
  week = monday(),
  cooAccess = false;
async function detectCooAccess() {
  const access = getCurrentUserAccess();
  if (!access.departments.length || access.isCore || access.departments.includes('Senatus')) return;
  const token = captureSession();
  try {
    const result = await consolePeopleCall('getGovernanceAccess', {});
    if (sessionIsCurrent(token) && result.data?.isCoo) {
      cooAccess = true;
      renderNavigation();
    }
  } catch {
    // Backend authorization, not this navigation, controls access.
  }
}
function renderNavigation() {
  const access = getCurrentUserAccess(),
    departments = reportDepartments(access, PERMISSION_DEPARTMENTS);
  const host = document.querySelector('#nav-sub-reports .sidebar-submenu-inner');
  const special = [
    ...(access.isCore ? ['ceo'] : []),
    ...(access.isCore || cooAccess || access.departments.includes('Senatus') ? ['senatus'] : []),
  ];
  host.innerHTML =
    special
      .map(
        (view) =>
          '<button type="button" class="sidebar-sub-btn" data-nav-panel="reports.workspace" data-nav-action="governance:' +
          view +
          '">' +
          esc(t(view === 'ceo' ? 'ceoOversight' : 'senatusOversight')) +
          '</button>',
      )
      .join('') +
    departments
      .map(
        (department) =>
          `<div class="report-department-group"><button type="button" class="sidebar-sub-btn report-department-toggle" data-nav-panel="reports.workspace" data-nav-action="${department}:overview" data-report-department="${department}" aria-expanded="${department === expandedDepartment}" aria-controls="report-nav-${department}">${esc(t('departmentTitle').replace('{department}', department))}</button><div class="report-section-list" id="report-nav-${department}" ${department === expandedDepartment ? '' : 'inert'}><div class="report-section-clip"><div class="report-section-inner">${reportViews.map((view) => `<button type="button" class="sidebar-sub-btn" data-nav-panel="reports.workspace" data-nav-action="${department}:${view}">${esc(t('view.' + view))}</button>`).join('')}</div></div></div></div>`,
      )
      .join('');
  host.closest('.nav-module').hidden = !departments.length;
}
function expandDepartment(department) {
  expandedDepartment = department;
  document.querySelectorAll('.report-department-toggle').forEach((button) => {
    const open = button.dataset.reportDepartment === department;
    button.setAttribute('aria-expanded', String(open));
    document.getElementById('report-nav-' + button.dataset.reportDepartment).inert = !open;
  });
}
export function initReportsModule() {
  renderNavigation();
  void detectCooAccess();
  document.getElementById('nav-sub-reports').addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-report-department]');
    if (!event.isTrusted || !toggle || toggle.getAttribute('aria-expanded') !== 'true') return;
    event.preventDefault();
    event.stopPropagation();
    expandDepartment('');
  });
  reportsStore.subscribe(() => {
    if (selectedDepartment) renderReportContent(reportsStore.value);
  });
  onSessionReset(() => {
    const action = selectedDepartment ? selectedDepartment + ':' + selectedView : 'governance:' + selectedView;
    queueMicrotask(() => {
      if (!document.querySelector('#tab-reports.active')) return;
      const destination = [...document.querySelectorAll('#nav-sub-reports [data-nav-action]')].find(
        (button) => button.dataset.navAction === action && !button.hidden,
      );
      destination?.click();
    });
  });
  document.addEventListener('vertex:access-changed', () => {
    expandedDepartment = '';
    selectedDepartment = '';
    selectedView = 'overview';
    leaveGovernanceView();
    cooAccess = false;
    renderNavigation();
    void detectCooAccess();
  });
  onLangChange(() => {
    document.querySelectorAll('#nav-sub-reports [data-nav-action]').forEach((button) => {
      const [department, view] = button.dataset.navAction.split(':');
      button.textContent =
        department === 'governance'
          ? t(view === 'ceo' ? 'ceoOversight' : 'senatusOversight')
          : button.hasAttribute('data-report-department')
            ? t('departmentTitle').replace('{department}', department)
            : t('view.' + view);
    });
    if (selectedDepartment) renderReportContent(reportsStore.value);
    else if (selectedView === 'ceo' || selectedView === 'senatus') void openGovernanceView(selectedView, week);
  });
  document.addEventListener('vertex:workspace', (event) => {
    if (!event.detail?.keys?.includes('reports.workspace')) return;
    const [requested, view = 'overview'] = String(event.detail.action || '').split(':');
    if (requested === 'governance' && ['ceo', 'senatus'].includes(view)) {
      const access = getCurrentUserAccess();
      if (!(access.isCore || cooAccess || access.departments.includes('Senatus'))) return;
      selectedDepartment = '';
      selectedView = view;
      expandDepartment('');
      void openGovernanceView(view, week);
      return;
    }
    leaveGovernanceView();
    const department = reportDepartment(requested);
    const access = getCurrentUserAccess();
    if (!reportDepartments(access, PERMISSION_DEPARTMENTS).includes(department)) return;
    if (!reportViews.includes(view)) return;
    const changed = selectedDepartment !== department;
    selectedDepartment = department;
    selectedView = view;
    expandDepartment(department);
    if (changed || !reportsStore.value) void loadReportWeek(department, week, view);
    else selectReportView(view);
  });
  const changeWeek = (next) => {
    week = monday(next);
    if (selectedDepartment) void loadReportWeek(selectedDepartment, week, selectedView);
    else if (['ceo', 'senatus'].includes(selectedView)) void openGovernanceView(selectedView, week);
  };
  document.getElementById('reports-week').onchange = (event) => changeWeek(event.target.value);
  document.getElementById('reports-prev-week').onclick = () => changeWeek(addDays(week, -7));
  document.getElementById('reports-next-week').onclick = () => changeWeek(addDays(week, 7));
  document.getElementById('reports-new-entry').onclick = () => openReportEditor('entries');
  document.getElementById('reports-new-task').onclick = () => openReportEditor('tasks');
  document.getElementById('reports-chief-report').onclick = () => openChiefReportEditor(reportsStore.value);
  document.getElementById('reports-export').onclick = () => exportReport(reportsStore.value);
  document.getElementById('reports-backup').onclick = () => downloadReportBackup(reportsStore.value);
  document.getElementById('reports-restore').onclick = () => openReportRestore(reportsStore.value);
  document.getElementById('reports-content').onclick = async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const state = reportsStore.value;
    if (!state?.data && !button.hasAttribute('data-report-retry')) return;
    if (button.hasAttribute('data-report-retry')) return loadReportWeek(selectedDepartment, week, selectedView);
    if (button.dataset.reportReviewEntry)
      openMemberReportReview(
        state,
        state.data.entries.find((entry) => entry.id === button.dataset.reportReviewEntry),
      );
    if (button.dataset.reportEditEntry)
      openReportEditor(
        'entries',
        state.data.entries.find((entry) => entry.id === button.dataset.reportEditEntry),
      );
    if (button.dataset.reportEditTask)
      openReportEditor(
        'tasks',
        [...state.data.tasks, ...state.data.openTasks].find((task) => task.id === button.dataset.reportEditTask),
      );
    if (button.dataset.reportRequestTask) {
      button.disabled = true;
      try {
        await requestReportTask(
          { department: state.department, taskId: button.dataset.reportRequestTask },
          captureSession(),
        );
        showToast(t('requestSent'), 'success');
      } catch (error) {
        showToast(userErrorMessage(error), 'error');
      } finally {
        button.disabled = false;
      }
    }
  };
}
