const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/layout.css'), 'utf8');

test('verification cards use full-width fallback spans', () => {
  for (const id of ['team-log-manager', 'team-cards-manager', 'manual-verify-manager']) {
    assert.match(html, new RegExp('<div class="panel-card col-span-12" id="' + id + '"'));
  }
});

test('verification workspace overrides dynamic adaptive columns only in its section', () => {
  assert.match(css, /#tab-system\[data-active-section="verification"\] > \.grid-layout\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(css, /#tab-system\[data-active-section="verification"\] > \.grid-layout > \.panel-card:not\(\[hidden\]\)/);
  assert.match(css, /grid-column:\s*1 \/ -1 !important;/);
});
