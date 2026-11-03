// A small accessible pagination control shared by management lists.
export function renderPager(container,{page,total,pageSize=25,onChange,language='en'}){
 const pages=Math.max(1,Math.ceil(total/pageSize));
 const nav=document.createElement('nav');nav.className='ui-pager';
 nav.setAttribute('aria-label',language==='tr'?'Sayfalama':'Pagination');
 const button=(label,next,disabled)=>{
   const element=document.createElement('button');element.type='button';
   element.className='chrome-btn-outline';element.textContent=label;element.disabled=disabled;
   element.onclick=()=>onChange(next);return element;
 };
 nav.append(button(language==='tr'?'Önceki':'Previous',page-1,page<=1));
 const status=document.createElement('span');status.className='form-hint';
 status.textContent=page+' / '+pages+' · '+total;status.setAttribute('aria-live','polite');
 nav.append(status);
 nav.append(button(language==='tr'?'Sonraki':'Next',page+1,page>=pages));
 container.append(nav);return nav;
}
