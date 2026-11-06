const STAR_DEPARTMENTS = Object.freeze(['Array','Aero','Catalyst','Chroma','Curia','Envoy','Pulse','Tensor']);
function starDepartment(value) {
    if (typeof value !== 'string') return null;
    return STAR_DEPARTMENTS.find(department => department.toLowerCase() === value.trim().toLowerCase()) || null;
}
export {STAR_DEPARTMENTS, starDepartment};
