import { registerListRefresh } from '../ui/listRefresh.js';
import { deploymentCapabilities } from '../core/deployment-capabilities.js';
import { isPanelAdmin } from './roles.js';
import { showLoadError } from '../ui/states.js';
import { crossfade } from '../ui/transition.js';
import { confirmDialog } from './shell.js';
import { beginPanelLoading, setButtonLoading } from '../utils/loading.js';
// js/modules/news.js

import { db, auth, createNewsArticleFn, updateNewsArticleFn, listNewsRevisionsFn, restoreNewsRevisionFn, deleteNewsArticleFn, getCoverUploadUrlFn } from '../core/firebase.js';
import * as dom from '../utils/dom.js';
import { userErrorMessage, __, showToast, getLang, onLangChange, escapeHTML } from '../utils/ui.js';

let unsubscribeFromArticles = null;
let editingArticle=null;
let newsEpoch=0;

/**
 * Handles the submission of the news article creation form.
 * @param {Event} e - The form submission event.
 */
async function handleNewsFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    if(submitBtn.disabled)return;
    const epoch=newsEpoch,uid=auth?.currentUser?.uid,editing=editingArticle;
    setButtonLoading(submitBtn,true);
    submitBtn.textContent = __('news.publishing');

    const titleEN = document.getElementById('title-en').value;
    const cleanSlug = editing?.id || titleEN.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    if (!cleanSlug) {
        showToast(() => __('news.slug_invalid'), 'error');
        setButtonLoading(submitBtn,false);
        submitBtn.textContent = __('news.publish_btn');
        return;
    }

    const uploadImage = async (fileInputId, lang) => {
        const file = document.getElementById(fileInputId).files[0];
        if (!file) {
            if(editing?.cover?.[lang])return editing.cover[lang];
            throw new Error(__('news.cover_required'));
        }
        // Validate before requesting a signed upload URL. Never publish an article
        // pointing at an object if the actual storage PUT was rejected.
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            throw new Error(getLang() === 'tr' ? 'JPEG, PNG veya WebP görsel seçin.' : 'Choose a JPEG, PNG or WebP image.');
        }
        const result = await getCoverUploadUrlFn({ slug: cleanSlug, fileName: `${lang}-${file.name}`, contentType: file.type });
        const { signedUrl, filePath } = result?.data || {};
        if (typeof signedUrl !== 'string' || !signedUrl || typeof filePath !== 'string' || !filePath) {
            throw new Error(getLang() === 'tr' ? 'Görsel yükleme bağlantısı alınamadı.' : 'Could not obtain an image upload URL.');
        }
        const response = await fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        if (!response.ok) {
            throw new Error(getLang() === 'tr' ? 'Kapak görseli yüklenemedi.' : 'Cover image upload failed.');
        }
        return filePath;
    };

    try {
        showToast(() => __('news.uploading'), 'info');
        const [filePathTR, filePathEN] = await Promise.all([
            uploadImage('cover-image-tr', 'tr'),
            uploadImage('cover-image-en', 'en')
        ]);
        const articleData = {
            slug: cleanSlug,
            cover: { tr: filePathTR, en: filePathEN },
            tags: document.getElementById('tags').value.split(',').map(tag => tag.trim()).filter(Boolean),
            references: document.getElementById('references').value.split('\n').map(ref => ref.trim()).filter(Boolean),
            translations: {
                en: { title: titleEN, summary: document.getElementById('summary-en').value, content: document.getElementById('content-en').value },
                tr: { title: document.getElementById('title-tr').value, summary: document.getElementById('summary-tr').value, content: document.getElementById('content-tr').value }
            }
        };
        showToast(() => __('news.saving'), 'info');
        if(epoch!==newsEpoch||auth?.currentUser?.uid!==uid)return;
        if(editing) await updateNewsArticleFn({slug:editing.id,revision:editing.revision||0,article:articleData});
        else await createNewsArticleFn(articleData);
        if(epoch!==newsEpoch||auth?.currentUser?.uid!==uid)return;
        clearNewsEditor();
        showToast(() => __('news.saved'), 'success');
        dom.newsForm.reset();
    } catch (error) {
        console.error("[CLIENT] An error occurred during news submission:", error);
        showToast(()=>userErrorMessage(error), 'error');
    } finally {
        if(epoch!==newsEpoch||auth?.currentUser?.uid!==uid)return;
        setButtonLoading(submitBtn,false);
        submitBtn.textContent = __('news.publish_btn');
    }
}

/**
 * Handles the deletion of a news article.
 * @param {string} slug - The slug of the article to delete.
 */
async function handleDeleteArticle(slug) {
    if (!await confirmDialog(()=>({title:__('common.delete'),body:__('news.delete_confirm')}))) return;
    showToast(() => __('news.deleting'), 'info');
    try {
        const result = await deleteNewsArticleFn({ slug });
        showToast(() => __('news.deleted'), 'success');
    } catch (error) {
        console.error(`[CLIENT] Error deleting article ${slug}:`, error);
        showToast(() => userErrorMessage(error), 'error');
    }
}

/**
 * Attaches a real-time listener to the 'news' collection in Firestore.
 */
function renderArticles() {
    const container=dom.articlesListContainer, articles=window.loadedArticles||[];
    const canEdit=deploymentCapabilities.newsRevisions && isPanelAdmin();
    const formatDate=value=>{const d=value?.toDate?.() || (value?new Date(value):null);return d && Number.isFinite(d.getTime())?new Intl.DateTimeFormat(getLang()==='tr'?'tr-TR':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(d):'—';};
    const html=articles.length?articles.map(article=>{
        const translation=article.translations?.[getLang()] || article.translations?.en || article.translations?.tr || {};
        const title=translation.title || __('news.untitled');
        return `<article class="article-item news-card" data-news-slug="${escapeHTML(article.id)}" ${canEdit?'tabindex="0" role="group"':''} aria-label="${escapeHTML(title)}">
            <div class="news-card-heading"><span class="news-card-status">${getLang()==='tr'?'Yayında':'Published'}</span><time>${escapeHTML(formatDate(article.publishedAt))}</time></div>
            <h4>${escapeHTML(title)}</h4><p class="news-card-summary">${escapeHTML(translation.summary || (getLang()==='tr'?'Özet eklenmemiş.':'No summary added.'))}</p>
            <div class="news-card-tags">${(article.tags||[]).map(tag=>`<span>${escapeHTML(tag)}</span>`).join('')}</div>
            <div class="news-card-meta"><span>${escapeHTML(Object.keys(article.translations||{}).map(v=>v.toUpperCase()).join(' · '))}</span><span>${(article.references||[]).length} ${getLang()==='tr'?'kaynak':'references'}</span>${article.updatedAt?`<span>${getLang()==='tr'?'Güncellendi: ':'Updated: '}${escapeHTML(formatDate(article.updatedAt))}</span>`:''}</div>
            <div class="news-card-actions">${canEdit?`<button type="button" class="chrome-btn-outline news-edit-btn" data-slug="${escapeHTML(article.id)}">${getLang()==='tr'?'Düzenle':'Edit'}</button>`:''}${isPanelAdmin()?`<button type="button" class="chrome-btn-outline delete-btn" data-slug="${escapeHTML(article.id)}">${__('common.delete')}</button>`:''}</div>
        </article>`;
    }).join(''):`<p class="form-hint">${__('news.empty')}</p>`;
    crossfade(container,()=>{container.innerHTML=html;});
}
export function listenForArticles() {
    const finishLoading=beginPanelLoading(dom.articlesListContainer);
    if(unsubscribeFromArticles)unsubscribeFromArticles();
    let settle;
    const ready=new Promise(resolve=>{settle=resolve;});
    unsubscribeFromArticles=db.collection('news').orderBy('publishedAt','desc').onSnapshot(snapshot=>{
        window.loadedArticles=[];
        snapshot.forEach(doc=>window.loadedArticles.push({...doc.data(),id:doc.id}));
        renderArticles();finishLoading();settle();
    },error=>{
        finishLoading();settle();
        showLoadError(dom.articlesListContainer,()=>__('news.load_error'),listenForArticles,{staleSelector:'.article-item'});
    });
    return ready;
}

function clearNewsEditor(){
    editingArticle=null;
    const submit=document.getElementById('submit-btn');if(submit){setButtonLoading(submit,false);submit.textContent=__('news.publish_btn');}
    for(const id of ['news-editing-hint','news-history-trigger','news-history','news-edit-cancel'])document.getElementById(id)?.remove();
    for(const lang of ['tr','en']){const input=document.getElementById('cover-image-'+lang);if(input)input.required=true;}
}

async function showNewsHistory(slug){
 const epoch=newsEpoch;
 const root=document.getElementById('news-history')||document.createElement('div');
 root.id='news-history';root.className='ui-news-history';
 if(!root.parentElement)dom.newsForm.append(root);
 root.replaceChildren();
 const status=document.createElement('p');status.textContent=getLang()==='tr'?'Sürümler yükleniyor…':'Loading revisions…';
 root.append(status);
 try{
  const {data}=await listNewsRevisionsFn({slug});
  if(epoch!==newsEpoch||editingArticle?.id!==slug)return;
  root.replaceChildren();
  if(!data.revisions?.length){status.textContent=getLang()==='tr'?'Henüz önceki sürüm yok.':'No prior revisions.';root.append(status);return;}
  for(const revision of data.revisions){
   const row=document.createElement('div');row.className='ui-news-history-row';
   const label=document.createElement('span');const when=revision.at?new Date(revision.at).toLocaleString(getLang()==='tr'?'tr-TR':'en-US'):'—';
   label.textContent='#'+revision.revision+' · '+when+' · '+revision.title;
   const restore=document.createElement('button');restore.type='button';restore.className='chrome-btn-outline';
   restore.textContent=getLang()==='tr'?'Geri yükle':'Restore';
   restore.onclick=async()=>{
     if(!await confirmDialog({title:getLang()==='tr'?'Sürümü geri yükle':'Restore revision',
       body:label.textContent}))return;
     if(epoch!==newsEpoch||editingArticle?.id!==slug)return;
     restore.disabled=true;
     try{
       await restoreNewsRevisionFn({slug,historyId:revision.id,revision:editingArticle?.revision||0});
       showToast(getLang()==='tr'?'Sürüm geri yüklendi.':'Revision restored.','success');
       if(epoch!==newsEpoch)return;
       clearNewsEditor();dom.newsForm.reset();
     }catch(error){restore.disabled=false;showToast(()=>userErrorMessage(error),'error');}
   };
   row.append(label,restore);root.append(row);
  }
 }catch(error){root.replaceChildren();showToast(()=>userErrorMessage(error),'error');}
}
function editArticle(slug){
    const article=(window.loadedArticles||[]).find(a=>a.id===slug);
    if(!article||!deploymentCapabilities.newsRevisions||!isPanelAdmin())return;
    document.getElementById('submit-btn')?.blur();
    document.querySelector('[data-nav-panel="news.editor"]')?.click();
    if(document.getElementById('submit-btn')?.disabled)return;
    newsEpoch++;
    editingArticle=article;
    document.getElementById('submit-btn').textContent=__('common.save');
    document.getElementById('news-history')?.remove();
    for(const lang of ['en','tr']){
        for(const field of ['title','summary','content']){
            const input=document.getElementById(field+'-'+lang);
            if(input)input.value=article.translations?.[lang]?.[field]||'';
        }
        const file=document.getElementById('cover-image-'+lang);if(file){file.value='';file.required=false;}
    }
    document.getElementById('tags').value=(article.tags||[]).join(', ');
    document.getElementById('references').value=(article.references||[]).join('\n');
    let hint=document.getElementById('news-editing-hint');
    if(!hint){
      hint=document.createElement('p');hint.id='news-editing-hint';hint.className='form-hint';
      dom.newsForm.prepend(hint);
    }
    let cancel=document.getElementById('news-edit-cancel');
    if(!cancel){cancel=document.createElement('button');cancel.type='button';cancel.id='news-edit-cancel';cancel.className='chrome-btn-outline';dom.newsForm.prepend(cancel);}
    cancel.textContent=__('common.cancel');cancel.onclick=()=>{newsEpoch++;clearNewsEditor();dom.newsForm.reset();};
    hint.textContent=(getLang()==='tr'?'Düzenleniyor: ':'Editing: ')+slug;
    let history=document.getElementById('news-history-trigger');
    if(!history){
       history=document.createElement('button');history.type='button';history.id='news-history-trigger';
       history.className='chrome-btn-outline';dom.newsForm.insertBefore(history,dom.newsForm.firstChild);
    }
    history.textContent=getLang()==='tr'?'Sürüm geçmişi':'Revision history';
    history.onclick=()=>void showNewsHistory(slug);
    dom.newsForm.scrollIntoView({behavior:'smooth',block:'start'});
}


/**
 * Detaches the real-time listener for articles.
 */
export function stopListeningForArticles() {
    newsEpoch++;clearNewsEditor();window.loadedArticles=[];
    if (unsubscribeFromArticles) {
        unsubscribeFromArticles();
        unsubscribeFromArticles = null;
        console.log('[CLIENT] Unsubscribed from article listener.');
    }
}

/**
 * Initializes all event listeners for the news management module.
 */
export function initNewsModule() {
    registerListRefresh(dom.articlesListContainer,listenForArticles);
    onLangChange(()=>{const btn=document.getElementById('submit-btn');btn.textContent=__(btn.disabled?'news.publishing':editingArticle?'common.save':'news.publish_btn');if(unsubscribeFromArticles)renderArticles();});
    dom.articlesListContainer.addEventListener('keydown',e=>{if(e.target.matches('[data-news-slug]') && ['Enter',' '].includes(e.key)){e.preventDefault();editArticle(e.target.dataset.newsSlug);}});
    dom.newsForm.addEventListener('submit', handleNewsFormSubmit);
    dom.articlesListContainer.addEventListener('click', (e) => {
        const edit=e.target.closest('.news-edit-btn');
        if(edit){editArticle(edit.dataset.slug);return;}
        const remove=e.target.closest('.delete-btn');
        if (remove) {
            const slug = remove.dataset.slug;
            handleDeleteArticle(slug);return;
        }
        const card=e.target.closest('[data-news-slug]');
        if(card)editArticle(card.dataset.newsSlug);
    });
}