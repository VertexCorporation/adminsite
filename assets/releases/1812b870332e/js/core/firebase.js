// js/core/firebase.js

// These will be populated by the initFirebase function
let auth, db, storage, functions, appCheck;
let sendTargetedNotificationFn, scheduleNotificationFn, listScheduledNotificationsFn;
let cancelScheduledNotificationFn, getServerStatusFn, setServerStatusFn, blockOnlineModelFn;
let updateModelsListFn, createNewsArticleFn, deleteNewsArticleFn, addAdminRoleFn;
let getModelImageUploadUrlFn, getCoverUploadUrlFn, triggerAttributionsUpdateFn;
let getVertexContributorsFn, toggleContributorVerificationFn, deleteVertexContributorFn;
let verifyUserEmailFn;
let updateContributorApplicationFn, createManualVertexContributorFn;
let toggleVertexStatusFn, removeAdminRoleFn, listAdminsFn, setUserDepartmentFn, setUserDepartmentsFn, listDepartmentUsersFn, saveDepartmentPermissionsFn;
let setUserSubscriptionFn, removeUserSubscriptionFn, listUserSubscriptionsFn, bulkSetUserSubscriptionsFn;
let listConsoleChatChannelsFn, createConsoleChatChannelFn, updateConsoleChatChannelFn, postConsoleChatMessageFn, listConsoleChatMessagesFn, updateConsoleChatTaskStatusFn, deleteConsoleChatMessageFn, deleteConsoleChatChannelFn, listConsoleChatDirectoryFn;
let getPanelPermissionsFn, listDepartmentPermissionHistoryFn, restoreDepartmentPermissionsFn;
let listSiteTeamFn, setSiteTeamEntryFn, deleteSiteTeamEntryFn;
let prepareModelImageCleanupFn, confirmModelImageCleanupFn;


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
// Firebase Functions SDK owns endpoint discovery, Auth and App Check headers,
// CORS and HTTP error decoding. No hard-coded Cloud Run service names.
const CALLABLE_TIMEOUT_MS = 20000;
const callableCache = new Map();
const RETRYABLE_READS = new Set([
    'getVertexContributors','listConsoleChatChannels','listConsoleChatMessages',
    'listConsoleChatDirectory','getPanelPermissions','getMyConsoleAccess',
    'listUserSubscriptions','listAdmins','listDepartmentUsers','listSiteTeam',
    'listTeamCards','getServerStatus','getVertexCertificateDetails',
    'getVertexCertificateEmailTemplates','getBackupHealthStatus',
    'getTeamProfile','getWeeklyStars','previewContributorRoster'
]);
const TRANSIENT_CODES = new Set([
    'functions/unavailable','functions/deadline-exceeded',
    'functions/resource-exhausted','functions/internal'
]);
function retryDelay(ms) { return new Promise(resolve=>setTimeout(resolve,ms)); }
function normalizeCallableError(error) {
    if (error?.code?.startsWith('functions/')) {
        if (error.code === 'functions/failed-precondition' &&
            error.message === 'Expanded issuance awaits certificate assets and verified Zapier configuration.') {
            error.details ||= {reason:'certificate-delivery-not-ready'};
        }
        return error;
    }
    const code = String(error?.code || '');
    const failed = new Error(error?.message || 'Could not connect to Vertex services.');
    failed.code = code.startsWith('app-check/') ? 'functions/failed-precondition'
        : code.startsWith('auth/') ? 'functions/unauthenticated'
        : ['AbortError','TimeoutError'].includes(error?.name) ? 'functions/deadline-exceeded'
        : 'functions/unavailable';
    failed.reason = code.startsWith('app-check/') ? 'app-check-unavailable' : code.startsWith('auth/') ? 'authentication-unavailable' : 'network-unavailable';
    return failed;
}
function getCallable(name) {
    if (!functions?.httpsCallable) {
        const err=new Error('Firebase Functions SDK is not initialized.');
        err.code='functions/unavailable';
        throw err;
    }
    let fn=callableCache.get(name);
    if (!fn) {
        fn=functions.httpsCallable(name,{timeout:CALLABLE_TIMEOUT_MS});
        callableCache.set(name,fn);
    }
    return fn;
}
async function callCallableOnce(name,data) {
    try {
        const result=await getCallable(name)(data??{});
        if (!result || !Object.hasOwn(result,'data')) {
            const error=new Error('Invalid callable response.');
            error.code='functions/internal';
            throw error;
        }
        return result;
    } catch(error) {
        throw normalizeCallableError(error);
    }
}
let requestSequence=0;
function classifyCallableError(error){
    const code=String(error?.code||'').replace(/^functions\//,'');
    if(['permission-denied','unauthenticated'].includes(code))return 'authorization';
    if(['invalid-argument','failed-precondition'].includes(code))return 'validation';
    if(['unavailable','deadline-exceeded','resource-exhausted'].includes(code))return 'transport';
    if(['unimplemented','not-found'].includes(code))return 'missing-function';
    return 'server';
}
async function callCallable(name,data) {
    const started=Date.now(), requestId=Date.now().toString(36)+'-'+(++requestSequence).toString(36);
    const attempts=RETRYABLE_READS.has(name)?3:1;
    for(let attempt=0;attempt<attempts;attempt++){
        try{return await callCallableOnce(name,data);}
        catch(error){
            // Mutations are NEVER blindly resent: the server may have committed
            // even when a response times out.
            if(attempt===attempts-1 || !TRANSIENT_CODES.has(error.code) || !auth?.currentUser){
                console.error('[CONSOLE_OPERATION]',{operation:'firebase.callable',function:name,category:classifyCallableError(error),durationMs:Math.max(0,Date.now()-started),release:globalThis.document?.querySelector?.('meta[name="vertex-release"]')?.content||'development',requestId});
                // No request body, user identity, credentials or remote technical message.
                error.requestId=requestId;
                throw error;
            }
            await retryDelay(attempt===0?450:1200);
        }
    }
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
    functions = firebase.app().functions(firebaseConfig.functionsRegion || 'europe-west1');

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
    callableCache.clear();
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
    createManualVertexContributorFn = callable('createManualVertexContributor');
    toggleVertexStatusFn = callable('toggleVertexStatus');
    removeAdminRoleFn = callable('removeAdminRole');
    listAdminsFn = callable('listAdmins');
    setUserDepartmentFn = callable('setUserDepartment');
    setUserDepartmentsFn = callable('setUserDepartments');
    listDepartmentUsersFn = callable('listDepartmentUsers');
    saveDepartmentPermissionsFn = callable('saveDepartmentPermissions');
    listDepartmentPermissionHistoryFn = callable('listDepartmentPermissionHistory');
    restoreDepartmentPermissionsFn = callable('restoreDepartmentPermissions');
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
    prepareModelImageCleanupFn = callable('prepareModelImageCleanup');
    confirmModelImageCleanupFn = callable('confirmModelImageCleanup');
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
    createManualVertexContributorFn,
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
    prepareModelImageCleanupFn,
    confirmModelImageCleanupFn,
    getPanelPermissionsFn,
    listDepartmentPermissionHistoryFn,
    restoreDepartmentPermissionsFn
};

export const issueVertexCertificateFn = callable('issueVertexCertificate');
export const getVertexCertificateDetailsFn = callable('getVertexCertificateDetails');
export const revokeVertexCertificateFn = callable('revokeVertexCertificate');

export const setVertexContributorJoiningDateFn = callable('setVertexContributorJoiningDate');

export const getVertexCertificateEmailTemplatesFn = callable('getVertexCertificateEmailTemplates');
export const saveVertexCertificateEmailTemplateFn = callable('saveVertexCertificateEmailTemplate');
export const previewVertexCertificateEmailTemplateFn = callable('previewVertexCertificateEmailTemplate');

export const listTeamCardsFn = callable('listTeamCards');
export const setTeamCardFn = callable('setTeamCard');
export const deleteTeamCardFn = callable('deleteTeamCard');
export const getTeamProfileFn = callable('getTeamProfile');
export const setTeamProfileFn = callable('setTeamProfile');
export const getWeeklyStarsFn = callable('getWeeklyStars');
export const setWeeklyStarsFn = callable('setWeeklyStars');
export const getBackupHealthStatusFn = callable('getBackupHealthStatus');

export const previewContributorRosterFn = callable('previewContributorRoster');
export const applyContributorRosterFn = callable('applyContributorRoster');
export const setContributorVertexStatusFn = callable('setContributorVertexStatus');

export const consolePeopleCall = (name, data) => callCallable(name, data);
export const eventCallable = (name, data) => callCallable(name, data);
