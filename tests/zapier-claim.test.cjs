'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../tools/zapier/claim-step.mjs'),'utf8').replace(/^import .*;\n/,'').replace('export default async function main','async function main');
function fixture(result={proceed:true}){let body,calls=0;const main=vm.runInNewContext(source+';main',{createZapierSdk:()=>({fetch:async(url,options)=>{calls++;body=JSON.parse(options.body);assert.equal(options.connectionId,101);return {ok:true,json:async()=>result};}})});return {main,get body(){return body;},get calls(){return calls;}};}
for(const tenure of [false,true])test(`${tenure?'Tenure':'Merit'} uses the right ID and signals PDF generation in the permanent claim`,async()=>{
 const f=fixture(),event={contributorId:'person',attemptId:'attempt',...(tenure?{certificateJobId:'person--tenacity'}:{issuanceId:'person'})};
 await f.main({connections:{certificate_callback:101},inputData:{validationRequest:JSON.stringify({action:tenure?'validateEvent':'validateLegacyEvent',event})}});
 assert.deepEqual(f.body,{action:'claimDelivery',...event,event,pdfGenerated:tenure});assert.equal(f.calls,1);
});
test('a refused delivery claim stops the next Gmail action',async()=>{const f=fixture({proceed:false});await assert.rejects(()=>f.main({connections:{certificate_callback:101},inputData:{validationRequest:JSON.stringify({action:'validateLegacyEvent',event:{contributorId:'p',attemptId:'a',issuanceId:'p'}})}}),/blocked/);});
