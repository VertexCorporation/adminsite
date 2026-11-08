'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
test('build is deterministic, preserves sources and contains only one disposable runtime',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vertex-build-'));
 try{for(const name of ['scripts','assets','js','css','l10n','partials','index.html','customer-activate.html','firebase-config.json','_headers'])fs.cpSync(name,path.join(temp,name),{recursive:true});const original=fs.readFileSync(path.join(temp,'index.html'),'utf8');const run=()=>execFileSync(process.execPath,['scripts/release.cjs'],{cwd:temp});run();const first=fs.readFileSync(path.join(temp,'dist/index.html'),'utf8');run();assert.equal(fs.readFileSync(path.join(temp,'dist/index.html'),'utf8'),first);assert.equal(fs.readFileSync(path.join(temp,'index.html'),'utf8'),original);assert.equal(fs.readdirSync(path.join(temp,'dist/assets/runtime')).length,1);assert(!fs.existsSync(path.join(temp,'dist/assets/releases')));const {imports}=JSON.parse(first.match(/<script type="importmap">([^<]+)<\/script>/)[1]);assert(fs.existsSync(path.join(temp,'dist',imports['/js/modules/teamCards.js'])));}finally{fs.rmSync(temp,{recursive:true,force:true});}
});
