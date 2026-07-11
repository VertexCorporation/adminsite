// js/modules/notification.js

import { db, sendTargetedNotificationFn, scheduleNotificationFn, cancelScheduledNotificationFn } from '../core/firebase.js';
import * as dom from '../utils/dom.js';
import { showToast } from '../utils/ui.js';

let unsubscribeFromScheduledTasks = null;

/**
 * Handles changes in the notification schedule switch.
 */
function handleScheduleSwitchChange() {
    const isScheduled = dom.notificationScheduleSwitch.checked;
    dom.scheduleDateTimePicker.style.display = isScheduled ? 'block' : 'none';
    document.getElementById('notification-schedule-time').required = isScheduled;
    document.getElementById('submit-notification-btn').textContent = isScheduled ? 'Schedule Notification' : 'Send Notification Now';
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
    const submitBtn = document.getElementById('submit-notification-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'SUBMITTING';

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
            catch { throw new Error("Data Payload is not valid JSON."); }
        }

        if (titleKey && bodyKey) {
            payload = { dataPayload, notification_title_key: titleKey, notification_body_key: bodyKey };
        } else if (fallbackTitle && fallbackBody) {
            payload = { notification: { title: fallbackTitle, body: fallbackBody }, data: dataPayload };
        } else {
            throw new Error("Provide either Notification Keys or Fallback Title/Body.");
        }

        const target = { type: targetType };
        if (targetType === 'SINGLE_USER') {
            target.uid = document.getElementById('notification-target-uid').value.trim();
            if (!target.uid) throw new Error("User ID (UID) is required.");
        } else if (targetType === 'SUBSCRIPTION_LEVEL') {
            target.level = parseInt(document.getElementById('notification-target-level').value, 10);
        }

        const isScheduled = dom.notificationScheduleSwitch.checked;
        let scheduleTimeISO = null;
        if (isScheduled) {
            const localTimeValue = document.getElementById('notification-schedule-time').value;
            if (!localTimeValue) throw new Error("Please select a date and time for scheduling.");
            const scheduledDate = new Date(localTimeValue);
            if (scheduledDate <= new Date()) throw new Error("Scheduled time must be in the future.");
            scheduleTimeISO = scheduledDate.toISOString();
        }

        const apiPayload = { payload, target, scheduleTime: scheduleTimeISO };
        const apiFunction = isScheduled ? scheduleNotificationFn : sendTargetedNotificationFn;
        if (!isScheduled) delete apiPayload.scheduleTime;

        showToast(isScheduled ? 'Scheduling notification' : 'Sending notification', 'info');
        const result = await apiFunction(apiPayload);
        showToast(result.data.message, 'success');

        dom.notificationForm.reset();
        handleTargetTypeChange();
        handleScheduleSwitchChange();
    } catch (error) {
        console.error("[CLIENT] Error submitting notification:", error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        handleScheduleSwitchChange();
    }
}

/**
 * Handles the cancellation of a scheduled notification task.
 * @param {string} taskId - The ID of the task to cancel.
 */
async function handleCancelTask(taskId) {
    if (!confirm(`Are you sure you want to cancel this scheduled notification?`)) return;
    showToast(`Cancelling task ${taskId}`, 'info');
    try {
        const result = await cancelScheduledNotificationFn({ taskId });
        showToast(result.data.message, 'success');
    } catch (error) {
        console.error(`[CLIENT] Error cancelling task ${taskId}:`, error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

// js/modules/notification.js

/**
 * Attaches a real-time listener for scheduled notifications.
 */
export function listenForScheduledTasks() {
    if (unsubscribeFromScheduledTasks) unsubscribeFromScheduledTasks();

    unsubscribeFromScheduledTasks = db.collection('scheduledNotifications')
        .orderBy('scheduleTime', 'asc')
        .onSnapshot(snapshot => {
            dom.scheduledTasksListContainer.innerHTML = '';
            if (snapshot.empty) {
                dom.scheduledTasksListContainer.innerHTML = '<p class="form-hint">No scheduled notifications found.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const task = doc.data();
                const scheduleDate = task.scheduleTime.toDate();
                const formattedTime = scheduleDate.toLocaleString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                const title = task.notification?.title || 'Data-only Notification';

                const item = document.createElement('div');
                item.className = 'task-item';
                item.innerHTML = `
                <div class="task-details">
                    <span class="task-title" title="${title}">${title}</span>
                    <span class="task-time">Scheduled for: ${formattedTime}</span>
                    <span class="task-target">Target: ${task.target.type}</span>
                </div>
                <div class="task-actions"><button class="cancel-task-btn" data-task-id="${doc.id}">Cancel</button></div>`;
                dom.scheduledTasksListContainer.appendChild(item);
            });
        }, error => {
            console.error("[CLIENT] Error listening for scheduled tasks:", error);
            dom.scheduledTasksListContainer.innerHTML = '<p class="form-hint" style="color:var(--error-color);">Error loading tasks.</p>';
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

    // Initial UI setup
    handleScheduleSwitchChange();
    handleTargetTypeChange();
}