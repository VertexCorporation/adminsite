'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

// Reuse the established synthetic Auth fixture; never connect QA to live data.
function architectureFixture({lang = 'en', failFragment = false, reportAccess = 'core'} = {}) {
    const legacy = fs.readFileSync(path.join(root, 'tests/browser.cjs'), 'utf8');
    const fixture = legacy.split('await page.addInitScript(()=>{')[1].split('\n});')[0];
    const script = `
${fixture}
window.__testClaims = ${JSON.stringify(reportAccess === 'core' ? {admin:true} : {departments:['Array']})};
localStorage.setItem('siteLang', ${JSON.stringify(lang)});
sessionStorage.setItem('firebaseConfig', JSON.stringify({apiKey:'synthetic-test'}));
window.firebase.initializeApp = () => window.firebase.apps.push({});
const appendScript = document.head.appendChild.bind(document.head);
document.head.appendChild = element => {
    if (element.src?.startsWith('https://www.gstatic.com/firebasejs/')) {
        queueMicrotask(() => element.onload?.());
        return element;
    }
    return appendScript(element);
};
const nativeFetch = window.fetch.bind(window);
const model = {id:'fixture-model',source:'manual',type:'roleplay',
    details:{en:{title:'Fixture Model',summary:'A model for architecture QA',description:'Description',role:'Helpful assistant'}}};
const catalogue = {producers:{Fixture:{Series:{Model:model,series_description:{en:'Series description'}}}}};
window.fetch = async (input, init) => {
    const url = new URL(input, location.href);
    if (url.origin === location.origin) {
        if (${JSON.stringify(failFragment)} && url.pathname.endsWith('/partials/panels/models.html'))
            return new Response('Unavailable', {status:503});
        return nativeFetch(input, init);
    }
    let result = {};
    if (url.hostname === 'cortexishere.com') {
        if (url.pathname === '/models') return Response.json(catalogue);
        return Response.json({ok:true});
    }
    const name = url.hostname.split('-')[0];
    if (name === 'getreportworkspace') {const input=JSON.parse(init.body).data;result={schemaVersion:2,department:input.department,weekStart:input.weekStart,canEdit:${JSON.stringify(reportAccess !== 'member')},members:[{id:'report-person',name:'Report Person'}],entries:[],tasks:[],openTasks:[],availableDepartments:${JSON.stringify(reportAccess === 'core'?['Core','Array']:['Array'])},cursors:{entries:null,tasks:null,open:null}};}
    else if (name === 'savereporttask' || name === 'savereportentry') result={revision:1};
    else if (name === 'getvertexcontributors') result = {contributors:[]};
    else if (name === 'listconsolechatchannels') result = {channels:[],isAdmin:true};
    else if (name === 'listconsoleusers') result = {users:[],nextCursor:null};
    else if (name === 'listusersubscriptions') result = {subscriptions:[]};
    else if (name === 'listsiteteam') result = {entries:[],members:[],cards:[]};
    else if (name === 'listbeaconapplications') result = {applications:[]};
    else if (name === 'manageoriginprogram') result = {rows:[],nextCursor:null};
    else if (name === 'getserverstatus') result = {maintenance:false};
    else if (name === 'getweeklystars') result = {stars:[]};
    return Response.json({result});
};
window.addEventListener('error', event => {
    const item = document.createElement('p');
    item.dataset.architectureError = '';
    item.textContent = event.message;
    document.body.append(item);
});
`;
    return fs.readFileSync(path.join(root, 'index.html'), 'utf8')
        .replace(/<script>\s*\/\/ Alan adı kontrolü[\s\S]*?<\/script>/, '')
        .replace('<head>', '<head><base href="/">\n<script>' + script.replaceAll('</script', '<\\/script') + '</script>');
}

module.exports = {architectureFixture};
