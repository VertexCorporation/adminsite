import { confirmDialog } from './shell.js';
import { beginPanelLoading } from '../utils/loading.js';
// js/modules/news.js

import { db, createNewsArticleFn, updateNewsArticleFn, listNewsRevisionsFn, restoreNewsRevisionFn, deleteNewsArticleFn, getCoverUploadUrlFn } from '../core/firebase.js';
import * as dom from '../utils/dom.js';
import { userErrorMessage, __, showToast, getLang, onLangChange, escapeHTML } from '../utils/ui.js';

let unsubscribeFromArticles = null;
let editingArticle = null;
let articleSearch = '';

/**
 * Handles the submission of the news article creation form.
 * @param {Event} e - The form submission event.
 */
async function handleNewsFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    if(submitBtn.disabled)return;
    submitBtn.disabled = true;
    submitBtn.textContent = __('news.publishing');

    const titleEN = document.getElementById('title-en').value;
    const cleanSlug = editingArticle?.id || titleEN.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    if (!cleanSlug) {
        showToast(() => __('news.slug_invalid'), 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = __('news.publish_btn');
        return;
    }

    const uploadImage = async (fileInputId, lang) => {
        const file = document.getElementById(fileInputId).files[0];
        if (!file) {
            if(editingArticle?.cover?.[lang])return editingArticle.cover[lang];
            throw new Error(__('news.cover_required'));
        }
        const result = await getCoverUploadUrlFn({ slug: cleanSlug, fileName: `${lang}-${file.name}`, contentType: file.type });
        if(!['image/jpeg','image/png','image/webp'].includes(file.type))
            throw new Error(getLang()==='tr'?'JPEG, PNG veya WebP kullanın.':'Use JPEG, PNG or WebP.');
        const response=await fetch(result.data.signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        if(!response.ok) throw new Error(getLang()==='tr'?'Kapak görseli yüklenemedi.':'Cover image upload failed.');
        return result.data.filePath;
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
        if(editingArticle) {
            await updateNewsArticleFn({slug:editingArticle.id,revision:editingArticle.revision||0,article:articleData});
            editingArticle=null;
        } else await createNewsArticleFn(articleData);
        showToast(() => __('news.saved'), 'success');
        dom.newsForm.reset();
        const hint=document.getElementById('news-editing-hint');if(hint)hint.textContent='';
        const trigger=document.getElementById('news-history-trigger');if(trigger)trigger.remove();
        document.getElementById('news-history')?.remove();
    } catch (error) {
        console.error("[CLIENT] An error occurred during news submission:", error);
        showToast(()=>userErrorMessage(error), 'error');
    } finally {
        submitBtn.disabled = false;
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
export function listenForArticles() {
    const finishLoading = beginPanelLoading(dom.articlesListContainer);
    if (unsubscribeFromArticles) unsubscribeFromArticles(); 

    console.log("[CLIENT] Attaching real-time listener for 'news' collection.");
    unsubscribeFromArticles = db.collection('news').orderBy('publishedAt', 'desc').onSnapshot(snapshot => {
        finishLoading();
        dom.articlesListContainer.innerHTML = '';
        if (snapshot.empty) {
            window.loadedArticles = [];
            renderArticleList();
            return;
        }
        const articles = snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
        window.loadedArticles = articles;
        renderArticleList();
    }, error => {
        finishLoading();
        console.error("[CLIENT] Error listening for article updates:", error);
        showToast(() => __('news.load_error'), 'error');
    });
}

function renderArticleList(){
    const root=dom.articlesListContainer;
    const all=window.loadedArticles||[];
    let toolbar=document.getElementById('news-search');
    if(!toolbar){
       toolbar=document.createElement('input');toolbar.id='news-search';
       toolbar.type='search';toolbar.className='search-input-field';
       toolbar.placeholder=getLang()==='tr'?'Haberlerde ara':'Search articles';
       toolbar.addEventListener('input',()=>{articleSearch=toolbar.value.trim().toLocaleLowerCase();renderArticleList();});
    }
    toolbar.value=articleSearch;
    if(toolbar.parentElement!==root.parentElement)root.parentElement.insertBefore(toolbar,root);
    root.replaceChildren();
    const articles=all.filter(a=>[a.id,a.translations?.en?.title,a.translations?.tr?.title,...(a.tags||[])]
      .some(x=>String(x||'').toLocaleLowerCase().includes(articleSearch)));
    if(!articles.length){
       const empty=document.createElement('p');empty.className='form-hint';
       empty.textContent=getLang()==='tr'?'Eşleşen haber yok.':'No matching articles.';
       root.append(empty);return;
    }
    for(const article of articles){
       const item=document.createElement('div');item.className='article-item';
       const details=document.createElement('div');details.className='item-details';
       const name=document.createElement('strong');name.className='item-title';
       name.textContent=article.translations?.[getLang()]?.title||article.translations?.en?.title||article.id;
       details.append(name);
       const meta=document.createElement('span');meta.className='form-hint';
       const date=article.publishedAt?.toDate?.()||new Date(article.publishedAt||0);
       meta.textContent=(Number.isFinite(date.getTime())?date.toLocaleDateString(getLang()==='tr'?'tr-TR':'en-US'):'')+' · '+(article.tags||[]).join(', ');
       details.append(meta);item.append(details);
       const actions=document.createElement('div');actions.className='item-actions';
       for(const [action,label] of [['edit',getLang()==='tr'?'Düzenle':'Edit'],['delete',__('common.delete')]]){
          const button=document.createElement('button');button.type='button';button.className=action==='delete'?'delete-btn':'chrome-btn-outline';
          button.dataset.slug=article.id;button.dataset.action=action;button.textContent=label;actions.append(button);
       }item.append(actions);root.append(item);
    }
}
async function showNewsHistory(slug){
 const root=document.getElementById('news-history')||document.createElement('div');
 root.id='news-history';root.className='ui-news-history';
 if(!root.parentElement)dom.newsForm.append(root);
 root.replaceChildren();
 const status=document.createElement('p');status.textContent=getLang()==='tr'?'Sürümler yükleniyor…':'Loading revisions…';
 root.append(status);
 try{
  const {data}=await listNewsRevisionsFn({slug});
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
     restore.disabled=true;
     try{
       await restoreNewsRevisionFn({slug,historyId:revision.id,revision:editingArticle?.revision||0});
       showToast(getLang()==='tr'?'Sürüm geri yüklendi.':'Revision restored.','success');
       editingArticle=null;dom.newsForm.reset();root.replaceChildren();
       document.getElementById('news-editing-hint').textContent='';
     }catch(error){restore.disabled=false;showToast(()=>userErrorMessage(error),'error');}
   };
   row.append(label,restore);root.append(row);
  }
 }catch(error){root.replaceChildren();showToast(()=>userErrorMessage(error),'error');}
}
function editArticle(slug){
    const article=(window.loadedArticles||[]).find(a=>a.id===slug);
    if(!article)return;
    editingArticle=article;
    for(const lang of ['en','tr']){
        for(const field of ['title','summary','content']){
            const input=document.getElementById(field+'-'+lang);
            if(input)input.value=article.translations?.[lang]?.[field]||'';
        }
        const file=document.getElementById('cover-image-'+lang);if(file)file.value='';
    }
    document.getElementById('tags').value=(article.tags||[]).join(', ');
    document.getElementById('references').value=(article.references||[]).join('\n');
    let hint=document.getElementById('news-editing-hint');
    if(!hint){
      hint=document.createElement('p');hint.id='news-editing-hint';hint.className='form-hint';
      dom.newsForm.prepend(hint);
    }
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
    onLangChange(()=>{const btn=document.getElementById('submit-btn');btn.textContent=__(btn.disabled?'news.publishing':'news.publish_btn');renderArticleList();});
    dom.newsForm.addEventListener('submit', handleNewsFormSubmit);
    dom.articlesListContainer.addEventListener('click', (e) => {
        const button=e.target.closest('[data-action]');
        if(!button)return;
        const slug=button.dataset.slug;
        if(button.dataset.action==='delete')void handleDeleteArticle(slug);
        if(button.dataset.action==='edit')editArticle(slug);
    });
}