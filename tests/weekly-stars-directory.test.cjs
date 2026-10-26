'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/utils/weekly-stars-directory.js','utf8')
    .replace('export async function','async function');
const load=vm.runInNewContext(source+';loadWeeklyStarsDirectory',{Map,Set,Error});
const person=id=>({id,name:'Person '+id,isVertex:true});

test('all active members, including those after the first 40 and 50, remain selectable',async()=>{
    const calls=[];
    const people=await load(async request=>{
        calls.push(request);
        const offset=request.cursor?50:0;
        return {data:{contributors:Array.from({length:request.cursor?11:50},(_,i)=>person(String(offset+i))),
            nextCursor:request.cursor?null:'page-two',hasMore:!request.cursor}};
    });
    assert.equal(people.length,61);
    assert.equal(people.at(-1).id,'60');
    assert.deepEqual(calls.map(x=>x.filter),['vertex','vertex']);
    assert.deepEqual(calls.map(x=>x.pageSize),[50,50]);
    assert.deepEqual(calls.map(x=>x.cursor),[null,'page-two']);
});

test('empty filtered scan pages continue; duplicate and inactive records are excluded',async()=>{
    const pages=[
        {contributors:[],nextCursor:'scan-two',hasMore:true},
        {contributors:[person('a'),{...person('inactive'),isVertex:false}],nextCursor:'scan-three'},
        {contributors:[person('a'),person('b'),{id:'no-name',isVertex:true}],nextCursor:null}
    ];
    const people=await load(async()=>({data:pages.shift()}));
    assert.equal(people.map(p=>p.id).join(','),'a,b');
    assert.equal(pages.length,0);
});

test('a later page failure never returns a misleading partial directory',async()=>{
    let count=0;
    await assert.rejects(load(async()=>{
        if(count++)throw Error('Page unavailable');
        return {data:{contributors:[person('a')],nextCursor:'next'}};
    }),/Page unavailable/);
});

test('invalid or repeating pagination fails instead of looping or silently truncating',async()=>{
    for(const data of [{contributors:[],hasMore:true},{contributors:[],nextCursor:42},{}])
        await assert.rejects(load(async()=>({data})),/Invalid|Missing/);
    let calls=0;
    await assert.rejects(load(async()=>{
        calls++;
        return {data:{contributors:[],nextCursor:'same'}};
    }),/Invalid participant page cursor/);
    assert.equal(calls,2);
});
