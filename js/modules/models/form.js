import * as dom from '../../utils/dom.js';
import { setButtonLoading } from '../../utils/loading.js';
import { getModelImageUploadUrlFn, auth } from '../../core/firebase.js';
import { showToast, __, getAuthToken } from '../../utils/ui.js';
import { openDrawer } from '../shell.js';
import { setAttributionsOutOfSync } from '../admin.js';
import { CURATOR_API_URL, MODEL_TYPE, CHAT_TEMPLATES } from './constants.js';
import { canEditModels } from './access.js';

export function createModelForm({ state, refresh: fetchFullModelsData }) {
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
    document.querySelectorAll('#offline-fields [data-modality-type]').forEach((checkbox) => {
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

    state.editingId = null;
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
    state.editingId = modelData.id;

    // --- Basic Info ---
    dom.modelTypeSwitch.checked = modelData.type === MODEL_TYPE.OFFLINE;
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

      document.querySelectorAll('#offline-fields [data-modality-type]').forEach((checkbox) => {
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
        !tokens.system_start &&
        !tokens.system_end &&
        !tokens.user_start &&
        !tokens.user_end &&
        !tokens.assistant_start &&
        !tokens.assistant_end &&
        (!tokens.stop_generation || tokens.stop_generation.length === 0);
      if (tplKey && allEmpty) applyChatTemplateToForm(tplKey);
    } else {
      // Roleplay
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
    if (!canEditModels('models.manage')) return;
    e.preventDefault();
    if (dom.modelSubmitBtn.disabled) return;
    setButtonLoading(dom.modelSubmitBtn, true);
    dom.modelSubmitBtn.textContent = __('system.saving');

    const modelId = dom.modelIdInput.value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
    if (!modelId) {
      showToast(() => __('models.slug_error'), 'error');
      setButtonLoading(dom.modelSubmitBtn, false);
      dom.modelSubmitBtn.textContent = state.editingId ? __('models.update_btn') : __('models.save_btn');
      return;
    }

    try {
      const token = await getAuthToken(auth);
      const modelImageFile = document.getElementById('model-image').files[0];
      const originalModel = state.editingId ? state.manualModels.find((m) => m.id === state.editingId) : null;
      let imagePath = originalModel ? originalModel.imagePath : null;

      if (modelImageFile) {
        showToast(() => __('models.upload_link'), 'info');
        const modelTypeDir = dom.modelTypeSwitch.checked ? MODEL_TYPE.OFFLINE : MODEL_TYPE.ROLEPLAY;
        const result = await getModelImageUploadUrlFn({
          modelId,
          modelType: modelTypeDir,
          fileName: modelImageFile.name,
          contentType: modelImageFile.type,
        });
        imagePath = result.data.filePath;
        showToast(() => __('models.upload_image'), 'info');
        const uploadResponse = await fetch(result.data.signedUrl, {
          method: 'PUT',
          body: modelImageFile,
          headers: { 'Content-Type': modelImageFile.type },
        });
        if (!uploadResponse.ok) throw new Error('MODEL_IMAGE_UPLOAD_FAILED');
      }

      const isOffline = dom.modelTypeSwitch.checked;
      let modalities = null,
        outputs = null,
        licenseInfo = null,
        chatFormat = null;

      if (isOffline) {
        // Gather modalities and outputs
        modalities = {};
        outputs = { text: true };
        document.querySelectorAll('#offline-fields [data-modality-type]').forEach((checkbox) => {
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
          licenseUrl: document.getElementById('model-license-url').value.trim(),
        };

        const stopTokens = document
          .getElementById('model-token-stop-generation')
          .value.split(',')
          .map((t) => t.trim())
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
          },
        };

        if (Object.values(chatFormat.tokens).every((v) => v === null || (Array.isArray(v) && v.length === 0))) {
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
          },
        },
        imagePath: imagePath,
        url: isOffline ? document.getElementById('model-url').value.trim() : null,
        size: isOffline ? parseInt(dom.modelSizeInput.value, 10) || null : null,
        ram: isOffline ? parseInt(dom.modelRamInput.value, 10) || null : null,
        modalities: modalities,
        outputs: outputs,
        licenseInfo: licenseInfo,
        chatFormat: chatFormat,
      };

      const endpoint = state.editingId ? `${CURATOR_API_URL}/${modelId}` : CURATOR_API_URL;
      const method = state.editingId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(modelPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API operation failed with status ${response.status}`);
      }

      const result = await response.json();
      showToast(() => __('models.saved'), 'success');
      if (isOffline) setAttributionsOutOfSync();
      resetModelForm();
      await fetchFullModelsData();
    } catch (error) {
      console.error('[MODELS] Error saving model:', error);
      showToast(() => __('system.error'), 'error');
    } finally {
      setButtonLoading(dom.modelSubmitBtn, false);
      dom.modelSubmitBtn.textContent = __(state.editingId ? 'models.update_btn' : 'models.save_btn');
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
    stop.value = Array.isArray(t.stop_generation) ? t.stop_generation.join(', ') : t.stop_generation || '';
  }
  let modelHome = null;
  function openModelEditor() {
    if (!canEditModels('models.manage')) return;
    const card = document.getElementById('model-manager');
    if (!modelHome) modelHome = { parent: card.parentElement, next: card.nextSibling };
    card.hidden = false;
    openDrawer({
      title: __('models.form_title'),
      titleKey: 'models.form_title',
      render: (body) => body.append(card),
      onAfterClose: () => {
        if (card.closest('.vx-drawer')?.getAttribute('aria-hidden') !== 'true') return;
        card.hidden = true;
        modelHome.parent.insertBefore(card, modelHome.next);
      },
    });
  }

  return {
    handleModelTypeChange,
    resetModelForm,
    populateModelFormForEdit,
    handleModelFormSubmit,
    applyChatTemplateToForm,
    openModelEditor,
  };
}
