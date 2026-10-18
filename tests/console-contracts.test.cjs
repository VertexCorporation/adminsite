'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8');
test('one adaptive panel grid contract scales beyond four panels',()=>{
 const views=src('js/modules/views.js'),styles=src('css/layout.css');
 assert.match(views,/Math\.floor\(\(width \+ 16\) \/ 316\)/);
 assert.match(views,/grid\.dataset\.visiblePanels/);
 assert.match(styles,/repeat\(var\(--panel-columns, 1\), minmax\(0, 1fr\)\)/);
});
test('permission columns come from real module count rather than six hardcoded columns',()=>{
 assert.match(src('js/modules/roles.js'),/--permission-module-count:\$\{TABS\.length\}/);
 assert.match(src('css/modules.css'),/repeat\(var\(--permission-module-count, 7\)/);
});
test('honor board frontend calls matching managed API contract',()=>{
 const team=src('js/modules/siteTeam.js');
 assert.match(team,/listSiteTeamFn\(\{manage:true\}\)/);
 assert.match(team,/result\.data\.honors/);
 assert.doesNotMatch(team,/kind: 'mod'/);
});
test('certificate drawers have bounded retry and invalid template payload exits skeleton',()=>{
 const tr=src('js/modules/certificateEmailTemplates.js');
 assert.match(tr,/loadGeneration/);
 assert.match(tr,/data\.templates\.length!==10/);
 assert.match(tr,/loader\.error\(templateErrorMessage\(error\),load/);
 assert.match(src('js/modules/certificates.js'),/loader\.error\(userErrorMessage\(error\),load/);
 const client=src('js/core/firebase.js');
 assert.match(client,/getVertexCertificateEmailTemplates/);
 assert.match(client,/18000/);
});
test('backup cannot claim healthy from configured flag alone',()=>{
 const adm=src('js/modules/admin.js');
 assert.match(adm,/data\.healthy===true/);
 assert.match(adm,/data\.lastBackupDate/);
 assert.match(adm,/system\.backup_restore_unknown/);
});
