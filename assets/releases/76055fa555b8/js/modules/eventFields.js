// Structured editors keep existing data, including unknown metadata, when rows change.
export function mountEventFields(form, translate) {
 const labels={speakers:[['name','Ad','Name'],['role','Görev','Role'],['role_en','İngilizce görev','English role'],['img','Görsel URL','Image URL']],ticketCategories:[['name','Kategori','Category'],['price','Fiyat','Price'],['description','Avantajlar','Benefits'],['currency','Para birimi','Currency'],['stripeLink','Stripe bağlantısı','Stripe link'],['salesStatus','Satış (open/closed/sold_out)','Sales (open/closed/sold_out)']]};
 const refreshers=[];
 for(const [key,columns] of Object.entries(labels)){
  const source=form.elements[key];source.hidden=true;source.previousElementSibling.textContent=translate(key==='speakers'?'Konuşmacılar':'Bilet kategorileri',key==='speakers'?'Speakers':'Ticket categories');
  const box=document.createElement('div');box.className='event-rows';source.after(box);
  const add=document.createElement('button');add.type='button';add.className='chrome-btn-outline';add.textContent=translate('Ekle','Add');box.after(add);
  const read=()=>JSON.parse(source.value||'[]');
  const paint=()=>{box.replaceChildren();read().forEach((row,index)=>{
   const card=document.createElement('fieldset');card.className='form-grid two-col';
   for(const [field,tr,en] of columns){const label=document.createElement('label');label.className='form-group-field';label.textContent=translate(tr,en);const input=document.createElement('input');input.type=field==='price'?'number':'text';if(field==='price'){input.min='0';input.step='0.01';}input.value=row[field]??'';input.oninput=()=>{const rows=read();rows[index][field]=field==='price'?Number(input.value):input.value;source.value=JSON.stringify(rows);};label.append(input);card.append(label);}
   const remove=document.createElement('button');remove.type='button';remove.className='chrome-btn-outline';remove.textContent=translate('Kaldır','Remove');remove.onclick=()=>{source.value=JSON.stringify(read().filter((_,i)=>i!==index));paint();};card.append(remove);box.append(card);
  });};
  add.onclick=()=>{source.value=JSON.stringify([...read(),key==='ticketCategories'?{name:'',price:0,currency:'TRY',salesStatus:'open'}:{name:'',role:'',img:''}]);paint();};refreshers.push(paint);
 }
 const source=form.elements.translations;source.hidden=true;source.previousElementSibling.textContent=translate('Dil bazında içerik','Content by language');
 const box=document.createElement('div');box.className='form-grid';source.after(box);
 const select=document.createElement('select');select.setAttribute('aria-label',translate('İçerik dili','Content language'));
 for(const lang of ['tr','en','de','fr','es','it','pt','nl','id','ru','ja','ko','zh','hi','ar','az']){const option=document.createElement('option');option.value=lang;option.textContent=lang.toUpperCase();select.append(option);}box.append(select);
 const controls={};for(const [key,tr,en] of [['title','Başlık','Title'],['desc','Açıklama','Description'],['detailDesc','Detaylı içerik','Content'],['location','Konum','Location']]){const label=document.createElement('label');label.className='form-group-field';label.textContent=translate(tr,en);const input=document.createElement(key==='title'||key==='location'?'input':'textarea');input.oninput=()=>{const translations=JSON.parse(source.value||'{}');translations[select.value]={...translations[select.value],[key]:input.value};source.value=JSON.stringify(translations);};controls[key]=input;label.append(input);box.append(label);}
 const paint=()=>{const t=JSON.parse(source.value||'{}')[select.value]||{};for(const [key,input]of Object.entries(controls))input.value=t[key]||'';};select.onchange=paint;refreshers.push(paint);
 return ()=>refreshers.forEach(refresh=>refresh());
}
