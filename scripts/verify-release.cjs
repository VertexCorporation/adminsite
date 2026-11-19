'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { sourceFiles } = require('./source-files.cjs');
const root = path.resolve(__dirname, '..'),
  out = path.join(root, 'dist'),
  files = sourceFiles(root);
const release = require('./release-hash.cjs').releaseHash(root, files),
  manifest = JSON.parse(fs.readFileSync(path.join(out, 'release.json'), 'utf8'));
if (manifest.release !== release) throw Error('Release manifest differs from source');
for (const file of require('./console-modules.cjs').consoleModules(root)) {
  const relative = 'compiled/' + path.relative(path.join(root, 'compiled'), file.path);
  const expected = crypto.createHash('sha256').update(file.contents).digest('hex');
  const actual = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(out, manifest.prefix, relative)))
    .digest('hex');
  if (actual !== expected || manifest.compiled?.[relative] !== expected)
    throw Error('Stale compiled module: ' + relative);
}
const consoleCSS = require('./console-styles.cjs').consoleStyles(
  root,
  fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
);
if (fs.readFileSync(path.join(out, manifest.prefix, 'console.css'), 'utf8') !== consoleCSS)
  throw Error('Stale console stylesheet bundle');
for (const file of files) {
  if (!fs.readFileSync(path.join(root, file)).equals(fs.readFileSync(path.join(out, manifest.prefix, file))))
    throw Error('Stale release asset: ' + file);
}
if (
  !fs
    .readFileSync(path.join(root, 'firebase-config.json'))
    .equals(fs.readFileSync(path.join(out, 'firebase-config.json')))
)
  throw Error('Missing or stale root startup configuration');
for (const file of ['index.html', 'customer-activate.html']) {
  const html = fs.readFileSync(path.join(out, file), 'utf8');
  if (!html.includes(`name="vertex-release" content="${release}"`)) throw Error('Wrong HTML release');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  for (const module of files.filter((file) => file.endsWith('.js')))
    if (map['/' + module] !== '/' + manifest.prefix + '/' + module) throw Error('Missing release import: ' + module);
}
const builtHTML = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
for (const match of fs
  .readFileSync(path.join(root, 'index.html'), 'utf8')
  .matchAll(/<template data-fragment="([a-z/-]+)">\s*<\/template>/g)) {
  const markup = fs.readFileSync(path.join(root, 'partials', match[1] + '.html'), 'utf8');
  if (!builtHTML.includes(`<template data-fragment="${match[1]}" data-embedded-fragment="true">${markup}</template>`))
    throw Error('Stale embedded fragment: ' + match[1]);
}

console.log('Verified generated release ' + release);
