'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {sourceFiles}=require('./source-files.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist'),files=sourceFiles(root);
const hash=crypto.createHash('sha256');for(const file of files)hash.update(file).update(fs.readFileSync(path.join(root,file)));
const release=hash.digest('hex').slice(0,12),prefix='assets/runtime/'+release;
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
// Only one generated release per build; generated files never enter Git history.
for(const file of files){const target=path.join(out,prefix,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
for(const name of ['assets','_headers','favicon.png','customer-activate.html']){
 const source=path.join(root,name);if(fs.existsSync(source))fs.cpSync(source,path.join(out,name),{recursive:true,filter:filename=>!filename.includes(path.sep+'releases'+path.sep)&&!filename.endsWith(path.sep+'releases')});
}
// Account activation remains a small independent entry point using the same release.
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const imports={};for(const file of files.filter(file=>file.endsWith('.js')))imports['/'+file]='/'+prefix+'/'+file;
const manifest=`<meta name="vertex-release" content="${release}"><script type="importmap">${JSON.stringify({imports})}</script>`;
html=html.replace('</head>',manifest+'</head>').replace(/(src|href)="((?:js|css)\/[^"?]+)(?:\?[^" ]*)?"/g,(_,attr,file)=>`${attr}="${prefix}/${file}"`);
fs.writeFileSync(path.join(out,'index.html'),html);
let activation=fs.readFileSync(path.join(root,'customer-activate.html'),'utf8');activation=activation.replace('</head>',manifest+'</head>').replace(/(src|href)="((?:js|css)\/[^"?]+)(?:\?[^" ]*)?"/g,(_,attr,file)=>`${attr}="${prefix}/${file}"`);fs.writeFileSync(path.join(out,'customer-activate.html'),activation);
fs.writeFileSync(path.join(out,'release.json'),JSON.stringify({release,files,prefix},null,2)+'\n');
console.log('Built release '+release+' in dist/');
