import {createZapierSdk} from '@zapier/zapier-sdk';
const zapier=createZapierSdk({maxNetworkRetries:0,approvalMode:'disabled'});
export default async function main({inputData,connections}){
 if(!connections?.certificate_callback)throw Error('Certificate callback connection is required.');
 const body=JSON.parse(inputData.pdfFailureRequest);
 if(!['pdf_failed','failed'].includes(body.status)||body.deliveryNotSent!==true)throw Error('Invalid PDF failure context.');
 const response=await zapier.fetch('https://europe-west1-vertex-ai-1618.cloudfunctions.net/zapierContributorCallback',{connectionId:connections.certificate_callback,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),maxTimeSeconds:15});
 if(!response.ok)throw Error('PDF failure callback was rejected.');return {reported:true};
}
