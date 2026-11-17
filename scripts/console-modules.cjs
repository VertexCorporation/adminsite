'use strict';
const path = require('node:path');
const { buildSync } = require('esbuild');
function consoleModules(root) {
  return buildSync({
    entryPoints: ['js/core/bootstrap.js', 'js/core/initializer.js', 'js/main.js'].map((file) => path.join(root, file)),
    outbase: root,
    outdir: path.join(root, 'compiled'),
    chunkNames: 'chunks/[name]-[hash]',
    bundle: true,
    splitting: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    write: false,
  }).outputFiles;
}
module.exports = { consoleModules };
