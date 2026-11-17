import { auth, consolePeopleCall } from '../core/firebase.js';
import { isPanelAdmin } from './roles.js';
import { mountPersonnelRole } from './personnelRole.js';
import { openDrawer } from './shell.js';
import { beginPanelLoading } from '../utils/loading.js';
import { showLoadError } from '../ui/states.js';
import { __, escapeHTML as esc, userErrorMessage } from '../utils/ui.js';

let epoch = 0;
let initialized = false;
const el = (id) => document.getElementById(id);

export async function loadScenePersonnel() {
  const list = el('scene-personnel-list');
  if (!list || !isPanelAdmin() || !auth.currentUser) return;
  if (!initialized) {
    initialized = true;
    let timer;
    el('scene-personnel-search').addEventListener('input', () => {
      ++epoch;
      clearTimeout(timer);
      timer = setTimeout(() => void loadScenePersonnel(), 350);
    });
    document.addEventListener('vertex:personnel-changed', () => void loadScenePersonnel());
    document.addEventListener('vertex:access-changed', () => {
      ++epoch;
      list.replaceChildren();
    });
  }
  const request = ++epoch,
    actor = auth.currentUser.uid;
  const current = () => request === epoch && auth.currentUser?.uid === actor && isPanelAdmin();
  const finish = beginPanelLoading(list);
  try {
    const search = el('scene-personnel-search').value.trim();
    const users = [];
    let cursor = null;
    const cursors = new Set();
    do {
      const { data } = await consolePeopleCall(
        'listConsoleUsers',
        search ? { search } : { role: 'moderator', membership: 'active', cursor, pageSize: 100 },
      );
      if (!current()) return;
      if (!Array.isArray(data.users) || data.indexReady === false) throw new Error('Directory unavailable');
      users.push(...data.users);
      cursor = search ? null : data.nextCursor;
      if (cursor && (cursors.has(cursor) || cursors.size >= 100)) throw new Error('Invalid cursor');
      if (cursor) cursors.add(cursor);
    } while (cursor);
    list.innerHTML = users.length
      ? users
          .map(
            (user, index) =>
              `<div class="team-list-row"><div class="team-list-info"><strong>${esc(user.name || user.displayName || user.email || user.uid)}</strong><span>${esc(user.email || '')}</span><span>${esc(user.role ? __('people.role_' + user.role) : __('catalog.role_unset'))}</span></div><button type="button" class="chrome-btn-outline" data-personnel-index="${index}">${esc(__('people.manage_personnel'))}</button></div>`,
          )
          .join('')
      : `<p class="state-block">${esc(__('team.personnel_empty'))}</p>`;
    list.querySelectorAll('[data-personnel-index]').forEach((button) => {
      button.onclick = () => {
        if (!current()) return;
        const user = users[Number(button.dataset.personnelIndex)];
        const host = openDrawer({ title: user.name || user.displayName || user.email || __('people.details') });
        void mountPersonnelRole(host, { user, prefix: 'scene' });
      };
    });
  } catch (error) {
    if (current())
      showLoadError(list, () => userErrorMessage(error), loadScenePersonnel, { staleSelector: '.team-list-row' });
  } finally {
    finish();
  }
}
