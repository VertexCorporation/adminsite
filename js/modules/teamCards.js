// Public website directory (siteTeam kind=card). The public homepage and
// this console now read/write the SAME collection and share fixed role codes.
import {
  auth, listSiteTeamFn, setSiteTeamEntryFn, deleteSiteTeamEntryFn,
  getWeeklyStarsFn, setWeeklyStarsFn, getVertexContributorsFn
} from '../core/firebase.js';
import {escapeHTML, showToast, userErrorMessage, __, getLang, onLangChange} from '../utils/ui.js';
import {icon} from '../utils/icons.js';
import {openDrawer, closeDrawer, confirmDialog} from './shell.js';
import {setButtonLoading} from '../utils/loading.js';
import {isoWeekInIstanbul} from '../utils/isoWeek.js';
import {showLoadError} from '../ui/states.js';

export const POSITIONS=Object.freeze(['CEO','CTO','COO','CFO','CMO','CDO','CHRO','CCO','CLO','CITO']);
let teamCards=[];
let cardsLoading=false;
let cardsLoaded=false;
const byId=id=>document.getElementById(id);
const SOCIAL_FIELDS=Object.freeze([['linkedin','LinkedIn'],['instagram','Instagram'],['x','X'],['email','Email'],['tiktok','TikTok']]);
const linksFor=card=>Object.fromEntries((card?.links||[]).map(link=>{
 let key=String(link.label||'').toLowerCase();
 if(key==='twitter')key='x';
 if(['mail','e-mail'].includes(key))key='email';
 return [key,key==='email'?String(link.url||'').replace(/^mailto:/i,''):link.url];
}));
const errorNotice=(error,retry)=>{
 const list=byId('team-cards-list');
 if(list)showLoadError(list,()=>userErrorMessage(error),retry,{staleSelector:'.team-list-row'});
};

export async function loadTeamCards(){
 const list=byId('team-cards-list');if(!list||cardsLoading)return;
 cardsLoading=true;
 const addBtn=byId('add-team-card-btn');
 if(addBtn&&!cardsLoaded)addBtn.disabled=true;
 list.setAttribute('aria-busy','true');
 try{
   const response=await listSiteTeamFn({manage:true});
   if(!Array.isArray(response.data?.cards))throw new Error('Invalid managed team directory response.');
   teamCards=response.data.cards;
   cardsLoaded=true;
   renderTeamCardsList();
 }catch(error){
   console.error('[TEAM_DIRECTORY] Could not load managed public cards',error);
   if(byId('team-cards-empty'))byId('team-cards-empty').hidden=true;
   errorNotice(error,loadTeamCards);
 }finally{cardsLoading=false;list.removeAttribute('aria-busy');}
 if(addBtn){addBtn.disabled=!cardsLoaded||teamCards.length>=10;addBtn.title=addBtn.disabled?__('team_cards.all_filled'):__('team_cards.add_btn');}
}
function renderTeamCardsList(){
 const list=byId('team-cards-list'),empty=byId('team-cards-empty');
 if(!list)return;
 if(empty)empty.hidden=!cardsLoaded||teamCards.length>0;
 list.className='team-list';
 list.innerHTML=teamCards.map(card=>{
   const title=card.titles?.[getLang()]||card.titles?.en||card.position;
   const preview=card.imageUrl?'<img src="'+escapeHTML(card.imageUrl)+'" alt="" loading="lazy">':icon('user',{size:18});
   return '<div class="team-list-row" data-id="'+escapeHTML(card.id)+'">'+
    '<div class="team-list-avatar">'+preview+'</div>'+
    '<div class="team-list-info"><div style="display:flex;align-items:center;gap:8px;">'+
    '<span class="team-list-name">'+escapeHTML(card.name)+'</span>'+
    '<span class="position-badge">'+escapeHTML(card.position)+'</span></div>'+
    '<span class="team-list-meta">'+escapeHTML(title)+'</span>'+
    '<span class="team-list-meta">'+(card.bio?.trim()?'Biyografi mevcut':'Biyografi yok — kart tıklanamaz')+'</span></div>'+
    '<div class="team-list-actions"><button class="icon-btn" type="button" data-edit-card="'+escapeHTML(card.id)+'" aria-label="'+__('common.edit')+'">'+icon('pencil',{size:16})+'</button>'+
    '<button class="icon-btn danger" type="button" data-del-card="'+escapeHTML(card.id)+'" aria-label="'+__('common.delete')+'">'+icon('trash',{size:16})+'</button></div></div>';
 }).join('');
 list.querySelectorAll('[data-edit-card]').forEach(btn=>btn.addEventListener('click',()=>{
   const card=teamCards.find(x=>x.id===btn.dataset.editCard);if(card)openTeamCardDrawer(card);
 }));
 list.querySelectorAll('[data-del-card]').forEach(btn=>btn.addEventListener('click',async()=>{
   const card=teamCards.find(x=>x.id===btn.dataset.delCard);if(!card)return;
   if(!await confirmDialog(()=>({
     title:__('team_cards.delete_confirm'),body:card.name+' ('+card.position+')',
     confirmLabel:__('common.delete'),danger:true
   })))return;
   setButtonLoading(btn,true);
   try{
     await deleteSiteTeamEntryFn({kind:'card',id:card.id});
     showToast(()=>__('team_cards.deleted'),'success');await loadTeamCards();
   }catch(error){showToast(()=>userErrorMessage(error),'error');}
   finally{setButtonLoading(btn,false);}
 }));
}
function readFile(file){
 return new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error);
   reader.readAsDataURL(file);
 });
}
export function openTeamCardDrawer(existing=null){
 const editing=!!existing,links=linksFor(existing);
 let pickedFile=null,saving=false;
 const body=openDrawer({
   title:editing?__('team_cards.drawer_edit_title'):__('team_cards.drawer_add_title'),
   footerHTML:'<button type="button" class="chrome-btn-outline" data-drawer-cancel>'+__('common.cancel')+'</button>'+
      '<button type="submit" form="team-card-form" class="chrome-btn-primary" data-drawer-submit>'+__('common.save')+'</button>'
 });
 const root=body.closest('.vx-drawer');
 root.querySelector('[data-drawer-cancel]').onclick=()=>closeDrawer();
 body.innerHTML='<form id="team-card-form" class="form-stack">'+
 '<div class="form-section"><label class="form-section-title" for="team-card-photo-input">'+__('team_cards.photo_label')+'</label>'+
 '<div style="display:flex;gap:16px;align-items:center"><div class="team-list-avatar" id="team-card-photo-preview" style="width:64px;height:64px;">'+
 (existing?.imageUrl?'<img src="'+escapeHTML(existing.imageUrl)+'" alt="">':icon('user',{size:25}))+'</div>'+
 '<input type="file" id="team-card-photo-input" accept="image/jpeg,image/png,image/webp" hidden aria-describedby="team-card-photo-hint">'+
 '<button type="button" id="team-card-choose-photo" class="chrome-btn-outline">'+icon('upload',{size:16})+' '+__('team_cards.photo_upload_btn')+'</button>'+
 '</div><small id="team-card-photo-hint">JPEG, PNG, WebP · maksimum 2 MB</small></div>'+
 '<div class="form-group-field"><label for="team-card-name">'+__('team_cards.name_label')+'</label>'+
 '<input type="text" id="team-card-name" required maxlength="60" value="'+escapeHTML(existing?.name||'')+'"></div>'+
 '<div class="form-group-field"><label for="team-card-position">'+__('team_cards.position_label')+'</label>'+
 '<select id="team-card-position" required><option value="" disabled '+(!editing?'selected':'')+'>'+__('team_cards.position_select')+'</option>'+
 POSITIONS.map(code=>{
   const occupier=teamCards.find(c=>c.position===code&&c.id!==existing?.id);
   return '<option value="'+code+'" '+(existing?.position===code?'selected':'')+' '+(occupier?'disabled':'')+'>'+
   code+(occupier?' ('+escapeHTML(occupier.name)+')':'')+'</option>';
 }).join('')+'</select></div>'+
 '<div class="form-group-field"><label for="team-card-bio">Biyografi (boşsa profil açılmaz)</label>'+
 '<textarea id="team-card-bio" rows="7" maxlength="6000" placeholder="Kişinin biyografisi; yeni paragraf için boş satır bırakın.">'+escapeHTML(existing?.bio||'')+'</textarea></div>'+
 '<div class="form-section"><div class="form-section-title">Bağlantılar</div>'+
 SOCIAL_FIELDS.map(([key,label])=>
 '<div class="form-group-field"><label for="team-card-'+key+'">'+(key==='email'?__('team_cards.email_label'):label)+'</label>'+
 '<input type="'+(key==='email'?'email':'url')+'" id="team-card-'+key+'" maxlength="2048" placeholder="'+(key==='email'?'name@vertexishere.com':'https://')+'" value="'+escapeHTML(links[key]||'')+'"></div>').join('')+
 '</div></form>';
 const fileInput=body.querySelector('#team-card-photo-input');
 body.querySelector('#team-card-choose-photo').addEventListener('click',()=>fileInput.click());
 fileInput.addEventListener('change',()=>{
   const file=fileInput.files?.[0];if(!file){pickedFile=null;return;}
   if(file.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){
     fileInput.value='';pickedFile=null;
     showToast(()=>__('team_cards.photo_size_error'),'error');return;
   }
   pickedFile=file;
   readFile(file).then(url=>{
     if(pickedFile===file)body.querySelector('#team-card-photo-preview').innerHTML='<img src="'+url+'" alt="">';
   }).catch(()=>showToast(()=>__('team_cards.photo_type_error'),'error'));
 });
 body.querySelector('#team-card-form').addEventListener('submit',async event=>{
   event.preventDefault();if(saving)return;
   const name=body.querySelector('#team-card-name').value.trim();
   const position=body.querySelector('#team-card-position').value;
   if(!name||!POSITIONS.includes(position))return;
   if(!pickedFile&&!existing?.imageUrl){showToast(()=>__('team_cards.photo_label'),'error');return;}
   saving=true;const submit=root.querySelector('[data-drawer-submit]');setButtonLoading(submit,true);
   try{
     let imageUrl=existing?.imageUrl||'';
     if(pickedFile){
       // Never write data: images into Firestore. The authorized backend
       // validates magic bytes and stores the immutable photo in Storage.
       const encoded=await readFile(pickedFile),data=encoded.split(',')[1];
       const uploaded=await setSiteTeamEntryFn({kind:'photo',imageData:data,contentType:pickedFile.type});
       imageUrl=uploaded.data.imageUrl;
     }
     const links=SOCIAL_FIELDS.flatMap(([key,label])=>{
       const value=body.querySelector('#team-card-'+key).value.trim();
       return value?[{label,url:key==='email'?'mailto:'+value:value}]:[];
     });
     await setSiteTeamEntryFn({kind:'card',id:existing?.id,name,position,
       imageUrl,links,bio:body.querySelector('#team-card-bio').value.trim()});
     closeDrawer();showToast(()=>__('team_cards.saved'),'success');
     await loadTeamCards();
   }catch(error){showToast(()=>userErrorMessage(error),'error');}
   finally{saving=false;setButtonLoading(submit,false);}
 });
}

/**
 * Haftanın Yıldızları (Weekly Stars) Bölümü Başlatıcı
 */
let weeklyCache=null;
let weeklyDirectory=[];
const starName=person=>typeof person==='string'?person:(person?.name||'');
const starId=person=>person&&typeof person==='object'?person.id:null;
export async function initWeeklyStarsPanel() {
    const container = document.getElementById('weekly-stars-container');
    if (!container) return;
    if(!weeklyCache)container.textContent=__('common.loading');
    container.setAttribute('aria-busy','true');
    try {
        const {data}=await getWeeklyStarsFn({});
        if(!data||!Array.isArray(data.history))throw new Error('Invalid weekly stars result');
        weeklyCache=data;
        let directoryError=null;
        try{
            const response=await getVertexContributorsFn({});
            if(!Array.isArray(response.data?.contributors))throw new Error('Invalid participant directory');
            weeklyDirectory=response.data.contributors.filter(person=>
                person&&typeof person.id==='string'&&person.name&&person.isVertex===true);
        }catch(error){directoryError=error;weeklyDirectory=[];}
        renderWeeklyStars(container,{...data,directory:weeklyDirectory,directoryError});
    } catch(err) {
        console.warn('[WEEKLY_STARS] Load failed:',err);
        if(weeklyCache)showToast(()=>userErrorMessage(err),'error');
        else showLoadError(container,()=>userErrorMessage(err),initWeeklyStarsPanel);
    }finally{container.removeAttribute('aria-busy');}
}

function renderWeeklyStars(container, starsData) {
    const {year: currentYear, weekNumber: currentWeekNumber} = isoWeekInIstanbul(new Date());

    const current = starsData.current;
    const history = Array.isArray(starsData.history) ? starsData.history : [];

    container.innerHTML = `
        <div class="form-stack">
            <form id="weekly-stars-form" class="form-stack">
                <div class="form-grid three-col">
                    <div class="form-group-field">
                        <label for="stars-week">${__('weekly_stars.week_label')}</label>
                        <input type="number" id="stars-week" min="1" max="53" value="${current?.weekNumber || currentWeekNumber}" required>
                    </div>
                    <div class="form-group-field">
                        <label for="stars-year">${__('weekly_stars.year_label')}</label>
                        <input type="number" id="stars-year" min="2024" max="2035" value="${current?.year || currentYear}" required>
                    </div>
                    <div class="form-group-field">
                        <label for="stars-title">${__('weekly_stars.title_label')}</label>
                        <input type="text" id="stars-title" value="${escapeHTML(current?.title || `Hafta ${currentWeekNumber}, ${currentYear}`)}">
                    </div>
                </div>

                <div class="form-group-field">
                    <label for="stars-person-search">${__('weekly_stars.contributors_label')}</label>
                    <div id="stars-selected" class="stars-selected" aria-live="polite"></div>
                    <div class="search-field">
                        ${icon('search',{size:16})}
                        <input type="search" id="stars-person-search" autocomplete="off"
                           placeholder="${getLang()==='tr'?'Katılımcı ara':'Search participants'}" 
                           aria-label="${__('weekly_stars.contributors_label')}">
                    </div>
                    <div id="stars-search-results" class="stars-search-results" role="listbox"></div>
                    ${starsData.directoryError?`<div class="state-block" role="alert">${getLang()==='tr'?'Katılımcı listesi yüklenemedi. Mevcut kayıtlar korunuyor.':'Could not load participants. Existing records are preserved.'}
                        <button type="button" class="chrome-btn-outline" id="stars-directory-retry">${__('common.retry')}</button></div>`:''}
                    <small class="form-hint">${getLang()==='tr'?'En fazla 5 aktif katılımcı. İsimler kalıcı kimlikleriyle ilişkilendirilir.':'Select up to 5 active participants using their permanent IDs.'}</small>
                </div>

                <div>
                    <button type="submit" class="chrome-btn-primary" id="save-weekly-stars-btn">
                        ${__('weekly_stars.save_btn')}
                    </button>
                </div>
            </form>

            <!-- Geçmiş Haftalar -->
            <div class="form-section" style="margin-top:20px;">
                <div class="form-section-title">${__('weekly_stars.history')}</div>
                ${!history.length
                    ? `<p class="state-block">${__('weekly_stars.no_history')}</p>`
                    : `<div class="team-list">${history.map(item => `
                        <div class="team-list-row">
                            <div class="team-list-info">
                                <span class="team-list-name">${escapeHTML(item.title || `Hafta ${item.weekNumber}, ${item.year}`)}</span>
                                <span class="team-list-meta">${escapeHTML((item.contributors || []).map(starName).join(', '))}</span>
                            </div>
                        </div>`).join('')}</div>`
                }
            </div>
        </div>
    `;

    const selected=Array.isArray(current?.contributors)?current.contributors.slice():[];
    const directory=starsData.directory||[];
    const selectedHost=container.querySelector('#stars-selected');
    const search=container.querySelector('#stars-person-search');
    const results=container.querySelector('#stars-search-results');
    const drawSelected=()=>{
        selectedHost.replaceChildren();
        if(!selected.length){
            const hint=document.createElement('span');
            hint.className='form-hint';
            hint.textContent=getLang()==='tr'?'Katılımcı seçilmedi.':'No participants selected.';
            selectedHost.append(hint);
        }
        selected.forEach((person,index)=>{
            const chip=document.createElement('span');
            chip.className='stars-person-chip';
            chip.append(document.createTextNode(starName(person)+(starId(person)?'':' (legacy)')));
            const button=document.createElement('button');
            button.type='button';button.textContent='×';
            button.setAttribute('aria-label',__('common.delete')+' '+starName(person));
            button.onclick=()=>{selected.splice(index,1);drawSelected();drawResults();};
            chip.append(button);selectedHost.append(chip);
        });
    };
    const drawResults=()=>{
        results.replaceChildren();
        const query=search.value.trim().toLocaleLowerCase(getLang()==='tr'?'tr-TR':'en-US');
        if(!query)return;
        const matches=directory.filter(person=>!selected.some(entry=>starId(entry)===person.id)&&
            (person.name+' '+(person.email||'')).toLocaleLowerCase(getLang()==='tr'?'tr-TR':'en-US').includes(query)).slice(0,20);
        matches.forEach(person=>{
            const button=document.createElement('button');
            button.type='button';button.className='stars-person-result';
            button.setAttribute('role','option');
            const name=document.createElement('strong');name.textContent=person.name;
            const detail=document.createElement('small');
            detail.textContent=person.email||person.department||person.id;
            button.append(name,detail);
            button.onclick=()=>{
                if(selected.length>=5){
                    showToast(()=>getLang()==='tr'?'En fazla 5 kişi seçilebilir.':'A maximum of 5 participants may be selected.','error');
                    return;
                }
                selected.push({id:person.id,name:person.name});
                search.value='';drawSelected();drawResults();
                search.focus({preventScroll:true});
            };
            results.append(button);
        });
        if(!matches.length){
            const empty=document.createElement('p');empty.className='form-hint';
            empty.textContent=getLang()==='tr'?'Eşleşen aktif katılımcı bulunamadı.':'No matching active participant.';
            results.append(empty);
        }
    };
    search.addEventListener('input',drawResults);
    drawSelected();
    const retryDirectory=container.querySelector('#stars-directory-retry');
    if(retryDirectory)retryDirectory.onclick=initWeeklyStarsPanel;
    if(starsData.directoryError)container.querySelector('#save-weekly-stars-btn').disabled=true;

    const form = container.querySelector('#weekly-stars-form');
    form.onsubmit = async e => {
        e.preventDefault();
        const week = parseInt(container.querySelector('#stars-week').value, 10);
        const year = parseInt(container.querySelector('#stars-year').value, 10);
        const title = container.querySelector('#stars-title').value.trim();
        const contributors = selected.slice();

        const saveBtn = container.querySelector('#save-weekly-stars-btn');
        setButtonLoading(saveBtn, true);

        try {
            await setWeeklyStarsFn({
                weekNumber: week,
                year,
                title,
                contributors
            });
            showToast(() => __('weekly_stars.saved'), 'success');
            await initWeeklyStarsPanel();
        } catch (err) {
            showToast(() => userErrorMessage(err), 'error');
        } finally {
            setButtonLoading(saveBtn, false);
        }
    };
}

/**
 * Ekip Yönetim panelinin genel başlatıcısı
 */
export function initTeamCardsPanel() {
    const addBtn=document.getElementById('add-team-card-btn');
    if(addBtn)addBtn.onclick=()=>openTeamCardDrawer(null);
    // Live data is requested only after Core authorization and workspace navigation.
    if (auth.currentUser) void loadTeamCards().catch(()=>{});
    document.addEventListener('vertex:workspace',event=>{
        if(auth.currentUser&&event.detail?.keys?.includes('system.teamLog'))
            void initWeeklyStarsPanel();
    });
    auth.onAuthStateChanged(user=>{
        if(user)return;
        weeklyCache=null;weeklyDirectory=[];cardsLoaded=false;teamCards=[];
        document.getElementById('weekly-stars-container')?.replaceChildren();
        document.getElementById('team-cards-list')?.replaceChildren();
    });
    onLangChange(()=>renderTeamCardsList());
}
