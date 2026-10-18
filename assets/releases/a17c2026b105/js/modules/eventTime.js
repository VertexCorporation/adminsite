// Convert a wall-clock form value using the event's IANA time zone, never the operator's zone.
const partsAt = (date,timeZone) => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
export function eventLocalTime(iso,timeZone) {
 if(!iso)return '';
 const p=partsAt(new Date(iso),timeZone);
 return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function eventInstant(local,timeZone) {
 if(!local)return '';
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw Error('Invalid event time');
 const [year,month,day,hour,minute]=local.match(/\d+/g).map(Number);
 const wall=Date.UTC(year,month-1,day,hour,minute);let candidate=wall;
 for(let attempt=0;attempt<4;attempt++){
  const p=partsAt(new Date(candidate),timeZone);const displayed=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);
  candidate+=wall-displayed;
  if(eventLocalTime(new Date(candidate).toISOString(),timeZone)===local)return new Date(candidate).toISOString();
 }
 throw Error('This local time does not exist in the selected time zone');
}
