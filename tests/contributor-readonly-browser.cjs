// Reuse the existing fully mocked admin browser harness, with real rollout flags.
const fs=require('node:fs');
let harness=fs.readFileSync(require.resolve('./browser.cjs'),'utf8').split("await page.goto(`http://127.0.0.1:${server.address().port}`")[0];
harness=harness.replace("  if(url.pathname.endsWith('/js/core/deployment-capabilities.js'))return route.fulfill({contentType:'text/javascript',body:'export const deploymentCapabilities={contributorMembershipWrites:true,contributorRoster:true};'});\n",'');
const scenario=String.raw`
people=Array.from({length:52},(_,i)=>({...person,id:'active'+i,name:'Active '+i,isVertex:true,membership:{status:'unknown',isVertex:false}}));
people.push({...person,id:'inactive',isVertex:false,membership:{status:'matched',isVertex:true}});
people.push({...person,id:'missing',isVertex:undefined,membership:{status:'matched',isVertex:true}});
await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
const child=page.locator('[data-nav-panel="contributors.list"][data-nav-action=""]');
const main=child.locator('xpath=ancestor::div[contains(@class,"nav-module")]').locator('.dock-btn');
if(await main.getAttribute('aria-expanded')==='false')await main.click();await child.click();
await page.waitForSelector('[data-contributor-id="active0"]');
assert.equal(await page.locator('.contributor-row').count(),54);
assert(await page.locator('#vertex-roster-launch').isHidden());
await page.evaluate(()=>window.filterContributors('vertex'));
assert.equal(await page.locator('.contributor-row').count(),52);
assert.equal(await page.locator('.vertex-membership-btn.is-active[aria-pressed="true"]').count(),52);
for(const width of [360,1440])for(const theme of ['light','dark']){
 await page.setViewportSize({width,height:900});await page.evaluate(async mode=>(await import('/js/modules/shell.js')).applyTheme(mode),theme);
 await page.evaluate(()=>window.filterContributors('all'));
 assert.equal(await page.locator('[data-contributor-id="active0"] .vertex-membership-btn img').evaluate(e=>getComputedStyle(e).opacity),'1');
 assert.equal(await page.locator('[data-contributor-id="active0"] .vertex-membership-btn').evaluate(e=>getComputedStyle(e).opacity),'1');
 assert(Number(await page.locator('[data-contributor-id="inactive"] .vertex-membership-btn img').evaluate(e=>getComputedStyle(e).opacity))<0.5);
 assert(await page.locator('[data-contributor-id="active0"] .vertex-membership-btn').isDisabled());
 assert((await page.locator('[data-contributor-id="active0"] .vertex-membership-btn').getAttribute('title')).includes('server update'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('[data-contributor-id="inactive"] .vertex-membership-btn').dispatchEvent('click');
}
assert(!calls.some(name=>['setcontributorvertexstatus','togglevertexstatus','setvertexmembership','previewcontributorroster','applycontributorroster'].includes(name)));
assert.deepEqual(errors,[]);await browser.close();server.close();console.log('PASS production rollout: 52 root flags displayed, false dim, unknown distinct, real disabled capabilities, no membership/account writes, light/dark/mobile');
})().catch(e=>{console.error(e);server.close();process.exit(1);});`;
new Function('require','__dirname',harness+scenario)(require,__dirname);
