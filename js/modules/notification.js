import { confirmDialog } from './shell.js';
import { beginPanelLoading } from '../utils/loading.js';
// js/modules/notification.js

import { db, sendTargetedNotificationFn, scheduleNotificationFn, cancelScheduledNotificationFn, getNotificationDeliveryStatusFn, auth } from '../core/firebase.js';
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
        const {status,successCount,failureCount,failureCodes}=response.data||{};
        const errors=Object.entries(failureCodes||{}).filter(([,count])=>count>0)
            .slice(0,3).map(([code,count])=>`${code}: ${count}`).join(', ');
        if(status==='DELIVERED'||status==='NO_DELIVERIES') {
            const msg=status==='NO_DELIVERIES'
                ? ntr('Gönderim tamamlandı ancak hiçbir cihaza ulaşılamadı. Cihaz tokenlarını kontrol et.','Delivery finished with no successful devices. Check device tokens.')
                : ntr(`Gönderim tamamlandı: ${successCount} başarılı, ${failureCount} başarısız.`,`Delivery finished: ${successCount} successful, ${failureCount} failed.`);
            clearDelivery();deliveryNotice(errors?`${msg} ${errors}`:msg);
            showToast(msg,status==='DELIVERED'?'success':'warning');
            return;
        }
        if(status==='QUEUE_FAILED') {
            clearDelivery();
            deliveryNotice(ntr('Gönderim kuyruğa alınamadı. Sunucu yapılandırmasını kontrol et.','Delivery could not be queued. Check server configuration.'));
            return;
        }
        if(status==='FAILED_UNCERTAIN'||status==='QUEUE_UNCERTAIN') {
            deliveryUncertain=true;
            deliveryNotice(ntr('Teslimat doğrulanamadı. Aynı bildirimi yeniden göndermeden önce sunucu kaydını incele.','Delivery is uncertain. Review the server record before sending again.'),true);
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
    e.preventDefault();
    if (submissionPending || deliveryUncertain) return;
    submissionPending = true;
    const submitBtn = document.getElementById('submit-notification-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = __('notif.submitting');

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

        const apiPayload = { payload, target, scheduleTime: scheduleTimeISO };
        const apiFunction = isScheduled ? scheduleNotificationFn : sendTargetedNotificationFn;
        if (!isScheduled) {
            delete apiPayload.scheduleTime;
            statusRequestId = crypto.randomUUID();
            apiPayload.requestId = statusRequestId;
            statusPollCount=0;
            deliveryUncertain=true;
            rememberDelivery(statusRequestId);
        }

        showToast(isScheduled ? __('notif.scheduling') : __('notif.sending'), 'info');
        let result;
        try { result = await apiFunction(apiPayload); }
        catch (error) {
            // A network/500 failure can follow partial delivery; never invite a blind resend.
            if (!isScheduled && ['functions/invalid-argument','functions/permission-denied','functions/unauthenticated'].includes(error.code)) clearDelivery();
            throw error;
        }
        if (!isScheduled && result?.data?.queued) {
            deliveryNotice(ntr('Bildirim kuyruğa alındı. Sonuç takip ediliyor.','Notification queued. Tracking delivery.'),true);
            void checkDeliveryStatus(statusRequestId,true);
        } else {
            if(!isScheduled)clearDelivery();
            showToast(() => __('notif.success'), 'success');
        }

        dom.notificationForm.reset();
        handleTargetTypeChange();
        handleScheduleSwitchChange();
    } catch (error) {
        console.error("[CLIENT] Error submitting notification:", error);
        showToast(()=>deliveryUncertain ? __('notif.uncertain') : userErrorMessage(error), 'error');
        if(deliveryUncertain && statusRequestId) void checkDeliveryStatus(statusRequestId,false);
    } finally {
        submissionPending = false;
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
            dom.scheduledTasksListContainer.innerHTML = '';
            const scheduled=snapshot.docs.filter(doc=>doc.data().kind!=='IMMEDIATE');
            if (!scheduled.length) {
                dom.scheduledTasksListContainer.innerHTML = `<p class="form-hint" data-i18n="notif.empty">${__('notif.empty')}</p>`;
                return;
            }
            scheduled.forEach(doc => {
                const task = doc.data();
                const scheduleDate = task.scheduleTime?.toDate?.() || new Date();
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
                <div class="task-actions">
                    <span class="form-hint">${escapeHTML(task.status||'SCHEDULED')}</span>
                    ${task.status==='SCHEDULED'?`<button class="cancel-task-btn chrome-btn-outline" data-task-id="${escapeHTML(doc.id)}">${__('common.cancel')}</button>`:''}
                </div>`;
                dom.scheduledTasksListContainer.appendChild(item);
            });
        }, error => {
        finishLoading();
            console.error("[CLIENT] Error listening for scheduled tasks:", error);
            dom.scheduledTasksListContainer.insertAdjacentHTML('beforeend',`<div class="task-error"><p data-i18n="notif.tasks_error">${__('notif.tasks_error')}</p><button class="chrome-btn-outline" data-tasks-retry>${__('common.retry')}</button></div>`);
            dom.scheduledTasksListContainer.querySelector('[data-tasks-retry]').onclick=listenForScheduledTasks;
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
    // Restore the pending request after navigation or refresh, without submitting it again.
    auth?.onAuthStateChanged(user=>{
        if(!user)return;
        try {
            const saved=JSON.parse(sessionStorage.getItem(DELIVERY_SESSION_KEY)||'null');
            if(saved?.uid===user.uid && saved?.requestId && !statusRequestId){
                statusRequestId=saved.requestId;deliveryUncertain=true;
                statusPollCount=0;handleScheduleSwitchChange();
                void checkDeliveryStatus(statusRequestId,true);
            }
        }catch{}
    });
    // Initial UI setup
    handleScheduleSwitchChange();
    handleTargetTypeChange();
}