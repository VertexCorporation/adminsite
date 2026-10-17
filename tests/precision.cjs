const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async function precisionQA({page, selectTab, note, payloads, calls, failPermissions}) {
  const screenshots = process.env.VERTEX_SCREENSHOTS;
  const capture = async name => {
    if (!screenshots) return;
    await page.waitForTimeout(260);
    await page.screenshot({path:path.join(screenshots,`precision-${name}.png`),fullPage:!name.startsWith('sidebar-')});
  };
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(async()=>{(await import('/js/modules/shell.js')).applyTheme('dark');});
  await selectTab('system');
  await page.locator('[data-section=permissions]').dispatchEvent('click');
  await page.waitForSelector('.dept-perm-row');
  assert.equal(await page.locator('.dept-perm-row').count(),10);
  const alignments = await page.evaluate(()=>{
    const head=[...document.querySelector('.dept-perms-header').children].slice(0,7);
    const row=[...document.querySelector('.dept-perm-row').children].slice(0,7);
    return head.map((cell,index)=>Math.abs(cell.getBoundingClientRect().x-row[index].getBoundingClientRect().x));
  });
  assert(alignments.every(offset=>offset<1),JSON.stringify(alignments));
  assert.equal(await page.locator('.perm-preset-btn').count(),0);
  assert.equal(await page.locator('.permission-panel-selector').count(),0);
  assert.equal(await page.locator('[data-permission-panel]').count(),25);
  assert(await page.locator('.perm-cycle').first().innerText().then(text=>text.includes('Edit')));
  await capture('permissions-1440-dark');
  const core=page.locator('[data-dept=Core][data-tab=contributors]');
  await core.click();
  assert.equal(await page.locator('#permission-save-status').innerText(),'Unsaved changes');
  await page.waitForFunction(()=>document.querySelector('#permission-save-status')?.dataset.state==='saved');
  assert.equal(payloads.filter(item=>item.name==='savedepartmentpermissions').at(-1).data.departments.Core.panels['contributors.*'],undefined);
  await core.click();await page.waitForFunction(()=>document.querySelector('#permission-save-status')?.dataset.state==='saved');
  assert.equal(payloads.filter(item=>item.name==='savedepartmentpermissions').at(-1).data.departments.Core.panels['contributors.*'],'read');
  const before=await core.getAttribute('data-level');
  failPermissions(true);await core.click();
  await page.waitForFunction(()=>document.querySelector('#permission-save-status')?.dataset.state==='failed');
  assert.equal(await core.getAttribute('data-level'),before);
  failPermissions(false);
  note('Permission grid alignment, readable levels, acknowledged save and failed draft rollback');
  await page.locator('[data-permission-panel="contributors.list"]').click();
  const hidden=page.locator('input[data-cfg=hiddenFields][data-tag=contact]');
  await hidden.check();
  await page.waitForFunction(()=>document.querySelector('#permission-save-status')?.dataset.state==='saved');
  const policy=payloads.filter(item=>item.name==='savedepartmentpermissions').at(-1).data.departments;
  assert.deepEqual(policy.Senatus.hiddenFields['contributors.list'],['contact']);
  assert.equal(policy.Senatus.panels['contributors.*'],'read');
  await page.locator('[data-menu-dept=Senatus]').click();
  await page.waitForFunction(()=>document.querySelector('#permission-save-status')?.dataset.state==='saved');
  assert.equal(payloads.filter(item=>item.name==='savedepartmentpermissions').at(-1).data.departments.Senatus.panels['contributors.list'],'write');
  await page.locator('[data-menu-reset=Senatus]').click();
  await page.waitForFunction(()=>document.querySelector('#permission-save-status')?.dataset.state==='saved');
  assert.equal(payloads.filter(item=>item.name==='savedepartmentpermissions').at(-1).data.departments.Senatus.panels['contributors.list'],undefined);
  await page.locator('[data-preset-dept=Core]').click();
  await page.locator('.vx-popover [data-preset=write]').click();
  await page.waitForFunction(()=>document.querySelector('#permission-save-status')?.dataset.state==='saved');
  assert.equal(Object.values(payloads.filter(item=>item.name==='savedepartmentpermissions').at(-1).data.departments.Core.panels).filter(level=>level==='write').length,7);
  note('Panel overrides, inherited reset, hidden fields and contextual bulk permission presets');
  for(const key of ['permissions','departments','administrators','verification','server','exports_attributions']) {
    await page.locator(`[data-i18n="subnav.${key}"]`).click();
    const active=key==='exports_attributions'?'export':key;
    assert.equal(await page.locator(`[data-section="${active}"]`).getAttribute('aria-pressed'),'true');
  }
  await selectTab('contributors');
  // Clicking an already active parent intentionally toggles its submenu.
  if(await page.locator('[data-nav-module=contributors] .dock-btn').getAttribute('aria-expanded')!=='true')await page.locator('[data-target=tab-contributors]').click();
  await page.locator('[data-i18n="subnav.vertex_status"]').click();
  assert(await page.locator('#vertex-status-manager').isVisible());
  await page.locator('[data-nav-action=certificates]').click();
  await page.waitForSelector('#certificate-person-search');assert.equal(await page.locator('[data-award]').count(),0);await page.locator('[data-person=person]').click();await page.waitForSelector('.certificate-drawer.is-open');await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.waitForSelector('.vx-drawer',{state:'detached'});await page.locator('[data-i18n="subnav.applicants"]').click();
  await selectTab('models');await page.locator('[data-nav-action=model-editor]').click();await page.locator('[data-model-create]').click();
  await page.waitForSelector('.vx-drawer.is-open #model-form');await page.keyboard.press('Escape');await page.waitForSelector('.vx-drawer',{state:'detached'});
  await selectTab('news');await page.locator('[data-i18n="subnav.editor"]').click();assert(await page.locator('#news-creator').isVisible());
  note('Grouped sidebar routes reach actual certificate, status, model editor, news and System functions');
  await page.locator('#lang-toggle-btn').click();
  assert.equal(await page.locator('.language-popover.is-open [data-language=en]').getAttribute('aria-checked'),'true');
  await capture('language-1440-dark');
  await page.locator('.language-popover.is-open [data-language=tr]').click();assert.equal(await page.locator('.file-select-btn').first().innerText(),'Dosya seç');assert.equal(await page.locator('#lang-indicator').innerText(),'Türkçe');
  await page.locator('#lang-toggle-btn').click();await page.locator('.language-popover.is-open [data-language=en]').click();
  await page.locator('#theme-menu-btn').click();await capture('theme-1440-dark');
  await page.locator('[data-theme-mode=light]').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  await page.locator('#user-menu-trigger').click();await capture('account-1440-light');
  await page.locator('.account-popover.is-open [data-account=profile]').click();assert(await page.locator('#tab-profile').isVisible());
  note('Language, theme and account shared popovers with real navigation and selected states');
  await selectTab('subscriptions');await page.locator('[data-nav-panel="subscriptions.list"]').click();
  const removes=()=>calls.filter(name=>name==='removeusersubscription').length;
  const count=removes();
  await page.locator('#subscriptions-list .cancel-task-btn').first().click();
  await page.waitForSelector('.confirm-ok');
  assert((await page.locator('.vx-modal-body').innerText()).length>10);
  assert.equal(removes(),count);await page.locator('.confirm-cancel').click();assert.equal(removes(),count);
  note('Subscription removal requires readable confirmation and cancellation never mutates');
  // Ensure no stale drawer/modal/scrim is open before the responsive loop
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.vx-drawer'  ,{state:'detached'}).catch(()=>{});
  await page.waitForSelector('.vx-modal'   ,{state:'detached'}).catch(()=>{});
  await page.waitForSelector('.vx-popover.is-open',{state:'detached'}).catch(()=>{});
  for(const config of [{width:1440,theme:'dark'},{width:1920,theme:'dark'},{width:1440,theme:'light'},{width:768,theme:'dark'},{width:390,theme:'dark'},{width:360,theme:'dark'}]) {
    await page.setViewportSize({width:config.width,height:1000});
    await page.evaluate(async mode=>(await import('/js/modules/shell.js')).applyTheme(mode),config.theme);
    for(const id of ['contributors','subscriptions','notifications','system']) {
      await selectTab(id);
      if(id==='system')await page.locator('[data-section=permissions]').dispatchEvent('click');
      await capture(`${id}-${config.width}-${config.theme}`);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    await page.locator('#lang-toggle-btn').click();
    const bounds=await page.locator('.language-popover.is-open').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=config.width+1);
    await capture(`language-${config.width}-${config.theme}`);await page.keyboard.press('Escape');
    if(config.width<1024) {
      await page.locator('[data-mobile-more]').click();
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('.mobile-more-sheet')).opacity==='1');
      assert(await page.locator('.mobile-more-sheet').isVisible());
      await capture(`more-${config.width}-${config.theme}`);
      await page.keyboard.press('Escape');
      await page.waitForSelector('.mobile-more-sheet',{state:'detached'});
    }
  }
  assert.equal(await page.locator('.icon-missing').count(),0);
  await page.setViewportSize({width:1440,height:900});
  note('Precision visual QA: six target configurations, permission workspace, menus and mobile drawer');
};
