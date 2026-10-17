const test=require('node:test'),assert=require('node:assert/strict');
const {prepareEvent}=require('../tools/zapier/prepare-event');
const {fixture}=require('../../Fulcrum/functions/test/certificate-fixture');
const {signEvent}=require('../../Fulcrum/functions/src/certificateEvents');
async function eventFor(type,language='tr'){
 let event;const f=fixture(async payload=>{event=payload;return {ok:true};});
 Object.assign(f.records.get('contributors/person'),{name:'Deniz <Örnek> & Example',email:'certificate-qa@example.invalid',language});
 await f.service.issue({contributorId:'person',certificateType:type},'isolated-qa');
 return type==='merit'?event:{...event,eventSignature:signEvent(event,'isolated-signing-secret-at-least-thirty-two-characters')};
}
test('all ten preparations retain the original event, canonical recipient, policy and separate callbacks',async()=>{
 for(const type of ['merit','tenacity','constancy','nobility','majesty'])for(const language of ['tr','en']){
  const event=await eventFor(type,language),original=structuredClone(event),r=prepareEvent({originalJson:JSON.stringify(event)});
  assert.deepEqual(JSON.parse(r.validationRequest).event,original);assert.deepEqual(event,original);
  assert.equal(r.language,language);assert.equal(r.recipientEmail,'certificate-qa@example.invalid');
  assert.equal(r.nameHtml,'Deniz &lt;Örnek&gt; &amp; Example');
  assert.equal(new URL(r.qrUrl).searchParams.get('text'),event.verificationUrl);
  assert(!/<script\b|\{\{|undefined/.test(r.pdfHtml));assert(r.pdfHtml.includes(event.backgroundUrl));
  assert.equal(r.qrBorder,type==='majesty'?'#ffffff':'#111111');assert(r.pdfHtml.includes(`border:2px solid ${r.qrBorder}`));
  assert(r.pdfHtml.includes(r.nameHtml));assert(r.pdfHtml.includes('size:2000px 1414px'));assert(r.pdfHtml.includes(`color:${r.foreground}`));
  const claim=JSON.parse(r.claimRequest),success=JSON.parse(r.successRequest),failure=JSON.parse(r.pdfFailureRequest);
  assert.equal(claim.action,'claimDelivery');assert.equal(claim.attemptId,event.attemptId);
  assert.equal(failure.deliveryNotSent,true);
  if(type==='merit'){
   assert.equal(JSON.parse(r.validationRequest).action,'validateLegacyEvent');
   for(const body of [claim,success,failure])for(const key of ['certificateJobId','eventKind','contractVersion'])assert.equal(Object.hasOwn(body,key),false);
   assert.equal(success.status,'success');assert.equal(r.emailHtml,'');assert.equal(r.uncertainRequest,'');
  }else{
   assert.equal(JSON.parse(r.validationRequest).action,'validateEvent');assert.equal(success.status,'gmail_submitted');
   assert.equal(JSON.parse(r.pdfGeneratedRequest).status,'pdf_generated');assert.equal(failure.status,'pdf_failed');
   assert.equal(claim.certificateJobId,event.certificateJobId);assert(r.emailHtml.includes('Deniz &lt;Örnek&gt; &amp; Example'));
   if(type==='majesty')assert(r.emailHtml.includes('12'));if(type==='nobility')assert(r.emailHtml.includes('6'));
  }
 }
});
test('malformed or incomplete tenure inputs never use the Merit fallback',async()=>{
 const legacy=await eventFor('merit'),tenure=await eventFor('tenacity');
 for(const raw of ['', '{}','null','[]','not json'])assert.throws(()=>prepareEvent({originalJson:raw}));
 for(const key of ['eventKind','contractVersion','certificateJobId'])assert.throws(()=>prepareEvent({originalJson:JSON.stringify({...legacy,[key]:''})}));
 for(const certificateType of ['',null,'unknown','TENACITY'])assert.throws(()=>prepareEvent({originalJson:JSON.stringify({...legacy,certificateType})}));
 for(const key of ['attemptId','recipientName','verificationUrl','eventSignature']){const broken={...tenure};delete broken[key];assert.throws(()=>prepareEvent({originalJson:JSON.stringify(broken)}));}
 const aliases={...tenure,name:'Alias',email:'alias@example.invalid'};const r=prepareEvent({originalJson:JSON.stringify(aliases)});assert.equal(r.recipientName,tenure.recipientName);assert.equal(r.recipientEmail,tenure.recipientEmail);
});
test('legacy absence of type is only a validation candidate, never delivery permission',async()=>{
 const event=await eventFor('merit');delete event.certificateType;
 const r=prepareEvent({originalJson:JSON.stringify(event)});assert.equal(JSON.parse(r.validationRequest).action,'validateLegacyEvent');
 assert.equal(Object.hasOwn(r,'valid'),false);assert.equal(Object.hasOwn(r,'proceed'),false);
 delete event.attemptId;assert.throws(()=>prepareEvent({originalJson:JSON.stringify(event)}));
});
test('the exact saved Zapier ESM source matches the tested contract across ten cases',async()=>{
 const {default:main}=await import('../tools/zapier/prepare-event-zapier.mjs');
 for(const type of ['merit','tenacity','constancy','nobility','majesty'])for(const language of ['tr','en']){
  const inputData={originalJson:JSON.stringify(await eventFor(type,language))};
  const expected=prepareEvent(inputData),actual=await main({inputData});
  for(const key of Object.keys(expected))if(key!=='pdfHtml')assert.deepEqual(actual[key],expected[key],key);
  assert(!/<script\b|\{\{|undefined/.test(actual.pdfHtml));assert(actual.pdfHtml.includes(actual.nameHtml));
  assert(actual.pdfHtml.includes(actual.backgroundUrl));assert(actual.pdfHtml.includes('size:2000px 1414px'));
 }
 await assert.rejects(main({inputData:{originalJson:''}}));
});
test('Catch Hook whole output preserves the exact signed carrier for all ten combinations',async()=>{
 const {default:main}=await import('../tools/zapier/prepare-event-zapier.mjs');
 const {verifySignature}=require('../../Fulcrum/functions/src/certificateEvents');
 for(const type of ['merit','tenacity','constancy','nobility','majesty'])for(const language of ['tr','en']){
  const event=await eventFor(type,language);
  for(const carrier of [JSON.stringify(event),event]){
   const outer={...event,recipientEmail:'outer-alias@example.invalid',createdAt:{_seconds:1},querystring:{},eventJson:carrier};
   const inputData={originalJson:JSON.stringify(outer)},actual=await main({inputData});
   assert.deepEqual(JSON.parse(actual.validationRequest).event,event);
   assert.deepEqual(prepareEvent(inputData).validationRequest,actual.validationRequest);
   assert.equal(actual.recipientEmail,event.recipientEmail||event.email);
   if(type!=='merit')assert.equal(verifySignature(JSON.parse(actual.validationRequest).event,'isolated-signing-secret-at-least-thirty-two-characters'),true);
  }
 }
 for(const eventJson of [null,{},42,'','not json','null','[]',JSON.stringify({eventJson:'{}'})]){
  await assert.rejects(main({inputData:{originalJson:JSON.stringify({eventJson})}}));
 }
});
