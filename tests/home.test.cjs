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
  assert.match(read('css/home.css'), /@media\s*\(max-width:760px\)/);
});

test('release contains home module and stylesheet', () => {
  const html = read('index.html');
  const id = html.match(/name="vertex-release" content="([a-f0-9]+)"/)[1];
  for (const file of ['js/main.js','js/modules/home.js','js/modules/shell.js','css/home.css'])
    assert.ok(fs.existsSync(path.join(root,'assets','releases',id,file)), file);
});

test('home presents four Vertex technologies in both languages', () => {
  const src = read('js/modules/home.js');
  for (const name of ['Cortex', 'Ally', 'Mergen', 'Fulcrum']) assert.match(src, new RegExp(name));
  assert.match(src, /VERTEX KONSOL/);
  assert.match(src, /VERTEX CONSOLE/);
  assert.match(src, /home-product-grid/);
  assert.match(src, /home-technology-grid/);
  assert.doesNotMatch(src, /home-hero-emblem|home-orbit|t\.ecosystemEyebrow/);
});

test('flow artwork respects reduced motion and brand marks are local assets', () => {
  const src = read('js/modules/home.js');
  const css = read('css/home.css');
  assert.match(src, /home-flow-svg/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  for (const brand of ['firebase','google-drive','zapier','cal']) {
    assert.ok(fs.existsSync(path.join(root, 'assets','technology',brand+'.svg')), brand);
    const svg=read(path.join('assets','technology',brand+'.svg'));
    assert.match(svg, /<svg\\b/);
    assert.match(svg, /<(?:path|rect|circle|g)\\b/);
  }
  assert.doesNotMatch(css, /home-hero-emblem|home-orbit/);
});

test('product and technology cards stay separate from permission-controlled console modules', () => {
  const home = read('js/modules/home.js');
  assert.match(home, /getEffectivePanelLevel\(key\) !== 'none'/);
  assert.match(home, /visibleTarget\(moduleId\)/);
  assert.match(home, /const card = el\('article', 'home-product-card'\)/);
  assert.match(home, /const card = el\('article', 'home-tech-card'\)/);
});
