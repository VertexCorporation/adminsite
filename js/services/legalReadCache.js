// Sensitive content stays in bounded memory, never browser storage.
export function createLegalReadCache({ ttl = 120000, max = 32, now = Date.now } = {}) {
  const entries = new Map(),
    pending = new Map();
  let generation = 0;
  const clear = () => {
    generation++;
    entries.clear();
    pending.clear();
  };
  const get = (key) => {
    const row = entries.get(key);
    if (!row || row.expires <= now()) {
      entries.delete(key);
      return null;
    }
    entries.delete(key);
    entries.set(key, row);
    return structuredClone(row.value);
  };
  const set = (key, value) => {
    entries.delete(key);
    entries.set(key, { value: structuredClone(value), expires: now() + ttl });
    while (entries.size > max) entries.delete(entries.keys().next().value);
  };
  const load = async (key, loader) => {
    const cached = get(key);
    if (cached !== null) return cached;
    if (pending.has(key)) return structuredClone(await pending.get(key));
    const epoch = generation;
    const request = Promise.resolve().then(loader);
    pending.set(key, request);
    try {
      const value = await request;
      if (epoch === generation) set(key, value);
      return structuredClone(value);
    } finally {
      if (pending.get(key) === request) pending.delete(key);
    }
  };
  return { get, set, load, clear };
}
