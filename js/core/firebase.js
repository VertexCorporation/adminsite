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
let getPanelPermissionsFn;
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
let attestationPending, attestationRetryAt=0;
async function getAttestationToken() {
    if(!appCheck?.getToken || Date.now()<attestationRetryAt)return;
    if(attestationPending)return attestationPending;
    attestationPending=(async()=>{
        let timer;
        try{return (await Promise.race([appCheck.getToken(false),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Attestation timeout')),2500);})]))?.token;}
        catch(error){attestationRetryAt=Date.now()+60000;console.warn('[APP_CHECK] Attestation unavailable',{code:error.code||'app-check/unavailable'});}
        finally{clearTimeout(timer);}
    })();
    try{return await attestationPending;}finally{attestationPending=null;}
}
// Only idempotent READ endpoints may be retried automatically. Never retry a
// mutation: an HTTP timeout can happen after the server has already committed it.
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
function deadline(promise, milliseconds) {
    let timer;
    return Promise.race([
        Promise.resolve(promise),
        new Promise((_,reject)=>{
            timer=setTimeout(()=>{
                const error=new Error('Authentication token request timed out');
                error.code='functions/deadline-exceeded';
                reject(error);
            },milliseconds);
        })
    ]).finally(()=>clearTimeout(timer));
}
function retryDelay(ms) { return new Promise(resolve=>setTimeout(resolve,ms)); }
let requestSequence=0;
function classifyCallableError(error){
    const code=String(error?.code||'').replace(/^functions\//,'');
    if(['permission-denied','unauthenticated'].includes(code))return 'authorization';
    if(['invalid-argument','failed-precondition'].includes(code))return 'validation';
    if(['unavailable','deadline-exceeded','resource-exhausted'].includes(code))return 'transport';
    if(code==='unimplemented'||(code==='not-found'&&error?.httpStatus===404))return 'missing-function';
    return 'server';
}
async function callCallable(name, data) {
    const started=Date.now(), requestId=Date.now().toString(36)+'-'+(++requestSequence).toString(36);
    const attempts=RETRYABLE_READS.has(name)?3:1;
    for(let attempt=0;attempt<attempts;attempt++){
        try{return await callCallableOnce(name,data);}
        catch(error){
            if(attempt===attempts-1 || !TRANSIENT_CODES.has(error.code) || !auth?.currentUser){
                console.error('[CONSOLE_OPERATION]',{operation:'firebase.callable',function:name,category:classifyCallableError(error),durationMs:Math.max(0,Date.now()-started),release:globalThis.document?.querySelector?.('meta[name="vertex-release"]')?.content||'development',requestId});
                // Never log the request body, ID token, remote error message or stack.
                error.requestId=requestId;
                throw error;
            }
            // Bounded backoff, so temporary server/network failures recover without
            // spawning overlapping requests or making users reload the site.
            await retryDelay(attempt===0?450:1200);
        }
    }
}
async function callCallableOnce(name, data) {
    const user=auth?.currentUser;
    const idToken=user?await deadline(user.getIdToken(),10000):null;
    const appToken=user?await getAttestationToken():undefined;
    let res;try{res=await fetch(`https://${name.toLowerCase()}-o5h7dmtija-ew.a.run.app`,{
        method:'POST',headers:{'Content-Type':'application/json',...(idToken?{Authorization:'Bearer '+idToken}:{}),...(appToken?{'X-Firebase-AppCheck':appToken}:{})},body:JSON.stringify({data:data??{}}),signal:AbortSignal.timeout(20000)
    });}catch(error){const e=new Error('Callable transport failed');e.code=error.name==='TimeoutError'?'functions/deadline-exceeded':'functions/unavailable';throw e;}
    let json;try{json=await res.json();}catch{json=null;}
    if(!res.ok||json?.error||!json||!Object.hasOwn(json,'result')){
        const err=json?.error||{};
        const status=err.status||(res.status===401?'UNAUTHENTICATED':res.status===403?'PERMISSION_DENIED':res.status===404?'NOT_FOUND':res.status===429?'RESOURCE_EXHAUSTED':res.status===503?'UNAVAILABLE':'INTERNAL');
        const e=new Error(err.message||'Callable response failed');e.code='functions/'+status.toLowerCase().replaceAll('_','-');e.httpStatus=res.status;e.details=err.details;
        // Compatibility with the exact pre-code response of the deployed certificate service.
        if(name==='issueVertexCertificate'&&status==='FAILED_PRECONDITION'&&err.message==='Expanded issuance awaits certificate assets and verified Zapier configuration.')e.details={reason:'certificate-delivery-not-ready'};
        throw e;
    }
    return {data:json.result};
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
    createManualVertexContributorFn = callable('createManualVertexContributor');
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
    getPanelPermissionsFn
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
