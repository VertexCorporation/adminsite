// Proposed tenure email templates for the unpublished Zap draft; never sends mail.
const {TYPES}=require('../../../Fulcrum/functions/src/certificatePolicy');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function tenureEmail(event){
 if(event.eventKind!=='tenure_certificate_issuance'||event.contractVersion!=='vertex-tenure-v2'||!TYPES[event.certificateType]?.months||!['tr','en'].includes(event.language))throw Error('Not a current tenure event.');
 if(event.verificationUrl!==`https://vertexishere.com/verify/${event.certificateJobId}`)throw Error('Invalid verification URL.');
 const award=TYPES[event.certificateType],title=award[event.language],name=escape(event.recipientName),url=escape(event.verificationUrl);
 return event.language==='tr'?{
  subject:`Vertex ${title} Sertifikanız`,
  html:`<p>Merhaba ${name},</p><p>${award.months} aylık katkınız için ${title} sertifikanız ektedir.</p><p><a href="${url}">Sertifikayı doğrulayın</a></p><p>Teşekkürler,<br>Vertex</p>`,
 }:{
  subject:`Your Vertex ${title} Certificate`,
  html:`<p>Hello ${name},</p><p>Your ${title} certificate recognizing ${award.months} months of contribution is attached.</p><p><a href="${url}">Verify your certificate</a></p><p>Thank you,<br>Vertex</p>`,
 };
}
module.exports={tenureEmail};
