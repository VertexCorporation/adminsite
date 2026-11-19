'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..'), dist = path.join(root, 'dist');
const fixture = fs.readFileSync(path.join(__dirname, 'browser.cjs'), 'utf8')
  .split('await page.addInitScript(()=>{')[1].split('\n});')[0]
  .replace(" localStorage.setItem('siteLang','en');", '')
  .replace('setTimeout(()=>fn(user),10)', 'setTimeout(()=>fn(auth.currentUser),10)');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(dist + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (error, bytes) => {
    res.statusCode = error ? 404 : 200;
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    res.end(error ? '' : bytes);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}) });
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    for (const mode of ['email', 'google', 'apple', 'returning', 'signed-out-returning', 'hint-only', 'startup-error']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage(), errors = [], sdk = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.url().includes('www.gstatic.com/firebasejs/')) sdk.push(request.url()); });
      await page.addInitScript(({ fixture, mode }) => {
        eval(fixture);
        if (window !== window.top) return;
        const auth = firebase.auth();
        if (mode !== 'returning') auth.currentUser = null;
        else localStorage.setItem('siteLang', 'en');
        if (mode === 'signed-out-returning') {
          localStorage.setItem('vertexConsoleSession', 'signed-out');
          localStorage.setItem('siteLang', 'en');
        }
        if (mode === 'hint-only') localStorage.setItem('vertexConsoleSession', 'active');
        window.landingTest = { logins: 0, activations: 0 };
        const signIn = auth.signInWithEmailAndPassword.bind(auth);
        auth.signInWithEmailAndPassword = async (...args) => { landingTest.logins++; return signIn(...args); };
        auth.signInWithPopup = async () => { landingTest.logins++; return signIn('example@example.invalid', 'example'); };
        firebase.auth.GoogleAuthProvider = class {};
        firebase.auth.OAuthProvider = class { addScope() {} };
        firebase.appCheck = () => ({ activate() { landingTest.activations++; }, getToken: async () => ({ token: 'fixture' }) });
      }, { fixture, mode });
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === base) {
          if (mode === 'startup-error' && url.pathname === '/') {
            // Release markup is embedded: corrupt one inert template to exercise
            // the same atomic bootstrap boundary before credentials are replayed.
            const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
              .replace('<template data-fragment="panels/models" data-embedded-fragment="true">', '$&<script>unexpected()</script>');
            return route.fulfill({ contentType: 'text/html', body: html });
          }
          return route.continue();
        }
        if (url.hostname === 'www.gstatic.com') return route.fulfill({ contentType: 'text/javascript', body: '' });
        return route.fulfill({ contentType: url.hostname === 'fonts.googleapis.com' ? 'text/css' : 'application/json', body: url.hostname === 'fonts.googleapis.com' ? '' : '{"result":{}}' });
      });
      await page.goto(base);
      await page.waitForFunction(() => document.documentElement.dataset.loginReady === 'true');
      if (mode === 'hint-only') {
        await page.locator('#app-loader').waitFor({ state: 'detached' });
        assert(sdk.length > 0);
        assert(await page.locator('#login-container').isVisible());
        assert.equal(await page.locator('#admin-panel').isVisible(), false, 'prefetch hints never grant access');
        assert.equal(await page.evaluate(() => landingTest.activations), 0);
        assert.deepEqual(errors, []);
        await context.close();
        console.log('PASS client prefetch hint grants no access');
        continue;
      }
      if (mode !== 'returning') {
        await page.locator('#app-loader').waitFor({ state: 'detached' });
        await page.waitForTimeout(500);
        assert.equal(sdk.length, 0, 'idle signed-out visit must not load private console SDKs');
        assert.equal(await page.evaluate(() => landingTest.activations), 0);
        assert(await page.locator('#login-container').isVisible());
        if (mode === 'email' || mode === 'signed-out-returning' || mode === 'startup-error') {
          await page.locator('#email').fill('example@example.invalid');
          await page.locator('#password').fill('example');
          await page.locator('#login-form').evaluate(form => form.requestSubmit());
        } else await page.locator('#' + mode + '-login-btn').click();
      }
      if (mode === 'startup-error') {
        await page.locator('[data-startup-retry]').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => landingTest.logins), 0);
        assert.equal(await page.locator('#admin-panel').isVisible(), false);
        assert.deepEqual(errors, []);
        await context.close();
        console.log('PASS failed warmup exposes retry and never submits credentials');
        continue;
      }
      await page.waitForFunction(() => document.getElementById('admin-panel').style.display === 'grid');
      assert(sdk.length > 0);
      assert.equal(await page.evaluate(() => landingTest.logins), mode === 'returning' ? 0 : 1);
      assert.equal(await page.evaluate(() => landingTest.activations), 1);
      assert.deepEqual(errors, []);
      console.log('PASS lightweight landing, protected startup and single sign-in:', mode);
      await context.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
