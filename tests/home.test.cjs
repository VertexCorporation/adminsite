const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('home is the default view for admins and department members', () => {
  const html = read('index.html');
  const main = read('js/main.js');
  assert.match(html, /class="dock-btn active" data-target="tab-home"/);
  assert.match(html, /class="tab-panel active" id="tab-home"/);
  assert.doesNotMatch(html, /class="tab-panel active" id="tab-contributors"/);
  assert.match(main, /const firstTab = 'home'/);
  assert.match(main, /const visibleTabs = new Set\(\[\.\.\.allowedTabs, 'home', 'profile', 'chat'\]\)/);
});

test('home links obey effective module permissions and existing navigation', () => {
  const home = read('js/modules/home.js');
  assert.match(home, /getEffectivePanelLevel\(key\)/);
  assert.match(home, /!link.hidden/);
  assert.match(home, /isPanelAdmin\(\)/);
  assert.match(home, /destination\.click\(\)/);
  assert.match(home, /textContent = value/);
  assert.match(read('js/main.js'), /updateHome\(null,false,\[\]\)/);
});

test('home preserves router history and mobile access', () => {
  const shell = read('js/modules/shell.js');
  assert.match(shell, /route.panel === 'home'/);
  assert.match(shell, /panel:'home'/);
  assert.match(shell, /\['home','contributors','models'/);
  assert.match(read('css/home.css'), /@media\(max-width:760px\)/);
});

test('release contains home module and stylesheet', () => {
  const html = read('index.html');
  const id = html.match(/name="vertex-release" content="([a-f0-9]+)"/)[1];
  for (const file of ['js/main.js','js/modules/home.js','js/modules/shell.js','css/home.css'])
    assert.ok(fs.existsSync(path.join(root,'assets','releases',id,file)), file);
});
