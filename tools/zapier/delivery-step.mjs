import {createZapierSdk} from '@zapier/zapier-sdk';
const zapier=createZapierSdk({maxNetworkRetries:0,approvalMode:'disabled'});
const endpoint='https://europe-west1-vertex-ai-1618.cloudfunctions.net/zapierContributorCallback';
const policy={tenacity:{tr:'Dirayet',en:'Tenacity',months:1},constancy:{tr:'Metanet',en:'Constancy',months:3},nobility:{tr:'Azamet',en:'Nobility',months:6},majesty:{tr:'Asalet',en:'Majesty',months:12}};
const legacy={tr:{subject:"__VERTEX_RECIPIENT__, Vertex'e hoş geldin!",html:"<p>Esenlikler <strong>__VERTEX_RECIPIENT__</strong>,</p>\n<p>Vertex'e hoş geldin!</p>\n<p>Aramıza katıldığını söylemekten mutluluk duyarız, ekteki PDF dosyasında Liyakat Sertifikanı bulabilirsin; bu sertifika, Vertex'e özel olarak seçilmiş olduğun bir kanıtıdır.</p>\n<p>Hep beraber, zirveye!</p>\n<p>Saygılarımızla,</p>"},en:{subject:'__VERTEX_RECIPIENT__, welcome to Vertex!',html:'<p>Greetings <strong>__VERTEX_RECIPIENT__</strong>,</p>\n<p>Welcome to Vertex!</p>\n<p>We are delighted to welcome you to our team, you can find your Merit Certificate in the attached PDF file; this certificate stands as a testament to your exclusive selection to Vertex.</p>\n<p>Together, to the peak!</p>\n<p>Best regards,</p>'}};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function callback(body,connections){
 const response=await zapier.fetch(endpoint,{connectionId:connections.certificate_callback,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),maxTimeSeconds:15});
 if(!response.ok)throw Error('Certificate backend rejected the operation.');return response.json();
}
export default async function main({inputData,connections}){
 if(!connections?.certificate_callback||!connections?.certificate_gmail)throw Error('Certificate delivery connections are required.');
 const request=JSON.parse(inputData.validationRequest),event=request.event;
 const tenure=request.action==='validateEvent';
 if(!event||(!tenure&&request.action!=='validateLegacyEvent'))throw Error('Invalid certificate context.');
 if(tenure&&(event.eventKind!=='tenure_certificate_issuance'||event.contractVersion!=='vertex-tenure-v2'||!Object.hasOwn(policy,event.certificateType)))throw Error('Invalid tenure context.');
 if(!tenure&&(['eventKind','certificateJobId','contractVersion'].some(k=>Object.hasOwn(event,k))||(event.certificateType!==undefined&&event.certificateType!=='merit')))throw Error('Invalid legacy context.');
 const correlation=tenure?{certificateJobId:event.certificateJobId,contributorId:event.contributorId,attemptId:event.attemptId}:{issuanceId:event.issuanceId,contributorId:event.contributorId,attemptId:event.attemptId};
 const uncertain=async()=>{try{await callback({action:'markDeliveryUncertain',...correlation},connections);}catch{}};
 const language=event.language==='tr'?'tr':'en',name=tenure?event.recipientName:event.name,email=tenure?event.recipientEmail:event.email;
 if(typeof email!=='string'||!/^([^\s<>@,;"\r\n]+)@([A-Za-z0-9.-]+)\.([A-Za-z]{2,})$/.test(email))throw Error('Invalid certificate recipient.');
 const fileUrl=new URL(inputData.file);if(fileUrl.protocol!=='https:'||fileUrl.hostname!=='zapier-dev-files.s3.amazonaws.com'||fileUrl.username||fileUrl.password)throw Error('Invalid certificate attachment URL.');
 let pdf;
 try{const file=await fetch(fileUrl,{signal:AbortSignal.timeout(15000)});if(!file.ok)throw Error('Attachment unavailable');if(Number(file.headers.get('content-length'))>10485760)throw Error('Attachment too large');pdf=Buffer.from(await file.arrayBuffer());if(pdf.length>10485760||pdf.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid attachment');}catch{throw Error('Certificate attachment could not be loaded. Gmail was not attempted.');}
 let subject,html;
 if(tenure){const p=policy[event.certificateType],title=p[language];subject=language==='tr'?`Vertex ${title} Sertifikanız`:`Your Vertex ${title} Certificate`;html=language==='tr'?`<p>Merhaba ${esc(name)},</p><p>${p.months} aylık katkınız için ${title} sertifikanız ektedir.</p><p><a href="${esc(event.verificationUrl)}">Sertifikayı doğrulayın</a></p><p>Teşekkürler,<br>Vertex</p>`:`<p>Hello ${esc(name)},</p><p>Your ${title} certificate recognizing ${p.months} months of contribution is attached.</p><p><a href="${esc(event.verificationUrl)}">Verify your certificate</a></p><p>Thank you,<br>Vertex</p>`;}
 else{subject=legacy[language].subject.replace('__VERTEX_RECIPIENT__',name);html=legacy[language].html.replace('__VERTEX_RECIPIENT__',esc(name));}
 const b64=value=>Buffer.from(value).toString('base64').match(/.{1,76}/g).join('\r\n');
 const boundary='vertex-'+event.attemptId;
 const mime=['From: mustafa@vertexishere.com','To: '+email,'Subject: =?UTF-8?B?'+Buffer.from(subject.replace(/[\r\n]/g,' ')).toString('base64')+'?=','MIME-Version: 1.0','Content-Type: multipart/mixed; boundary="'+boundary+'"','','--'+boundary,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',b64(html),'--'+boundary,'Content-Type: application/pdf; name="vertex-certificate.pdf"','Content-Disposition: attachment; filename="vertex-certificate.pdf"','Content-Transfer-Encoding: base64','',b64(pdf),'--'+boundary+'--',''].join('\r\n');
 // Verify the OAuth identity rather than relying on the From header alone.
 const profileResponse=await zapier.fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{connectionId:connections.certificate_gmail,method:'GET',maxTimeSeconds:15});
 if(!profileResponse.ok||(await profileResponse.json()).emailAddress!=='mustafa@vertexishere.com')throw Error('Certificate Gmail sender identity could not be verified.');
 let claim;
 try{claim=await callback({action:'claimDelivery',...correlation,event,pdfGenerated:tenure},connections);}catch{await uncertain();return {outcome:'claim_uncertain',gmailAttempted:false};}
 if(claim.proceed!==true)return {outcome:'blocked',gmailAttempted:false};
 // This same Code action is re-entered on every replay. No separate Gmail
 // action or cached Filter result can bypass the fresh permanent claim.
 let receipt,gmailHttpStatus,submissionStage='session';
 try{
  // One claimed upload session. Keep each request below the relay body limit;
  // never restart a session or retry a chunk after an ambiguous response.
  const bytes=Buffer.from(mime),chunkSize=256*1024;
  const start=await zapier.fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=resumable',{connectionId:connections.certificate_gmail,method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'message/rfc822','X-Upload-Content-Length':String(bytes.length)},body:'{}',maxTimeSeconds:20});
  gmailHttpStatus=start.status;if(!start.ok)throw Error('Gmail upload session rejected');
  const session=new URL(start.headers.get('location'));
  if(session.protocol!=='https:'||!['gmail.googleapis.com','www.googleapis.com'].includes(session.hostname)||session.pathname!=='/upload/gmail/v1/users/me/messages/send'||!session.searchParams.get('upload_id')||session.username||session.password||session.hash)throw Error('Invalid Gmail upload session');
  submissionStage='upload';
  for(let offset=0;offset<bytes.length;offset+=chunkSize){
   const end=Math.min(offset+chunkSize,bytes.length)-1;
   const response=await zapier.fetch(session.href,{connectionId:connections.certificate_gmail,method:'PUT',headers:{'Content-Type':'application/octet-stream','Content-Length':String(end-offset+1),'Content-Range':`bytes ${offset}-${end}/${bytes.length}`},body:bytes.subarray(offset,end+1),redirect:'manual',maxTimeSeconds:20});
   gmailHttpStatus=response.status;
   if(end<bytes.length-1){if(response.status!==308||response.headers.get('range')!==`bytes=0-${end}`)throw Error('Gmail upload acknowledgement missing');}
   else{if(!response.ok)throw Error('Gmail submission rejected');receipt=await response.json();if(typeof receipt.id!=='string'||!receipt.id)throw Error('Gmail receipt missing');}
  }
 }catch{await uncertain();return {outcome:'submission_uncertain',gmailAttempted:true,submissionStage,...(gmailHttpStatus?{gmailHttpStatus}:{})};}
 try{await callback({...correlation,...(tenure?{certificateType:event.certificateType}:{}),status:tenure?'gmail_submitted':'success'},connections);}catch{return {outcome:'submitted_callback_pending',gmailAttempted:true,messageId:receipt.id};}
 return {outcome:'submitted',gmailAttempted:true,messageId:receipt.id,gmailHttpStatus,sender:'mustafa@vertexishere.com'};
}
