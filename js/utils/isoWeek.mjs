export function getISOWeek(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new TypeError('Invalid date');
    const thursday = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
    const year = thursday.getUTCFullYear();
    const yearStart = Date.UTC(year, 0, 1);
    const week = Math.ceil(((thursday.getTime() - yearStart) / 86400000 + 1) / 7);
    return { year, week };
}
