const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('../../Fulcrum/functions/test/certificate-fixture');
const source=fs.readFileSync(require('node:path').join(__dirname,'../tools/zapier/delivery-step.mjs'),'utf8').replace(/^import .*;\n/,'').replace('export default async function main','async function main');
async function setup(type='majesty',mode='timeout',language='tr',pdfSize=21){
 let event;const f=fixture(async p=>{event=p;return {ok:true};});f.records.get('contributors/person').language=language;await f.service.issue({contributorId:'person',certificateType:type},'admin');let sends=0,claims=0,mail;
 const chunks=[];
 const sdk={fetch:async(url,options)=>{
  if(url.includes('gmail.googleapis.com')){
   assert.equal(options.connectionId,202);
   if(options.method==='GET')return new Response(JSON.stringify({emailAddress:mode==='wrong-account'?'other@example.invalid':'mustafa@vertexishere.com'}));
   if(options.method==='POST'){sends++;assert(url.includes('uploadType=resumable'));assert.equal(options.body,'{}');return new Response(null,{headers:{location:'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?upload_id=isolated'}});}
   assert.equal(options.method,'PUT');assert.equal(options.headers['Content-Type'],'application/octet-stream');assert.equal(options.redirect,'manual');assert(Buffer.isBuffer(options.body));assert(options.body.length<=256*1024);chunks.push(options.body);
   const [,start,end,total]=options.headers['Content-Range'].match(/^bytes (\d+)-(\d+)\/(\d+)$/);assert.equal(Number(start),chunks.slice(0,-1).reduce((n,b)=>n+b.length,0));assert.equal(Number(end)-Number(start)+1,options.body.length);
   if(mode==='chunk-timeout')throw Error('chunk response lost');
   if(Number(end)+1<Number(total))return new Response(null,{status:308,headers:{range:mode==='bad-range'?'bytes=0-1':`bytes=0-${end}`}});
   mail=Buffer.concat(chunks).toString();assert(mail.includes('Content-Type: application/pdf'));if(mode==='timeout')throw Error('timeout after send');return new Response(JSON.stringify({id:'isolated-receipt'}));
  }
  assert.equal(options.method,'POST');const body=JSON.parse(options.body);
  assert.equal(options.connectionId,101);let result;if(body.action==='claimDelivery'){claims++;result=await f.service.claimDelivery(body);}else if(body.action==='markDeliveryUncertain')result=await f.service.markDeliveryUncertain(body);else{result=await f.service.callback(body);if(mode==='callback-timeout')throw Error('ack response lost');}return new Response(JSON.stringify(result));
 }};
 const pdf=Buffer.alloc(pdfSize);pdf.write('%PDF-isolated-fixture');
 const main=vm.runInNewContext(source+';main',{createZapierSdk:options=>{assert.equal(options.maxNetworkRetries,0);assert.equal(options.approvalMode,'disabled');return sdk;},URL,Buffer,AbortSignal,fetch:async()=>new Response(pdf)});
 const inputData={validationRequest:JSON.stringify({action:type==='merit'?'validateLegacyEvent':'validateEvent',event}),file:'https://zapier-dev-files.s3.amazonaws.com/cli-platform/20739/isolated'};
 return {f,main,inputData,connections:{certificate_callback:101,certificate_gmail:202},get sends(){return sends;},get claims(){return claims;},get mail(){return mail;},chunks};
}
for(const type of ['majesty','merit'])test(`${type}: exact production Code source rechecks claim on Gmail replay after timeout`,async()=>{
 const f=await setup(type);assert.equal((await f.main({inputData:f.inputData,connections:f.connections})).outcome,'submission_uncertain');assert.equal((await f.main({inputData:f.inputData,connections:f.connections})).outcome,'blocked');assert.equal(f.sends,1);assert.equal(f.claims,2);assert.equal(f.f.records.get(type==='merit'?'certificates/person':'certificates/person--majesty').status,'uncertain');
});
test('exact production Code source handles a lost success callback without resending',async()=>{
 const f=await setup('majesty','callback-timeout');assert.equal((await f.main({inputData:f.inputData,connections:f.connections})).outcome,'submitted_callback_pending');assert.equal((await f.main({inputData:f.inputData,connections:f.connections})).outcome,'blocked');assert.equal(f.sends,1);assert.equal(f.claims,2);
});
test('missing Zapier runtime connections fail before claiming or sending',async()=>{
 const f=await setup();await assert.rejects(f.main({inputData:f.inputData}),/connections are required/);assert.equal(f.sends,0);assert.equal(f.claims,0);
});
for(const language of ['tr','en'])test(`legacy ${language}: recipient survives Zapier template interpolation`,async()=>{
 assert(!source.includes('{{NAME}}'));
 const f=await setup('merit','success',language);assert.equal((await f.main({inputData:f.inputData,connections:f.connections})).outcome,'submitted');
 const encoded=f.mail.match(/Subject: =\?UTF-8\?B\?([^?]+)/)[1];assert(Buffer.from(encoded,'base64').toString().includes('Test Person'));
 const html=f.mail.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0];assert(Buffer.from(html,'base64').toString().includes('<strong>Test Person</strong>'));
});
test('large PDF uses one claimed session and bounded, contiguous byte chunks',async()=>{
 const f=await setup('majesty','success','en',1605383);const result=await f.main({inputData:f.inputData,connections:f.connections});assert.equal(result.outcome,'submitted');assert.equal(result.gmailHttpStatus,200);assert.equal(f.sends,1);assert(f.chunks.length>5);assert.equal((await f.main({inputData:f.inputData,connections:f.connections})).outcome,'blocked');assert.equal(f.sends,1);
});
for(const mode of ['chunk-timeout','bad-range'])test(`${mode}: stop the session and never repeat a chunk or restart on replay`,async()=>{
 const f=await setup('majesty',mode,'en',1605383);assert.equal((await f.main({inputData:f.inputData,connections:f.connections})).outcome,'submission_uncertain');assert.equal(f.chunks.length,1);assert.equal((await f.main({inputData:f.inputData,connections:f.connections})).outcome,'blocked');assert.equal(f.chunks.length,1);assert.equal(f.sends,1);
});
test('wrong Gmail OAuth identity fails before the claim and upload session',async()=>{
 const f=await setup('majesty','wrong-account');await assert.rejects(f.main({inputData:f.inputData,connections:f.connections}),/identity/);assert.equal(f.sends,0);assert.equal(f.claims,0);
});
