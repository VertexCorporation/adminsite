const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = () => import('data:text/javascript;base64,' + fs.readFileSync(path.join(__dirname, '../js/core/appConfig.js')).toString('base64'));

test('startup recovers from a CORS-hidden network failure and a transient 429', async () => {
    const { fetchFirebaseConfig } = await load();
    let calls = 0; const waits = [];
    const config = await fetchFirebaseConfig({ fetchImpl: async () => {
        calls++;
        if (calls === 1) throw new TypeError('Failed to fetch');
        if (calls === 2) return { ok: false, status: 429 };
        return { ok: true, json: async () => ({ apiKey: 'fixture' }) };
    }, wait: async ms => waits.push(ms) });
    assert.equal(config.apiKey, 'fixture');
    assert.equal(calls, 3); assert.deepEqual(waits, [500, 1000]);
});

test('startup retries are bounded when the configuration service remains unavailable', async () => {
    const { fetchFirebaseConfig } = await load(); let calls = 0;
    await assert.rejects(fetchFirebaseConfig({ fetchImpl: async () => { calls++; return { ok: false, status: 503 }; }, wait: async () => {}, fallbackUrl: '/firebase-config.json' }), /503/);
    assert.equal(calls, 4);
});

test('startup uses the verified public deployment configuration when Cloud Run remains unavailable', async () => {
    const { fetchFirebaseConfig } = await load(); const urls = [];
    const config = await fetchFirebaseConfig({ fetchImpl: async url => {
        urls.push(url);
        if (url === '/firebase-config.json') return { ok: true, json: async () => ({ apiKey: 'fixture', projectId: 'vertex-ai-1618', appId: 'fixture-app' }) };
        return { ok: false, status: 429 };
    }, wait: async () => {}, fallbackUrl: '/firebase-config.json' });
    assert.equal(config.projectId, 'vertex-ai-1618');
    assert.equal(urls.length, 4); assert.equal(urls[3], '/firebase-config.json');
});

test('startup does not retry denied origins or invalid configuration', async () => {
    const { fetchFirebaseConfig } = await load();
    for (const response of [{ ok: false, status: 403 }, { ok: true, json: async () => ({}) }]) {
        let calls = 0;
        await assert.rejects(fetchFirebaseConfig({ fetchImpl: async () => { calls++; return response; }, wait: async () => assert.fail('Unexpected retry') }));
        assert.equal(calls, 1);
    }
});
