const test = require('node:test');
const assert = require('node:assert/strict');

test('iso week calculation uses the week-based year at year boundaries', async () => {
    const { getISOWeek } = await import('../js/utils/isoWeek.mjs');
    const cases = [
    [
        "2020-12-31",
        2020,
        53
    ],
    [
        "2021-01-01",
        2020,
        53
    ],
    [
        "2021-01-04",
        2021,
        1
    ],
    [
        "2025-12-28",
        2025,
        52
    ],
    [
        "2025-12-29",
        2026,
        1
    ],
    [
        "2026-01-01",
        2026,
        1
    ],
    [
        "2026-12-31",
        2026,
        53
    ],
    [
        "2027-01-01",
        2026,
        53
    ],
    [
        "2027-01-04",
        2027,
        1
    ]
];
    for (const [date, year, week] of cases) {
        const [y, m, d] = date.split('-').map(Number);
        assert.deepEqual(getISOWeek(new Date(y, m - 1, d, 12)), { year, week }, date);
    }
    assert.throws(() => getISOWeek('invalid'), TypeError);
});
