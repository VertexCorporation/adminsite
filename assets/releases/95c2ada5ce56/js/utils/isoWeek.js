// ISO 8601 week-year (not necessarily the Gregorian calendar year).
// Use UTC dates so daylight saving changes cannot move a week boundary.
export function isoWeek(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid date');
    const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
    const year = thursday.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(year, 0, 4));
    firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - (firstThursday.getUTCDay() || 7));
    return { year, weekNumber: 1 + Math.round((thursday - firstThursday) / 604800000) };
}
