'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { sourceFiles } = require('./source-files.cjs');
const root = path.resolve(__dirname, '..');
const files = [...sourceFiles(root), 'index.html'].filter((file) => /\.(?:js|css|html)$/.test(file));
const oversized = files
  .map((file) => ({ file, lines: fs.readFileSync(path.join(root, file), 'utf8').trimEnd().split('\n').length }))
  .filter((entry) => entry.lines > 700);
for (const { file, lines } of oversized) console.error(`${file}: ${lines} lines (maximum 700)`);
if (oversized.length) process.exitCode = 1;
else console.log(`Checked ${files.length} source files: all within 700 lines.`);

const missingAssets = [];
for (const file of files.filter((file) => file.endsWith('.css'))) {
  for (const match of fs.readFileSync(path.join(root, file), 'utf8').matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
    const url = match[1];
    if (/^(?:https?:|data:|#)/.test(url)) continue;
    const target = url.startsWith('/') ? path.join(root, url.slice(1)) : path.resolve(root, path.dirname(file), url);
    if (!fs.existsSync(target)) missingAssets.push(file + ': missing ' + url);
  }
}
for (const problem of missingAssets) console.error(problem);
if (missingAssets.length) process.exitCode = 1;
