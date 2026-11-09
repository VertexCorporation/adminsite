const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('department selectors are whole clickable labels with centered inputs', () => {
    const js = fs.readFileSync(path.join(root, 'js/modules/admin.js'), 'utf8');
    const css = require('./helpers/console-source.cjs').readConsoleSource('css/modules.css');
    assert.match(js, /document\.createElement\s*\(\s*'label'\s*\)\s*/);
    assert.match(js, /label\.append\s*\(\s*input\s*,\s*text\s*\)\s*/);
    assert.match(css, /\.dept-options \.dept-choice \s*\{\s*[\s\S]*?display\s*:\s* inline-flex\s*;\s*[\s\S]*?align-items\s*:\s* center\s*;\s*/);
    assert.match(css, /\.dept-options \.dept-choice input\[type\s*=\s*["']checkbox["']\] \s*\{\s*[\s\S]*?margin\s*:\s* 0\s*;\s*/);
});
