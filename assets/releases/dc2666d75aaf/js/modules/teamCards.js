// Public website directory (siteTeam kind=card). The public homepage and
// this console now read/write the SAME collection and share fixed role codes.
import {
  auth, listSiteTeamFn, setSiteTeamEntryFn, deleteSiteTeamEntryFn,
  getWeeklyStarsFn, setWeeklyStarsFn
} from '../core/firebase.js';
import {escapeHTML, showToast, userErrorMessage, __, getLang, onLangChange} from '../utils/ui.js';
import {icon} from '../utils/icons.js';
import {openDrawer, closeDrawer, confirmDialog} from './shell.js';
import {setButtonLoading} from '../utils/loading.js';
import {isoWeek} from '../utils/isoWeek.js';

export const POSITIONS=Object.freeze(['CEO','CTO','COO','CFO','CMO','CDO','CHRO','CCO','CLO','CITO']);
let teamCards=[];
let cardsLoading=false;
const byId=id=>document.getElementById(id);
const linksFor=card=>Object.fromEntries((card?.links||[]).map(link=>[String(link.label||'').toLowerCase(),link.url]));
const errorNotice=(msg)=>{const list=byId('team-cards-list');if(list)list.textContent=msg;};

export async function loadTeamCards(){
 const list=byId('team-cards-list');if(!list||cardsLoading)return;
 cardsLoading=true;
 try{
   const response=await listSiteTeamFn({manage:true});
   teamCards=Array.isArray(response.data?.cards)?response.data.cards:[];
   renderTeamCardsList();
 }catch(error){
   console.error('[TEAM_DIRECTORY] Could not load managed public cards',error);
   errorNotice(userErrorMessage(error));
   throw error;
 }finally{cardsLoading=false;}
 const addBtn=byId('add-team-card-btn');
 if(addBtn){addBtn.disabled=teamCards.length>=10;addBtn.title=addBtn.disabled?__('team_cards.all_filled'):__('team_cards.add_btn');}
}
function renderTeamCardsList(){
 const list=byId('team-cards-list'),empty=byId('team-cards-empty');
 if(!list)return;
 if(empty)empty.hidden=teamCards.length>0;
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
 [['linkedin','LinkedIn'],['instagram','Instagram'],['website','Website']].map(([key,label])=>
 '<div class="form-group-field"><label for="team-card-'+key+'">'+label+'</label>'+
 '<input type="url" id="team-card-'+key+'" placeholder="https://" value="'+escapeHTML(links[key]||'')+'"></div>').join('')+
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
     const links=[['linkedin','LinkedIn'],['instagram','Instagram'],['website','Website']]
       .map(([key,label])=>({label,url:body.querySelector('#team-card-'+key).value.trim()})).filter(link=>link.url);
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
export async function initWeeklyStarsPanel() {
    const container = document.getElementById('weekly-stars-container');
    if (!container) return;

    try {
        const { data } = await getWeeklyStarsFn({});
        renderWeeklyStars(container, data || { current: null, history: [] });
    } catch (err) {
        console.warn('[WEEKLY_STARS] Error loading weekly stars:', err);
        renderWeeklyStars(container, { current: null, history: [] });
    }
}

function renderWeeklyStars(container, starsData) {
    const {year: currentYear, weekNumber: currentWeekNumber} = isoWeek(new Date());

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
                    <label for="stars-contributors">${__('weekly_stars.contributors_label')}</label>
                    <input type="text" id="stars-contributors" placeholder="Deniz Örnek, Ayşe Demir" value="${escapeHTML((current?.contributors || []).join(', '))}">
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
                                <span class="team-list-meta">${escapeHTML((item.contributors || []).join(', '))}</span>
                            </div>
                        </div>`).join('')}</div>`
                }
            </div>
        </div>
    `;

    const form = container.querySelector('#weekly-stars-form');
    form.onsubmit = async e => {
        e.preventDefault();
        const week = parseInt(container.querySelector('#stars-week').value, 10);
        const year = parseInt(container.querySelector('#stars-year').value, 10);
        const title = container.querySelector('#stars-title').value.trim();
        const contribRaw = container.querySelector('#stars-contributors').value;
        const contributors = contribRaw.split(',').map(s => s.trim()).filter(Boolean);

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
    const addBtn = document.getElementById('add-team-card-btn');
    if (addBtn) {
        addBtn.onclick = () => openTeamCardDrawer(null);
    }
    // Managed reads require an authenticated Core session. main.js loads this
    // workspace when the authorized user navigates to it.
    if (auth.currentUser) void loadTeamCards().catch(()=>{});
    // Biographies are edited in each executive's card drawer.
    initWeeklyStarsPanel();
    onLangChange(() => {
        renderTeamCardsList();
    });
}
