// Isolated PDF QA only. No production endpoint, credentials or database is used.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{execFileSync}=require('child_process');
const {fixture}=require('../../Fulcrum/functions/test/certificate-fixture');
const {background,TYPES}=require('../../Fulcrum/functions/src/certificatePolicy');
const root=path.resolve(__dirname,'..'),output=path.join(root,'output/pdf/certificates');
const runtime='/Users/baba/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const fontPath=process.env.VERTEX_UBUNTU_BOLD||path.join(runtime,'native/poppler/poppler/fonts/Ubuntu-B.ttf');
const python=process.env.VERTEX_PYTHON||path.join(runtime,'python/bin/python3');
const template=fs.readFileSync(path.join(__dirname,'fixtures/certificate-v12-resolved.html'),'utf8');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function resolveHtml(event,qr){
 assert(Object.hasOwn(TYPES,event.certificateType));assert(['tr','en'].includes(event.language));
 assert.equal(event.backgroundUrl,background(event.certificateType,event.language));
 const id=event.certificateType==='merit'?event.contributorId:event.certificateJobId;
 assert.equal(event.verificationUrl,`https://vertexishere.com/verify/${id}`);
 const name=event.certificateType==='merit'?event.name:event.recipientName;
 assert.equal(typeof name,'string');assert(name.trim());assert.equal(typeof event.formattedDate,'string');assert(event.formattedDate);
 const values={FOREGROUND:event.certificateType==='majesty'?'#ffffff':'#111111',QR_BORDER:event.certificateType==='majesty'?'#ffffff':'#111111',LANGUAGE:event.language,NAME:escape(name),FORMATTED_DATE:escape(event.formattedDate),FONT_DATA_URL:`data:font/ttf;base64,${fs.readFileSync(fontPath).toString('base64')}`,BACKGROUND_DATA_URL:`data:image/webp;base64,${fs.readFileSync(path.resolve(root,'../vertexite/assets/certificates',path.basename(new URL(event.backgroundUrl).pathname))).toString('base64')}`,QR_DATA_URL:`data:image/png;base64,${qr.toString('base64')}`};
 const html=template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>values[key]);assert(!/\{\{|<script\b/.test(html));return html;
}
(async()=>{
 fs.mkdirSync(output,{recursive:true});const results=[];
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try{
  for(const type of Object.keys(TYPES))for(const language of ['tr','en']){
   let event;const f=fixture(async p=>{event=p;return {ok:true};});
   const dummy={...f.records.get('contributors/person'),name:language==='tr'?'Deniz Örnek':'Deniz Example',language};
   f.records.delete('contributors/person');f.records.set('contributors/isolated-pdf-qa-person',dummy);
   await f.service.issue({contributorId:'isolated-pdf-qa-person',certificateType:type},'isolated-qa');
   const stem=`${type}-${language}`,qrFile=path.join(output,`${stem}-qr.png`);
   execFileSync(python,[path.join(__dirname,'certificate-pdf-qa.py'),'qr',event.verificationUrl,qrFile]);
   const html=resolveHtml(event,fs.readFileSync(qrFile));fs.writeFileSync(path.join(output,`${stem}.html`),html);
   const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:2000,height:1414}});const page=await context.newPage();
   const requests=[];await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
   await page.setContent(html,{waitUntil:'load'});
   // Test-driver evaluation reads the rendered DOM; document JavaScript is disabled.
   const geometry=await page.evaluate(async()=>{
    await document.fonts.ready;
    const qrStyle=getComputedStyle(document.querySelector('.qr-box'));
    return {fontLoaded:document.fonts.check('700 64pt Ubuntu'),qrBorder:qrStyle.borderTopColor,qrBorderWidth:qrStyle.borderTopWidth,qrBackground:qrStyle.backgroundColor,images:Array.from(document.images).map(img=>({complete:img.complete,width:img.naturalWidth})),boxes:Object.fromEntries(['.certificate-container','.name-box','.name-text','.date-box','.qr-box','.qr-box img'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return [selector,{x:r.x,y:r.y,width:r.width,height:r.height}];})),text:document.querySelector('.name-text').textContent,date:document.querySelector('.date-text').textContent,scripts:document.scripts.length};
   });
   assert.equal(geometry.fontLoaded,true);assert.equal(geometry.scripts,0);assert(geometry.images.every(img=>img.complete&&img.width>0));assert.deepEqual(requests,[]);
   assert.equal(geometry.qrBorder,type==='majesty'?'rgb(255, 255, 255)':'rgb(17, 17, 17)');assert.equal(geometry.qrBorderWidth,'2px');assert.equal(geometry.qrBackground,'rgb(255, 255, 255)');
   assert.equal(geometry.boxes['.certificate-container'].width,2000);assert.equal(geometry.boxes['.certificate-container'].height,1414);
   assert.equal(geometry.boxes['.name-box'].width,1600);assert(Math.abs(geometry.boxes['.name-box'].y+geometry.boxes['.name-box'].height/2-1414*.43)<.1);
   const date=geometry.boxes['.date-box'];assert(Math.abs(date.x+date.width/2-562)<.1);assert(Math.abs(date.y+date.height-(1414-356))<.1);
   const qr=geometry.boxes['.qr-box'];assert.equal(qr.width,168);assert.equal(qr.height,168);assert.equal(qr.x,916);assert.equal(qr.y,1222);assert.equal(geometry.boxes['.qr-box img'].width,144);
   assert.equal(geometry.text,event.name);assert.equal(geometry.date,event.formattedDate);
   // Confirm text fits the unchanged legacy name area.
   assert(await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('.name-text'));return range.getBoundingClientRect().width<=1600;}));
   await page.pdf({path:path.join(output,`${stem}.pdf`),width:'2000px',height:'1414px',margin:{top:0,right:0,bottom:0,left:0},printBackground:true,preferCSSPageSize:true});
   await context.close();results.push({type,language,expectedName:event.name,formattedDate:event.formattedDate,verificationUrl:event.verificationUrl,asset:path.basename(new URL(event.backgroundUrl).pathname),geometry,externalRequests:0});
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(results,null,2));
 execFileSync(python,[path.join(__dirname,'certificate-pdf-qa.py'),'verify',output],{stdio:'inherit',env:{...process.env,PYTHONPATH:'/private/tmp/vertex-cert-qa-python'}});
})().catch(error=>{console.error(error);process.exitCode=1;});
