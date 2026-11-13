import { getEffectivePanelLevel } from './roles.js';
import { legalCall, clearLegalCache, peekLegalDocument } from '../services/legalService.js';
import { renderLegalMarkdown } from '../services/legalMarkdown.js';
import { captureSession, sessionIsCurrent, onSessionReset } from '../core/session.js';
import { __, getLang, onLangChange, userErrorMessage } from '../utils/ui.js';
import {
  showLegalPreview,
  mountLegalDisclosures,
  resetLegalPresentation,
  closeLegalHistory,
} from './legalPresentation.js';
import { crossfade } from '../ui/transition.js';
import { confirmDialog } from '../ui/surfaces.js';
let documents = [],
  current = null,
  loaded = false,
  busy = false,
  serial = 0,
  cursor = null,
  historyLoaded = false,
  historyBusy = false;
let pendingId = null,
  mutating = false;
let listSignature = null;
const el = (name) => document.getElementById('legal-' + name);
const canEdit = () => getEffectivePanelLevel('legal.documents') === 'write';
const content = () => current?.draft || current?.published;
const dirty = () =>
  !!current && (el('title').value !== (content()?.title || '') || el('html').value !== (content()?.markdown || ''));
const group = () => documents.find((row) => row.id === current?.groupId);
const titleCase = (text) =>
  text.replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase(getLang()));
const productName = (product) => titleCase(product.replaceAll('-', ' '));
const label = (row) => titleCase(__('legal.kind.' + row.kind)) + ' | ' + productName(row.product);
function status(key, error = false) {
  el('status').textContent = key ? __(key) : '';
  el('status').dataset.error = String(error);
}
function skeleton(target, lines = 4) {
  if (target === 'list') listSignature = null;
  el(target).replaceChildren();
  for (let i = 0; i < lines; i++) {
    const line = document.createElement('div');
    line.className = 'skeleton legal-skeleton-line';
    line.setAttribute('aria-hidden', 'true');
    el(target).append(line);
  }
  el(target).setAttribute('aria-busy', 'true');
}
function lock(value) {
  busy = value;
  el('detail').setAttribute('aria-busy', String(value));
  for (const name of ['save', 'publish', 'translate', 'title', 'html', 'note', 'auto-translate'])
    el(name).disabled = value || !current || !canEdit();
  el('refresh').disabled = value;
  el('locale').disabled = value || !current;
  el('publish').disabled ||= !current?.draft || current?.ephemeral || dirty();
  el('translate').disabled ||= dirty() || current?.ephemeral;
  el('preview-published').disabled = value || !current?.published;
  el('preview-draft').disabled = value || !current;
  document.querySelectorAll('[data-legal-format]').forEach((button) => {
    button.disabled = value || !current || !canEdit();
  });
  el('history')
    .querySelectorAll('button')
    .forEach((button) => {
      button.disabled = value || !canEdit();
    });
}
function setDetailLoading(value) {
  const paint = () => {
    el('detail-skeleton').hidden = !value;
    el('detail').hidden = value || !current;
    el('detail-skeleton').setAttribute('aria-busy', String(value));
  };
  if (!value && current && !el('detail-skeleton').hidden)
    crossfade(el('detail').parentElement, paint, { duration: 240, preserveHeight: false });
  else paint();
}
function preview(html, animate = false) {
  showLegalPreview(
    '<!doctype html><html lang="' +
      (current?.locale || 'en') +
      '" dir="' +
      (current?.locale === 'ar' ? 'rtl' : 'ltr') +
      '"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>body{font:16px/1.8 system-ui;padding:24px;overflow-wrap:anywhere;color:#202329;max-width:76ch;margin:auto}h1{font-size:26px}h2{font-size:22px}a{color:#2455a6}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}blockquote{border-inline-start:3px solid #bbb;margin:16px 0;padding-inline-start:16px}</style>' +
      (html || '') +
      '</html>',
    animate,
  );
}
function languageName(locale) {
  try {
    return new Intl.DisplayNames([getLang()], { type: 'language' }).of(locale);
  } catch {
    return locale.toUpperCase();
  }
}
function renderList() {
  const search = el('search').value.trim().toLocaleLowerCase();
  const rows = documents.filter(
    (row) =>
      (!el('product').value || row.product === el('product').value) &&
      [label(row), row.id, ...row.languages.map((l) => l.title)].join(' ').toLocaleLowerCase().includes(search),
  );
  const signature =
    JSON.stringify(
      rows.map((row) => [row.id, label(row), row.languages.map((lang) => [lang.available, lang.hasDraft])]),
    ) +
    __('legal.empty') +
    __('legal.languages') +
    __('legal.draft');
  if (signature !== listSignature) {
    const paint = () => {
      el('list').replaceChildren();
      el('list').removeAttribute('aria-busy');
      for (const row of rows) {
        const button = document.createElement('button'),
          title = document.createElement('strong'),
          sub = document.createElement('span');
        button.type = 'button';
        button.dataset.documentGroup = row.id;
        title.textContent = label(row);
        const drafts = row.languages.filter((l) => l.hasDraft).length;
        sub.textContent =
          row.languages.filter((l) => l.available).length +
          ' ' +
          __('legal.languages') +
          (drafts ? ' · ' + drafts + ' ' + __('legal.draft') : '');
        button.append(title, sub);
        button.setAttribute('aria-pressed', String((pendingId?.split('--')[0] || current?.groupId) === row.id));
        button.disabled = mutating;
        button.onclick = () => selectDocument(row.id + '--' + getLang());
        el('list').append(button);
      }
      if (!rows.length) {
        const p = document.createElement('p');
        p.textContent = __('legal.empty');
        el('list').append(p);
      }
    };
    if (el('list').querySelector('.skeleton')) crossfade(el('list'), paint, { duration: 240, preserveHeight: false });
    else paint();
    listSignature = signature;
  }
  for (const button of el('list').querySelectorAll(':scope > button')) {
    button.setAttribute(
      'aria-pressed',
      String((pendingId?.split('--')[0] || current?.groupId) === button.dataset.documentGroup),
    );
    button.disabled = mutating;
  }
}

function filters() {
  const selected = el('product').value;
  el('product').replaceChildren(new Option(__('legal.all'), ''));
  for (const value of [...new Set(documents.map((row) => row.product))].sort())
    el('product').add(new Option(productName(value), value));
  el('product').value = selected;
}
function renderDetail() {
  setDetailLoading(false);
  if (!current) return;
  const value = content();
  el('title').value = value?.title || '';
  el('html').value = value?.markdown || '';
  el('note').value = '';
  el('html').dir = current.locale === 'ar' ? 'rtl' : 'auto';
  el('document-heading').textContent = label(group() || current);
  el('state').textContent = __(
    current.ephemeral ? 'legal.machinePreview' : current.draft ? 'legal.draft' : 'legal.published',
  );
  el('meta').textContent = languageName(current.locale) + ' · ' + __('legal.version') + ' ' + current.version;
  el('translation-info').hidden = !value?.translation;
  el('translation-info').textContent = __('legal.machineHelp');
  el('locale').replaceChildren();
  for (const lang of group()?.languages || [])
    el('locale').add(
      new Option(languageName(lang.locale) + (lang.hasDraft ? ' · ' + __('legal.draft') : ''), lang.locale),
    );
  el('locale').value = current.locale;
  el('sources').replaceChildren();
  for (const source of current.sources || []) {
    const a = document.createElement('a');
    a.textContent = source.repository + '/' + source.path;
    a.href = source.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    el('sources').append(a);
  }
  preview(value?.html);
  lock(false);
}
function showError(error) {
  el('status').textContent = error.code === 'functions/aborted' ? __('legal.conflict') : userErrorMessage(error);
  el('status').dataset.error = 'true';
}
async function mayDiscard() {
  return !dirty() || (await confirmDialog(() => ({ title: __('legal.discardTitle'), body: __('legal.discardBody') })));
}
async function selectDocument(id, approved = false, force = false) {
  if (mutating || (!approved && !(await mayDiscard()))) return false;
  const request = ++serial,
    token = captureSession(),
    valid = () => request === serial && sessionIsCurrent(token);
  const cached = !force && peekLegalDocument(id, token);
  pendingId = id;
  lock(true);
  renderList();
  status('');
  if (!cached || cached.missing) setDetailLoading(true);
  try {
    let result = cached || (await legalCall('get', { id }, token));
    if (!valid()) return false;
    if (result.missing) {
      const row = documents.find((d) => d.id === result.groupId);
      const source =
        row.languages.find((l) => l.locale === 'en' && l.available) || row.languages.find((l) => l.available);
      if (!source) throw new Error(__('legal.noSource'));
      const original = await legalCall('get', { id: source.id }, token);
      if (!valid()) return false;
      const translated = await legalCall(
        'translate',
        { id: source.id, expectedRevision: original.revision, targetLangs: [result.locale], persist: false },
        token,
      );
      if (!valid()) return false;
      if (!translated.translations[result.locale]) throw new Error(__('legal.translationFailed'));
      result = { ...result, draft: translated.translations[result.locale], ephemeral: true };
    }
    if (!valid()) return false;
    current = result;

    cursor = null;
    historyLoaded = false;
    historyBusy = false;
    closeLegalHistory();
    el('history').replaceChildren();
    el('more').hidden = true;
    renderDetail();
    renderList();
    status('');
    return true;
  } catch (error) {
    if (valid()) showError(error);
    return false;
  } finally {
    if (valid()) {
      pendingId = null;
      setDetailLoading(false);
      lock(false);
      renderList();
    }
  }
}
async function refresh() {
  if (busy || !(await mayDiscard())) return;
  const token = captureSession();
  lock(true);
  status('');
  clearLegalCache();
  skeleton('list', 8);
  setDetailLoading(true);
  try {
    const result = await legalCall(
      'catalog',
      { locale: getLang(), ...(current ? { selectedId: current.id } : {}) },
      token,
    );
    if (!sessionIsCurrent(token)) return;
    if (result.schemaVersion !== 2 || !Array.isArray(result.documents)) throw new Error('LEGAL_INVALID_RESPONSE');
    documents = result.documents;
    loaded = true;

    filters();
    lock(false);
    renderList();
    if (current || documents.length) await selectDocument(current?.id || documents[0].id + '--' + getLang(), true);
  } catch (error) {
    if (sessionIsCurrent(token)) {
      showError(error);
      el('list').replaceChildren();
      setDetailLoading(false);
    }
  } finally {
    if (sessionIsCurrent(token)) {
      el('list').removeAttribute('aria-busy');
      lock(false);
    }
  }
}
async function translateOthers(token) {
  const source = current,
    row = group();
  el('translation-info').hidden = false;
  el('translation-info').textContent = '';
  el('translation-info').classList.add('skeleton');
  el('translation-info').setAttribute('aria-busy', 'true');
  try {
    const result = await legalCall(
      'translate',
      {
        id: source.id,
        expectedRevision: source.revision,
        targetLangs: row.languages.map((l) => l.locale).filter((l) => l !== source.locale),
        persist: true,
      },
      token,
    );
    if (!sessionIsCurrent(token) || current?.id !== source.id) return;
    for (const lang of row.languages)
      if (result.translations[lang.locale]) {
        lang.hasDraft = true;
        lang.available = true;
        lang.origin = 'machine';
      }
    el('translation-info').textContent = Object.keys(result.failed).length
      ? __('legal.partialTranslation')
      : __('legal.translated');
    renderList();
  } finally {
    if (sessionIsCurrent(token)) {
      el('translation-info').classList.remove('skeleton');
      el('translation-info').removeAttribute('aria-busy');
    }
  }
}
async function mutate(action, extra = {}) {
  if (!current || busy || !canEdit()) return;
  if (action === 'publish' && (dirty() || !el('note').value.trim())) {
    status('legal.publishHelp', true);
    return;
  }
  if (
    action === 'publish' &&
    !(await confirmDialog(() => ({ title: __('legal.publish'), body: __('legal.publishConfirm') })))
  )
    return;
  if (
    action === 'restore' &&
    !(await confirmDialog(() => ({ title: __('legal.restore'), body: __('legal.restoreConfirm') })))
  )
    return;
  if (!current || busy || !canEdit()) return;
  const token = captureSession(),
    id = current.id;
  mutating = true;
  lock(true);
  status('');
  const working = action === 'translate' ? 'translate' : action === 'publish' ? 'publish' : 'save';
  el(working).classList.add('legal-working');
  try {
    if (action !== 'translate') {
      await legalCall(
        action,
        {
          id,
          expectedRevision: current.revision,
          title: el('title').value,
          markdown: el('html').value,
          note: el('note').value,
          ...extra,
        },
        token,
      );
      if (!sessionIsCurrent(token)) return;
      current = await legalCall('get', { id }, token);
      if (!sessionIsCurrent(token)) return;
      const lang = group()?.languages.find((l) => l.id === id);
      if (lang)
        Object.assign(lang, {
          available: true,
          hasDraft: !!current.draft,
          title: content()?.title,
          revision: current.revision,
        });
      historyLoaded = false;
      closeLegalHistory();
      renderDetail();
      lock(true);
      renderList();
      status('legal.saved');
    }
    if (action === 'translate' || (action === 'save' && el('auto-translate').checked)) {
      try {
        await translateOthers(token);
      } catch (error) {
        if (sessionIsCurrent(token)) {
          el('translation-info').textContent = __('legal.savedTranslationFailed') + ' ' + userErrorMessage(error);
          status('legal.saved', true);
        }
      }
    }
  } catch (error) {
    if (sessionIsCurrent(token)) showError(error);
  } finally {
    if (sessionIsCurrent(token)) {
      mutating = false;
      lock(false);
      renderList();
      el(working).classList.remove('legal-working');
    }
  }
}
async function loadHistory(more) {
  if (!current || historyBusy || (!more && historyLoaded)) return;
  if (current.ephemeral) {
    el('history').textContent = __('legal.noHistory');
    return;
  }
  const id = current.id,
    request = serial,
    token = captureSession();
  historyBusy = true;
  if (!more) skeleton('history', 3);
  else el('more').classList.add('legal-working');
  try {
    const data = await legalCall('history', { id, ...(more ? { after: cursor } : {}) }, token);
    if (!sessionIsCurrent(token) || request !== serial || current?.id !== id) return;
    const paint = () => {
      if (!more) el('history').replaceChildren();
      for (const version of [...data.versions, ...(!data.nextCursor && data.baseline ? [data.baseline] : [])]) {
        const row = document.createElement('div'),
          copy = document.createElement('div'),
          title = document.createElement('strong'),
          note = document.createElement('p'),
          button = document.createElement('button');
        row.className = 'legal-history-card';
        copy.className = 'legal-history-copy';
        title.textContent =
          __('legal.version') +
          ' ' +
          version.version +
          ' | ' +
          (version.publishedAt ? new Date(version.publishedAt).toLocaleString(getLang()) : __('legal.baseline'));
        note.textContent = version.note;
        copy.append(title, note);
        button.type = 'button';
        button.className = 'chrome-btn-outline';
        button.textContent = __('legal.restore');
        button.disabled = busy || !canEdit();
        button.onclick = () => mutate('restore', { version: version.version });
        row.append(copy, button);
        el('history').append(row);
      }
      if (!el('history').children.length) el('history').textContent = __('legal.noHistory');
    };
    if (!more) crossfade(el('history'), paint, { duration: 240, preserveHeight: false });
    else paint();
    historyLoaded = true;
    cursor = data.nextCursor;
    el('more').hidden = !cursor;
  } catch (error) {
    if (sessionIsCurrent(token) && current?.id === id) {
      el('history').replaceChildren();
      showError(error);
    }
  } finally {
    if (sessionIsCurrent(token) && request === serial) {
      historyBusy = false;
      el('history').removeAttribute('aria-busy');
      el('more').classList.remove('legal-working');
    }
  }
}
function format(kind) {
  if (busy || !current || !canEdit()) return;
  const field = el('html'),
    start = field.selectionStart,
    end = field.selectionEnd,
    selected = field.value.slice(start, end);
  const value =
    kind === 'bold'
      ? '**' + selected + '**'
      : kind === 'heading'
        ? '\n## ' + selected
        : kind === 'list'
          ? '\n- ' + selected
          : '[' + selected + '](https://)';
  field.setRangeText(value, start, end, 'select');
  field.focus();
  field.dispatchEvent(new Event('input'));
}
export function initLegalModule() {
  if (!el('list')) return;
  mountLegalDisclosures();
  el('search').addEventListener('input', renderList);
  el('product').addEventListener('change', renderList);
  el('locale').addEventListener('change', async () => {
    const locale = current?.locale;
    if (current && !(await selectDocument(current.groupId + '--' + el('locale').value))) el('locale').value = locale;
  });
  el('refresh').onclick = refresh;
  el('save').onclick = () => mutate('save');
  el('publish').onclick = () => mutate('publish');
  el('translate').onclick = () => mutate('translate');
  el('preview-draft').onclick = () => preview(renderLegalMarkdown(el('html').value), true);
  el('preview-published').onclick = () => current?.published && preview(current.published.html, true);
  el('more').onclick = () => loadHistory(true);
  el('history-section').addEventListener('toggle', () => {
    if (el('history-section').open) void loadHistory(false);
  });
  let timer;
  for (const name of ['title', 'html'])
    el(name).addEventListener('input', () => {
      lock(busy);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (current && !busy) preview(renderLegalMarkdown(el('html').value), true);
      }, 200);
    });
  document.querySelectorAll('[data-legal-format]').forEach((button) => {
    button.onclick = () => format(button.dataset.legalFormat);
  });
  document.addEventListener('vertex:workspace', (event) => {
    if (event.detail?.keys?.includes('legal.documents') && !loaded && !busy) void refresh();
  });
  onLangChange(() => {
    filters();
    renderList();
    if (current) void selectDocument(current.groupId + '--' + getLang());
  });
  onSessionReset(() => {
    ++serial;
    listSignature = null;
    pendingId = null;
    mutating = false;
    resetLegalPresentation();
    clearTimeout(timer);
    clearLegalCache();
    documents = [];
    current = null;
    loaded = busy = historyBusy = historyLoaded = false;
    el('list').replaceChildren();
    el('list').removeAttribute('aria-busy');
    for (const name of ['save', 'publish', 'translate']) el(name).classList.remove('legal-working');
    el('translation-info').removeAttribute('aria-busy');
    setDetailLoading(false);
    el('preview').removeAttribute('srcdoc');
    el('history').replaceChildren();
    for (const name of ['html', 'title', 'note']) el(name).value = '';
    el('translation-info').classList.remove('skeleton');
    el('translation-info').hidden = true;
    status('');
  });
}
