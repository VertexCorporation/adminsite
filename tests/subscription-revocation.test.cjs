const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/modules/subscriptions.js'), 'utf8');

test('subscription revocation relies on server-derived canRemove and fails closed', () => {
  assert.match(source, /canRemove\s*:\s* sub\.canRemove \s*===\s* true/);
  assert.match(source, /sub\.canRemove \s*===\s* true \? /);
  assert.match(source, /if \s*\(\s*!entry \|\| entry\.canRemove !\s*==\s* true\s*\)\s*/);
  assert.doesNotMatch(source, /sub\.source !\s*==\s* 'vertex'/);
  assert.match(source, /danger\s*:\s*true/);
});
