const STAR_DEPARTMENTS = Object.freeze(['Array', 'Aero', 'Catalyst', 'Chroma', 'Curia', 'Envoy', 'Pulse', 'Tensor']);
function starDepartment(value) {
  if (typeof value !== 'string') return null;
  return STAR_DEPARTMENTS.find((department) => department.toLowerCase() === value.trim().toLowerCase()) || null;
}
function starSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();
}
export { STAR_DEPARTMENTS, starDepartment, starSearchText };
