import { getCurrentUserAccess } from './roles.js';
import { PERMISSION_DEPARTMENTS } from '../core/permissionCatalog.js';
import { __, onLangChange, escapeHTML as esc, showToast, userErrorMessage } from '../utils/ui.js';
import { captureSession } from '../core/session.js';
import { reportsStore, loadReportWeek, selectReportView } from '../stores/reportsStore.js';
import { requestReportTask } from '../services/reportsService.js';
import { monday, addDays, reportViews } from './reports/domain.js';
import { renderReportContent, exportReport } from './reports/render.js';
import { openReportEditor } from './reports/editor.js';
const t = (key) => __('reports.' + key);
let selectedDepartment = '',
  selectedView = 'overview',
  week = monday();
function renderNavigation() {
  const access = getCurrentUserAccess(),
    departments = access.isCore ? PERMISSION_DEPARTMENTS : access.departments;
  const host = document.querySelector('#nav-sub-reports .sidebar-submenu-inner');
  host.innerHTML = departments
    .map(
      (department) =>
        `<div class="report-department-group"><button type="button" class="sidebar-sub-btn report-department-toggle" data-nav-panel="reports.workspace" data-nav-action="${department}:overview" data-report-department="${department}" aria-expanded="${department === selectedDepartment}" aria-controls="report-nav-${department}">${esc(t('departmentTitle').replace('{department}', department))}</button><div class="report-section-list" id="report-nav-${department}" ${department === selectedDepartment ? '' : 'hidden'}>${reportViews.map((view) => `<button type="button" class="sidebar-sub-btn" data-nav-panel="reports.workspace" data-nav-action="${department}:${view}">${esc(t('view.' + view))}</button>`).join('')}</div></div>`,
    )
    .join('');
  host.closest('.nav-module').hidden = !departments.length;
}
export function initReportsModule() {
  renderNavigation();
  reportsStore.subscribe(() => renderReportContent(reportsStore.value));
  document.addEventListener('vertex:access-changed', () => {
    selectedDepartment = '';
    selectedView = 'overview';
    renderNavigation();
  });
  onLangChange(() => {
    document.querySelectorAll('#nav-sub-reports [data-nav-action]').forEach((button) => {
      const [department, view] = button.dataset.navAction.split(':');
      button.textContent = button.hasAttribute('data-report-department')
        ? t('departmentTitle').replace('{department}', department)
        : t('view.' + view);
    });
    renderReportContent(reportsStore.value);
  });
  document.addEventListener('vertex:workspace', (event) => {
    if (!event.detail?.keys?.includes('reports.workspace')) return;
    const [department, view = 'overview'] = String(event.detail.action || '').split(':');
    const access = getCurrentUserAccess();
    if (!PERMISSION_DEPARTMENTS.includes(department) || (!access.isCore && !access.departments.includes(department)))
      return;
    if (!reportViews.includes(view)) return;
    const changed = selectedDepartment !== department;
    selectedDepartment = department;
    selectedView = view;
    document.querySelectorAll('.report-department-toggle').forEach((button) => {
      const open = button.dataset.reportDepartment === department;
      button.setAttribute('aria-expanded', String(open));
      document.getElementById('report-nav-' + button.dataset.reportDepartment).hidden = !open;
    });
    if (changed || !reportsStore.value) void loadReportWeek(department, week, view);
    else selectReportView(view);
  });
  const changeWeek = (next) => {
    week = monday(next);
    if (selectedDepartment) void loadReportWeek(selectedDepartment, week, selectedView);
  };
  document.getElementById('reports-week').onchange = (event) => changeWeek(event.target.value);
  document.getElementById('reports-prev-week').onclick = () => changeWeek(addDays(week, -7));
  document.getElementById('reports-next-week').onclick = () => changeWeek(addDays(week, 7));
  document.getElementById('reports-new-entry').onclick = () => openReportEditor('entries');
  document.getElementById('reports-new-task').onclick = () => openReportEditor('tasks');
  document.getElementById('reports-export').onclick = () => exportReport(reportsStore.value);
  document.getElementById('reports-content').onclick = async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const state = reportsStore.value;
    if (!state?.data && !button.hasAttribute('data-report-retry')) return;
    if (button.hasAttribute('data-report-retry')) return loadReportWeek(selectedDepartment, week, selectedView);
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
