// One controlled trigger sample. No Firestore writes, claims or Gmail calls.
// The published v12 paths both require top-level email; omit it deliberately.
const {execFileSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {writeFileSync}=require('node:fs');
const {fixture}=require('../../../Fulcrum/functions/test/certificate-fixture');
const {signEvent,verifySignature}=require('../../../Fulcrum/functions/src/certificateEvents');
const secret=name=>execFileSync('/opt/homebrew/bin/gcloud',['secrets','versions','access','latest','--secret='+name,'--project=vertex-ai-1618'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
(async()=>{
 const language=process.argv[2]||'tr',type=process.argv[3]||'majesty';
 if(!['tr','en'].includes(language)||!['tenacity','constancy','nobility','majesty'].includes(type))throw Error('Invalid isolated certificate combination.');
 let payload;const f=fixture(async e=>{payload=e;return {ok:true};});
 Object.assign(f.records.get('contributors/person'),{name:'Deniz Isolated QA',email:'certificate-qa@example.invalid',language});
 await f.service.issue({contributorId:'person',certificateType:type},'isolated-qa');
 const contributorId='isolated-qa-'+randomUUID(),certificateJobId=contributorId+'--'+type;
 const event={...payload,contributorId,certificateJobId,verificationId:certificateJobId,id:certificateJobId,issuanceId:certificateJobId,attemptId:randomUUID(),verificationUrl:'https://vertexishere.com/verify/'+certificateJobId};
 const signing=secret('ZAPIER_CERTIFICATE_EVENT_SIGNING_SECRET');
 event.eventSignature=signEvent(event,signing);
 if(!verifySignature(event,signing))throw Error('Isolated event signing failed.');
 const envelope={language:'tr',certificateQA:true,eventJson:JSON.stringify(event)};
 if(Object.hasOwn(envelope,'email')||Object.hasOwn(envelope,'name'))throw Error('Unsafe legacy sample.');
 writeFileSync('/private/tmp/vertex-isolated-trigger-event.json',JSON.stringify(event),{mode:0o600});
 const response=await fetch(secret('ZAPIER_CONTRIBUTOR_WEBHOOK_URL'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(envelope),signal:AbortSignal.timeout(15000)});
 console.log(JSON.stringify({hookStatus:response.status,signed:true,legacyEmailFieldAbsent:true,certificateJobId,productionJobCreated:false}));
 if(!response.ok)process.exitCode=1;
})().catch(()=>{console.error('Isolated trigger sample failed; no automatic retry.');process.exitCode=1;});
