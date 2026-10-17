// Candidate core for ONE delivery action, not two separate Zap steps.
// Not connected to a live Gmail/SDK adapter. The send adapter MUST make one
// request with no internal replay/retry. That platform property is a release
// gate; these mock tests do not establish it for the real Zapier SDK.
async function claimAndSubmit({claim,send,acknowledge,markUncertain}){
 let permission;
 try{permission=await claim();}catch{return {outcome:'claim_uncertain',sent:false};}
 if(permission?.proceed!==true)return {outcome:'blocked',sent:false};
 let receipt;
 try{receipt=await send();}catch{
  try{await markUncertain();}catch{/* hold for reconciliation; never resend */}
  return {outcome:'submission_uncertain',sent:'unknown'};
 }
 if(typeof receipt?.id!=='string'||!receipt.id){
  try{await markUncertain();}catch{}
  return {outcome:'submission_uncertain',sent:'unknown'};
 }
 try{await acknowledge(receipt);}catch{return {outcome:'submitted_callback_pending',sent:true};}
 return {outcome:'submitted',sent:true};
}
module.exports={claimAndSubmit};
