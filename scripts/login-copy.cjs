'use strict';
const fs = require('node:fs'),
  path = require('node:path');
const { parsers } = require('prettier/plugins/babel');
// Compile first-paint copy from the same dictionaries used by the application.
// No translated strings are duplicated in HTML or in a second locale catalog.
module.exports = function loginCopy(root) {
  const copy = {};
  for (const name of ['common', 'ui-index']) {
    const source = fs.readFileSync(path.join(root, 'l10n/tr', name + '.js'), 'utf8');
    const ast = parsers.babel.parse(source, {});
    const dictionary = ast.program.body.find((node) => node.type === 'ExportDefaultDeclaration').declaration;
    for (const property of dictionary.properties) copy[property.key.value ?? property.key.name] = property.value.value;
  }
  return copy;
};
