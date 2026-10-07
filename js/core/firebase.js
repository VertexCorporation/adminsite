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
let listConsoleChatChannelsFn, createConsoleChatChannelFn, updateConsoleChatChannelFn, postConsoleChatMessageFn, listConsoleChatMessagesFn, updateConsoleChatTaskStatusFn, deleteConsoleChatMessageFn, deleteConsoleChatChannelFn, listConsoleChatDirectoryFn;
let getPanelPermissionsFn;
let listSiteTeamFn, setSiteTeamEntryFn, deleteSiteTeamEntryFn;


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

// httpsCallable yerine gecen sarmalayici: cagrilinca callCallable'i isletir
// (initFirebase'de binding'e Promise degil FONKSIYON atanir).
const callable = (name) => (data) => callCallable(name, data);

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
    sendTargetedNotificationFn = callable('sendTargetedNotification');
    scheduleNotificationFn = callable('scheduleNotification');
    listScheduledNotificationsFn = callable('listScheduledNotifications');
    cancelScheduledNotificationFn = callable('cancelScheduledNotification');
    getServerStatusFn = callable('getServerStatus');
    setServerStatusFn = callable('setServerStatus');
    blockOnlineModelFn = callable('blockOnlineModel');
    updateModelsListFn = callable('updateModelsList');
    createNewsArticleFn = callable('createNewsArticle');
    deleteNewsArticleFn = callable('deleteNewsArticle');
    addAdminRoleFn = callable('addAdminRole');
    getModelImageUploadUrlFn = callable('getModelImageUploadUrl');
    getCoverUploadUrlFn = callable('getCoverUploadUrl');
    triggerAttributionsUpdateFn = callable('triggerAttributionsUpdate');
    getVertexContributorsFn = callable('getVertexContributors');
    toggleContributorVerificationFn = callable('toggleContributorVerification');
    verifyUserEmailFn = callable('verifyUserEmail');
    deleteVertexContributorFn = callable('deleteVertexContributor');
    updateContributorApplicationFn = callable('updateContributorApplication');
    toggleVertexStatusFn = callable('toggleVertexStatus');
    removeAdminRoleFn = callable('removeAdminRole');
    listAdminsFn = callable('listAdmins');
    setUserDepartmentFn = callable('setUserDepartment');
    setUserDepartmentsFn = callable('setUserDepartments');
    listDepartmentUsersFn = callable('listDepartmentUsers');
    saveDepartmentPermissionsFn = callable('saveDepartmentPermissions');
    setUserSubscriptionFn = callable('setUserSubscription');
    removeUserSubscriptionFn = callable('removeUserSubscription');
    listUserSubscriptionsFn = callable('listUserSubscriptions');
    bulkSetUserSubscriptionsFn = callable('bulkSetUserSubscriptions');
    listConsoleChatChannelsFn = callable('listConsoleChatChannels');
    createConsoleChatChannelFn = callable('createConsoleChatChannel');
    updateConsoleChatChannelFn = callable('updateConsoleChatChannel');
    postConsoleChatMessageFn = callable('postConsoleChatMessage');
    listConsoleChatMessagesFn = callable('listConsoleChatMessages');
    updateConsoleChatTaskStatusFn = callable('updateConsoleChatTaskStatus');
    getPanelPermissionsFn = callable('getPanelPermissions');
    deleteConsoleChatMessageFn = callable('deleteConsoleChatMessage');
    deleteConsoleChatChannelFn = callable('deleteConsoleChatChannel');
    listConsoleChatDirectoryFn = callable('listConsoleChatDirectory');
    listSiteTeamFn = callable('listSiteTeam');
    setSiteTeamEntryFn = callable('setSiteTeamEntry');
    deleteSiteTeamEntryFn = callable('deleteSiteTeamEntry');
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
    deleteConsoleChatMessageFn,
    deleteConsoleChatChannelFn,
    listConsoleChatDirectoryFn,
    listSiteTeamFn,
    setSiteTeamEntryFn,
    deleteSiteTeamEntryFn,
    getPanelPermissionsFn
};
