import { __, showToast, userErrorMessage } from '../../utils/ui.js';
import { openModal, closeModal } from '../../ui/surfaces.js';
import { captureSession, sessionIsCurrent } from '../../core/session.js';
import { getReportBackup, saveReportEntry, saveReportTask } from '../../services/reportsService.js';
import { loadReportWeek, reportsStore } from '../../stores/reportsStore.js';
import { createBackup, planRestore } from './backupData.js';
const t = (key) => __('reports.' + key);
const counts = (key, done, total) => t(key).replace('{done}', done).replace('{total}', total);
export async function downloadReportBackup(state) {
  if (!state?.data) return;
  const token = captureSession(),
    button = document.getElementById('reports-backup');
  button.disabled = true;
  showToast(t('backupBusy'));
  try {
    const data = await getReportBackup(state.department, token);
    if (!sessionIsCurrent(token)) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(createBackup(data), null, 2)], { type: 'application/json;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${state.department}-reports-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    button.closest('details').open = false;
  } catch (error) {
    if (sessionIsCurrent(token)) showToast(userErrorMessage(error), 'error');
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}
export function openReportRestore(state) {
  if (!state?.data?.canEdit) return;
  const token = captureSession();
  let alive = true,
    plan = null,
    pending = false,
    selection = 0;
  const body = openModal({
    title: t('restore'),
    titleKey: 'reports.restore',
    size: 'large',
    onAfterClose() {
      alive = false;
    },
  });
  const hint = document.createElement('p');
  hint.className = 'form-hint';
  hint.dataset.i18n = 'reports.restoreHint';
  hint.textContent = t('restoreHint');
  const label = document.createElement('label');
  label.className = 'form-group-field';
  const caption = document.createElement('span');
  caption.dataset.i18n = 'reports.backupFile';
  caption.textContent = t('backupFile');
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'chrome-btn-primary';
  save.dataset.i18n = 'reports.restoreConfirm';
  save.textContent = t('restoreConfirm');
  save.disabled = true;
  label.append(caption, file);
  body.append(hint, label, status, save);
  file.onchange = async () => {
    const version = ++selection;
    plan = null;
    save.disabled = true;
    status.textContent = '';
    const chosen = file.files?.[0];
    if (!chosen) return;
    try {
      if (chosen.size > 10 * 1024 * 1024) throw { backupCode: 'backupInvalid' };
      let raw;
      try {
        raw = JSON.parse(await chosen.text());
      } catch {
        throw { backupCode: 'backupInvalid' };
      }
      const current = await getReportBackup(state.department, token);
      if (!alive || version !== selection || !sessionIsCurrent(token)) return;
      if (!current.canEdit) throw { backupCode: 'readAccess' };
      const next = await planRestore(raw, current);
      if (!alive || version !== selection || !sessionIsCurrent(token)) return;
      plan = next;
      status.textContent = t('restorePreview')
        .replace('{entries}', plan.filter((row) => row.kind === 'entries').length)
        .replace('{tasks}', plan.filter((row) => row.kind === 'tasks').length);
      save.disabled = false;
    } catch (error) {
      if (alive && version === selection && sessionIsCurrent(token))
        status.textContent = error.backupCode ? t(error.backupCode) : userErrorMessage(error);
    }
  };
  save.onclick = async () => {
    if (!plan || pending || !alive || !sessionIsCurrent(token)) return;
    pending = true;
    save.disabled = true;
    file.disabled = true;
    let done = 0;
    const total = plan.length;
    try {
      for (const operation of plan) {
        if (!alive || !sessionIsCurrent(token)) throw new Error('REPORT_RESTORE_CANCELLED');
        const payload = {
          department: state.department,
          expectedRevision: operation.expectedRevision,
          operationId: crypto.randomUUID(),
          [operation.kind === 'entries' ? 'entry' : 'task']: operation.input,
          ...(operation.kind === 'tasks' ? { restore: true } : {}),
        };
        await (operation.kind === 'entries' ? saveReportEntry : saveReportTask)(payload, token);
        done++;
        if (alive) status.textContent = counts('restoreProgress', done, total);
      }
      if (alive && sessionIsCurrent(token)) {
        closeModal();
        showToast(t('restored'), 'success');
      }
    } catch {
      if (sessionIsCurrent(token)) {
        if (alive) status.textContent = counts('restoreFailed', done, total);
        else showToast(counts('restoreFailed', done, total), 'error');
      }
    } finally {
      plan = null;
      pending = false;
      file.disabled = false;
      file.value = '';
      const current = reportsStore.value;
      if (sessionIsCurrent(token) && current?.department === state.department && current.weekStart === state.weekStart)
        await loadReportWeek(state.department, state.weekStart, current.view);
    }
  };
}
