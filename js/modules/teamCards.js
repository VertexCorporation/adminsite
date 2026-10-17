// js/modules/teamCards.js
//
// Vertex Konsol — Ekip Kartları, Yönetici Profilleri ve Weekly Stars Yönetimi
//
// Kurallar:
//  - Yalnızca 10 izin verilen pozisyon: CEO, CTO, COO, CFO, CMO, CDO, CHRO, CCO, CLO, CITO
//  - Her pozisyona en fazla bir kişi atanabilir; dolu pozisyon seçilemez
//  - Backend sınırı 40 ekip kartıdır; yönetim kurulu unvanlarında tekil atama yapılır
//  - Liste Onur Tablosu standardında: avatar, isim, pozisyon rozeti, hizalı ikon butonları
//  - Ekleme/düzenleme ortak drawer üzerinden yapılır; fotoğraf 2MB ve JPEG/PNG/WebP doğrulanır
//  - Mustafa Çakı yönetici profili ve Weekly Stars yönetimi aynı alanda bulunur

import {
    listSiteTeamFn,
    setSiteTeamEntryFn,
    deleteSiteTeamEntryFn,
    getTeamProfileFn,
    setTeamProfileFn,
    getWeeklyStarsFn,
    setWeeklyStarsFn
} from '../core/firebase.js';
import { escapeHTML, sanitizeHTML, showToast, userErrorMessage, __, getLang, onLangChange } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
import { openDrawer, closeDrawer, confirmDialog } from './shell.js';
import { createLoadingController, setButtonLoading, skeletonRows } from '../utils/loading.js';
import { isPanelAdmin } from './roles.js';

export const POSITIONS = Object.freeze([
    'CEO', 'CTO', 'COO', 'CFO', 'CMO', 'CDO', 'CHRO', 'CCO', 'CLO', 'CITO'
]);

let teamCards = [];
let cardsLoading = false;

/**
 * Ekip kartları listesini Firestore'dan çeker ve ekrana çizer.
 */
export async function loadTeamCards() {
    const listEl = document.getElementById('team-cards-list');
    if (!listEl) return;

    cardsLoading = true;
    const addBtn = document.getElementById('add-team-card-btn');
    if (addBtn) addBtn.disabled = true;
    const emptyEl = document.getElementById('team-cards-empty');

    try {
        const { data } = await listSiteTeamFn({manage:true});
        if (!Array.isArray(data?.cards)) throw Object.assign(new Error('Invalid team card response'),{code:'functions/internal'});
        teamCards = data.cards.map(card => {
            const links = Array.isArray(card.links) ? card.links : [];
            const positions = card.positions || (card.position ? {en:card.position,tr:card.position} : {});
            return {...card,position:positions[getLang()] || positions.en || positions.tr || '',
                titles:positions,photoUrl:card.imageUrl || card.photoUrl || '',
                socialLinks:Object.fromEntries(links.filter(link=>['linkedin','instagram'].includes(String(link.label).toLowerCase()))
                    .map(link=>[link.label.toLowerCase(),link.url]))};
        });
    } catch (err) {
        console.warn('[TEAM_CARDS] Could not fetch cards from backend:', err.code || 'unknown');
        listEl.innerHTML = `<div class="state-block" role="alert"><p>${escapeHTML(userErrorMessage(err))}</p><button type="button" class="chrome-btn-outline" data-team-retry>${__('common.retry')}</button></div>`;
        listEl.querySelector('[data-team-retry]').onclick = loadTeamCards;
        if (emptyEl) emptyEl.hidden = true;
        // Do not allow writes while the current server state and capacity are unknown.
        if (addBtn) addBtn.disabled = true;
        cardsLoading = false;
        return;
    } finally {
        cardsLoading = false;
    }

    renderTeamCardsList();

    if (addBtn) {
        const isFull = teamCards.length >= 40;
        addBtn.disabled = isFull;
        addBtn.title = isFull ? __('team_cards.all_filled') : __('team_cards.add_btn');
    }
}

function renderTeamCardsList() {
    const listEl = document.getElementById('team-cards-list');
    const emptyEl = document.getElementById('team-cards-empty');
    if (!listEl) return;

    if (!teamCards.length) {
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.hidden = false;
        return;
    }

    if (emptyEl) emptyEl.hidden = true;
    listEl.className = 'team-list';

    listEl.innerHTML = teamCards.map(card => {
        const currentLang = getLang() || 'tr';
        const localizedTitle = card.titles?.[currentLang] || card.position;
        const avatarSrc = card.photoUrl
            ? `<img src="${escapeHTML(card.photoUrl)}" alt="${escapeHTML(card.name)}" loading="lazy">`
            : icon('user', { size: 18 });

        return `
        <div class="team-list-row" data-id="${escapeHTML(card.id)}">
            <div class="team-list-avatar">
                ${avatarSrc}
            </div>
            <div class="team-list-info">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="team-list-name">${escapeHTML(card.name)}</span>
                    <span class="position-badge">${escapeHTML(card.position)}</span>
                </div>
                <span class="team-list-meta">${escapeHTML(localizedTitle)}</span>
            </div>
            <div class="team-list-actions">
                <button type="button" class="icon-btn" data-edit-card="${escapeHTML(card.id)}" title="${__('common.edit')}" aria-label="${__('common.edit')}">
                    ${icon('pencil', { size: 16 })}
                </button>
                <button type="button" class="icon-btn danger" data-del-card="${escapeHTML(card.id)}" title="${__('common.delete')}" aria-label="${__('common.delete')}">
                    ${icon('trash', { size: 16 })}
                </button>
            </div>
        </div>`;
    }).join('');

    // Eylemleri bağla
    listEl.querySelectorAll('[data-edit-card]').forEach(btn => {
        btn.onclick = () => {
            const card = teamCards.find(c => c.id === btn.dataset.editCard);
            if (card) openTeamCardDrawer(card);
        };
    });

    listEl.querySelectorAll('[data-del-card]').forEach(btn => {
        btn.onclick = async () => {
            const cardId = btn.dataset.delCard;
            const card = teamCards.find(c => c.id === cardId);
            const confirmed = await confirmDialog(() => ({
                title: __('team_cards.delete_confirm'),
                body: card ? `${card.name} (${card.position})` : '',
                confirmLabel: __('common.delete'),
                danger: true
            }));
            if (!confirmed) return;

            try {
                await deleteSiteTeamEntryFn({ kind:'card', id: cardId });
                teamCards = teamCards.filter(c => c.id !== cardId);
                renderTeamCardsList();
                showToast(() => __('team_cards.deleted'), 'success');
                const addBtn = document.getElementById('add-team-card-btn');
                if (addBtn) {
                    addBtn.disabled = teamCards.length >= 40;
                    addBtn.title = teamCards.length >= 40 ? __('team_cards.all_filled') : __('team_cards.add_btn');
                }
            } catch (err) {
                showToast(() => userErrorMessage(err), 'error');
            }
        };
    });
}

/**
 * Ekip kartı ekleme/düzenleme Drawer'ını açar.
 */
export function openTeamCardDrawer(cardToEdit = null) {
    const isEdit = Boolean(cardToEdit);
    let selectedPhoto = cardToEdit?.photoUrl || '';
    let selectedPhotoBytes = null;
    let isSaving = false;

    const drawerBody = openDrawer({
        title: isEdit ? __('team_cards.drawer_edit_title') : __('team_cards.drawer_add_title'),
        footerHTML: `
            <button type="button" class="chrome-btn-outline" data-drawer-cancel>${__('common.cancel')}</button>
            <button type="submit" form="team-card-form" class="chrome-btn-primary" data-drawer-submit>${__('common.save')}</button>
        `,
        onAfterClose() {}
    });

    const root = drawerBody.closest('.vx-drawer');
    root.querySelector('[data-drawer-cancel]').onclick = () => closeDrawer();

    drawerBody.innerHTML = `
        <form id="team-card-form" class="form-stack">
            <!-- Fotoğraf Yükleme / Önizleme -->
            <div class="form-section">
                <label class="form-section-title">${__('team_cards.photo_label')}</label>
                <div style="display:flex;align-items:center;gap:16px;">
                    <div id="team-card-photo-preview" class="team-list-avatar" style="width:56px;height:56px;font-size:24px;">
                        ${selectedPhoto ? `<img src="${escapeHTML(selectedPhoto)}" alt="Preview">` : icon('user', { size: 28 })}
                    </div>
                    <div style="flex:1;">
                        <input type="url" id="team-card-image-url" aria-label="${__('team_cards.photo_label')} URL" placeholder="https://…" value="${escapeHTML(selectedPhoto)}">
                        <input type="file" id="team-card-photo-input" accept="image/jpeg,image/png,image/webp" style="display:none;">
                        <button type="button" class="chrome-btn-outline" id="team-card-choose-photo-btn">
                            ${icon('upload', { size: 16 })}
                            <span>${__('team_cards.photo_upload_btn')}</span>
                        </button>
                        <p id="team-card-photo-error" class="field-error-msg" hidden></p>
                    </div>
                </div>
            </div>

            <!-- İsim -->
            <div class="form-group-field">
                <label for="team-card-name">${__('team_cards.name_label')}</label>
                <input type="text" id="team-card-name" maxlength="60" required value="${escapeHTML(cardToEdit?.name || '')}" placeholder="örn: Mustafa Çakı">
            </div>

            <!-- Pozisyon Seçimi -->
            <div class="form-group-field">
                <label for="team-card-position">${__('team_cards.position_label')}</label>
                <input id="team-card-position" type="text" list="team-card-position-suggestions" maxlength="160"
                    value="${escapeHTML(cardToEdit?.titles?.en || cardToEdit?.position || '')}" required>
                <datalist id="team-card-position-suggestions">${POSITIONS.map(pos => `<option value="${pos}"></option>`).join('')}</datalist>
                <label for="team-card-position-tr">${__('team_cards.position_label')} (TR)</label>
                <input id="team-card-position-tr" type="text" maxlength="160"
                    value="${escapeHTML(cardToEdit?.titles?.tr || '')}">
            </div>

            <!-- Sosyal Medya Bağlantıları -->
            <div class="form-section">
                <div class="form-section-title">Sosyal Ağ Bağlantıları</div>
                <div class="form-group-field">
                    <label for="team-card-linkedin">${__('team_cards.linkedin_label')}</label>
                    <input type="url" id="team-card-linkedin" placeholder="https://www.linkedin.com/in/..." value="${escapeHTML(cardToEdit?.socialLinks?.linkedin || '')}">
                </div>
                <div class="form-group-field">
                    <label for="team-card-instagram">${__('team_cards.instagram_label')}</label>
                    <input type="url" id="team-card-instagram" placeholder="https://www.instagram.com/..." value="${escapeHTML(cardToEdit?.socialLinks?.instagram || '')}">
                </div>
            </div>
        </form>
    `;

    // Fotoğraf seçimi ve validasyonu
    const photoInput = drawerBody.querySelector('#team-card-photo-input');
    const photoBtn = drawerBody.querySelector('#team-card-choose-photo-btn');
    const photoPreview = drawerBody.querySelector('#team-card-photo-preview');
    const photoError = drawerBody.querySelector('#team-card-photo-error');

    photoBtn.onclick = () => photoInput.click();

    photoInput.onchange = () => {
        photoError.hidden = true;
        const file = photoInput.files?.[0];
        if (!file) return;

        // Dosya boyutu kontrolü (maksimum 2MB)
        if (file.size > 2 * 1024 * 1024) {
            photoError.textContent = __('team_cards.photo_size_error');
            photoError.hidden = false;
            photoInput.value = '';
            return;
        }

        // Format kontrolü
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            photoError.textContent = __('team_cards.photo_type_error');
            photoError.hidden = false;
            photoInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = e => {
            selectedPhoto = e.target.result;
            selectedPhotoBytes = selectedPhoto;
            photoPreview.innerHTML = `<img src="${selectedPhoto}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    };

    // Form Gönderimi
    const form = drawerBody.querySelector('#team-card-form');
    form.onsubmit = async e => {
        e.preventDefault();
        if (isSaving) return;

        const name = drawerBody.querySelector('#team-card-name').value.trim();
        const position = drawerBody.querySelector('#team-card-position').value.trim();
        const positionTr = drawerBody.querySelector('#team-card-position-tr').value.trim();
        const linkedin = drawerBody.querySelector('#team-card-linkedin').value.trim();
        const instagram = drawerBody.querySelector('#team-card-instagram').value.trim();

        if (!name || !position) return;
        if (POSITIONS.includes(position) && teamCards.some(card=>card.id!==cardToEdit?.id && (card.titles?.en || card.position)===position)) {
            showToast(() => __('team_cards.position_occupied'),'error');return;
        }

        isSaving = true;
        const submitBtn = root.querySelector('[data-drawer-submit]');
        setButtonLoading(submitBtn, true);

        try {
            let imageUrl = drawerBody.querySelector('#team-card-image-url').value.trim() || selectedPhoto;
            if (selectedPhotoBytes) {
                const photoFile=photoInput.files?.[0];
                const {data:photo}=await setSiteTeamEntryFn({kind:'photo',imageData:selectedPhotoBytes.split(',')[1],contentType:photoFile?.type});
                imageUrl=photo?.imageUrl;
            }
            if (!imageUrl?.startsWith('https://')) {
                photoError.textContent=__('team_cards.photo_required');photoError.hidden=false;return;
            }
            if ([linkedin,instagram].some(value=>value && !value.startsWith('https://'))) {
                showToast(()=>__('team_cards.https_required'),'error');return;
            }
            const payload = {
                kind:'card',id:cardToEdit?.id,name,imageUrl,
                positions:{...(cardToEdit?.titles||{}),en:position,tr:positionTr || cardToEdit?.titles?.tr || position},
                order:cardToEdit?.order || Math.min(1000, Math.max(0,...teamCards.map(card=>Number(card.order)||0))+1),
                links:[...(cardToEdit?.links || []).filter(link=>!['linkedin','instagram'].includes(String(link.label).toLowerCase())),
                    ...[{label:'linkedin',url:linkedin},{label:'instagram',url:instagram}].filter(link=>link.url)]
            };
            await setSiteTeamEntryFn(payload);
            closeDrawer();
            showToast(() => __('team_cards.saved'), 'success');
            await loadTeamCards();
        } catch (err) {
            showToast(() => userErrorMessage(err), 'error');
        } finally {
            isSaving = false;
            setButtonLoading(submitBtn, false);
        }
    };
}

/**
 * Mustafa Çakı Yönetici Profili Bölümü Başlatıcı
 */
export async function initTeamProfilePanel() {
    const container = document.getElementById('team-profile-container');
    if (!container) return;

    try {
        const { data } = await getTeamProfileFn({ slug: 'mustafa_caki' });
        renderTeamProfile(container, data);
    } catch (err) {
        console.warn('[TEAM_PROFILE] Error loading profile:', err);
        renderTeamProfile(container, {
            name: 'Mustafa Çakı',
            position: 'CEO',
            bio: 'Vertex Kurucu Ortağı & CEO.',
            photoUrl: 'assets/team/MUSTAFACAKI.webp',
            socialLinks: {
                linkedin: 'https://www.linkedin.com/in/mustawtfa/',
                instagram: 'https://www.instagram.com/mustawtfa/'
            }
        });
    }
}

function renderTeamProfile(container, profile) {
    const avatarHtml = profile.photoUrl
        ? `<img src="${escapeHTML(profile.photoUrl)}" alt="${escapeHTML(profile.name || 'Mustafa Çakı')}">`
        : icon('user', { size: 32 });

    container.innerHTML = `
        <form id="team-profile-form" class="form-stack">
            <div style="display:flex;gap:16px;align-items:center;">
                <div class="team-list-avatar" style="width:64px;height:64px;">
                    ${avatarHtml}
                </div>
                <div>
                    <h4 style="margin:0;font-size:16px;font-weight:600;">${escapeHTML(profile.name || 'Mustafa Çakı')}</h4>
                    <span class="position-badge" style="margin-top:4px;">${escapeHTML(profile.position || 'CEO')}</span>
                </div>
            </div>

            <div class="form-group-field">
                <label for="profile-bio">${__('team_profile.bio_label')}</label>
                <textarea id="profile-bio" rows="4" maxlength="3000" class="auto-resize-textarea">${escapeHTML(profile.bio || '')}</textarea>
            </div>

            <div class="form-grid two-col">
                <div class="form-group-field">
                    <label for="profile-linkedin">${__('team_cards.linkedin_label')}</label>
                    <input type="url" id="profile-linkedin" value="${escapeHTML(profile.socialLinks?.linkedin || '')}">
                </div>
                <div class="form-group-field">
                    <label for="profile-instagram">${__('team_cards.instagram_label')}</label>
                    <input type="url" id="profile-instagram" value="${escapeHTML(profile.socialLinks?.instagram || '')}">
                </div>
            </div>

            <div>
                <button type="submit" class="chrome-btn-primary" id="save-team-profile-btn">
                    ${__('team_profile.save_btn')}
                </button>
            </div>
        </form>
    `;

    const form = container.querySelector('#team-profile-form');
    form.onsubmit = async e => {
        e.preventDefault();
        const bio = container.querySelector('#profile-bio').value.trim();
        const linkedin = container.querySelector('#profile-linkedin').value.trim();
        const instagram = container.querySelector('#profile-instagram').value.trim();
        const saveBtn = container.querySelector('#save-team-profile-btn');

        setButtonLoading(saveBtn, true);
        try {
            await setTeamProfileFn({
                slug: 'mustafa_caki',
                bio,
                photoUrl: profile.photoUrl || 'assets/team/MUSTAFACAKI.webp',
                socialLinks: { linkedin, instagram }
            });
            showToast(() => __('team_profile.saved'), 'success');
        } catch (err) {
            showToast(() => userErrorMessage(err), 'error');
        } finally {
            setButtonLoading(saveBtn, false);
        }
    };
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
    const now = new Date();
    const currentYear = now.getFullYear();
    // ISO hafta hesaplama
    const target = new Date(now.valueOf());
    const dayNr = (now.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const currentWeekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);

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
    loadTeamCards();
    initTeamProfilePanel();
    initWeeklyStarsPanel();
    onLangChange(() => {
        renderTeamCardsList();
    });
}
