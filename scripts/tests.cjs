// Standalone UI suite. Cross-repository Firebase integration tests remain in
// npm test and require a sibling Fulcrum checkout with its private fixtures.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const external=new Set(['certificate-owner-policy.test.cjs','zapier-delivery-replay.test.cjs',
'zapier-preparation.test.cjs','zapier-real-delivery.test.cjs']);
const tests=fs.readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.test.cjs')&&!external.has(x));
if(!tests.length)throw Error('No standalone tests found');
console.warn('Running '+tests.length+' standalone tests; private Fulcrum integration tests run separately.');
const result=cp.spawnSync(process.execPath,['--test',...tests.map(t=>'tests/'+t)],{cwd:root,stdio:'inherit'});
process.exit(result.status??1);
