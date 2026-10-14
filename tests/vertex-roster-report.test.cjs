const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../js/utils/vertex-roster-report.js'),'utf8').replace('export function','function'),context);
const csv=plan=>context.rosterCSV(plan);
test('CSV quotes commas/newlines and neutralizes spreadsheet formulas while retaining normalized phones',()=>{
 const row={phone:'+905321234567',name:'=HYPERLINK("bad")',email:'a,b@example.invalid',emailVerified:true,application:'app',cortexAccount:true,departments:['Chroma'],currentRoles:[],proposedRoles:[],roleReview:'review',joining:{value:'2026-09-08',estimated:true},before:{isVertex:false},after:{isVertex:true},plus:'to-grant',result:'ready',reasons:['test']};
 const value=csv({rows:[row],activeOutside:[]});assert(value.includes('"+905321234567"'));assert(value.includes('"\'=HYPERLINK(""bad"")"'));assert(value.includes('"a,b@example.invalid"'));assert(value.includes('Tahmini: başvuru + 7 gün'));
});
test('outsiders appear with no deactivation suggestion',()=>{assert(csv({rows:[],activeOutside:[{uid:'out',email:'out@example.invalid'}]}).includes('Referans liste dışında; işlem yapılmadı'));});
