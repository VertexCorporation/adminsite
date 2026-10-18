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
    return {
        isAdmin: hasAdmin ? isAdmin : isCore,
        departments: [...new Set(departments)],
        authzVersion: payload.authzVersion
    };
}
