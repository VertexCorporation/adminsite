'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/utils/isoWeek.js','utf8').replace('export function isoWeek','function isoWeek');
const isoWeek=vm.runInNewContext(source+'; isoWeek',{Date});
for(const [date,year,weekNumber] of [
 ['2020-12-31',2020,53],['2021-01-01',2020,53],['2021-01-04',2021,1],
 ['2022-01-01',2021,52],['2023-01-01',2022,52],
 ['2024-12-30',2025,1],['2025-12-31',2026,1],
 ['2026-01-01',2026,1],['2026-12-31',2026,53]
])test(date+' ISO week-year',()=>assert.deepEqual(JSON.parse(JSON.stringify(isoWeek(date+'T12:00:00Z'))),{year,weekNumber}));
test('invalid date',()=>assert.throws(()=>isoWeek('invalid'),TypeError));
