'use strict';
const path = require('node:path');
const { buildSync } = require('esbuild');
// Keep the exact source order: the last matching rule still wins.
function consoleStyles(root, html) {
  const template = html.match(/<template id="console-styles">([\s\S]*?)<\/template>/)[1];
  const paths = [...template.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)"\s*\/>/g)].map((match) => match[1]);
  if (!paths.length) throw Error('Console styles missing');
  return buildSync({
    stdin: { contents: paths.map((file) => `@import '${file}';`).join('\n'), resolveDir: root, loader: 'css' },
    outfile: path.join(root, 'console.css'),
    loader: { '.ttf': 'file', '.woff2': 'file', '.woff': 'file' },
    assetNames: 'assets/fonts/[name]',
    bundle: true,
    minify: true,
    write: false,
    absWorkingDir: path.resolve(root),
  }).outputFiles.find((file) => file.path.endsWith('/console.css')).text;
}
module.exports = { consoleStyles };
