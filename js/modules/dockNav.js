// js/modules/dockNav.js

/**
 * Apple Dock büyütme efekti (React Bits Dock uyarlaması — vanilla):
 * işaretçi nav çubuğuna girdiğinde öğeler spring fizikle büyür; yakın olan
 * daha çok büyür (gaussian falloff), çıkınca yaylanarak geri döner.
 * Ölçüm tembel (lazy): öğeler görünür ve fontlar hazır olduğunda yapılır.
 */

const SPRING_STIFF = 0.16;
const SPRING_DAMP = 0.74;
const MAGNIFICATION = 26;
const DISTANCE = 150;

let items = [];
let running = false;
let pointerX = -9999;
let measured = false;

export function initDockNav() {
    const nav = document.querySelector('.app-navigation');
    if (!nav) return;

    items = [...nav.querySelectorAll('.dock-btn')].map(el => ({
        el,
        base: 0,
        pos: 0,
        vel: 0
    }));

    const measure = () => {
        items.forEach(it => { it.el.style.width = ''; });
        items.forEach(it => {
            it.base = Math.max(90, it.el.getBoundingClientRect().width || 120);
        });
        measured = true;
    };

    const invalidate = () => { measured = false; };
    setTimeout(() => invalidate(), 400); // fontlar yüklendikten sonra yeniden ölç
    document.fonts?.ready?.then(() => invalidate());
    window.addEventListener('resize', invalidate);
    document.addEventListener('visibilitychange', () => invalidate());

    nav.addEventListener('pointermove', (e) => {
        pointerX = e.clientX;
        if (!measured) measure();
        start();
    });
    nav.addEventListener('pointerleave', () => {
        pointerX = -9999;
        start(); // geri yaylanma
    });

    function start() {
        if (running) return;
        running = true;
        requestAnimationFrame(frame);
    }

    function frame() {
        let energy = 0;
        items.forEach(it => {
            const rect = it.el.getBoundingClientRect();
            const center = rect.left + rect.width / 2;
            const dist = Math.abs(pointerX - center);
            const target = dist > DISTANCE + 60 ? 0
                : MAGNIFICATION * Math.exp(-((dist / (DISTANCE / 2)) ** 2));
            it.vel += (target - it.pos) * SPRING_STIFF;
            it.vel *= SPRING_DAMP;
            it.pos += it.vel;
            if (Math.abs(it.vel) > 0.05 || Math.abs(target - it.pos) > 0.05) energy++;
            it.el.style.width = (it.base + Math.max(0, it.pos)) + 'px';
            it.el.style.setProperty('--dock-lift', Math.max(0, it.pos).toFixed(2));
        });
        if (energy > 0) {
            requestAnimationFrame(frame);
        } else {
            items.forEach(it => { it.el.style.width = ''; });
            running = false;
        }
    }
}
