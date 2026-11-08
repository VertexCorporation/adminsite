'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const { pathToFileURL } = require('node:url');
const { JSDOM } = require('jsdom');
const { parsers } = require('prettier/plugins/babel');
const { sourceFiles } = require('./source-files.cjs');
const root = path.resolve(__dirname, '..');
const problems = [];
function walk(node, visit, parent) {
  if (!node || typeof node !== 'object') return;
  visit(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'tokens', 'comments', 'extra'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((item) => walk(item, visit, node));
    else walk(value, visit, node);
  }
}
function checkJS(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  walk(parsers.babel.parse(source, {}), (node, parent) => {
    const value = node.type === 'StringLiteral' ? node.value : node.type === 'TemplateElement' ? node.value.raw : null;
    if (typeof value !== 'string') return;
    const sink =
      node.type === 'StringLiteral' &&
      ((parent?.type === 'AssignmentExpression' &&
        ['textContent', 'innerText', 'placeholder', 'title'].includes(parent.left?.property?.name)) ||
        (parent?.type === 'CallExpression' &&
          ['alert', 'confirm', 'prompt', 'showToast'].includes(parent.callee?.name) &&
          parent.arguments[0] === node));
    if (sink && /[A-Za-zçğıöşüÇĞİÖŞÜ]{2}/.test(value))
      problems.push(`${file}:${node.loc.start.line}: literal UI assignment ${JSON.stringify(value)}`);
    // Tokenizer templates are protocol data, not display copy.
    if (file !== 'js/modules/models/constants.js')
      for (const match of value.replace(/<style[\s\S]*?<\/style>/gi, '').matchAll(/>([^<>]+)</g)) {
        const text = match[1].trim();
        if (/[A-Za-zçğıöşüÇĞİÖŞÜ]{2}/.test(text) && !text.includes('${'))
          problems.push(`${file}:${node.loc.start.line}: literal markup text ${JSON.stringify(text)}`);
      }
    if (
      node.type === 'StringLiteral' &&
      parent?.type === 'ConditionalExpression' &&
      /getLang|currentLang|\blang\b|\ben\b/.test(source.slice(parent.test.start, parent.test.end)) &&
      value.length > 8 &&
      !['is-selected'].includes(value) &&
      !value.includes('selected')
    )
      problems.push(`${file}:${node.loc.start.line}: inline locale branch ${JSON.stringify(value)}`);
  });
}
function checkHTML(file) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8'));
  const { document, NodeFilter } = dom.window;
  const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    if (!/[A-Za-zçğıöşüÇĞİÖŞÜ]{2}/.test(text) || node.parentElement?.closest('script,style')) continue;
    problems.push(`${file}: literal HTML text ${JSON.stringify(text.slice(0, 100))}`);
  }
  for (const el of document.querySelectorAll('*'))
    for (const attr of ['placeholder', 'title', 'aria-label', 'alt']) {
      const value = el.getAttribute(attr);
      if (value && /[A-Za-zçğıöşüÇĞİÖŞÜ]{2}/.test(value))
        problems.push(`${file}: literal ${attr} ${JSON.stringify(value)}`);
    }
  dom.window.close();
}
(async () => {
  const dictionaries = {};
  for (const lang of ['tr', 'en']) {
    dictionaries[lang] = (await import(pathToFileURL(path.join(root, 'l10n', lang + '.js')))).default;
    const keys = [];
    for (const name of fs.readdirSync(path.join(root, 'l10n', lang)).filter((name) => name.endsWith('.js'))) {
      walk(parsers.babel.parse(fs.readFileSync(path.join(root, 'l10n', lang, name), 'utf8'), {}), (node) => {
        if (node.type === 'ObjectProperty') keys.push(node.key.value ?? node.key.name);
      });
    }
    if (keys.length !== new Set(keys).size) problems.push(lang + ': duplicate dictionary keys');
  }
  const keys = Object.keys(dictionaries.tr).sort();
  if (JSON.stringify(keys) !== JSON.stringify(Object.keys(dictionaries.en).sort()))
    problems.push('TR/EN dictionary key mismatch');
  for (const key of keys) {
    for (const lang of ['tr', 'en'])
      if (typeof dictionaries[lang][key] !== 'string' || !dictionaries[lang][key].trim())
        problems.push(lang + ': empty ' + key);
    const placeholders = (lang) =>
      [...dictionaries[lang][key].matchAll(/\{([A-Za-z0-9_]+)\}/g)]
        .map((match) => match[1])
        .sort()
        .join('|');
    if (placeholders('tr') !== placeholders('en')) problems.push('Placeholder mismatch: ' + key);
  }
  for (const file of [...sourceFiles(root), 'index.html', 'customer-activate.html']) {
    if (file.startsWith('js/') && file.endsWith('.js')) checkJS(file);
    if (file.endsWith('.html')) checkHTML(file);
  }
  console.log(`Localization: ${keys.length} paired keys; ${problems.length} violations.`);
  for (const problem of problems) console.error(problem);
  if (problems.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
