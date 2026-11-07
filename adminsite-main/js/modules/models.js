// js/modules/models.js

/**
 * @file Manages all logic for creating, reading, updating, and deleting models.
 * @version 3.0 (Curator API Integration & Security Hardened)
 *
 * This module directly communicates with the '/curated' backend worker (Curator API)
 * for all data mutations, removing the dependency on Firebase Functions for these tasks.
 * It also handles the rendering of all model-related UI components, including the
 * main model explorer and manual model editor.
 */

import { storage, getModelImageUploadUrlFn, blockOnlineModelFn, auth } from '../core/firebase.js';
import * as dom from '../utils/dom.js';
import { showToast, getAuthToken, sanitizeHTML, simpleHash } from '../utils/ui.js';
import { setAttributionsOutOfSync } from './admin.js';

// --- CONSTANTS ---
const CURATOR_API_URL = "https://cortexishere.com/curated";
const FULL_DB_URL = "https://cortexishere.com/models";
const TARGET_LANGUAGES = ['tr', 'fr', 'zh'];

const MODEL_TYPE = {
    OFFLINE: 'offline',
    ROLEPLAY: 'roleplay'
};

const STATUS = {
    VERIFIED: 'verified',
    AUDITED_CORRECTED: 'audited_corrected',
};

// --- CHAT FORMAT TEMPLATES ---
const CHAT_TEMPLATES = {
  // === ChatML family (Qwen, Mistral v0.3+, Gemma 3 chatml vb.) ===
  chatml: {
    template: 'chatml',
    tokens: {
      system_start: '<|im_start|>system',
      system_end: '<|im_end|>',
      user_start: '<|im_start|>user',
      user_end: '<|im_end|>',
      assistant_start: '<|im_start|>assistant',
      assistant_end: '<|im_end|>',
      stop_generation: ['<|im_end|>', '<|endoftext|>', '</s>']
    }
  },

  // === Llama-2 / Mistrali ===
  llama2: {
    template: 'llama2',
    tokens: {
      system_start: '<<SYS>>',
      system_end: '<</SYS>>',
      user_start: '[INST]',
      user_end: '[/INST]',
      assistant_start: '',
      assistant_end: '</s>',
      stop_generation: ['</s>', '[INST]', '[/INST]']
    }
  },

  // === Alpaca / Instruction format ===
  alpaca: {
    template: 'alpaca',
    tokens: {
      system_start: null,
      system_end: null,
      user_start: '### Instruction:\n',
      user_end: '\n',
      assistant_start: '### Response:\n',
      assistant_end: '',
      stop_generation: ['### Instruction:', '</s>']
    }
  },
  
  // === Llama-3 / 3.1 (header_id + eot_id) ===
  llama3: {
    template: 'llama3',
    tokens: {
      system_start: '<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n',
      system_end: '<|eot_id|>',
      user_start: '<|start_header_id|>user<|end_header_id|>\n\n',
      user_end: '<|eot_id|>',
      assistant_start: '<|start_header_id|>assistant<|end_header_id|>\n\n',
      assistant_end: '<|eot_id|>',
      stop_generation: ['<|eot_id|>', '</s>']
    }
  },

  // === Gemma-2 (start_of_turn / end_of_turn) ===
  gemma2: {
    template: 'gemma2',
    tokens: {
      system_start: '<start_of_turn>system\n',
      system_end: '<end_of_turn>',
      user_start: '<start_of_turn>user\n',
      user_end: '<end_of_turn>',
      assistant_start: '<start_of_turn>model\n',
      assistant_end: '<end_of_turn>',
      stop_generation: ['<end_of_turn>', '</s>']
    }
  },

  // === Anthropic-style (Human/Assistant) ===
  'anthropic-style': {
    template: 'anthropic',
    tokens: {
      system_start: 'System: ',
      system_end: '\n\n',
      user_start: '\n\nHuman: ',
      user_end: '',
      assistant_start: '\n\nAssistant: ',
      assistant_end: '',
      stop_generation: ['\n\nHuman:', '</s>']
    }
  },

  // === Plain Dialogue (User:/Assistant:) ===
  plain_dialogue: {
    template: 'plain_dialogue',
    tokens: {
      system_start: 'System: ',
      system_end: '\n',
      user_start: 'User: ',
      user_end: '\n',
      assistant_start: 'Assistant: ',
      assistant_end: '\n',
      stop_generation: ['\nUser:', '</s>']
    }
  },

  // === Phi-3 / GLM-vari modern rolu etiketleri ===
  'phi-3_glm': {
    template: 'phi3',
    tokens: {
      system_start: '<|system|>\n',
      system_end: '<|end|>\n',
      user_start: '<|user|>\n',
      user_end: '<|end|>\n',
      assistant_start: '<|assistant|>\n',
      assistant_end: '<|end|>\n',
      stop_generation: ['<|end|>', '</s>']
    }
  }
};

// --- MODULE STATE ---
let modelsData = null;
let allManualModels = [];
let currentEditingModelId = null;

// ===================================================================================
// SECTION: FORM MANAGEMENT (CREATE/EDIT FORM)
// ===================================================================================

/**
 * Toggles the visibility of form fields based on the selected model type (Offline/Roleplay).
 */
function handleModelTypeChange() {
    const isOffline = dom.modelTypeSwitch.checked;
    dom.roleplayFields.style.display = isOffline ? 'none' : 'block';
    dom.offlineFields.style.display = isOffline ? 'block' : 'none';

    // Update required status for existing fields
    document.getElementById('model-role').required = !isOffline;
    document.getElementById('model-url').required = isOffline;
    dom.modelSizeInput.required = isOffline;
    dom.modelRamInput.required = isOffline;

    // [NEW] Update required status for new license fields
    document.getElementById('model-creator').required = isOffline;
    document.getElementById('model-license-name').required = isOffline;
    document.getElementById('model-source-name').required = isOffline;
    document.getElementById('model-license-url').required = isOffline;
}

/**
 * Resets the model form to its default state and clears the editing state.
 */
/**
 * Resets the model form to its default state and clears the editing state.
 */
function resetModelForm() {
    dom.modelForm.reset(); // This clears most fields, including the new ones

    // Explicitly clear fields to be safe
    document.querySelectorAll('#offline-fields [data-modality-type]').forEach(checkbox => {
        if (!checkbox.disabled) {
            checkbox.checked = false;
        }
    });

    document.getElementById('model-format-template').value = '';
    document.getElementById('model-token-system-start').value = '';
    document.getElementById('model-token-system-end').value = '';
    document.getElementById('model-token-user-start').value = '';
    document.getElementById('model-token-user-end').value = '';
    document.getElementById('model-token-assistant-start').value = '';
    document.getElementById('model-token-assistant-end').value = '';
    document.getElementById('model-token-stop-generation').value = '';
    document.getElementById('model-token-ignore-regex').value = '';

    // Setting default values after reset if needed
    document.getElementById('model-source-name').value = 'Hugging Face';

    currentEditingModelId = null;
    dom.modelIdInput.disabled = false;
    dom.modelSubmitBtn.textContent = 'Save Model';
    dom.modelCancelBtn.style.display = 'none';
    handleModelTypeChange(); // This is important to hide/show the correct fields
    console.log('[MODELS] Model form has been reset.');
}

/**
 * Populates the model form with the data of an existing model for editing.
 * @param {object} modelData - The model object to edit.
 */
function populateModelFormForEdit(modelData) {
    console.log(`[MODELS] Populating form to edit model: ${modelData.id}`);
    currentEditingModelId = modelData.id;

    // --- Basic Info ---
    dom.modelTypeSwitch.checked = (modelData.type === MODEL_TYPE.OFFLINE);
    handleModelTypeChange();
    dom.modelIdInput.value = modelData.id;
    dom.modelIdInput.disabled = true;
    document.getElementById('model-producer').value = modelData.producer || '';

    // --- Details ---
    document.getElementById('model-title').value = modelData.details.en.title;
    document.getElementById('model-summary').value = modelData.details.en.summary;
    document.getElementById('model-description').value = modelData.details.en.description;

    if (modelData.type === MODEL_TYPE.OFFLINE) {
        document.getElementById('model-url').value = modelData.url || '';
        dom.modelSizeInput.value = modelData.size || '';
        dom.modelRamInput.value = modelData.ram || '';

        // Populate modality and output checkboxes
        const modelModalities = modelData.modalities || {};
        const modelOutputs = modelData.outputs || {};

        document.querySelectorAll('#offline-fields [data-modality-type]').forEach(checkbox => {
            const type = checkbox.dataset.modalityType;
            const key = checkbox.dataset.modalityKey;
            if (type === 'modalities') checkbox.checked = modelModalities[key] === true;
            else if (type === 'outputs' && key !== 'text') checkbox.checked = modelOutputs[key] === true;
        });

        // Populate license info
        const licenseInfo = modelData.licenseInfo || {};
        document.getElementById('model-creator').value = licenseInfo.creator || '';
        document.getElementById('model-license-name').value = licenseInfo.licenseName || '';
        document.getElementById('model-source-name').value = licenseInfo.sourceName || 'Hugging Face';
        document.getElementById('model-license-url').value = licenseInfo.licenseUrl || '';

        const chatFormat = modelData.chatFormat || {};
        const tokens = chatFormat.tokens || {};
        document.getElementById('model-format-template').value = chatFormat.template || '';
        document.getElementById('model-token-system-start').value = tokens.system_start || '';
        document.getElementById('model-token-system-end').value = tokens.system_end || '';
        document.getElementById('model-token-user-start').value = tokens.user_start || '';
        document.getElementById('model-token-user-end').value = tokens.user_end || '';
        document.getElementById('model-token-assistant-start').value = tokens.assistant_start || '';
        document.getElementById('model-token-assistant-end').value = tokens.assistant_end || '';
        document.getElementById('model-token-stop-generation').value = (tokens.stop_generation || []).join(', ');
        document.getElementById('model-token-ignore-regex').value = tokens.ignore_regex || '';

        const tplKey = chatFormat.template;
        const allEmpty =
            !tokens.system_start && !tokens.system_end &&
            !tokens.user_start && !tokens.user_end &&
            !tokens.assistant_start && !tokens.assistant_end &&
            (!tokens.stop_generation || tokens.stop_generation.length === 0);
        if (tplKey && allEmpty) applyChatTemplateToForm(tplKey);

    } else { // Roleplay
        document.getElementById('model-role').value = modelData.details.en.role || '';
    }

    // --- Final UI Setup ---
    document.getElementById('model-image').value = '';
    showToast(`Editing: ${modelData.details.en.title}. Re-upload image to change it.`, 'info');
    dom.modelSubmitBtn.textContent = 'Update Model';
    dom.modelCancelBtn.style.display = 'inline-block';
    dom.modelForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Handles the submission of the model form for both creating and updating models.
 * Communicates with the Curator API via POST (create) or PUT (update).
 * @param {Event} e - The form submission event.
 */
async function handleModelFormSubmit(e) {
    e.preventDefault();
    dom.modelSubmitBtn.disabled = true;
    dom.modelSubmitBtn.textContent = currentEditingModelId ? 'UPDATING...' : 'SAVING...';

    const modelId = dom.modelIdInput.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    if (!modelId) {
        showToast("Model ID is required and must be a valid slug.", 'error');
        dom.modelSubmitBtn.disabled = false;
        dom.modelSubmitBtn.textContent = currentEditingModelId ? 'Update Model' : 'Save Model';
        return;
    }

    try {
        const token = await getAuthToken(auth);
        const modelImageFile = document.getElementById('model-image').files[0];
        const originalModel = currentEditingModelId ? allManualModels.find(m => m.id === currentEditingModelId) : null;
        let imagePath = originalModel ? originalModel.imagePath : null;

        if (modelImageFile) {
            showToast("Requesting secure upload link...", 'info');
            const modelTypeDir = dom.modelTypeSwitch.checked ? MODEL_TYPE.OFFLINE : MODEL_TYPE.ROLEPLAY;
            const result = await getModelImageUploadUrlFn({ modelId, modelType: modelTypeDir, fileName: modelImageFile.name, contentType: modelImageFile.type });
            imagePath = result.data.filePath;
            showToast("Uploading model image...", 'info');
            await fetch(result.data.signedUrl, { method: 'PUT', body: modelImageFile, headers: { 'Content-Type': modelImageFile.type } });
        }


        const isOffline = dom.modelTypeSwitch.checked;
        let modalities = null, outputs = null, licenseInfo = null, chatFormat = null;

        if (isOffline) {
            // Gather modalities and outputs
            modalities = {};
            outputs = { text: true };
            document.querySelectorAll('#offline-fields [data-modality-type]').forEach(checkbox => {
                const type = checkbox.dataset.modalityType;
                const key = checkbox.dataset.modalityKey;
                if (type === 'modalities') modalities[key] = checkbox.checked;
                else if (type === 'outputs' && key !== 'text') outputs[key] = checkbox.checked;
            });

            // Gather license info
            licenseInfo = {
                creator: document.getElementById('model-creator').value.trim(),
                licenseName: document.getElementById('model-license-name').value.trim(),
                sourceName: document.getElementById('model-source-name').value.trim(),
                licenseUrl: document.getElementById('model-license-url').value.trim()
            };

            const stopTokens = document.getElementById('model-token-stop-generation').value
                .split(',')
                .map(t => t.trim())
                .filter(Boolean);

            chatFormat = {
                template: document.getElementById('model-format-template').value.trim() || null,
                tokens: {
                    system_start: document.getElementById('model-token-system-start').value || null,
                    system_end: document.getElementById('model-token-system-end').value || null,
                    user_start: document.getElementById('model-token-user-start').value || null,
                    user_end: document.getElementById('model-token-user-end').value || null,
                    assistant_start: document.getElementById('model-token-assistant-start').value || null,
                    assistant_end: document.getElementById('model-token-assistant-end').value || null,
                    stop_generation: stopTokens.length > 0 ? stopTokens : null,
                    ignore_regex: document.getElementById('model-token-ignore-regex').value.trim() || null,
                }
            };

            if (Object.values(chatFormat.tokens).every(v => v === null || (Array.isArray(v) && v.length === 0))) {
                chatFormat.tokens = null;
            }

            if (!chatFormat.template && !chatFormat.tokens) {
                chatFormat = null;
            }
        }

        // Build the final payload
        const modelPayload = {
            id: modelId,
            type: isOffline ? MODEL_TYPE.OFFLINE : MODEL_TYPE.ROLEPLAY,
            producer: document.getElementById('model-producer').value.trim(),
            details: {
                en: {
                    title: document.getElementById('model-title').value.trim(),
                    summary: document.getElementById('model-summary').value.trim(),
                    description: document.getElementById('model-description').value.trim(),
                    role: isOffline ? null : document.getElementById('model-role').value.trim(),
                }
            },
            imagePath: imagePath,
            url: isOffline ? document.getElementById('model-url').value.trim() : null,
            size: isOffline ? (parseInt(dom.modelSizeInput.value, 10) || null) : null,
            ram: isOffline ? (parseInt(dom.modelRamInput.value, 10) || null) : null,
            modalities: modalities,
            outputs: outputs,
            licenseInfo: licenseInfo,
            chatFormat: chatFormat,
        };

        const endpoint = currentEditingModelId ? `${CURATOR_API_URL}/${modelId}` : CURATOR_API_URL;
        const method = currentEditingModelId ? 'PUT' : 'POST';

        const response = await fetch(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(modelPayload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API operation failed with status ${response.status}`);
        }

        const result = await response.json();
        showToast(result.message, 'success');
        if (isOffline) setAttributionsOutOfSync();
        resetModelForm();
        await fetchFullModelsData();

    } catch (error) {
        console.error("[MODELS] Error saving model:", error);
        showToast(`Error: ${error.message || "An unknown error occurred."}`, 'error');
    } finally {
        dom.modelSubmitBtn.disabled = false;
        // Button text is reset by resetModelForm()
    }
}

function applyChatTemplateToForm(templateKey) {
    const sel = document.getElementById('model-format-template');
    const sysS = document.getElementById('model-token-system-start');
    const sysE = document.getElementById('model-token-system-end');
    const usrS = document.getElementById('model-token-user-start');
    const usrE = document.getElementById('model-token-user-end');
    const asS = document.getElementById('model-token-assistant-start');
    const asE = document.getElementById('model-token-assistant-end');
    const stop = document.getElementById('model-token-stop-generation');

    if (!templateKey) {
        sysS.value = sysE.value = usrS.value = usrE.value = asS.value = asE.value = '';
        stop.value = '';
        return;
    }

    const tpl = CHAT_TEMPLATES[templateKey];
    if (!tpl) return;

    sel.value = templateKey;
    const t = tpl.tokens || {};
    sysS.value = t.system_start ?? '';
    sysE.value = t.system_end ?? '';
    usrS.value = t.user_start ?? '';
    usrE.value = t.user_end ?? '';
    asS.value = t.assistant_start ?? '';
    asE.value = t.assistant_end ?? '';
    stop.value = Array.isArray(t.stop_generation) ? t.stop_generation.join(', ') : (t.stop_generation || '');
}

// ===================================================================================
// SECTION: DATA FETCHING AND RENDERING
// ===================================================================================

/**
 * Renders the list of live manual models and updates the count badges.
 */
function renderManualModelsList() {
    const offlineCountBadge = document.getElementById('offline-model-count-badge');
    const roleplayCountBadge = document.getElementById('roleplay-model-count-badge');

    let offlineCount = 0;
    let roleplayCount = 0;

    if (allManualModels && allManualModels.length > 0) {
        for (const model of allManualModels) {
            if (model.type === MODEL_TYPE.OFFLINE) {
                offlineCount++;
            } else if (model.type === MODEL_TYPE.ROLEPLAY) {
                roleplayCount++;
            }
        }
    }

    if (offlineCountBadge && roleplayCountBadge) {
        offlineCountBadge.textContent = `Offline: ${offlineCount}`;
        roleplayCountBadge.textContent = `Roleplay: ${roleplayCount}`;
    }

    dom.manualModelsListContainer.innerHTML = '';
    if (!allManualModels || allManualModels.length === 0) {
        dom.manualModelsListContainer.innerHTML = '<p class="form-hint">No manual models found.</p>';
        return;
    }

    allManualModels.forEach(model => {
        const item = document.createElement('div');
        item.className = 'model-item';

        const titleText = model.details.en.title || 'Untitled';
        const modelType = model.type || 'unknown';

        item.innerHTML = `
            <div class="item-details">
                <span class="item-title">${sanitizeHTML(titleText)}</span>
                <span class="model-type-badge ${sanitizeHTML(modelType)}">${sanitizeHTML(modelType)}</span>
            </div>
            <div class="item-actions">
                <button class="edit-btn" data-id="${sanitizeHTML(model.id)}">Edit</button>
                <button class="translations-btn" data-id="${sanitizeHTML(model.id)}">Translations</button>
                <button class="delete-btn" data-id="${sanitizeHTML(model.id)}">Delete</button>
            </div>`;
        dom.manualModelsListContainer.appendChild(item);
    });
}

/**
 * Renders the collapsible explorer view for all models in the database.
 * Uses a template string with sanitized data to prevent XSS vulnerabilities.
 */
function renderAllModelsExplorer() {
    if (!modelsData || !modelsData.producers) {
        dom.allModelsListContainer.innerHTML = '<p class="form-hint">Model database is empty or invalid.</p>';
        return;
    }
    let explorerHTML = '';
    for (const pName of Object.keys(modelsData.producers).sort()) {
        explorerHTML += `<details class="producer-group"><summary>${sanitizeHTML(pName)}</summary><div class="details-content">`;
        for (const sName of Object.keys(modelsData.producers[pName]).sort()) {
            if (sName === 'series_description') continue;
            const seriesObj = modelsData.producers[pName][sName];
            const isHidden = seriesObj.hidden === true;
            explorerHTML += `<details class="series-group ${isHidden ? 'hidden-series' : ''}">
                <summary>
                    <span class="series-name">${sanitizeHTML(sName)} ${isHidden ? '(Hidden)' : ''}</span>
                    <div class="series-actions">
                        <button class="edit-series-desc-btn" data-pname="${sanitizeHTML(pName)}" data-sname="${sanitizeHTML(sName)}">Edit Desc</button>
                        <button class="${isHidden ? 'unhide-series-btn' : 'hide-series-btn'}" data-pname="${sanitizeHTML(pName)}" data-sname="${sanitizeHTML(sName)}">${isHidden ? 'Unhide' : 'Hide'}</button>
                    </div>
                </summary>
                <div class="details-content">`;

            if (!isHidden) {
                for (const vName of Object.keys(seriesObj).sort()) {
                    if (['series_description', 'hidden'].includes(vName)) continue;
                    const model = seriesObj[vName];
                    const hasDesc = (model.source === 'manual' && model.details?.en?.title) || (model.description?.en);
                    explorerHTML += `<div class="model-item variant-item">
                        <div class="variant-details">
                            <span class="model-title">${sanitizeHTML(vName)}</span>
                            <span class="model-id-label">${sanitizeHTML(model.id)}</span>
                        </div>
                        <div class="item-actions">
                            <button class="translations-btn" data-pname="${sanitizeHTML(pName)}" data-sname="${sanitizeHTML(sName)}" data-vname="${sanitizeHTML(vName)}" ${!hasDesc ? 'disabled' : ''}>Translations</button>
                            ${model.source === 'openrouter' ? `<button class="block-btn" data-id="${sanitizeHTML(model.id)}" title="Permanently block this model.">🚫 Block</button>` : ''}
                        </div>
                    </div>`;
                }
            }
            explorerHTML += `</div></details>`;
        }
        explorerHTML += `</div></details>`;
    }
    dom.allModelsListContainer.innerHTML = explorerHTML;
}


/**
 * Helper function to generate standardized loading animation HTML.
 * @param {string} text - The text to display below the loader.
 * @returns {string} The HTML string for the loader.
 */
function createLoaderHTML(text) {
    return `
        <div class="content-loader-wrapper">
            <svg class="loader-logo" viewBox="0 0 100 100">
                <polygon class="logo-bg" points="50,15 95,85 5,85"></polygon>
                <polygon class="logo-line" points="50,15 95,85 5,85"></polygon>
            </svg>
            <p>${sanitizeHTML(text)}</p>
        </div>
    `;
}

/**
 * Fetches the complete models.json database, processes it to find manual models
 * and warnings, and then triggers the rendering of all relevant UI components.
 */
export async function fetchFullModelsData() {
    console.log('[MODELS] Fetching full models database...');

    // Display animated loaders while data is being fetched.
    dom.manualModelsListContainer.innerHTML = createLoaderHTML('Loading Manual Models...');
    dom.allModelsListContainer.innerHTML = createLoaderHTML('Loading Full Database...');

    try {
        const response = await fetch(FULL_DB_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        modelsData = await response.json();
        console.log('[MODELS] Full models database loaded.');

        const manualModels = [];

        if (modelsData?.producers) {
            for (const pName in modelsData.producers) {
                for (const sName in modelsData.producers[pName]) {
                    if (sName === 'series_description') continue;
                    for (const vName in modelsData.producers[pName][sName]) {
                        if (['series_description', 'hidden'].includes(vName)) continue;

                        const model = modelsData.producers[pName][sName][vName];
                        if (!model || !model.id) continue;

                        if (model.source === 'manual') {
                            manualModels.push(model);
                        }
                    }
                }
            }
        }

        allManualModels = manualModels;

        allManualModels.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === MODEL_TYPE.OFFLINE ? -1 : 1;
            }

            const titleA = a.details?.en?.title.toLowerCase() || a.id;
            const titleB = b.details?.en?.title.toLowerCase() || b.id;
            return titleA.localeCompare(titleB);
        });

        // --- Render final content, replacing the loaders ---
        window.loadedManualModels = allManualModels;
        window.loadedAllModels = modelsData;
        renderManualModelsList();
        renderAllModelsExplorer();

        console.log(`[MODELS] Derived and sorted ${allManualModels.length} manual models from database.`);

    } catch (error) {
        console.error('[MODELS] Critical error fetching models data:', error);
        showToast("Could not load the main models database. Editing is disabled.", "error");
        modelsData = null;
        allManualModels = [];

        const errorHTML = `<p class="form-hint" style="color:var(--error-color);">Failed to load data. Please refresh.</p>`;
        dom.manualModelsListContainer.innerHTML = errorHTML;
        dom.allModelsListContainer.innerHTML = errorHTML;
    }
}

// ===================================================================================
// SECTION: ACTIONS AND MODALS
// ===================================================================================

/**
 * Handles saving translations for a specific model variant via the Curator API.
 * [UPDATED v3.1] Added extensive logging to trace "String vs Object" data conflicts.
 * @param {object} modelPath - Object with {pName, sName, vName}.
 * @param {HTMLFormElement} formElement - The form element containing the translations.
 * @param {string} modelSource - The source of the model ('manual' or 'openrouter').
 */
async function handleSaveSeriesDescription(seriesPath, formElement) {
    const saveButton = formElement.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = 'SAVING';

    const { pName, sName } = seriesPath;
    console.log(`[MODELS_DEBUG] [SeriesDesc] Starting save for ${pName}/${sName}`);

    const formData = new FormData(formElement);
    const updates = [];
    const seriesObj = modelsData.producers[pName][sName];
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
        showToast("No changes detected.", "info");
        saveButton.disabled = false;
        saveButton.textContent = 'Save Series Descriptions';
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

        showToast('Series descriptions updated successfully (Local & Remote)!', 'success');
        document.body.removeChild(document.getElementById('translation-modal-overlay'));
        
    } catch (error) {
        console.error('[MODELS_DEBUG] Error:', error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Series Descriptions';
    }
}

/**
 * Handles saving translations via Batch API and updates LOCAL STATE immediately.
 * [UPDATED v3.3] Optimistic UI Update + Batch API
 */
async function handleSaveTranslations(modelPath, formElement, modelSource) {
    const saveButton = formElement.querySelector('button[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = 'SAVING...';

    const { pName, sName, vName } = modelPath;
    console.log(`[MODELS_DEBUG] [Translations] Starting save for ${pName}/${sName}/${vName}`);

    const modelVariant = modelsData?.producers?.[pName]?.[sName]?.[vName];
    if (!modelVariant) {
        showToast("Error: Model not found locally.", 'error');
        saveButton.disabled = false;
        return;
    }

    const formData = new FormData(formElement);
    const updates = [];

    for (const [key, value] of formData.entries()) {
        const match = key.match(/^trans-(.+?)-(.+)$/);
        if (!match) continue;
        const [, lang, fieldKey] = match;

        const rootObj = modelSource === 'manual' ? modelsData.producers[pName][sName][vName].details : modelsData.producers[pName][sName][vName];
        
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
        showToast("No changes detected.", "info");
        saveButton.disabled = false;
        saveButton.textContent = 'Save Translations';
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
            
            let currentRef = modelsData.producers[pName][sName][vName];

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
            const manualIndex = allManualModels.findIndex(m => m.id === modelVariant.id);
            if (manualIndex !== -1) {
                 allManualModels[manualIndex] = modelsData.producers[pName][sName][vName];
                 renderManualModelsList(); 
            }
        }

        document.body.removeChild(document.getElementById('translation-modal-overlay'));
        
        const count = Math.round(updates.length / 3);
        showToast(`Success! ${count} translations updated locally & remotely.`, 'success');

    } catch (error) {
        console.error('[MODELS_DEBUG] Error:', error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Translations';
    }
}

/**
 * Opens a modal window for editing the descriptions of a model series.
 * @param {object} seriesPath - An object containing {pName, sName}.
 */
function openDescriptionEditor(seriesPath) {
    const { pName, sName } = seriesPath;
    const seriesObj = modelsData?.producers?.[pName]?.[sName];
    if (!seriesObj) return showToast(`Could not find series: ${pName}/${sName}`, "error");

    const descObj = seriesObj.series_description || {};
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'translation-modal-overlay';
    modalOverlay.className = 'modal-overlay';

    let formHTML = `<div class="modal-content"><button class="modal-close-btn">×</button><h2>Edit Series Description for "${sanitizeHTML(sName)}"</h2><form id="series-desc-form">`;
    formHTML += `<div class="translation-field-group"><h4>Description Texts</h4>`;

    const englishValue = descObj.en || '';
    formHTML += `<label for="trans-en-description">English (Source)</label><textarea id="trans-en-description" name="trans-en-description" rows="3">${sanitizeHTML(englishValue)}</textarea>`;

    TARGET_LANGUAGES.forEach(lang => {
        const langName = new Intl.DisplayNames(['en'], { type: 'language' }).of(lang);
        const currentValue = descObj[lang] || '';
        formHTML += `<label for="trans-${lang}-description">${sanitizeHTML(langName)}</label><textarea id="trans-${lang}-description" name="trans-${lang}-description" rows="3">${sanitizeHTML(currentValue)}</textarea>`;
    });

    formHTML += `</div><button type="submit">Save Series Descriptions</button></form></div>`;
    modalOverlay.innerHTML = formHTML;
    document.body.appendChild(modalOverlay);
    modalOverlay.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        handleSaveSeriesDescription(seriesPath, e.currentTarget);
    });
    modalOverlay.addEventListener('click', e => e.target === modalOverlay && document.body.removeChild(modalOverlay));
    modalOverlay.querySelector('.modal-close-btn').addEventListener('click', () => document.body.removeChild(modalOverlay));
}

/**
 * Handles the deletion of a manual model via the Curator API.
 * @param {string} id - The ID of the model to delete.
 */
async function handleDeleteModel(id) {
    const modelToDelete = allManualModels.find(m => m.id === id);
    if (!modelToDelete || !confirm(`Delete "${modelToDelete.details.en.title}"? This cannot be undone.`)) return;

    showToast(`Deleting model: ${id}`, 'info');
    try {
        const token = await getAuthToken(auth);
        const response = await fetch(`${CURATOR_API_URL}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error((await response.json()).error || 'API delete failed');

        if (modelToDelete.imagePath) {
            try { await storage.ref(modelToDelete.imagePath).delete(); } catch (storageError) { console.warn(`[MODELS] Could not delete image from storage: ${storageError.message}`); }
        }

        //  If the deleted model was an offline model, flag attributions.
        if (modelToDelete.type === MODEL_TYPE.OFFLINE) {
            setAttributionsOutOfSync();
        }

        if (currentEditingModelId === id) resetModelForm();
        showToast(`Model "${id}" was successfully deleted.`, 'success');
        await fetchFullModelsData();
    } catch (error) {
        console.error(`[MODELS] Error deleting model ${id}:`, error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Calls the Firebase Function to permanently block an online model from the Syncer.
 * @param {string} modelId - The ID of the model to block (e.g., "openai/gpt-4").
 */
async function handleBlockOnlineModel(modelId) {
    if (!confirm(`Permanently block "${modelId}"? This is irreversible from the UI.`)) return;
    showToast(`Blocking model: ${modelId}`, 'info');
    try {
        const result = await blockOnlineModelFn({ modelId });
        showToast(result.data.message, 'success');
        await fetchFullModelsData();
    } catch (error) {
        console.error(`[MODELS] Error blocking model ${modelId}:`, error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Sends a granular update to the Curator API to change a series property (e.g., 'hidden').
 * @param {object} seriesPath - Object containing {pName, sName}.
 * @param {string} property - The property to update (e.g., "hidden").
 * @param {*} value - The new value for the property.
 */
async function updateSeriesProperty(seriesPath, property, value) {
    const { pName, sName } = seriesPath;
    const action = property === 'hidden' ? (value ? 'Hiding' : 'Unhiding') : 'Updating';
    showToast(`${action} series: ${sName}`, 'info');

    try {
        const token = await getAuthToken(auth);
        const payload = { pName, sName, fieldPath: property, value };
        const response = await fetch(`${CURATOR_API_URL}/update-list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to update series property.');

        showToast(`Series '${sName}' updated.`, 'success');
        await fetchFullModelsData();
    } catch (error) {
        console.error(`[MODELS] Error ${action.toLowerCase()} series ${sName}:`, error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

/**
 * Opens a modal for editing the translations of a model variant.
 * @param {object} modelPath - Object containing {pName, sName, vName}.
 */
function openTranslationEditor(modelPath) {
    const { pName, sName, vName } = modelPath;
    const modelObj = modelsData?.producers?.[pName]?.[sName]?.[vName];
    if (!modelObj) return showToast(`Could not find model: ${pName}/${sName}/${vName}`, "error");

    let englishDetails, detailsObject, translatableFields;
    if (modelObj.source === 'manual' && modelObj.details) {
        detailsObject = modelObj.details;
        englishDetails = modelObj.details.en;
        translatableFields = [{ k: 'title' }, { k: 'summary' }, { k: 'description', t: 'textarea' }, { k: 'role', t: 'textarea' }];
    } else if (modelObj.description) {
        detailsObject = modelObj.description;
        englishDetails = { description: modelObj.description.en };
        translatableFields = [{ k: 'description', t: 'textarea' }];
    } else {
        return showToast("This model has no translatable text.", "info");
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'translation-modal-overlay';
    modalOverlay.className = 'modal-overlay';
    let formHTML = `<div class="modal-content"><button class="modal-close-btn">×</button><h2>Translations for "${sanitizeHTML(vName)}"</h2><form>`;
    translatableFields.forEach(field => {
        if (!englishDetails[field.k]) return;
        formHTML += `<div class="translation-field-group"><h4>${sanitizeHTML(field.k.charAt(0).toUpperCase() + field.k.slice(1))} (EN)</h4><p class="source-text">${sanitizeHTML(englishDetails[field.k])}</p>`;
        TARGET_LANGUAGES.forEach(lang => {
            const val = (typeof detailsObject[lang] === 'object' ? detailsObject[lang][field.k] : detailsObject[lang]) || '';
            const id = `trans-${lang}-${field.k}`;
            const langName = new Intl.DisplayNames(['en'], { type: 'language' }).of(lang);
            formHTML += `<label for="${id}">${sanitizeHTML(langName)}</label>`;
            formHTML += field.t === 'textarea' ? `<textarea id="${id}" name="${id}">${sanitizeHTML(val)}</textarea>` : `<input type="text" id="${id}" name="${id}" value="${sanitizeHTML(val)}">`;
        });
        formHTML += `</div>`;
    });
    formHTML += `<button type="submit">Save Translations</button></form></div>`;
    modalOverlay.innerHTML = formHTML;
    document.body.appendChild(modalOverlay);
    modalOverlay.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        handleSaveTranslations(modelPath, e.currentTarget, modelObj.source);
    });
    modalOverlay.addEventListener('click', e => e.target === modalOverlay && document.body.removeChild(modalOverlay));
    modalOverlay.querySelector('.modal-close-btn').addEventListener('click', () => document.body.removeChild(modalOverlay));
}

// ===================================================================================
// SECTION: INITIALIZATION
// ===================================================================================

/**
 * Initializes all event listeners for the models module.
 */
export function initModelsModule() {
    dom.modelForm.addEventListener('submit', handleModelFormSubmit);
    dom.modelTypeSwitch.addEventListener('change', handleModelTypeChange);
    dom.modelCancelBtn.addEventListener('click', resetModelForm);

    document.getElementById('model-format-template')
        .addEventListener('change', (e) => {
            const key = e.target.value;
            applyChatTemplateToForm(key);
            showToast(key ? `Applied template: ${key}` : 'Template cleared.', key ? 'success' : 'info');
        });

    dom.manualModelsListContainer.addEventListener('click', (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('edit-btn')) {
            const modelToEdit = allManualModels.find(m => m.id === id);
            if (modelToEdit) populateModelFormForEdit(modelToEdit);
        } else if (target.classList.contains('delete-btn')) {
            handleDeleteModel(id);
        } else if (target.classList.contains('translations-btn')) {
            if (!modelsData?.producers) {
                showToast('Models not loaded yet. Please refresh.', 'error');
                return;
            }
            let opened = false;
            for (const pName in modelsData.producers) {
                if (modelsData.producers[pName][id]?.['Default']?.source === 'manual') {
                    openTranslationEditor({ pName, sName: id, vName: 'Default' });
                    opened = true;
                    break;
                }
            }
            if (!opened) showToast('No translatable manual entry found for this model.', 'info');
        }
    });

    // Use event delegation on the admin panel for dynamically created buttons
    dom.adminPanel.addEventListener('click', (e) => {
        const target = e.target;

        const translationsBtn = target.closest('.translations-btn');
        if (translationsBtn && translationsBtn.dataset.pname) {
            const { pname, sname, vname } = translationsBtn.dataset;
            openTranslationEditor({ pName: pname, sName: sname, vName: vname });
            return;
        }

        const blockBtn = target.closest('.block-btn');
        if (blockBtn?.dataset.id) {
            handleBlockOnlineModel(blockBtn.dataset.id);
            return;
        }

        const editSeriesBtn = target.closest('.edit-series-desc-btn');
        if (editSeriesBtn?.dataset.pname) {
            const { pname, sname } = editSeriesBtn.dataset;
            openDescriptionEditor({ pName: pname, sName: sname });
            return;
        }

        const hideSeriesBtn = target.closest('.hide-series-btn');
        if (hideSeriesBtn?.dataset.pname) {
            const { pname, sname } = hideSeriesBtn.dataset;
            updateSeriesProperty({ pName: pname, sName: sname }, 'hidden', true);
            return;
        }

        const unhideSeriesBtn = target.closest('.unhide-series-btn');
        if (unhideSeriesBtn?.dataset.pname) {
            const { pname, sname } = unhideSeriesBtn.dataset;
            updateSeriesProperty({ pName: pname, sName: sname }, 'hidden', null);
        }
    });
}