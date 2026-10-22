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

/**
 * Editorial dates follow Europe/Istanbul, not the UTC clock of the browser.
 * Just after midnight on Monday in Istanbul, UTC may still be Sunday.
 * Convert only the calendar components, then reuse the single ISO algorithm.
 */
export function isoWeekInIstanbul(now = new Date()) {
    const date = now instanceof Date ? now : new Date(now);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid date');
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const value = type => Number(parts.find(part => part.type === type)?.value);
    return isoWeek(new Date(Date.UTC(value('year'), value('month') - 1, value('day'))));
}
