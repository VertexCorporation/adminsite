import {createZapierSdk} from '@zapier/zapier-sdk';
const zapier=createZapierSdk({maxNetworkRetries:0,approvalMode:'disabled'});
export default async function main({inputData,connections}){
 if(!connections?.certificate_callback)throw Error('Certificate callback connection is required.');
 const request=JSON.parse(inputData.validationRequest),event=request.event;
 const tenure=request.action==='validateEvent';
 if(!event||(!tenure&&request.action!=='validateLegacyEvent'))throw Error('Invalid certificate context.');
 const ids=tenure?{certificateJobId:event.certificateJobId,contributorId:event.contributorId,attemptId:event.attemptId}:{issuanceId:event.issuanceId,contributorId:event.contributorId,attemptId:event.attemptId};
 if(!ids.contributorId||!ids.attemptId||!(tenure?ids.certificateJobId:ids.issuanceId))throw Error('Invalid certificate correlation.');
 const response=await zapier.fetch('https://europe-west1-vertex-ai-1618.cloudfunctions.net/zapierContributorCallback',{connectionId:connections.certificate_callback,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'claimDelivery',...ids,event,pdfGenerated:tenure}),maxTimeSeconds:15});
 if(!response.ok)throw Error('Certificate delivery claim was rejected.');
 const claim=await response.json();
 if(claim.proceed!==true)throw Error('Certificate delivery is blocked.');
 return {proceed:true};
}
