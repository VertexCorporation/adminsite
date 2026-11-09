import { auth, consolePeopleCall } from '../core/firebase.js';
import { isPanelAdmin } from './roles.js';
import { openDrawer, closeDrawer, confirmDialog } from './shell.js';
import { getLang, onLangChange, __, showToast, userErrorMessage, escapeHTML } from '../utils/ui.js';
const levels = ['NODE', 'EDGE', 'GRAPH', 'NETWORK'];
const tasks = [
  'community',
  'badge',
  'mentoring',
  'startupReview',
  'matching',
  'earlyAccess',
  'events',
  'portfolio',
  'spotlight',
  'office',
  'consulting',
];
const e = (tag, text = '', className = '') => {
  const n = document.createElement(tag);
  n.textContent = text;
  n.className = className;
  return n;
};
const closeOriginDrawer = () => {
  if (document.querySelector('.origin-console-drawer')) closeDrawer();
};
const t = (key) => __('origin.' + key),
  tr = () => getLang() === 'tr';
const date = (ms) => (ms ? new Date(ms).toLocaleString(tr() ? 'tr-TR' : 'en-GB') : '—');
const money = (amount) =>
  new Intl.NumberFormat(tr() ? 'tr-TR' : 'en-GB', { style: 'currency', currency: 'TRY' }).format((amount || 0) / 100);
const call = async (data) => (await consolePeopleCall('manageOriginProgram', data)).data;
export function initOriginModule() {
  const lists = new Map(
    ['members', 'applications', 'payments'].map((kind) => [
      kind,
      { rows: [], cursor: null, busy: false, generation: 0 },
    ]),
  );
  let financeBusy = false;
  function render(kind) {
    const state = lists.get(kind),
      host = document.querySelector(`[data-origin-list="${kind}"]`);
    if (!host) return;
    host.replaceChildren();
    const query = document.querySelector(`[data-origin-search="${kind}"]`).value.trim().toLocaleLowerCase();
    const visible = state.rows.filter((row) =>
      [row.name, row.email, row.tier, row.status, row.uid].some((v) =>
        String(v || '')
          .toLocaleLowerCase()
          .includes(query),
      ),
    );
    const head = e('div', '', 'origin-table-head');
    for (const key of ['person', 'level', 'state', 'ends', 'details']) head.append(e('span', t(key)));
    host.append(head);
    if (!visible.length) host.append(e('p', t('empty'), 'state-block'));
    for (const row of visible) {
      const card = e('div', '', 'origin-console-row'),
        name = e('button', '', 'contributor-cell-name');
      name.type = 'button';
      name.append(
        e('span', (row.name || row.email || '?').slice(0, 1), 'contributor-avatar'),
        e('strong', row.name || row.email, 'contributor-name'),
      );
      name.addEventListener('click', () => details(kind, row));
      const identity = e('div', '', 'origin-identity');
      identity.append(name, e('small', row.email || ''));
      card.append(
        identity,
        e('span', row.tier || 'NODE', 'dept-badge'),
        e('span', row.suspended ? t('suspended') : row.status || 'pending', 'status-badge'),
        e('span', date(row.expiresAtMillis || row.paidThroughMillis), 'origin-end'),
      );
      const button = e('button', t('details'), 'chrome-btn-outline');
      button.type = 'button';
      button.addEventListener('click', () => details(kind, row));
      card.append(button);
      host.append(card);
    }
    document.querySelector(`[data-origin-more="${kind}"]`).hidden = !state.cursor;
    document.querySelector(`[data-origin-list-hint="${kind}"]`).textContent =
      t('loaded') + ': ' + state.rows.length + (kind === 'members' ? ' · ' + t('membersHint') : '');
  }
  async function load(kind, more = false) {
    if (!auth.currentUser || !isPanelAdmin()) return;
    const state = lists.get(kind);
    if (state.busy) return;
    state.busy = true;
    const generation = ++state.generation,
      host = document.querySelector(`[data-origin-list="${kind}"]`);
    host.setAttribute('aria-busy', 'true');
    if (!more) host.replaceChildren(e('p', t('loading'), 'state-block'));
    try {
      const data = await call({ action: 'list', kind, ...(more && state.cursor ? { afterId: state.cursor } : {}) });
      if (generation !== state.generation || !isPanelAdmin()) return;
      state.rows = more ? state.rows.concat(data.rows) : data.rows;
      state.cursor = data.nextCursor;
      render(kind);
    } catch (error) {
      host.replaceChildren(e('p', userErrorMessage(error), 'state-block'));
    } finally {
      state.busy = false;
      host.removeAttribute('aria-busy');
    }
  }
  async function save(row, data) {
    await call({ action: 'update', id: row.id, expectedRevision: row.revision, ...data });
    closeOriginDrawer();
    showToast(t('saved'), 'success');
    await load('members');
  }
  function field(host, label, value, type = 'text') {
    const wrap = e('label', '', 'origin-console-field');
    wrap.append(e('span', label));
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    input.value = value || '';
    wrap.append(input);
    host.append(wrap);
    return input;
  }
  function check(host, label, value) {
    const wrap = e('label', '', 'origin-console-check'),
      input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value === true;
    wrap.append(input, e('span', label));
    host.append(wrap);
    return input;
  }
  function button(host, label, fn) {
    const b = e('button', label, 'chrome-btn-outline');
    b.type = 'button';
    b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await fn();
      } catch (error) {
        showToast(userErrorMessage(error), 'error');
      } finally {
        b.disabled = false;
      }
    });
    host.append(b);
    return b;
  }
  function details(kind, row) {
    const body = openDrawer({ title: row.name || row.email || 'Origin' });
    body.closest('.vx-drawer')?.classList.add('origin-console-drawer');
    const dl = e('dl', '', 'people-drawer-section');
    for (const key of [
      'email',
      'phone',
      'uid',
      'tier',
      'status',
      'source',
      'priceKind',
      'subscriptionStatus',
      'fulfillmentStatus',
      'riskStatus',
      'consentVersion',
      'note',
    ])
      if (row[key]) dl.append(e('dt', t(key)), e('dd', String(row[key])));
    if (row.amount !== undefined) dl.append(e('dt', t('amount')), e('dd', money(row.amount)));
    dl.append(e('dt', t('ends')), e('dd', date(row.expiresAtMillis || row.paidThroughMillis)));
    body.append(dl);
    if (kind === 'applications') {
      if (row.addons?.length) body.append(e('p', row.addons.join(' · '), 'form-hint'));
      for (const approved of [true, false])
        button(body, t(approved ? 'approve' : 'decline'), async () => {
          if (
            !(await confirmDialog({
              title: t('applications'),
              body: escapeHTML((row.name || row.email) + ' → ' + t(approved ? 'approve' : 'decline')),
              confirmLabel: t('save'),
            }))
          )
            return;
          const result = (await consolePeopleCall('reviewOriginApplication', { applicationId: row.id, approved })).data;
          body.replaceChildren(e('p', t('saved')));
          if (result.admissionUrl) {
            body.append(e('p', t('admissionHint'), 'form-hint'));
            const input = field(body, t('admissionLink'), result.admissionUrl);
            input.readOnly = true;
            button(body, t('copy'), async () => {
              await navigator.clipboard.writeText(result.admissionUrl);
              showToast(t('copied'), 'success');
            });
          }
          await load('applications');
        });
    } else if (kind === 'payments') {
      if (row.sessionId) {
        const a = e('a', t('stripe'), 'chrome-btn-outline');
        a.href = 'https://dashboard.stripe.com/checkout/sessions/' + encodeURIComponent(row.sessionId);
        a.target = '_blank';
        a.rel = 'noopener';
        body.append(a);
      }
      if (row.paymentVerified)
        button(body, t('retry'), async () => {
          await call({ action: 'retry', id: row.id });
          closeOriginDrawer();
          await load('payments');
          showToast(t('saved'), 'success');
        });
    } else {
      body.append(e('h3', t('wall')));
      const name = field(body, t('publicName'), row.wallName || row.name);
      name.maxLength = 100;
      const publish = check(body, t('publishWall'), row.wallPublished);
      publish.disabled = !row.wallOptIn;
      body.append(e('p', row.wallOptIn ? t('consented') : t('noConsent'), 'form-hint'));
      button(body, t('saveWall'), () => save(row, { wallPublished: publish.checked, wallName: name.value }));
      body.append(e('h3', t('delivery')));
      const delivery = {};
      for (const task of tasks) {
        const label = e('label', '', 'origin-console-field'),
          select = document.createElement('select');
        label.append(e('span', t('task.' + task)));
        for (const state of ['pending', 'scheduled', 'delivered', 'not-applicable']) {
          const option = e('option', t('taskState.' + state));
          option.value = state;
          select.append(option);
        }
        select.value = row.delivery?.[task] || 'pending';
        delivery[task] = select;
        label.append(select);
        body.append(label);
      }
      const note = field(body, t('note'), row.note, 'textarea');
      button(body, t('saveDelivery'), () =>
        save(row, {
          delivery: Object.fromEntries(tasks.map((task) => [task, delivery[task].value])),
          note: note.value,
        }),
      );
      if (['NODE', 'GRAPH', 'NETWORK'].includes(row.tier)) {
        body.append(e('h3', t('portfolio')));
        const eligible = row.tier === 'NODE' ? check(body, t('portfolioAddon'), row.portfolioEligible) : null,
          p = row.portfolio || {};
        const fields = {};
        for (const key of ['name', 'description', 'sector', 'website', 'founder'])
          fields[key] = field(body, t('startup.' + key), p[key], key === 'description' ? 'textarea' : 'text');
        const publishFounder = check(body, t('publishFounder'), p.publishFounder),
          active = check(body, t('startupActive'), p.active !== false),
          published = check(body, t('publishPortfolio'), p.published);
        body.append(e('p', t('portfolioHint'), 'form-hint'));
        button(body, t('savePortfolio'), () =>
          save(row, {
            ...(eligible ? { portfolioEligible: eligible.checked } : {}),
            portfolio: {
              ...Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value])),
              publishFounder: publishFounder.checked,
              active: active.checked,
              published: published.checked,
            },
          }),
        );
      }
      body.append(e('h3', t('membership')));
      body.append(e('p', t('suspensionHint'), 'form-hint'));
      button(body, t(row.suspended ? 'resume' : 'suspend'), async () => {
        if (await confirmDialog({ title: t('membership'), body: t('suspensionHint'), confirmLabel: t('save') }))
          await save(row, { suspended: !row.suspended });
      });
      if (row.source === 'manual')
        button(body, t('revoke'), async () => {
          if (await confirmDialog({ title: t('revoke'), body: t('revokeHint'), confirmLabel: t('revoke') }))
            await save(row, { revoke: true });
        });
    }
  }
  async function finance() {
    if (financeBusy || !isPanelAdmin()) return;
    financeBusy = true;
    const host = document.getElementById('origin-finance');
    host.replaceChildren(e('p', t('loading')));
    try {
      const data = await call({ action: 'finance' });
      if (!isPanelAdmin()) return;
      host.replaceChildren();
      const grid = e('div', '', 'origin-finance-grid');
      for (const [key, value] of [
        ['gross', money(data.gross)],
        ['refunded', money(data.refunded)],
        ['net', money(data.netBeforeFees)],
        ['memberCount', String(data.members)],
      ]) {
        const card = e('div', '', 'origin-finance-stat');
        card.append(e('small', t(key)), e('strong', value));
        grid.append(card);
      }
      host.append(grid, e('p', t('financeHint'), 'form-hint'));
      for (const c of data.campaigns)
        host.append(e('p', `${c.tier} · ${t('used')}: ${c.used}/${c.limit} · ${t('held')}: ${c.held}`));
    } catch (error) {
      host.replaceChildren(e('p', userErrorMessage(error)));
    } finally {
      financeBusy = false;
    }
  }
  for (const kind of lists.keys()) {
    document.querySelector(`[data-origin-refresh="${kind}"]`).addEventListener('click', () => load(kind));
    document.querySelector(`[data-origin-more="${kind}"]`).addEventListener('click', () => load(kind, true));
    document.querySelector(`[data-origin-search="${kind}"]`).addEventListener('input', () => render(kind));
  }
  document.getElementById('origin-finance-refresh').addEventListener('click', finance);
  document.addEventListener('vertex:workspace', (event) => {
    for (const kind of lists.keys()) if (event.detail?.keys?.includes('origin.' + kind)) void load(kind);
    if (event.detail?.keys?.includes('models.origin')) void finance();
  });
  const form = document.getElementById('origin-assignment'),
    tier = form.elements.tier,
    expiry = form.elements.expiry,
    status = document.getElementById('origin-assignment-status');
  expiry.value = new Date(Date.now() + 30 * 86400000 - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  tier.addEventListener('change', () => {
    expiry.disabled = tier.value === 'NODE';
    expiry.required = tier.value !== 'NODE';
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isPanelAdmin() || !form.reportValidity()) return;
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    status.textContent = t('loading');
    try {
      const input = {
          action: 'assign',
          email: form.elements.email.value,
          tier: tier.value,
          expiresAtMillis: new Date(expiry.value).getTime(),
          note: form.elements.note.value,
        },
        preview = await call({ action: 'previewAssignment', email: input.email });
      if (
        !(await confirmDialog({
          title: t('assign'),
          body:
            escapeHTML(
              input.email +
                ' · ' +
                input.tier +
                ' · ' +
                (input.tier === 'NODE' ? t('once') : date(input.expiresAtMillis)),
            ) +
            '<p>' +
            escapeHTML(t('assignHint')) +
            '</p>',
          confirmLabel: t('assign'),
        }))
      )
        return;
      await call({ ...input, expectedRevision: preview.revision });
      status.textContent = t('assigned');
      showToast(t('assigned'), 'success');
    } catch (error) {
      status.textContent = userErrorMessage(error);
    } finally {
      submit.disabled = false;
    }
  });
  document.addEventListener('vertex:access-changed', () => {
    if (isPanelAdmin()) return;
    for (const [kind, state] of lists) {
      state.generation++;
      state.rows = [];
      state.cursor = null;
      document.querySelector(`[data-origin-list="${kind}"]`).replaceChildren();
    }
    document.getElementById('origin-finance').replaceChildren();
    closeOriginDrawer();
  });
  onLangChange(() => {
    for (const kind of lists.keys()) render(kind);
    closeOriginDrawer();
    if (document.querySelector('[data-panel="models.origin"]')?.getClientRects().length) void finance();
  });
}
