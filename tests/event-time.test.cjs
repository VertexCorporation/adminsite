const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../js/modules/eventTime.js'),'utf8');const {eventInstant,eventLocalTime,eventCandidates}=vm.runInNewContext(source.replaceAll('export function','function')+';({eventInstant,eventLocalTime,eventCandidates})',{Intl,Date});
test('event time uses the chosen IANA zone instead of the operator timezone',()=>{
 assert.equal(eventInstant('2026-11-08T07:00','Europe/Istanbul'),'2026-11-08T04:00:00.000Z');assert.equal(eventLocalTime('2026-11-08T04:00:00Z','Europe/Istanbul'),'2026-11-08T07:00');
 assert.equal(eventInstant('2026-07-01T09:00','America/New_York'),'2026-07-01T13:00:00.000Z');assert.equal(eventInstant('2026-01-01T09:00','America/New_York'),'2026-01-01T14:00:00.000Z');
});
test('rejects nonexistent DST wall time, invalid dates and invalid timezones',()=>{
 assert.throws(()=>eventInstant('2026-03-08T02:30','America/New_York'));assert.throws(()=>eventInstant('2026-02-30T09:00','Europe/Istanbul'));assert.throws(()=>eventInstant('2026-11-08T09:00','Mars/Test'));
});

test('repeated European wall time exposes both selectable UTC instants',()=>{
 const matches=eventCandidates('2026-10-25T02:30','Europe/Berlin');
 assert.equal(matches.length,2);
 assert.equal(eventInstant('2026-10-25T02:30','Europe/Berlin','earlier'),matches[0]);
 assert.equal(eventInstant('2026-10-25T02:30','Europe/Berlin','later'),matches[1]);
 for(const instant of matches)assert.equal(eventLocalTime(instant,'Europe/Berlin'),'2026-10-25T02:30');
});
