import { contributorsStore } from '../../stores/areaStore.js';
import { openCertificateEmailTemplates } from '../certificateEmailTemplates.js';
import { deploymentCapabilities } from '../../core/deployment-capabilities.js';
import { changedContributorFields } from '../../utils/contributor-edit.js';
import { displayDepartmentName, canonicalDepartment } from '../../utils/departments.js';
import { icon } from '../../utils/icons.js';
import { openDrawer, closeDrawer, confirmDialog, openPopover, closePopover } from '../shell.js';
import { setButtonLoading } from '../../utils/loading.js';
import { formatCertificateDate } from '../certificates.js';
import { openCertificates } from '../certificates.js';
import { showToast, userErrorMessage, __, onLangChange, escapeHTML } from '../../utils/ui.js';
import {
  getVertexContributorsFn,
  toggleContributorVerificationFn,
  deleteVertexContributorFn,
  updateContributorApplicationFn,
  setContributorVertexStatusFn,
  consolePeopleCall,
  auth,
  db,
} from '../../core/firebase.js';
import { getEffectivePanelLevel, DEPARTMENTS, isPanelAdmin } from '../roles.js';

export function createContributorSurfaces({
  refresh: fetchContributorsData,
  render: renderContributors,
  birthDateLabel,
}) {
  const membershipPending = new Set();
  const verificationListeners = new Map();
  function toDatetimeLocalValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function openContributorEditor(contributor) {
    if (getEffectivePanelLevel('contributors.list') !== 'write') return;
    const card = openDrawer({
      title: __('contributors.edit_title'),
      titleKey: 'contributors.edit_title',
      footerHTML: `<button type="submit" form="contributor-editor-form" class="chrome-btn-primary"><span data-i18n="contributors.save_btn">${__('contributors.save_btn')}</span></button><button type="button" class="chrome-btn-outline ce-cancel-btn"><span data-i18n="contributors.cancel_btn">${__('contributors.cancel_btn')}</span></button>`,
    });
    const originalDepartment = canonicalDepartment(contributor.department, DEPARTMENTS);
    const deptOptions = [...new Set(['', ...DEPARTMENTS.map((d) => d.id), originalDepartment])]
      .map(
        (id) =>
          `<option value="${escapeHTML(id)}" ${originalDepartment === id ? 'selected' : ''}>${escapeHTML(displayDepartmentName(id))}</option>`,
      )
      .join('');
    const langOptions = [...new Set([contributor.language || 'en', 'tr', 'en'])]
      .map(
        (code) =>
          `<option value="${code}" ${contributor.language === code ? 'selected' : ''}>${code === 'tr' ? __('language.tr') : code === 'en' ? __('language.en') : escapeHTML(code)}</option>`,
      )
      .join('');

    card.innerHTML = `
        <form id="contributor-editor-form" class="contributor-edit-form form-stack">
            <div class="contributor-edit-grid">
                <div class="form-group-field">
                    <label for="ce-name" data-i18n="contributors.field_name">${__('contributors.field_name')}</label>
                    <input type="text" id="ce-name" value="${escapeHTML(contributor.name || '')}" required>
                </div>
                <div class="form-group-field">
                    <label for="ce-email" data-i18n="contributors.field_email">${__('contributors.field_email')}</label>
                    <input type="email" id="ce-email" value="${escapeHTML(contributor.email || '')}">
                </div>
                ${contributor.additionalEmail ? `<div class="form-group-field"><label for="ce-additional-email">${__('contributors.ui.additionalAccountEmail')}</label><input type="email" id="ce-additional-email" value="${escapeHTML(contributor.additionalEmail)}" readonly></div>` : ''}
                <div class="form-group-field">
                    <label for="ce-phone" data-i18n="contributors.field_phone">${__('contributors.field_phone')}</label>
                    <input type="text" id="ce-phone" value="${escapeHTML(contributor.phone || '')}">
                </div>
                <div class="form-group-field">
                    <label for="ce-birth-date" data-i18n="contributors.field_birth_date">${__('contributors.field_birth_date')}</label>
                    <input type="date" id="ce-birth-date" max="${new Date().toISOString().slice(0, 10)}" value="${escapeHTML(contributor.birthDate || '')}">
                </div>
                <div class="form-group-field">
                    <label for="ce-dept" data-i18n="contributors.field_department">${__('contributors.field_department')}</label>
                    <select id="ce-dept">${deptOptions}</select>
                </div>
                <div class="form-group-field">
                    <label for="ce-lang" data-i18n="contributors.field_language">${__('contributors.field_language')}</label>
                    <select id="ce-lang">${langOptions}</select>
                </div>
                <div class="form-group-field">
                    <label for="ce-linkedin" data-i18n="contributors.field_linkedin">${__('contributors.field_linkedin')}</label>
                    <input type="url" id="ce-linkedin" value="${escapeHTML(contributor.linkedin || '')}">
                </div>
                <div class="form-group-field">
                    <label for="ce-github" data-i18n="contributors.field_github">${__('contributors.field_github')}</label>
                    <input type="url" id="ce-github" value="${escapeHTML(contributor.github || '')}">
                </div>
                <div class="form-group-field">
                    <label for="ce-application-date">${__('manual_application.application_date')}</label>
                    <input type="datetime-local" id="ce-application-date" value="${toDatetimeLocalValue(contributor.applicationDate)}">
                </div>
                <div class="form-group-field">
                    <label for="ce-interview" data-i18n="contributors.field_interview">${__('contributors.field_interview')}</label>
                    <input type="datetime-local" id="ce-interview" value="${toDatetimeLocalValue(contributor.interviewDate)}">
                </div>
            </div>
            <div class="form-group-field">
                <label for="ce-about" data-i18n="contributors.field_about">${__('contributors.field_about')}</label>
                <textarea id="ce-about" rows="4">${escapeHTML(contributor.about || '')}</textarea>
            </div>
        </form>
    `;

    card
      .closest('.vx-drawer')
      .querySelector('.ce-cancel-btn')
      .addEventListener('click', () => closeDrawer());

    card.querySelector('.contributor-edit-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitBtn = card.closest('.vx-drawer').querySelector('button[type="submit"]');
      if (submitBtn.disabled) return;

      // Submit the actual delta, not every field from the edit form.
      const drawer = card.closest('.vx-drawer');
      const updates = changedContributorFields(
        contributor,
        {
          name: card.querySelector('#ce-name').value,
          email: card.querySelector('#ce-email').value,
          phone: card.querySelector('#ce-phone').value,
          birthDate: card.querySelector('#ce-birth-date').value,
          department: card.querySelector('#ce-dept').value,
          language: card.querySelector('#ce-lang').value,
          linkedin: card.querySelector('#ce-linkedin').value,
          github: card.querySelector('#ce-github').value,
          interviewDate: card.querySelector('#ce-interview').value,
          applicationDate: card.querySelector('#ce-application-date').value,
          about: card.querySelector('#ce-about').value,
        },
        {
          department: originalDepartment,
          interviewDate: toDatetimeLocalValue(contributor.interviewDate),
          applicationDate: toDatetimeLocalValue(contributor.applicationDate),
        },
      );
      if (!Object.keys(updates).length) {
        if (drawer.classList.contains('is-open')) closeDrawer();
        return;
      }
      setButtonLoading(submitBtn, true);
      try {
        // datetime-local values are in the operator's timezone; preserve
        // the selected instant; malformed dates keep the form available.
        for (const field of ['applicationDate', 'interviewDate']) {
          if (updates[field]) updates[field] = new Date(updates[field]).toISOString();
        }
        const { data } = await updateContributorApplicationFn({ contributorId: contributor.id, ...updates });
        if (data?.success !== true) throw new Error('Application update not confirmed.');
        Object.assign(contributor, updates);
        const cached = (contributorsStore.value || []).find((p) => p.id === contributor.id);
        if (cached && cached !== contributor) Object.assign(cached, updates);
        if (contributorsStore.value) renderContributors(contributorsStore.value);
        // Do not inadvertently dismiss a newer drawer.
        if (drawer.classList.contains('is-open')) closeDrawer();
        showToast(() => __('contributors.edit_updated'), 'success');
        void fetchContributorsData();
      } catch (error) {
        console.error('[CONTRIBUTORS] Edit failed:', error);
        showToast(() => userErrorMessage(error), 'error');
      } finally {
        if (submitBtn.isConnected) setButtonLoading(submitBtn, false);
      }
    });
  }

  // Listen only to the current Contributor record. The approval is immediate;
  // Gmail delivery can finish later, without polling the full applicant directory.
  function watchContributorVerification(id, viewerUid) {
    if (!viewerUid || verificationListeners.has(id) || auth.currentUser?.uid !== viewerUid) return;
    let unsubscribe = () => {},
      closed = false;
    const stop = () => {
      if (closed) return;
      closed = true;
      verificationListeners.delete(id);
      unsubscribe();
    };
    verificationListeners.set(id, stop);
    try {
      unsubscribe = db
        .collection('contributors')
        .doc(id)
        .onSnapshot(
          (snapshot) => {
            if (auth.currentUser?.uid !== viewerUid || !snapshot.exists) {
              stop();
              return;
            }
            const current = snapshot.data() || {},
              status = current.certificateDeliveryStatus;
            const person = (contributorsStore.value || []).find((p) => p.id === id);
            if (person) {
              person.hasVerified = current.hasVerified === true;
              person.emailSent = current.emailSent === true;
              person.certificateDeliveryStatus = status;
              document.dispatchEvent(new CustomEvent('vertex:contributor-updated', { detail: { person } }));
              renderContributors(contributorsStore.value);
            }
            if (['succeeded', 'failed', 'uncertain', 'revoked'].includes(status)) {
              stop();
              if (status === 'succeeded') showToast(() => __('contributors.delivery_succeeded'), 'success');
              else if (['failed', 'uncertain'].includes(status))
                showToast(() => __('contributors.delivery_failed'), 'error');
            }
          },
          (error) => {
            console.warn('[CONTRIBUTORS] Live certificate status unavailable', error.code);
            stop();
            showToast(() => __('contributors.delivery_refresh_error'), 'info');
          },
        );
      if (closed) unsubscribe();
    } catch (error) {
      stop();
      console.warn('[CONTRIBUTORS] Cannot subscribe to verification status', error.code);
    }
  }

  function openContributorDetails(person) {
    let body,
      pending = false;
    function paint() {
      if (!body?.isConnected) return;
      const rows = [
        ['contributors.field_department', displayDepartmentName(person.department)],
        ['contributors.field_email', person.email],
        ['contributors.field_phone', person.phone],
        ['contributors.field_birth_date', birthDateLabel(person)],
        [
          'contributors.field_language',
          person.language === 'tr' ? __('language.tr') : person.language === 'en' ? __('language.en') : person.language,
        ],
        [
          'contributors.col_status',
          person.hasVerified ? __('contributors.verified_label') : __('contributors.unverified_label'),
        ],
        [
          'contributors.delivery_label',
          __(
            person.emailSent === true
              ? 'contributors.delivery_succeeded'
              : ['pending', 'processing'].includes(person.certificateDeliveryStatus)
                ? 'contributors.delivery_pending'
                : ['uncertain', 'failed'].includes(person.certificateDeliveryStatus)
                  ? 'contributors.delivery_failed'
                  : 'contributors.delivery_unconfirmed',
          ),
        ],
        ['contributors.applied_at', formatCertificateDate(person.createdAt)],
        ['contributors.field_interview', formatCertificateDate(person.interviewDate)],
        ['cert.joined', person.joinedAt ? formatCertificateDate(person.joinedAt) : __('cert.not_joined')],
      ];
      if (person.additionalEmail)
        rows.splice(2, 0, [__('contributors.ui.additionalAccountEmail'), person.additionalEmail]);
      body.innerHTML = `<dl class="detail-list">${rows.map(([label, value]) => `<div class="detail-row"><dt>${__(label)}</dt><dd>${escapeHTML(String(value ?? '—'))}</dd></div>`).join('')}</dl>${person.about ? `<p class="drawer-bio">${escapeHTML(person.about)}</p>` : ''}<div class="contributor-links">${[
        'linkedin',
        'github',
      ]
        .filter((k) => /^https?:\/\//.test(person[k] || ''))
        .map(
          (k) =>
            `<a class="chrome-btn-outline" href="${escapeHTML(person[k])}" target="_blank" rel="noopener noreferrer">${icon('brand-' + k)}${k === 'linkedin' ? 'LinkedIn' : 'GitHub'}</a>`,
        )
        .join('')}</div>`;
      const footer = body.closest('.vx-drawer').querySelector('.vx-drawer-footer');
      if (isPanelAdmin() && person.isVertex === true) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'chrome-btn-outline';
        retry.textContent = __('contributors.retryAccountSetup');
        retry.onclick = async () => {
          retry.disabled = true;
          try {
            const { data } = await consolePeopleCall('provisionContributorAccount', { contributorId: person.id });
            const ok = ['sent', 'existing-account', 'ownership-required'].includes(data?.status);
            showToast(
              () =>
                document.documentElement.lang === 'en'
                  ? ok
                    ? 'Account setup checked. Existing accounts are preserved.'
                    : 'Email delivery requires review; no duplicate email was sent.'
                  : ok
                    ? 'Hesap kurulumu kontrol edildi. Mevcut hesaplar korundu.'
                    : __('contributors.ui.emailDeliveryRequiresReviewNoDuplicateEmail'),
              ok ? 'success' : 'error',
            );
          } catch (error) {
            showToast(() => userErrorMessage(error), 'error');
          } finally {
            retry.disabled = false;
          }
        };
        body.append(retry);
      }
      footer.innerHTML = `${getEffectivePanelLevel('contributors.list') === 'write' ? `<button class="chrome-btn-primary" data-edit>${icon('pencil')}${__('contributors.edit_title')}</button>` : ''}${isPanelAdmin() ? `<button class="chrome-btn-outline" data-certificate>${icon('award')}${__('cert.management')}</button><button class="chrome-btn-outline" data-more aria-label="${__('contributors.more')}">${icon('dots')}</button>` : ''}`;
      footer.querySelectorAll('button').forEach((b) => (b.disabled = pending));
      footer.querySelector('[data-edit]')?.addEventListener('click', () => openContributorEditor(person));
      footer
        .querySelector('[data-certificate]')
        ?.addEventListener('click', (e) => openCertificates(person, fetchContributorsData, e.currentTarget));
      footer.querySelector('[data-more]')?.addEventListener('click', (e) =>
        openPopover(e.currentTarget, {
          className: 'contributor-actions-popover',
          render(menu) {
            menu.innerHTML = `<div class="menu-list"><button class="menu-item" data-verify ${person.hasVerified && ['pending', 'processing'].includes(person.certificateDeliveryStatus) ? 'disabled' : ''}>${icon('check')}${person.hasVerified ? __('contributors.unverify') : __('contributors.verify')}</button><button class="menu-item" data-delete>${icon('trash')}${__('contributors.delete_action')}</button></div>`;
            menu.querySelector('[data-verify]').onclick = async () => {
              if (
                pending ||
                !isPanelAdmin() ||
                (person.hasVerified && ['pending', 'processing'].includes(person.certificateDeliveryStatus))
              )
                return;
              pending = true;
              closePopover();
              paint();
              const next = !person.hasVerified;
              try {
                const { data } = await toggleContributorVerificationFn({ contributorId: person.id, hasVerified: next });
                const status = data?.status;
                if (['verified', 'unverified'].includes(status)) {
                  person.hasVerified = status === 'verified';
                  showToast(() => __('contributors.verify_updated'), 'success');
                } else {
                  if (
                    next &&
                    !['pending', 'processing', 'succeeded', 'legacy', 'uncertain', 'failed', 'revoked'].includes(status)
                  )
                    throw Object.assign(new Error('Unconfirmed certificate response'), { code: 'functions/internal' });
                  if (next && ['uncertain', 'failed', 'revoked'].includes(status)) {
                    person.hasVerified = false;
                    person.certificateDeliveryStatus = status;
                    showToast(() => __('contributors.delivery_failed'), 'error');
                  } else if (next) {
                    // The server saved hasVerified=true with the issuance ledger.
                    person.hasVerified = true;
                    person.emailSent = status === 'succeeded';
                    person.certificateDeliveryStatus =
                      status === 'succeeded' ? 'succeeded' : status === 'legacy' ? 'legacy' : 'pending';
                    showToast(
                      () =>
                        __(
                          status === 'succeeded'
                            ? 'contributors.delivery_succeeded'
                            : status === 'legacy'
                              ? 'contributors.delivery_unconfirmed'
                              : 'contributors.delivery_pending',
                        ),
                      status === 'succeeded' ? 'success' : 'info',
                    );
                    if (['pending', 'processing'].includes(status))
                      watchContributorVerification(person.id, auth.currentUser?.uid);
                  } else {
                    person.hasVerified = false;
                    person.certificateDeliveryStatus = 'revoked';
                    showToast(() => __('contributors.verify_updated'), 'success');
                  }
                }
                const list = contributorsStore.value || [];
                const cached = list.find((p) => p.id === person.id);
                if (cached && cached !== person)
                  Object.assign(cached, {
                    hasVerified: person.hasVerified,
                    emailSent: person.emailSent,
                    certificateDeliveryStatus: person.certificateDeliveryStatus,
                  });
                if (list.length) renderContributors(list);
                document.dispatchEvent(new CustomEvent('vertex:contributor-updated', { detail: { person } }));
                void fetchContributorsData();
              } catch (error) {
                showToast(() => userErrorMessage(error), 'error');
              } finally {
                pending = false;
                paint();
              }
            };
            menu.querySelector('[data-delete]').onclick = async () => {
              if (pending || !isPanelAdmin()) return;
              closePopover();
              if (
                !(await confirmDialog(() => ({
                  title: __('contributors.delete_action'),
                  body: __('contributors.delete_warning'),
                  confirmLabel: __('contributors.delete_action'),
                  danger: true,
                })))
              )
                return;
              pending = true;
              paint();
              try {
                await deleteVertexContributorFn({ contributorId: person.id });
                closeDrawer();
                showToast(() => __('contributors.deleted'), 'success');
                await fetchContributorsData();
              } catch (error) {
                console.error('[CONTRIBUTORS] Delete failed', error.code || 'unknown');
                showToast(() => userErrorMessage(error), 'error');
                pending = false;
                paint();
              }
            };
          },
        }),
      );
    }
    const syncPerson = (event) => {
      if (event.detail?.person?.id !== person.id) return;
      Object.assign(person, event.detail.person);
      paint();
    };
    document.addEventListener('vertex:contributor-updated', syncPerson);
    const unsubscribe = onLangChange(paint);
    body = openDrawer({
      title: person.name,
      footerHTML: ' ',
      onAfterClose() {
        unsubscribe();
        document.removeEventListener('vertex:contributor-updated', syncPerson);
      },
    });
    paint();
  }

  async function toggleMembership(person, button) {
    if (
      !deploymentCapabilities.contributorMembershipWrites ||
      !isPanelAdmin() ||
      !person ||
      membershipPending.has(person.id)
    )
      return;
    membershipPending.add(person.id);
    setButtonLoading(button, true);
    try {
      const confirmed = await confirmDialog(() => ({
        title: __('subnav.vertex_status'),
        warning: __('contributors.vertex_confirm'),
        rows: [
          { label: __('contributors.field_email'), value: escapeHTML(person.email) },
          { label: __('contributors.ui.contributor'), value: escapeHTML(person.id) },
        ],
      }));
      if (!confirmed) return;
      const existing = person.isVertex === true;
      const { data } = await setContributorVertexStatusFn({
        contributorId: person.id,
        isVertex: !existing,
        expectedStatus: existing,
        expectedFieldExists: Object.prototype.hasOwnProperty.call(person, 'isVertex'),
      });
      if (typeof data.isVertex !== 'boolean') throw new Error('Invalid membership response');
      person.isVertex = data.isVertex;
      if (person.membership) {
        person.membership.fieldExists = true;
        person.membership.isVertex = data.isVertex;
      }
      if (data.joinedAtSet) person.joinedAt = new Date();
      if (data.isVertex && data.accountSetupStatus) {
        const ready = ['sent', 'existing-account', 'ownership-required'].includes(data.accountSetupStatus);
        showToast(
          () =>
            document.documentElement.lang === 'en'
              ? ready
                ? 'Membership active. Account: ' + data.accountSetupStatus + '.'
                : 'Membership active, but account email needs attention. Use Retry account setup in the application details.'
              : ready
                ? __('contributors.ui.membershipIsActive') +
                  (data.accountSetupStatus === 'sent'
                    ? __('contributors.ui.thePasswordSetupEmailWasSent')
                    : 'Mevcut hesap korundu.')
                : __('contributors.ui.membershipIsActiveButTheAccountEmail'),
          ready ? 'success' : 'error',
        );
      } else showToast(() => __(data.isVertex ? 'system.vertex_enabled' : 'system.vertex_disabled'), 'success');
      renderContributors(contributorsStore.value || []);
    } catch (error) {
      showToast(() => userErrorMessage(error), 'error');
    } finally {
      membershipPending.delete(person.id);
      setButtonLoading(button, false);
      renderContributors(contributorsStore.value || []);
    }
  }
  function openCertificateSelector() {
    if (!isPanelAdmin()) return;
    let disposeCertificate,
      query = '',
      scroll = 0,
      people = Array.isArray(contributorsStore.value) ? contributorsStore.value.filter((p) => p?.id).slice(0, 50) : [],
      cursor = null,
      pending = false;
    let generation = 0,
      debounce = null;
    const body = openDrawer({
      title: __('cert.select_person'),
      onAfterClose() {
        generation++;
        clearTimeout(debounce);
        disposeCertificate?.();
        unsubscribe();
      },
    });
    const root = body.closest('.vx-drawer');
    const unsubscribe = onLangChange(() => {
      if (body.classList.contains('certificate-selector-body')) paint();
    });
    async function paint() {
      if (!body.isConnected) return;
      root.classList.remove('certificate-drawer');
      root.querySelector('[data-cert-back]')?.remove();
      root.querySelector('.vx-drawer-footer')?.remove();
      root.querySelector('.vx-drawer-title').textContent = __('cert.select_person');
      root.setAttribute('aria-label', __('cert.select_person'));
      body.classList.add('certificate-selector-body');
      body.innerHTML = `<button type="button" class="chrome-btn-outline template-manage-entry" data-email-templates>${__('email_templates.title')}</button><div class="certificate-person-search"><label for="certificate-person-search">${__('cert.search_person')}</label><div class="search-field">${icon('search')}<input id="certificate-person-search" type="search" placeholder="${__('cert.search_person')}" value="${escapeHTML(query)}"></div></div><div class="certificate-person-list"></div>`;
      body.querySelector('[data-email-templates]').onclick = openCertificateEmailTemplates;
      const search = body.querySelector('input'),
        list = body.querySelector('.certificate-person-list');
      function render() {
        if (!body.classList.contains('certificate-selector-body')) return;
        const normalized = query.trim().toLocaleLowerCase('tr');
        const visible = normalized
          ? people.filter((p) =>
              [p.name, p.email, p.id].some((value) =>
                String(value || '')
                  .toLocaleLowerCase('tr')
                  .includes(normalized),
              ),
            )
          : people;
        list.innerHTML =
          visible
            .map(
              (p) =>
                `<button class="certificate-person-row" data-person="${escapeHTML(p.id)}"><span><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.email || '')}</small></span>${icon('award')}</button>`,
            )
            .join('') || `<p class="state-block">${pending ? __('common.loading') : __('contributors.empty')}</p>`;
        if (cursor)
          list.insertAdjacentHTML(
            'beforeend',
            `<button type="button" class="chrome-btn-outline certificate-next-page">${__('contributors.ui.loadMore')}</button>`,
          );
        list.scrollTop = scroll;
        list.querySelectorAll('[data-person]').forEach(
          (button) =>
            (button.onclick = () => {
              const selected = people.find((p) => p.id === button.dataset.person);
              if (!selected) return;
              scroll = list.scrollTop;
              body.classList.remove('certificate-selector-body');
              openCertificates(selected, fetchContributorsData, button, {
                body,
                onBack() {
                  paint();
                },
                onDispose(fn) {
                  disposeCertificate = fn;
                },
              });
            }),
        );
        list.querySelector('.certificate-next-page')?.addEventListener('click', () => loadPage(false));
      }
      async function loadPage(reset) {
        if (pending && !reset) return;
        const token = ++generation;
        if (reset) {
          cursor = null;
          scroll = 0;
        } // Preserve local results until the new server query returns.
        pending = true;
        render();
        try {
          const { data } = await getVertexContributorsFn({
            pageSize: 25,
            filter: 'all',
            search: query,
            cursor,
          });
          if (token !== generation || !body.classList.contains('certificate-selector-body')) return;
          people = reset
            ? data.contributors || []
            : [...people, ...(data.contributors || []).filter((p) => !people.some((existing) => existing.id === p.id))];
          cursor = data.nextCursor || null;
        } catch (error) {
          if (token === generation) showToast(() => userErrorMessage(error), 'error');
        } finally {
          if (token === generation) {
            pending = false;
            render();
          }
        }
      }
      search.oninput = () => {
        query = search.value;
        scroll = 0;
        clearTimeout(debounce);
        ++generation;
        pending = false;
        cursor = null;
        // Instant filter feedback for the current authorized page; the
        // server search follows so matches from other pages also appear.
        render();
        debounce = setTimeout(() => {
          if (body.isConnected) void loadPage(true);
        }, 300);
      };
      search.focus();
      render();
      void loadPage(true);
    }
    void paint();
  }

  return {
    openContributorEditor,
    openContributorDetails,
    watchContributorVerification,
    toggleMembership,
    openCertificateSelector,
    membershipPending,
    stopVerification: () => {
      for (const stop of verificationListeners.values()) stop();
    },
  };
}
