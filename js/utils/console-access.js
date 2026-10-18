// Accept the two server-verified Console access response versions while
// refusing missing, contradictory or malformed authorization information.
// No client-side claims or cached roles are used for this decision.
export function normalizeConsoleAccessResponse(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('Invalid console authorization response');
    const { isAdmin, isCore, departments } = payload;
    const hasAdmin = typeof isAdmin === 'boolean';
    const hasCore = typeof isCore === 'boolean';
    if ((!hasAdmin && !hasCore) ||
        (hasAdmin && hasCore && isAdmin !== isCore) ||
        !Array.isArray(departments) ||
        departments.some(department => typeof department !== 'string' || !department.trim())) {
        throw new Error('Invalid console authorization response');
    }
    // The callable is the server-verified source of authority. Some deployed
    // console revisions still return the former isAdmin flag without spelling
    // out its equivalent Core department. Normalizing only the UI identity
    // here keeps navigation and panel gating in agreement; callable mutations
    // continue to enforce their own current server-side Core checks.
    const verifiedCore = hasCore ? isCore : isAdmin;
    const grants = [...new Set(departments)];
    if (verifiedCore && !grants.includes('Core')) grants.unshift('Core');
    // Never grant Core from an unverified department array when the server
    // explicitly denied Core status.
    if (!verifiedCore && grants.includes('Core'))
        throw new Error('Invalid console authorization response');
    return {
        isAdmin: verifiedCore,
        departments: grants,
        authzVersion: payload.authzVersion
    };
}
