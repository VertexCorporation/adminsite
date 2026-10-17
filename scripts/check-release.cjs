const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const files = [];
for (const dir of ['js', 'css']) {
    for (const name of fs.readdirSync(path.join(root, dir), { recursive: true })
        .filter(name => fs.statSync(path.join(root, dir, name)).isFile()).sort()) {
        files.push(dir + '/' + name);
    }
}
files.push('assets/fonts/ubuntu-medium.ttf', 'firebase-config.json');
const hash = crypto.createHash('sha256');
for (const name of files) hash.update(name).update(fs.readFileSync(path.join(root, name)));
const expected = hash.digest('hex').slice(0, 12);
const prefix = 'assets/releases/' + expected;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const meta = html.match(/<meta name="vertex-release" content="([a-f0-9]{12})">/);
assert.ok(meta, 'release marker is missing');
assert.equal(meta[1], expected, 'index points to a stale immutable release');
assert.doesNotMatch(html, /(?:src|href)="(?:js|css)\//, 'unversioned source referenced in index');

for (const name of files) {
    const source = fs.readFileSync(path.join(root, name));
    const published = fs.readFileSync(path.join(root, prefix, name));
    assert.ok(source.equals(published), 'stale release asset: ' + name);
}
const importMapText = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];
assert.ok(importMapText, 'release import map is missing');
const imports = JSON.parse(importMapText).imports || {};
for (const name of files.filter(name => /\.js$/.test(name))) {
    assert.equal(imports['/' + name], '/' + prefix + '/' + name, 'stale import for ' + name);
}
console.log('verified immutable release ' + expected + ' (' + files.length + ' files)');
