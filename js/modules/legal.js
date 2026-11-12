import { getEffectivePanelLevel } from './roles.js';
import { legalCall } from '../services/legalService.js';
import { captureSession, sessionIsCurrent, onSessionReset } from '../core/session.js';
import { __, onLangChange, userErrorMessage } from '../utils/ui.js';
import { confirmDialog } from '../ui/surfaces.js';
let documents = [],
  current = null,
  loaded = false,
  loading = false,
  busy = false,
  serial = 0,
  cursor = null;
const el = (name) => document.getElementById('legal-' + name);
const canEdit = () => getEffectivePanelLevel('legal.documents') === 'write';
const dirty = () =>
  current &&
  (el('title').value !== (current.draft || current.published).title ||
    el('html').value !== (current.draft || current.published).html);
function status(key, error = false) {
  el('status').textContent = __(key);
  el('status').dataset.error = String(error);
}
function lock(value) {
  busy = value;
  for (const name of ['save', 'publish', 'refresh', 'title', 'html', 'note'])
    el(name).disabled = value || (!current && name !== 'refresh') || (name !== 'refresh' && !canEdit());
  el('publish').disabled ||= !current?.draft || dirty();
  el('history')
    .querySelectorAll('button')
    .forEach((button) => {
      button.disabled = value || !canEdit();
    });
}
function preview(html) {
  el('preview').srcdoc =
    '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>body{font:16px/1.7 system-ui;padding:22px;overflow-wrap:anywhere;color:#202329}h1{font-size:26px}a{color:#2455a6}table{max-width:100%} .doctrine-text-container{white-space:pre-line}</style>' +
    html;
}
function renderList() {
  const search = el('search').value.trim().toLocaleLowerCase();
  const rows = documents.filter(
    (row) =>
      (!el('product').value || row.product === el('product').value) &&
      (!el('locale').value || row.locale === el('locale').value) &&
      [row.title, row.id].join(' ').toLocaleLowerCase().includes(search),
  );
  el('list').replaceChildren();
  for (const row of rows) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${row.title} · ${row.locale.toUpperCase()}${row.hasDraft ? ' · ' + __('legal.draft') : ''}`;
    button.setAttribute('aria-pressed', String(current?.id === row.id));
    button.onclick = () => selectDocument(row.id);
    el('list').append(button);
  }
  if (!rows.length) {
    const p = document.createElement('p');
    p.textContent = __('legal.empty');
    el('list').append(p);
  }
}
function filters() {
  for (const [name, field] of [
    ['product', 'product'],
    ['locale', 'locale'],
  ]) {
    const selected = el(name).value;
    el(name).replaceChildren(new Option(__('legal.all'), ''));
    for (const value of [...new Set(documents.map((row) => row[field]))].sort()) el(name).add(new Option(value, value));
    el(name).value = selected;
  }
}
function renderDetail() {
  el('detail').hidden = !current;
  if (!current) return;
  const content = current.draft || current.published;
  el('title').value = content.title;
  el('html').value = content.html;
  el('note').value = '';
  el('meta').textContent =
    `${current.id} · ${__('legal.version')} ${current.version} · ${current.hasDraft ? __('legal.draft') : __('legal.published')}`;
  el('sources').replaceChildren();
  for (const source of current.sources) {
    const a = document.createElement('a');
    a.textContent = source.repository + '/' + source.path;
    a.href = source.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    el('sources').append(a);
  }
  preview(content.html);
  lock(false);
}
async function selectDocument(id, discardApproved = false) {
  if (busy) return;
  if (
    !discardApproved &&
    dirty() &&
    !(await confirmDialog(() => ({ title: __('legal.discardTitle'), body: __('legal.discardBody') })))
  )
    return;
  const request = ++serial,
    token = captureSession();
  lock(true);
  status('legal.loading');
  try {
    const result = await legalCall('get', { id }, token);
    if (request !== serial || !sessionIsCurrent(token)) return;
    current = result;
    renderDetail();
    renderList();
    el('history').replaceChildren();
    cursor = null;
    status('legal.ready');
    await loadHistory(false);
  } catch (error) {
    if (request === serial && sessionIsCurrent(token)) showError(error);
  } finally {
    if (request === serial && sessionIsCurrent(token)) lock(false);
  }
}
function showError(error) {
  el('status').textContent = error.code === 'functions/aborted' ? __('legal.conflict') : userErrorMessage(error);
  el('status').dataset.error = 'true';
}
async function refresh() {
  if (busy || loading) return;
  if (dirty() && !(await confirmDialog(() => ({ title: __('legal.discardTitle'), body: __('legal.discardBody') }))))
    return;
  const token = captureSession();
  loading = true;
  status('legal.loading');
  try {
    const result = await legalCall('list', {}, token);
    if (result.schemaVersion !== 1 || !Array.isArray(result.documents)) throw new Error('LEGAL_INVALID_RESPONSE');
    documents = result.documents;
    loaded = true;
    filters();
    renderList();
    status('legal.ready');
    if (current) await selectDocument(current.id, true);
  } catch (error) {
    if (sessionIsCurrent(token)) showError(error);
  } finally {
    loading = false;
  }
}
async function mutate(action, extra = {}) {
  if (!current || busy || !canEdit()) return;
  if (action === 'publish') {
    if (dirty() || !el('note').value.trim()) {
      status('legal.publishHelp', true);
      return;
    }
    if (!(await confirmDialog(() => ({ title: __('legal.publish'), body: __('legal.publishConfirm') })))) return;
  }
  if (
    action === 'restore' &&
    !(await confirmDialog(() => ({ title: __('legal.restore'), body: __('legal.restoreConfirm') })))
  )
    return;
  if (!current || busy || !canEdit()) return;
  const token = captureSession(),
    id = current.id;
  lock(true);
  status('legal.saving');
  try {
    await legalCall(
      action,
      {
        id,
        expectedRevision: current.revision,
        title: el('title').value,
        html: el('html').value,
        note: el('note').value,
        ...extra,
      },
      token,
    );
    current = await legalCall('get', { id }, token);
    documents = documents.map((row) => (row.id === id ? current : row));
    renderDetail();
    renderList();
    el('history').replaceChildren();
    cursor = null;
    await loadHistory(false);
    status('legal.saved');
  } catch (error) {
    if (sessionIsCurrent(token)) showError(error);
  } finally {
    if (sessionIsCurrent(token)) lock(false);
  }
}
async function loadHistory(more) {
  if (!current) return;
  const id = current.id,
    token = captureSession();
  try {
    const data = await legalCall('history', { id, ...(more ? { after: cursor } : {}) }, token);
    if (current?.id !== id) return;
    const rows = [...data.versions, ...(!data.nextCursor ? [data.baseline] : [])];
    for (const version of rows) {
      const row = document.createElement('div'),
        label = document.createElement('span'),
        button = document.createElement('button');
      label.textContent = `${__('legal.version')} ${version.version} · ${version.publishedAt || __('legal.baseline')} · ${version.note}`;
      button.type = 'button';
      button.className = 'chrome-btn-outline';
      button.textContent = __('legal.restore');
      button.disabled = busy || !canEdit();
      button.onclick = () => mutate('restore', { version: version.version });
      row.append(label, button);
      el('history').append(row);
    }
    cursor = data.nextCursor;
    el('more').hidden = !cursor;
  } catch (error) {
    if (sessionIsCurrent(token)) showError(error);
  }
}
export function initLegalModule() {
  if (!el('list')) return;
  for (const name of ['search', 'product', 'locale'])
    el(name).addEventListener(name === 'search' ? 'input' : 'change', renderList);
  el('refresh').onclick = refresh;
  el('save').onclick = () => mutate('save');
  el('publish').onclick = () => mutate('publish');
  el('preview-draft').onclick = () => preview(el('html').value);
  el('preview-published').onclick = () => current && preview(current.published.html);
  el('more').onclick = () => loadHistory(true);
  for (const name of ['title', 'html']) el(name).addEventListener('input', () => lock(busy));
  document.addEventListener('vertex:workspace', (event) => {
    if (event.detail?.keys?.includes('legal.documents') && !loaded) void refresh();
  });
  onLangChange(() => {
    filters();
    renderList();
  });
  onSessionReset(() => {
    ++serial;
    documents = [];
    current = null;
    loaded = false;
    busy = false;
    loading = false;
    el('list').replaceChildren();
    el('detail').hidden = true;
    el('preview').removeAttribute('srcdoc');
    el('history').replaceChildren();
    el('html').value = '';
    el('title').value = '';
    el('note').value = '';
    el('status').textContent = '';
  });
}
