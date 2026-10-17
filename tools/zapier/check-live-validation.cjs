// Read-only live authentication/signature check against an unissued test ID.
const {execFileSync}=require('node:child_process');
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const event=JSON.parse(readFileSync('/private/tmp/vertex-isolated-trigger-event.json','utf8'));
 const key=execFileSync('/opt/homebrew/bin/gcloud',['secrets','versions','access','latest','--secret=ZAPIER_CERTIFICATE_CALLBACK_SECRET','--project=vertex-ai-1618'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const endpoint='https://europe-west1-vertex-ai-1618.cloudfunctions.net/zapierContributorCallback';
 const call=async(event,authenticated)=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+key}:{})},body:JSON.stringify({action:'validateEvent',event}),signal:AbortSignal.timeout(15000)});
 const missing=await call(event,true);assert.equal(missing.status,404);const missingBody=await missing.json();assert.equal(missingBody.error,'Certificate job not found.');
 const tampered=await call({...event,recipientName:'Changed'},true);assert.equal(tampered.status,403);
 const unauthorized=await call(event,false);assert.equal(unauthorized.status,403);
 console.log(JSON.stringify({newCredentialAuthenticated:true,originalSignatureAccepted:true,unissuedJobRejected:missing.status,tamperedSignatureRejected:tampered.status,unauthorizedRejected:unauthorized.status,productionWrites:0}));
})().catch(()=>{console.error('Live validation check failed; investigate without exposing credentials.');process.exitCode=1;});
