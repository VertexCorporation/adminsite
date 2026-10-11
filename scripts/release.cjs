const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');const files=[];
for(const dir of ['js','css'])for(const name of fs.readdirSync(path.join(root,dir),{recursive:true}).filter(x=>fs.statSync(path.join(root,dir,x)).isFile()).sort())files.push(dir+'/'+name);
for(const name of ['assets/fonts/ubuntu-medium.ttf'])files.push(name);
const hash=crypto.createHash('sha256');for(const file of files)hash.update(file).update(fs.readFileSync(path.join(root,file)));const id=hash.digest('hex').slice(0,12),prefix='assets/releases/'+id;
for(const file of files){const target=path.join(root,prefix,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<!-- release:start -->[\s\S]*?<!-- release:end -->\n?/,'');
const imports={};for(const file of files.filter(f=>f.endsWith('.js')))imports['/'+file]='/'+prefix+'/'+file;
html=html.replace('    <script type="module"',`    <!-- release:start -->\n    <meta name="vertex-release" content="${id}">\n    <script type="importmap">${JSON.stringify({imports})}</script>\n    <!-- release:end -->\n    <script type="module"`);
html=html.replace(/(src|href)="(?:assets\/releases\/[a-f0-9]+\/)?((?:js|css)\/[^"?]+)(?:\?[^" ]*)?"/g,(_,attr,file)=>`${attr}="${prefix}/${file}"`);
fs.writeFileSync(path.join(root,'index.html'),html);console.log('immutable release '+id);
