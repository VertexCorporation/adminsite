const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
const { JSDOM } = require('jsdom');
const { execFileSync } = require('node:child_process');
const docs = new Map(),
  routes = [];
const commits = {};
const root = process.cwd();
function add(repo, file, product, kind, locale, selector) {
  const full = path.join(root, repo, file),
    src = fs.readFileSync(full, 'utf8');
  const d = new JSDOM(src).window.document,
    el = d.querySelector(selector);
  if (!el || el.textContent.trim().length < 200) throw Error('Missing legal body ' + full);
  const html = el.innerHTML,
    id = `${product}-${kind}--${locale}`;
  const hash = crypto.createHash('sha256').update(html).digest('hex');
  let doc = docs.get(id);
  if (
    doc &&
    new JSDOM(doc.html).window.document.body.textContent.replace(/\s+/g, ' ').trim() !==
      el.textContent.replace(/\s+/g, ' ').trim()
  )
    throw Error('Divergent duplicate ' + id);
  if (!doc) {
    doc = {
      id,
      product,
      kind,
      locale,
      title: el.querySelector('h1')?.textContent.trim() || `${product} ${kind}`,
      html,
      sourceHash: hash,
      sources: [],
    };
    docs.set(id, doc);
  }
  const canonical = d.querySelector('link[rel=canonical]')?.href;
  const host = {
    vertexite: 'https://vertexishere.com',
    eventsite: 'https://events.vertexishere.com',
    cortexite: 'https://cortexishere.com',
    allyishere: 'https://allyishere.com',
  }[repo];
  commits[repo] ||= execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  doc.sources.push({
    repository: repo,
    path: file,
    url: canonical || host + '/' + file,
    commit: commits[repo],
    sourceHash: hash,
  });
  routes.push({ repo, file, id, selector });
}
for (const kind of ['privacy', 'terms']) {
  const name = kind === 'privacy' ? 'privacy-policy' : 'terms-of-service';
  const src = fs.readFileSync(`vertexite/${name}.html`, 'utf8');
  const mapping = [...src.matchAll(/'([a-z]{2})':\s*'([^']+\.html)'/g)];
  if (mapping.length !== 16) throw Error('Locale map incomplete');
  for (const [, lang, file] of mapping) {
    add('vertexite', `${lang}/${file}`, 'vertex', kind, lang, '.container');
    add('eventsite', `${lang}/${file}`, 'events', kind, lang, '.legal-container');
  }
  for (const repo of ['cortexite', 'allyishere'])
    add(
      repo,
      `${name}.html`,
      repo === 'cortexite' ? 'cortex' : 'ally',
      kind,
      'en',
      repo === 'cortexite' ? '.container' : 'main',
    );
  add('vertexite', `cortex-${name}.html`, 'cortex', kind, 'en', '.container');
  add('vertexite', `all-star-${name}.html`, 'all-star', kind, 'en', '.container');
}
for (const lang of ['tr', 'en', 'ar', 'az', 'de', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'nl', 'pt', 'ru', 'zh']) {
  const team = ['tr', 'az'].includes(lang) ? 'vertex-kadro-sozlesmesi' : 'vertex-team-contract';
  add('vertexite', `${lang}/${team}.html`, 'vertex', 'team-contract', lang, '.container');
  add(
    'vertexite',
    `${lang}/${lang === 'tr' ? 'aramiza-katil' : 'join-us'}.html`,
    'vertex',
    'doctrine',
    lang,
    '#doctrineScroll',
  );
}
for (const lang of ['tr', 'en']) {
  for (const kind of ['privacy', 'terms'])
    add(
      'vertexite',
      `${lang}/beacon-${kind === 'privacy' ? 'privacy-policy' : 'terms-of-use'}.html`,
      'beacon',
      kind,
      lang,
      '.container',
    );
  add(
    'vertexite',
    `${lang}/${lang === 'tr' ? 'origin-kullanim-kosullari' : 'origin-terms-of-use'}.html`,
    'origin',
    'terms',
    lang,
    '.container',
  );
}
const catalog = { schemaVersion: 1, documents: [...docs.values()] };
fs.writeFileSync('Fulcrum/functions/data/legal-documents.json', JSON.stringify(catalog, null, 2) + '\n');
fs.writeFileSync('legal-routes.json', JSON.stringify(routes, null, 2) + '\n');
console.log(`${docs.size} variants, ${routes.length} page bindings`);
for (const product of new Set([...docs.values()].map((d) => d.product)))
  console.log(product, [...docs.values()].filter((d) => d.product === product).length);
