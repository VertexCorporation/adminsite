'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/utils/console-access.js','utf8').replace('export function normalizeConsoleAccessResponse','function normalizeConsoleAccessResponse');
const normalize = vm.runInNewContext(source+'\nnormalizeConsoleAccessResponse;', { Set, Error, Array });

test('modern and legacy Core responses return the same verified access', () => {
  const modern=normalize({isAdmin:true,isCore:true,departments:['Core']});
  const legacy=normalize({isCore:true,departments:['Core']});
  const safe = value => JSON.parse(JSON.stringify(value));
  assert.deepEqual(safe(modern),safe(legacy));
  assert.equal(normalize({isCore:false,departments:['Array']}).isAdmin,false);
  assert.deepEqual(safe(normalize({isAdmin:false,departments:['Aero','Aero']})).departments,['Aero']);
});

test('fail closed on missing, contradictory or malformed role data', () => {
  for (const bad of [null,[],{}, {isAdmin:'true',departments:['Core']},
     {isAdmin:true,isCore:false,departments:['Core']},
     {isCore:false,departments:null},
     {isCore:true,departments:['Core',null]},
     {isAdmin:true,departments:[{}]}]) {
    assert.throws(()=>normalize(bad),/Invalid console authorization response/);
  }
});

test('an obsolete admin boolean cannot invent Core membership', () => {
  for (const payload of [{isAdmin:true,departments:[]}, {isAdmin:true,departments:['Array']},
      {isCore:true,departments:['Array']}, {isCore:false,departments:['Core']},
      {isAdmin:false,departments:['Core']}, {isCore:false,departments:['Unknown']}])
    assert.throws(()=>normalize(payload),/Invalid console authorization response/);
  assert.equal(normalize({isCore:true,departments:['Core']}).isCore,true);
});