import { confirmDialog } from './shell.js';
import { renderPager } from '../ui/pager.js';
import { beginPanelLoading } from '../utils/loading.js';
// js/modules/notification.js

import { db, sendTargetedNotificationFn, scheduleNotificationFn, cancelScheduledNotificationFn, getNotificationDeliveryStatusFn, reconcileNotificationQueueFn, previewNotificationAudienceFn, auth } from '../core/firebase.js';
import * as dom from '../utils/dom.js';
import { showToast, userErrorMessage, __, getLang, onLangChange, escapeHTML } from '../utils/ui.js';

let unsubscribeFromScheduledTasks = null;
let scheduledRecords=[];
let scheduledSearch='';
let scheduledFilter='all';
let scheduledPage=1;
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
        if(status==='DELIVERED'||status==='NO_DELIVERIES'||status==='SENT') {
            const msg=status==='NO_DELIVERIES'
                ? ntr('FCM tarafından kabul edilen cihaz tokenı yok. Tokenları ve hata kodlarını incele.','FCM accepted no device tokens. Check tokens and failure codes.')
                : ntr(`FCM ${successCount} tokenı kabul etti, ${failureCount} tokenı reddetti. Cihazda gösterilmesi ayrıca doğrulanmalıdır.`,`FCM accepted ${successCount} tokens and rejected ${failureCount}. Device display is not confirmed.`);
            clearDelivery();deliveryNotice(errors?`${msg} ${errors}`:msg);
            showToast(msg,status==='DELIVERED'?'success':'warning');
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

function updateTemplatePreview(){
 const host=document.getElementById('notification-template-preview');if(!host)return;
 const title=document.getElementById('notification-title').value.trim()
    ||document.getElementById('notification-title-key').value.trim();
 const body=document.getElementById('notification-body').value.trim()
    ||document.getElementById('notification-body-key').value.trim();
 host.replaceChildren();
 const heading=document.createElement('strong');
 heading.textContent=title||ntr('Bildirim başlığı','Notification title');
 const copy=document.createElement('p');copy.textContent=body||ntr('Bildirim metni','Notification body');
 host.append(heading,copy);
 const hint=document.createElement('small');hint.className='form-hint';
 hint.textContent=ntr('Anahtarlar cihazda kullanıcının dilinde çözümlenir.','Localization keys resolve on the recipient device.');
 host.append(hint);
}
function renderTemplateParameters(){
 const source=document.getElementById('notification-data-payload');
 const host=document.getElementById('notification-template-parameters');if(!host)return;
 host.replaceChildren();
 let values;
 try{values=JSON.parse(source.value||'{}');}catch{return;}
 if(!values||typeof values!=='object'||Array.isArray(values))return;
 for(const [key,value]of Object.entries(values)){
    if(typeof value==='object')continue;
    const label=document.createElement('label');label.className='form-group-field';label.textContent=key;
    const input=document.createElement('input');input.type='text';input.value=String(value??'');
    input.setAttribute('aria-label',key);
    input.addEventListener('input',()=>{
       values[key]=input.value;
       source.value=JSON.stringify(values,null,2);
    });
    label.append(input);host.append(label);
 }
 updateTemplatePreview();
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
        renderTemplateParameters();
    } else {
        // Clear if nothing selected
        titleKeyInput.value = '';
        bodyKeyInput.value = '';
        payloadInput.value = '';
        renderTemplateParameters();
    }
    updateTemplatePreview();
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
            if (!Number.isFinite(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()+60000) throw new Error(__('notif.time_future'));
            scheduleTimeISO = scheduledDate.toISOString();
        }

        const placeholders=Object.values(dataPayload).filter(value=>typeof value==='string'&&/^ENTER_[A-Z_]+$/.test(value));
        if(placeholders.length)throw new Error(ntr('Şablon değişkenlerini doldurun.','Fill in template placeholders.'));
        const estimate=(await previewNotificationAudienceFn({target,payload})).data;
        const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
        const time=isScheduled?new Intl.DateTimeFormat(getLang()==='tr'?'tr-TR':'en-US',
           {dateStyle:'medium',timeStyle:'short',timeZone:zone}).format(new Date(scheduleTimeISO)):ntr('Şimdi','Now');
        const confirmed=await confirmDialog(()=>({
            title:ntr('Bildirimi onayla','Confirm notification'),
            body:ntr('Kullanıcı ve cihaz sayıları tahminidir. Cihazda görünme garantisi yoktur.','Counts are estimates, not proof of display on devices.'),
            rows:[
                {label:ntr('Hedef','Audience'),value:target.type==='ALL_USERS'?ntr('Tüm kullanıcılar','All users'):target.type==='SINGLE_USER'?target.uid:target.tier},
                {label:ntr('Kullanıcı','Users'),value:String(estimate.users)},
                {label:ntr('Cihaz tokenı','Device tokens'),value:String(estimate.devices)},
                {label:ntr('Başlık','Title'),value:payload.notification?.title||payload.notification_title_key||'—'},
                {label:ntr('Zaman','Time'),value:time+' · '+zone}
            ]
        }));
        if(!confirmed)return;
        const apiPayload = { payload, target, scheduleTime: scheduleTimeISO };
        const apiFunction = isScheduled ? scheduleNotificationFn : sendTargetedNotificationFn;
        if(!isScheduled)delete apiPayload.scheduleTime;
        statusRequestId=crypto.randomUUID();apiPayload.requestId=statusRequestId;
        statusPollCount=0;deliveryUncertain=true;rememberDelivery(statusRequestId);

        showToast(isScheduled ? __('notif.scheduling') : __('notif.sending'), 'info');
        let result;
        try { result = await apiFunction(apiPayload); }
        catch (error) {
            // A network/500 failure can follow partial delivery; never invite a blind resend.
            if (['functions/invalid-argument','functions/permission-denied','functions/unauthenticated'].includes(error.code)) clearDelivery();
            throw error;
        }
        if(isScheduled && result?.data?.status==='SCHEDULED'){
            clearDelivery();
            deliveryNotice(ntr('Bildirim planlandı.','Notification scheduled.'));
            showToast(() => __('notif.success'),'success');
        }else if(!isScheduled && result?.data?.queued){
            deliveryNotice(ntr('Bildirim kuyruğa alındı. Sonuç takip ediliyor.','Notification queued. Tracking delivery.'),true);
            void checkDeliveryStatus(statusRequestId,true);
        }else{
            if(!isScheduled)clearDelivery();
            showToast(() => __('notif.success'),'success');
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
function renderScheduledTasks(){
 const container=dom.scheduledTasksListContainer;
 if(!container)return;
 container.replaceChildren();
 let controls=document.getElementById('notification-task-controls');
 if(!controls){
  controls=document.createElement('div');controls.id='notification-task-controls';controls.className='ui-list-actions';
  const search=document.createElement('input');search.id='notification-task-search';
  search.type='search';search.className='search-input-field';
  search.placeholder=ntr('Bildirimlerde ara','Search notifications');
  search.addEventListener('input',()=>{scheduledSearch=search.value.toLocaleLowerCase();scheduledPage=1;renderScheduledTasks();});
  const filter=document.createElement('select');filter.id='notification-task-filter';
  for(const [value,trLabel,en] of [
    ['all','Tüm durumlar','All statuses'],['SCHEDULED','Planlanan','Scheduled'],
    ['PROCESSING','İşleniyor','Processing'],['SENT','Gönderilen','Sent'],
    ['FAILED','Başarısız','Failed'],['CANCELLED','İptal edilen','Cancelled']
  ]){const option=document.createElement('option');option.value=value;option.textContent=ntr(trLabel,en);filter.append(option);}
  filter.addEventListener('change',()=>{scheduledFilter=filter.value;scheduledPage=1;renderScheduledTasks();});
  controls.append(search,filter);
  container.parentElement.insertBefore(controls,container);
 }
 document.getElementById('notification-task-search').value=scheduledSearch;
 document.getElementById('notification-task-filter').value=scheduledFilter;
 const matches=scheduledRecords.filter(({id,task})=>{
   const state=task.status||'SCHEDULED';
   const group=['FAILED','FAILED_UNCERTAIN','NO_DELIVERIES','QUEUE_FAILED','QUEUE_UNCERTAIN'].includes(state)?'FAILED':state;
   const byState=scheduledFilter==='all'||scheduledFilter===state||scheduledFilter===group;
   const title=task.payload?.notification?.title||task.notification?.title||task.payload?.notification_title_key||'';
   return byState && (title+' '+id+' '+(task.target?.type||'')).toLocaleLowerCase().includes(scheduledSearch);
 });
 const pageSize=25;scheduledPage=Math.min(scheduledPage,Math.max(1,Math.ceil(matches.length/pageSize)));
 for(const {id,task}of matches.slice((scheduledPage-1)*pageSize,scheduledPage*pageSize)){
    const time=task.scheduleTime?.toDate?.()||new Date(task.scheduleTime||Date.now());
    const formatted=time.toLocaleString(getLang()==='tr'?'tr-TR':'en-US',{
       year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'
    });
    const title=task.payload?.notification?.title||task.notification?.title||task.payload?.notification_title_key||__('notif.data_only');
    const item=document.createElement('div');item.className='task-item';
    const details=document.createElement('div');details.className='task-details';
    for(const [className,value]of [
      ['task-title',title],['task-time',formatted],
      ['task-target',task.target?.type||'—'],
      ['form-hint',task.status||'SCHEDULED'],
      ['form-hint',task.successCount==null?'':ntr('FCM kabulü: ','FCM accepted: ')+task.successCount+
       ' · '+ntr('Başarısız: ','Failed: ')+(task.failureCount||0)]
    ]){if(!value)continue;const p=document.createElement('span');p.className=className;p.textContent=String(value);details.append(p);}
    item.append(details);
    if(task.status==='SCHEDULED'){
      const actions=document.createElement('div');actions.className='task-actions';
      const button=document.createElement('button');button.type='button';button.className='cancel-task-btn chrome-btn-outline';
      button.dataset.taskId=id;button.textContent=__('common.cancel');actions.append(button);item.append(actions);
    }
    container.append(item);
 }
 if(!matches.length){
   const empty=document.createElement('p');empty.className='form-hint';
   empty.textContent=ntr('Eşleşen bildirim yok.','No matching notifications.');container.append(empty);
 }
 renderPager(container,{page:scheduledPage,total:matches.length,pageSize,language:getLang(),
   onChange:next=>{scheduledPage=next;renderScheduledTasks();}});
}
export function listenForScheduledTasks(){
 const finishLoading=beginPanelLoading(dom.scheduledTasksListContainer);
 if(unsubscribeFromScheduledTasks)unsubscribeFromScheduledTasks();
 unsubscribeFromScheduledTasks=db.collection('scheduledNotifications')
    .orderBy('scheduleTime','desc').limit(500).onSnapshot(snapshot=>{
       finishLoading();
       scheduledRecords=snapshot.docs.filter(doc=>doc.data().kind!=='IMMEDIATE')
          .map(doc=>({id:doc.id,task:doc.data()}));
       renderScheduledTasks();
    },error=>{
       finishLoading();console.error('[NOTIFICATIONS] Scheduled task listener failed',error.code||'unknown');
       dom.scheduledTasksListContainer.replaceChildren();
       const button=document.createElement('button');button.type='button';
       button.className='chrome-btn-outline';button.textContent=__('common.retry');
       button.onclick=listenForScheduledTasks;dom.scheduledTasksListContainer.append(button);
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
    const payloadElement=document.getElementById('notification-data-payload');
    const parent=payloadElement.closest('.form-group-field')||payloadElement.parentElement;
    const parameters=document.createElement('div');parameters.id='notification-template-parameters';
    parameters.className='form-grid';parent.append(parameters);
    const preview=document.createElement('div');preview.id='notification-template-preview';
    preview.className='ui-notification-preview';preview.setAttribute('aria-live','polite');
    parent.append(preview);
    payloadElement.addEventListener('input',renderTemplateParameters);
    for(const name of ['notification-title','notification-body','notification-title-key','notification-body-key']){
        document.getElementById(name)?.addEventListener('input',updateTemplatePreview);
    }
    renderTemplateParameters();updateTemplatePreview();

    dom.scheduledTasksListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('cancel-task-btn')) {
            const taskId = e.target.getAttribute('data-task-id');
            handleCancelTask(taskId);
        }
    });

    onLangChange(() => {handleScheduleSwitchChange();renderScheduledTasks();});
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