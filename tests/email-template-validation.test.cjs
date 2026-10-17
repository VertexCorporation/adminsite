const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'../js/utils/email-template-validation.js'),'utf8');
const validate=new Function(text.replace(/^export /gm,'')+';return emailTemplateValidationReason;')();
const base={subject:'Merhaba {{recipientName}}',html:'<p>Merhaba {{recipientName}}!</p><p><a href="{{verificationUrl}}">Doğrula</a></p>'};
test('default template and common contenteditable HTML do not produce 400 preflight',()=>{
 assert.equal(validate(base),null);
 assert.equal(validate({...base,html:'<div>Merhaba&nbsp;{{recipientName}}</div><div><br></div>'}),null);
 assert.equal(validate({...base,html:"<a href=\'https://vertexishere.com\'>Link</a>"}),null);
});
test('insecure links are caught locally instead of hitting the callable',()=>{
 for(const html of ['<a href="http://vertexishere.com">bad</a>','<a href="javascript:alert(1)">bad</a>','<a href="//vertexishere.com">bad</a>'])
   assert.equal(validate({...base,html}),'link');
});
test('unsafe HTML and attributes show a format-specific error',()=>{
 for(const html of ['<img src="https://x.invalid/pixel">','<script>alert(1)</script>','<p style="color:red">Text</p>'])
   assert.equal(validate({...base,html}),'format');
});
test('invalid placeholders, subjects and empty bodies are detected before network calls',()=>{
 assert.equal(validate({...base,subject:'A\nB'}),'subject');
 assert.equal(validate({...base,html:'<p>{{unknown}}</p>'}),'placeholder');
 assert.equal(validate({...base,html:''}),'body');
});
