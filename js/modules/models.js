import { modelsStore, manualModelsStore } from '../stores/areaStore.js';
import { captureSession, sessionIsCurrent, onSessionReset } from '../core/session.js';
import * as dom from '../utils/dom.js';
import { registerListRefresh } from '../ui/listRefresh.js';
import { crossfade } from '../ui/transition.js';
import { beginPanelLoading } from '../utils/loading.js';
import { updateModelsListFn, auth } from '../core/firebase.js';
import { showToast, userErrorMessage, __, getLang, onLangChange } from '../utils/ui.js';
import { icon } from '../utils/icons.js';
import { confirmDialog } from './shell.js';
import { isPanelAdmin } from './roles.js';
import { FULL_DB_URL, MODEL_TYPE } from './models/constants.js';
import { canEditModels } from './models/access.js';

import { createModelForm } from './models/form.js';
import { createModelCatalog } from './models/catalog.js';
import { createModelTranslations } from './models/translations.js';
import { createModelActions } from './models/actions.js';

const state = { data: null, manualModels: [], editingId: null, fingerprint: null };
const {
  handleModelTypeChange,
  resetModelForm,
  populateModelFormForEdit,
  handleModelFormSubmit,
  applyChatTemplateToForm,
  openModelEditor,
} = createModelForm({ state, refresh: fetchFullModelsData });
const {
  renderManualModelsList,
  renderAllModelsExplorer,
  initCatalogFilters,
  buildCatalogIndex,
  refreshCatalogOptions,
} = createModelCatalog({ state });
const { openDescriptionEditor, openTranslationEditor } = createModelTranslations({ state, renderManualModelsList });
const { resumeImageCleanups, handleDeleteModel, handleBlockOnlineModel, updateSeriesProperty } = createModelActions({
  state,
  refresh: fetchFullModelsData,
  resetModelForm,
});

let modelRequest = 0;
onSessionReset(() => {
  modelRequest++;
  state.data = null;
  state.manualModels = [];
  state.editingId = null;
  state.fingerprint = null;
  dom.manualModelsListContainer?.replaceChildren();
  dom.allModelsListContainer?.replaceChildren();
});
export async function fetchFullModelsData() {
  const request = ++modelRequest;
  const session = captureSession();
  console.log('[MODELS] Fetching full models database...');

  const finishLoading = state.data ? () => {} : beginPanelLoading(dom.manualModelsListContainer);
  const finishDatabase = state.data ? () => {} : beginPanelLoading(dom.allModelsListContainer);
  try {
    const response = await fetch(FULL_DB_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();
    if (request !== modelRequest || !sessionIsCurrent(session)) return;
    if (
      !data ||
      typeof data !== 'object' ||
      !data.producers ||
      typeof data.producers !== 'object' ||
      Array.isArray(data.producers)
    )
      throw new Error('Invalid model catalogue response');
    const serialized = JSON.stringify(data);
    if (state.data && serialized === state.fingerprint) return; // Exact revision comparison, no hash collisions.
    state.fingerprint = serialized;
    state.data = data;
    buildCatalogIndex();
    refreshCatalogOptions();
    console.log('[MODELS] Full models database loaded.');

    const manualModels = [];

    if (state.data?.producers) {
      for (const pName in state.data.producers) {
        for (const sName in state.data.producers[pName]) {
          if (sName === 'series_description') continue;
          for (const vName in state.data.producers[pName][sName]) {
            if (['series_description', 'hidden'].includes(vName)) continue;

            const model = state.data.producers[pName][sName][vName];
            if (!model || !model.id) continue;

            if (model.source === 'manual') {
              manualModels.push(model);
            }
          }
        }
      }
    }

    state.manualModels = manualModels;

    state.manualModels.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === MODEL_TYPE.OFFLINE ? -1 : 1;
      }

      const titleA = a.details?.en?.title?.toLowerCase() || a.id;
      const titleB = b.details?.en?.title?.toLowerCase() || b.id;
      return titleA.localeCompare(titleB);
    });

    // --- Render final content, replacing the loaders ---
    manualModelsStore.set(state.manualModels, session);
    modelsStore.set(state.data, session);
    renderManualModelsList();
    crossfade(dom.allModelsListContainer, () => renderAllModelsExplorer());

    console.log(`[MODELS] Derived and sorted ${state.manualModels.length} manual models from database.`);
  } catch (error) {
    if (request !== modelRequest || !sessionIsCurrent(session)) return;
    console.error('[MODELS] Critical error fetching models data:', error);
    showToast(() => __('models.load_error'), 'error');
    if (state.data) return;
    state.data = null;
    state.manualModels = [];

    const errorHTML = `<p class="form-hint" style="color:var(--error-color);" data-i18n="models.load_error">${__('models.load_error')}</p>`;
    dom.manualModelsListContainer.innerHTML = errorHTML;
    dom.allModelsListContainer.innerHTML = errorHTML;
    [dom.manualModelsListContainer, dom.allModelsListContainer].forEach((container) => {
      const retry = document.createElement('button');
      retry.className = 'chrome-btn-outline';
      retry.dataset.i18n = 'common.retry';
      retry.textContent = __('common.retry');
      retry.onclick = fetchFullModelsData;
      container.append(retry);
    });
  } finally {
    finishLoading();
    finishDatabase();
  }
}

export function initModelsModule() {
  registerListRefresh(dom.manualModelsListContainer, fetchFullModelsData);
  registerListRefresh(dom.allModelsListContainer, fetchFullModelsData);
  initModelWorkspace();
  auth?.onAuthStateChanged?.((user) => {
    if (user) void resumeImageCleanups();
  });
  dom.modelForm.addEventListener('submit', handleModelFormSubmit);
  dom.modelTypeSwitch.addEventListener('change', handleModelTypeChange);
  dom.modelCancelBtn.addEventListener('click', resetModelForm);

  document.getElementById('model-format-template').addEventListener('change', (e) => {
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
      const modelToEdit = state.manualModels.find((m) => m.id === id);
      if (modelToEdit) {
        openModelEditor();
        populateModelFormForEdit(modelToEdit);
      }
    } else if (target.classList.contains('delete-btn')) {
      handleDeleteModel(id);
    } else if (target.classList.contains('translations-btn')) {
      if (!state.data?.producers) {
        showToast(() => __('models.load_error'), 'error');
        return;
      }
      let opened = false;
      outer: for (const [pName, producer] of Object.entries(state.data.producers)) {
        for (const [sName, series] of Object.entries(producer)) {
          if (!series || typeof series !== 'object') continue;
          for (const [vName, variant] of Object.entries(series)) {
            if (variant?.id === id && variant.source === 'manual') {
              openTranslationEditor({ pName, sName, vName });
              opened = true;
              break outer;
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
function initModelWorkspace() {
  const card = document.getElementById('model-manager');
  card.hidden = true;
  initCatalogFilters();
  const heading = document.querySelector('#tab-models .panel-section-title');
  const toolbar = document.createElement('div');
  toolbar.className = 'model-workspace-actions';
  heading.append(toolbar);
  function paint() {
    toolbar.innerHTML = `<button type="button" class="chrome-btn-outline" data-model-refresh data-refresh-control hidden>${icon('refresh')}<span data-i18n="common.refresh">${__('common.refresh')}</span></button>${canEditModels('models.manage') ? `<button type="button" class="chrome-btn-primary" data-model-create>${icon('plus')}<span data-i18n="models.add">${__('models.add')}</span></button>` : ''}${isPanelAdmin() ? `<button type="button" class="chrome-btn-outline" data-model-publish>${icon('device-floppy')}<span data-i18n="models.publish">${__('models.publish')}</span></button>` : ''}`;
    toolbar.querySelector('[data-model-refresh]').onclick = fetchFullModelsData;
    const create = toolbar.querySelector('[data-model-create]');
    if (create)
      create.onclick = () => {
        resetModelForm();
        openModelEditor();
      };
    const publish = toolbar.querySelector('[data-model-publish]');
    if (publish)
      publish.onclick = async () => {
        if (!isPanelAdmin() || publish.disabled) return;
        const approved = await confirmDialog(() => ({
          title: __('models.publish'),
          body: __('models.publish_confirm'),
        }));
        if (!approved) return;
        publish.disabled = true;
        try {
          await updateModelsListFn({});
          await fetchFullModelsData();
          showToast(() => __('models.published'), 'success');
        } catch (error) {
          showToast(() => userErrorMessage(error), 'error');
        } finally {
          publish.disabled = false;
        }
      };
  }
  onLangChange(() => {
    dom.modelSubmitBtn.textContent = __(
      dom.modelSubmitBtn.disabled ? 'system.saving' : state.editingId ? 'models.update_btn' : 'models.save_btn',
    );
    document.querySelectorAll('[data-language-name]').forEach((label) => {
      label.textContent = new Intl.DisplayNames([getLang()], { type: 'language' }).of(label.dataset.languageName);
    });
    paint();
    if (state.data) {
      renderManualModelsList();
      renderAllModelsExplorer();
    }
  });
  document.addEventListener('vertex:departments', paint);
  paint();
}
