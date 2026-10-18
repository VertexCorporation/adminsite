// Display names only: never change stored department identifiers.
export function displayDepartmentName(value) {
    return String(value || '').split(/([\s/]+)/).map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : '').join('') || '—';
}

export function canonicalDepartment(value, departments) {
    const raw=String(value || '').trim();
    const normalized=raw.toLowerCase().replace(/[\s_-]+/g,'');
    return departments.find(d=>d.id.toLowerCase().replace(/[\s_-]+/g,'')===normalized)?.id || raw;
}
