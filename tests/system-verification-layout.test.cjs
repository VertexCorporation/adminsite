const {readConsoleSource} = require('./helpers/console-source.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = readConsoleSource('index.html');
const css = readConsoleSource('css/layout.css');

test('verification cards use full-width fallback spans', () => {
  for (const id of ['team-log-manager', 'team-cards-manager', 'manual-verify-manager']) {
    const {JSDOM}=require('jsdom');const dom=new JSDOM(html);assert(dom.window.document.getElementById(id).classList.contains('col-span-12'));dom.window.close();
  }
});

test('verification workspace overrides dynamic adaptive columns only in its section', () => {
  assert.match(css, /#tab-system\[data-active-section\s*=\s*["']verification["']\] > \.grid-layout\s*\s*\{\s*\s*grid-template-columns\s*:\s*\s*minmax\s*\(\s*0\s*,\s* 1fr\s*\)\s*\s*;\s*/);
  assert.match(css, /#tab-system\[data-active-section\s*=\s*["']verification["']\] > \.grid-layout > \.panel-card\s*:\s*not\s*\(\s*\[hidden\]\s*\)\s*/);
  assert.match(css, /grid-column\s*:\s*\s*1 \/ -1 !important\s*;\s*/);
});
