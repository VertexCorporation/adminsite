import { blockOnlineModelFn, prepareModelImageCleanupFn, confirmModelImageCleanupFn, auth } from '../../core/firebase.js';
import { showToast, userErrorMessage, __, getAuthToken } from '../../utils/ui.js';
import { confirmDialog } from '../shell.js';
import { setAttributionsOutOfSync } from '../admin.js';
import { CURATOR_API_URL, MODEL_TYPE } from './constants.js';
import { canEditModels } from './access.js';

export function createModelActions({ state, refresh: fetchFullModelsData, resetModelForm }) {
    const IMAGE_CLEANUP_JOURNAL='vertex-model-cleanup-pending-v1';
    function pendingImageCleanups(){
        try{
            const stored=JSON.parse(localStorage.getItem(IMAGE_CLEANUP_JOURNAL)||'[]');
            return Array.isArray(stored)?stored.filter(id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id)).slice(-30):[];
        }catch{return [];}
    }
    function journalImageCleanup(id){
        try{localStorage.setItem(IMAGE_CLEANUP_JOURNAL,JSON.stringify([...new Set([...pendingImageCleanups(),id])].slice(-30)));}catch{}
    }
    function clearImageCleanup(id){
        try{localStorage.setItem(IMAGE_CLEANUP_JOURNAL,JSON.stringify(pendingImageCleanups().filter(x=>x!==id)));}catch{}
    }
    async function resumeImageCleanups(){
        if(!canEditModels('models.library'))return;
        for(const cleanupId of pendingImageCleanups()){
            try{
                const result=await confirmModelImageCleanupFn({cleanupId});
                if(result.data?.state==='complete')clearImageCleanup(cleanupId);
            }catch{/* The server job remains durable; retry on a later session. */}
        }
    }

    async function handleDeleteModel(id) {
        if (!canEditModels("models.library")) return;
        const modelToDelete = state.manualModels.find(m => m.id === id);
        if (!modelToDelete || !await confirmDialog(()=>({title:__('common.delete'),body:__('models.delete_confirm')}))) return;

        showToast(() => __('models.deleting'), 'info');
        try {
            let cleanupId=null,cleanupPending=false;
            if(modelToDelete.imagePath){
                // Fail closed if the approved server-side cleanup protocol is not
                // deployed. Never delete the model and its shared image blindly.
                const result=await prepareModelImageCleanupFn({modelId:id,modelType:modelToDelete.type,imagePath:modelToDelete.imagePath});
                if(result.data?.status!=='prepared' && result.data?.status!=='missing'){
                    throw new Error('Model image cleanup could not be verified.');
                }
                cleanupId=result.data.cleanupId||null;
            }
            const token = await getAuthToken(auth);
            const response = await fetch(`${CURATOR_API_URL}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error((await response.json()).error || 'API delete failed');

            if(cleanupId){
                journalImageCleanup(cleanupId);
                try{
                    const result=await confirmModelImageCleanupFn({cleanupId});
                    if(result.data?.state==='complete'){clearImageCleanup(cleanupId);}
                    else cleanupPending=true;
                }catch{cleanupPending=true;}
            }

            //  If the deleted model was an offline model, flag attributions.
            if (modelToDelete.type === MODEL_TYPE.OFFLINE) {
                setAttributionsOutOfSync();
            }

            if (state.editingId === id) resetModelForm();
            showToast(() => __(cleanupPending?'models.cleanup_pending':'models.deleted'),cleanupPending?'info':'success');
            await fetchFullModelsData();
        } catch (error) {
            console.error('[MODELS] Model deletion failed',{code:String(error?.code||'unknown')});
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

    return { resumeImageCleanups, handleDeleteModel, handleBlockOnlineModel, updateSeriesProperty };
}
