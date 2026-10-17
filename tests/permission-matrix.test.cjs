const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('permission matrix columns derive from module count', () => {
    const roles = fs.readFileSync(path.join(root, 'js/modules/roles.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'css/modules.css'), 'utf8');
    const tabs = roles.match(/const TABS = \[([\s\S]*?)\];/);
    assert.ok(tabs, 'permissions module catalog is present');
    const count = [...tabs[1].matchAll(/\bid:\s*'/g)].length;
    assert.equal(count, 7, 'test catalog count must be revisited when modules change');
    assert.match(roles, /--permission-module-count:\$\{TABS\.length\}/);
    assert.match(css, /repeat\(var\(--permission-module-count\),minmax\(88px,1fr\)\)/);
    assert.match(css, /overflow-x:auto;max-width:100%/);
    assert.doesNotMatch(css, /repeat\(6,minmax\(108px,1fr\)\)/);
});
