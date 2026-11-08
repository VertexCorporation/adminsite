import { captureSession, sessionIsCurrent, onSessionReset } from '../core/session.js';
import { createContributorSurfaces } from './contributors/surfaces.js';
import { contributorsStore } from '../stores/areaStore.js';
import { registerListRefresh } from '../ui/listRefresh.js';
import { openCertificateEmailTemplates } from './certificateEmailTemplates.js';
import { initManualApplication } from './manualApplication.js';
import { deploymentCapabilities } from '../core/deployment-capabilities.js';
import { isActiveContributor, contributorState } from '../utils/contributor-state.js';
import { changedContributorFields } from '../utils/contributor-edit.js';
import { initVertexRoster, refreshRosterAccess } from './vertex-roster.js';
import { displayDepartmentName, canonicalDepartment } from '../utils/departments.js';
import { icon } from '../utils/icons.js';
import { openDrawer, closeDrawer, confirmDialog, openPopover, closePopover } from './shell.js';
import { createLoadingController, skeletonRows, createRequestGuard, setButtonLoading } from '../utils/loading.js';
import { formatCertificateDate } from './certificates.js';
import { openCertificates } from './certificates.js';
// js/modules/contributors.js

import { showToast, userErrorMessage, __, onLangChange, sanitizeHTML, escapeHTML } from '../utils/ui.js';
import {
  getVertexContributorsFn,
  toggleContributorVerificationFn,
  deleteVertexContributorFn,
  updateContributorApplicationFn,
  setContributorVertexStatusFn,
  consolePeopleCall,
  auth,
  db,
} from '../core/firebase.js';
import { getEffectivePanelLevel, DEPARTMENTS, isPanelAdmin } from './roles.js';
const {
  openContributorEditor,
  openContributorDetails,
  watchContributorVerification,
  toggleMembership,
  openCertificateSelector,
  membershipPending,
  stopVerification,
} = createContributorSurfaces({ refresh: fetchContributorsData, render: renderContributors, birthDateLabel });

function legacyYearRange(person) {
  if (Array.isArray(person.estimatedBirthYearRange) && person.estimatedBirthYearRange.length === 2)
    return person.estimatedBirthYearRange;
  const age = Number(person.age),
    created = person.createdAt || person.applicationDate;
  if (
    !created ||
    person.age === null ||
    person.age === '' ||
    person.age === undefined ||
    !Number.isInteger(age) ||
    age < 0 ||
    age > 123
  )
    return null;
  const time = created
    ? new Date(
        typeof created._seconds === 'number'
          ? created._seconds * 1000
          : typeof created.seconds === 'number'
            ? created.seconds * 1000
            : created,
      )
    : new Date();
  if (Number.isNaN(time.getTime())) return null;
  const year = time.getUTCFullYear();
  return [year - age - 1, year - age];
}
function birthYearLabel(person) {
  if (person.birthDate) return person.birthDate.slice(0, 4);
  if (person.birthYear) return String(person.birthYear);
  const estimate = legacyYearRange(person);
  return estimate ? String(Math.max(...estimate)) : '—';
}
function birthDateLabel(person) {
  if (person.birthDate) {
    const [year, month, day] = person.birthDate.split('-');
    return day + '.' + month + '.' + year;
  }
  if (person.birthYear)
    return (
      String(person.birthYear) + (person.birthYearEstimated ? ' (' + __('contributors.birth_year_estimated') + ')' : '')
    );
  const estimate = legacyYearRange(person);
  return estimate ? String(Math.max(...estimate)) + ' (' + __('contributors.birth_year_estimated') + ')' : '—';
}

function filterBirthYear(person) {
  const actual = Number(person.birthYear || person.birthDate?.slice(0, 4));
  if (Number.isInteger(actual) && actual >= 1900) return actual;
  return legacyYearRange(person)?.[1] ?? null;
}
function syncBirthYearFilters() {
  const current = new Date().getFullYear();
  const labels = {
    'age-14-15': current - 15 + '–' + (current - 14),
    'age-16-17': current - 17 + '–' + (current - 16),
    'age-18': '≤' + (current - 18),
  };
  for (const [name, value] of Object.entries(labels)) {
    const element = document.querySelector('#tab-contributors .filter-chip[data-filter="' + name + '"]');
    if (element) element.textContent = value;
  }
}
const editIcon = icon('pencil');
const requestGuard = createRequestGuard();
let loading;
let inFlight;
let inFlightContext;
let lastLoadFailed = false;
let transientFailures = 0;
let reloadTimer = null;
let lastFailureAt = 0;
function retryFailedContributors() {
  if (
    !lastLoadFailed ||
    !auth?.currentUser ||
    document.hidden ||
    getEffectivePanelLevel('contributors.list') === 'none'
  )
    return;
  if (Date.now() - lastFailureAt < 10000) return;
  void fetchContributorsData();
}
function scheduleContributorRetry() {
  clearTimeout(reloadTimer);
  if (transientFailures > 2) return; // Bounded automatic recovery, manual Retry remains.
  const uid = auth?.currentUser?.uid;
  if (!uid) return;
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    if (auth?.currentUser?.uid === uid && !document.hidden && lastLoadFailed) void fetchContributorsData();
  }, transientFailures * 4500);
}

let activeFilter = 'all';
let nextContributorCursor = null;
let activeContributorSearch = '';
let contributorSearchTimer = null;
let listContainer;
let refreshBtn;

export function initContributorsModule() {
  document.addEventListener('vertex:application-templates', () => {
    if (isPanelAdmin()) openCertificateEmailTemplates();
  });
  document.addEventListener('vertex:certificate-selector', openCertificateSelector);
  initVertexRoster(fetchContributorsData);
  initManualApplication({ onCreated: fetchContributorsData });
  listContainer = document.getElementById('contributors-list-container');
  listContainer.replaceChildren();
  loading = createLoadingController(listContainer, {
    skeletonHTML: skeletonRows(),
    crossfadeOptions: { mode: 'enter' },
  });
  window.filterContributors = (filter) => {
    clearTimeout(contributorSearchTimer);
    activeFilter = filter;
    document.querySelectorAll('#tab-contributors .filter-chip').forEach((chip) => {
      const active = chip.dataset.filter === filter;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    void fetchContributorsData();
  };
  window.searchContributorsLocal = () => {
    requestGuard.begin();
    loading.destroy();
    clearTimeout(contributorSearchTimer);
    contributorSearchTimer = setTimeout(() => void fetchContributorsData(), 350);
  };
  syncBirthYearFilters();
  refreshBtn = document.getElementById('refresh-contributors-btn');
  registerListRefresh(listContainer, fetchContributorsData, { button: refreshBtn });
  if (refreshBtn && !document.getElementById('certificate-email-templates-btn')) {
    const button = document.createElement('button');
    button.id = 'certificate-email-templates-btn';
    button.type = 'button';
    button.className = 'chrome-btn-outline';
    button.dataset.i18n = 'email_templates.title';
    button.textContent = __('email_templates.title');
    button.style.display = isPanelAdmin() ? '' : 'none';
    button.onclick = openCertificateEmailTemplates;
    refreshBtn.before(button);
    refreshBtn.parentElement.classList.add('certificate-template-entry-row');
  }
  onLangChange(() => {
    const headers = ['name', 'department', 'birthYear', 'status', 'applied', 'actions'];
    document.querySelectorAll('.contributor-table-head').forEach((header) => {
      if (header.closest('.ui-crossfade-ghost') || header.closest('[data-panel="users.beacons"]')) return;
      [...header.children]
        .filter((el) => el.matches('span'))
        .forEach((el, i) => {
          if (headers[i]) el.textContent = __('contributors.col_' + headers[i]);
        });
    });
    if (contributorsStore.value) renderContributors(contributorsStore.value);
  });

  if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchContributorsData);
  }
  window.addEventListener('focus', retryFailedContributors);
  document.addEventListener('visibilitychange', retryFailedContributors);
  document.addEventListener('vertex:workspace', (event) => {
    if (event.detail?.keys?.includes('contributors.list')) retryFailedContributors();
  });
  // A different signed-in person must never see an earlier session's cached
  // applications while a fresh request is in flight or temporarily unavailable.

  let lastUid = auth?.currentUser?.uid || null;
  auth?.onAuthStateChanged((user) => {
    const uid = user?.uid || null;
    if (uid === lastUid) return;
    lastUid = uid;
    stopVerification();
    requestGuard.begin();
    clearTimeout(reloadTimer);
    reloadTimer = null;
    inFlight = null;
    inFlightContext = null;
    lastLoadFailed = false;
    transientFailures = 0;
    contributorsStore.value = null;
    nextContributorCursor = null;
    activeContributorSearch = '';
    loading.destroy();
    listContainer.replaceChildren();
    if (refreshBtn) setButtonLoading(refreshBtn, false);
  });
}

/** Template management remains a server-enforced Core action. */
export function applyChipVisibility() {
  const templateEntry = document.getElementById('certificate-email-templates-btn');
  if (templateEntry) templateEntry.style.display = isPanelAdmin() ? '' : 'none';
}

export function fetchContributorsData() {
  const templateEntry = document.getElementById('certificate-email-templates-btn');
  if (templateEntry) templateEntry.style.display = isPanelAdmin() ? '' : 'none';
  if (getEffectivePanelLevel('contributors.list') === 'none') return Promise.resolve();
  const context = JSON.stringify([
    auth.currentUser?.uid,
    isPanelAdmin(),
    activeFilter,
    (document.getElementById('contributor-search')?.value || '').trim(),
  ]);
  if (inFlight && inFlightContext === context) return inFlight;
  inFlightContext = context;
  const promise = loadContributors(false).finally(() => {
    if (inFlight === promise) inFlight = null;
  });
  inFlight = promise;
  return promise;
}
async function loadContributors(append = false) {
  if (!listContainer) return;
  if (append && !nextContributorCursor) return;
  const token = captureSession();
  const request = requestGuard.begin();
  const cursor = append ? nextContributorCursor : null;
  const search = (document.getElementById('contributor-search')?.value || '').trim();
  if (!append) {
    loading.start();
    nextContributorCursor = null;
    activeContributorSearch = search;
  }
  if (refreshBtn) setButtonLoading(refreshBtn, true);

  try {
    const result = await getVertexContributorsFn({
      cursor,
      pageSize: 40,
      filter: activeFilter,
      search,
    });
    if (!requestGuard.isCurrent(request) || !sessionIsCurrent(token)) return;
    loading.destroy();
    const incoming = result.data.contributors || [];
    const contributors = append
      ? [
          ...(contributorsStore.value || []),
          ...incoming.filter(
            (person) => !(contributorsStore.value || []).some((existing) => existing.id === person.id),
          ),
        ]
      : incoming;
    nextContributorCursor = result.data.nextCursor || null;
    lastLoadFailed = false;
    transientFailures = 0;
    clearTimeout(reloadTimer);
    reloadTimer = null;
    if (!contributorsStore.set(contributors, token)) return;
    renderContributors(contributors);
    const uid = auth.currentUser?.uid;
    if (uid && isPanelAdmin())
      for (const p of contributors) {
        if (p.hasVerified && ['pending', 'processing'].includes(p.certificateDeliveryStatus))
          watchContributorVerification(p.id, uid);
      }
  } catch (error) {
    console.error('[CONTRIBUTORS] Failed to fetch data:', error);
    if (!requestGuard.isCurrent(request) || !sessionIsCurrent(token)) return;
    loading.destroy();
    lastLoadFailed = true;
    lastFailureAt = Date.now();
    if (
      [
        'functions/unavailable',
        'functions/deadline-exceeded',
        'functions/resource-exhausted',
        'functions/internal',
      ].includes(error.code)
    ) {
      transientFailures++;
      scheduleContributorRetry();
    }
    if (contributorsStore.value) {
      let error = listContainer.querySelector('.contributors-inline-error');
      if (!error) {
        error = document.createElement('div');
        error.className = 'state-block contributors-inline-error';
        listContainer.prepend(error);
      }
      error.innerHTML = `<p data-i18n="contributors.load_error">${__('contributors.load_error')}</p><button class="chrome-btn-outline" data-i18n="common.retry">${__('common.retry')}</button>`;
      error.querySelector('button').onclick = fetchContributorsData;
      listContainer.removeAttribute('aria-busy');
    } else {
      loading.error(__('contributors.load_error'), fetchContributorsData, __('common.retry'));
      listContainer.querySelector('h4').dataset.i18n = 'contributors.load_error';
      listContainer.querySelector('button').dataset.i18n = 'common.retry';
    }
    showToast(() => __('contributors.load_error'), 'error');
  } finally {
    if (requestGuard.isCurrent(request) && refreshBtn) setButtonLoading(refreshBtn, false);
  }
}

function renderContributors(contributors) {
  refreshRosterAccess();
  syncBirthYearFilters();
  document.querySelectorAll('#tab-contributors .filter-chip').forEach((b) => {
    const active = b.dataset.filter === activeFilter;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  const canWrite = getEffectivePanelLevel('contributors.list') === 'write';
  const admin = isPanelAdmin();
  const addButton = document.getElementById('add-manual-application');
  if (addButton) addButton.hidden = !canWrite;
  const templateEntry = document.getElementById('certificate-email-templates-btn');
  if (templateEntry) {
    templateEntry.style.display = admin ? '' : 'none';
    templateEntry.textContent = __('email_templates.title');
  }
  const headers = ['name', 'department', 'birthYear', 'status', 'applied', 'actions'];
  loading.success(
    `<div class="contributor-table-head">${headers.map((h) => `<span>${__('contributors.col_' + h)}</span>`).join('')}</div><div class="contributor-table-rows">` +
      contributors
        .map(
          (p) =>
            `<div class="contributor-row ${p.hasVerified ? 'is-verified' : ''}" data-contributor-id="${escapeHTML(p.id)}"><button type="button" class="contributor-cell-name" data-details="${escapeHTML(p.id)}"><span class="contributor-avatar">${escapeHTML((p.name || '?').slice(0, 1))}</span><strong class="contributor-name">${escapeHTML(p.name)}</strong></button><span class="contributor-cell-dept">${escapeHTML(displayDepartmentName(p.department))}</span><span class="contributor-cell-age">${escapeHTML(birthYearLabel(p))}</span><span class="contributor-cell-status status-badge ${p.hasVerified ? 'success' : ''}">${p.hasVerified ? __('contributors.verified_label') : __('contributors.unverified_label')}</span><span class="contributor-cell-interview">${p.applicationDate ? escapeHTML(formatCertificateDate(p.applicationDate)) : p.createdAt ? escapeHTML(formatCertificateDate(p.createdAt)) : '—'}</span><span class="contributor-cell-actions">${canWrite ? `<button type="button" class="edit-contributor-btn icon-action-btn" data-id="${escapeHTML(p.id)}" aria-label="${__('contributors.edit_title')}">${icon('pencil')}</button>` : ''}${admin ? `<button type="button" class="certificate-manage-btn cert-trigger" data-id="${escapeHTML(p.id)}" aria-label="${__('cert.title')}">${icon('award')}</button><button type="button" class="vertex-membership-btn icon-action-btn ${contributorState(p) === 'active' ? 'is-active' : contributorState(p) === 'unknown' ? 'is-unknown' : ''}" data-membership="${escapeHTML(p.id)}" title="${__(contributorState(p) === 'active' ? 'contributors.vertex_active' : contributorState(p) === 'inactive' ? 'contributors.vertex_inactive' : 'contributors.vertex_unknown')}${deploymentCapabilities.contributorMembershipWrites ? '' : ' · ' + __('contributors.vertex_server_pending')}" aria-label="${__(contributorState(p) === 'active' ? 'contributors.vertex_active' : contributorState(p) === 'inactive' ? 'contributors.vertex_inactive' : 'contributors.vertex_unknown')}${deploymentCapabilities.contributorMembershipWrites ? '' : ' · ' + __('contributors.vertex_server_pending')}" aria-pressed="${isActiveContributor(p)}" data-vertex-state="${contributorState(p)}" ${!deploymentCapabilities.contributorMembershipWrites || membershipPending.has(p.id) ? 'disabled' : ''}><img src="assets/vertex-logo.svg" alt=""></button>` : ''}</span></div>`,
        )
        .join('') +
      '</div>' +
      (contributors.length ? '' : `<p class="state-block">${__('contributors.empty')}</p>`) +
      (nextContributorCursor
        ? `<div class="form-submit-row"><button type="button" class="chrome-btn-outline contributor-next-page">${__('contributors.ui.loadMore')}</button></div>`
        : ''),
  );
  listContainer.querySelector('.contributor-next-page')?.addEventListener('click', async (e) => {
    const button = e.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    try {
      await loadContributors(true);
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
  listContainer.querySelectorAll('[data-membership]').forEach(
    (b) =>
      (b.onclick = () =>
        toggleMembership(
          contributors.find((p) => p.id === b.dataset.membership),
          b,
        )),
  );
  listContainer
    .querySelectorAll('[data-details]')
    .forEach((b) => (b.onclick = () => openContributorDetails(contributors.find((p) => p.id === b.dataset.details))));
  listContainer.querySelectorAll('.contributor-row').forEach((row) => {
    row.tabIndex = 0;
    const open = () => openContributorDetails(contributors.find((p) => p.id === row.dataset.contributorId));
    row.addEventListener('click', (event) => {
      if (event.target.closest('button,a,input,select,textarea,label,[role="button"]')) return;
      if (window.getSelection()?.toString()) return;
      open();
    });
    row.addEventListener('keydown', (event) => {
      if (event.target !== row || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      open();
    });
  });
  listContainer.querySelectorAll('.certificate-manage-btn').forEach(
    (b) =>
      (b.onclick = () =>
        openCertificates(
          contributors.find((p) => p.id === b.dataset.id),
          fetchContributorsData,
          b,
        )),
  );
  // Add event listeners to edit (pencil) buttons
  const editBtns = listContainer.querySelectorAll('.edit-contributor-btn:not(.certificate-manage-btn)');
  editBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const contributor = (contributorsStore.value || []).find((item) => item.id === id);
      if (contributor) openContributorEditor(contributor);
    });
  });
}

// --- Kalem düzenleme: başvurunun temel alanlarını komple değiştirme ---

onSessionReset(() => {
  requestGuard.begin();
  contributorsStore.clear();
  listContainer?.replaceChildren();
  stopVerification();
});
