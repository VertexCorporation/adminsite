export default async function main({inputData}) {
 const raw=inputData.originalJson;
 if(typeof raw!=='string'||!raw.trim()||raw.length>500000)throw Error('Original event JSON is required.');
 let event;try{event=JSON.parse(raw);}catch{throw Error('Invalid original event JSON.');}
 if(!event||typeof event!=='object'||Array.isArray(event))throw Error('Invalid event object.');
 // Map Catch Hook's complete Step Output. Zapier serializes that object to
 // JSON at runtime; the transport carrier retains the original signed fields.
 if(Object.hasOwn(event,'eventJson')){
  const carrier=event.eventJson;
  if(typeof carrier==='string'){
   if(!carrier.trim()||carrier.length>500000)throw Error('Original event carrier is invalid.');
   try{event=JSON.parse(carrier);}catch{throw Error('Invalid original event carrier JSON.');}
  }else event=carrier; // Catch Hook also decodes JSON strings to objects.
  if(!event||typeof event!=='object'||Array.isArray(event)||Object.hasOwn(event,'eventJson'))throw Error('Invalid original event carrier object.');
 }
 const owns=key=>Object.prototype.hasOwnProperty.call(event,key);
 const tenure=['eventKind','certificateJobId','contractVersion'].some(owns);
 const policy={tenacity:{tr:'Dirayet',en:'Tenacity',asset:'dirayet',months:1},constancy:{tr:'Metanet',en:'Constancy',asset:'metanet',months:3},nobility:{tr:'Azamet',en:'Nobility',asset:'azamet',months:6},majesty:{tr:'Asalet',en:'Majesty',asset:'asalet',months:12}};
 const required=key=>{if(typeof event[key]!=='string'||!event[key].trim())throw Error('Missing required event field.');return event[key];};
 let type,name,email,language,correlation;
 for(const key of ['contributorId','attemptId','formattedDate','verificationUrl','backgroundUrl'])required(key);
 if(tenure){
  if(event.eventKind!=='tenure_certificate_issuance'||event.contractVersion!=='vertex-tenure-v2'||!Object.hasOwn(policy,event.certificateType))throw Error('Unsupported tenure contract.');
  for(const key of ['recipientName','recipientEmail','language','issuedAt','verificationId','certificateJobId','eventSignature'])required(key);
  if(!['tr','en'].includes(event.language)||!/^[a-f0-9]{64}$/.test(event.eventSignature))throw Error('Invalid tenure fields.');
  type=event.certificateType;name=event.recipientName;email=event.recipientEmail;language=event.language;
  if(event.certificateJobId!==event.contributorId+'--'+type||event.verificationId!==event.certificateJobId)throw Error('Invalid tenure identifiers.');
  correlation={certificateJobId:event.certificateJobId,contributorId:event.contributorId,attemptId:event.attemptId};
 }else{
  if(owns('certificateType')&&event.certificateType!=='merit')throw Error('Invalid legacy type.');
  type='merit';name=required('name');email=required('email');required('language');required('issuanceId');required('id');
  if(event.id!==event.contributorId||event.issuanceId!==event.contributorId)throw Error('Invalid legacy identifiers.');
  language=event.language==='tr'?'tr':'en';correlation={issuanceId:event.issuanceId,contributorId:event.contributorId,attemptId:event.attemptId};
 }
 const id=tenure?event.certificateJobId:event.contributorId;
 const asset=type==='merit'?(language==='tr'?'liyakat':'merit'):(language==='tr'?policy[type].asset:type);
 if(event.verificationUrl!=='https://vertexishere.com/verify/'+id||event.backgroundUrl!=='https://vertexishere.com/assets/certificates/'+asset+'.webp')throw Error('Invalid certificate resources.');
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const result={mode:tenure?'tenure':'legacy',language,certificateType:type,recipientName:name,recipientEmail:email,
  validationRequest:JSON.stringify({action:tenure?'validateEvent':'validateLegacyEvent',event}),
  claimRequest:JSON.stringify({action:'claimDelivery',...correlation}),
  pdfGeneratedRequest:tenure?JSON.stringify({...correlation,status:'pdf_generated'}):'',
  pdfFailureRequest:JSON.stringify({...correlation,status:tenure?'pdf_failed':'failed',deliveryNotSent:true}),
  successRequest:JSON.stringify({...correlation,...(tenure?{certificateType:type}:{}),status:tenure?'gmail_submitted':'success'}),
  uncertainRequest:tenure?JSON.stringify({...correlation,status:'uncertain'}):'',
  foreground:type==='majesty'?'#ffffff':'#111111',qrBorder:type==='majesty'?'#ffffff':'#111111',backgroundUrl:event.backgroundUrl,nameHtml:esc(name),dateHtml:esc(event.formattedDate),verificationUrl:event.verificationUrl,
  qrUrl:'https://quickchart.io/qr?size=144&text='+encodeURIComponent(event.verificationUrl),emailSubject:'',emailHtml:''};
 if(tenure){
  const award=policy[type][language],months=policy[type].months,url=esc(event.verificationUrl);
  result.emailSubject=language==='tr'?'Vertex '+award+' Sertifikanız':'Your Vertex '+award+' Certificate';
  result.emailHtml=language==='tr'?'<p>Merhaba '+esc(name)+',</p><p>'+months+' aylık katkınız için '+award+' sertifikanız ektedir.</p><p><a href="'+url+'">Sertifikayı doğrulayın</a></p><p>Teşekkürler,<br>Vertex</p>':'<p>Hello '+esc(name)+',</p><p>Your '+award+' certificate recognizing '+months+' months of contribution is attached.</p><p><a href="'+url+'">Verify your certificate</a></p><p>Thank you,<br>Vertex</p>';
 }
 result.pdfHtml='<!DOCTYPE html><html lang="'+language+'"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@700&display=block"><style>@page{size:2000px 1414px;margin:0}html,body{margin:0;padding:0;width:2000px;height:1414px;font-family:Ubuntu,Arial,sans-serif;background:#fff}.certificate-container{width:100%;height:100%;background-image:url("'+result.backgroundUrl+'");background-size:100% 100%;background-position:center;background-repeat:no-repeat;position:relative}.name-box{position:absolute;top:43%;left:50%;transform:translate(-50%,-50%);width:80%;text-align:center}.name-text{color:'+result.foreground+';font-size:64pt;font-weight:700;letter-spacing:2px;white-space:nowrap}.date-box{position:absolute;bottom:356px;left:562px;transform:translateX(-50%);text-align:center}.date-text{color:'+result.foreground+';font-size:32pt;font-weight:700}.qr-box{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);width:144px;height:144px;background:#fff;padding:10px;border-radius:8px;border:2px solid '+result.qrBorder+'}.qr-box img{width:100%;height:100%;object-fit:contain}</style></head><body><div class="certificate-container"><div class="name-box"><div class="name-text">'+result.nameHtml+'</div></div><div class="date-box"><div class="date-text">'+result.dateHtml+'</div></div><div class="qr-box"><img src="'+esc(result.qrUrl)+'" alt="Verification QR Code"></div></div></body></html>';
 return result;
}
