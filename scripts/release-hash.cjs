'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
function releaseHash(root, files) {
  const hash = crypto.createHash('sha256');
  for (const file of [
    ...files,
    'scripts/release.cjs',
    'scripts/source-files.cjs',
    'scripts/login-copy.cjs',
    'scripts/console-styles.cjs',
    'scripts/console-modules.cjs',
    'scripts/release-hash.cjs',
  ])
    hash.update(file).update(fs.readFileSync(path.join(root, file)));
  hash.update(require('esbuild').version);
  return hash.digest('hex').slice(0, 12);
}
module.exports = { releaseHash };
