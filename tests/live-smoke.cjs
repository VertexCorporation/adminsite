// Explicit, read-only production startup verification; never signs in or mutates data.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const url=process.env.VERTEX_LIVE_URL||'https://admin.vertexishere.com/';
 const sourceMatches=[];
 for(const file of ['index.html','assets/vertex-logo.svg','css/tokens.css','css/layout.css','js/lang.js','js/modules/shell.js']) {
  const response=await fetch(url+file+'?precision-verification='+Date.now());assert.equal(response.status,200);
  const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
  sourceMatches.push({file,matches:hash(Buffer.from(await response.arrayBuffer()))===hash(fs.readFileSync(path.join(root,file)))});
 }
 assert(sourceMatches.every(item=>item.matches),'production source differs from tested checkout');
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage();const errors=[],consoleErrors=[],failedRequests=[],responseDetails=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 page.on('response',response=>{if(response.status()>=400){const entry={url:response.url().split('?')[0],status:response.status()};failedRequests.push(entry);if(response.url().includes('firebaseappcheck.googleapis.com'))responseDetails.push(response.json().then(body=>{entry.errorCode=body.error?.status;entry.reason=body.error?.message;}).catch(()=>{}));}});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForSelector('#login-container',{state:'visible',timeout:45000});
 await page.waitForSelector('#app-loader',{state:'detached',timeout:45000});
 const screenshots=[];
 for(const width of [390,1440])for(const theme of ['dark','light']) {
  await page.setViewportSize({width,height:900});
  await page.evaluate(async mode=>(await import('/js/modules/shell.js')).applyTheme(mode),theme);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const file=path.join(root,`tests/results/final-polish/live-login-${width}-${theme}.png`);
  await page.screenshot({path:file});screenshots.push(file);
 }
 await Promise.all(responseDetails);
 const report={url,verifiedAt:new Date().toISOString(),sourceMatches,loginVisible:await page.locator('#login-container').isVisible(),loaderHidden:true,viewportWidths:[390,1440],themes:['dark','light'],errors,consoleErrors,failedRequests,screenshots,authenticatedWritesTested:false};
 fs.writeFileSync(path.join(root,'tests/results/final-polish-live.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));await browser.close();
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedRequests,[]);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
