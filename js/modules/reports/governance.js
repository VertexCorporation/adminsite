import { consolePeopleCall } from '../../core/firebase.js';
import { captureSession, sessionIsCurrent } from '../../core/session.js';
import { openModal, closeModal } from '../../ui/surfaces.js';
import { __, userErrorMessage, showToast } from '../../utils/ui.js';
import { loadReportWeek } from '../../stores/reportsStore.js';

const t = (key) => __('reports.' + key);
const byId = (id) => document.getElementById(id);
let requestId = 0,
  active = null;
function el(tag, text = '', className = '') {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function button(text, action, className = 'chrome-btn-outline') {
  const node = el('button', text, className);
  node.type = 'button';
  node.onclick = action;
  return node;
}
function line(parent, title, value) {
  if (!value) return;
  const row = el('p', '', 'report-copy');
  const strong = el('strong', title + ': ');
  row.append(strong, document.createTextNode(String(value)));
  parent.append(row);
}
function evidence(parent, value) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return;
    const anchor = el('a', t('evidence'), 'chrome-btn-outline');
    anchor.href = value;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    parent.append(anchor);
  } catch {
    /* Ignore invalid legacy links. */
  }
}
function field(form, key, label, value = '', type = 'textarea', required = false) {
  const wrap = el('label', '', 'form-group-field');
  wrap.append(el('span', label));
  const control = document.createElement(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
  control.name = key;
  if (type !== 'textarea' && type !== 'select') control.type = type;
  control.value = value || '';
  control.required = required;
  const max = {
    summary: 6000,
    achievements: 6000,
    blockers: 4000,
    next: 4000,
    title: 180,
    finding: 6000,
    action: 4000,
    note: 2500,
    evidence: 800,
  };
  if (max[key]) control.maxLength = max[key];
  if (type === 'textarea') control.rows = 3;
  wrap.append(control);
  form.append(wrap);
  return control;
}
function selection(form, key, label, options, value) {
  const input = field(form, key, label, '', 'select', true);
  for (const [code, description] of options) {
    const opt = el('option', description);
    opt.value = code;
    input.append(opt);
  }
  input.value = value || options[0][0];
  return input;
}
function editor(title, fields, submit) {
  const body = openModal({ title, size: 'large' });
  const form = el('form', '', 'form-stack report-editor');
  body.append(form);
  fields(form);
  const status = el('p');
  status.setAttribute('role', 'status');
  const save = el('button', __('common.save'), 'chrome-btn-primary');
  save.type = 'submit';
  form.append(status, save);
  let pending = false;
  const session = captureSession();
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (pending || !sessionIsCurrent(session) || !form.reportValidity()) return;
    pending = true;
    save.disabled = true;
    status.textContent = t('saving');
    try {
      const payload = Object.fromEntries(new FormData(form));
      await submit(payload);
      if (!sessionIsCurrent(session)) return;
      closeModal();
      showToast(t('saved'), 'success');
    } catch (error) {
      status.textContent = error.code === 'functions/aborted' ? t('conflict') : userErrorMessage(error);
      save.disabled = false;
      pending = false;
    }
  };
}
function getCurrentWeek(day) {
  const date = new Date(day + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime())) return day;
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
async function call(name, input) {
  return (await consolePeopleCall(name, input)).data;
}
export function leaveGovernanceView() {
  requestId++;
  active = null;
}
export async function openChiefReportEditor(state) {
  if (!state?.data?.canSubmitLeadership) return;
  const department = state.department,
    weekStart = getCurrentWeek(state.weekStart);
  const session = captureSession();
  let data;
  try {
    data = await call('getGovernanceOverview', { department, weekStart });
  } catch (error) {
    if (sessionIsCurrent(session)) showToast(userErrorMessage(error), 'error');
    return;
  }
  if (!sessionIsCurrent(session) || !data.records?.[0]?.canSubmit) return;
  const current = data.records[0].report || {};
  editor(
    t('chiefReport') + ' · ' + department,
    (form) => {
      field(form, 'summary', t('chiefSummary'), current.summary, 'textarea', true);
      field(form, 'achievements', t('chiefAchievements'), current.achievements);
      field(form, 'blockers', t('chiefBlockers'), current.blockers);
      field(form, 'next', t('chiefNext'), current.next);
      field(form, 'evidence', t('evidence'), current.evidence, 'url');
    },
    async (values) => {
      await call('saveLeadershipReport', { department, weekStart, ...values, expectedRevision: current.revision || 0 });
      await loadReportWeek(department, weekStart, state.view);
    },
  );
}
export function openMemberReportReview(state, entry) {
  if (!state?.data?.canEdit || !entry) return;
  const previous = (state.data.entryReviews || []).find((review) => review.id === entry.id) || {};
  editor(
    t('reviewEntry') + ' · ' + (entry.personName || ''),
    (form) => {
      selection(
        form,
        'decision',
        t('reviewDecision'),
        [
          ['approved', t('approved')],
          ['changes_requested', t('changesRequested')],
        ],
        previous.decision,
      );
      field(form, 'note', t('reviewNote'), previous.note);
    },
    async (values) => {
      if (values.decision === 'changes_requested' && !values.note.trim()) throw new Error(t('reviewNoteRequired'));
      await call('reviewReportEntry', {
        department: state.department,
        entryId: entry.id,
        expectedEntryRevision: entry.revision,
        expectedRevision: previous.revision || 0,
        ...values,
      });
      await loadReportWeek(state.department, state.weekStart, state.view);
    },
  );
}
function reviewChief(record, start) {
  const original = record.report;
  if (!original) return;
  editor(
    t('reviewChief') + ' · ' + record.department,
    (form) => {
      selection(
        form,
        'decision',
        t('reviewDecision'),
        [
          ['approved', t('approved')],
          ['changes_requested', t('changesRequested')],
        ],
        'approved',
      );
      field(form, 'note', t('reviewNote'));
    },
    async (values) => {
      if (values.decision === 'changes_requested' && !values.note.trim()) throw new Error(t('reviewNoteRequired'));
      await call('reviewLeadershipReport', {
        department: record.department,
        weekStart: start,
        expectedRevision: original.revision,
        ...values,
      });
      await refresh();
    },
  );
}
function auditEditor(record, start, audit = null) {
  const stableId = audit?.id || crypto.randomUUID();
  editor(
    t('auditEditor') + ' · ' + record.department,
    (form) => {
      field(form, 'title', t('auditTitle'), audit?.title, 'text', true);
      field(form, 'finding', t('auditFinding'), audit?.finding, 'textarea', true);
      field(form, 'action', t('auditAction'), audit?.action);
      field(form, 'evidence', t('evidence'), audit?.evidence, 'url');
      selection(
        form,
        'severity',
        t('auditSeverity'),
        [
          ['low', t('severityLow')],
          ['medium', t('severityMedium')],
          ['high', t('severityHigh')],
        ],
        audit?.severity,
      );
      selection(
        form,
        'findingStatus',
        t('auditStatus'),
        [
          ['open', t('auditOpen')],
          ['following', t('auditFollowing')],
          ['resolved', t('auditResolved')],
        ],
        audit?.findingStatus,
      );
    },
    async (values) => {
      await call('saveSenatusAudit', {
        department: record.department,
        weekStart: start,
        id: stableId,
        expectedRevision: audit?.revision || 0,
        ...values,
      });
      await refresh();
    },
  );
}
function reviewAudit(record, audit) {
  editor(
    t('reviewAudit') + ' · ' + record.department,
    (form) => {
      selection(
        form,
        'decision',
        t('reviewDecision'),
        [
          ['approved', t('approved')],
          ['changes_requested', t('changesRequested')],
        ],
        'approved',
      );
      field(form, 'note', t('reviewNote'));
    },
    async (values) => {
      if (values.decision === 'changes_requested' && !values.note.trim()) throw new Error(t('reviewNoteRequired'));
      await call('reviewSenatusAudit', {
        department: record.department,
        id: audit.id,
        expectedRevision: audit.revision,
        ...values,
      });
      await refresh();
    },
  );
}
async function showEvidence(department, start) {
  const body = openModal({ title: t('evidenceFor') + ' · ' + department, size: 'large' });
  const host = el('div', t('loadingEvidence'));
  body.append(host);
  const session = captureSession();
  let cursors = {};
  async function more() {
    host.querySelector('[data-more-evidence]')?.remove();
    try {
      const data = await call('getGovernanceEvidence', { department, weekStart: start, cursors });
      if (!sessionIsCurrent(session) || !host.isConnected) return;
      if (!Object.keys(cursors).length) host.replaceChildren();
      for (const entry of data.entries || []) {
        const item = el('article', '', 'report-record');
        line(item, entry.date, entry.personName || entry.memberId);
        line(item, t('chiefSummary'), entry.summary);
        evidence(item, entry.link);
        host.append(item);
      }
      for (const task of data.tasks || []) {
        const item = el('article', '', 'report-record');
        line(item, t('taskTitle'), task.title);
        line(item, t('auditStatus'), task.status);
        line(item, t('description'), task.description);
        evidence(item, task.ref);
        host.append(item);
      }
      cursors = Object.fromEntries(Object.entries(data.cursors || {}).map(([k, v]) => [k, v || false]));
      if (Object.values(cursors).some(Boolean)) {
        const next = button(t('moreEvidence'), more);
        next.dataset.moreEvidence = '';
        host.append(next);
      } else if (!host.children.length) host.append(el('p', t('emptyEntries')));
    } catch (error) {
      if (host.isConnected && sessionIsCurrent(session)) host.append(el('p', userErrorMessage(error)));
    }
  }
  void more();
}
function badge(text) {
  return el('span', text, 'form-hint');
}
function showAudit(parent, record, audit, data) {
  const item = el('article', '', 'report-record');
  const header = el('header');
  header.append(
    el('strong', audit.title),
    badge(
      t('severity' + audit.severity[0].toUpperCase() + audit.severity.slice(1)) +
        ' · ' +
        t('audit' + audit.findingStatus[0].toUpperCase() + audit.findingStatus.slice(1)),
    ),
  );
  item.append(header);
  line(item, t('auditFinding'), audit.finding);
  line(item, t('auditAction'), audit.action);
  evidence(item, audit.evidence);
  line(
    item,
    t('reviewDecision'),
    audit.review?.decision
      ? t(audit.review.decision === 'approved' ? 'approved' : 'changesRequested')
      : t('pendingReview'),
  );
  line(item, t('reviewNote'), audit.review?.note);
  if (data.grants.canAudit && (audit.createdBy === data.actor || data.grants.canReviewAudit))
    item.append(button(t('editAudit'), () => auditEditor(record, data.weekStart, audit)));
  if (data.grants.canReviewAudit && audit.createdBy !== data.actor)
    item.append(button(t('reviewAudit'), () => reviewAudit(record, audit)));
  parent.append(item);
}
function showRecord(parent, record, data, mode) {
  const card = el('section', '', 'panel-card report-governance-card');
  card.append(el('h3', record.department));
  if (record.report) {
    line(card, t('chiefSummary'), record.report.summary);
    line(card, t('chiefAchievements'), record.report.achievements);
    line(card, t('chiefBlockers'), record.report.blockers);
    line(card, t('chiefNext'), record.report.next);
    evidence(card, record.report.evidence);
    line(
      card,
      t('reviewDecision'),
      record.report.status === 'submitted'
        ? t('pendingReview')
        : record.report.status === 'approved'
          ? t('approved')
          : t('changesRequested'),
    );
    line(card, t('reviewNote'), record.report.review?.note);
    if (data.grants.canReviewLeadership && record.report.submittedBy !== data.actor)
      card.append(button(t('reviewChief'), () => reviewChief(record, data.weekStart)));
  } else card.append(el('p', t('noChiefReport'), 'form-hint'));
  const audits = record.audits || [];
  card.append(el('h4', t('auditCount') + ': ' + audits.length + (record.auditsTruncated ? '+' : '')));
  if (data.grants.canAudit) card.append(button(t('addAudit'), () => auditEditor(record, data.weekStart)));
  if (data.grants.canAudit)
    card.append(button(t('evidenceFor'), () => showEvidence(record.department, data.weekStart)));
  if (mode === 'senatus' || audits.length) for (const audit of audits) showAudit(card, record, audit, data);
  parent.append(card);
}
function render(data, mode) {
  const host = byId('reports-content');
  host.replaceChildren();
  const label = mode === 'ceo' ? t('ceoOversight') : t('senatusOversight');
  byId('reports-title').textContent = label;
  byId('reports-view-title').textContent = label;
  byId('reports-access-note').textContent = t('governanceInfo');
  byId('reports-new-entry').hidden = true;
  byId('reports-new-task').hidden = true;
  byId('reports-chief-report').hidden = true;
  byId('reports-backup').hidden = true;
  byId('reports-restore').hidden = true;
  byId('reports-export').disabled = true;
  const stats = el('div', '', 'report-stats');
  const counts = [
    [t('chiefSubmitted'), data.records.filter((r) => r.report).length],
    [t('chiefApproved'), data.records.filter((r) => r.report?.status === 'approved').length],
    [t('auditCount'), data.records.reduce((n, r) => n + (r.audits || []).length, 0)],
    [
      t('auditUnresolved'),
      data.records.reduce((n, r) => n + (r.audits || []).filter((a) => a.findingStatus !== 'resolved').length, 0),
    ],
  ];
  for (const [label, value] of counts) {
    const box = el('div');
    box.append(el('span', label), el('strong', value));
    stats.append(box);
  }
  host.append(stats);
  data.records.forEach((record) => showRecord(host, record, data, mode));
}
async function refresh() {
  if (active) await openGovernanceView(active.mode, active.weekStart);
}
export async function openGovernanceView(mode, weekStart) {
  const serial = ++requestId,
    session = captureSession();
  const start = getCurrentWeek(weekStart);
  byId('reports-week').value = start;
  active = { mode, weekStart: start };
  const host = byId('reports-content');
  byId('reports-title').textContent = mode === 'ceo' ? t('ceoOversight') : t('senatusOversight');
  byId('reports-view-title').textContent = byId('reports-title').textContent;
  byId('reports-new-entry').hidden = true;
  byId('reports-new-task').hidden = true;
  byId('reports-backup').hidden = true;
  byId('reports-restore').hidden = true;
  byId('reports-export').disabled = true;
  host.setAttribute('aria-busy', 'true');
  host.replaceChildren(el('p', __('common.loading'), 'state-block'));
  try {
    const data = await call('getGovernanceOverview', { weekStart: start });
    if (serial !== requestId || !sessionIsCurrent(session)) return;
    data.actor = session.uid;
    render(data, mode);
  } catch (error) {
    if (serial !== requestId || !sessionIsCurrent(session)) return;
    host.replaceChildren(
      el('p', userErrorMessage(error), 'state-block'),
      button(__('common.retry'), () => refresh()),
    );
  } finally {
    if (serial === requestId) host.setAttribute('aria-busy', 'false');
  }
}
