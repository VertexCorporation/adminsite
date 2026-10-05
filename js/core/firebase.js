// js/core/firebase.js

// These will be populated by the initFirebase function
let auth, db, storage, functions, appCheck;
let sendTargetedNotificationFn, scheduleNotificationFn, listScheduledNotificationsFn;
let cancelScheduledNotificationFn, getServerStatusFn, setServerStatusFn, blockOnlineModelFn;
let updateModelsListFn, createNewsArticleFn, deleteNewsArticleFn, addAdminRoleFn;
let getModelImageUploadUrlFn, getCoverUploadUrlFn, triggerAttributionsUpdateFn;
let getVertexContributorsFn, toggleContributorVerificationFn, deleteVertexContributorFn;
let verifyUserEmailFn;
let updateContributorApplicationFn;
let toggleVertexStatusFn, removeAdminRoleFn, listAdminsFn, setUserDepartmentFn, setUserDepartmentsFn, listDepartmentUsersFn, saveDepartmentPermissionsFn;
let setUserSubscriptionFn, removeUserSubscriptionFn, listUserSubscriptionsFn, bulkSetUserSubscriptionsFn;
let listConsoleChatChannelsFn, createConsoleChatChannelFn, updateConsoleChatChannelFn, postConsoleChatMessageFn, listConsoleChatMessagesFn, updateConsoleChatTaskStatusFn;
let getPanelPermissionsFn;


/**
 * Initializes the Firebase app and all its services.
 * This function must be called once with the secure config.
 * @param {object} firebaseConfig The configuration object from the server.
 */
/**
 * Callable cagrilari dogrudan Cloud Run URL'lerine yapar —
 * cloudfunctions.net alias'i kota/revizyon sorunlarinda kiriliyor;
 * run.app URL'leri bagimsiz calisir ve CORS basliklariyla doner.
 */
async function callCallable(name, data) {
    const user = auth ? auth.currentUser : null;
    const idToken = user ? await user.getIdToken() : null;
    const res = await fetch(`https://${name.toLowerCase()}-o5h7dmtija-ew.a.run.app`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: 'Bearer ' + idToken } : {})
        },
        body: JSON.stringify({ data: data ?? {} })
    });
    let json = {};
    try { json = await res.json(); } catch { /* bos govde */ }
    if (!res.ok || json.error) {
        const err = json.error || {};
        const e = new Error(`${err.status || 'INTERNAL'}: ${err.message || 'HTTP ' + res.status}`);
        throw e;
    }
    return { data: json.result !== undefined ? json.result : null };
}

function initFirebase(firebaseConfig) {
    if (firebase.apps.length) return; // Prevent re-initialization



    firebase.initializeApp(firebaseConfig);

    // Initialize services
    appCheck = firebase.appCheck();
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    functions = firebase.functions(); // Default region functions

    // Activate App Check
    try {
        appCheck.activate(
            '6LfPxncrAAAAANROpBb3E7q-gIf52Py-AePSGfJG', // Site key
            true
        );
        console.log('[APP_CHECK] Firebase App Check activated successfully.');
    } catch (error) {
        console.error('[APP_CHECK] Failed to activate App Check:', error);
    }

    // Initialize Cloud Functions with the correct region
    const europeFunctions = firebase.app().functions('europe-west1');
    sendTargetedNotificationFn = callCallable('sendTargetedNotification');
    scheduleNotificationFn = callCallable('scheduleNotification');
    listScheduledNotificationsFn = callCallable('listScheduledNotifications');
    cancelScheduledNotificationFn = callCallable('cancelScheduledNotification');
    getServerStatusFn = callCallable('getServerStatus');
    setServerStatusFn = callCallable('setServerStatus');
    blockOnlineModelFn = callCallable('blockOnlineModel');
    updateModelsListFn = callCallable('updateModelsList');
    createNewsArticleFn = callCallable('createNewsArticle');
    deleteNewsArticleFn = callCallable('deleteNewsArticle');
    addAdminRoleFn = callCallable('addAdminRole');
    getModelImageUploadUrlFn = callCallable('getModelImageUploadUrl');
    getCoverUploadUrlFn = callCallable('getCoverUploadUrl');
    triggerAttributionsUpdateFn = callCallable('triggerAttributionsUpdate');
    getVertexContributorsFn = callCallable('getVertexContributors');
    toggleContributorVerificationFn = callCallable('toggleContributorVerification');
    verifyUserEmailFn = callCallable('verifyUserEmail');
    deleteVertexContributorFn = callCallable('deleteVertexContributor');
    updateContributorApplicationFn = callCallable('updateContributorApplication');
    toggleVertexStatusFn = callCallable('toggleVertexStatus');
    removeAdminRoleFn = callCallable('removeAdminRole');
    listAdminsFn = callCallable('listAdmins');
    setUserDepartmentFn = callCallable('setUserDepartment');
    setUserDepartmentsFn = callCallable('setUserDepartments');
    listDepartmentUsersFn = callCallable('listDepartmentUsers');
    saveDepartmentPermissionsFn = callCallable('saveDepartmentPermissions');
    setUserSubscriptionFn = callCallable('setUserSubscription');
    removeUserSubscriptionFn = callCallable('removeUserSubscription');
    listUserSubscriptionsFn = callCallable('listUserSubscriptions');
    bulkSetUserSubscriptionsFn = callCallable('bulkSetUserSubscriptions');
    listConsoleChatChannelsFn = callCallable('listConsoleChatChannels');
    createConsoleChatChannelFn = callCallable('createConsoleChatChannel');
    updateConsoleChatChannelFn = callCallable('updateConsoleChatChannel');
    postConsoleChatMessageFn = callCallable('postConsoleChatMessage');
    listConsoleChatMessagesFn = callCallable('listConsoleChatMessages');
    updateConsoleChatTaskStatusFn = callCallable('updateConsoleChatTaskStatus');
    getPanelPermissionsFn = callCallable('getPanelPermissions');
}

// Export the initializer function and all the service variables
export {
    initFirebase,
    auth,
    db,
    storage,
    functions,
    appCheck,
    sendTargetedNotificationFn,
    scheduleNotificationFn,
    listScheduledNotificationsFn,
    cancelScheduledNotificationFn,
    getServerStatusFn,
    setServerStatusFn,
    blockOnlineModelFn,
    updateModelsListFn,
    createNewsArticleFn,
    deleteNewsArticleFn,
    addAdminRoleFn,
    getModelImageUploadUrlFn,
    getCoverUploadUrlFn,
    triggerAttributionsUpdateFn,
    getVertexContributorsFn,
    toggleContributorVerificationFn,
    verifyUserEmailFn,
    deleteVertexContributorFn,
    updateContributorApplicationFn,
    toggleVertexStatusFn,
    removeAdminRoleFn,
    listAdminsFn,
    setUserDepartmentFn,
    setUserDepartmentsFn,
    listDepartmentUsersFn,
    saveDepartmentPermissionsFn,
    setUserSubscriptionFn,
    removeUserSubscriptionFn,
    listUserSubscriptionsFn,
    bulkSetUserSubscriptionsFn,
    listConsoleChatChannelsFn,
    createConsoleChatChannelFn,
    updateConsoleChatChannelFn,
    postConsoleChatMessageFn,
    listConsoleChatMessagesFn,
    updateConsoleChatTaskStatusFn,
    getPanelPermissionsFn
};
