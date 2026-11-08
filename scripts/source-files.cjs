'use strict';
const fs = require('node:fs');
const path = require('node:path');

// One inventory for release creation and verification, including runtime HTML.
function sourceFiles(root) {
  const files = [];
  for (const dir of ['js', 'css', 'l10n', 'partials']) {
    for (const name of fs
      .readdirSync(path.join(root, dir), { recursive: true })
      .filter((name) => fs.statSync(path.join(root, dir, name)).isFile())
      .sort()) {
      files.push(dir + '/' + name);
    }
  }
  return [...files, 'assets/fonts/ubuntu-medium.ttf', 'firebase-config.json'];
}

module.exports = { sourceFiles };
