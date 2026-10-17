const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'../js/utils/email-template-links.js'),'utf8');
const normalize=new Function(text.replace(/^export /gm,'')+';return normalizeVerificationLinks;')();
test('browser base URL is replaced only for exact verification placeholder',()=>{
 const forms=[
  'https://admin.vertexishere.com/%7B%7BverificationUrl%7D%7D',
  '/%7B%7BverificationUrl%7D%7D',
  '%7B%7BverificationUrl%7D%7D',
  'https://admin.vertexishere.com/{{verificationUrl}}',
 ];
 for(const url of forms){
    assert.equal(normalize('<p><a href="'+url+'">Metanet Sertifikanı</a></p>'),
      '<p><a href="{{verificationUrl}}">Metanet Sertifikanı</a></p>');
 }
});
test('never rewrite any other link and preserve surrounding content',()=>{
 for(const link of ['https://example.com/%7B%7BverificationUrl%7D%7D','https://admin.vertexishere.com/something-else','http://evil.example/']){
   const html='<div><a href="'+link+'">Different</a></div>';
   assert.equal(normalize(html),html);
 }
});
