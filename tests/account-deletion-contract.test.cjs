'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');

test('Core-only Users navigation mounts the deletion page', () => {
    const html = read('index.html');
    const roles = read('js/modules/roles.js');
    assert.match(html, /data-nav-module="users"/);
    assert.match(html, /data-nav-panel="users.status,users.deleteAccount"/);
    assert.match(html, /id="account-deletion-search-form"/);
    assert.match(html, /id="account-deletion-confirm-email"/);
    assert.match(html, /id="account-deletion-verified"/);
    assert.match(roles, /panelKey\.startsWith\('users\.'\)/);
    assert.match(roles, /!screen\.coreOnly/);
    assert.match(read('js/core/permissionCatalog.js'), /scopes:\['users\.directory'\],coreOnly:true/);
    assert.match(roles, /!screen\.coreOnly/);
});

test('deletion UI requests the guarded admin endpoint with typed target confirmation', () => {
    const src = read('js/modules/accountDeletion.js');
    assert.match(src, /listConsoleUsers/);
    assert.match(src, /adminRequestAccountDeletion/);
    assert.match(src, /confirmationEmail: confirmInput\.value/);
    assert.match(src, /ownershipVerified: verifyInput\.checked/);
    assert.match(src, /confirmDialog/);
    assert.match(src, /target\.disabled === true/);
    assert.doesNotMatch(src, /consolePeopleCall\('requestAccountDeletion'/);
});

test('deletion messaging distinguishes queueing from complete erasure in both languages', () => {
    const i18n = read('js/lang.js');
    for (const key of ['deleteAccount.title','deleteAccount.scope_notice','deleteAccount.already_pending','deleteAccount.queued']) {
        assert.equal(i18n.split('"' + key + '"').length - 1, 2, key);
    }
});

test('consent uses a visible native checkbox, not an opaque chip', () => {
    const html = read('index.html');
    const css = read('css/ui/controls.css');
    assert.match(html, /<label class="account-deletion-consent">\s*<input id="account-deletion-verified" type="checkbox">/);
    assert.match(css, /\.account-deletion-consent input\[type="checkbox"\]/);
    assert.match(css, /\.account-deletion-consent:has\(input:checked\)/);
    assert.doesNotMatch(html, /<label class="chip-checkbox">\s*<input id="account-deletion-verified"/);
});
