// Import and bind a feature once per document. Session authorization remains
// with the existing controllers; this registry only schedules UI code.
export function createFeatureRegistry(definitions, { afterInit = () => {} } = {}) {
  const modules = new Map(),
    pending = new Map();
  const get = (id) => {
    if (modules.has(id)) return Promise.resolve(modules.get(id));
    if (pending.has(id)) return pending.get(id);
    const definition = definitions.find((item) => item.id === id);
    if (!definition) return Promise.reject(new Error('Unknown workspace feature'));
    const request = definition
      .load()
      .then(async (module) => {
        module[definition.init]();
        // Auth listeners installed by an on-demand controller must receive
        // their initial state before its first read populates the screen.
        await afterInit();
        modules.set(id, module);
        return module;
      })
      .finally(() => pending.delete(id));
    pending.set(id, request);
    return request;
  };
  const matches = (definition, keys) =>
    keys.some((key) =>
      definition.scopes.some((scope) => key === scope || (scope.endsWith('.') && key.startsWith(scope))),
    );
  return {
    get,
    peek: (id) => modules.get(id),
    ready: (keys) => definitions.filter((item) => matches(item, keys)).every((item) => modules.has(item.id)),
    ensure: (keys) => Promise.all(definitions.filter((item) => matches(item, keys)).map((item) => get(item.id))),
  };
}
