const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'js/lang.js'),'utf8');
const LANG=vm.runInNewContext(source.slice(0,source.indexOf('const supportedLang'))+';LANG');
// Historical immutable snapshots carry their own dictionaries. Audit current
// source references here; verify-release.cjs separately checks the active snapshot.
function walk(dir){if(path.relative(root,dir).split(path.sep).join('/').startsWith('assets/releases'))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>['node_modules','.git','tests','docs'].includes(e.name)?[]:e.isDirectory()?walk(path.join(dir,e.name)):/\.(html|js)$/.test(e.name)?[path.join(dir,e.name)]:[]);}
const refs=new Map(),dynamic=[],otherLiterals=new Set();
for(const file of walk(root)){const full=fs.readFileSync(file,'utf8');const s=file.endsWith('/js/lang.js')?full.slice(full.indexOf('const supportedLang')):full;for(const m of s.matchAll(/["']([\w.]+)["']/g))if(Object.hasOwn(LANG.tr,m[1]))otherLiterals.add(m[1]);for(const m of s.matchAll(/data-i18n(?:-placeholder|-title|-value|-aria-label)?=["']([\w.]+)["']|__\(\s*['"]([\w.]+)['"]\s*\)/g)){const key=m[1]||m[2];refs.set(key,[...(refs.get(key)||[]),path.relative(root,file)]);}
for(const m of s.matchAll(/__\(\s*`([^`]+)`|__\(\s*['"]([\w.]+)['"]\s*\+/g))dynamic.push({file:path.relative(root,file),expression:m[0],prefix:(m[1]||m[2]).split('${')[0]});}
const missing=[...refs].filter(([k])=>!Object.hasOwn(LANG.tr,k)||!Object.hasOwn(LANG.en,k)).map(([key,files])=>({key,files}));
const unused=Object.keys(LANG.tr).filter(k=>!refs.has(k)&&!otherLiterals.has(k)&&!dynamic.some(d=>k.startsWith(d.prefix)));
const report={dictionaryKeys:Object.keys(LANG.tr).length,staticReferences:refs.size,missing,dynamicReferences:dynamic,variableOrCatalogueKeys:[...otherLiterals].filter(k=>!refs.has(k)),unreferencedCandidates:unused,note:'Unreferenced candidates may be used through variable keys, panel catalogues or notification template ids; they are not automatically removed.'};
if(require.main===module){fs.writeFileSync(path.join(root,'docs/i18n-key-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({keys:report.dictionaryKeys,static:refs.size,missing,candidates:unused.length,dynamic:dynamic.length}));if(missing.length)process.exitCode=1;}
module.exports={LANG,source,report};
