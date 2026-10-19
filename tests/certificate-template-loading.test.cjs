'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('js/modules/certificateEmailTemplates.js','utf8');
const start=source.indexOf('    let loadGeneration=0;');
const end=source.indexOf('    const unsubscribe=onLangChange(paint);load();',start);
assert(start>0&&end>start,'Keep template-loading lifecycle testable');
const implementation=source.slice(start,end);

function fixture(getResponse){
    const failures=[],footer={hidden:false};
    let starts=0,paints=0;
    const context={
        footer,
        loader:{start(){starts++;},error(message,retry){failures.push({message,retry});}},
        getVertexCertificateEmailTemplatesFn:getResponse,
        normalizeVerificationLinks:value=>value,
        templateErrorMessage:error=>error.message,
        __:key=>key,
    };
    vm.createContext(context);
    vm.runInContext(`
        let templates=[],type='merit',language='tr',current,draft,dirty=false,alive=true;
        const selected=()=>templates.find(t=>t.certificateType===type&&t.language===language);
        const paint=()=>consolePaint();
        ${implementation}
        globalThis.loadTest=load;
        globalThis.getState=()=>({templates,current,draft,dirty});
    `,Object.assign(context,{consolePaint:()=>{paints++;}}));
    return {load:()=>context.loadTest(),getState:()=>context.getState(),footer,failures,
        get starts(){return starts;},get paints(){return paints;}};
}
const valid=()=>Array.from({length:10},(_,i)=>({
    certificateType:['merit','tenacity','constancy','nobility','majesty'][Math.floor(i/2)],
    language:i%2?'en':'tr',subject:'Subject '+i,html:'<p>Body '+i+'</p>',revision:1,
}));

test('invalid template count shows recoverable error, not a blank drawer',async()=>{
    const fx=fixture(async()=>({data:{templates:valid().slice(0,9)}}));
    await fx.load();
    assert.equal(fx.footer.hidden,true);
    assert.equal(fx.failures.length,1);
    assert.match(fx.failures[0].message,/Invalid email template API response/);
    assert.equal(typeof fx.failures[0].retry,'function');
    assert.equal(fx.paints,0);
});

test('valid templates paint and expose a selected editable template',async()=>{
    const fx=fixture(async()=>({data:{templates:valid()}}));
    await fx.load();
    assert.equal(fx.failures.length,0);
    assert.equal(fx.footer.hidden,false);
    assert.equal(fx.paints,1);
    assert.equal(fx.getState().current.subject,'Subject 0');
});

test('late obsolete response cannot overwrite newer loaded templates',async()=>{
    let resolveFirst,requests=0;
    const fx=fixture(async()=>{
        if(++requests===1)return new Promise(resolve=>{resolveFirst=resolve;});
        const next=valid();next[0].subject='Newest';
        return {data:{templates:next}};
    });
    const pending=fx.load();
    await fx.load();
    resolveFirst({data:{templates:valid()}});
    await pending;
    assert.equal(fx.getState().current.subject,'Newest');
    assert.equal(fx.paints,1);
    assert.equal(fx.failures.length,0);
});

test('ten templates with duplicate certificate/language pairs are not accepted',async()=>{
    const templates=valid();
    templates[9]={...templates[0]};
    const fx=fixture(async()=>({data:{templates}}));
    await fx.load();
    assert.equal(fx.footer.hidden,true);
    assert.equal(fx.failures.length,1);
    assert.match(fx.failures[0].message,/Invalid email template API response/);
});
