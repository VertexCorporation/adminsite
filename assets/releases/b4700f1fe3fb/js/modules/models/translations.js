import { setButtonLoading } from '../../utils/loading.js';
import { auth } from '../../core/firebase.js';
import { showToast, userErrorMessage, __, getLang, getAuthToken, sanitizeHTML } from '../../utils/ui.js';
import { openModal, closeModal } from '../shell.js';
import { CURATOR_API_URL, TARGET_LANGUAGES, STATUS } from './constants.js';
import { canEditModels } from './access.js';

export function createModelTranslations({ state, renderManualModelsList }) {
    async function handleSaveSeriesDescription(seriesPath, formElement) {
        if (!canEditModels("models.library")) return;
        const saveButton = formElement.querySelector('button[type="submit"]');
        setButtonLoading(saveButton,true);
        saveButton.textContent = __('system.saving');

        const { pName, sName } = seriesPath;
        console.log(`[MODELS_DEBUG] [SeriesDesc] Starting save for ${pName}/${sName}`);

        const formData = new FormData(formElement);
        const updates = [];
        const seriesObj = state.data.producers[pName][sName];
        const seriesDescObj = seriesObj.series_description || {};

        const newEnValue = formData.get('trans-en-description').trim();
        if ((seriesDescObj.en || '') !== newEnValue) {
            updates.push({ pName, sName, fieldPath: 'series_description.en', value: newEnValue });
            updates.push({ pName, sName, fieldPath: 'series_description.processing_status.en', value: STATUS.AUDITED_CORRECTED });
        }

        TARGET_LANGUAGES.forEach(lang => {
            const newValue = formData.get(`trans-${lang}-description`).trim();
            if ((seriesDescObj[lang] || '') !== newValue) {
                updates.push({ pName, sName, fieldPath: `series_description.${lang}`, value: newValue });
                updates.push({ pName, sName, fieldPath: `series_description.processing_status.${lang}`, value: STATUS.AUDITED_CORRECTED });
            }
        });

        if (updates.length === 0) {
            showToast(() => __('models.no_changes'), "info");
            setButtonLoading(saveButton,false);
            saveButton.textContent = __('models.save_series');
            return;
        }

        try {
            const token = await getAuthToken(auth);
            const response = await fetch(`${CURATOR_API_URL}/update-list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ batch: updates })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server Error (${response.status}): ${errText}`);
            }

            console.log(`[MODELS_DEBUG] Updating local series data...`);

            if (!seriesObj.series_description) {
                seriesObj.series_description = { processing_status: {} };
            }

            updates.forEach(update => {
                const { fieldPath, value } = update;
                const parts = fieldPath.split('.');
                let currentRef = seriesObj;
            
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    if (!currentRef[part]) currentRef[part] = {};
                    currentRef = currentRef[part];
                }
                currentRef[parts[parts.length - 1]] = value;
            });

            showToast(() => __('models.saved_series'), 'success');
            closeModal();
        
        } catch (error) {
            console.error('[MODELS_DEBUG] Error:', error);
            showToast(() => userErrorMessage(error), 'error');
        } finally {
            setButtonLoading(saveButton,false);
            saveButton.textContent = __('models.save_series');
        }
    }

    /**
     * Handles saving translations via Batch API and updates LOCAL STATE immediately.
     * [UPDATED v3.3] Optimistic UI Update + Batch API
     */
    async function handleSaveTranslations(modelPath, formElement, modelSource) {
        if (!canEditModels("models.library")) return;
        const saveButton = formElement.querySelector('button[type="submit"]');
        setButtonLoading(saveButton,true);
        saveButton.textContent = __('system.saving');

        const { pName, sName, vName } = modelPath;
        console.log(`[MODELS_DEBUG] [Translations] Starting save for ${pName}/${sName}/${vName}`);

        const modelVariant = state.data?.producers?.[pName]?.[sName]?.[vName];
        if (!modelVariant) {
            showToast(() => __('models.not_found'), 'error');
            setButtonLoading(saveButton,false);
            return;
        }

        const formData = new FormData(formElement);
        const updates = [];

        for (const [key, value] of formData.entries()) {
            const match = key.match(/^trans-(.+?)-(.+)$/);
            if (!match) continue;
            const [, lang, fieldKey] = match;

            const rootObj = modelSource === 'manual' ? state.data.producers[pName][sName][vName].details : state.data.producers[pName][sName][vName];
        
            let currentValue = '';
            if (modelSource === 'manual') {
                currentValue = (rootObj[lang] && rootObj[lang][fieldKey]) ? rootObj[lang][fieldKey] : '';
            } else {
                const descField = rootObj.description;
                if (typeof descField === 'string') {
                    currentValue = (lang === 'en' && fieldKey === 'description') ? descField : '';
                } else if (typeof descField === 'object' && descField !== null) {
                    currentValue = descField[lang] || '';
                }
            }

            const newValue = value.trim();

            if (currentValue !== newValue) {
                console.log(`[MODELS_DEBUG] Change detected: ${lang}.${fieldKey}`);

                let fieldPath = modelSource === 'manual' ? `details.${lang}.${fieldKey}` : `description.${lang}`;
                updates.push({ pName, sName, vName, fieldPath, value: newValue });

                let statusFieldPath = modelSource === 'manual' ? `details.processing_status.${lang}.${fieldKey}` : `description.processing_status.${lang}`;
                updates.push({ pName, sName, vName, fieldPath: statusFieldPath, value: STATUS.AUDITED_CORRECTED });

                const englishText = modelSource === 'manual'
                    ? (modelVariant.details.en[fieldKey] || '')
                    : (typeof modelVariant.description === 'object' ? modelVariant.description.en : modelVariant.description);
                const sourceHash = simpleHash(englishText || '');
                let hashFieldPath = modelSource === 'manual' ? `details.processing_status.${lang}.${fieldKey}_source_hash` : `description.processing_status.${lang}_source_hash`;
                updates.push({ pName, sName, vName, fieldPath: hashFieldPath, value: sourceHash });
            }
        }

        if (updates.length === 0) {
            showToast(() => __('models.no_changes'), "info");
            setButtonLoading(saveButton,false);
            saveButton.textContent = __('models.save_translations');
            return;
        }

        try {
            const token = await getAuthToken(auth);
            const response = await fetch(`${CURATOR_API_URL}/update-list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ batch: updates })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server Error (${response.status}): ${errText}`);
            }

            console.log(`[MODELS_DEBUG] API Success. Updating local memory...`);

            updates.forEach(update => {
                const { fieldPath, value } = update;
                const parts = fieldPath.split('.');
            
                let currentRef = state.data.producers[pName][sName][vName];

                if (!modelSource || modelSource !== 'manual') {
                    if (parts[0] === 'description' && typeof currentRef.description === 'string' && parts.length > 1) {
                        console.log(`[MODELS_DEBUG] Local Promotion: Converting description string to object.`);
                        currentRef.description = { en: currentRef.description };
                    }
                }

                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    if (!currentRef[part]) currentRef[part] = {};
                    currentRef = currentRef[part];
                }
                currentRef[parts[parts.length - 1]] = value;
            });

            if (modelSource === 'manual') {
                const manualIndex = state.manualModels.findIndex(m => m.id === modelVariant.id);
                if (manualIndex !== -1) {
                     state.manualModels[manualIndex] = state.data.producers[pName][sName][vName];
                     renderManualModelsList(); 
                }
            }

            closeModal();
        
            const count = Math.round(updates.length / 3);
            showToast(() => __('models.saved_translations'), 'success');

        } catch (error) {
            console.error('[MODELS_DEBUG] Error:', error);
            showToast(() => userErrorMessage(error), 'error');
        } finally {
            setButtonLoading(saveButton,false);
            saveButton.textContent = __('models.save_translations');
        }
    }

    /**
     * Opens a modal window for editing the descriptions of a model series.
     * @param {object} seriesPath - An object containing {pName, sName}.
     */
    function openDescriptionEditor(seriesPath) {
        const { pName, sName } = seriesPath;
        const seriesObj = state.data?.producers?.[pName]?.[sName];
        if (!seriesObj) return showToast(() => __('models.not_found'), 'error');

        const descObj = seriesObj.series_description || {};

        const modalOverlay = openModal({
            title: `${__('models.edit_desc')} · ${sanitizeHTML(sName)}`,
            titleKey: 'models.edit_desc',
            titleSuffix: sName,
            size: 'large',
            render(body) {
                body.className = 'translation-modal-body';
                const form = document.createElement('form');
                form.className = 'form-stack';
                form.id = 'series-desc-form';

                // Bölüm başlığı
                const sectionTitle = document.createElement('div');
                sectionTitle.className = 'form-section-title';
                sectionTitle.textContent = __('models.description_texts');
                form.append(sectionTitle);

                // İngilizce kaynak (düzenlenebilir — kaynak dil)
                const enGroup = document.createElement('div');
                enGroup.className = 'form-group-field';
                const enLabel = document.createElement('label');
                enLabel.htmlFor = 'trans-en-description';
                enLabel.textContent = __('models.source_en');
                const enTextarea = document.createElement('textarea');
                enTextarea.id = 'trans-en-description';
                enTextarea.name = 'trans-en-description';
                enTextarea.rows = 3;
                enTextarea.value = descObj.en || '';
                enGroup.append(enLabel, enTextarea);
                form.append(enGroup);

                // Diğer diller için kartlar
                const langsGrid = document.createElement('div');
                langsGrid.className = 'translation-langs-grid';

                TARGET_LANGUAGES.forEach(lang => {
                    const val = descObj[lang] || '';
                    const id = `trans-${lang}-description`;
                    const langName = new Intl.DisplayNames([getLang()], { type: 'language' }).of(lang);

                    const card = document.createElement('div');
                    card.className = 'translation-lang-card';

                    const header = document.createElement('div');
                    header.className = 'translation-lang-header';
                    header.textContent = langName;

                    const fieldGroup = document.createElement('div');
                    fieldGroup.className = 'form-group-field';

                    const textarea = document.createElement('textarea');
                    textarea.id = id;
                    textarea.name = id;
                    textarea.rows = 3;
                    textarea.textContent = val;
                    textarea.className = 'auto-resize-textarea';
                    textarea.addEventListener('input', () => {
                        textarea.style.height = 'auto';
                        textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px';
                    });

                    fieldGroup.append(textarea);
                    card.append(header, fieldGroup);
                    langsGrid.append(card);
                });

                form.append(langsGrid);

                const submitBtn = document.createElement('button');
                submitBtn.type = 'submit';
                submitBtn.className = 'chrome-btn-primary';
                submitBtn.textContent = __('models.save_series');
                form.append(submitBtn);

                form.addEventListener('submit', e => {
                    e.preventDefault();
                    handleSaveSeriesDescription(seriesPath, e.currentTarget);
                });

                body.append(form);
            }
        });

        modalOverlay.id = 'translation-modal-overlay';
        return modalOverlay;
    }


    function openTranslationEditor(modelPath) {
        const { pName, sName, vName } = modelPath;
        const modelObj = state.data?.producers?.[pName]?.[sName]?.[vName];
        if (!modelObj) return showToast(() => __('models.not_found'), "error");

        let englishDetails, detailsObject, translatableFields;
        if (modelObj.source === 'manual' && modelObj.details) {
            detailsObject = modelObj.details;
            englishDetails = modelObj.details.en;
            translatableFields = [
                { k: 'title' },
                { k: 'summary' },
                { k: 'description', t: 'textarea' },
                { k: 'role', t: 'textarea' }
            ];
        } else if (modelObj.description) {
            detailsObject = modelObj.description;
            englishDetails = { description: modelObj.description.en };
            translatableFields = [{ k: 'description', t: 'textarea' }];
        } else {
            return showToast(() => __('models.no_translations'), "info");
        }

        const modalOverlay = openModal({
            title: `${__('models.translations_for')} · ${sanitizeHTML(vName)}`,
            titleKey: 'models.translations_for',
            titleSuffix: vName,
            size: 'large',
            render(body) {
                body.className = 'translation-modal-body';
                const form = document.createElement('form');
                form.className = 'form-stack';
                form.id = 'translation-editor-form';

                translatableFields.forEach(field => {
                    if (!englishDetails?.[field.k]) return;

                    const section = document.createElement('div');
                    section.className = 'form-section';

                    const sectionTitle = document.createElement('div');
                    sectionTitle.className = 'form-section-title';
                    sectionTitle.textContent = __('models.field_' + field.k);
                    section.append(sectionTitle);

                    const refLabel = document.createElement('div');
                    refLabel.className = 'reference-label';
                    refLabel.textContent = `${__('models.source_en')} (${__('common.source_reference') || 'English Reference'})`;
                    const refText = document.createElement('div');
                    refText.className = 'reference-text-field';
                    refText.textContent = englishDetails[field.k];
                    section.append(refLabel, refText);

                    const langsGrid = document.createElement('div');
                    langsGrid.className = 'translation-langs-grid';

                    TARGET_LANGUAGES.forEach(lang => {
                        const val = (typeof detailsObject[lang] === 'object'
                            ? detailsObject[lang]?.[field.k]
                            : detailsObject[lang]) || '';
                        const id = `trans-${lang}-${field.k}`;
                        const langName = new Intl.DisplayNames([getLang()], { type: 'language' }).of(lang);

                        const card = document.createElement('div');
                        card.className = 'translation-lang-card';

                        const header = document.createElement('div');
                        header.className = 'translation-lang-header';
                        header.textContent = langName;

                        const fieldGroup = document.createElement('div');
                        fieldGroup.className = 'form-group-field';

                        let input;
                        if (field.t === 'textarea') {
                            input = document.createElement('textarea');
                            input.rows = 3;
                            input.className = 'auto-resize-textarea';
                            input.value = val;
                            input.addEventListener('input', () => {
                                input.style.height = 'auto';
                                input.style.height = Math.min(input.scrollHeight, 320) + 'px';
                            });
                        } else {
                            input = document.createElement('input');
                            input.type = 'text';
                            input.value = val;
                        }
                        input.id = id;
                        input.name = id;

                        fieldGroup.append(input);
                        card.append(header, fieldGroup);
                        langsGrid.append(card);
                    });

                    section.append(langsGrid);
                    form.append(section);
                });

                const submitBtn = document.createElement('button');
                submitBtn.type = 'submit';
                submitBtn.className = 'chrome-btn-primary';
                submitBtn.textContent = __('models.save_translations');
                form.append(submitBtn);

                form.addEventListener('submit', e => {
                    e.preventDefault();
                    handleSaveTranslations(modelPath, e.currentTarget, modelObj.source);
                });

                body.append(form);
            }
        });

        modalOverlay.id = 'translation-modal-overlay';
        return modalOverlay;
    }

    return { openDescriptionEditor, openTranslationEditor };
}
