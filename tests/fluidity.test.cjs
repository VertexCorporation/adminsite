'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness } = require('./helpers/module-harness.cjs');

function frames(window) {
  const pending = new Map();
  let id = 0;
  window.requestAnimationFrame = (fn) => { pending.set(++id, fn); return id; };
  window.cancelAnimationFrame = (key) => pending.delete(key);
  return { pending, flush() { const batch = [...pending.values()]; pending.clear(); batch.forEach(fn => fn()); } };
}

test('adaptive grids batch resize events and measure before changing columns', async () => {
  const h = harness('<main><div class="grid-layout"><article></article></div><div class="grid-layout"><article></article></div></main>', {
    'js/modules/roles.js': { getEffectivePanelLevel: () => 'write' },
  });
  try {
    const clock = frames(h.window), order = [];
    for (const grid of h.document.querySelectorAll('.grid-layout')) {
      grid.getBoundingClientRect = () => { order.push('read'); return { width: 700 }; };
      const write = grid.style.setProperty.bind(grid.style);
      grid.style.setProperty = (...args) => { order.push('write'); write(...args); };
    }
    const views = await h.load('js/modules/views.js');
    views.initAdaptiveGrids();
    assert.deepEqual(order, ['read', 'read', 'write', 'write']);
    order.length = 0;
    for (let i = 0; i < 12; i++) h.window.dispatchEvent(new h.window.Event('resize'));
    assert.equal(clock.pending.size, 1);
    assert.deepEqual(order, []);
    clock.flush();
    assert.deepEqual(order, ['read', 'read']); // Identical geometry requires no style write.
  } finally { h.close(); }
});

test('growing popovers reposition once per frame and cancel work when closed', async () => {
  const h = harness('<button id="anchor">Menu</button>', {
    'js/utils/ui.js': { __: key => key, onLangChange: () => () => {} },
    'js/utils/icons.js': { icon: () => '' },
  });
  try {
    const clock = frames(h.window), observers = [];
    h.window.ResizeObserver = class {
      constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    };
    const anchor = h.document.getElementById('anchor');
    anchor.getBoundingClientRect = () => ({ left: 40, top: 600, bottom: 630, width: 40 });
    let height = 24;
    const surfaces = await h.load('js/ui/surfaces.js');
    const menu = surfaces.openPopover(anchor, { render(el) {
      Object.defineProperties(el, { offsetWidth: { get: () => 200 }, offsetHeight: { get: () => height } });
      el.innerHTML = '<button>Item</button>';
    } });
    clock.flush();
    height = 300;
    assert.equal(observers.length, 1);
    observers[0].callback(); observers[0].callback();
    h.window.dispatchEvent(new h.window.Event('resize'));
    assert.equal(clock.pending.size, 1);
    clock.flush();
    assert.equal(Number.parseInt(menu.style.top) + height <= h.window.innerHeight - 8, true);
    observers[0].callback();
    surfaces.closePopover();
    assert.equal(observers[0].disconnected, true);
    assert.equal(clock.pending.size, 0);
  } finally { h.close(); }
});
