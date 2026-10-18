import { crossfade } from '../ui/transition.js';
import { beginPanelLoading, skeletonListItem, skeletonChatMessage, setButtonLoading } from '../utils/loading.js';
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

import { storage, getModelImageUploadUrlFn, blockOnlineModelFn, updateModelsListFn, auth } from '../core/firebase.js';
import * as dom from '../utils/dom.js';
import { showToast, userErrorMessage, __, getLang, onLangChange, getAuthToken, sanitizeHTML, simpleHash } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
import { openDrawer, openModal, closeModal, openPopover, closePopover, confirmDialog } from './shell.js';
import { isPanelAdmin, getEffectivePanelLevel } from './roles.js';
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
    dom.modelSubmitBtn.textContent = __('models.save_btn');
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
    showToast(() => __('models.edit_hint'), 'info');
    dom.modelSubmitBtn.textContent = __('models.update_btn');
    dom.modelCancelBtn.style.display = 'inline-block';
    dom.modelForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Handles the submission of the model form for both creating and updating models.
 * Communicates with the Curator API via POST (create) or PUT (update).
 * @param {Event} e - The form submission event.
 */
async function handleModelFormSubmit(e) {
    if (!canEditModels("models.manage")) return;
    e.preventDefault();
    if(dom.modelSubmitBtn.disabled)return;
    setButtonLoading(dom.modelSubmitBtn,true);
    dom.modelSubmitBtn.textContent = __('system.saving');

    const modelId = dom.modelIdInput.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    if (!modelId) {
        showToast(() => __('models.slug_error'), 'error');
        setButtonLoading(dom.modelSubmitBtn,false);
        dom.modelSubmitBtn.textContent = currentEditingModelId ? __('models.update_btn') : __('models.save_btn');
        return;
    }

    try {
        const token = await getAuthToken(auth);
        const modelImageFile = document.getElementById('model-image').files[0];
        const originalModel = currentEditingModelId ? allManualModels.find(m => m.id === currentEditingModelId) : null;
        let imagePath = originalModel ? originalModel.imagePath : null;

        if (modelImageFile) {
            showToast(() => __('models.upload_link'), 'info');
            const modelTypeDir = dom.modelTypeSwitch.checked ? MODEL_TYPE.OFFLINE : MODEL_TYPE.ROLEPLAY;
            const result = await getModelImageUploadUrlFn({ modelId, modelType: modelTypeDir, fileName: modelImageFile.name, contentType: modelImageFile.type });
            imagePath = result.data.filePath;
            showToast(() => __('models.upload_image'), 'info');
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
        showToast(()=>__('models.saved'),'success');
        if (isOffline) setAttributionsOutOfSync();
        resetModelForm();
        await fetchFullModelsData();

    } catch (error) {
        console.error("[MODELS] Error saving model:", error);
        showToast(() => __('system.error'), 'error');
    } finally {
        setButtonLoading(dom.modelSubmitBtn,false);
        dom.modelSubmitBtn.textContent=__(currentEditingModelId?'models.update_btn':'models.save_btn');
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
        offlineCountBadge.textContent = `${__('models.offline_count')} ${offlineCount}`;
        roleplayCountBadge.textContent = `${__('models.roleplay_count')} ${roleplayCount}`;
    }

    crossfade(dom.manualModelsListContainer, () => {
    dom.manualModelsListContainer.innerHTML = '';
    if (!allManualModels || allManualModels.length === 0) {
        dom.manualModelsListContainer.innerHTML = `<p class="form-hint" data-i18n="models.no_models">${__('models.no_models')}</p>`;
        return;
    }

    allManualModels.forEach(model => {
        const item = document.createElement('div');
        item.className = 'model-item';

        const titleText = model.details?.[document.documentElement.lang]?.title || model.details?.en?.title || model.id;
        const modelType = model.type || 'unknown';

        item.innerHTML = `
            <div class="item-details">
                <span class="item-title">${sanitizeHTML(titleText)}</span>
                <span class="model-type-badge ${sanitizeHTML(modelType)}">${sanitizeHTML(modelType)}</span>
            </div>
            <div class="item-actions">
                <button class="edit-btn" data-id="${sanitizeHTML(model.id)}">${__('common.edit')}</button>
                <button class="translations-btn" data-id="${sanitizeHTML(model.id)}">${__('common.translations')}</button>
                <button class="delete-btn" data-id="${sanitizeHTML(model.id)}">${__('common.delete')}</button>
            </div>`;
        dom.manualModelsListContainer.appendChild(item);
    });
    compactModelActions(dom.manualModelsListContainer);
    });
}

/**
 * Renders the collapsible explorer view for all models in the database.
 * Uses a template string with sanitized data to prevent XSS vulnerabilities.
 */
// An indexed, lazily rendered catalogue. Filters share one source and never
// trigger network requests; collapsed groups do not allocate model-row DOM.
let catalogGroups=[],catalogRows=[],catalogQuery='',catalogLimit=120;
let catalogSelection=new Set(),catalogFingerprint=null,filtersReady=false;
const openProducerGroups=new Set(),openSeriesGroups=new Set();
const catalogText=(tr,en)=>getLang()==='tr'?tr:en;
const catalogType=row=>String(row.model.type||row.model.source||'unknown').toLowerCase();
const catalogStatus=row=>{
    const value=row.model.publish_status ?? row.model.publicationStatus ?? row.model.status;
    if(typeof value==='string'&&value.trim())return value.toLowerCase();
    if(row.model.published===true)return 'published';
    if(row.model.published===false)return 'draft';
    return 'unspecified';
};
function buildCatalogIndex(){
    catalogGroups=[];catalogRows=[];
    for(const pName of Object.keys(modelsData?.producers||{}).sort()){
        const producer=modelsData.producers[pName],group={pName,series:[]};
        for(const sName of Object.keys(producer).sort()){
            if(sName==='series_description')continue;
            const source=producer[sName];
            if(!source||typeof source!=='object')continue;
            const series={sName,hidden:source.hidden===true,rows:[]};
            for(const vName of Object.keys(source).sort()){
                if(['series_description','hidden'].includes(vName))continue;
                const model=source[vName];if(!model||typeof model!=='object'||!model.id)continue;
                const row={pName,sName,vName,model,hidden:series.hidden||model.hidden===true,index:catalogRows.length};
                series.rows.push(row);catalogRows.push(row);
            }
            group.series.push(series);
        }
        catalogGroups.push(group);
    }
    catalogSelection.clear();
}
function modelVariantHTML(row,selectable=false){
    const model=row.model;
    const hasDesc=(model.source==='manual'&&model.details?.en?.title)||model.description?.en;
    const title=model.details?.[getLang()]?.title||model.details?.en?.title||row.vName;
    return `<div class="model-item variant-item" data-catalog-index="${row.index}">
        ${selectable?`<label class="model-select-label"><input class="model-select" type="checkbox" data-select-model="${row.index}" ${catalogSelection.has(row.index)?'checked':''} aria-label="${sanitizeHTML(title)}"></label>`:''}
        <div class="variant-details"><span class="model-title">${sanitizeHTML(title)}</span><span class="model-id-label">${sanitizeHTML(model.id)}</span><small>${sanitizeHTML(row.pName)} / ${sanitizeHTML(row.sName)} · ${sanitizeHTML(catalogType(row))} · ${sanitizeHTML(catalogStatus(row))}${row.hidden?' · '+catalogText('Gizli','Hidden'):''}</small></div>
        <div class="item-actions">
          <button type="button" class="translations-btn" data-pname="${sanitizeHTML(row.pName)}" data-sname="${sanitizeHTML(row.sName)}" data-vname="${sanitizeHTML(row.vName)}" ${!hasDesc?'disabled':''}>${__('common.translations')}</button>
          ${model.source==='openrouter'?`<button type="button" class="block-btn" data-id="${sanitizeHTML(model.id)}">${__('models.block')}</button>`:''}
        </div></div>`;
}
function filteredCatalogRows(){
    const toolbar=document.getElementById('model-catalog-filters');
    if(!toolbar)return null;
    const q=String(toolbar.querySelector('[data-catalog-search]')?.value||'').trim().toLocaleLowerCase();
    const provider=toolbar.querySelector('[data-catalog-provider]')?.value||'';
    const type=toolbar.querySelector('[data-catalog-type]')?.value||'';
    const status=toolbar.querySelector('[data-catalog-status]')?.value||'';
    const visibility=toolbar.querySelector('[data-catalog-visibility]')?.value||'';
    if(!q&&!provider&&!type&&!status&&!visibility)return null;
    return catalogRows.filter(row=>{
        if(provider&&row.pName!==provider)return false;
        if(type&&catalogType(row)!==type)return false;
        if(status&&catalogStatus(row)!==status)return false;
        if(visibility==='visible'&&row.hidden)return false;
        if(visibility==='hidden'&&!row.hidden)return false;
        if(!q)return true;
        const titles=Object.values(row.model.details||{}).filter(x=>x&&typeof x==='object').map(x=>x.title||'');
        const searchable=[...titles,row.vName,row.model.id,row.pName,row.sName,row.model.provider,catalogType(row),catalogStatus(row)].join(' ').toLocaleLowerCase();
        return searchable.includes(q);
    });
}
function renderCatalogFiltered(rows){
    const visible=rows.slice(0,catalogLimit);
    const status=`<p class="form-hint" role="status" aria-live="polite">${rows.length} ${catalogText('model eşleşiyor','matching models')}</p>`;
    dom.allModelsListContainer.innerHTML=status+visible.map(row=>modelVariantHTML(row,true)).join('')+(rows.length>visible.length?`<button type="button" class="chrome-btn-outline model-show-more" data-catalog-more>${catalogText('Daha fazla göster','Show more')} (${rows.length-visible.length})</button>`:'');
    compactModelActions(dom.allModelsListContainer);
    updateCatalogSelection();
}
function updateCatalogSelection(){
    const count=document.getElementById('model-catalog-selection-count');
    if(count)count.textContent=`${catalogSelection.size} ${catalogText('seçili','selected')}`;
    const copy=document.getElementById('model-catalog-copy');
    if(copy)copy.disabled=!catalogSelection.size;
}
function fillCatalogSeries(details,limit=80){
    const gi=Number(details.dataset.groupIndex),si=Number(details.dataset.seriesIndex);
    const series=catalogGroups[gi]?.series[si],content=details.querySelector('.details-content');
    if(!series||!content)return;
    const visible=series.rows.slice(0,limit);
    content.innerHTML=visible.map(row=>modelVariantHTML(row)).join('')+(limit<series.rows.length?`<button type="button" class="chrome-btn-outline" data-series-more="${limit}">${catalogText('Daha fazla göster','Show more')} (${series.rows.length-limit})</button>`:'');
    compactModelActions(content);
}
function renderAllModelsExplorer(){
    if(!modelsData?.producers){
        dom.allModelsListContainer.innerHTML=`<p class="form-hint">${__('models.empty_database')}</p>`;
        return;
    }
    const matches=filteredCatalogRows();
    if(matches!==null){renderCatalogFiltered(matches);return;}
    dom.allModelsListContainer.innerHTML=catalogGroups.map((group,gi)=>
       `<details class="producer-group" data-group-index="${gi}" ${openProducerGroups.has(gi)?'open':''}><summary>${sanitizeHTML(group.pName)} <small>(${group.series.reduce((n,series)=>n+series.rows.length,0)})</small></summary><div class="details-content">
       ${group.series.map((series,si)=>`<div class="model-series-shell"><details class="series-group ${series.hidden?'hidden-series':''}" data-group-index="${gi}" data-series-index="${si}" ${openSeriesGroups.has(gi+':'+si)?'open':''}>
         <summary><span class="series-name">${sanitizeHTML(series.sName)} ${series.hidden?__('common.hide'):''}</span><small>(${series.rows.length})</small></summary><div class="details-content"></div>
       </details><div class="series-actions">
         <button type="button" class="edit-series-desc-btn" data-pname="${sanitizeHTML(group.pName)}" data-sname="${sanitizeHTML(series.sName)}">${__('models.edit_desc')}</button>
         <button type="button" class="${series.hidden?'unhide-series-btn':'hide-series-btn'}" data-pname="${sanitizeHTML(group.pName)}" data-sname="${sanitizeHTML(series.sName)}">${series.hidden?__('common.unhide'):__('common.hide')}</button>
       </div></div>`).join('')}</div></details>`
    ).join('');
    compactModelActions(dom.allModelsListContainer);
    dom.allModelsListContainer.querySelectorAll('details.series-group[open]').forEach(el=>fillCatalogSeries(el));
}
function refreshCatalogOptions(){
    const toolbar=document.getElementById('model-catalog-filters');if(!toolbar)return;
    const provider=toolbar.querySelector('[data-catalog-provider]');
    const selected=provider.value;
    provider.innerHTML='<option value="">'+catalogText('Tüm sağlayıcılar','All providers')+'</option>'+catalogGroups.map(g=>`<option value="${sanitizeHTML(g.pName)}">${sanitizeHTML(g.pName)}</option>`).join('');
    provider.value=selected;
    for(const [selector,values,title] of [
      ['type',[...new Set(catalogRows.map(catalogType))],catalogText('Tüm türler','All types')],
      ['status',[...new Set(catalogRows.map(catalogStatus))],catalogText('Tüm durumlar','All statuses')]]){
        const control=toolbar.querySelector('[data-catalog-'+selector+']'),previous=control.value;
        control.innerHTML='<option value="">'+title+'</option>'+values.sort().map(x=>`<option value="${sanitizeHTML(x)}">${sanitizeHTML(x)}</option>`).join('');
        control.value=previous;
    }
}
function initCatalogFilters(){
    if(filtersReady)return;filtersReady=true;
    const toolbar=document.createElement('div');toolbar.id='model-catalog-filters';toolbar.className='model-catalog-filters';
    dom.allModelsListContainer.before(toolbar);
    const paint=()=>{
      const prev=Object.fromEntries(['search','provider','type','status','visibility'].map(k=>[k,toolbar.querySelector('[data-catalog-'+k+']')?.value||'']));
      toolbar.innerHTML=`<label class="catalog-search"><span>${catalogText('Model ara','Search models')}</span><input type="search" data-catalog-search placeholder="${catalogText('İsim veya model kimliği','Name or model ID')}"></label>
        <label><span>${catalogText('Sağlayıcı','Provider')}</span><select data-catalog-provider></select></label>
        <label><span>${catalogText('Tür','Type')}</span><select data-catalog-type></select></label>
        <label><span>${catalogText('Yayın durumu','Publication status')}</span><select data-catalog-status></select></label>
        <label><span>${catalogText('Görünürlük','Visibility')}</span><select data-catalog-visibility><option value="">${catalogText('Tümü','All')}</option><option value="visible">${catalogText('Görünür','Visible')}</option><option value="hidden">${catalogText('Gizli','Hidden')}</option></select></label>
        <div class="model-bulk-toolbar"><span id="model-catalog-selection-count" aria-live="polite"></span><button type="button" class="chrome-btn-outline" id="model-catalog-select-all">${catalogText('Görünenleri seç','Select visible')}</button><button type="button" class="chrome-btn-outline" id="model-catalog-clear">${catalogText('Temizle','Clear')}</button><button type="button" class="chrome-btn-outline" id="model-catalog-copy">${catalogText('Kimlikleri kopyala','Copy IDs')}</button></div>`;
      refreshCatalogOptions();
      for(const [k,v] of Object.entries(prev))toolbar.querySelector('[data-catalog-'+k+']').value=v;
      toolbar.querySelectorAll('input[data-catalog-search],select').forEach(input=>input.addEventListener('input',()=>{catalogLimit=120;renderAllModelsExplorer();}));
      toolbar.querySelector('#model-catalog-select-all').onclick=()=>{const rows=filteredCatalogRows()||catalogRows;rows.slice(0,catalogLimit).forEach(r=>catalogSelection.add(r.index));renderAllModelsExplorer();};
      toolbar.querySelector('#model-catalog-clear').onclick=()=>{catalogSelection.clear();renderAllModelsExplorer();};
      toolbar.querySelector('#model-catalog-copy').onclick=async()=>{
        const ids=[...catalogSelection].map(i=>catalogRows[i]?.model.id).filter(Boolean);
        try{await navigator.clipboard.writeText(ids.join('\n'));showToast(()=>catalogText('Model kimlikleri kopyalandı','Model IDs copied'),'success');}
        catch(error){showToast(()=>userErrorMessage(error),'error');}
      };
      updateCatalogSelection();
    };
    paint();onLangChange(()=>{paint();renderAllModelsExplorer();});
    dom.allModelsListContainer.addEventListener('change',e=>{
       if(e.target.matches('[data-select-model]')){const i=Number(e.target.dataset.selectModel);if(e.target.checked)catalogSelection.add(i);else catalogSelection.delete(i);updateCatalogSelection();}
    });
    dom.allModelsListContainer.addEventListener('click',e=>{
       const more=e.target.closest('[data-catalog-more]');if(more){catalogLimit+=120;renderAllModelsExplorer();return;}
       const seriesMore=e.target.closest('[data-series-more]');
       if(seriesMore){const details=seriesMore.closest('details.series-group');fillCatalogSeries(details,Number(seriesMore.dataset.seriesMore)+80);}
    });
    dom.allModelsListContainer.addEventListener('toggle',e=>{
       const el=e.target;if(!el.matches('details'))return;
       if(el.classList.contains('producer-group')){const gi=Number(el.dataset.groupIndex);if(el.open)openProducerGroups.add(gi);else openProducerGroups.delete(gi);}
       if(el.classList.contains('series-group')){
           const key=el.dataset.groupIndex+':'+el.dataset.seriesIndex;
           if(el.open){openSeriesGroups.add(key);fillCatalogSeries(el);}
           else {openSeriesGroups.delete(key);el.querySelector('.details-content')?.replaceChildren();}
       }
    },true);
}
/**
 * Helper function to generate standardized loading animation HTML.
 * @param {string} text - The text to display below the loader.
 * @returns {string} The HTML string for the loader.
 */
/**
 * Fetches the complete models.json database, processes it to find manual models
 * and warnings, and then triggers the rendering of all relevant UI components.
 */
let modelRequest=0;
export async function fetchFullModelsData() {
    const request=++modelRequest;
    console.log('[MODELS] Fetching full models database...');

    const finishLoading = modelsData ? ()=>{} : beginPanelLoading(dom.manualModelsListContainer);
    const finishDatabase = modelsData ? ()=>{} : beginPanelLoading(dom.allModelsListContainer);
    try {
        const response = await fetch(FULL_DB_URL, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        const data=await response.json();
        if(request!==modelRequest)return;
        if(!data||typeof data!=='object'||!data.producers||typeof data.producers!=='object'||Array.isArray(data.producers))throw new Error('Invalid model catalogue response');
        const fingerprint=simpleHash(JSON.stringify(data));
        if(modelsData&&fingerprint===catalogFingerprint)return; // Valid revalidation without rebuilding DOM.
        catalogFingerprint=fingerprint;
        modelsData=data;
        buildCatalogIndex();
        refreshCatalogOptions();
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

            const titleA = a.details?.en?.title?.toLowerCase() || a.id;
            const titleB = b.details?.en?.title?.toLowerCase() || b.id;
            return titleA.localeCompare(titleB);
        });

        // --- Render final content, replacing the loaders ---
        window.loadedManualModels = allManualModels;
        window.loadedAllModels = modelsData;
        renderManualModelsList();
        renderAllModelsExplorer();

        console.log(`[MODELS] Derived and sorted ${allManualModels.length} manual models from database.`);

    } catch (error) {
        if(request!==modelRequest)return;
        console.error('[MODELS] Critical error fetching models data:', error);
        showToast(() => __('models.load_error'), "error");
        if (modelsData) return;
        modelsData = null;
        allManualModels = [];

        const errorHTML = `<p class="form-hint" style="color:var(--error-color);" data-i18n="models.load_error">${__('models.load_error')}</p>`;
        dom.manualModelsListContainer.innerHTML = errorHTML;
        dom.allModelsListContainer.innerHTML = errorHTML;
        [dom.manualModelsListContainer,dom.allModelsListContainer].forEach(container=>{const retry=document.createElement('button');retry.className='chrome-btn-outline';retry.dataset.i18n='common.retry';retry.textContent=__('common.retry');retry.onclick=fetchFullModelsData;container.append(retry);});
    } finally { finishLoading(); finishDatabase(); }
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
    if (!canEditModels("models.library")) return;
    const saveButton = formElement.querySelector('button[type="submit"]');
    setButtonLoading(saveButton,true);
    saveButton.textContent = __('system.saving');

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

    const modelVariant = modelsData?.producers?.[pName]?.[sName]?.[vName];
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
    const seriesObj = modelsData?.producers?.[pName]?.[sName];
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


/**
 * Handles the deletion of a manual model via the Curator API.
 * @param {string} id - The ID of the model to delete.
 */
async function handleDeleteModel(id) {
    if (!canEditModels("models.library")) return;
    const modelToDelete = allManualModels.find(m => m.id === id);
    if (!modelToDelete || !await confirmDialog(()=>({title:__('common.delete'),body:__('models.delete_confirm')}))) return;

    showToast(() => __('models.deleting'), 'info');
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
        showToast(() => __('models.deleted'), 'success');
        await fetchFullModelsData();
    } catch (error) {
        console.error(`[MODELS] Error deleting model ${id}:`, error);
        showToast(() => userErrorMessage(error), 'error');
    }
}

/**
 * Calls the Firebase Function to permanently block an online model from the Syncer.
 * @param {string} modelId - The ID of the model to block (e.g., "openai/gpt-4").
 */
async function handleBlockOnlineModel(modelId) {
    if (!canEditModels("models.library")) return;
    if (!await confirmDialog(()=>({title:__('models.block'),body:__('models.block_confirm')}))) return;
    showToast(() => __('models.blocking'), 'info');
    try {
        const result = await blockOnlineModelFn({ modelId });
        showToast(()=>__('models.status_updated'),'success');
        await fetchFullModelsData();
    } catch (error) {
        console.error(`[MODELS] Error blocking model ${modelId}:`, error);
        showToast(() => userErrorMessage(error), 'error');
    }
}

/**
 * Sends a granular update to the Curator API to change a series property (e.g., 'hidden').
 * @param {object} seriesPath - Object containing {pName, sName}.
 * @param {string} property - The property to update (e.g., "hidden").
 * @param {*} value - The new value for the property.
 */
async function updateSeriesProperty(seriesPath, property, value) {
    if (!canEditModels("models.library")) return;
    const { pName, sName } = seriesPath;
    const action = property === 'hidden' ? (value ? 'Hiding' : 'Unhiding') : 'Updating';
    showToast(() => __('models.series_updating'), 'info');

    try {
        const token = await getAuthToken(auth);
        const payload = { pName, sName, fieldPath: property, value };
        const response = await fetch(`${CURATOR_API_URL}/update-list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to update series property.');

        showToast(() => __('models.series_updated'), 'success');
        await fetchFullModelsData();
    } catch (error) {
        console.error(`[MODELS] Error ${action.toLowerCase()} series ${sName}:`, error);
        showToast(() => userErrorMessage(error), 'error');
    }
}

/**
 * Opens a modal for editing the translations of a model variant.
 * @param {object} modelPath - Object containing {pName, sName, vName}.
 */
function openTranslationEditor(modelPath) {
    const { pName, sName, vName } = modelPath;
    const modelObj = modelsData?.producers?.[pName]?.[sName]?.[vName];
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

// ===================================================================================
// SECTION: INITIALIZATION
// ===================================================================================

/**
 * Initializes all event listeners for the models module.
 */
export function initModelsModule() {
    initModelWorkspace();
    dom.modelForm.addEventListener('submit', handleModelFormSubmit);
    dom.modelTypeSwitch.addEventListener('change', handleModelTypeChange);
    dom.modelCancelBtn.addEventListener('click', resetModelForm);

    document.getElementById('model-format-template')
        .addEventListener('change', (e) => {
            const key = e.target.value;
            applyChatTemplateToForm(key);
            showToast(key ? __('models.template_applied') : __('models.template_cleared'), key ? 'success' : 'info');
        });

    dom.manualModelsListContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('edit-btn')) {
            const modelToEdit = allManualModels.find(m => m.id === id);
            if (modelToEdit) { openModelEditor(); populateModelFormForEdit(modelToEdit); }
        } else if (target.classList.contains('delete-btn')) {
            handleDeleteModel(id);
        } else if (target.classList.contains('translations-btn')) {
            if (!modelsData?.producers) {
                showToast(() => __('models.load_error'), 'error');
                return;
            }
            let opened = false;
            outer: for (const [pName, producer] of Object.entries(modelsData.producers)) {
                for (const [sName, series] of Object.entries(producer)) {
                    if (!series || typeof series !== 'object') continue;
                    for (const [vName, variant] of Object.entries(series)) {
                        if (variant?.id === id && variant.source === 'manual') {
                            openTranslationEditor({pName,sName,vName});opened = true;break outer;
                        }
                    }
                }
            }
            if (!opened) showToast(() => __('models.no_translations'), 'info');
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
let modelHome=null;
function canEditModels(panel){return isPanelAdmin() || getEffectivePanelLevel(panel)==='write';}
function openModelEditor(){
    if(!canEditModels('models.manage'))return;
    const card=document.getElementById('model-manager');
    if(!modelHome)modelHome={parent:card.parentElement,next:card.nextSibling};
    card.hidden=false;
    openDrawer({title:__('models.form_title'),titleKey:'models.form_title',render:body=>body.append(card),onAfterClose:()=>{if(card.closest('.vx-drawer')?.getAttribute('aria-hidden')!=='true')return;card.hidden=true;modelHome.parent.insertBefore(card,modelHome.next);}});
}
function compactModelActions(root){
    root.querySelectorAll('.item-actions,.series-actions').forEach(actions=>{
        const originals=[...actions.querySelectorAll('button')];if(!originals.length)return;
        const source=document.createElement('div');source.hidden=true;originals.forEach(button=>source.append(button));actions.append(source);
        const trigger=document.createElement('button');trigger.type='button';trigger.className='icon-action-btn model-actions-trigger';trigger.setAttribute('aria-label',__('common.actions'));trigger.innerHTML=icon('dots');
        if(!canEditModels('models.library'))trigger.hidden=true;
        actions.append(trigger);
        trigger.onclick=e=>{e.preventDefault();e.stopPropagation();openPopover(trigger,{render:popover=>{popover.classList.add('model-menu');originals.forEach(original=>{const button=document.createElement('button');button.type='button';button.className='menu-item';button.textContent=original.textContent;button.disabled=original.disabled;button.onclick=()=>{closePopover();original.click();};popover.append(button);});}});};
    });
}
function initModelWorkspace(){
    const card=document.getElementById('model-manager');card.hidden=true;
    initCatalogFilters();
    const heading=document.querySelector('#tab-models .panel-section-title');const toolbar=document.createElement('div');toolbar.className='model-workspace-actions';heading.append(toolbar);
    function paint(){
        toolbar.innerHTML=`<button type="button" class="chrome-btn-outline" data-model-refresh>${icon('refresh')}<span data-i18n="common.refresh">${__('common.refresh')}</span></button>${canEditModels('models.manage')?`<button type="button" class="chrome-btn-primary" data-model-create>${icon('plus')}<span data-i18n="models.add">${__('models.add')}</span></button>`:''}${isPanelAdmin()?`<button type="button" class="chrome-btn-outline" data-model-publish>${icon('device-floppy')}<span data-i18n="models.publish">${__('models.publish')}</span></button>`:''}`;
        toolbar.querySelector('[data-model-refresh]').onclick=fetchFullModelsData;
        const create=toolbar.querySelector('[data-model-create]');if(create)create.onclick=()=>{resetModelForm();openModelEditor();};
        const publish=toolbar.querySelector('[data-model-publish]');if(publish)publish.onclick=async()=>{if(!isPanelAdmin()||publish.disabled)return;const approved=await confirmDialog(()=>({title:__('models.publish'),body:__('models.publish_confirm')}));if(!approved)return;publish.disabled=true;try{await updateModelsListFn({});await fetchFullModelsData();showToast(() => __('models.published'),'success');}catch(error){showToast(()=>userErrorMessage(error),'error');}finally{publish.disabled=false;}};
    }
    onLangChange(()=>{dom.modelSubmitBtn.textContent=__(dom.modelSubmitBtn.disabled?'system.saving':currentEditingModelId?'models.update_btn':'models.save_btn');document.querySelectorAll('[data-language-name]').forEach(label=>{label.textContent=new Intl.DisplayNames([getLang()],{type:'language'}).of(label.dataset.languageName);});paint();if(modelsData){renderManualModelsList();renderAllModelsExplorer();}});document.addEventListener('vertex:departments',paint);paint();
}
