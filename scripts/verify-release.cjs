'use strict';
// Fail closed: source, manifest, HTML and every immutable byte must describe
// the same release. This command is read-only and is safe in PR/CI checks.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p));
const files=[];
for(const dir of ['js','css'])for(const name of fs.readdirSync(path.join(root,dir),{recursive:true}).filter(x=>fs.statSync(path.join(root,dir,x)).isFile()).sort())files.push(dir+'/'+name);
files.push('assets/fonts/ubuntu-medium.ttf','firebase-config.json');
const hash=crypto.createHash('sha256');
for(const file of files)hash.update(file).update(read(file));
const release=hash.digest('hex').slice(0,12),prefix='assets/releases/'+release;
const html=read('index.html').toString('utf8');
function fail(message){throw Error('[release verification] '+message);}
const meta=html.match(/<meta name="vertex-release" content="([a-f0-9]{12})">/g)||[];
if(meta.length!==1||!meta[0].includes('content="'+release+'"'))fail('HTML release hash differs from checked-in source: expected '+release);
const match=html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if(!match)fail('Missing importmap.');
let imports;try{imports=JSON.parse(match[1]).imports;}catch{fail('Invalid importmap JSON.');}
const js=files.filter(f=>f.endsWith('.js'));
if(Object.keys(imports).length!==js.length)fail('Importmap module count differs from source.');
for(const file of js)if(imports['/'+file]!=='/'+prefix+'/'+file)fail('Wrong importmap module: '+file);
for(const file of files){
  const destination=prefix+'/'+file;
  if(!fs.existsSync(path.join(root,destination)))fail('Missing immutable file: '+destination);
  if(!read(file).equals(read(destination)))fail('Stale immutable file: '+destination);
}
for(const m of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)){
  const url=m[1];
  if(/^(?:js|css)\//.test(url))fail('Unversioned asset reference: '+url);
  const asset=url.match(/^assets\/releases\/([a-f0-9]+)\/(?:js|css)\//);
  if(asset && asset[1]!==release)fail('Stale HTML asset reference: '+url);
}
console.log('Verified immutable release '+release+' ('+files.length+' files).');
