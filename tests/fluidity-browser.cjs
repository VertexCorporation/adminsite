'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..');
const fixture = `<!doctype html><html><head><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/ui/overlay.css">
<style>.people-table-wrap,.contributor-table-rows{width:240px;height:100px;overflow:auto}#anchor{position:fixed;bottom:140px;left:40px}</style>
</head><body><div id="host"></div><button id="anchor">Menu</button></body></html>`;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(fixture); }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (error, data) => {
    res.statusCode = error ? 404 : 200;
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/css');
    res.end(error ? '' : data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}) });
  try {
    for (const width of [390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 820 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.evaluate(async () => {
        window.fluidity = { ...await import('/js/ui/transition.js'), ...await import('/js/ui/surfaces.js') };
      });
      for (const reducedMotion of ['no-preference', 'reduce']) {
        await page.emulateMedia({ reducedMotion });
        for (const selector of ['people-table-wrap', 'contributor-table-rows']) {
          for (const identical of [true, false]) {
            const result = await page.evaluate(({ selector, identical }) => {
              const host = document.getElementById('host');
              const html = label => `<div class="${selector}"><div style="height:500px;width:800px">${label}</div></div>`;
              host.innerHTML = html('Example data');
              host.firstChild.scrollTop = 180; host.firstChild.scrollLeft = 160;
              fluidity.crossfade(host, () => { host.innerHTML = html(identical ? 'Example data' : 'Updated data'); }, { mode: 'enter' });
              return { top: host.firstChild.scrollTop, left: host.firstChild.scrollLeft, ghosts: host.querySelectorAll('.ui-crossfade-ghost').length };
            }, { selector, identical });
            assert.deepEqual(result, { top: 180, left: 160, ghosts: 0 });
          }
        }
        const rtl = await page.evaluate(() => {
          const host = document.getElementById('host');
          const html = '<div class="people-table-wrap" dir="rtl"><div style="width:800px;height:500px">Example</div></div>';
          host.innerHTML = html; host.firstChild.scrollLeft = -120;
          fluidity.crossfade(host, () => { host.innerHTML = html; }, { mode: 'enter' });
          return host.firstChild.scrollLeft;
        });
        assert.equal(rtl, -120);
      }
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(() => {
        fluidity.openPopover(document.getElementById('anchor'), { render(el) { el.innerHTML = '<div id="menu-content" style="height:24px;width:230px">Example menu</div>'; } });
      });
      await page.locator('.vx-popover.is-open').waitFor();
      await page.evaluate(() => { document.getElementById('menu-content').style.height = '360px'; });
      await page.waitForFunction(() => {
        const rect = document.querySelector('.vx-popover').getBoundingClientRect();
        return rect.top >= 7 && rect.bottom <= innerHeight - 7 && rect.left >= 7 && rect.right <= innerWidth - 7;
      });
      await page.keyboard.press('Escape');
      await page.locator('.vx-popover').waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => document.activeElement.id), 'anchor');
      assert.deepEqual(errors, []);
      console.log('PASS ' + width + 'px: refresh scroll, identical content, RTL, reduced motion, dynamic menu and focus return');
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
