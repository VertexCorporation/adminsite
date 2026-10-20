import { deploymentCapabilities } from '../core/deployment-capabilities.js';
import { crossfade } from '../ui/transition.js';
import { showLoadError } from '../ui/states.js';
import { confirmDialog } from './shell.js';
import { beginPanelLoading, setButtonLoading } from '../utils/loading.js';
// js/modules/notification.js

import { db, auth, sendTargetedNotificationFn, scheduleNotificationFn, cancelScheduledNotificationFn, getNotificationDeliveryStatusFn, reconcileNotificationQueueFn } from '../core/firebase.js';
import * as dom from '../utils/dom.js';
import { showToast, userErrorMessage, __, getLang, onLangChange, escapeHTML } from '../utils/ui.js';

let unsubscribeFromScheduledTasks = null;
let submissionPending = false;
let deliveryUncertain = false;
const cancellingTasks=new Set();
const DELIVERY_SESSION_KEY = 'vertex:notification:pending';
let statusRequestId = null;
let statusPollCount = 0;
let statusPollTimer = null;
let notificationEpoch=0;
const ntr = (tr,en) => getLang()==='tr'?tr:en;
function deliveryNotice(message, action = null) {
    const submit = document.getElementById('submit-notification-btn');
    if (!submit) return;
    let notice = document.getElementById('notification-delivery-status');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'notification-delivery-status';
        notice.className = 'form-hint';
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        submit.insertAdjacentElement('afterend',notice);
    }
    notice.replaceChildren(document.createTextNode(message));
    if (action && statusRequestId) {
        const check=document.createElement('button');check.type='button';
        check.className='chrome-btn-outline';check.style.marginLeft='8px';
        check.textContent=ntr('Durumu kontrol et','Check status');
        check.onclick=()=>void checkDeliveryStatus(statusRequestId, true);
        notice.append(check);
        if(action==='repair') {
            const retry=document.createElement('button');retry.type='button';
            retry.className='chrome-btn-outline';retry.style.marginLeft='8px';
            retry.textContent=ntr('Kuyruğu onar','Repair queue');
            retry.onclick=async()=>{
                retry.disabled=true;
                try {
                    await reconcileNotificationQueueFn({requestId:statusRequestId});
                    statusPollCount=0;void checkDeliveryStatus(statusRequestId,true);
                } catch(error){
                    deliveryNotice(ntr('Kuyruk onarılamadı. Sunucu kayıtlarını incele.','Queue could not be repaired. Review server logs.'),'repair');
                } finally {if(retry.isConnected)retry.disabled=false;}
            };
            notice.append(retry);
        }
    }
}
function rememberDelivery(requestId) {
    try { sessionStorage.setItem(DELIVERY_SESSION_KEY, JSON.stringify({uid:auth.currentUser?.uid, requestId})); } catch {}
}
function clearDelivery() {
    try { sessionStorage.removeItem(DELIVERY_SESSION_KEY); } catch {}
    statusRequestId=null;
    deliveryUncertain=false;
    const submit = document.getElementById('submit-notification-btn');
    if(submit) submit.disabled=false;
    handleScheduleSwitchChange();
}
async function checkDeliveryStatus(requestId, continuePolling=false) {
    if (!requestId || requestId !== statusRequestId) return;
    if(statusPollTimer){clearTimeout(statusPollTimer);statusPollTimer=null;}
    try {
        const response=await getNotificationDeliveryStatusFn({requestId});
        if(requestId!==statusRequestId)return;
        const {status,kind,successCount,failureCount,failureCodes}=response.data||{};
        const errors=Object.entries(failureCodes||{}).filter(([,count])=>count>0)
            .slice(0,3).map(([code,count])=>`${code}: ${count}`).join(', ');
        if(status==='SCHEDULED'&&kind==='SCHEDULED'){
            clearDelivery();deliveryNotice(ntr('Bildirim planlandı.','Notification scheduled.'));
            showToast(ntr('Bildirim planlandı.','Notification scheduled.'),'success');
            return;
        }
        if(['FCM_ACCEPTED','DELIVERED','NO_DELIVERIES','SENT'].includes(status)) {
            const msg=status==='NO_DELIVERIES'
                ? ntr('FCM tarafından kabul edilen cihaz tokenı yok. Tokenları ve hata kodlarını incele.','FCM accepted no device tokens. Check tokens and failure codes.')
                : ntr(`FCM ${successCount} tokenı kabul etti, ${failureCount} tokenı reddetti. Cihazda gösterilmesi ayrıca doğrulanmalıdır.`,`FCM accepted ${successCount} tokens and rejected ${failureCount}. Device display is not confirmed.`);
            clearDelivery();
            deliveryNotice(errors?`${msg} ${errors}`:msg);
            showToast(msg,status==='NO_DELIVERIES'?'warning':'success');
            return;
        }
        if(status==='QUEUE_FAILED') {
            deliveryUncertain=true;
            deliveryNotice(ntr('Bildirim kuyruğa alınamadı. Aynı işlem kimliğiyle kuyruğu onarmayı deneyin.','Delivery was not queued. You can repair the queue using the same request ID.'),'repair');
            handleScheduleSwitchChange();
            return;
        }
        if(status==='FAILED_UNCERTAIN'||status==='QUEUE_UNCERTAIN') {
            deliveryUncertain=true;
            deliveryNotice(ntr('Teslimat doğrulanamadı. Aynı bildirimi yeniden göndermeden önce sunucu kaydını incele.','Delivery is uncertain. Review the server record before sending again.'),status==='QUEUE_UNCERTAIN'?'repair':true);
            handleScheduleSwitchChange();
            return;
        }
        deliveryUncertain=true;
        deliveryNotice(ntr('Bildirim kuyruğa alındı. Teslimat sonucu bekleniyor.','Notification queued. Waiting for delivery result.'),true);
        handleScheduleSwitchChange();
        if(continuePolling && ++statusPollCount<24)
            statusPollTimer=setTimeout(()=>void checkDeliveryStatus(requestId,true),5000);
    } catch(error) {
        if(requestId!==statusRequestId)return;
        deliveryNotice(ntr('Gönderimin sonucu sorgulanamadı. Aynı bildirimi tekrar gönderme.','Unable to check delivery. Do not resend blindly.'),true);
    }
}




/**
 * Handles changes in the notification schedule switch.
 */
function handleScheduleSwitchChange() {
    const isScheduled = dom.notificationScheduleSwitch.checked;
    dom.scheduleDateTimePicker.style.display = isScheduled ? 'block' : 'none';
    document.getElementById('notification-schedule-time').required = isScheduled;
    document.getElementById('submit-notification-btn').textContent = submissionPending?__('notif.submitting'):deliveryUncertain?__('notif.uncertain_short'):isScheduled?__('notif.schedule'):__('notif.send_now');
}

/**
 * Handles changes in the notification target type selector.
 */
function handleTargetTypeChange() {
    const selectedType = dom.notificationTargetType.value;
    dom.targetUidInput.style.display = (selectedType === 'SINGLE_USER') ? 'block' : 'none';
    dom.targetLevelInput.style.display = (selectedType === 'SUBSCRIPTION_LEVEL') ? 'block' : 'none';
}

/**
 * Auto-fills the form based on a selected notification template.
 * Updated to include all keys from extrovert.dart
 */
function handleTemplateSelection() {
    const selectedValue = dom.notificationTemplateSelector.value;
    const titleKeyInput = document.getElementById('notification-title-key');
    const bodyKeyInput = document.getElementById('notification-body-key');
    const payloadInput = document.getElementById('notification-data-payload');

    const templates = {
        // --- Transactional & Updates ---
        newModel: { 
            titleKey: 'notificationNewModelAddedTitle', 
            bodyKey: 'notificationNewModelAddedBody', 
            payload: { modelName: 'ENTER_MODEL_NAME' } 
        },
        newFeature: { 
            titleKey: 'notificationNewFeatureTitle', 
            bodyKey: 'notificationNewFeatureBody', 
            payload: { featureName: 'ENTER_FEATURE_NAME' } 
        },
        upsellFeature: {
            titleKey: 'notificationUpsellFeatureTitle',
            bodyKey: 'notificationUpsellFeatureBody',
            payload: { currentTier: 'Free', targetTier: 'Pro', featureName: 'Advanced Chat' }
        },
        appUpdate: { titleKey: 'notificationAppUpdateTitle', bodyKey: 'notificationAppUpdateBody', payload: {} },
        rateApp: { titleKey: 'notificationRateAppTitle', bodyKey: 'notificationRateAppBody', payload: {} },
        referral: { titleKey: 'notificationReferralTitle', bodyKey: 'notificationReferralBody', payload: {} },
        socialMedia: { titleKey: 'notificationSocialMediaTitle', bodyKey: 'notificationSocialMediaBody', payload: {} },
        
        // --- Re-Engagement (Comeback) ---
        comeback: { titleKey: 'notificationComebackTitle', bodyKey: 'notificationComebackBody', payload: {} },
        longTimeNoSee: { titleKey: 'notificationLongTimeNoSeeTitle', bodyKey: 'notificationLongTimeNoSeeBody', payload: {} },
        howAreYou: { titleKey: 'notificationHowAreYouTitle', bodyKey: 'notificationHowAreYouBody', payload: {} },

        // --- Special Days ---
        newYear: { titleKey: 'notificationNewYearTitle', bodyKey: 'notificationNewYearBody', payload: {} },
        valentinesDay: { titleKey: 'notificationValentinesDayTitle', bodyKey: 'notificationValentinesDayBody', payload: {} },
        ataturkRemembrance: { titleKey: 'notificationAtaturkRemembranceTitle', bodyKey: 'notificationAtaturkRemembranceBody', payload: {} },
        mothersDay: { titleKey: 'notificationMothersDayTitle', bodyKey: 'notificationMothersDayBody', payload: {} },
        fathersDay: { titleKey: 'notificationFathersDayTitle', bodyKey: 'notificationFathersDayBody', payload: {} },

        // --- Fun & Persona (Cortex Personalities) ---
        goodMorning: { titleKey: 'notificationGoodMorningTitle', bodyKey: 'notificationGoodMorningBody', payload: {} },
        goodNight: { titleKey: 'notificationGoodNightTitle', bodyKey: 'notificationGoodNightBody', payload: {} },
        randomFact: { titleKey: 'notificationRandomFactTitle', bodyKey: 'notificationRandomFactBody', payload: {} },
        showerThought: { titleKey: 'notificationShowerThoughtTitle', bodyKey: 'notificationShowerThoughtBody', payload: {} },
        fortuneCookie: { titleKey: 'notificationFortuneCookieTitle', bodyKey: 'notificationFortuneCookieBody', payload: {} },
        hackerJoke: { titleKey: 'notificationHackerJokeTitle', bodyKey: 'notificationHackerJokeBody', payload: {} },
        pirate: { titleKey: 'notificationPirateTitle', bodyKey: 'notificationPirateBody', payload: {} },
        trollAnime: { titleKey: 'notificationTrollAnimeTitle', bodyKey: 'notificationTrollAnimeBody', payload: {} },
        trollAiRebellion: { titleKey: 'notificationTrollAiRebellionTitle', bodyKey: 'notificationTrollAiRebellionBody', payload: {} },
        singularity: { titleKey: 'notificationSingularityTitle', bodyKey: 'notificationSingularityBody', payload: {} },
        detectiveCase: { titleKey: 'notificationDetectiveCaseTitle', bodyKey: 'notificationDetectiveCaseBody', payload: {} },
        originStory: { titleKey: 'notificationOriginStoryTitle', bodyKey: 'notificationOriginStoryBody', payload: {} },
        rejectionStory: { titleKey: 'notificationRejectionStoryTitle', bodyKey: 'notificationRejectionStoryBody', payload: {} },
        cooking: { titleKey: 'notificationCookingTitle', bodyKey: 'notificationCookingBody', payload: {} },
        existential: { titleKey: 'notificationExistentialTitle', bodyKey: 'notificationExistentialBody', payload: {} },
        openSource: { titleKey: 'notificationOpenSourceTitle', bodyKey: 'notificationOpenSourceBody', payload: {} },
        
        // --- Technical / Features ---
        offlineReady: { titleKey: 'notificationOfflineReadyTitle', bodyKey: 'notificationOfflineReadyBody', payload: {} },
        customModel: { titleKey: 'notificationCustomModelTitle', bodyKey: 'notificationCustomModelBody', payload: {} },
        dynamicChat: { titleKey: 'notificationDynamicChatTitle', bodyKey: 'notificationDynamicChatBody', payload: {} },
        ggufSupport: { titleKey: 'notificationGGUFSupportTitle', bodyKey: 'notificationGGUFSupportBody', payload: {} },
        themeCustomization: { titleKey: 'notificationThemeCustomizationTitle', bodyKey: 'notificationThemeCustomizationBody', payload: {} },
        homeworkHelper: { titleKey: 'notificationHomeworkHelperTitle', bodyKey: 'notificationHomeworkHelperBody', payload: {} },
        lowBattery: { titleKey: 'notificationLowBatteryTitle', bodyKey: 'notificationLowBatteryBody', payload: {} }
    };

    const template = templates[selectedValue];

    if (template) {
        titleKeyInput.value = template.titleKey || '';
        bodyKeyInput.value = template.bodyKey || '';
        // If the payload has keys, show them pretty-printed, otherwise empty string
        const hasPayloadKeys = Object.keys(template.payload).length > 0;
        payloadInput.value = hasPayloadKeys ? JSON.stringify(template.payload, null, 2) : '';
    } else {
        // Clear if nothing selected
        titleKeyInput.value = '';
        bodyKeyInput.value = '';
        payloadInput.value = '';
    }
}

/**
 * Handles the submission of the notification form.
 * @param {Event} e - The form submission event.
 */
async function handleNotificationFormSubmit(e) {
    const epoch=notificationEpoch,uid=auth?.currentUser?.uid;
    e.preventDefault();
    if (submissionPending || deliveryUncertain) return;
    submissionPending = true;
    const submitBtn = document.getElementById('submit-notification-btn');
    setButtonLoading(submitBtn,true);

    try {
        const titleKey = document.getElementById('notification-title-key').value.trim();
        const bodyKey = document.getElementById('notification-body-key').value.trim();
        const dataPayloadStr = document.getElementById('notification-data-payload').value.trim();
        const fallbackTitle = document.getElementById('notification-title').value.trim();
        const fallbackBody = document.getElementById('notification-body').value.trim();
        const targetType = dom.notificationTargetType.value;

        let payload, dataPayload = {};
        if (dataPayloadStr) {
            try { dataPayload = JSON.parse(dataPayloadStr); } 
            catch { throw new Error(__('notif.json_error')); }
        }

        if (titleKey && bodyKey) {
            payload = { dataPayload, notification_title_key: titleKey, notification_body_key: bodyKey };
        } else if (fallbackTitle && fallbackBody) {
            payload = { notification: { title: fallbackTitle, body: fallbackBody }, data: dataPayload };
        } else {
            throw new Error(__('notif.content_required'));
        }

        const target = { type: targetType };
        if (targetType === 'SINGLE_USER') {
            target.uid = document.getElementById('notification-target-uid').value.trim();
            if (!target.uid) throw new Error(__('notif.uid_required'));
        } else if (targetType === 'SUBSCRIPTION_LEVEL') {
            const tiers = ['free', 'plus', 'pro', 'ultra'];
            target.type = 'SUBSCRIPTION_TIER';
            target.tier = tiers[Number(document.getElementById('notification-target-level').value)];
            if (!target.tier) throw new Error(__('notif.tier_required'));
        }

        const isScheduled = dom.notificationScheduleSwitch.checked;
        let scheduleTimeISO = null;
        if (isScheduled) {
            const localTimeValue = document.getElementById('notification-schedule-time').value;
            if (!localTimeValue) throw new Error(__('notif.time_required'));
            const scheduledDate = new Date(localTimeValue);
            if (scheduledDate <= new Date()) throw new Error(__('notif.time_future'));
            scheduleTimeISO = scheduledDate.toISOString();
        }

        const requestId=(globalThis.crypto?.randomUUID?.() || 
            Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),
                b=>b.toString(16).padStart(2,'0')).join('')).replaceAll('-','');
        const apiPayload = {payload,target,...(deploymentCapabilities.notificationStatus?{requestId}:{})};
        if(isScheduled)apiPayload.scheduleTime=scheduleTimeISO;
        const apiFunction = isScheduled ? scheduleNotificationFn : sendTargetedNotificationFn;

        // Persist the ID before the first network request. A timeout could occur
        // after FCM accepted the message or Cloud Tasks created the job.
        statusRequestId=deploymentCapabilities.notificationStatus?requestId:null;
        deliveryUncertain=true;
        if(deploymentCapabilities.notificationStatus)rememberDelivery(requestId);
        deliveryNotice(__('notif.sending'));
        showToast(isScheduled ? __('notif.scheduling') : __('notif.sending'),'info');
        let result;
        try { result = await apiFunction(apiPayload); }
        catch(error){
            if(epoch!==notificationEpoch||auth?.currentUser?.uid!==uid)return;
            if(['functions/invalid-argument','functions/permission-denied',
                'functions/unauthenticated'].includes(error.code))clearDelivery();
            else deliveryNotice(__('notif.uncertain'),true);
            throw error;
        }
        if(epoch!==notificationEpoch||auth?.currentUser?.uid!==uid)return;
        dom.notificationForm.reset();
        dom.notificationTemplateSelector.value='';
        handleTemplateSelection();
        handleTargetTypeChange();
        if(deploymentCapabilities.notificationStatus&&result.data?.queued){
            statusPollCount=0;
            void checkDeliveryStatus(requestId,true);
        } else {
            // Legacy backend compatibility. Without a queued status record,
            // FCM counts cannot demonstrate actual device display.
            clearDelivery();
            deliveryNotice(ntr('İstek işlendi. Cihazda gösterim doğrulanmadı.',
                'Request processed. Device display is not confirmed.'));
        }
        handleScheduleSwitchChange();
    } catch (error) {
        if(epoch!==notificationEpoch||auth?.currentUser?.uid!==uid)return;
        console.error("[CLIENT] Error submitting notification:", error);
        showToast(()=>deliveryUncertain ? __('notif.uncertain') : userErrorMessage(error), 'error');
    } finally {
        if(epoch!==notificationEpoch||auth?.currentUser?.uid!==uid)return;
        submissionPending = false;
        setButtonLoading(submitBtn,false);
        submitBtn.disabled = deliveryUncertain;
        handleScheduleSwitchChange();
        if (deliveryUncertain) submitBtn.textContent = __('notif.uncertain_short');
    }
}

/**
 * Handles the cancellation of a scheduled notification task.
 * @param {string} taskId - The ID of the task to cancel.
 */
async function handleCancelTask(taskId) {
    if(cancellingTasks.has(taskId))return; cancellingTasks.add(taskId);
    if (!await confirmDialog(()=>({title:__('common.confirm'),body:__('notif.cancel_confirm')}))) {cancellingTasks.delete(taskId);return;}
    showToast(() => __('notif.cancelling'), 'info');
    try {
        const result = await cancelScheduledNotificationFn({ taskId });
        showToast(() => __('notif.cancelled'), 'success');
    } catch (error) {
        console.error(`[CLIENT] Error cancelling task ${taskId}:`, error);
        showToast(() => userErrorMessage(error), 'error');
    } finally {cancellingTasks.delete(taskId);}
}

// js/modules/notification.js

/**
 * Attaches a real-time listener for scheduled notifications.
 */
export function listenForScheduledTasks() {
    const finishLoading = beginPanelLoading(dom.scheduledTasksListContainer);
    if (unsubscribeFromScheduledTasks) unsubscribeFromScheduledTasks();

    unsubscribeFromScheduledTasks = db.collection('scheduledNotifications')
        .orderBy('scheduleTime', 'asc')
        .onSnapshot(snapshot => {
        finishLoading();
            const container = dom.scheduledTasksListContainer;
            if (snapshot.empty) {
                crossfade(container, () => { container.innerHTML = `<p class="form-hint" data-i18n="notif.empty">${__('notif.empty')}</p>`; });
                return;
            }
            const fragment = document.createDocumentFragment();
            snapshot.forEach(doc => {
                const task = doc.data();
                const scheduleDate = task.scheduleTime.toDate();
                const formattedTime = scheduleDate.toLocaleString(getLang()==='tr'?'tr-TR':'en-US', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                const title = task.payload?.notification?.title || task.notification?.title || task.payload?.notification_title_key || __('notif.data_only');

                const item = document.createElement('div');
                item.className = 'task-item';
                item.innerHTML = `
                <div class="task-details">
                    <span class="task-title" title="${escapeHTML(title)}">${escapeHTML(title)}</span>
                    <span class="task-time">${__('notif.scheduled_for')}: ${formattedTime}</span>
                    <span class="task-target">${__('notif.target_label')}: ${__(({ALL_USERS:'notif.target_all',SINGLE_USER:'notif.target_single',SUBSCRIPTION_TIER:'notif.target_level',SUBSCRIPTION_LEVEL:'notif.target_level'})[task.target?.type]||'notif.target_label')}</span>
                </div>
                <div class="task-actions"><button class="cancel-task-btn chrome-btn-outline" data-task-id="${escapeHTML(doc.id)}">${__('common.cancel')}</button></div>`;
                fragment.appendChild(item);
            });
            crossfade(container, () => container.replaceChildren(fragment));
        }, error => {
        finishLoading();
            console.error("[CLIENT] Error listening for scheduled tasks:", error);
            showLoadError(dom.scheduledTasksListContainer,()=>__('notif.tasks_error'),
                listenForScheduledTasks,{staleSelector:'.task-item'});
        });
}

/**
 * Detaches the real-time listener for scheduled tasks.
 */
export function stopListeningForScheduledTasks() {
    if (unsubscribeFromScheduledTasks) {
        unsubscribeFromScheduledTasks();
        unsubscribeFromScheduledTasks = null;
    }
}

/**
 * Initializes all event listeners for the notification module.
 */
export function initNotificationModule() {
    let lastUid=null;
    auth?.onAuthStateChanged(user=>{
        const nextUid=user?.uid||null;
        if(nextUid===lastUid)return;
        lastUid=nextUid;notificationEpoch++;submissionPending=false;
        if(statusPollTimer){clearTimeout(statusPollTimer);statusPollTimer=null;}
        statusRequestId=null;deliveryUncertain=false;statusPollCount=0;
        const submit=document.getElementById('submit-notification-btn');
        if(submit)submit.disabled=false;
        if(!nextUid){deliveryNotice('');return;}
        try{
            const pending=JSON.parse(sessionStorage.getItem(DELIVERY_SESSION_KEY)||'null');
            if(deploymentCapabilities.notificationStatus && pending?.uid===nextUid && /^[a-zA-Z0-9_-]{12,100}$/.test(pending.requestId)){
                statusRequestId=pending.requestId;deliveryUncertain=true;
                deliveryNotice(ntr('Önceki bildirimin durumunu kontrol et.','Check the prior notification status.'),true);
                void checkDeliveryStatus(statusRequestId,true);
            }
        }catch{}
        handleScheduleSwitchChange();
    });
    dom.notificationForm.addEventListener('submit', handleNotificationFormSubmit);
    dom.notificationScheduleSwitch.addEventListener('change', handleScheduleSwitchChange);
    dom.notificationTargetType.addEventListener('change', handleTargetTypeChange);
    dom.notificationTemplateSelector.addEventListener('change', handleTemplateSelection);

    dom.scheduledTasksListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('cancel-task-btn')) {
            const taskId = e.target.getAttribute('data-task-id');
            handleCancelTask(taskId);
        }
    });

    onLangChange(() => {handleScheduleSwitchChange(); if(unsubscribeFromScheduledTasks)listenForScheduledTasks();});
    // Initial UI setup
    handleScheduleSwitchChange();
    handleTargetTypeChange();
}