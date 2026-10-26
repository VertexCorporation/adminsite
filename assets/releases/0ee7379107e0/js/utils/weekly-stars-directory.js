// Read every page: filtered contributor scans can be empty and still continue.
// A partial directory must never be mistaken for the full nomination list.
export async function loadWeeklyStarsDirectory(fetchPage) {
    const people = new Map(), cursors = new Set();
    let cursor = null;
    do {
        const {data} = await fetchPage({filter:'vertex', pageSize:50, cursor});
        if (!data || !Array.isArray(data.contributors))
            throw new Error('Invalid participant directory');
        for (const person of data.contributors) {
            if (person && typeof person.id === 'string' && person.id &&
                typeof person.name === 'string' && person.name.trim() && person.isVertex === true)
                people.set(person.id, person);
        }
        const next = data.nextCursor;
        if (next == null || next === '') {
            if (data.hasMore === true) throw new Error('Missing participant page cursor');
            break;
        }
        if (typeof next !== 'string' || cursors.has(next))
            throw new Error('Invalid participant page cursor');
        cursors.add(next);
        cursor = next;
    } while (cursor);
    return [...people.values()];
}
