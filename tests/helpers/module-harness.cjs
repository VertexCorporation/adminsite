'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../..');
function harness(html = '<main></main>', stubs = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  window.structuredClone = structuredClone;
  window.fetch = async () => {
    throw Error('Unexpected network access in unit test');
  };
  window.HTMLElement.prototype.getClientRects = function () {
    return this.hidden ? [] : [{}];
  };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  const context = dom.getInternalVMContext(),
    cache = new Map();
  const create = (file) => {
    if (cache.has(file)) return cache.get(file);
    let module;
    if (stubs[file]) {
      const values = stubs[file];
      module = new vm.SyntheticModule(
        Object.keys(values),
        function () {
          for (const [key, value] of Object.entries(values)) this.setExport(key, value);
        },
        { context, identifier: file },
      );
    } else {
      module = new vm.SourceTextModule(fs.readFileSync(path.join(root, file), 'utf8'), {
        context,
        identifier: file,
        initializeImportMeta(meta) {
          meta.url = 'http://localhost/' + file;
        },
      });
    }
    cache.set(file, module);
    return module;
  };
  const resolve = (specifier, referencing) => {
    if (!specifier.startsWith('.')) throw Error('Unexpected bare import ' + specifier);
    return create(path.posix.normalize(path.posix.join(path.posix.dirname(referencing.identifier), specifier)));
  };
  return {
    window,
    document: window.document,
    close: () => window.close(),
    async load(file) {
      const module = create(file);
      if (module.status === 'unlinked') await module.link(resolve);
      if (module.status === 'linked') await module.evaluate();
      return module.namespace;
    },
  };
}
module.exports = { harness, root };
