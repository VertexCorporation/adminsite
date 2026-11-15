import { auth, consolePeopleCall } from '../core/firebase.js';
import { deploymentCapabilities } from '../core/deployment-capabilities.js';
import { isPanelAdmin } from './roles.js';
import { confirmDialog } from './shell.js';
import { skeletonRows, skeletonListItem, setButtonLoading } from '../utils/loading.js';
import { __, escapeHTML as esc, userErrorMessage, showToast } from '../utils/ui.js';

const roles = ['member', 'moderator', 'chef'];
const mounts = new WeakMap();
// Every entry point reads/writes the same linked account. Email lookup never
// establishes ownership: the server-returned application ID must also match.
export async function mountPersonnelRole(host, { user, uid, application, prefix = 'personnel', onSaved } = {}) {
  const token = {},
    actor = auth.currentUser?.uid;
  mounts.set(host, token);
  const current = () => host.isConnected && mounts.get(host) === token && actor === auth.currentUser?.uid;
  const hint = (key) => {
    host.innerHTML = `<h4>${esc(__('people.manage_personnel'))}</h4><p class="form-hint" role="status">${esc(__(key))}</p>`;
  };
  if (!isPanelAdmin()) return hint('catalog.role_core_only');
  if (!deploymentCapabilities.consolePersonnelWrites) return hint('catalog.role_preparing');
  try {
    if (!user) {
      host.innerHTML = skeletonRows(2, skeletonListItem);
      if (uid || application?.linkedUid)
        user = (await consolePeopleCall('getConsoleUser', { uid: uid || application.linkedUid })).data.user;
      else if (application?.email) {
        const { data } = await consolePeopleCall('listConsoleUsers', { search: application.email });
        user = data.users?.find((candidate) => candidate.contributor?.id === application.id);
      }
      if (!current()) return;
    }
    if (!isPanelAdmin()) return hint('catalog.role_core_only');
    if (
      !user ||
      user.linkStatus !== 'linked' ||
      !user.contributor ||
      (application &&
        (user.contributor.id !== application.id || (application.linkedUid && user.uid !== application.linkedUid)))
    )
      return hint('catalog.role_link_required');
    const previous = roles.includes(user.role) ? user.role : '';
    const reason = user.disabled
      ? 'catalog.role_disabled'
      : user.membership !== 'active'
        ? 'catalog.role_inactive'
        : !user.department
          ? 'catalog.role_unavailable'
          : null;
    host.innerHTML = `<h4>${esc(__('people.manage_personnel'))}</h4><p class="form-hint">${esc(__('catalog.role_hint'))}</p>
      <form id="${prefix}-role-form" class="form-stack catalog-role-form">
        <div class="form-group-field"><label for="${prefix}-role">${esc(__('people.role'))}</label>
        <select id="${prefix}-role" required ${reason ? 'disabled' : ''}>${previous ? '' : `<option value="" disabled selected>${esc(__('catalog.role_select'))}</option>`}${roles.map((role) => `<option value="${role}" ${role === previous ? 'selected' : ''}>${esc(__('people.role_' + role))}</option>`).join('')}</select></div>
        ${reason ? `<p class="form-hint" role="status">${esc(__(reason))}</p>` : '<button type="submit" class="chrome-btn-primary" disabled>' + esc(__('catalog.role_update')) + '</button>'}
      </form>`;
    if (reason) return;
    const form = host.querySelector('form'),
      select = form.querySelector('select'),
      button = form.querySelector('button');
    let pending = false;
    select.addEventListener('change', () => {
      button.disabled = select.value === previous;
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const role = select.value;
      if (pending || !current() || !isPanelAdmin() || !roles.includes(role) || role === previous) return;
      pending = true;
      button.disabled = true;
      select.disabled = true;
      try {
        const confirmed = await confirmDialog(() => ({
          title: __('catalog.role_update'),
          body: __('catalog.role_confirm'),
          rows: [
            { label: __('people.email'), value: user.email || user.uid },
            {
              label: __('people.role'),
              value:
                (previous ? __('people.role_' + previous) : __('catalog.role_unset')) +
                ' → ' +
                __('people.role_' + role),
            },
          ],
        }));
        if (!confirmed || !current() || !isPanelAdmin()) return;
        setButtonLoading(button, true);
        await consolePeopleCall('updateConsolePersonnel', {
          uid: user.uid,
          department: user.department,
          role,
          expectedVersion: user.authzVersion || 0,
        });
        if (!current()) return;
        showToast(() => __('catalog.role_saved'), 'success');
        document.dispatchEvent(new CustomEvent('vertex:personnel-changed'));
        const fresh = (await consolePeopleCall('getConsoleUser', { uid: user.uid })).data.user;
        if (!current() || !isPanelAdmin()) return;
        if (onSaved) onSaved(fresh);
        else void mountPersonnelRole(host, { user: fresh, application, prefix });
      } catch (error) {
        if (current()) showToast(() => userErrorMessage(error), 'error');
      } finally {
        pending = false;
        if (current() && button.isConnected) {
          setButtonLoading(button, false);
          select.disabled = false;
          button.disabled = select.value === previous;
        }
      }
    });
  } catch (error) {
    if (current()) {
      hint('catalog.role_load_failed');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'chrome-btn-outline';
      retry.textContent = __('common.retry');
      retry.onclick = () => mountPersonnelRole(host, { uid: uid || user?.uid, application, prefix, onSaved });
      host.append(retry);
    }
  }
}
