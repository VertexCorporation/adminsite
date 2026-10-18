'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dirs=['js','tests','scripts','server'];
let total=0;
function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(/\.(?:js|cjs|mjs)$/.test(entry.name)){
  const run=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(run.status!==0){process.stderr.write(run.stderr);process.exitCode=1;}
  total++;
}}}
for(const dir of dirs)visit(path.join(root,dir));
console.log('Syntax checked '+total+' JavaScript modules.');
