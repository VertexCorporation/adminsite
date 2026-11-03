import {auth, consolePeopleCall} from '../core/firebase.js';
import {isPanelAdmin} from './roles.js';
import {confirmDialog} from './shell.js';
import {__, userErrorMessage, onLangChange} from '../utils/ui.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function initCustomerAccounts() {
  const form = document.getElementById('customer-account-form');
  if (!form) return;
  const field = name => form.elements.namedItem(name);
  const status = document.getElementById('customer-account-status');
  const results = document.getElementById('customer-account-results');
  let busy = false, requestId = null, result = null, generation = 0;
  const date = millis => millis ? new Date(millis).toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'tr-TR', {timeZone:'Europe/Istanbul'}) + ' (Europe/Istanbul)' : '—';
  function options() {
    const tier = field('grant').checked ? field('tier').value : 'free';
    return {email: field('email').value.trim().toLowerCase(), displayName: field('displayName').value.trim(), tier, sendInvite: field('sendInvite').checked,
      ...(tier === 'free' ? {} : field('duration').value === 'custom' ? {expiresAt: new Date(field('expiresAt').value).getTime()} : {days: Number(field('duration').value)})};
  }
  function controls() {
    for (const el of form.elements) el.disabled = busy;
    const grant = field('grant').checked;
    document.getElementById('customer-grant-options').hidden = !grant;
    document.getElementById('customer-custom-expiry').hidden = !grant || field('duration').value !== 'custom';
    field('expiresAt').required = grant && field('duration').value === 'custom';
    field('tier').disabled = busy || !grant;
    field('duration').disabled = busy || !grant;
    field('expiresAt').disabled = busy || !grant || field('duration').value !== 'custom';
  }
  function render() {
    results.replaceChildren();
    if (!result) return;
    status.textContent = __('customer.' + result.status);
    for (const key of ['account','profile','subscription','expiry','invitation']) {
      const row = document.createElement('li');
      const value = result[key] || 'pending';
      row.textContent = __('customer.' + key) + ': ' + __('customer.state.' + value);
      results.append(row);
    }
    if (result.uid) {
      const row = document.createElement('li'); row.textContent = 'UID: ' + result.uid; results.append(row);
    }
    if (result.expiresAtMillis) {
      const row = document.createElement('li'); row.textContent = __('customer.ends') + ': ' + date(result.expiresAtMillis); results.append(row);
    }
    if (result.invitationExpiresAtMillis) {
      const row = document.createElement('li'); row.textContent = __('customer.inviteEnds') + ': ' + date(result.invitationExpiresAtMillis); results.append(row);
    }
    if (result.failedStage) {
      const row = document.createElement('li'); row.textContent = __('customer.failedStage') + ': ' + __('customer.' + result.failedStage); results.append(row);
    }
  }
  form.addEventListener('input', () => {
    if (busy) return;
    requestId = null; result = null; status.textContent = ''; render(); controls();
  });
  document.addEventListener('vertex:access-changed', () => {
    generation++; requestId = null; result = null; status.textContent = ''; render();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !auth.currentUser || !isPanelAdmin() || !form.reportValidity()) return;
    const uid = auth.currentUser.uid, current = ++generation, input = options();
    const active = () => current === generation && auth.currentUser?.uid === uid && isPanelAdmin();
    requestId ||= crypto.randomUUID();
    busy = true; controls(); status.textContent = __('customer.checking');
    try {
      const {data: preview} = await consolePeopleCall('createConsoleCustomerAccount', {...input, preview: true});
      if (!active()) return;
      const confirmed = await confirmDialog(() => ({title: __('customer.title'), body: __('customer.confirmBody'),
        warning: preview.existing ? __('customer.existingWarning') : __('customer.timing'),
        rows: [
          {label: __('customer.email'), value: escape(input.email)},
          {label: __('customer.name'), value: escape(input.displayName || '—')},
          {label: __('customer.subscription'), value: escape(preview.existing ? 'Cortex ' + preview.currentTier : 'Cortex ' + input.tier)},
          {label: __('customer.ends'), value: escape(date(preview.existing ? preview.currentExpiresAtMillis : preview.expiresAtMillis))},
          ...(preview.existing ? [{label: __('customer.source'), value: escape(preview.source || '—')}, {label: __('customer.account'), value: escape(preview.disabled ? __('customer.state.disabled') : __('customer.state.existing'))}] : []),
          {label: __('customer.invitation'), value: escape(preview.existing && !preview.previous ? __('customer.state.not-sent') : input.sendInvite ? __('customer.inviteConfirm') : __('customer.state.not-requested'))},
        ], confirmLabel: __('customer.submit')}));
      if (!confirmed || !active()) {if (active()) status.textContent = ''; return;}
      status.textContent = __('customer.working');
      const {data} = await consolePeopleCall('createConsoleCustomerAccount', {...input, requestId});
      if (!active()) return;
      result = data; render();
    } catch (error) {
      if (active()) status.textContent = userErrorMessage(error) + ' ' + __('customer.retry');
    } finally {busy = false; controls();}
  });
  onLangChange(render); controls();
}
