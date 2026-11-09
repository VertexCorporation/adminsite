'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { sourceFiles } = require('./source-files.cjs');
const root = path.resolve(__dirname, '..'),
  out = path.join(root, 'dist'),
  files = sourceFiles(root),
  hash = crypto.createHash('sha256');
for (const file of files) hash.update(file).update(fs.readFileSync(path.join(root, file)));
const release = hash.digest('hex').slice(0, 12),
  manifest = JSON.parse(fs.readFileSync(path.join(out, 'release.json'), 'utf8'));
if (manifest.release !== release) throw Error('Release manifest differs from source');
for (const file of files) {
  if (!fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(out, manifest.prefix, file))))
    throw Error('Stale release asset: ' + file);
}
for (const file of ['index.html', 'customer-activate.html']) {
  const html = fs.readFileSync(path.join(out, file), 'utf8');
  if (!html.includes(`name="vertex-release" content="${release}"`)) throw Error('Wrong HTML release');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  for (const module of files.filter((file) => file.endsWith('.js')))
    if (map['/' + module] !== '/' + manifest.prefix + '/' + module) throw Error('Missing release import: ' + module);
}
console.log('Verified generated release ' + release);
