// Convert a wall-clock form value using the event's IANA time zone, never the operator's zone.
const partsAt = (date,timeZone) => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
export function eventLocalTime(iso,timeZone) {
 if(!iso)return '';
 const p=partsAt(new Date(iso),timeZone);
 return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
// Resolve wall-clock times against surrounding IANA offsets. Some times occur
// twice when clocks go back, while spring-forward gaps have zero candidates.
export function eventCandidates(local,timeZone) {
 if(!local)return [];
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw Error('Invalid event time');
 const [y,m,d,h,min]=local.match(/\d+/g).map(Number);
 const wall=Date.UTC(y,m-1,d,h,min);
 const candidates=new Set();
 for(const drift of [-86400000,-43200000,0,43200000,86400000]){
  const sample=wall+drift;
  const p=partsAt(new Date(sample),timeZone);
  const projected=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);
  const candidate=wall-(projected-sample);
  if(eventLocalTime(new Date(candidate).toISOString(),timeZone)===local)candidates.add(candidate);
 }
 return [...candidates].sort((a,b)=>a-b).map(ts=>new Date(ts).toISOString());
}
export function eventInstant(local,timeZone,selection='earlier') {
 if(!local)return '';
 const matches=eventCandidates(local,timeZone);
 if(!matches.length)throw Error('This local time does not exist in the selected time zone');
 return selection==='later'?matches[matches.length-1]:matches[0];
}
