const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../js/utils/vertex-roster-report.js'),'utf8').replaceAll('export function','function'),context);
const csv=plan=>context.rosterCSV(plan);
test('CSV quotes commas/newlines and neutralizes spreadsheet formulas while retaining normalized phones',()=>{
 const row={phone:'+905321234567',name:'=HYPERLINK("bad")',email:'a,b@example.invalid',emailVerified:true,application:'app',cortexAccount:true,departments:['Chroma'],currentRoles:[],proposedRoles:[],roleReview:'review',joining:{value:'2026-09-08',estimated:true},before:{isVertex:false},after:{isVertex:true},plus:'to-grant',result:'ready',reasons:['test']};
 const value=csv({rows:[row],activeOutside:[]});assert(value.includes('"+905321234567"'));assert(value.includes('"\'=HYPERLINK(""bad"")"'));assert(value.includes('"a,b@example.invalid"'));assert(value.includes('Tahmini: başvuru + 7 gün'));
});
test('outsiders appear with no deactivation suggestion',()=>{assert(csv({rows:[],activeOutside:[{uid:'out',email:'out@example.invalid'}]}).includes('Referans liste dışında; işlem yapılmadı'));});

test('Contributor CSV distinguishes a missing flag from false and includes match provenance',()=>{
 const row={phone:'+905321234567',name:'@formula',email:'private@example.invalid',application:true,contributorId:'application-1',path:'contributors/application-1.isVertex',method:'contributors.phone',department:'Core',before:{fieldExists:false},after:{isVertex:true},result:'successful',reasons:[]};
 const value=context.contributorRosterCSV({rows:[row]});assert(value.includes('Alan eksik'));assert(value.includes('contributors/application-1.isVertex'));assert(value.includes('contributors.phone'));assert(!value.includes('Cortex'));
});
