'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const initializer = fs.readFileSync('js/core/initializer.js', 'utf8');
const {nodes}=require('./helpers/source-ast.cjs');
const implementation=nodes(initializer,n=>n.type==='VariableDeclaration' && n.declarations.some(d=>['loadScriptOnce','loadScript'].includes(d.id.name))).map(n=>initializer.slice(n.start,n.end)).join('\n');

function harness(outcomes) {
    let attempted = 0, removed = 0;
    const document = {
        createElement() { return {remove() { removed++; }}; },
        head: {
            appendChild(script) {
                attempted++;
                queueMicrotask(() => {
                    if (outcomes.shift() === 'failure') script.onerror();
                    else script.onload();
                });
            }
        }
    };
    const context = { document, Error, Promise, setTimeout(callback, ms) {
        if (ms === 400) queueMicrotask(callback);
        return 1;
    }, clearTimeout() {} };
    vm.runInNewContext(implementation + '\nglobalThis.loadScriptForTest = loadScript;', context);
    return { load: context.loadScriptForTest, get attempted() { return attempted; }, get removed() { return removed; } };
}

test('a transient failed Firebase SDK request retries and then starts', async () => {
    const h = harness(['failure', 'success']);
    await h.load('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth-compat.js');
    assert.equal(h.attempted, 2);
    assert.equal(h.removed, 1);
});

test('a persistent SDK failure has a bounded retry count', async () => {
    const h = harness(['failure', 'failure']);
    await assert.rejects(h.load('https://www.gstatic.com/firebasejs/11.0.0/firebase-auth-compat.js'), /SDK could not load/);
    assert.equal(h.attempted, 2);
    assert.equal(h.removed, 2);
});

test('bootstrap diagnostic stages are non-sensitive and the authz fallback is defined', () => {
    assert.match(initializer, /dataset\.startupStage = startupStage/);
    assert.match(initializer, /startupStage = 'authentication'/);
    assert.match(initializer, /STARTUP_TIMEOUT = 45000/);
    const main = fs.readFileSync('js/main.js', 'utf8');
    assert.match(main, /let revision\s*=\s*access\.authzVersion\s*\?\?\s*0/);
    assert.doesNotMatch(main, /ownProfile\?\./);
});
