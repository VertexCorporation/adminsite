'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { sourceFiles } = require('./source-files.cjs');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..'),
  out = path.join(root, 'dist'),
  files = sourceFiles(root);
if (fs.existsSync(path.join(root, 'assets/releases')))
  throw Error('Archived release snapshots must not be kept in the source checkout');
const release = require('./release-hash.cjs').releaseHash(root, files),
  prefix = 'assets/runtime/' + release;
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// Only one generated release per build; generated files never enter Git history.
for (const file of files) {
  const target = path.join(out, prefix, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
for (const name of [
  'assets',
  '_headers',
  '_redirects',
  'favicon.png',
  'customer-activate.html',
  'firebase-config.json',
]) {
  const source = path.join(root, name);
  if (fs.existsSync(source))
    fs.cpSync(source, path.join(out, name), {
      recursive: true,
      filter: (filename) =>
        !filename.includes(path.sep + 'releases' + path.sep) && !filename.endsWith(path.sep + 'releases'),
    });
}
// Account activation remains a small independent entry point using the same release.
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const consoleCSS = require('./console-styles.cjs').consoleStyles(root, html);
fs.writeFileSync(path.join(out, prefix, 'console.css'), consoleCSS);
const compiled = {};
const modules = require('./console-modules.cjs').consoleModules(root);
for (const file of modules) {
  const relative = path.relative(path.join(root, 'compiled'), file.path);
  const target = path.join(out, prefix, 'compiled', relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, file.contents);
  compiled['compiled/' + relative] = crypto.createHash('sha256').update(file.contents).digest('hex');
}
html = html.replace(/(<template id="console-styles">)([\s\S]*?)(<\/template>)/, (_, open, content, close) => {
  const optional = content.replace(/<link rel="stylesheet" href="css\/[^\"]+"\s*\/>/g, '');
  return open + optional + `<link rel="stylesheet" href="/${prefix}/console.css" />` + close;
});
const loginCopy = require('./login-copy.cjs');
const copy = loginCopy(root);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
html = html.replace(/(<(title|h1|span)\b[^>]*data-i18n="([^"]+)"[^>]*>)(<\/\2>)/g, (match, open, tag, key, close) =>
  copy[key] ? open + escape(copy[key]) + close : match,
);
html = html.replace(/<(input|div)\b[^>]*>/g, (tag) => {
  for (const attribute of ['aria-label', 'placeholder']) {
    const key = tag.match(new RegExp('data-i18n-' + attribute + '="([^"]+)"'))?.[1];
    if (key && copy[key])
      tag = tag.replace(new RegExp('(?<![\\w-])' + attribute + '=""'), attribute + '="' + escape(copy[key]) + '"');
  }
  return tag;
});
const criticalCSS = buildSync({
  entryPoints: [path.join(root, 'css/login.css')],
  bundle: true,
  minify: true,
  write: false,
}).outputFiles[0].text;
// No stylesheet request chain delays the sign-in surface's first paint.
html = html.replace('<link rel="stylesheet" href="css/login.css" />', `<style>${criticalCSS}</style>`);
// Only ship the text used before the private console starts. Derive form keys
// from its markup so new sign-in controls automatically join both locales.
const loginMarkup = html.match(/<div id="login-container"[\s\S]*?<div id="admin-panel"/)?.[0];
if (!loginMarkup) throw Error('Missing login markup');
const loginKeys = new Set([
  ...Array.from(loginMarkup.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g), (match) => match[1]),
  'page.title',
  'init.error',
  'init.retry',
  'common.retry',
]);
function entryCopy(dictionary) {
  return Object.fromEntries(
    [...loginKeys].map((key) => {
      if (typeof dictionary[key] !== 'string') throw Error('Missing login translation: ' + key);
      return [key, dictionary[key]];
    }),
  );
}
buildSync({
  entryPoints: [path.join(root, 'js/core/entry.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: path.join(out, prefix, 'login-entry.js'),
  define: {
    'import.meta.url': 'entryModuleURL',
    COMPILED_LOGIN: 'true',
    LOGIN_COPY: JSON.stringify({ tr: entryCopy(copy), en: entryCopy(loginCopy(root, 'en')) }),
  },
  banner: { js: "const entryModuleURL = new URL('./js/core/entry.js', import.meta.url).href;" },
});
// Discover the entry before downloading the embedded workspace templates.
const entryTag = '<script type="module" src="js/core/entry.js"></script>';
if (!html.includes(entryTag)) throw Error('Missing console entry');
html = html.replace(entryTag, '');
const imports = {};
for (const file of files.filter((file) => file.endsWith('.js'))) imports['/' + file] = '/' + prefix + '/' + file;
const preloadURLs = modules.preloads.map((file) => '/' + prefix + '/' + file);
const workspacePreloads = Object.fromEntries(
  Object.entries(modules.workspacePreloads).map(([id, files]) => [id, files.map((file) => '/' + prefix + '/' + file)]),
);
const manifest = `<meta name="vertex-workspace-preloads" content='${JSON.stringify(workspacePreloads)}'><meta name="vertex-preloads" content='${JSON.stringify(preloadURLs)}'><meta name="vertex-release" content="${release}"><meta name="vertex-bootstrap" content="/${prefix}/compiled/js/core/bootstrap.js"><meta name="vertex-fragments" content="/${prefix}/partials/"><script type="importmap">${JSON.stringify({ imports })}</script>`;
// A returning visit can fetch its critical stylesheet and security SDKs while
// the parser reads the private workspace templates. No SDK executes here.
const returningHints = `<script>(() => {
  try {
    if (localStorage.getItem('vertexConsoleSession') !== 'active') return;
    function preload(as, href) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = as;
      link.href = href;
      document.head.append(link);
    }
    preload('style', '/${prefix}/console.css');
    for (const service of ['app', 'auth', 'functions', 'app-check'])
      preload('script', 'https://www.gstatic.com/firebasejs/11.0.0/firebase-' + service + '-compat.js');
  } catch {}
})();</script>`;
html = html
  .replace(
    '</head>',
    manifest + returningHints + `<script type="module" src="/${prefix}/login-entry.js"></script></head>`,
  )
  .replace(/(src|href)="((?:js|css)\/[^"?]+)(?:\?[^" ]*)?"/g, (_, attr, file) => `${attr}="${prefix}/${file}"`);
// Static workspace markup is inert until bootstrap mounts it. Delivering the
// same release's templates together avoids a waterfall of fragment requests.
html = html.replace(/<template data-fragment="([a-z/-]+)">\s*<\/template>/g, (_, name) => {
  const markup = fs.readFileSync(path.join(root, 'partials', name + '.html'), 'utf8');
  if (!markup.trim() || /<script\b/i.test(markup)) throw Error('Invalid embedded fragment: ' + name);
  return `<template data-fragment="${name}" data-embedded-fragment="true">${markup}</template>`;
});
fs.writeFileSync(path.join(out, 'index.html'), html);
let activation = fs.readFileSync(path.join(root, 'customer-activate.html'), 'utf8');
activation = activation
  .replace('</head>', manifest + '</head>')
  .replace(/(src|href)="((?:js|css)\/[^"?]+)(?:\?[^" ]*)?"/g, (_, attr, file) => `${attr}="${prefix}/${file}"`);
fs.writeFileSync(path.join(out, 'customer-activate.html'), activation);
fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify({ release, files, prefix, compiled }, null, 2) + '\n');
console.log('Built release ' + release + ' in dist/');
