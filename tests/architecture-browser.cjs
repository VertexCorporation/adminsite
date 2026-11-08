'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {architectureFixture} = require('./helpers/architecture-fixture.cjs');
const root = path.resolve(__dirname, '..');

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html');
        return res.end(architectureFixture({lang: url.searchParams.get('lang') || 'en', failFragment: url.searchParams.has('fail')}));
    }
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) {res.writeHead(403);return res.end();}
    fs.readFile(file, (error, content) => {
        res.statusCode = error ? 404 : 200;
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
        res.end(error ? '' : content);
    });
});

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({headless: true});
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        for (const lang of ['en', 'tr']) {
            const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            // The fixture mocks all services; reject accidental external requests.
            await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
            await page.goto(base + '/?lang=' + lang);
            await page.locator('#app-loader').waitFor({state: 'detached'});
            assert.equal(await page.locator('template[data-fragment]').count(), 0);
            assert.equal(await page.locator('.tab-panel').count(), 12);
            assert.equal(await page.locator('html').getAttribute('lang'), lang);
            await page.locator('.dock-btn[data-target="tab-models"]').click();
            await page.locator('#manual-models-list-container .model-item').waitFor();
            assert.equal(await page.locator('#manual-models-list-container .item-title').textContent(), 'Fixture Model');
            await page.locator('[data-catalog-search]').fill('fixture-model');
            await page.locator('[data-catalog-index]').waitFor();
            await page.locator('[data-model-create]').click();
            await page.locator('.vx-drawer #model-id').fill('new-model');
            await page.locator('#model-type-switch').check();
            await page.locator('#model-format-template').selectOption('chatml');
            assert.equal(await page.locator('#model-token-user-start').inputValue(), '<|im_start|>user');
            await page.locator('.drawer-close').click();
            await page.locator('.vx-drawer').waitFor({state: 'detached'});
            await page.locator('#manual-models-list-container .model-actions-trigger').click();
            await page.locator('.model-menu .menu-item').nth(1).click();
            await page.locator('#trans-tr-title').fill('Deneme Modeli');
            await page.locator('#translation-editor-form button[type="submit"]').click();
            await page.locator('.vx-modal').waitFor({state: 'detached'});
            if (lang === 'tr') assert.equal(await page.locator('#manual-models-list-container .item-title').textContent(), 'Deneme Modeli');
            await page.locator('#lang-toggle-btn').click();
            await page.locator(`[data-language="${lang === 'en' ? 'tr' : 'en'}"]`).click();
            assert.equal(await page.locator('html').getAttribute('lang'), lang === 'en' ? 'tr' : 'en');
            assert.deepEqual(errors, []);
            console.log('PASS modular console bootstrap, catalog, form, translations and language switch:', lang);
            await page.close();
        }
        const page = await browser.newPage();
        await page.goto(base + '/?fail=1');
        await page.locator('[data-startup-retry]').waitFor();
        assert.equal(await page.locator('html').getAttribute('data-startup-stage'), 'markup');
        assert.equal(await page.locator('.tab-panel').count(), 0, 'no partially mounted console');
        assert(await page.locator('template[data-fragment]').count() > 0);
        console.log('PASS atomic fragment failure and localized retry');
    } finally {
        await browser.close();
        server.close();
    }
})().catch(error => {console.error(error);server.close();process.exitCode = 1;});
