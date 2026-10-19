const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/modules/subscriptions.js'), 'utf8');

test('subscription revocation relies on server-derived canRemove and fails closed', () => {
  assert.match(source, /canRemove: sub\.canRemove === true/);
  assert.match(source, /sub\.canRemove === true \? /);
  assert.match(source, /if \(!entry \|\| entry\.canRemove !== true\)/);
  assert.doesNotMatch(source, /sub\.source !== 'vertex'/);
  assert.match(source, /danger:true/);
});
