// Firestore callable timestamps may be SDK objects, JSON seconds or ISO text.
export function registrationValue(row,key,language='en'){
 const value=key==='ticketCategory'?(row.ticketCategory||row.category):row[key];
 if(value===null||value===undefined||value==='')return '—';
 if(key!=='createdAt')return String(value);
 const millis=typeof value?.toMillis==='function'?value.toMillis():
  typeof value==='object'&&Number.isFinite(value._seconds??value.seconds)?(value._seconds??value.seconds)*1000:
  typeof value==='number'?value:Date.parse(value);
 if(!Number.isFinite(millis))return '—';
 return new Date(millis).toLocaleString(language==='tr'?'tr-TR':'en-GB',{timeZone:'Europe/Istanbul'});
}
export function registrationCSVCell(value){
 let text=String(value??'');
 if(/^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
