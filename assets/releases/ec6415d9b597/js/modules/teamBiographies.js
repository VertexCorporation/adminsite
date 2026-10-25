import {getLang, escapeHTML, showToast, userErrorMessage} from '../utils/ui.js';
import {translateTeamBiographyFn} from '../core/firebase.js';
import {setButtonLoading} from '../utils/loading.js';

// Keep in sync with vertexite's 16 public routes. Identity and roles are not translated here.
export const BIO_LANGUAGES=Object.freeze([
 ['tr','Türkçe'],['en','English'],['de','Deutsch'],['fr','Français'],
 ['es','Español'],['it','Italiano'],['pt','Português'],['nl','Nederlands'],
 ['ru','Русский'],['ar','العربية'],['hi','हिन्दी'],['id','Bahasa Indonesia'],
 ['ja','日本語'],['ko','한국어'],['zh','中文'],['az','Azərbaycanca']
]);
const text=(tr,en)=>getLang()==='tr'?tr:en;
const supported=code=>BIO_LANGUAGES.some(([lang])=>lang===code);

export function mountBiographyEditor(host,card={}){
 // Old bios have no language tag. Ask the editor to assign a language instead
 // of silently treating an English legacy biography as Turkish (or vice versa).
 const unassigned=typeof card.bio==='string'&&card.bio.trim()&&!supported(card.bioSourceLang)&&
   !BIO_LANGUAGES.some(([lang])=>typeof card.biographies?.[lang]==='string'&&card.biographies[lang].trim());
 const source=unassigned?'':supported(card.bioSourceLang)?card.bioSourceLang:'tr';
 let legacyPending=!!unassigned;
 const initial=Object.fromEntries(BIO_LANGUAGES.map(([lang])=>[lang,
   typeof card.biographies?.[lang]==='string'?card.biographies[lang]:lang===source&&typeof card.bio==='string'?card.bio:'']));
 let translating=false;
 host.innerHTML='<div class="form-section-title">'+text('Biyografiler','Biographies')+'</div>'+
 '<p class="form-hint">'+text('16 dilde biyografi düzenleyin. İsim, bağlantılar ve rol tüm dillerde ortak kalır. Boş biyografiler kaynak dile geri döner.','Edit biographies in 16 languages. Name, links and role are shared across languages. Empty biographies fall back to the source language.')+'</p>'+
 '<div class="form-grid"><div class="form-group-field"><label for="team-bio-source">'+text('Kaynak dil','Source language')+'</label>'+
 '<select id="team-bio-source" required>'+(unassigned?'<option value="" selected disabled>'+text('Eski biyografinin dilini seçin','Choose the legacy biography language')+'</option>':'')+BIO_LANGUAGES.map(([lang,name])=>'<option value="'+lang+'" '+(lang===source?'selected':'')+'>'+name+'</option>').join('')+'</select></div>'+
 '<div class="form-group-field"><label for="team-bio-language">'+text('Düzenlenecek dil','Editing language')+'</label>'+
 '<select id="team-bio-language" '+(unassigned?'disabled':'')+'>'+BIO_LANGUAGES.map(([lang,name])=>'<option value="'+lang+'" '+(lang===source?'selected':'')+'>'+name+'</option>').join('')+'</select></div></div>'+
 '<div class="form-group-field"><label for="team-bio-overwrite"><input type="checkbox" id="team-bio-overwrite"> '+text('Mevcut çevirileri de yenile','Replace existing translations too')+'</label></div>'+
 '<button type="button" class="chrome-btn-outline" id="team-bio-translate">'+text('Google ile diğer dillere çevir','Translate other languages with Google')+'</button>'+
 '<p class="form-hint" role="status" aria-live="polite" id="team-bio-status"></p>'+
 (unassigned?'<div class="form-group-field" id="team-bio-legacy-panel"><label for="team-bio-legacy">'+text('Mevcut biyografi · önce dilini seçin','Existing biography · choose its language first')+'</label><textarea id="team-bio-legacy" rows="9" maxlength="6000" dir="auto">'+escapeHTML(card.bio)+'</textarea></div>':'')+
 BIO_LANGUAGES.map(([lang,name])=>'<div class="form-group-field" data-bio-panel="'+lang+'" '+(lang!==source?'hidden':'')+'><label for="team-card-bio-'+lang+'">'+text('Biyografi','Biography')+' · '+name+'</label>'+
 '<textarea id="team-card-bio-'+lang+'" data-bio-lang="'+lang+'" lang="'+lang+'" dir="'+(lang==='ar'?'rtl':'auto')+'" rows="9" maxlength="6000">'+escapeHTML(initial[lang])+'</textarea></div>').join('')+
 '<small class="form-hint">'+text('Çevirileri kontrol edip Kaydet’e basın. Çeviri işlemi tek başına yayınlamaz.','Review the translations and press Save. Translating does not publish changes.')+'</small>';
 const field=lang=>host.querySelector('[data-bio-lang="'+lang+'"]');
 const sourceSelect=host.querySelector('#team-bio-source');
 const languageSelect=host.querySelector('#team-bio-language');
 const button=host.querySelector('#team-bio-translate');
 const status=host.querySelector('#team-bio-status');
 const draw=()=>{
   host.querySelectorAll('[data-bio-panel]').forEach(panel=>{panel.hidden=legacyPending||panel.dataset.bioPanel!==languageSelect.value;});
   [...languageSelect.options].forEach(option=>{
     const name=BIO_LANGUAGES.find(([lang])=>lang===option.value)[1];
     option.textContent=name+(field(option.value).value.trim()?' ✓':'');
   });
 };
 languageSelect.addEventListener('change',draw);
 sourceSelect.addEventListener('change',()=>{
   if(legacyPending){
     field(sourceSelect.value).value=host.querySelector('#team-bio-legacy').value;
     host.querySelector('#team-bio-legacy-panel').hidden=true;
     legacyPending=false;languageSelect.disabled=false;languageSelect.value=sourceSelect.value;draw();
   }
 });
 host.addEventListener('input',draw);
 button.addEventListener('click',async()=>{
   if(translating)return;
   if(!supported(sourceSelect.value)){sourceSelect.reportValidity();return;}
   const sourceLang=sourceSelect.value,sourceText=field(sourceLang).value.trim();
   if(!sourceText){languageSelect.value=sourceLang;draw();field(sourceLang).focus();showToast(()=>text('Önce kaynak dilde biyografi yazın.','Enter a biography in the source language first.'),'error');return;}
   const overwrite=host.querySelector('#team-bio-overwrite').checked;
   const targets=BIO_LANGUAGES.map(([lang])=>lang).filter(lang=>lang!==sourceLang&&(overwrite||!field(lang).value.trim()));
   if(!targets.length){status.textContent=text('Tüm diller dolu.','All languages are filled.');return;}
   const before=Object.fromEntries(targets.map(lang=>[lang,field(lang).value]));
   translating=true;setButtonLoading(button,true);status.textContent=text('Çevriliyor…','Translating…');
   try{
     const {data}=await translateTeamBiographyFn({text:sourceText,sourceLang,targetLangs:targets});
     if(!data?.translations||typeof data.translations!=='object')throw new Error('Invalid translation response');
     if(!host.isConnected)return;
     if(sourceSelect.value!==sourceLang||field(sourceLang).value.trim()!==sourceText){status.textContent=text('Kaynak değişti. Çeviriyi yeniden başlatın.','The source changed. Run translation again.');return;}
     let applied=0;
     for(const lang of targets){
       const value=data.translations[lang];
       // Never overwrite edits made while the request was in flight.
       if(field(lang).value===before[lang]&&typeof value==='string'&&value.trim()&&value.length<=6000){field(lang).value=value.trim();applied++;}
     }
     draw();status.textContent=getLang()==='tr'?applied+'/'+targets.length+' çeviri eklendi. Kontrol edip kaydedin.':applied+'/'+targets.length+' translations added. Review and save.';
   }catch(error){
     status.textContent=text('Çeviri tamamlanamadı. Yazdığınız metinler korundu.','Translation failed. Your draft text is preserved.');
     showToast(()=>userErrorMessage(error),'error');
   }finally{translating=false;setButtonLoading(button,false);}
 });
 draw();
 return {
   get busy(){return translating;},
   read(){return {bioSourceLang:sourceSelect.value,biographies:Object.fromEntries(BIO_LANGUAGES.map(([lang])=>[lang,field(lang).value.trim()])),bio:field(sourceSelect.value).value.trim()};}
 };
}
