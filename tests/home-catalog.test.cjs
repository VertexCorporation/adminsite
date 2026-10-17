const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'js/modules/home.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/home.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const copyMatch = home.match(/const COPY = (\{[\s\S]*?\});\nconst MODULE_IDS/);
const itemsMatch = home.match(/const TECHNOLOGIES = (\[[\s\S]*?\]);\nlet context = null;/);
assert.ok(copyMatch, 'Home translations are defined');
assert.ok(itemsMatch, 'Home technology catalogue is defined');
const copy = JSON.parse(copyMatch[1]);
const catalogue = JSON.parse(itemsMatch[1]);
const expected = ['firebase','workspace','zapier','cal','fal','miro','secret','elevenlabs','daytona','gitlab','assemblyai','github','granola','composio','deepgram','cloudflare'];

function checkParity(a, b, section = 'root') {
  assert.equal(typeof a, typeof b, section);
  if (Array.isArray(a)) {
    assert.ok(Array.isArray(b), section);
    assert.equal(a.length, b.length, section);
    a.forEach((value, i) => checkParity(value, b[i], section + '.' + i));
  } else if (a && typeof a === 'object') {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), section);
    for (const key of Object.keys(a)) checkParity(a[key], b[key], section + '.' + key);
  } else if (typeof a === 'string') {
    assert.ok(a.trim(), section + ': tr is empty');
    assert.ok(b.trim(), section + ': en is empty');
  }
}

test('Home has complete Turkish and English copies with matching structure', () => {
  checkParity(copy.tr, copy.en);
  assert.equal(copy.tr.eyebrow, 'VERTEX KONSOL');
  assert.equal(copy.en.eyebrow, 'VERTEX CONSOLE');
  assert.equal(copy.tr.pageAriaLabel, 'Vertex Konsol | Ev');
  assert.equal(copy.en.pageAriaLabel, 'Vertex Console | Home');
  assert.match(home, /onLangChange\(renderHome\)/);
  assert.match(home, /setAttribute\('aria-label', t\.pageAriaLabel\)/);
});

test('all sixteen technology entries have localized copy and working local asset references', () => {
  assert.deepEqual(catalogue.map(item => item.id), expected);
  assert.equal(new Set(catalogue.map(item => item.name)).size, expected.length);
  for (const item of catalogue) {
    assert.ok(copy.tr.technology[item.id]?.trim(), item.id + ' Turkish text');
    assert.ok(copy.en.technology[item.id]?.trim(), item.id + ' English text');
    if (item.id === 'secret') {
      assert.match(item.image, /joinsecret\.com/);
    } else {
      assert.ok(fs.existsSync(path.join(root, item.image)), 'Missing verified logo: ' + item.image);
      const svg = fs.readFileSync(path.join(root, item.image), 'utf8');
      assert.match(svg, /<svg[\s>]/);
      assert.doesNotMatch(svg, /<script|onload\s*=|<foreignObject/i);
    }
  }
  assert.match(home, /logo\.addEventListener\('error'/);
});

test('edge fog, accessibility, responsive layout and initial home route remain intact', () => {
  assert.match(css, /ellipse 21% 72% at 0% 50%/);
  assert.match(css, /ellipse 21% 72% at 100% 50%/);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(html, /class="tab-panel active" id="tab-home"/);
  assert.match(home, /getEffectivePanelLevel\(key\) !== 'none'/);
});
