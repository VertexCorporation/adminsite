import { __, escapeHTML as esc, userErrorMessage, showToast, onLangChange } from '../../utils/ui.js';
import { openModal, closeModal, confirmDialog } from '../../ui/surfaces.js';
import { captureSession, sessionIsCurrent } from '../../core/session.js';
import { saveReportEntry, saveReportTask, deleteReportItem } from '../../services/reportsService.js';
import { reportsStore, loadReportWeek } from '../../stores/reportsStore.js';
const t = (key) => __('reports.' + key);
function input(form, name, label, value = '', type = 'text') {
  const wrap = document.createElement('label');
  wrap.className = 'form-group-field';
  const caption = document.createElement('span');
  caption.dataset.i18n = label;
  caption.textContent = __(label);
  wrap.append(caption);
  const field = document.createElement(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
  field.name = name;
  const limits = {
    title: 180,
    project: 180,
    summary: 6000,
    next: 3000,
    link: 800,
    ref: 800,
    source: 500,
    description: 3500,
  };
  if (limits[name]) field.maxLength = limits[name];
  if (!['textarea', 'select'].includes(type)) field.type = type;
  field.value = value || '';
  wrap.append(field);
  form.append(wrap);
  return field;
}
function select(form, name, label, values, current) {
  const field = input(form, name, label, '', 'select');
  for (const [value, text] of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    field.append(option);
  }
  field.value = current || values[0]?.[0] || '';
  return field;
}
export function openReportEditor(kind, entity) {
  const state = reportsStore.value;
  if (!state?.data?.canEdit) return;
  const session = captureSession(),
    department = state.department,
    week = state.weekStart;
  let alive = true,
    unbindLanguage = () => {};
  const titleKey = 'reports.' + (kind === 'entries' ? 'entryEditor' : 'taskEditor');
  const body = openModal({
      title: __(titleKey),
      titleKey,
      size: 'large',
      onAfterClose() {
        alive = false;
        unbindLanguage();
      },
    }),
    form = document.createElement('form');
  form.className = 'form-stack report-editor';
  body.append(form);
  const draftId = entity?.id || crypto.randomUUID();
  let operationId = crypto.randomUUID();
  const deleteOperationId = crypto.randomUUID();
  let pending = false;
  const previousDisabled = new WeakMap();
  function setPending(value) {
    pending = value;
    form.querySelectorAll('input,textarea,select,button').forEach((control) => {
      if (value) {
        previousDisabled.set(control, control.disabled);
        control.disabled = true;
      } else control.disabled = previousDisabled.get(control) || false;
    });
  }
  if (kind === 'entries') {
    const person = select(
      form,
      'memberId',
      'reports.person',
      state.data.members.map((member) => [member.id, member.name]),
      entity?.memberId,
    );
    person.required = true;
    person.disabled = !!entity;
    const day = input(form, 'date', 'reports.date', entity?.date || week, 'date');
    day.disabled = !!entity;
    day.required = true;
    select(
      form,
      'status',
      'reports.statusLabel',
      ['done', 'plan', 'off', 'noreport'].map((value) => [value, t('status.' + value)]),
      entity?.status,
    );
    input(form, 'project', 'reports.project', entity?.project);
    input(form, 'summary', 'reports.summary', entity?.summary, 'textarea').required = true;
    input(form, 'next', 'reports.next', entity?.next, 'textarea');
    input(form, 'link', 'reports.link', entity?.link, 'url');
    input(form, 'source', 'reports.source', entity?.source);
  } else {
    input(form, 'title', 'reports.taskTitle', entity?.title).required = true;
    input(form, 'project', 'reports.project', entity?.project).required = true;
    input(form, 'description', 'reports.description', entity?.description, 'textarea');
    select(
      form,
      'priority',
      'reports.priorityLabel',
      ['urgent', 'normal', 'low'].map((value) => [value, t('priority.' + value)]),
      entity?.priority || 'normal',
    );
    select(
      form,
      'status',
      'reports.statusLabel',
      ['todo', 'doing', 'done'].map((value) => [value, t('taskStatus.' + value)]),
      entity?.status || 'todo',
    );
    const assignees = select(
      form,
      'assignees',
      'reports.assignees',
      state.data.members.map((member) => [member.id, member.name]),
    );
    assignees.multiple = true;
    for (const option of assignees.options) option.selected = entity?.assignees?.includes(option.value) || false;
    input(form, 'due', 'reports.due', entity?.due, 'date');
    input(form, 'ref', 'reports.link', entity?.ref, 'url');
    input(form, 'source', 'reports.source', entity?.source);
  }
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  form.append(status);
  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'chrome-btn-primary';
  save.dataset.i18n = 'common.save';
  save.textContent = __('common.save');
  form.append(save);
  form.addEventListener('input', () => {
    operationId = crypto.randomUUID();
    status.textContent = '';
  });
  if (entity) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'chrome-btn-danger';
    remove.dataset.i18n = 'common.delete';
    remove.textContent = __('common.delete');
    form.append(remove);
    remove.onclick = async () => {
      if (
        pending ||
        !sessionIsCurrent(session) ||
        !(await confirmDialog({ title: __('common.delete'), body: t('deleteConfirm'), danger: true }))
      )
        return;
      setPending(true);
      try {
        await deleteReportItem(
          { department, kind, id: entity.id, expectedRevision: entity.revision, operationId: deleteOperationId },
          session,
        );
        if (!alive || !sessionIsCurrent(session)) return;
        closeModal();
        await loadReportWeek(department, week, state.view);
      } catch (error) {
        status.textContent = userErrorMessage(error);
        setPending(false);
      }
    };
  }
  unbindLanguage = onLangChange(() => {
    for (const field of form.querySelectorAll('select')) {
      const prefix =
        field.name === 'priority'
          ? 'reports.priority.'
          : field.name === 'status'
            ? kind === 'entries'
              ? 'reports.status.'
              : 'reports.taskStatus.'
            : '';
      if (prefix) for (const option of field.options) option.textContent = __(prefix + option.value);
    }
  });
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (pending || save.disabled || !sessionIsCurrent(session) || !form.reportValidity()) return;
    const input = Object.fromEntries(new FormData(form));
    if (kind === 'entries' && entity) {
      input.memberId = entity.memberId;
      input.date = entity.date;
    }
    if (kind === 'tasks') {
      input.id = draftId;
      input.assignees = [...form.elements.assignees.selectedOptions].map((option) => option.value);
    }
    setPending(true);
    status.dataset.i18n = 'reports.saving';
    status.textContent = t('saving');
    try {
      const payload = {
        department,
        expectedRevision: entity?.revision || 0,
        operationId,
        [kind === 'entries' ? 'entry' : 'task']: input,
      };
      await (kind === 'entries' ? saveReportEntry : saveReportTask)(payload, session);
      if (!alive || !sessionIsCurrent(session)) return;
      closeModal();
      showToast(t('saved'), 'success');
      await loadReportWeek(department, week, state.view);
    } catch (error) {
      status.removeAttribute('data-i18n');
      status.textContent = error.code === 'functions/aborted' ? t('conflict') : userErrorMessage(error);
      setPending(false);
    }
  };
}
