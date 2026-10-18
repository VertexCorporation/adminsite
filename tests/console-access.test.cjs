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

test('verified legacy admin responses recover Core sidebar and visible panels', () => {
  const safe = value => JSON.parse(JSON.stringify(value));
  // Current backend returns explicit Core; earlier callable deployments
  // returned the same trusted admin boolean but no Core department label.
  const legacy = normalize({isAdmin:true,departments:[]});
  assert.equal(legacy.isAdmin,true);
  assert.deepEqual(safe(legacy.departments),['Core']);
  assert.deepEqual(safe(normalize({isAdmin:true,departments:['Array']})).departments,['Core','Array']);
  assert.deepEqual(safe(normalize({isCore:true,departments:['Array']})).departments,['Core','Array']);
  assert.throws(()=>normalize({isCore:false,departments:['Core']}),/Invalid console authorization response/);
  assert.throws(()=>normalize({isAdmin:false,departments:['Core']}),/Invalid console authorization response/);
});
