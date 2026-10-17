import { beginPanelLoading, setButtonLoading } from '../utils/loading.js';
import { showLoadError } from '../ui/states.js';
import { eventLocalTime, eventInstant } from './eventTime.js';
import { mountEventFields } from './eventFields.js';
import { eventCallable } from '../core/firebase.js';
import { getEffectivePanelLevel } from './roles.js';
import { confirmDialog } from './shell.js';
import { escapeHTML, showToast, getLang } from '../utils/ui.js';
const tr = (a,b) => getLang()==='tr'?a:b;
const fields = [
 ['id','Kimlik','ID','text'],['title','Başlık','Title','text'],['title_en','İngilizce başlık','English title','text'],
 ['desc','Açıklama','Description','textarea'],['desc_en','İngilizce açıklama','English description','textarea'],
 ['detailDesc','Detaylı içerik','Content','textarea'],['detailDesc_en','İngilizce içerik','English content','textarea'],
 ['date','Tarih','Date','date'],['timeZone','Saat dilimi (IANA)','Time zone (IANA)','text'],['startsAt','Başlangıç tarihi ve saati','Start date and time','datetime-local'],['endsAt','Bitiş tarihi ve saati','End date and time','datetime-local'],
 ['location','Konum','Location','text'],['location_en','İngilizce konum','English location','text'],['mapUrl','Harita bağlantısı','Map link','url'],['cover','Kapak URL','Cover URL','url'],
 ['images','Galeri URL (satır başına bir)','Gallery URLs (one per line)','textarea'],['capacity','Kontenjan (boş: sınırsız)','Capacity (blank: unlimited)','number'],
 ['price','Fiyat (0: ücretsiz, multiple: kategoriler)','Price (0: free, multiple: categories)','text'],['stripeLink','Stripe Payment Link','Stripe Payment Link','url'],
 ['stripeLinkStandart','Standart Stripe bağlantısı','Standard Stripe link','url'],['stripeLinkSpesiyal','Spesiyal Stripe bağlantısı','Special Stripe link','url'],
 ['speakers','Konuşmacılar (JSON listesi)','Speakers (JSON array)','textarea'],['ticketCategories','Bilet kategorileri (JSON: name, price, stripeLink)','Ticket categories (JSON: name, price, stripeLink)','textarea'],
 ['translations','Diğer diller (JSON dil kodları)','Other languages (JSON language codes)','textarea']
];
let current = null;
export function initEventsModule() {
 const form=document.getElementById('events-editor');
 const container=document.getElementById('events-fields');
 container.innerHTML=fields.map(([key,a,b,type])=>`<div class="form-group-field"><label for="event-${key}">${escapeHTML(tr(a,b))}</label>${type==='textarea'?`<textarea id="event-${key}" name="${key}" rows="3"></textarea>`:`<input id="event-${key}" name="${key}" type="${type}" ${['id','title','desc','date','timeZone','location'].includes(key)?'required':''}>`}</div>`).join('')+`<div class="form-group-field"><label for="event-status">${tr('Durum','Status')}</label><select id="event-status" name="status"><option value="draft">${tr('Taslak','Draft')}</option><option value="published">${tr('Yayımlanmış','Published')}</option><option value="cancelled">${tr('İptal','Cancelled')}</option></select></div><div class="form-group-field"><label for="event-sales">${tr('Satış durumu','Sales status')}</label><select id="event-sales" name="salesStatus"><option value="closed">${tr('Kapalı','Closed')}</option><option value="open">${tr('Açık','Open')}</option><option value="sold_out">${tr('Tükendi','Sold out')}</option></select></div><div class="form-group-field"><label>${tr('Görsel yükle','Upload image')}<input type="file" id="event-upload" accept="image/jpeg,image/png,image/webp"></label></div><div class="form-group-field"><label>${tr('Galeriye görsel yükle','Upload gallery images')}<input type="file" id="event-gallery-upload" accept="image/jpeg,image/png,image/webp" multiple></label></div>`;
 form.elements.startsAt.onchange=()=>{if(form.elements.startsAt.value)form.elements.date.value=form.elements.startsAt.value.slice(0,10);};
 const refreshFields=mountEventFields(form,tr);
 const fail=e=>showToast(e.message,'error');
 const fill = event => {
  current=event; form.reset();
  for(const [key] of fields) form.elements[key].value=key==='images'?(event?.[key]||[]).join('\n'):['speakers','ticketCategories','translations'].includes(key)?JSON.stringify(event?.[key]|| (key==='translations'?{}:[]),null,2):event?.[key]??'';
  for(const key of ['startsAt','endsAt'])form.elements[key].value=eventLocalTime(event?.[key],event?.timeZone||'Europe/Istanbul');
  form.elements.id.readOnly=!!event;
  form.elements.timeZone.value=event?.timeZone||'Europe/Istanbul';form.elements.price.value=event?.price??0;
  form.elements.status.value=event?.status||'draft';form.elements.salesStatus.value=event?.salesStatus||'closed';
  document.getElementById('events-review-label').hidden=!event?.dateReviewRequired;
  refreshFields();
  const writable=getEffectivePanelLevel('events.editor')==='write';
  form.querySelectorAll('input,textarea,select,button').forEach(control=>{if(control.id==='events-preview')return;control.disabled=!writable;if(!writable)control.dataset.roleDisabled='true';});
 };
 const collect=()=>{
  const value={...current};
  for(const [key] of fields) {const raw=form.elements[key].value.trim();value[key]=key==='images'?raw.split('\n').filter(Boolean):['speakers','ticketCategories','translations'].includes(key)?JSON.parse(raw|| (key==='translations'?'{}':'[]')):raw;}
  if(value.startsAt)value.date=value.startsAt.slice(0,10);
  for(const key of ['startsAt','endsAt'])value[key]=eventInstant(value[key],value.timeZone);
  value.price=value.price!==''&&Number.isFinite(Number(value.price))?Number(value.price):value.price;value.capacity=value.capacity?Number(value.capacity):null;
  value.status=form.elements.status.value;value.salesStatus=form.elements.salesStatus.value;
  if(form.elements.dateReviewed.checked)value.dateReviewRequired=false;
  if(value.cover)value.banner=undefined;
  value.disableRegister=value.salesStatus!=='open';return value;
 };
 const refresh=async()=>{
  if(getEffectivePanelLevel('events.list')==='none')return;
  const list=document.getElementById('events-list');
  const button=document.getElementById('events-refresh');
  const finishLoading=beginPanelLoading(list);
  setButtonLoading(button,true);
  try {
  const {data}=await eventCallable('listConsoleEvents',{});list.replaceChildren();
  for(const status of ['published','draft','cancelled']){
   const title=document.createElement('h4');title.textContent=tr({published:'Yayımlanmış',draft:'Taslak',cancelled:'İptal'}[status],status);list.append(title);
   for(const event of data.events.filter(e=>e.status===status)) {
    const row=document.createElement('div');row.className='article-item';const label=document.createElement('span');label.textContent=`${event.title} · ${event.date} · ${event.timeZone}${event.dateReviewRequired?' ⚠':''}`;row.append(label);
    if(getEffectivePanelLevel('events.editor')!=='none')for(const [text,handler] of [[tr('Aç','Open'),()=>{fill(event);document.querySelector('[data-nav-panel="events.editor"]').click();}],[tr('Sil','Delete'),async()=>{if(await confirmDialog({title:tr('Etkinlik silinsin mi?','Delete event?'),body:event.title})){await eventCallable('saveConsoleEvent',{event:{...event,status:'deleted'},revision:event.revision});await refresh();}}]]){if(text===tr('Sil','Delete') && getEffectivePanelLevel('events.editor')!=='write')continue;const button=document.createElement('button');button.type='button';button.className='chrome-btn-outline';button.textContent=text;button.onclick=()=>Promise.resolve(handler()).catch(fail);row.append(button);}
    list.append(row);
   }
  }
  } catch(error) {
    showLoadError(list,()=>tr('Etkinlikler yüklenemedi','Could not load events'),refresh,{staleSelector:'.article-item'});
  } finally {
    finishLoading();
    setButtonLoading(button,false);
  }
 };
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]');if(button.disabled||getEffectivePanelLevel('events.editor')!=='write')return;setButtonLoading(button,true);try{const event=collect();if(await confirmDialog({title:tr('Değişiklik kaydedilsin mi?','Save changes?'),body:`${event.title} · ${event.status}`})){await eventCallable('saveConsoleEvent',{event,revision:current?.revision||0});fill(null);await refresh();showToast(tr('Kaydedildi','Saved'),'success');}}catch(e){fail(e);}finally{setButtonLoading(button,false);}};
 document.getElementById('events-preview').onclick=()=>{try{const event=collect();const box=document.getElementById('events-preview-content');box.hidden=false;box.replaceChildren();for(const text of [event.title,`${event.date} · ${event.timeZone}`,event.desc,event.detailDesc,event.location]){const p=document.createElement('p');p.textContent=text;box.append(p);}}catch(e){fail(e);}finally{setButtonLoading(button,false);}};
 document.getElementById('events-new').onclick=()=>fill(null);
 document.getElementById('events-refresh').onclick=()=>refresh().catch(fail);
 const upload=async file=>{
  if(file.size>10*1024*1024)throw Error(tr('En fazla 10 MB','Maximum 10 MB'));
  const {data}=await eventCallable('getEventImageUploadUrl',{eventId:form.elements.id.value,contentType:file.type});
  const response=await fetch(data.url,{method:'PUT',headers:data.headers,body:file});
  if(!response.ok)throw Error(tr('Görsel yüklenemedi','Image upload failed'));
  const completed=await eventCallable('completeEventImageUpload',{filePath:data.filePath});return completed.data.downloadUrl;
 };
 document.getElementById('event-upload').onchange=async e=>{try{if(e.target.files[0])form.elements.cover.value=await upload(e.target.files[0]);}catch(error){fail(error);}};
 document.getElementById('event-gallery-upload').onchange=async e=>{try{for(const file of e.target.files){const url=await upload(file);form.elements.images.value=[form.elements.images.value.trim(),url].filter(Boolean).join('\n');}}catch(error){fail(error);}};
 document.getElementById('events-load-registrations').onclick=async event=>{const button=event.currentTarget;setButtonLoading(button,true);try{const {data}=await eventCallable('listEventRegistrations',{eventId:document.getElementById('events-registration-search').value});const box=document.getElementById('events-registrations');box.replaceChildren();for(const row of data.registrations){const p=document.createElement('p');p.textContent=`${row.name} · ${row.email} · ${row.status} · ${row.id}`;box.append(p);}}catch(e){fail(e);}};
 document.addEventListener('vertex:workspace',e=>{if(e.detail.keys.includes('events.list'))refresh().catch(fail);});
 fill(null);
}
