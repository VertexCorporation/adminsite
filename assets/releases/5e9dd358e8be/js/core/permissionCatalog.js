// The seven navigation categories and their screens. Keys are the existing
// server authorization scopes, not independently configurable card panels.
export const PERMISSION_CATEGORIES = [
    {id:'users',key:'catalog.users',screens:[
        {id:'information',key:'catalog.information',scopes:['users.directory'],coreOnly:true},
        {id:'status',key:'catalog.status_short',scopes:['users.status','users.deleteAccount'],coreOnly:true},
        {id:'statistics',key:'catalog.statistics',scopes:['users.statistics'],coreOnly:true}
    ]},
    {id:'contributors',key:'catalog.contributors',screens:[
        {id:'applications',key:'subnav.applicants',scopes:['contributors.list']}
    ]},
    {id:'models',key:'catalog.models',screens:[
        {id:'catalog',key:'subnav.catalog',scopes:['models.library']},
        {id:'management',key:'catalog.management',scopes:['models.manage']}
    ]},
    {id:'publications',key:'catalog.publications',screens:[
        {id:'news-published',key:'subnav.published',group:'nav.news',scopes:['news.published']},
        {id:'news-editor',key:'subnav.editor',group:'nav.news',scopes:['news.editor']},
        {id:'events-list',key:'panel.events.list',group:'nav.events',scopes:['events.list']},
        {id:'events-editor',key:'panel.events.editor',group:'nav.events',scopes:['events.editor']},
        {id:'events-registrations',key:'panel.events.registrations',group:'nav.events',scopes:['events.registrations']},
        {id:'notification-compose',key:'subnav.compose',group:'nav.notifications',scopes:['notifications.sender']},
        {id:'notification-scheduled',key:'subnav.scheduled',group:'nav.notifications',scopes:['notifications.scheduled']}
    ]},
    {id:'subscriptions',key:'catalog.subscriptions',screens:[
        {id:'active',key:'subnav.active_subscriptions',scopes:['subscriptions.list']},
        {id:'assignment',key:'subnav.assign',scopes:['subscriptions.assign'],coreOnly:true}
    ]},
    {id:'scene',key:'catalog.scene',screens:[
        {id:'showcase',key:'perms.scene_screens',scopes:['system.teamLog']}
    ]},
    {id:'system',key:'catalog.system',screens:[
        {id:'server',key:'subnav.server',scopes:['system.serverStatus']},
        {id:'members',key:'catalog.members',scopes:['system.deptAssign','system.deptUsers']},
        {id:'permissions',key:'subnav.permissions',scopes:['system.deptPerms'],coreOnly:true},
        {id:'verification',key:'subnav.verification',scopes:['system.manualVerify']},
        {id:'transfer',key:'catalog.transfer',scopes:['system.exporter','system.attributions']}
    ]}
];
export const PERMISSION_DEPARTMENTS = ['Core','Senatus','Tensor','Curia','Pulse','Chroma','Catalyst','Envoy','Aero','Array'];
export const PERMISSION_LEVELS = ['none','read','write'];
const rank = {none:0,read:1,write:2};

export function legacyScopeLevel(entry,scope) {
    const tab=scope.split('.')[0];
    const value=Array.isArray(entry) ? (entry.includes(tab)?'read':'none')
        : entry?.panels?.[scope] ?? entry?.panels?.[tab+'.*'] ?? 'none';
    return PERMISSION_LEVELS.includes(value)?value:'none';
}

// A screen cannot expose a formerly denied card or masked field just because
// the editor became simpler. Merge same-screen scopes at the LOWEST old level;
// retire field masking by closing the affected screen until Core re-grants it.
export function normalizeScreenPermissions(raw) {
    const source=raw?.departments ?? raw ?? {};
    const result={};
    for(const dept of PERMISSION_DEPARTMENTS) {
        if(!Object.hasOwn(source,dept))continue;
        const entry=source[dept];
        const panels={};
        for(const category of PERMISSION_CATEGORIES)for(const screen of category.screens) {
            let level=screen.scopes.map(scope=>legacyScopeLevel(entry,scope))
                .reduce((a,b)=>rank[a]<rank[b]?a:b,'write');
            if(screen.coreOnly && dept!=='Core')level='none';
            if(dept!=='Core' && screen.scopes.some(scope=>Array.isArray(entry?.hiddenFields?.[scope]) && entry.hiddenFields[scope].length))level='none';
            // Core is always authorized by live server membership, not this map.
            for(const scope of screen.scopes)panels[scope]=level;
        }
        result[dept]={panels};
    }
    return result;
}

export function screenPermissionLevel(departments,dept,screen) {
    if(dept==='Core')return 'write';
    if(screen.coreOnly)return 'none';
    return screen.scopes.map(scope=>legacyScopeLevel(departments?.[dept],scope))
        .reduce((a,b)=>rank[a]<rank[b]?a:b,'write');
}
export function categoryPermissionLevel(departments,dept,category) {
    const screens=category.screens.filter(screen=>!screen.coreOnly);
    if(dept==='Core')return 'write';
    if(!screens.length)return 'none';
    const levels=screens.map(screen=>screenPermissionLevel(departments,dept,screen));
    return levels.every(level=>level===levels[0])?levels[0]:'mixed';
}

export function setScreenPermission(departments,dept,screen,level) {
    if(dept==='Core' || screen.coreOnly || !PERMISSION_LEVELS.includes(level))return;
    const entry=departments[dept] ||= {panels:{}};
    for(const scope of screen.scopes)entry.panels[scope]=level;
}
