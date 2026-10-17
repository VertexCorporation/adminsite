const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const people = fs.readFileSync(path.join(root, 'js/modules/people.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const implementation = people.match(/export function initPeopleModule\(\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(implementation, 'Expected legacy directory initializer');

function bootWith(elements) {
  const notices = [];
  const controls = Object.fromEntries(elements.map(id => [id, {}]));
  const document = {
    getElementById: id => controls[id] || null,
    addEventListener() {}
  };
  const auth = { onAuthStateChanged() {} };
  const onLangChange = () => {};
  const init = new Function('document', 'console', 'auth', 'onLangChange', [
    'const el = id => document.getElementById(id);',
    implementation.replace('export ', ''),
    'return initPeopleModule;'
  ].join('\n'))(document, {info: message => notices.push(message)}, auth, onLangChange);
  init();
  return { controls, notices };
}

test('legacy directory does not crash startup when the old controls are absent', () => {
  assert.equal(html.includes('id="refresh-console-users"'), false);
  assert.doesNotThrow(() => bootWith([]));
  const partial = bootWith(['refresh-console-users']);
  assert.equal(partial.controls['refresh-console-users'].onclick, undefined);
  assert.equal(partial.notices.length, 1);
});

test('legacy directory event bindings remain intact when all controls are mounted', () => {
  const required = people.match(/const requiredIds = \[([\s\S]*?)\];/)?.[1];
  assert.ok(required);
  const ids = [...required.matchAll(/'([^']+)'/g)].map(x => x[1]);
  assert.equal(ids.length, 14);
  const result = bootWith(ids);
  assert.equal(typeof result.controls['refresh-console-users'].onclick, 'function');
  assert.equal(typeof result.controls['refresh-vertex-accounts'].onclick, 'function');
  assert.equal(typeof result.controls['console-user-search-form'].onsubmit, 'function');
  assert.equal(result.notices.length, 0);
});

test('current contributor and event workspaces are preserved', () => {
  assert.match(html, /id="contributors-list-container"/);
  assert.match(html, /id="events-editor"/);
  assert.match(html, /id="tab-home"/);
});
