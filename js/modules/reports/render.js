import { __, getLang, escapeHTML as esc } from '../../utils/ui.js';
import { days, weekSummary } from './domain.js';
const t = (key) => __('reports.' + key);
const label = (day) =>
  new Intl.DateTimeFormat(getLang() === 'tr' ? 'tr-TR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(day + 'T12:00:00Z'));
const status = (value) => t('status.' + value);
function evidenceLink(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
  } catch {
    return '';
  }
  return `<a href="${esc(value)}" target="_blank" rel="noopener noreferrer">${esc(t('evidence'))}</a>`;
}
function entryRows(data, canEdit) {
  return (
    data.entries
      .map(
        (entry) =>
          `<article class="report-record"><header><strong>${esc(entry.personName || t('unknownMember'))}</strong><span>${esc(label(entry.date))} · ${esc(status(entry.status))}</span></header><h4>${esc(entry.project)}</h4><p class="report-copy">${esc(entry.summary)}</p>${entry.next ? `<p class="report-copy report-next">${esc(entry.next)}</p>` : ''}${evidenceLink(entry.link)}${entry.source ? `<p class="form-hint">${esc(entry.source)}</p>` : ''}${canEdit ? `<button type="button" class="chrome-btn-outline" data-report-edit-entry="${esc(entry.id)}">${esc(__('common.edit'))}</button>` : ''}</article>`,
      )
      .join('') || `<p class="state-block">${esc(t('emptyEntries'))}</p>`
  );
}
function overview(data, week) {
  const dates = days(week),
    records = new Map(data.entries.map((entry) => [entry.memberId + '|' + entry.date, entry]));
  return `<div class="report-table-scroll"><table class="report-matrix"><thead><tr><th>${esc(t('person'))}</th>${dates.map((day) => `<th>${esc(label(day))}</th>`).join('')}</tr></thead><tbody>${data.members
    .map(
      (member) =>
        `<tr><th>${esc(member.name || t('unknownMember'))}</th>${dates
          .map((day) => {
            const entry = records.get(member.id + '|' + day);
            return `<td><span class="report-status" data-status="${esc(entry?.status || 'missing')}">${esc(member.joinedAt && day < member.joinedAt ? t('beforeJoining') : status(entry?.status || 'missing'))}</span></td>`;
          })
          .join('')}</tr>`,
    )
    .join('')}</tbody></table></div>`;
}
function tasks(data, canEdit) {
  const all = [...new Map([...data.tasks, ...data.openTasks].map((task) => [task.id, task])).values()],
    members = new Map(data.members.map((member) => [member.id, member.name || t('unknownMember')]));
  return (
    all
      .map(
        (task) =>
          `<article class="report-record"><header><strong>${esc(task.title)}</strong><span>${esc(t('taskStatus.' + task.status))} · ${esc(t('priority.' + task.priority))}</span></header><p>${esc(task.project)}</p><p class="report-copy">${esc(task.description)}</p><p>${esc(task.assignees.map((id) => members.get(id) || t('unknownMember')).join(', '))}</p>${evidenceLink(task.ref)}${task.source ? `<p class="form-hint">${esc(task.source)}</p>` : ''}${task.due ? `<p>${esc(t('due'))}: ${esc(task.due)}</p>` : ''}${canEdit ? `<button type="button" class="chrome-btn-outline" data-report-edit-task="${esc(task.id)}">${esc(__('common.edit'))}</button>` : `<button type="button" class="chrome-btn-outline" data-report-request-task="${esc(task.id)}">${esc(t('requestTask'))}</button>`}</article>`,
      )
      .join('') || `<p class="state-block">${esc(t('emptyTasks'))}</p>`
  );
}
export function renderReportContent(state) {
  const host = document.getElementById('reports-content'),
    heading = document.getElementById('reports-title');
  if (!state) {
    host.replaceChildren();
    return;
  }
  heading.textContent = t('departmentTitle').replace('{department}', state.department);
  document.getElementById('reports-week').value = state.weekStart;
  document.getElementById('reports-view-title').textContent = t('view.' + state.view);
  const canEdit = state.data?.canEdit === true;
  document.getElementById('reports-new-entry').hidden = !canEdit;
  document.getElementById('reports-new-task').hidden = !canEdit;
  document.getElementById('reports-access-note').textContent = t(canEdit ? 'editAccess' : 'readAccess');
  host.setAttribute('aria-busy', String(state.loading));
  if (state.loading) {
    host.innerHTML = `<p class="state-block">${esc(__('common.loading'))}</p>`;
    return;
  }
  if (state.error) {
    host.innerHTML = `<p class="state-block">${esc(t('loadError'))}</p><button type="button" class="chrome-btn-outline" data-report-retry>${esc(__('common.retry'))}</button>`;
    return;
  }
  const data = state.data,
    summary = weekSummary(data, state.weekStart);
  if (state.view === 'overview') host.innerHTML = overview(data, state.weekStart);
  if (state.view === 'daily') host.innerHTML = entryRows(data, canEdit);
  if (state.view === 'people')
    host.innerHTML = data.members
      .map(
        (member) =>
          `<section class="report-person"><h3>${esc(member.name || t('unknownMember'))}</h3>${entryRows({ ...data, entries: data.entries.filter((entry) => entry.memberId === member.id) }, canEdit)}</section>`,
      )
      .join('');
  if (state.view === 'tasks')
    host.innerHTML = `<p class="form-hint">${esc(t('taskListHint'))}</p>` + tasks(data, canEdit);
  if (state.view === 'weekly')
    host.innerHTML =
      `<div class="report-stats">${[
        ['reportsCount', summary.reported],
        ['workCount', summary.work],
        ['tasksCreated', summary.created],
        ['tasksCompleted', summary.completed],
      ]
        .map(([key, value]) => `<div><span>${esc(t(key))}</span><strong>${value}</strong></div>`)
        .join('')}</div><p class="form-hint">${esc(t('weekMetricsHint'))}</p>` +
      entryRows({ ...data, entries: summary.entries }, canEdit) +
      `<h3>${esc(t('weekTasks'))}</h3>` +
      tasks({ ...data, tasks: summary.tasks, openTasks: [] }, canEdit);
}
export function exportReport(state) {
  if (!state?.data) return;
  const summary = weekSummary(state.data, state.weekStart);
  const header = [
    t('departmentTitle').replace('{department}', state.department),
    state.weekStart,
    t('tasksCreated') + ': ' + summary.created,
    t('tasksCompleted') + ': ' + summary.completed,
  ];
  const entries = summary.entries.map((entry) =>
    [
      entry.date,
      entry.personName || t('unknownMember'),
      status(entry.status),
      entry.project,
      entry.summary,
      entry.next,
      entry.link,
      entry.source,
    ]
      .filter(Boolean)
      .join('\n'),
  );
  const taskLines = summary.tasks.map((task) => [task.title, task.project, t('taskStatus.' + task.status)].join(' · '));
  const blob = new Blob(['\ufeff' + [...header, '', ...entries, '', t('weekTasks'), ...taskLines].join('\n\n')], {
      type: 'text/plain;charset=utf-8',
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `${state.department}-${state.weekStart}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
