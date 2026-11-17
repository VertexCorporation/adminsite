'use strict';
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {createRequire} = require('node:module');
const {authScript,response,model} = require('./helpers/console-audit-fixture.cjs');
const root = path.resolve(__dirname,'..'), dist = path.join(root,'dist');
const auditRequire = createRequire(path.join(root,'.lighthouse/package.json'));
const out = path.join(root,'test-results/workspaces');
fs.mkdirSync(out,{recursive:true});
const navigation = fs.readFileSync(path.join(root,'partials/navigation.html'),'utf8');
const routes = [{panel:'home',action:''},{panel:'chat',action:''}];
for(const match of navigation.matchAll(/data-nav-panel="([^"]+)"\s+data-nav-action="([^"]*)"/g)) {
  const route={panel:match[1],action:match[2]};
  if(!routes.some(r=>r.panel===route.panel&&r.action===route.action))routes.push(route);
}
for(const view of ['weekly','members','projects','tasks','open'])routes.push({panel:'reports.workspace',action:'Array:'+view});
routes.push({panel:'system.exporter,system.attributions',action:'attributions'});
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=path.resolve(dist,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(dist+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,bytes)=>{res.statusCode=error?404:200;res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');res.end(error?'':bytes);});
});
(async()=>{
  const {default:puppeteer}=await import(auditRequire.resolve('puppeteer'));
  const {startFlow,desktopConfig}=await import(auditRequire.resolve('lighthouse'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await puppeteer.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const results=[],seenFindings=new Set();
  try{
    for(const device of (process.env.AUDIT_DEVICES||'desktop,mobile').split(','))for(const lang of (process.env.AUDIT_LANGS||'en,tr').split(','))for(const theme of (process.env.AUDIT_THEMES||'dark,light').split(',')){
      const page=await browser.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
      await page.setViewport(device==='mobile'?{width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true}:{width:1440,height:900,deviceScaleFactor:1});
      await page.evaluateOnNewDocument(({script,lang,theme})=>{
        (0,eval)(script);
        localStorage.setItem('siteLang',lang);localStorage.setItem('theme',theme);
        localStorage.setItem('vertexConsoleSession','active');
      },{script:authScript,lang,theme});
      await page.setRequestInterception(true);
      page.on('request',async req=>{
        const url=new URL(req.url());
        try{
          if(url.origin===base){
            // Snapshot QA uses synthetic Auth. Cold performance mode retains
            // all six real Firebase SDK downloads before installing that identity.
            if(url.pathname.endsWith('/js/core/initializer.js')){
              const file=path.join(dist,url.pathname);
              let source=fs.readFileSync(file,'utf8');
              if(process.env.AUDIT_REAL_SDK==='1')source=source.replace("const { startApp } = await import('../main.js');",authScript+"\nconst { startApp } = await import('../main.js');");
              else source="import {startApp} from '../main.js'; startApp({apiKey:'synthetic-audit'});";
              return await req.respond({status:200,contentType:'text/javascript',body:source});
            }
            return await req.continue();
          }
          if(url.hostname.endsWith('run.app')){
            if(req.method()==='OPTIONS')return await req.respond({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'}});
            const data=JSON.parse(req.postData()||'{}').data||{};
            return await req.respond({status:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'},contentType:'application/json',body:JSON.stringify({result:response(url.hostname.split('-')[0],data)})});
          }
          if(url.hostname==='cortexishere.com')return await req.respond({status:200,contentType:'application/json',body:JSON.stringify(url.pathname==='/models'?{producers:{Vertex:{Series:{Example:model}}}}:{models:[]})});
          if(['www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))return await req.continue();
          return await req.respond({status:200,contentType:'text/plain',body:''});
        }catch(error){errors.push(error.message);if(!req.isInterceptResolutionHandled())await req.abort();}
      });
      await page.goto(base,{waitUntil:'networkidle0'});
      await page.waitForFunction(()=>document.querySelector('#admin-panel')?.style.display==='grid');
      const flow=await startFlow(page,{name:`Workspaces ${device} ${lang} ${theme}`,config:device==='desktop'?desktopConfig:undefined,flags:{onlyCategories:['accessibility','best-practices']}});
      const selected=process.env.AUDIT_FILTER?routes.filter(r=>(r.panel+':'+r.action).includes(process.env.AUDIT_FILTER)):routes;
      for(const route of selected){
        const begin=performance.now();const before=errors.length;
        await page.evaluate(route=>{
          history.replaceState({vertexRoute:{panel:route.panel,action:route.action}},'','?panel='+encodeURIComponent(route.panel)+'&view='+encodeURIComponent(route.action));
          dispatchEvent(new PopStateEvent('popstate'));
        },route);
        await page.waitForFunction(()=>![...document.querySelectorAll('.tab-panel.active [aria-busy=\"true\"]')].some(el=>el.getClientRects().length),{timeout:15000});
        await new Promise(r=>setTimeout(r,250));
        await page.evaluate(()=>document.fonts.ready);
        const elapsed=Math.round(performance.now()-begin);
        const active=await page.evaluate(()=>({panel:document.querySelector('.tab-panel.active')?.id,workspace:document.querySelector('.tab-panel.active')?.dataset.workspace,theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth+1}));
        await flow.snapshot({name:route.panel+':'+route.action});
        const lhr=(await flow.createFlowResult()).steps.at(-1).lhr;
        const failures=Object.values(lhr.audits).filter(a=>a.score!==null&&a.score<1).map(a=>({id:a.id,title:a.title,details:a.details}));
        const item={device,lang,theme,...route,active,elapsed,scores:Object.fromEntries(Object.entries(lhr.categories).map(([k,v])=>[k,v.score===null?null:Math.round(v.score*100)])),failures,errors:errors.slice(before)};
        results.push(item);fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({scope:'Built application; synthetic identity and backend fixtures; snapshots do not produce a performance score',routes:routes.length,results},null,2));
        console.log(JSON.stringify({...item,failures:failures.map(f=>f.id)}));
        for(const failure of failures)for(const row of failure.details?.items||[]){const key=failure.id+JSON.stringify(row);if(!seenFindings.has(key)){seenFindings.add(key);console.log('FINDING',JSON.stringify({device,lang,theme,route,audit:failure.id,item:row}));}}
      }
      fs.writeFileSync(path.join(out,`${device}-${lang}-${theme}.html`),await flow.generateReport());
      await page.close();
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
