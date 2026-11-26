'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(respond, fragmentPath = null, embeddedHTML = null) {
    const mounted = [], requests = [];
    const parse = html => ({ html, childElementCount: html.trim() ? 1 : 0,
        querySelector: selector => selector === 'script' && html.includes('<script') });
    const slots = ['navigation', 'panels/models'].map(name => ({
        dataset: {fragment: name, ...(embeddedHTML===null?{}:{embeddedFragment:'true'})}, content: embeddedHTML === null ? null : parse(embeddedHTML), replaceWith(content) {mounted.push(content.html);}
    }));
    const document = {
        querySelector: () => fragmentPath ? {content: fragmentPath} : null,
        querySelectorAll: () => slots,
        createElement: () => ({
            set innerHTML(html) {
                this.content = parse(html);
            }
        })
    };
    const source = fs.readFileSync('js/core/htmlFragments.js', 'utf8')
        .replace('import.meta.url', JSON.stringify('https://fixture.invalid/assets/releases/release/js/core/htmlFragments.js'))
        .replace('export async function', 'async function');
    const context = {location: {href:'https://fixture.invalid/'}, URL, AbortController, document, setTimeout, clearTimeout,
        fetch: async (url, options) => {requests.push({url: String(url), signal: options.signal});return respond(String(url));}};
    vm.runInNewContext(source + '\nglobalThis.load = loadHtmlFragments;', context);
    return {load: context.load, mounted, requests, slots};
}

test('fragments share the immutable module release and mount only after every response', async () => {
    const h = harness(async () => ({ok: true, text: async () => '<div>Workspace</div>'}));
    await h.load();
    assert.equal(h.mounted.length, 2);
    assert(h.requests.every(request => request.url.startsWith('https://fixture.invalid/assets/releases/release/partials/')));
    assert(h.requests.every(request => request.signal.aborted), 'release pending fetch resources on completion');
});

test('one unavailable fragment leaves all original slots intact for a clean retry', async () => {
    const h = harness(async url => ({ok: !url.includes('/models.html'), text: async () => '<div>Workspace</div>'}));
    await assert.rejects(h.load(), /HTML fragment unavailable: panels\/models/);
    assert.deepEqual(h.mounted, []);
});

test('empty or executable fragments are rejected before mounting any workspace', async () => {
    for (const html of ['', '<script>unexpected()</script>']) {
        const h = harness(async () => ({ok: true, text: async () => html}));
        await assert.rejects(h.load(), /Invalid HTML fragment/);
        assert.deepEqual(h.mounted, []);
    }
});

test('compiled chunks use the release fragment root declared by their HTML', async () => {
    const h = harness(async () => ({ok:true,text:async()=>'<div>Workspace</div>'}), '/assets/runtime/current/partials/');
    await h.load();
    assert(h.requests.every(request=>request.url.startsWith('https://fixture.invalid/assets/runtime/current/partials/')));
});

test('embedded release templates mount atomically without extra network requests',async()=>{
 const h=harness(()=>{throw Error('Unexpected network');},null,'<section>Workspace</section>');
 await h.load();assert.equal(h.mounted.length,2);assert.equal(h.requests.length,0);
 const invalid=harness(()=>{throw Error('Unexpected network');},null,'<script>unexpected()</script>');
 await assert.rejects(invalid.load(),/Invalid HTML fragment/);assert.deepEqual(invalid.mounted,[]);
});
