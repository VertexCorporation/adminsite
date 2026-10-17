const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {TYPES,background}=require('../../Fulcrum/functions/src/certificatePolicy');
const expected=[['tenacity','Dirayet','Tenacity',1,'dirayet'],['constancy','Metanet','Constancy',3,'metanet'],['nobility','Azamet','Nobility',6,'azamet'],['majesty','Asalet','Majesty',12,'asalet']];
test('backend, admin labels/order/durations and verifier use the same owner recognition levels',()=>{
 const admin=fs.readFileSync(path.resolve(__dirname,'../js/modules/certificates.js'),'utf8');
 const awards=vm.runInNewContext(admin.match(/const awards = (\[[^;]+\]);/)[1]);
 const verify=fs.readFileSync(path.resolve(__dirname,'../../vertexite/verify.html'),'utf8');
 const names=vm.runInNewContext('('+verify.match(/const types = (\{[^;]+\});/)[1]+')');
 assert.equal(awards.length,4);
 expected.forEach(([type,tr,en,months,asset],index)=>{
  assert.equal(awards[index].type,type);assert.equal(awards[index].tr,tr);assert.equal(awards[index].en,en);assert.equal(awards[index].months,months);
  assert.equal(TYPES[type].tr,tr);assert.equal(TYPES[type].en,en);assert.equal(TYPES[type].months,months);
  assert.equal(names[type][0],en);assert.equal(names[type][1],tr);
  assert.equal(background(type,'tr'),`https://vertexishere.com/assets/certificates/${asset}.webp`);
 });
});
test('tenure email subjects and bodies preserve owner names/durations in both languages',()=>{
 const {tenureEmail}=require('./fixtures/certificate-email-templates.cjs');
 for(const [type,tr,en,months] of expected)for(const language of ['tr','en']){
  const mail=tenureEmail({eventKind:'tenure_certificate_issuance',contractVersion:'vertex-tenure-v2',certificateType:type,language,recipientName:'Deniz <Örnek>',certificateJobId:`qa--${type}`,verificationUrl:`https://vertexishere.com/verify/qa--${type}`});
  assert(mail.subject.includes(language==='tr'?tr:en));assert(mail.html.includes(language==='tr'?`${months} aylık`:`${months} months`));assert(mail.html.includes('&lt;Örnek&gt;'));assert(!mail.html.includes('<Örnek>'));
 }
 assert.throws(()=>tenureEmail({eventKind:'tenure_certificate_issuance',contractVersion:'vertex-tenure-v1',certificateType:'majesty'}));
 assert.throws(()=>tenureEmail({certificateType:'merit'})); // Legacy welcome template is left intact.
});
