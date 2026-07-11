// js/modules/news.js

import { db, createNewsArticleFn, deleteNewsArticleFn, getCoverUploadUrlFn } from '../core/firebase.js';
import * as dom from '../utils/dom.js';
import { showToast } from '../utils/ui.js';

let unsubscribeFromArticles = null;

/**
 * Handles the submission of the news article creation form.
 * @param {Event} e - The form submission event.
 */
async function handleNewsFormSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'PUBLISHING';

    const titleEN = document.getElementById('title-en').value;
    const cleanSlug = titleEN.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    if (!cleanSlug) {
        showToast("English title must contain valid characters to create a slug.", 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Article';
        return;
    }

    const uploadImage = async (fileInputId, lang) => {
        const file = document.getElementById(fileInputId).files[0];
        if (!file) throw new Error(`${lang.toUpperCase()} cover image is required.`);
        const result = await getCoverUploadUrlFn({ slug: cleanSlug, fileName: `${lang}-${file.name}`, contentType: file.type });
        await fetch(result.data.signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
        return result.data.filePath;
    };

    try {
        showToast("Uploading cover images", 'info');
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
        showToast("Saving article data", 'info');
        const result = await createNewsArticleFn(articleData);
        showToast(result.data.message, 'success');
        dom.newsForm.reset();
    } catch (error) {
        console.error("[CLIENT] An error occurred during news submission:", error);
        showToast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publish Article';
    }
}

/**
 * Handles the deletion of a news article.
 * @param {string} slug - The slug of the article to delete.
 */
async function handleDeleteArticle(slug) {
    if (!confirm(`Are you sure you want to delete the article "${slug}"?`)) return;
    showToast(`Deleting article: ${slug}`, 'info');
    try {
        const result = await deleteNewsArticleFn({ slug });
        showToast(result.data.message, 'success');
    } catch (error) {
        console.error(`[CLIENT] Error deleting article ${slug}:`, error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Attaches a real-time listener to the 'news' collection in Firestore.
 */
export function listenForArticles() {
    if (unsubscribeFromArticles) unsubscribeFromArticles(); 

    console.log("[CLIENT] Attaching real-time listener for 'news' collection.");
    unsubscribeFromArticles = db.collection('news').orderBy('publishedAt', 'desc').onSnapshot(snapshot => {
        dom.articlesListContainer.innerHTML = '';
        if (snapshot.empty) {
            dom.articlesListContainer.innerHTML = '<p class="form-hint">No articles found.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const item = document.createElement('div');
            // FIX: The class 'article-item' is the container.
            item.className = 'article-item';
            
            // CORRECTED STRUCTURE: Details and actions are now in separate divs.
            item.innerHTML = `
                <div class="item-details">
                    <span class="item-title">${doc.data().translations.en.title || 'Untitled'}</span>
                </div>
                <div class="item-actions">
                    <button class="delete-btn" data-slug="${doc.id}">Delete</button>
                </div>`;
            dom.articlesListContainer.appendChild(item);
        });
    }, error => {
        console.error("[CLIENT] Error listening for article updates:", error);
        showToast("Could not load articles in real-time.", 'error');
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
    dom.newsForm.addEventListener('submit', handleNewsFormSubmit);
    dom.articlesListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const slug = e.target.getAttribute('data-slug');
            handleDeleteArticle(slug);
        }
    });
}