import { formatMessage } from '../lang.js';
import { __, userErrorMessage } from '../utils/ui.js';
import { registerListRefresh } from '../ui/listRefresh.js';
import { registrationValue, registrationCSVCell } from '../utils/event-registration-values.js';
import { renderPager } from '../ui/pager.js';
import { deploymentCapabilities } from '../core/deployment-capabilities.js';
import { beginPanelLoading, setButtonLoading } from '../utils/loading.js';
import { crossfade } from '../ui/transition.js';
import { showLoadError } from '../ui/states.js';
import { eventLocalTime, eventInstant } from './eventTime.js';
import { mountEventFields } from './eventFields.js';
import { auth, eventCallable } from '../core/firebase.js';
import { getEffectivePanelLevel } from './roles.js';
import { confirmDialog } from './shell.js';
import { escapeHTML, showToast, getLang, onLangChange } from '../utils/ui.js';
const tr = (key) => __(key);
const fields = [
  ['id', 'events.ui.id', 'events.ui.id', 'text'],
  ['title', 'weekly_stars.title_label', 'weekly_stars.title_label', 'text'],
  ['title_en', 'events.ui.englishTitle', 'events.ui.englishTitle', 'text'],
  ['desc', 'chat.description_label', 'chat.description_label', 'textarea'],
  ['desc_en', 'events.ui.englishDescription', 'events.ui.englishDescription', 'textarea'],
  ['detailDesc', 'events.ui.content', 'events.ui.content', 'textarea'],
  ['detailDesc_en', 'events.ui.englishContent', 'events.ui.englishContent', 'textarea'],
  ['date', 'reports.date', 'reports.date', 'date'],
  ['timeZone', 'events.ui.timeZoneIana', 'events.ui.timeZoneIana', 'text'],
  ['startsAt', 'events.ui.startDateAndTime', 'events.ui.startDateAndTime', 'datetime-local'],
  ['endsAt', 'events.ui.endDateAndTime', 'events.ui.endDateAndTime', 'datetime-local'],
  ['location', 'beacons.location', 'beacons.location', 'text'],
  ['location_en', 'events.ui.englishLocation', 'events.ui.englishLocation', 'text'],
  ['mapUrl', 'events.ui.mapLink', 'events.ui.mapLink', 'url'],
  ['cover', 'events.ui.coverUrl', 'events.ui.coverUrl', 'url'],
  ['images', 'events.ui.galleryUrlsOnePerLine', 'events.ui.galleryUrlsOnePerLine', 'textarea'],
  ['capacity', 'events.ui.capacityBlankUnlimited', 'events.ui.capacityBlankUnlimited', 'number'],
  ['price', 'events.ui.price0FreeMultipleCategories', 'events.ui.price0FreeMultipleCategories', 'text'],
  ['stripeLink', 'events.ui.stripePaymentLink', 'events.ui.stripePaymentLink', 'url'],
  ['stripeLinkStandart', 'events.ui.standardStripeLink', 'events.ui.standardStripeLink', 'url'],
  ['stripeLinkSpesiyal', 'events.ui.specialStripeLink', 'events.ui.specialStripeLink', 'url'],
  ['speakers', 'events.ui.speakersJsonArray', 'events.ui.speakersJsonArray', 'textarea'],
  [
    'ticketCategories',
    'events.ui.ticketCategoriesJsonNamePriceStripelink',
    'events.ui.ticketCategoriesJsonNamePriceStripelink',
    'textarea',
  ],
  [
    'translations',
    'events.ui.otherLanguagesJsonLanguageCodes',
    'events.ui.otherLanguagesJsonLanguageCodes',
    'textarea',
  ],
];
let current = null;
let registrationEpoch = 0;
export function initEventsModule() {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      registrationEpoch++;
      document.getElementById('events-registrations')?.replaceChildren();
      setButtonLoading(document.getElementById('events-load-registrations'), false);
    }
  });
  const form = document.getElementById('events-editor');
  const container = document.getElementById('events-fields');
  const updateActionLabels = () => {
    for (const [id, trLabel, enLabel] of [
      ['events-preview', 'people.preview', 'people.preview'],
      ['events-editor-submit', 'common.save', 'common.save'],
      ['events-new', 'events.ui.new', 'events.ui.new'],
      ['events-load-registrations', 'events.ui.loadRegistrations', 'events.ui.loadRegistrations'],
    ]) {
      const control = document.getElementById(id);
      if (control) control.textContent = tr(trLabel, enLabel);
    }
    const refresh = document.getElementById('events-refresh');
    if (refresh) refresh.setAttribute('aria-label', __('common.refresh'));
    const fieldLabel = document.querySelector('label[for="events-registration-search"]');
    if (fieldLabel) fieldLabel.textContent = __('events.ui.eventId');
    const reviewLabel = document.getElementById('events-review-label');
    if (reviewLabel?.lastChild?.nodeType === 3)
      reviewLabel.lastChild.textContent = ' ' + __('events.ui.dateDiscrepancyVerifiedAgainstSource');
  };
  updateActionLabels();
  onLangChange(updateActionLabels);
  container.innerHTML =
    fields
      .map(
        ([key, a, b, type]) =>
          `<div class="form-group-field"><label for="event-${key}">${escapeHTML(tr(a, b))}</label>${type === 'textarea' ? `<textarea id="event-${key}" name="${key}" rows="3"></textarea>` : `<input id="event-${key}" name="${key}" type="${type}" ${['id', 'title', 'desc', 'date', 'timeZone', 'location'].includes(key) ? 'required' : ''}>`}</div>`,
      )
      .join('') +
    `<div class="form-group-field"><label for="event-status">${__('catalog.status_short')}</label><select id="event-status" name="status"><option value="draft">${__('events.ui.draft')}</option><option value="published">${__('events.ui.published')}</option><option value="cancelled">${__('events.ui.cancelled')}</option></select></div><div class="form-group-field"><label for="event-sales">${__('events.ui.salesStatus')}</label><select id="event-sales" name="salesStatus"><option value="closed">${__('events.ui.closed')}</option><option value="open">${__('chat.task_open')}</option><option value="sold_out">${__('events.ui.soldOut')}</option></select></div><div class="form-group-field"><label>${__('events.ui.uploadImage')}<input type="file" id="event-upload" accept="image/jpeg,image/png,image/webp"></label></div><div class="form-group-field"><label>${__('events.ui.uploadGalleryImages')}<input type="file" id="event-gallery-upload" accept="image/jpeg,image/png,image/webp" multiple></label></div>`;
  form.elements.startsAt.onchange = () => {
    if (form.elements.startsAt.value) form.elements.date.value = form.elements.startsAt.value.slice(0, 10);
  };
  const refreshFields = mountEventFields(form, tr);
  const fail = (e) => showToast(userErrorMessage(e), 'error');
  const fill = (event) => {
    current = event;
    form.reset();
    for (const [key] of fields)
      form.elements[key].value =
        key === 'images'
          ? (event?.[key] || []).join('\n')
          : ['speakers', 'ticketCategories', 'translations'].includes(key)
            ? JSON.stringify(event?.[key] || (key === 'translations' ? {} : []), null, 2)
            : (event?.[key] ?? '');
    for (const key of ['startsAt', 'endsAt'])
      form.elements[key].value = eventLocalTime(event?.[key], event?.timeZone || 'Europe/Istanbul');
    form.elements.id.readOnly = !!event;
    form.elements.timeZone.value = event?.timeZone || 'Europe/Istanbul';
    form.elements.price.value = event?.price ?? 0;
    form.elements.status.value = event?.status || 'draft';
    form.elements.salesStatus.value = event?.salesStatus || 'closed';
    document.getElementById('events-review-label').hidden = !event?.dateReviewRequired;
    refreshFields();
    const writable = getEffectivePanelLevel('events.editor') === 'write';
    form.querySelectorAll('input,textarea,select,button').forEach((control) => {
      if (control.id === 'events-preview') return;
      control.disabled = !writable;
      if (!writable) control.dataset.roleDisabled = 'true';
    });
  };
  const collect = () => {
    const value = { ...current };
    for (const [key] of fields) {
      const raw = form.elements[key].value.trim();
      value[key] =
        key === 'images'
          ? raw.split('\n').filter(Boolean)
          : ['speakers', 'ticketCategories', 'translations'].includes(key)
            ? JSON.parse(raw || (key === 'translations' ? '{}' : '[]'))
            : raw;
    }
    if (value.startsAt) value.date = value.startsAt.slice(0, 10);
    for (const key of ['startsAt', 'endsAt']) value[key] = eventInstant(value[key], value.timeZone);
    value.price = value.price !== '' && Number.isFinite(Number(value.price)) ? Number(value.price) : value.price;
    value.capacity = value.capacity ? Number(value.capacity) : null;
    value.status = form.elements.status.value;
    value.salesStatus = form.elements.salesStatus.value;
    if (form.elements.dateReviewed.checked) value.dateReviewRequired = false;
    if (value.cover) value.banner = undefined;
    value.disableRegister = value.salesStatus !== 'open';
    return value;
  };
  const refresh = async () => {
    if (getEffectivePanelLevel('events.list') === 'none') return;
    const list = document.getElementById('events-list');
    const button = document.getElementById('events-refresh');
    const finishLoading = beginPanelLoading(list);
    setButtonLoading(button, true);
    try {
      const { data } = await eventCallable('listConsoleEvents', {});
      crossfade(list, () => {
        list.replaceChildren();
        for (const status of ['published', 'draft', 'cancelled']) {
          const title = document.createElement('h4');
          title.textContent = __('eventEditor.status.' + status);
          list.append(title);
          for (const event of data.events.filter((e) => e.status === status)) {
            const row = document.createElement('div');
            row.className = 'article-item';
            const label = document.createElement('span');
            label.textContent = `${event.title} · ${event.date} · ${event.timeZone}${event.dateReviewRequired ? ' ⚠' : ''}`;
            row.append(label);
            const actionGroup = document.createElement('div');
            actionGroup.className = 'event-row-actions';
            if (getEffectivePanelLevel('events.editor') !== 'none')
              for (const [text, handler] of [
                [
                  __('events.ui.open'),
                  () => {
                    fill(event);
                    document.querySelector('[data-nav-panel="events.editor"]').click();
                  },
                ],
                [
                  __('common.delete'),
                  async () => {
                    if (await confirmDialog({ title: __('events.ui.deleteEvent'), body: event.title })) {
                      await eventCallable('saveConsoleEvent', {
                        event: { ...event, status: 'deleted' },
                        revision: event.revision,
                      });
                      await refresh();
                    }
                  },
                ],
              ]) {
                if (text === __('common.delete') && getEffectivePanelLevel('events.editor') !== 'write') continue;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'chrome-btn-outline';
                button.textContent = text;
                button.onclick = () => Promise.resolve(handler()).catch(fail);
                actionGroup.append(button);
              }
            if (actionGroup.childElementCount) row.append(actionGroup);
            list.append(row);
          }
        }
      });
    } catch (error) {
      showLoadError(list, () => __('events.ui.couldNotLoadEvents'), refresh, { staleSelector: '.article-item' });
    } finally {
      finishLoading();
      setButtonLoading(button, false);
    }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button.disabled || getEffectivePanelLevel('events.editor') !== 'write') return;
    setButtonLoading(button, true);
    try {
      const event = collect();
      if (await confirmDialog({ title: __('events.ui.saveChanges'), body: `${event.title} · ${event.status}` })) {
        await eventCallable('saveConsoleEvent', { event, revision: current?.revision || 0 });
        fill(null);
        await refresh();
        showToast(__('perms.saved'), 'success');
      }
    } catch (e) {
      fail(e);
    } finally {
      setButtonLoading(button, false);
    }
  };
  document.getElementById('events-preview').onclick = () => {
    try {
      const event = collect(),
        box = document.getElementById('events-preview-content');
      box.hidden = false;
      box.replaceChildren();
      const lang = document.createElement('select');
      lang.setAttribute('aria-label', __('events.ui.previewLanguage'));
      for (const value of ['tr', 'en']) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value.toUpperCase();
        lang.append(option);
      }
      lang.value = getLang() === 'tr' ? 'tr' : 'en';
      box.append(lang);
      const article = document.createElement('article');
      article.className = 'ui-event-preview';
      const add = (parent, tag, value, className = '') => {
        const node = document.createElement(tag);
        node.textContent = String(value || '');
        if (className) node.className = className;
        parent.append(node);
        return node;
      };
      const paint = () => {
        article.replaceChildren();
        const language = lang.value;
        const local = (key) => (language === 'en' ? event[key + '_en'] || event[key] : event[key]);
        if (event.cover && /^https:\/\//.test(event.cover)) {
          const img = document.createElement('img');
          img.className = 'ui-event-cover';
          img.src = event.cover;
          img.alt = local('title') || event.title;
          img.loading = 'lazy';
          article.append(img);
        }
        const content = document.createElement('div');
        content.className = 'ui-event-content';
        article.append(content);
        add(
          content,
          'span',
          event.status === 'published'
            ? __('events.ui.published')
            : event.status === 'draft'
              ? __('events.ui.draft')
              : __('events.ui.cancelled'),
          'form-hint',
        );
        add(content, 'h2', local('title') || event.title);
        let formatted = event.date || '—';
        if (event.startsAt)
          try {
            formatted = new Intl.DateTimeFormat(language, {
              dateStyle: 'long',
              timeStyle: 'short',
              timeZone: event.timeZone,
            }).format(new Date(event.startsAt));
          } catch {}
        add(content, 'p', formatted + ' · ' + (event.timeZone || '—'), 'form-hint');
        add(content, 'p', local('location') || '—');
        add(content, 'p', local('desc'));
        if (local('detailDesc')) add(content, 'p', local('detailDesc'), 'ui-event-description');
        if (event.speakers?.length) {
          add(content, 'h3', __('events.ui.speakers'));
          const grid = document.createElement('div');
          grid.className = 'ui-event-grid';
          content.append(grid);
          for (const speaker of event.speakers) {
            const card = document.createElement('div');
            card.className = 'ui-event-card';
            grid.append(card);
            add(card, 'strong', speaker.name);
            add(card, 'p', language === 'en' ? speaker.role_en || speaker.role : speaker.role, 'form-hint');
          }
        }
        if (event.ticketCategories?.length) {
          add(content, 'h3', __('events.ui.tickets'));
          const grid = document.createElement('div');
          grid.className = 'ui-event-grid';
          content.append(grid);
          for (const ticket of event.ticketCategories) {
            const card = document.createElement('div');
            card.className = 'ui-event-card';
            grid.append(card);
            add(card, 'strong', ticket.name);
            add(
              card,
              'p',
              ticket.price ? String(ticket.price) + ' ' + (ticket.currency || 'TRY') : __('events.ui.free'),
            );
            if (ticket.description) add(card, 'p', ticket.description, 'form-hint');
          }
        }
      };
      lang.addEventListener('change', paint);
      paint();
      // Fall back to the local DOM preview until Eventsite's public renderer
      // announces that its sandboxed draft-preview mode is ready.
      const notice = document.createElement('p');
      notice.className = 'form-hint';
      notice.setAttribute('role', 'status');
      notice.textContent = __('events.ui.loadingEventsitePreview');
      const frame = document.createElement('iframe');
      frame.className = 'ui-eventsite-frame';
      frame.title = __('events.ui.eventsiteDraftPreview');
      frame.referrerPolicy = 'origin';
      frame.style.cssText =
        'width:100%;height:clamp(540px,75vh,960px);margin-top:12px;border:1px solid var(--border-color,rgba(127,127,127,.24));border-radius:16px;';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      frame.loading = 'eager';
      const origin = 'https://events.vertexishere.com';
      const preview = () => {
        armTimeout();
        frame.src = origin + '/' + lang.value + '/?vertexPreview=1';
      };
      let previewTimer = null;
      const armTimeout = () => {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(() => {
          if (frame.hidden) notice.textContent = __('events.ui.eventsitePreviewIsUnavailableShowingLocalDraft');
        }, 7500);
      };
      const onMessage = (message) => {
        if (message.origin !== origin || message.source !== frame.contentWindow || message.data?.version !== 1) return;
        if (message.data.type === 'vertex:event-preview:ready') {
          frame.contentWindow.postMessage(
            {
              type: 'vertex:event-preview:render',
              version: 1,
              event,
            },
            origin,
          );
        } else if (message.data.type === 'vertex:event-preview:rendered' && message.data.id === event.id) {
          clearTimeout(previewTimer);
          article.hidden = true;
          frame.hidden = false;
          notice.textContent = __('events.ui.realEventsiteRenderingDraftRegistrationDisabled');
        }
      };
      window.addEventListener('message', onMessage);
      const observer = new MutationObserver(() => {
        if (!frame.isConnected) {
          window.removeEventListener('message', onMessage);
          clearTimeout(previewTimer);
          observer.disconnect();
        }
      });
      observer.observe(box, { childList: true });
      frame.hidden = true;
      frame.src = 'about:blank';
      box.append(notice, frame, article);
      lang.addEventListener('change', () => {
        article.hidden = false;
        frame.hidden = true;
        notice.textContent = __('events.ui.loadingEventsitePreview');
        preview();
      });
      preview();
    } catch (e) {
      fail(e);
    }
  };
  document.getElementById('events-new').onclick = () => fill(null);
  registerListRefresh(document.getElementById('events-list'), refresh, {
    button: document.getElementById('events-refresh'),
  });
  document.getElementById('events-refresh').onclick = () => refresh().catch(fail);
  const upload = async (file) => {
    if (file.size > 10 * 1024 * 1024) throw Error(__('events.ui.maximum10Mb'));
    const { data } = await eventCallable('getEventImageUploadUrl', {
      eventId: form.elements.id.value,
      contentType: file.type,
    });
    const response = await fetch(data.url, { method: 'PUT', headers: data.headers, body: file });
    if (!response.ok) throw Error(__('events.ui.imageUploadFailed'));
    const completed = await eventCallable('completeEventImageUpload', { filePath: data.filePath });
    return completed.data.downloadUrl;
  };
  document.getElementById('event-upload').onchange = async (e) => {
    try {
      if (e.target.files[0]) form.elements.cover.value = await upload(e.target.files[0]);
    } catch (error) {
      fail(error);
    }
  };
  document.getElementById('event-gallery-upload').onchange = async (e) => {
    try {
      for (const file of e.target.files) {
        const url = await upload(file);
        form.elements.images.value = [form.elements.images.value.trim(), url].filter(Boolean).join('\n');
      }
    } catch (error) {
      fail(error);
    }
  };
  document.getElementById('events-load-registrations').onclick = async (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    const uid = auth.currentUser?.uid,
      epoch = ++registrationEpoch;
    if (!uid) return;
    const valid = () => registrationEpoch === epoch && auth.currentUser?.uid === uid;
    setButtonLoading(button, true);
    const box = document.getElementById('events-registrations');
    const finishLoading = beginPanelLoading(box);
    try {
      const eventId = document.getElementById('events-registration-search').value.trim();
      const { data } = await eventCallable('listEventRegistrations', {
        eventId,
        ...(deploymentCapabilities.eventRegistrationPages ? { pageSize: 100 } : {}),
      });
      if (!valid()) return;
      const rows = [...(data.registrations || [])];
      let nextCursor = data.nextCursor || null;
      let fetching = false;
      const fetchNext = async () => {
        if (!nextCursor || fetching) return;
        fetching = true;
        const cursor = nextCursor;
        try {
          const response = (await eventCallable('listEventRegistrations', { eventId, pageSize: 100, cursor })).data;
          if (!valid()) return;
          if (response.nextCursor === cursor) throw new Error(__('events.ui.paginationDidNotAdvance'));
          const known = new Set(rows.map((row) => row.id));
          rows.push(...(response.registrations || []).filter((row) => !known.has(row.id)));
          nextCursor = response.nextCursor || null;
        } finally {
          fetching = false;
        }
      };
      crossfade(box, () => {
        if (!valid()) return;
        box.replaceChildren();
        if (!rows.length) {
          const empty = document.createElement('p');
          empty.className = 'form-hint event-registration-empty';
          empty.textContent = __('events.ui.noRegistrationsFound');
          box.append(empty);
          return;
        }
        const search = document.createElement('input');
        search.type = 'search';
        search.placeholder = __('events.ui.searchRegistrations');
        search.setAttribute('aria-label', search.placeholder);
        search.className = 'event-registration-filter';
        box.append(search);
        const viewport = document.createElement('div');
        viewport.className = 'event-registration-viewport';
        box.append(viewport);
        const table = document.createElement('table');
        table.className = 'event-registration-table';
        viewport.append(table);
        const head = document.createElement('thead'),
          headrow = document.createElement('tr');
        head.append(headrow);
        for (const label of [
          __('deleteAccount.name_label'),
          __('cert.email'),
          __('catalog.status_short'),
          __('events.ui.ticket'),
          __('events.ui.registeredAt'),
        ]) {
          const th = document.createElement('th');
          th.textContent = label;
          headrow.append(th);
        }
        table.append(head);
        const body = document.createElement('tbody');
        table.append(body);
        const actions = document.createElement('div');
        actions.className = 'ui-list-actions';
        const exportButton = document.createElement('button');
        exportButton.type = 'button';
        exportButton.className = 'chrome-btn-outline';
        exportButton.textContent = __('events.ui.exportCsv');
        const loadMore = document.createElement('button');
        loadMore.type = 'button';
        loadMore.className = 'chrome-btn-outline';
        loadMore.textContent = __('events.ui.loadMoreRegistrations');
        loadMore.hidden = !nextCursor;
        const loadAll = document.createElement('button');
        loadAll.type = 'button';
        loadAll.className = 'chrome-btn-outline';
        loadAll.textContent = __('events.ui.searchAllRegistrations');
        loadAll.hidden = !nextCursor;
        const countLabel = document.createElement('span');
        countLabel.className = 'form-hint';
        actions.append(exportButton, loadMore, loadAll, countLabel);
        box.insertBefore(actions, viewport);
        let page = 1;
        const pageSize = 25;
        const columns = [
          ['name', 'deleteAccount.name_label', 'deleteAccount.name_label'],
          ['email', 'cert.email', 'cert.email'],
          ['status', 'catalog.status_short', 'catalog.status_short'],
          ['ticketCategory', 'events.ui.ticket', 'events.ui.ticket'],
          ['createdAt', 'events.ui.registeredAt', 'events.ui.registeredAt'],
        ];
        const visible = () =>
          rows.filter((row) =>
            [row.name, row.email, row.status, row.ticketCategory, row.id].some((v) =>
              String(v || '')
                .toLocaleLowerCase()
                .includes(search.value.toLocaleLowerCase()),
            ),
          );
        const value = (row, key) => registrationValue(row, key, getLang());
        const paint = () => {
          if (!valid()) return;
          body.replaceChildren();
          box.querySelector('.ui-pager')?.remove();
          const matches = visible();
          page = Math.min(page, Math.max(1, Math.ceil(matches.length / pageSize)));
          for (const row of matches.slice((page - 1) * pageSize, page * pageSize)) {
            const trEl = document.createElement('tr');
            for (const [key] of columns) {
              const td = document.createElement('td');
              td.textContent = value(row, key);
              trEl.append(td);
            }
            body.append(trEl);
          }
          renderPager(box, {
            page,
            total: matches.length,
            pageSize,
            language: getLang(),
            onChange: (next) => {
              page = next;
              paint();
            },
          });
          loadMore.hidden = !nextCursor;
          loadAll.hidden = !nextCursor;
          countLabel.textContent = nextCursor
            ? formatMessage('events.ui.registrationsLoadedMoreAvailable', { value0: rows.length })
            : formatMessage('events.ui.registrationsLoaded', { value0: rows.length });
        };
        const loadRemaining = async () => {
          if (fetching) return;
          setButtonLoading(loadAll, true);
          loadMore.disabled = exportButton.disabled = true;
          try {
            // Bounded in-browser collection. Large reports require a dedicated background export.
            while (valid() && nextCursor && rows.length < 2000) await fetchNext();
            if (nextCursor) showToast(__('events.ui.2000RecordsLoadedContactAnAdministrator'), 'info');
          } catch (error) {
            fail(error);
          } finally {
            setButtonLoading(loadAll, false);
            loadMore.disabled = false;
            if (exportButton.dataset.state !== 'loading') exportButton.disabled = false;
            paint();
          }
        };
        loadMore.onclick = async () => {
          if (!valid() || fetching || loadMore.disabled) return;
          setButtonLoading(loadMore, true);
          loadAll.disabled = exportButton.disabled = true;
          try {
            await fetchNext();
            page = Math.ceil(rows.length / pageSize);
            paint();
          } catch (error) {
            fail(error);
          } finally {
            setButtonLoading(loadMore, false);
            loadAll.disabled = false;
            if (exportButton.dataset.state !== 'loading') exportButton.disabled = false;
          }
        };
        loadAll.onclick = loadRemaining;
        search.addEventListener('input', () => {
          page = 1;
          paint();
        });
        exportButton.onclick = async () => {
          if (!valid() || exportButton.disabled) return;
          setButtonLoading(exportButton, true);
          try {
            if (
              !(await confirmDialog({
                title: __('events.ui.exportPersonalData'),
                body: __('events.ui.theVisibleEventRegistrationsWillBeExported'),
              }))
            )
              return;
            if (!valid()) return;
            if (nextCursor) await loadRemaining();
            if (!valid()) return;
            if (nextCursor) {
              showToast(__('events.ui.allRegistrationsMustBeLoadedBeforeExporting'), 'warning');
              return;
            }
            const escape = registrationCSVCell;
            const output = [
              columns.map(([, trLabel, en]) => (getLang() === 'tr' ? trLabel : en)),
              ...visible().map((row) => columns.map(([key]) => value(row, key))),
            ]
              .map((row) => row.map(escape).join(','))
              .join('\r\n');
            const blob = new Blob(['\ufeff', output], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'event-registrations.csv';
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } finally {
            setButtonLoading(exportButton, false);
          }
        };
        paint();
      });
    } catch (e) {
      if (valid())
        showLoadError(
          box,
          () => __('events.ui.couldNotLoadEventRegistrations'),
          () => button.click(),
          { staleSelector: '.event-registration-table' },
        );
    } finally {
      finishLoading();
      if (valid()) setButtonLoading(button, false);
    }
  };
  registerListRefresh(document.getElementById('events-registrations'), () => {
    const button = document.getElementById('events-load-registrations');
    return button.onclick({ currentTarget: button });
  });
  document.addEventListener('vertex:workspace', (e) => {
    if (e.detail.keys.includes('events.list')) refresh().catch(fail);
  });
  fill(null);
}
