'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const roles = fs.readFileSync('js/modules/roles.js', 'utf8');
const css = fs.readFileSync('css/modules.css', 'utf8');

test('department permission matrix derives every module column from the live catalogue', () => {
    const source = roles.match(/const TABS = (\[[\s\S]*?\]);/);
    assert.ok(source, 'Permission tab catalogue must exist');
    const modules = [...source[1].matchAll(/\{\s*id:\s*'([^']+)'/g)].map(match => match[1]);
    assert.equal(modules.length, 7, 'Current permission catalogue has seven modules');
    assert.equal(new Set(modules).size, modules.length);
    assert.match(roles, /--permission-module-count:'\+TABS\.length/);
    assert.match(css, /repeat\(var\(--permission-module-count, 7\),minmax\(108px,1fr\)\)/);
    assert.doesNotMatch(css, /--permission-columns:[^;]*repeat\(6,/);
});

test('permission matrix header and body are both rendered from the same module catalogue', () => {
    const section = roles.slice(roles.indexOf('function renderMatrixTable()'), roles.indexOf('function renderMatrixTable()') + 4200);
    assert.match(section, /TABS\.forEach\(tab => \{html \+=.*dept-perm-th/);
    assert.match(section, /TABS\.forEach\(tab => \{[\s\S]*?class=\\"perm-cell/);
    assert.match(css, /\.dept-perms-header,\.dept-perm-row\{display:grid;grid-template-columns:var\(--permission-columns\)/);
});
