'use strict';
const path = require('node:path');
const { buildSync } = require('esbuild');
function consoleModules(root) {
  const result = buildSync({
    absWorkingDir: root,
    metafile: true,
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
  });
  const outputs = result.metafile.outputs;
  const visited = new Set();
  const visit = (name) => {
    if (visited.has(name)) return;
    visited.add(name);
    for (const dependency of outputs[name].imports)
      if (!dependency.external && dependency.kind === 'import-statement') visit(dependency.path);
  };
  for (const [name, output] of Object.entries(outputs))
    if (['js/core/bootstrap.js', 'js/core/initializer.js', 'js/main.js'].includes(output.entryPoint)) visit(name);
  const files = result.outputFiles;
  files.preloads = [...visited];
  return files;
}
module.exports = { consoleModules };
