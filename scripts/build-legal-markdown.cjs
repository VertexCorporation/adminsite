'use strict';
// Pinned, local browser bundle; no runtime CDN or HTML-enabled parser.
const { buildSync } = require('esbuild');
buildSync({
  stdin: {
    contents:
      "import MarkdownIt from 'markdown-it'; const md=new MarkdownIt({html:false,linkify:false,typographer:false});md.disable('image');export default text=>md.render(text);",
    resolveDir: __dirname + '/..',
  },
  bundle: true,
  format: 'esm',
  minify: true,
  legalComments: 'eof',
  outfile: __dirname + '/../assets/vendor/legal-markdown.js',
});
