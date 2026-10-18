import { eventLocalTime, eventInstant, eventCandidates } from './eventTime.js';
import { groupFields } from '../ui/sections.js';
import { renderPager } from '../ui/pager.js';
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
let editorDirty = false;
export function initEventsModule() {
 const form=document.getElementById('events-editor');
 const container=document.getElementById('events-fields');
 container.innerHTML=fields.map(([key,a,b,type])=>`<div class="form-group-field"><label for="event-${key}">${escapeHTML(tr(a,b))}</label>${type==='textarea'?`<textarea id="event-${key}" name="${key}" rows="3"></textarea>`:`<input id="event-${key}" name="${key}" type="${type}" ${['id','title','desc','date','timeZone','location'].includes(key)?'required':''}>`}</div>`).join('')+`<div class="form-group-field"><label for="event-status">${tr('Durum','Status')}</label><select id="event-status" name="status"><option value="draft">${tr('Taslak','Draft')}</option><option value="published">${tr('Yayımlanmış','Published')}</option><option value="cancelled">${tr('İptal','Cancelled')}</option></select></div><div class="form-group-field"><label for="event-sales">${tr('Satış durumu','Sales status')}</label><select id="event-sales" name="salesStatus"><option value="closed">${tr('Kapalı','Closed')}</option><option value="open">${tr('Açık','Open')}</option><option value="sold_out">${tr('Tükendi','Sold out')}</option></select></div><div class="form-group-field"><label>${tr('Görsel yükle','Upload image')}<input type="file" id="event-upload" accept="image/jpeg,image/png,image/webp"></label></div><div class="form-group-field"><label>${tr('Galeriye görsel yükle','Upload gallery images')}<input type="file" id="event-gallery-upload" accept="image/jpeg,image/png,image/webp" multiple></label></div>`;
 form.elements.startsAt.onchange=()=>{if(form.elements.startsAt.value)form.elements.date.value=form.elements.startsAt.value.slice(0,10);};
 const refreshFields=mountEventFields(form,tr);
 groupFields(container,[
  {label:tr('Genel bilgiler','General information'),keys:['id','title','title_en','desc','desc_en'],open:true},
  {label:tr('Tarih ve konum','Date and location'),keys:['date','timeZone','startsAt','endsAt','location','location_en','mapUrl']},
  {label:tr('Görseller','Images'),keys:['cover','images','event-upload','event-gallery-upload']},
  {label:tr('Biletler','Tickets'),keys:['capacity','price','stripeLink','stripeLinkStandart','stripeLinkSpesiyal','ticketCategories']},
  {label:tr('Konuşmacılar','Speakers'),keys:['speakers']},
  {label:tr('Diğer diller','Other languages'),keys:['translations']}
 ]);
 const zoneInput=form.elements.timeZone;
 const zones=document.createElement('datalist');zones.id='event-zones';
 for(const zone of (Intl.supportedValuesOf?.('timeZone')||['Europe/Istanbul','UTC'])){
  const option=document.createElement('option');option.value=zone;zones.append(option);
 }
 zoneInput.setAttribute('list','event-zones');zoneInput.after(zones);
 const choices={};
 const refreshTimes=()=>{
  for(const key of ['startsAt','endsAt']){
   const field=form.elements[key],choice=choices[key];
   try{
    const candidates=eventCandidates(field.value,zoneInput.value);
    field.setCustomValidity(field.value&&!candidates.length?tr('Bu yerel saat bulunmuyor.','This local time does not exist.'):'');
    choice.hidden=candidates.length!==2;
    if(candidates.length===2){
     for(const [i,option]of [...choice.options].entries()){
      const name=new Intl.DateTimeFormat('en',{timeZone:zoneInput.value,timeZoneName:'shortOffset'})
       .formatToParts(new Date(candidates[i])).find(p=>p.type==='timeZoneName')?.value||'UTC';
      option.textContent=tr(i===0?'İlk saat':'İkinci saat',i===0?'Earlier':'Later')+' · '+name;
     }
    }
   }catch(e){field.setCustomValidity(tr('Geçerli saat dilimi seçin.','Choose a valid time zone.'));choice.hidden=true;}
  }
 };
 for(const key of ['startsAt','endsAt']){
  const field=form.elements[key],choice=document.createElement('select');
  choice.setAttribute('aria-label',tr('Tekrarlanan saati seçin','Select ambiguous time'));
  for(const [value,label]of [['earlier',tr('İlk saat','Earlier')],['later',tr('İkinci saat','Later')]]){
   const option=document.createElement('option');option.value=value;option.textContent=label;choice.append(option);
  }
  choice.hidden=true;choices[key]=choice;field.after(choice);
  field.addEventListener('change',refreshTimes);
 }
 zoneInput.addEventListener('change',refreshTimes);
 const fail=e=>showToast(e.message,'error');
 const editorStatus=document.createElement('span');
 editorStatus.className='form-hint';
 editorStatus.setAttribute('aria-live','polite');
 form.append(editorStatus);
 const markDirty=()=>{editorDirty=true;editorStatus.textContent=tr('Kaydedilmemiş değişiklikler','Unsaved changes');};
 form.addEventListener('input',markDirty);
 form.addEventListener('change',markDirty);
 window.addEventListener('beforeunload',event=>{
   if(!editorDirty)return;
   event.preventDefault();
   event.returnValue='';
 });
 const fill = event => {
  current=event; form.reset();
  for(const [key] of fields) form.elements[key].value=key==='images'?(event?.[key]||[]).join('\n'):['speakers','ticketCategories','translations'].includes(key)?JSON.stringify(event?.[key]|| (key==='translations'?{}:[]),null,2):event?.[key]??'';
  for(const key of ['startsAt','endsAt'])form.elements[key].value=eventLocalTime(event?.[key],event?.timeZone||'Europe/Istanbul');
  form.elements.id.readOnly=!!event;
  form.elements.timeZone.value=event?.timeZone||'Europe/Istanbul';form.elements.price.value=event?.price??0;
  form.elements.status.value=event?.status||'draft';form.elements.salesStatus.value=event?.salesStatus||'closed';
  document.getElementById('events-review-label').hidden=!event?.dateReviewRequired;
  refreshFields();refreshTimes();
  editorDirty=false;editorStatus.textContent='';
  const writable=getEffectivePanelLevel('events.editor')==='write';
  form.querySelectorAll('input,textarea,select,button').forEach(control=>{if(control.id==='events-preview')return;control.disabled=!writable;if(!writable)control.dataset.roleDisabled='true';});
 };
 const collect=()=>{
  const value={...current};
  for(const [key] of fields) {const raw=form.elements[key].value.trim();value[key]=key==='images'?raw.split('\n').filter(Boolean):['speakers','ticketCategories','translations'].includes(key)?JSON.parse(raw|| (key==='translations'?'{}':'[]')):raw;}
  if(value.startsAt)value.date=value.startsAt.slice(0,10);
  for(const key of ['startsAt','endsAt'])value[key]=eventInstant(value[key],value.timeZone,choices[key].value);
  value.price=value.price!==''&&Number.isFinite(Number(value.price))?Number(value.price):value.price;value.capacity=value.capacity?Number(value.capacity):null;
  value.status=form.elements.status.value;value.salesStatus=form.elements.salesStatus.value;
  if(form.elements.dateReviewed.checked)value.dateReviewRequired=false;
  if(value.cover)value.banner=undefined;
  value.disableRegister=value.salesStatus!=='open';return value;
 };
 const refresh=async()=>{
  if(getEffectivePanelLevel('events.list')==='none')return;
  const {data}=await eventCallable('listConsoleEvents',{});const list=document.getElementById('events-list');list.replaceChildren();
  for(const status of ['published','draft','cancelled']){
   const title=document.createElement('h4');title.textContent=tr({published:'Yayımlanmış',draft:'Taslak',cancelled:'İptal'}[status],status);list.append(title);
   for(const event of data.events.filter(e=>e.status===status)) {
    const row=document.createElement('div');row.className='article-item';const label=document.createElement('span');label.textContent=`${event.title} · ${event.date} · ${event.timeZone}${event.dateReviewRequired?' ⚠':''}`;row.append(label);
    if(getEffectivePanelLevel('events.editor')!=='none')for(const [text,handler] of [[tr('Aç','Open'),()=>{fill(event);document.querySelector('[data-nav-panel="events.editor"]').click();}],[tr('Sil','Delete'),async()=>{if(await confirmDialog({title:tr('Etkinlik silinsin mi?','Delete event?'),body:event.title})){await eventCallable('saveConsoleEvent',{event:{...event,status:'deleted'},revision:event.revision});await refresh();}}]]){if(text===tr('Sil','Delete') && getEffectivePanelLevel('events.editor')!=='write')continue;const button=document.createElement('button');button.type='button';button.className='chrome-btn-outline';button.textContent=text;button.onclick=()=>Promise.resolve(handler()).catch(fail);row.append(button);}
    list.append(row);
   }
  }
 };
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]');if(button.disabled||getEffectivePanelLevel('events.editor')!=='write')return;button.disabled=true;try{const event=collect();if(await confirmDialog({title:tr('Değişiklik kaydedilsin mi?','Save changes?'),body:`${event.title} · ${event.status}`})){await eventCallable('saveConsoleEvent',{event,revision:current?.revision||0});fill(null);await refresh();showToast(tr('Kaydedildi','Saved'),'success');}}catch(e){fail(e);}finally{button.disabled=false;}};
 document.getElementById('events-preview').onclick=()=>{
  try{
   const event=collect(),box=document.getElementById('events-preview-content');box.hidden=false;box.replaceChildren();
   const lang=document.createElement('select');lang.setAttribute('aria-label',tr('Önizleme dili','Preview language'));
   for(const value of ['tr','en']){const option=document.createElement('option');option.value=value;option.textContent=value.toUpperCase();lang.append(option);}
   lang.value=getLang()==='tr'?'tr':'en';box.append(lang);
   const article=document.createElement('article');article.className='ui-event-preview';
   const add=(parent,tag,value,className='')=>{const node=document.createElement(tag);node.textContent=String(value||'');if(className)node.className=className;parent.append(node);return node;};
   const paint=()=>{
    article.replaceChildren();const language=lang.value;
    const local=(key)=>language==='en'?(event[key+'_en']||event[key]):event[key];
    if(event.cover&&/^https:\/\//.test(event.cover)){
     const img=document.createElement('img');img.className='ui-event-cover';
     img.src=event.cover;img.alt=local('title')||event.title;img.loading='lazy';article.append(img);
    }
    const content=document.createElement('div');content.className='ui-event-content';article.append(content);
    add(content,'span',event.status==='published'?tr('Yayımlanmış','Published'):event.status==='draft'?tr('Taslak','Draft'):tr('İptal','Cancelled'),'form-hint');
    add(content,'h2',local('title')||event.title);
    let formatted=event.date||'—';
    if(event.startsAt)try{formatted=new Intl.DateTimeFormat(language,{dateStyle:'long',timeStyle:'short',timeZone:event.timeZone}).format(new Date(event.startsAt));}catch{}
    add(content,'p',formatted+' · '+(event.timeZone||'—'),'form-hint');
    add(content,'p',local('location')||'—');
    add(content,'p',local('desc'));
    if(local('detailDesc'))add(content,'p',local('detailDesc'),'ui-event-description');
    if(event.speakers?.length){
     add(content,'h3',language==='tr'?'Konuşmacılar':'Speakers');
     const grid=document.createElement('div');grid.className='ui-event-grid';content.append(grid);
     for(const speaker of event.speakers){
      const card=document.createElement('div');card.className='ui-event-card';grid.append(card);
      add(card,'strong',speaker.name);add(card,'p',language==='en'?(speaker.role_en||speaker.role):speaker.role,'form-hint');
     }
    }
    if(event.ticketCategories?.length){
     add(content,'h3',language==='tr'?'Biletler':'Tickets');
     const grid=document.createElement('div');grid.className='ui-event-grid';content.append(grid);
     for(const ticket of event.ticketCategories){
      const card=document.createElement('div');card.className='ui-event-card';grid.append(card);
      add(card,'strong',ticket.name);
      add(card,'p',ticket.price?String(ticket.price)+' '+(ticket.currency||'TRY'):(language==='tr'?'Ücretsiz':'Free'));
      if(ticket.description)add(card,'p',ticket.description,'form-hint');
     }
    }
   };
   lang.addEventListener('change',paint);paint();
   // Fall back to the local DOM preview until Eventsite's public renderer
   // announces that its sandboxed draft-preview mode is ready.
   const notice=document.createElement('p');notice.className='form-hint';
   notice.setAttribute('role','status');
   notice.textContent=tr('Eventsite önizlemesi yükleniyor…','Loading Eventsite preview…');
   const frame=document.createElement('iframe');
   frame.className='ui-eventsite-frame';
   frame.title=tr('Eventsite taslak önizlemesi','Eventsite draft preview');
   frame.referrerPolicy='origin';
   frame.sandbox='allow-scripts allow-same-origin';
   frame.loading='eager';
   const origin='https://events.vertexishere.com';
   const preview=()=>{frame.src=origin+'/'+lang.value+'/?vertexPreview=1';};
   const onMessage=message=>{
     if(message.origin!==origin || message.source!==frame.contentWindow ||
        message.data?.version!==1)return;
     if(message.data.type==='vertex:event-preview:ready'){
       frame.contentWindow.postMessage({
         type:'vertex:event-preview:render',version:1,event
       },origin);
     } else if(message.data.type==='vertex:event-preview:rendered'&&message.data.id===event.id){
       article.hidden=true;
       frame.hidden=false;
       notice.textContent=tr('Gerçek Eventsite görünümü · taslak, kayıt kapalı',
         'Real Eventsite rendering · draft, registration disabled');
     }
   };
   window.addEventListener('message',onMessage);
   const observer=new MutationObserver(()=>{
      if(!frame.isConnected){
        window.removeEventListener('message',onMessage);
        observer.disconnect();
      }
   });
   observer.observe(box,{childList:true});
   frame.hidden=true;frame.src='about:blank';
   box.append(notice,frame,article);
   lang.addEventListener('change',()=>{
       article.hidden=false;frame.hidden=true;
       notice.textContent=tr('Eventsite önizlemesi yükleniyor…','Loading Eventsite preview…');
       preview();
   });
   preview();
  }catch(e){fail(e);}
 };
 document.getElementById('events-new').onclick=async()=>{
  if(editorDirty && !await confirmDialog({title:tr('Değişiklikler kaybolacak','Discard changes?'),body:tr('Kaydedilmemiş değişiklikler kaybolacak.','Unsaved changes will be lost.')}))return;
  fill(null);
 };
 document.addEventListener('click',event=>{
  if(!editorDirty||!form.offsetParent)return;
  const link=event.target.closest('[data-nav-panel],[data-target]');
  if(!link || link.dataset.navPanel==='events.editor')return;
  event.preventDefault();event.stopImmediatePropagation();
  void confirmDialog({title:tr('Kaydedilmemiş değişiklikler','Unsaved changes'),body:tr('Bu sayfadan ayrılırsan değişiklikler kaybolacak.','Leaving will discard unsaved changes.')})
    .then(approved=>{if(approved){editorDirty=false;editorStatus.textContent='';link.click();}});
 },true);
 document.getElementById('events-refresh').onclick=()=>refresh().catch(fail);
 const uploadStatus=document.createElement('p');uploadStatus.className='form-hint';uploadStatus.setAttribute('aria-live','polite');
 document.getElementById('event-gallery-upload').closest('.form-group-field')?.append(uploadStatus);
 const uploadPreviews=document.createElement('div');uploadPreviews.className='ui-event-grid';
 const uploadRetry=document.createElement('button');uploadRetry.type='button';uploadRetry.className='chrome-btn-outline';
 uploadRetry.textContent=tr('Yüklemeyi yeniden dene','Retry upload');uploadRetry.hidden=true;
 document.getElementById('event-gallery-upload').closest('.form-group-field')?.append(uploadPreviews,uploadRetry);
 const upload=async (file,onProgress=()=>{})=>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error(tr('JPEG, PNG veya WebP kullanın.','Use JPEG, PNG or WebP.'));
  if(file.size>10*1024*1024)throw Error(tr('En fazla 10 MB','Maximum 10 MB'));
  const {data}=await eventCallable('getEventImageUploadUrl',{eventId:form.elements.id.value,contentType:file.type});
  await new Promise((resolve,reject)=>{
   const request=new XMLHttpRequest();request.open('PUT',data.url);
   for(const [name,value] of Object.entries(data.headers||{}))request.setRequestHeader(name,value);
   request.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
   request.onload=()=>request.status>=200&&request.status<300?resolve():reject(Error(tr('Görsel yüklenemedi','Image upload failed')));
   request.onerror=()=>reject(Error(tr('Ağ hatası','Network error')));
   request.send(file);
  });
  const completed=await eventCallable('completeEventImageUpload',{filePath:data.filePath});
  return completed.data.downloadUrl;
 };
 const uploadFiles=async(files,cover=false)=>{
  const coverInput=document.getElementById('event-upload'),galleryInput=document.getElementById('event-gallery-upload');
  coverInput.disabled=galleryInput.disabled=true;uploadRetry.hidden=true;
  let index=0;
  try{
   for(;index<files.length;index++){
    const file=files[index];
    const url=await upload(file,p=>{uploadStatus.textContent=`${index+1}/${files.length} · ${file.name} · %${p}`;});
    if(cover){form.elements.cover.value=url;uploadPreviews.replaceChildren();}
    else form.elements.images.value=[form.elements.images.value.trim(),url].filter(Boolean).join('\n');
    const image=document.createElement('img');image.src=url;image.alt=file.name;image.loading='lazy';
    image.className='ui-event-thumb';uploadPreviews.append(image);
    markDirty();
   }
   uploadStatus.textContent=tr('Görseller yüklendi. Değişiklikleri kaydet.','Images uploaded. Save your changes.');
  }catch(error){
   uploadStatus.textContent=tr('Yükleme başarısız. Yeniden deneyin.','Upload failed. Please retry.');
   const pending=files.slice(index);uploadRetry.hidden=false;
   uploadRetry.onclick=()=>void uploadFiles(pending,cover);
   fail(error);
  }
  finally{coverInput.disabled=galleryInput.disabled=false;coverInput.value='';galleryInput.value='';}
 };
 document.getElementById('event-upload').onchange=e=>{if(e.target.files?.length)void uploadFiles([...e.target.files],true);};
 document.getElementById('event-gallery-upload').onchange=e=>{if(e.target.files?.length)void uploadFiles([...e.target.files],false);};
 document.getElementById('events-load-registrations').onclick=async()=>{
  const box=document.getElementById('events-registrations');box.replaceChildren();
  const heading=document.createElement('p');heading.className='form-hint';heading.textContent=tr('Kayıtlar yükleniyor…','Loading registrations…');box.append(heading);
  try{
   const eventId=document.getElementById('events-registration-search').value.trim();
   const {data}=await eventCallable('listEventRegistrations',{eventId,pageSize:100});
   const rows=[...(data.registrations||[])];
   let nextCursor=data.nextCursor||null;
   let fetching=false;
   const fetchNext=async()=>{
    if(!nextCursor || fetching)return;
    fetching=true;
    const cursor=nextCursor;
    try{
     const response=(await eventCallable('listEventRegistrations',{eventId,pageSize:100,cursor})).data;
     if(!response.registrations?.length&&response.nextCursor===cursor)
      throw new Error(tr('Sayfalama devam etmiyor.','Pagination did not advance.'));
     rows.push(...(response.registrations||[]));
     nextCursor=response.nextCursor||null;
    }finally{fetching=false;}
   };
   box.replaceChildren();
   if(!rows.length){box.textContent=tr('Kayıt bulunamadı.','No registrations found.');return;}
   const search=document.createElement('input');search.type='search';
   search.placeholder=tr('Kayıtlarda ara','Search registrations');search.setAttribute('aria-label',search.placeholder);
   search.className='form-group-field';box.append(search);
   const viewport=document.createElement('div');viewport.style.overflowX='auto';box.append(viewport);
   const table=document.createElement('table');table.className='contributor-table';viewport.append(table);
   const head=document.createElement('thead'),headrow=document.createElement('tr');head.append(headrow);
   for(const label of [tr('Ad','Name'),tr('E-posta','Email'),tr('Durum','Status'),tr('Bilet','Ticket'),tr('Kayıt zamanı','Registered at')]){
    const th=document.createElement('th');th.textContent=label;th.style.textAlign='left';th.style.padding='10px';headrow.append(th);
   }
   table.append(head);
   const body=document.createElement('tbody');table.append(body);
   const actions=document.createElement('div');actions.className='ui-list-actions';
   const exportButton=document.createElement('button');exportButton.type='button';
   exportButton.className='chrome-btn-outline';exportButton.textContent=tr('CSV dışa aktar','Export CSV');
   const loadMore=document.createElement('button');loadMore.type='button';
   loadMore.className='chrome-btn-outline';
   loadMore.textContent=tr('Diğer kayıtları yükle','Load more registrations');
   loadMore.hidden=!nextCursor;
   const loadAll=document.createElement('button');loadAll.type='button';
   loadAll.className='chrome-btn-outline';
   loadAll.textContent=tr('Tüm kayıtlarda ara','Search all registrations');
   loadAll.hidden=!nextCursor;
   const countLabel=document.createElement('span');countLabel.className='form-hint';
   actions.append(exportButton,loadMore,loadAll,countLabel);box.insertBefore(actions,viewport);
   let page=1;const pageSize=25;
   const columns=[['name','Ad','Name'],['email','E-posta','Email'],['status','Durum','Status'],['ticketCategory','Bilet','Ticket'],['createdAt','Kayıt zamanı','Registered at']];
   const visible=()=>rows.filter(row=>[row.name,row.email,row.status,row.ticketCategory,row.id]
      .some(v=>String(v||'').toLocaleLowerCase().includes(search.value.toLocaleLowerCase())));
   const value=(row,key)=>key==='ticketCategory'?(row.ticketCategory||row.category||'—'):String(row[key]??'—');
   const paint=()=>{
    body.replaceChildren();
    box.querySelector('.ui-pager')?.remove();
    const matches=visible();page=Math.min(page,Math.max(1,Math.ceil(matches.length/pageSize)));
    for(const row of matches.slice((page-1)*pageSize,page*pageSize)){
     const trEl=document.createElement('tr');
     for(const [key]of columns){const td=document.createElement('td');td.textContent=value(row,key);td.style.padding='10px';td.style.borderBottom='1px solid var(--border-subtle)';trEl.append(td);}
     body.append(trEl);
    }
    renderPager(box,{page,total:matches.length,pageSize,language:getLang(),onChange:next=>{page=next;paint();}});
    loadMore.hidden=!nextCursor;
    loadAll.hidden=!nextCursor;
    countLabel.textContent=nextCursor
        ?tr(`${rows.length} kayıt yüklendi; devamı mevcut.`,`${rows.length} registrations loaded; more available.`)
        :tr(`${rows.length} kayıt yüklendi.`,`${rows.length} registrations loaded.`);
   };
   const loadRemaining=async()=>{
    if(fetching)return;
    loadMore.disabled=loadAll.disabled=exportButton.disabled=true;
    try {
     // Bounded in-browser collection. Large reports require a dedicated background export.
     while(nextCursor && rows.length<20000)await fetchNext();
     if(nextCursor)showToast(tr('20.000 kayıt gösterildi. Daha büyük rapor için yöneticiye başvurun.','20,000 records loaded. Contact an administrator for larger exports.'),'info');
    }catch(error){fail(error);}
    finally{loadMore.disabled=loadAll.disabled=exportButton.disabled=false;paint();}
   };
   loadMore.onclick=async()=>{loadMore.disabled=true;try{await fetchNext();page=Math.ceil(rows.length/pageSize);paint();}catch(error){fail(error);}finally{loadMore.disabled=false;}};
   loadAll.onclick=loadRemaining;
   search.addEventListener('input',()=>{page=1;paint();});
   exportButton.onclick=async()=>{
    if(!await confirmDialog({title:tr('Kişisel verileri dışa aktar','Export personal data'),
      body:tr('Yetkili olduğun etkinlik kayıtları CSV olarak indirilecek.','The visible event registrations will be exported as CSV.')}))return;
    if(nextCursor)await loadRemaining();
    if(nextCursor){
        showToast(tr('CSV yalnızca yüklenen kayıtları içerir.','CSV contains only loaded registrations.'),'warning');
        return;
    }
    const escape=value=>{
     let text=String(value??'');
     if(/^[=+@-]/.test(text))text="'"+text;
     return '"'+text.replaceAll('"','""')+'"';
    };
    const output=[columns.map(([,trLabel,en])=>getLang()==='tr'?trLabel:en),
       ...visible().map(row=>columns.map(([key])=>value(row,key)))].map(row=>row.map(escape).join(',')).join('\r\n');
    const blob=new Blob(['\ufeff',output],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');anchor.href=url;
    anchor.download='event-registrations.csv';anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
   };
   paint();
  }catch(e){box.replaceChildren();fail(e);}
 };
 document.addEventListener('vertex:workspace',e=>{if(e.detail.keys.includes('events.list'))refresh().catch(fail);});
 fill(null);
}
