const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../js/modules/eventTime.js'),'utf8');const {eventInstant,eventLocalTime}=vm.runInNewContext(source.replaceAll('export function','function')+';({eventInstant,eventLocalTime})',{Intl,Date});
test('event time uses the chosen IANA zone instead of the operator timezone',()=>{
 assert.equal(eventInstant('2026-11-08T07:00','Europe/Istanbul'),'2026-11-08T04:00:00.000Z');assert.equal(eventLocalTime('2026-11-08T04:00:00Z','Europe/Istanbul'),'2026-11-08T07:00');
 assert.equal(eventInstant('2026-07-01T09:00','America/New_York'),'2026-07-01T13:00:00.000Z');assert.equal(eventInstant('2026-01-01T09:00','America/New_York'),'2026-01-01T14:00:00.000Z');
});
test('rejects nonexistent DST wall time, invalid dates and invalid timezones',()=>{
 assert.throws(()=>eventInstant('2026-03-08T02:30','America/New_York'));assert.throws(()=>eventInstant('2026-02-30T09:00','Europe/Istanbul'));assert.throws(()=>eventInstant('2026-11-08T09:00','Mars/Test'));
});
