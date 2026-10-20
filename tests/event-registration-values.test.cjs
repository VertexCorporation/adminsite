const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/utils/event-registration-values.js','utf8').replaceAll('export function','function');
const api=vm.runInNewContext(source+';({registrationValue,registrationCSVCell})',{Date,Intl});
test('event registration timestamps accept SDK, callable JSON and ISO forms consistently',()=>{
 const at=Date.parse('2026-10-20T08:00:00Z');
 const values=[{_seconds:at/1000},{seconds:at/1000},{toMillis:()=>at},new Date(at).toISOString(),at];
 for(const createdAt of values)assert.match(api.registrationValue({createdAt},'createdAt','tr'),/11:00/);
 assert.equal(api.registrationValue({createdAt:{}},'createdAt'),'—');
});
test('CSV escapes quotes, delimiters and formulas after whitespace or control prefixes',()=>{
 assert.equal(api.registrationCSVCell('a,"b"'),'"a,""b"""');
 for(const value of ['=1+1','  =1+1','\t@SUM(1)','\r-2','+cmd','-cmd'])assert(api.registrationCSVCell(value).startsWith('"\''));
 assert.equal(api.registrationCSVCell('guest@example.invalid'),'"guest@example.invalid"');
});
