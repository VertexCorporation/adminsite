const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../js/utils/contributor-state.js'),'utf8').replaceAll('export const','const').replaceAll('export function','function')+';this.active=isActiveContributor;this.state=contributorState;',context);
test('Contributor flag overrides contradictory account membership and needs no Cortex match',()=>{
 assert.equal(context.active({isVertex:true,membership:{status:'unknown',isVertex:false}}),true);
 assert.equal(context.active({isVertex:true}),true);
 assert.equal(context.active({isVertex:false,membership:{status:'matched',isVertex:true}}),false);
 for(const isVertex of [undefined,null,'true',1])assert.equal(context.active({isVertex}),false);
 assert.equal(context.state({isVertex:false}),'inactive');assert.equal(context.state({}),'unknown');
});
test('release disables unpublished membership and roster callables',()=>{
 const caps=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../js/core/deployment-capabilities.js'),'utf8').replace('export const','var'),caps);
 assert.equal(caps.deploymentCapabilities.contributorMembershipWrites,false);assert.equal(caps.deploymentCapabilities.contributorRoster,false);
});
