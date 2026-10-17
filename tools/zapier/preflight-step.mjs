import {createZapierSdk} from '@zapier/zapier-sdk';
const zapier=createZapierSdk({maxNetworkRetries:0,approvalMode:'disabled'});
export default async function main({inputData,connections}){
 if(!connections?.certificate_callback)throw Error('Certificate callback connection is required.');
 const request=JSON.parse(inputData.validationRequest);
 if(!['validateEvent','validateLegacyEvent'].includes(request.action)||!request.event||typeof request.event!=='object')throw Error('Invalid certificate validation request.');
 const response=await zapier.fetch('https://europe-west1-vertex-ai-1618.cloudfunctions.net/zapierContributorCallback',{connectionId:connections.certificate_callback,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),maxTimeSeconds:15});
 if(!response.ok)throw Error('Certificate validation was rejected (HTTP '+response.status+').');
 const result=await response.json();if(result.valid!==true)throw Error('Certificate validation did not grant permission.');
 if(typeof result.emailSubject!=='string'||!result.emailSubject.trim()||typeof result.emailHtml!=='string'||!result.emailHtml.trim())throw Error('Validated backend email content is required.');
 return {valid:true,certificateType:result.certificateType,emailSubject:result.emailSubject,emailHtml:result.emailHtml};
}
