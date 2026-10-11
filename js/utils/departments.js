// Display names only: never change stored department identifiers.
export function displayDepartmentName(value) {
    return String(value || '').split(/([\s/]+)/).map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : '').join('') || '—';
}
