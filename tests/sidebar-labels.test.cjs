const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('all sidebar submenu labels are localized in title case without slashes', () => {
    const lang = fs.readFileSync(path.join(__dirname, '..', 'js/lang.js'), 'utf8');
    const entries = [...lang.matchAll(/"subnav\.([\w]+)"\s*:\s*"([^"]+)"/g)];
    assert.equal(entries.length, 34, '17 submenu entries per language expected');
    const keys = entries.slice(0, 17).map(entry => entry[1]);
    assert.deepEqual(keys, entries.slice(17).map(entry => entry[1]));
    for (const [index, entry] of entries.entries()) {
        const text = entry[2];
        assert.ok(!text.includes('/'), entry[1] + ' contains a slash');
        const stop = index < 17 ? new Set(['ve', 'veya']) : new Set(['and', 'or']);
        for (const word of text.split(/\s+/)) {
            if (stop.has(word.toLocaleLowerCase(index < 17 ? 'tr-TR' : 'en'))) continue;
            assert.equal(word[0], word[0].toLocaleUpperCase(index < 17 ? 'tr-TR' : 'en'), entry[1] + ': ' + text);
        }
    }
});
