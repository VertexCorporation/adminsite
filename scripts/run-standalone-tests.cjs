const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tests = path.join(__dirname, '..', 'tests');
const external = new Set([
    'certificate-owner-policy.test.cjs',
    'zapier-delivery-replay.test.cjs',
    'zapier-preparation.test.cjs',
    'zapier-real-delivery.test.cjs'
]);
for (const name of external) {
    if (!fs.existsSync(path.join(tests, name))) throw new Error('Missing integration test: ' + name);
}
const standalone = fs.readdirSync(tests).filter(name => name.endsWith('.test.cjs') && !external.has(name));
console.warn('Cross-repository integration tests not executed: configure FULCRUM_READ_TOKEN for the complete suite.');
const run = spawnSync(process.execPath, ['--test', ...standalone.map(name => path.join(tests, name))], { stdio: 'inherit' });
if (run.error) throw run.error;
process.exit(run.status === null ? 1 : run.status);
