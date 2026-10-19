'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
test('historical immutable bundles do not require retired translations in the current dictionary',t=>{
  const root=path.resolve(__dirname,'..'),releases=path.join(root,'assets/releases');
  fs.mkdirSync(releases,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(releases,'i18n-history-'));
  t.after(()=>fs.rmSync(fixture,{recursive:true,force:true}));
  fs.writeFileSync(path.join(fixture,'old.js'),"__('obsolete.admin.history.fixture');");
  const output=execFileSync(process.execPath,['-e',"process.stdout.write(JSON.stringify(require('./tests/i18n-audit.cjs').report.missing))"],{cwd:root,encoding:'utf8'});
  assert.deepEqual(JSON.parse(output),[]);
});
