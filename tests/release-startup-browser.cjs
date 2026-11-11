'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {architectureFixture}=require('./helpers/architecture-fixture.cjs');
const root=path.resolve(__dirname,'../dist');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8'));
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){
  const html=architectureFixture({lang:'tr'}).replace(/sessionStorage\.setItem\('firebaseConfig', JSON\.stringify\(\{apiKey:'synthetic-test'\}\)\);/,'').replace(/(src|href)="((?:js|css)\/[^"?]+)(?:\?[^" ]*)?"/g,(_,attr,file)=>`${attr}="${manifest.prefix}/${file}"`);
  res.setHeader('Content-Type','text/html');return res.end(html);
 }
 const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(err,bytes)=>{res.statusCode=err?404:200;res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');res.end(err?'Not found':bytes);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true});const base='http://127.0.0.1:'+server.address().port;
 try{for(const width of [360,390]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();const errors=[];let configRequests=0;
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(new URL(request.url()).pathname==='/firebase-config.json')configRequests++;});
  await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.goto(base);await page.locator('#app-loader').waitFor({state:'detached'});
  assert(configRequests>0,'fresh mobile session must fetch the deployed root config');
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('firebaseConfig')).projectId),'vertex-ai-1618');
  assert.deepEqual(errors,[]);await context.close();console.log('Clean release startup passed at',width);
 }}finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
