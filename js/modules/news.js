import { crossfade } from '../ui/transition.js';
import { confirmDialog } from './shell.js';
import { beginPanelLoading, setButtonLoading } from '../utils/loading.js';
// js/modules/news.js

import { db, createNewsArticleFn, deleteNewsArticleFn, getCoverUploadUrlFn } from '../core/firebase.js';
import * as dom from '../utils/dom.js';
import { userErrorMessage, __, showToast, getLang, onLangChange, escapeHTML } from '../utils/ui.js';

let unsubscribeFromArticles = null;

/**
 * Handles the submission of the news article creation form.
 * @param {Event} e - The form submission event.
 */
async function handleNewsFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    if(submitBtn.disabled)return;
    setButtonLoading(submitBtn,true);
    submitBtn.textContent = __('news.publishing');

    const titleEN = document.getElementById('title-en').value;
    const cleanSlug = titleEN.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    if (!cleanSlug) {
        showToast(() => __('news.slug_invalid'), 'error');
        setButtonLoading(submitBtn,false);
        submitBtn.textContent = __('news.publish_btn');
        return;
    }

    const uploadImage = async (fileInputId, lang) => {
        const file = document.getElementById(fileInputId).files[0];
        if (!file) throw new Error(__('news.cover_required'));
        const result = await getCoverUploadUrlFn({ slug: cleanSlug, fileName: `${lang}-${file.name}`, contentType: file.type });
        await fetch(result.data.signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
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
        const result = await createNewsArticleFn(articleData);
        showToast(() => __('news.saved'), 'success');
        dom.newsForm.reset();
    } catch (error) {
        console.error("[CLIENT] An error occurred during news submission:", error);
        showToast(()=>userErrorMessage(error), 'error');
    } finally {
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
export function listenForArticles() {
    const finishLoading = beginPanelLoading(dom.articlesListContainer);
    if (unsubscribeFromArticles) unsubscribeFromArticles(); 

    console.log("[CLIENT] Attaching real-time listener for 'news' collection.");
    unsubscribeFromArticles = db.collection('news').orderBy('publishedAt', 'desc').onSnapshot(snapshot => {
        finishLoading();
        const container = dom.articlesListContainer;
        if (snapshot.empty) {
            window.loadedArticles = [];
            crossfade(container, () => { container.innerHTML = `<p class="form-hint" data-i18n="news.empty">${__('news.empty')}</p>`; });
            return;
        }
        const articles = [];
        const fragment=document.createDocumentFragment();
        snapshot.forEach(doc => {
            articles.push({ id: doc.id, ...doc.data() });
            const item = document.createElement('div');
            item.className = 'article-item';
            item.innerHTML = `
                <div class="item-details">
                    <span class="item-title">${escapeHTML(doc.data().translations?.[getLang()]?.title || __('news.untitled'))}</span>
                </div>
                <div class="item-actions">
                    <button class="delete-btn" data-slug="${escapeHTML(doc.id)}">${__('common.delete')}</button>
                </div>`;
            fragment.appendChild(item);
        });
        crossfade(container, () => container.replaceChildren(fragment));
        window.loadedArticles = articles;
    }, error => {
        finishLoading();
        console.error("[CLIENT] Error listening for article updates:", error);
        showToast(() => __('news.load_error'), 'error');
    });
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
    onLangChange(()=>{const btn=document.getElementById('submit-btn');btn.textContent=__(btn.disabled?'news.publishing':'news.publish_btn');if(unsubscribeFromArticles)listenForArticles();});
    dom.newsForm.addEventListener('submit', handleNewsFormSubmit);
    dom.articlesListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const slug = e.target.getAttribute('data-slug');
            handleDeleteArticle(slug);
        }
    });
}