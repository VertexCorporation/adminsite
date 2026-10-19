const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('department selectors are whole clickable labels with centered inputs', () => {
    const js = fs.readFileSync(path.join(root, 'js/modules/admin.js'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'css/modules.css'), 'utf8');
    assert.match(js, /document\.createElement\('label'\)/);
    assert.match(js, /label\.append\(input, document\.createTextNode/);
    assert.match(css, /\.dept-options \.dept-choice \{[\s\S]*?display: inline-flex;[\s\S]*?align-items: center;/);
    assert.match(css, /\.dept-options \.dept-choice input\[type="checkbox"\] \{[\s\S]*?margin: 0;/);
});
