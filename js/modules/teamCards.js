// js/modules/teamCards.js
//
// Vertex Konsol — Ekip Kartları, Yönetici Profilleri ve Weekly Stars Yönetimi
//
// Kurallar:
//  - Yalnızca 10 izin verilen pozisyon: CEO, CTO, COO, CFO, CMO, CDO, CHRO, CCO, CLO, CITO
//  - Her pozisyona en fazla bir kişi atanabilir; dolu pozisyon seçilemez
//  - Toplam 10 aktif kart sınırı (10 dolunca Yeni Kart butonu devre dışı)
//  - Liste Onur Tablosu standardında: avatar, isim, pozisyon rozeti, hizalı ikon butonları
//  - Ekleme/düzenleme ortak drawer üzerinden yapılır; fotoğraf 2MB ve JPEG/PNG/WebP doğrulanır
//  - Mustafa Çakı yönetici profili ve Weekly Stars yönetimi aynı alanda bulunur

import {
    listTeamCardsFn,
    setTeamCardFn,
    deleteTeamCardFn,
    getTeamProfileFn,
    setTeamProfileFn,
    getWeeklyStarsFn,
    setWeeklyStarsFn,
    setSiteTeamEntryFn,
    getVertexContributorsFn
} from '../core/firebase.js';
import { isoWeek } from '../utils/isoWeek.js';
import { showLoadError } from '../ui/states.js';
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
let cardsLoaded = false;
let cardsError = null;
let boardCapacity = POSITIONS.length;

/**
 * Ekip kartları listesini Firestore'dan çeker ve ekrana çizer.
 */
export async function loadTeamCards() {
    const listEl = document.getElementById('team-cards-list');
    if (!listEl) return;

    cardsLoading = true;
    cardsError = null;
    const addBtn = document.getElementById('add-team-card-btn');
    if (addBtn && !cardsLoaded) addBtn.disabled = true;
    if (!cardsLoaded) listEl.innerHTML = `<p class="state-block">${__('common.loading')}</p>`;
    const emptyEl = document.getElementById('team-cards-empty');

    try {
        const { data } = await listTeamCardsFn({});
        if (!Array.isArray(data?.cards)) throw new Error('Invalid team cards response');
        teamCards = data.cards;
        boardCapacity = Number.isInteger(data.maxAllowed) ? data.maxAllowed : POSITIONS.length;
        cardsLoaded = true;
    } catch (err) {
        cardsError = err;
        console.warn('[TEAM_CARDS] Failed to refresh board cards:', err);
    } finally {
        cardsLoading = false;
    }

    renderTeamCardsList();
    if (cardsError) {
        if (emptyEl) emptyEl.hidden = true;
        showLoadError(listEl, () => userErrorMessage(cardsError), loadTeamCards, {staleSelector:'.team-list-row'});
    }

    if (addBtn) {
        const isFull = !cardsLoaded || teamCards.length >= boardCapacity;
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
        if (emptyEl) emptyEl.hidden = !cardsLoaded || Boolean(cardsError);
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
                await deleteTeamCardFn({ id: cardId });
                teamCards = teamCards.filter(c => c.id !== cardId);
                renderTeamCardsList();
                showToast(() => __('team_cards.deleted'), 'success');
                const addBtn = document.getElementById('add-team-card-btn');
                if (addBtn) {
                    addBtn.disabled = teamCards.length >= boardCapacity;
                    addBtn.title = teamCards.length >= boardCapacity ? __('team_cards.all_filled') : __('team_cards.add_btn');
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
                <select id="team-card-position" required>
                    <option value="" disabled ${!isEdit ? 'selected' : ''}>${__('team_cards.position_select')}</option>
                    ${POSITIONS.map(pos => {
                        const occupiedCard = teamCards.find(c => c.position === pos && c.id !== cardToEdit?.id);
                        const isSelected = cardToEdit?.position === pos;
                        const disabledAttr = occupiedCard ? 'disabled' : '';
                        const labelSuffix = occupiedCard ? ` (${__('team_cards.position_occupied')} - ${occupiedCard.name})` : '';
                        return `<option value="${pos}" ${isSelected ? 'selected' : ''} ${disabledAttr}>${pos}${labelSuffix}</option>`;
                    }).join('')}
                </select>
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
        const position = drawerBody.querySelector('#team-card-position').value;
        const linkedin = drawerBody.querySelector('#team-card-linkedin').value.trim();
        const instagram = drawerBody.querySelector('#team-card-instagram').value.trim();

        if (!name || !position) return;

        isSaving = true;
        const submitBtn = root.querySelector('[data-drawer-submit]');
        setButtonLoading(submitBtn, true);

        try {
            const payload = {
                id: cardToEdit?.id,
                name,
                position,
                photoUrl: selectedPhoto,
                socialLinks: {
                    linkedin: linkedin || undefined,
                    instagram: instagram || undefined
                }
            };

            const selectedFile = photoInput.files?.[0];
            if (selectedFile) {
                const imageData = selectedPhoto.split(',')[1];
                if (!imageData) throw new Error('Invalid photo content');
                const uploaded = await setSiteTeamEntryFn({kind:'photo', imageData, contentType:selectedFile.type});
                payload.photoUrl = uploaded.data.imageUrl;
            }
            await setTeamCardFn(payload);
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

// Keep previously loaded records on transient read failures.
let weeklyCache = null;
const starName = item => typeof item === 'string' ? item : (item?.name || '');
const starId = item => typeof item === 'object' && item !== null ? item.id : null;
/**
 * Haftanın Yıldızları (Weekly Stars) Bölümü Başlatıcı
 */
export async function initWeeklyStarsPanel() {
    const container = document.getElementById('weekly-stars-container');
    if (!container) return;

    if (!weeklyCache) container.innerHTML = `<p class="state-block">${__('common.loading')}</p>`;
    try {
        const { data } = await getWeeklyStarsFn({});
        if (!data || !Array.isArray(data.history)) throw new Error('Invalid weekly stars response');
        weeklyCache = data;
        let directory = [];
        let directoryError = null;
        try {
            const response = await getVertexContributorsFn({});
            if (!Array.isArray(response.data?.contributors)) throw new Error('Invalid participant directory');
            directory = response.data.contributors.filter(person => person && typeof person.id === 'string' && person.name);
        } catch (error) { directoryError = error; }
        renderWeeklyStars(container, {...weeklyCache, directory, directoryError});
    } catch (err) {
        console.warn('[WEEKLY_STARS] Failed to load weekly stars:', err);
        if (weeklyCache) {
            showToast(() => userErrorMessage(err), 'error');
            return;
        }
        showLoadError(container, () => userErrorMessage(err), initWeeklyStarsPanel);
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
                    <div id="stars-selected" class="stars-selected" aria-live="polite"></div>
                    <div class="search-field">
                        ${icon('search', {size:16})}
                        <input type="search" id="stars-person-search" autocomplete="off" placeholder="${getLang()==='tr'?'Katılımcı adıyla ara':'Search participants'}" aria-label="${__('weekly_stars.contributors_label')}">
                    </div>
                    <div id="stars-search-results" class="stars-search-results" role="listbox"></div>
                    ${starsData.directoryError ? `<p class="state-block" role="alert">${escapeHTML(getLang()==='tr'?'Katılımcılar yüklenemedi. Kayıtlar korundu; yeniden deneyin.':'Participants could not be loaded. Existing records are preserved; retry.')}</p>` : ''}
                    <p class="form-hint">${getLang()==='tr'?'En fazla 5 kişi; seçimler kalıcı katılımcı kimliğiyle kaydedilir.':'Up to five people; selections use permanent participant IDs.'}</p>
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

    const selected = [...(Array.isArray(current?.contributors) ? current.contributors : [])];
    const directory = starsData.directory || [];
    const selectedHost = container.querySelector('#stars-selected');
    const search = container.querySelector('#stars-person-search');
    const results = container.querySelector('#stars-search-results');
    const drawSelected = () => {
        selectedHost.innerHTML = selected.map((person, index) => `<span class="stars-person-chip">${escapeHTML(starName(person))}${starId(person)?'':' (legacy)'}<button type="button" data-remove-star="${index}" aria-label="${__('common.delete')}">×</button></span>`).join('') || `<span class="form-hint">${getLang()==='tr'?'Henüz katılımcı seçilmedi.':'No participants selected.'}</span>`;
        selectedHost.querySelectorAll('[data-remove-star]').forEach(button => button.onclick = () => {
            selected.splice(Number(button.dataset.removeStar), 1);
            drawSelected();
            drawResults();
        });
    };
    const drawResults = () => {
        const query = search.value.trim().toLocaleLowerCase(getLang()==='tr'?'tr-TR':'en-US');
        results.innerHTML = !query ? '' : directory.filter(person =>
            !selected.some(chosen => starId(chosen)===person.id) &&
            (person.name+' '+(person.email||'')).toLocaleLowerCase(getLang()==='tr'?'tr-TR':'en-US').includes(query)
        ).slice(0,20).map(person => `<button type="button" class="stars-person-result" role="option" data-star-id="${escapeHTML(person.id)}"><strong>${escapeHTML(person.name)}</strong><small>${escapeHTML(person.email||person.department||'')}</small></button>`).join('');
        results.querySelectorAll('[data-star-id]').forEach(button => button.onclick = () => {
            if (selected.length >= 5) {
                showToast(() => getLang()==='tr'?'En fazla 5 kişi seçilebilir.':'Select up to 5 people.', 'error');
                return;
            }
            const person = directory.find(item => item.id===button.dataset.starId);
            if (!person) return;
            selected.push({id:person.id, name:person.name});
            search.value = '';
            drawSelected();
            drawResults();
            search.focus({preventScroll:true});
        });
    };
    search.oninput = drawResults;
    drawSelected();
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
