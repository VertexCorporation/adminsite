// js/core/firebase.js

// These will be populated by the initFirebase function
let auth, db, storage, functions, appCheck;
let sendTargetedNotificationFn, scheduleNotificationFn, listScheduledNotificationsFn;
let cancelScheduledNotificationFn, getServerStatusFn, setServerStatusFn, blockOnlineModelFn;
let updateModelsListFn, createNewsArticleFn, deleteNewsArticleFn, addAdminRoleFn;
let getModelImageUploadUrlFn, getCoverUploadUrlFn, triggerAttributionsUpdateFn;
let getVertexContributorsFn, toggleContributorVerificationFn, deleteVertexContributorFn;
let verifyUserEmailFn;
let toggleVertexStatusFn, removeAdminRoleFn, listAdminsFn, setUserDepartmentFn, setUserDepartmentsFn, listDepartmentUsersFn, saveDepartmentPermissionsFn;


/**
 * Initializes the Firebase app and all its services.
 * This function must be called once with the secure config.
 * @param {object} firebaseConfig The configuration object from the server.
 */
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
    sendTargetedNotificationFn = europeFunctions.httpsCallable('sendTargetedNotification');
    scheduleNotificationFn = europeFunctions.httpsCallable('scheduleNotification');
    listScheduledNotificationsFn = europeFunctions.httpsCallable('listScheduledNotifications');
    cancelScheduledNotificationFn = europeFunctions.httpsCallable('cancelScheduledNotification');
    getServerStatusFn = europeFunctions.httpsCallable('getServerStatus');
    setServerStatusFn = europeFunctions.httpsCallable('setServerStatus');
    blockOnlineModelFn = europeFunctions.httpsCallable('blockOnlineModel');
    updateModelsListFn = europeFunctions.httpsCallable('updateModelsList');
    createNewsArticleFn = europeFunctions.httpsCallable('createNewsArticle');
    deleteNewsArticleFn = europeFunctions.httpsCallable('deleteNewsArticle');
    addAdminRoleFn = europeFunctions.httpsCallable('addAdminRole');
    getModelImageUploadUrlFn = europeFunctions.httpsCallable('getModelImageUploadUrl');
    getCoverUploadUrlFn = europeFunctions.httpsCallable('getCoverUploadUrl');
    triggerAttributionsUpdateFn = europeFunctions.httpsCallable('triggerAttributionsUpdate');
    getVertexContributorsFn = europeFunctions.httpsCallable('getVertexContributors');
    toggleContributorVerificationFn = europeFunctions.httpsCallable('toggleContributorVerification');
    verifyUserEmailFn = europeFunctions.httpsCallable('verifyUserEmail');
    deleteVertexContributorFn = europeFunctions.httpsCallable('deleteVertexContributor');
    toggleVertexStatusFn = europeFunctions.httpsCallable('toggleVertexStatus');
    removeAdminRoleFn = europeFunctions.httpsCallable('removeAdminRole');
    listAdminsFn = europeFunctions.httpsCallable('listAdmins');
    setUserDepartmentFn = europeFunctions.httpsCallable('setUserDepartment');
    setUserDepartmentsFn = europeFunctions.httpsCallable('setUserDepartments');
    listDepartmentUsersFn = europeFunctions.httpsCallable('listDepartmentUsers');
    saveDepartmentPermissionsFn = europeFunctions.httpsCallable('saveDepartmentPermissions');
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
    toggleVertexStatusFn,
    removeAdminRoleFn,
    listAdminsFn,
    setUserDepartmentFn,
    setUserDepartmentsFn,
    listDepartmentUsersFn,
    saveDepartmentPermissionsFn
};
