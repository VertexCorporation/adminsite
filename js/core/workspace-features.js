// Import and bind a feature once per document. Session authorization remains
// with the existing controllers; this registry only schedules UI code.
export function createFeatureRegistry(definitions) {
  const modules = new Map(),
    pending = new Map();
  const get = (id) => {
    if (modules.has(id)) return Promise.resolve(modules.get(id));
    if (pending.has(id)) return pending.get(id);
    const definition = definitions.find((item) => item.id === id);
    if (!definition) return Promise.reject(new Error('Unknown workspace feature'));
    const request = definition
      .load()
      .then((module) => {
        module[definition.init]();
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
