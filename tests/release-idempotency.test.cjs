'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('immutable release generation is idempotent and consumes old manifest whitespace',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vertex-release-'));
 try{
  for(const dir of ['scripts','assets/fonts'])fs.mkdirSync(path.join(temp,dir),{recursive:true});
  for(const dir of ['js','css'])fs.cpSync(path.join(root,dir),path.join(temp,dir),{recursive:true});
  for(const file of ['scripts/release.cjs','index.html','assets/fonts/ubuntu-medium.ttf','firebase-config.json']){
   fs.copyFileSync(path.join(root,file),path.join(temp,file));
  }
  const run=()=>execFileSync(process.execPath,['scripts/release.cjs'],{cwd:temp,stdio:'pipe'});
  run();const first=fs.readFileSync(path.join(temp,'index.html'),'utf8');
  run();const second=fs.readFileSync(path.join(temp,'index.html'),'utf8');
  assert.equal(second,first,'generating twice must not change HTML');
  assert.equal([...second.matchAll(/<!-- release:start -->/g)].length,1);
  assert.match(second,/^    <!-- release:start -->$/m,'release marker must use canonical indentation');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
