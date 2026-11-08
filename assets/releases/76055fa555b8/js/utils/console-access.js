// Only a fresh server response authorizes the UI. Never manufacture Core
// membership from an obsolete administrator flag or from an ID token.
export function normalizeConsoleAccessResponse(payload) {
    const allowed = ['Tensor','Curia','Core','Senatus','Pulse','Chroma','Catalyst','Envoy','Aero','Array'];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        !Array.isArray(payload.departments) || payload.departments.some(d => !allowed.includes(d)))
        throw new Error('Invalid console authorization response');
    const departments = [...new Set(payload.departments)];
    const isCore = departments.includes('Core');
    // isAdmin is accepted only as a transitional response spelling when it
    // agrees with explicit Core membership. It can never add a department.
    for (const key of ['isCore','isAdmin']) {
        if (key in payload && (typeof payload[key] !== 'boolean' || payload[key] !== isCore))
            throw new Error('Invalid console authorization response');
    }
    if (typeof payload.isCore !== 'boolean' && typeof payload.isAdmin !== 'boolean')
        throw new Error('Invalid console authorization response');
    return {isCore, isAdmin:isCore, departments, authzVersion:payload.authzVersion};
}