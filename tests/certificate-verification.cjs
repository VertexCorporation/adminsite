// Entirely isolated browser verification: every request is fulfilled locally.
const {chromium,webkit}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.resolve(__dirname,'../../vertexite/verify.html'),'utf8');
const types={merit:['Merit','Liyakat'],tenacity:['Tenacity','Dirayet'],constancy:['Constancy','Metanet'],majesty:['Majesty','Asalet'],nobility:['Nobility','Azamet']};
(async()=>{
 const engine=process.env.VERTEX_BROWSER==='webkit'?webkit:chromium;
 const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 let checks=0;
 try{
 for(const width of [390,1440])for(const language of ['tr','en']){
  const context=await browser.newContext({viewport:{width,height:950},locale:language});
  const page=await context.newPage();let response={},failure=false;const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());requests.push(url.hostname);
   if(url.hostname==='localhost'&&url.pathname.startsWith('/verify/'))return route.fulfill({contentType:'text/html',body:html});
   if(url.hostname==='localhost')return route.fulfill({status:200,contentType:url.pathname.endsWith('.js')?'text/javascript':'text/css',body:''});
   if(url.hostname==='europe-west1-vertex-ai-1618.cloudfunctions.net')return failure?route.abort('failed'):route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
   return route.fulfill({status:200,body:''});
  });
  for(const type of Object.keys(types)){
   const id=type==='merit'?'legacy-person':`person--${type}`;
   response={valid:true,certificateId:id,name:'Isolated Recipient',language,certificateType:type,formattedDate:'11/10/2026',issuedAt:type==='merit'?null:'2026-10-11T12:00:00.000Z',deliveryStatus:'submitted'};
   await page.goto(`http://localhost/verify/${id}`);await page.locator('#successState').waitFor({state:'visible'});
   assert.equal(await page.locator('#certName').innerText(),'Isolated Recipient');
   assert.equal(await page.locator('#certType').innerText(),types[type][language==='tr'?1:0]);
   assert.equal(await page.locator('#certId').innerText(),id);
   assert.equal(await page.locator('#certDate').innerText(),'11/10/2026');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(width===390&&language==='tr'&&type==='tenacity'){
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.container')).opacity)===1);
    await page.screenshot({path:'/private/tmp/vertex-tenure-verification-mobile.png',fullPage:true});
   }
   checks++;
  }
  for(const [type,printedName] of [['majesty','Azamet'],['nobility','Asalet']]){
   response={valid:true,certificateId:`old--${type}`,name:'Isolated Recipient',language:'tr',certificateType:type,certificateName:printedName,historicalMapping:true,formattedDate:'01/01/2026'};
   await page.goto(`http://localhost/verify/old--${type}`);await page.locator('#successState').waitFor({state:'visible'});
   assert.equal(await page.locator('#certType').innerText(),printedName);checks++;
  }
  for(const invalid of [{valid:false},{valid:false,revoked:true,certificateId:'person--tenacity'},{valid:true,name:'Bad',certificateType:'unknown'},{valid:true,certificateType:'tenacity'}]){
   response=invalid;await page.goto('http://localhost/verify/person--tenacity');await page.locator('#errorState').waitFor({state:'visible'});
   assert.equal(await page.locator('#successState').isVisible(),false);
   if(invalid.revoked)assert.match(await page.locator('#errorState h1').textContent(),language==='tr'?/İptal/:/Revoked/);
   checks++;
  }
  failure=true;await page.goto('http://localhost/verify/person--tenacity');await page.locator('#errorState').waitFor({state:'visible'});checks++;
  assert.equal(requests.some(host=>host.includes('firestore')),false);assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log(JSON.stringify({engine:process.env.VERTEX_BROWSER||'chromium',checks,realRequests:0,result:'passed'}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
