'use strict';
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
// These real-backend contract suites run in Fulcrum's existing private CI,
// which checks out both repositories and supplies certificate-fixture.
const privateContracts=new Set(['certificate-owner-policy.test.cjs','zapier-delivery-replay.test.cjs','zapier-preparation.test.cjs','zapier-real-delivery.test.cjs']);
const files=fs.readdirSync('tests').filter(file=>file.endsWith('.test.cjs')&&!privateContracts.has(file)).sort().map(file=>'tests/'+file);
const result=spawnSync(process.execPath,['--experimental-vm-modules','--test',...files],{stdio:'inherit'});
process.exit(result.status??1);
