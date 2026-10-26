'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/modules/teamCards.js','utf8');
const implementation=source.slice(source.indexOf('export async function initWeeklyStarsPanel'),
    source.indexOf('\nfunction renderWeeklyStars')).replace('export async function','async function');

function fixture(fetchStars,fetchDirectory=async()=>[]){
    const events=[],container={set textContent(_){throw Error('Static loading text is not allowed');}};
    const fields=()=>'';
    const context={
        document:{getElementById:()=>container},
        beginPanelLoading(host,factory){assert.equal(host,container);assert.equal(factory,fields);
            events.push('loading');return()=>events.push('finished');},
        skeletonFormField:fields,getWeeklyStarsFn:fetchStars,
        loadWeeklyStarsDirectory:fetchDirectory,getVertexContributorsFn:()=>{},
        getLang:()=> 'tr',renderWeeklyStars:(_host,data)=>events.push(data),
        showLoadError:(_host,_message,retry,options)=>events.push({retry,options}),
        userErrorMessage:e=>e.message,console:{warn:()=>{}}
    };
    vm.createContext(context);
    vm.runInContext('let weeklyCache=null,weeklyDirectory=[],weeklyLoadEpoch=0,weeklySaveRequest=null;'+implementation+';this.load=initWeeklyStarsPanel;',context);
    return {load:context.load,events};
}

test('skeleton remains active until both the selection and every candidate page finish',async()=>{
    let release,start;
    const started=new Promise(resolve=>{start=resolve;});
    const fx=fixture(async()=>({data:{current:null,history:[]}}),
        ()=>new Promise(resolve=>{release=resolve;start();}));
    const pending=fx.load();
    await started;
    assert.deepEqual(fx.events,['loading']);
    release([{id:'a',name:'A',isVertex:true}]);
    await pending;
    assert.equal(fx.events[1].directory.length,1);
    assert.equal(fx.events.at(-1),'finished');
});

test('failed initial loads remove the skeleton and offer a retry without discarding a live form',async()=>{
    const fx=fixture(async()=>{throw Error('Unavailable');});
    await fx.load();
    assert.equal(fx.events[0],'loading');
    assert.equal(fx.events[1].options.staleSelector,'#weekly-stars-form');
    assert.equal(typeof fx.events[1].retry,'function');
    assert.equal(fx.events.at(-1),'finished');
});

test('a failed candidate directory exits loading and renders its recoverable error state',async()=>{
    const fx=fixture(async()=>({data:{current:null,history:[]}}),async()=>{throw Error('Directory unavailable');});
    await fx.load();
    assert.equal(fx.events[1].directory.length,0);
    assert.equal(fx.events[1].directoryError.message,'Directory unavailable');
    assert.equal(fx.events.at(-1),'finished');
});
