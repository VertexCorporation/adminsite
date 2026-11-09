const {readConsoleSource} = require('./helpers/console-source.cjs');
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = readConsoleSource;

test('Core-only Users navigation mounts the deletion page', () => {
    const html = read('index.html');
    const roles = read('js/modules/roles.js');
    assert.match(html, /data-nav-module\s*=\s*"users"/);
    assert.match(html, /data-nav-panel\s*=\s*"users.status\s*,\s*users.deleteAccount"/);
    assert.match(html, /id\s*=\s*"account-deletion-search-form"/);
    assert.match(html, /id\s*=\s*"account-deletion-confirm-email"/);
    assert.match(html, /id\s*=\s*"account-deletion-verified"/);
    assert.match(roles, /panelKey\.startsWith\s*\(\s*'users\.'\s*\)\s*/);
    assert.match(roles, /!screen\.coreOnly/);
    assert.match(read('js/core/permissionCatalog.js'), /scopes\s*:\s*\['users\.directory'\]\s*,\s*coreOnly\s*:\s*true/);
    assert.match(roles, /!screen\.coreOnly/);
});

test('deletion UI requests the guarded admin endpoint with typed target confirmation', () => {
    const src = read('js/modules/accountDeletion.js');
    assert.match(src, /listConsoleUsers/);
    assert.match(src, /adminRequestAccountDeletion/);
    assert.match(src, /confirmationEmail\s*:\s* confirmInput\.value/);
    assert.match(src, /ownershipVerified\s*:\s* verifyInput\.checked/);
    assert.match(src, /confirmDialog/);
    assert.match(src, /target\.disabled \s*===\s* true/);
    assert.doesNotMatch(src, /consolePeopleCall\s*\(\s*'requestAccountDeletion'/);
});

test('deletion messaging distinguishes queueing from complete erasure in both languages', () => {
    const i18n = read('js/lang.js');
    for (const key of ['deleteAccount.title','deleteAccount.scope_notice','deleteAccount.already_pending','deleteAccount.queued']) {
        assert.equal(i18n.split('"' + key + '"').length - 1, 2, key);
    }
});

test('consent uses a visible native checkbox',()=>{const {JSDOM}=require('jsdom');const dom=new JSDOM(read('index.html'));const checkbox=dom.window.document.getElementById('account-deletion-verified');assert.equal(checkbox.type,'checkbox');assert.equal(checkbox.hidden,false);assert(checkbox.closest('label.account-deletion-consent'));dom.window.close();});
