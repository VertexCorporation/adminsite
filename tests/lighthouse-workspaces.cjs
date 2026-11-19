'use strict';
const {gzipSync}=require('node:zlib');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {createRequire} = require('node:module');
const {authScript,response,model} = require('./helpers/console-audit-fixture.cjs');
const root = path.resolve(__dirname,'..'), dist = path.join(root,'dist');
const auditRequire = createRequire(path.join(root,'.lighthouse/package.json'));
const navigationMode=process.env.AUDIT_MODE==='navigation';
const fixtureInstall='window.__auditRealFirebase=window.firebase;\n'+authScript+'\nwindow.__auditFirestoreFactory=window.firebase.firestore;delete window.firebase.firestore;';
const out = path.join(root,'test-results',navigationMode?'workspace-navigation':'workspaces');
fs.mkdirSync(out,{recursive:true});
const navigation = fs.readFileSync(path.join(root,'partials/navigation.html'),'utf8');
const routes = [{panel:'home',action:''},{panel:'chat',action:''}];
for(const match of navigation.matchAll(/data-nav-panel="([^"]+)"\s+data-nav-action="([^"]*)"/g)) {
  const route={panel:match[1],action:match[2]};
  if(route.panel!=='reports.workspace'&&!routes.some(r=>r.panel===route.panel&&r.action===route.action))routes.push(route);
}
for(const view of ['overview','daily','people','tasks','weekly'])routes.push({panel:'reports.workspace',action:'Array:'+view});
routes.push({panel:'system.exporter,system.attributions',action:'attributions'});
routes.push({panel:'profile',action:''});
const surfaces = [
  {panel:'home',action:'',surface:'account-menu',selector:'#user-menu-trigger'},
  {panel:'home',action:'',surface:'language-menu',selector:'#lang-toggle-btn'},
  {panel:'home',action:'',surface:'theme-menu',selector:'#theme-menu-btn'},
  {panel:'home',action:'',surface:'mobile-more',selector:'[data-mobile-more]',mobileOnly:true},
  {panel:'contributors.list',action:'',surface:'contributor-details',selector:'[data-details="audit-person"]'},
  {panel:'contributors.list',action:'',surface:'certificate-drawer',selector:'.certificate-manage-btn'},
  {panel:'users.directory',action:'',surface:'user-details',selector:'[data-directory-row]'},
  {panel:'reports.workspace',action:'Array:weekly',surface:'report-entry-editor',selector:'#reports-new-entry'},
  {panel:'reports.workspace',action:'Array:weekly',surface:'report-task-editor',selector:'#reports-new-task'},
  {panel:'legal.documents',action:'',surface:'legal-history',selector:'#legal-history-section summary'},
];
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=path.resolve(dist,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(dist+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,bytes)=>{res.statusCode=error?404:200;res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');if(!error&&/\.(js|css|html|json)$/.test(file)){res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');bytes=gzipSync(bytes);}res.end(error?'':bytes);});
});
(async()=>{
  // A cold-load score must not inherit heap/trace pressure from preceding
  // Lighthouse navigations. Run each destination in its own Chrome process.
  if(navigationMode&&!process.env.AUDIT_NAV_CHILD){
    const {spawnSync}=require('node:child_process');const combined=[];
    for(const device of (process.env.AUDIT_DEVICES||'desktop,mobile').split(',')){
      const selected=routes.filter((r,index)=>(!process.env.AUDIT_FILTER||(r.panel+':'+r.action).includes(process.env.AUDIT_FILTER))&&(!process.env.AUDIT_SHARDS||index%Number(process.env.AUDIT_SHARDS)===Number(process.env.AUDIT_SHARD)));
      for(const [index,route] of selected.entries()){
        const child=spawnSync(process.execPath,[__filename],{stdio:'inherit',env:{...process.env,AUDIT_NAV_CHILD:'1',AUDIT_ROUTE:JSON.stringify(route),AUDIT_DEVICES:device,AUDIT_LANGS:'en',AUDIT_THEMES:'dark',AUDIT_SHARDS:''}});
        if(child.status!==0)throw Error('Cold navigation failed: '+route.panel+':'+route.action);
        const summary=JSON.parse(fs.readFileSync(path.join(out,'summary.json'),'utf8'));
        if(summary.results.length!==1)throw Error('Expected one isolated navigation');
        combined.push(...summary.results);
        for(const extension of ['html','json']){
          const source=path.join(out,extension==='html'?device+'-en-dark.html':device+'-en-dark-0.json');
          fs.copyFileSync(source,path.join(out,device+'-route-'+index+'.'+extension));
        }
      }
    }
    fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({scope:'Isolated cold navigation; real Firebase SDK downloads, synthetic identity/backend; production authentication and service latency excluded',routes:routes.length,results:combined},null,2));
    return;
  }
  const {default:puppeteer}=await import(auditRequire.resolve('puppeteer'));
  const {startFlow,desktopConfig}=await import(auditRequire.resolve('lighthouse'));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await puppeteer.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:process.env.AUDIT_CHROME_SHELL?'shell':true,pipe:!!process.env.AUDIT_CHROME_SHELL,args:['--no-sandbox','--disable-dev-shm-usage']});
  const results=[],seenFindings=new Set();
  try{
    for(const device of (process.env.AUDIT_DEVICES||'desktop,mobile').split(','))for(const lang of (process.env.AUDIT_LANGS||'en,tr').split(','))for(const theme of (process.env.AUDIT_THEMES||'dark,light').split(',')){
      const page=await browser.newPage();const errors=[];
      page.on('pageerror',error=>{errors.push(error.message);console.error('PAGEERROR',error.message);});
      page.on('console',message=>{if(message.type()==='error'){errors.push(message.text());console.error('CONSOLE',message.text());}});
      await page.setViewport(device==='mobile'?{width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true}:{width:1440,height:900,deviceScaleFactor:1});
      await page.evaluateOnNewDocument(({script,lang,theme})=>{
        if(window!==window.top)return;
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
            // the real Firebase SDK downloads before installing that identity.
            if(url.pathname.endsWith('/js/core/initializer.js')){
              const file=path.join(dist,url.pathname);
              let source=fs.readFileSync(file,'utf8');
              if(process.env.AUDIT_REAL_SDK==='1')source=source.includes("const { startApp } = await import('../main.js');")?source.replace("const { startApp } = await import('../main.js');",fixtureInstall+"\nconst { startApp } = await import('../main.js');"):source.replace(/((?:const|let|var)\s*\{startApp:[^}]+\}=await import\([^)]*\);)/,match=>fixtureInstall+'\n'+match);
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
          if(url.hostname==='cortexishere.com')return await req.respond({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify(url.pathname==='/models'?{producers:{Vertex:{Series:{Example:model}}}}:{models:[]})});
          if(url.hostname==='www.gstatic.com'&&url.pathname.endsWith('/firebase-firestore-compat.js')&&process.env.AUDIT_REAL_SDK==='1'){
            const file=path.join(root,'.lighthouse/vendor','firebase-firestore-compat.js');
            const body=process.env.AUDIT_CACHED_SDK==='1'?fs.readFileSync(file,'utf8'):await (await fetch(url.href)).text();
            return await req.respond({status:200,contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'public,max-age=31536000'},body:'var __auditSavedFirebase=window.firebase;window.firebase=window.__auditRealFirebase;\n'+body+'\nwindow.firebase=__auditSavedFirebase;window.firebase.firestore=window.__auditFirestoreFactory;'});
          }
          if(url.hostname==='www.gstatic.com'&&process.env.AUDIT_CACHED_SDK==='1'){const file=path.join(root,'.lighthouse/vendor',path.basename(url.pathname));if(fs.existsSync(file))return await req.respond({status:200,contentType:'text/javascript',headers:{'Cache-Control':'public,max-age=31536000','Access-Control-Allow-Origin':'*'},body:fs.readFileSync(file)});}
          if(['www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))return await req.continue();
          return await req.respond({status:200,contentType:'text/plain',body:''});
        }catch(error){errors.push(error.message);if(!req.isInterceptResolutionHandled())await req.abort();}
      });
      const waitReady=async()=>{
        await page.waitForFunction(()=>document.querySelector('#admin-panel')?.style.display==='grid',{timeout:60000}).catch(async error=>{console.error('STARTUP',JSON.stringify(await page.evaluate(()=>({stage:document.documentElement.dataset.startupStage,failed:document.documentElement.dataset.startupFailed,text:document.body.innerText.slice(0,600)}))));throw error;});
        await page.waitForFunction(()=>![...document.querySelectorAll('.tab-panel.active[aria-busy="true"], .tab-panel.active [aria-busy="true"]')].some(el=>el.getClientRects().length),{timeout:15000});
      };
      if(!navigationMode){await page.goto(base,{waitUntil:'networkidle0'});await waitReady();}
      const flow=await startFlow(page,{name:`Workspaces ${device} ${lang} ${theme}`,config:device==='desktop'?desktopConfig:undefined,flags:{onlyCategories:navigationMode?['performance','accessibility','best-practices']:['accessibility','best-practices']}});
      const selected=process.env.AUDIT_ROUTE?[JSON.parse(process.env.AUDIT_ROUTE)]:[...routes,...(navigationMode?[]:surfaces)].filter(r=>!r.mobileOnly||device==='mobile').filter((r,index)=>(!process.env.AUDIT_FILTER||(r.panel+':'+r.action+':'+(r.surface||'')).includes(process.env.AUDIT_FILTER))&&(!process.env.AUDIT_SHARDS||index%Number(process.env.AUDIT_SHARDS)===Number(process.env.AUDIT_SHARD)));
      for(const route of selected){
        const begin=performance.now();const before=errors.length;let readyMs=null;
        if(!navigationMode){await page.keyboard.press('Escape');await page.keyboard.press('Escape');}
        if(navigationMode){
          await flow.navigate(async()=>{
            await page.goto(base+'/?panel='+encodeURIComponent(route.panel)+'&view='+encodeURIComponent(route.action),{waitUntil:'domcontentloaded'});
            await waitReady();
            if(route.panel==='profile')await page.evaluate(()=>document.querySelector('.dock-btn[data-target="tab-profile"]').click());
            await new Promise(r=>setTimeout(r,250));
            await waitReady();
            readyMs=await page.evaluate(()=>performance.now());
          },{name:route.panel+':'+route.action});
        }else{
        await page.evaluate(route=>{
          if(route.panel==='profile'){document.querySelector('.dock-btn[data-target="tab-profile"]').click();return;}
          history.replaceState({vertexRoute:{panel:route.panel,action:route.action}},'','?panel='+encodeURIComponent(route.panel)+'&view='+encodeURIComponent(route.action));
          dispatchEvent(new PopStateEvent('popstate'));
        },route);
        await page.waitForFunction(()=>![...document.querySelectorAll('.tab-panel.active [aria-busy=\"true\"]')].some(el=>el.getClientRects().length),{timeout:15000});
        await new Promise(r=>setTimeout(r,250));
        await page.evaluate(()=>document.fonts.ready);
        if(route.surface){
          await page.waitForSelector(route.selector,{visible:true});
          await page.click(route.selector);
          await new Promise(r=>setTimeout(r,300));
          await waitReady();
        }
        }
        const elapsed=Math.round(performance.now()-begin);
        const active=await page.evaluate(()=>({panel:document.querySelector('.tab-panel.active')?.id,workspace:document.querySelector('.tab-panel.active')?.dataset.workspace,theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth+1}));
        if(!navigationMode)await flow.snapshot({name:route.panel+':'+route.action+(route.surface?':'+route.surface:'')});
        const lhr=(await flow.createFlowResult()).steps.at(-1).lhr;
        fs.writeFileSync(path.join(out,device+'-'+lang+'-'+theme+'-'+results.length+'.json'),JSON.stringify(lhr));
        const failures=Object.values(lhr.audits).filter(a=>a.score!==null&&a.score<1).map(a=>({id:a.id,title:a.title,details:a.details}));
        const metrics=Object.fromEntries(['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'].filter(k=>lhr.audits[k]).map(k=>[k,lhr.audits[k].numericValue]));
        metrics.lcpElement=lhr.audits['lcp-breakdown-insight']?.details?.items?.find(item=>item.type==='node')?.selector;
        const item={device,lang,theme,...route,active,elapsed,readyMs,scores:Object.fromEntries(Object.entries(lhr.categories).map(([k,v])=>[k,v.score===null?null:Math.round(v.score*100)])),metrics,failures,errors:errors.slice(before)};
        results.push(item);fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({scope:navigationMode?'Built application cold navigation; real SDK loading, synthetic identity and backend; excludes real authentication/production service latency':'Built application; synthetic identity and backend fixtures; snapshots do not produce a performance score',routes:routes.length,results},null,2));
        console.log(JSON.stringify({...item,failures:failures.map(f=>f.id)}));
        for(const failure of failures)for(const row of (Array.isArray(failure.details?.items)?failure.details.items:[])){const key=failure.id+row.node?.selector+row.node?.explanation;if(!seenFindings.has(key)){seenFindings.add(key);console.log('FINDING',JSON.stringify({device,lang,theme,route,audit:failure.id,item:row}));}}
      }
      fs.writeFileSync(path.join(out,`${device}-${lang}-${theme}.html`),await flow.generateReport());
      await page.close();
    }
    const regressions=results.filter(item=>item.active.overflow||item.errors.length||['accessibility','best-practices'].some(category=>item.scores[category]!==100));
    if(regressions.length)throw Error('Workspace quality gate failed: '+regressions.map(item=>item.device+':'+item.panel+':'+item.action).join(', '));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
