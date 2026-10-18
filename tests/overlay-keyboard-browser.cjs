'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html='<html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/ui/overlay.css"></head><body><button id="caller">Open</button></body></html>';
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(!/^\/(js|css)\//.test(u.pathname)){res.writeHead(404);res.end();return;}
 const target=path.resolve(root,'.'+u.pathname);
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(target,(error,bytes)=>{
  if(error){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',target.endsWith('.css')?'text/css':'text/javascript');res.end(bytes);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [375,1440]){
   const page=await browser.newPage({viewport:{width,height:780},reducedMotion:width===375?'reduce':'no-preference'});
   const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.evaluate(async()=>{window.overlays=await import('/js/modules/shell.js');});
   await page.locator('#caller').focus();
   await page.evaluate(()=>window.overlays.openDrawer({title:'Test Drawer',render:body=>{body.innerHTML='<input id="drawer-first"><button id="drawer-last">Last</button>';}}));
   await page.locator('.vx-drawer.is-open').waitFor();
   assert.equal(await page.locator('.vx-drawer').getAttribute('role'),'dialog');
   assert.equal(await page.locator('.vx-drawer').getAttribute('aria-modal'),'true');
   await page.locator('.drawer-close').focus();
   await page.keyboard.press('Shift+Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'drawer-last');
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('drawer-close')),true);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#caller').evaluate(el=>el===document.activeElement),true);
   await page.evaluate(()=>window.overlays.openModal({title:'Test Modal',render:body=>{body.innerHTML='<input id="modal-first"><button id="modal-last">Last</button>';}}));
   await page.locator('.vx-modal.is-open').waitFor();
   await page.locator('.modal-close').focus();
   await page.keyboard.press('Shift+Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'modal-last');
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#caller').evaluate(el=>el===document.activeElement),true);
   await page.evaluate(()=>{window.confirmResult='pending';window.overlays.confirmDialog({title:'Delete?'}).then(x=>window.confirmResult=x);});
   await page.locator('.confirm-dialog-modal').waitFor();
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>window.confirmResult===false);
   assert.equal(await page.locator('#caller').evaluate(el=>el===document.activeElement),true);
   assert.deepEqual(exceptions,[]);
   await page.close();
  }
  console.log('PASS dialog keyboard and focus lifecycle: mobile/desktop, reduced/no-preference');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
