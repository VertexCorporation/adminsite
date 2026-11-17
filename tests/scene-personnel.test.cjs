'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { harness } = require('./helpers/module-harness.cjs');
function fixture({ core = true, wait } = {}) {
  const calls = [],
    mounts = [],
    auth = { currentUser: { uid: 'actor' } };
  const user = { uid: 'member', email: 'member@example.com', role: 'moderator', membership: 'active' };
  const h = harness('<input id="scene-personnel-search"><section id="scene-personnel-list"></section>', {
    'js/core/firebase.js': {
      auth,
      consolePeopleCall: async (name, data) => {
        calls.push({ name, data });
        await wait?.();
        return { data: { users: [user], indexReady: true, nextCursor: null } };
      },
    },
    'js/modules/roles.js': { isPanelAdmin: () => core },
    'js/modules/personnelRole.js': { mountPersonnelRole: async (host, args) => mounts.push(args) },
    'js/modules/shell.js': { openDrawer: () => h.document.createElement('div') },
    'js/utils/loading.js': { beginPanelLoading: () => () => {} },
    'js/ui/states.js': { showLoadError: () => {} },
    'js/utils/ui.js': { __: (x) => x, escapeHTML: (x) => String(x), userErrorMessage: (e) => e.message },
  });
  return { ...h, auth, calls, mounts, core: (v) => (core = v) };
}
test('scene lists active moderators and edits the canonical personnel account', async () => {
  const h = fixture();
  try {
    const m = await h.load('js/modules/scenePersonnel.js');
    await m.loadScenePersonnel();
    assert.equal(h.calls[0].name, 'listConsoleUsers');
    assert.equal(h.calls[0].data.role, 'moderator');
    assert.equal(h.calls[0].data.membership, 'active');
    h.document.querySelector('button').click();
    assert.equal(h.mounts[0].user.uid, 'member');
    h.document.querySelector('input').value = 'new@example.com';
    await m.loadScenePersonnel();
    assert.equal(h.calls[1].data.search, 'new@example.com');
    assert.equal(h.calls[1].data.role, undefined);
  } finally {
    h.close();
  }
});
test('non-Core cannot read personnel; a revoked pending read cannot render results', async () => {
  let release;
  const gate = new Promise((r) => (release = r)),
    h = fixture({ wait: () => gate });
  try {
    const m = await h.load('js/modules/scenePersonnel.js');
    h.core(false);
    await m.loadScenePersonnel();
    assert.equal(h.calls.length, 0);
    h.core(true);
    const pending = m.loadScenePersonnel();
    h.core(false);
    release();
    await pending;
    assert.equal(h.document.querySelector('button'), null);
  } finally {
    release();
    h.close();
  }
});
