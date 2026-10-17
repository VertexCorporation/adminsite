const test=require('node:test'),assert=require('node:assert/strict');
const {claimAndSubmit}=require('../tools/zapier/claim-and-submit.cjs');
const {fixture}=require('../../Fulcrum/functions/test/certificate-fixture');
async function operation(){
 let event;const f=fixture(async payload=>{event=payload;return {ok:true};});
 await f.service.issue({contributorId:'person',certificateType:'majesty'},'isolated-qa');
 const correlation={certificateJobId:event.certificateJobId,contributorId:event.contributorId,attemptId:event.attemptId};
 await f.service.callback({...correlation,status:'pdf_generated'});
 return {f,correlation,claim:()=>f.service.claimDelivery(correlation)};
}
test('separate Gmail step replay bypasses a cached claim: demonstrates actual architecture blocker',async()=>{
 const op=await operation();const cached=await op.claim();assert.equal(cached.proceed,true);
 let externalActions=0;const gmail=async()=>{externalActions++;throw Error('Network timeout after external action');};
 await assert.rejects(gmail());await assert.rejects(gmail());
 assert.equal(externalActions,2);assert.equal((await op.claim()).proceed,false);
});
test('one-action candidate rechecks permanent claim on replay after an ambiguous external action',async()=>{
 const op=await operation();let externalActions=0,claims=0;
 const dependencies={claim:()=>{claims++;return op.claim();},send:async()=>{externalActions++;throw Error('Timeout after external action');},acknowledge:async()=>{throw Error('Must not acknowledge');},markUncertain:()=>op.f.service.callback({...op.correlation,status:'uncertain'})};
 assert.equal((await claimAndSubmit(dependencies)).outcome,'submission_uncertain');
 assert.equal((await claimAndSubmit(dependencies)).outcome,'blocked');
 assert.equal(claims,2);assert.equal(externalActions,1);
 assert.equal(op.f.records.get('certificates/person--majesty').retrySafe,false);
});
test('callback failure after acknowledged Gmail submission cannot cause a resend on replay',async()=>{
 const op=await operation();let externalActions=0;
 const dependencies={claim:op.claim,send:async()=>{externalActions++;return {id:'isolated-gmail-receipt'};},acknowledge:async()=>{throw Error('Callback timeout');},markUncertain:async()=>{}};
 assert.equal((await claimAndSubmit(dependencies)).outcome,'submitted_callback_pending');
 assert.equal((await claimAndSubmit(dependencies)).outcome,'blocked');assert.equal(externalActions,1);
});
test('only boolean true permits a send; claim timeouts and ambiguous receipts never retry',async()=>{
 for(const permission of [{},null,{proceed:false},{proceed:'true'}]){
  let calls=0;await claimAndSubmit({claim:async()=>permission,send:async()=>{calls++;},acknowledge:async()=>{},markUncertain:async()=>{}});assert.equal(calls,0);
 }
 let calls=0;const op=await operation();const dependencies={claim:op.claim,send:async()=>{calls++;return {};},acknowledge:async()=>{throw Error('Must not acknowledge');},markUncertain:()=>op.f.service.callback({...op.correlation,status:'uncertain'})};
 assert.equal((await claimAndSubmit(dependencies)).outcome,'submission_uncertain');await claimAndSubmit(dependencies);assert.equal(calls,1);
 const timeout=await claimAndSubmit({...dependencies,claim:async()=>{throw Error('Claim timeout');}});assert.equal(timeout.outcome,'claim_uncertain');assert.equal(calls,1);
});
