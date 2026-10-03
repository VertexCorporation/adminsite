// js/modules/asciiRipple.js

/**
 * ASCII Ripple — monospace metin zemininde sıvı yüzey simülasyonu.
 * İşaretçi düşüşleri ve sürüklemeleri grid üzerinden dalga gönderir;
 * karakterler yüksekliğe göre seçilir ve renklenir.
 * Login ekranında tam etki, uygulama içinde panellerin arkasında hafif.
 */

const CELL = 14;
const RAMP = ' .·:;+=*#%@';
let canvas = null;
let ctx = null;
let cols = 0;
let rows = 0;
let cur = null;
let prev = null;
let running = false;
let lastFrame = 0;
let lastDrop = 0;

function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.ceil(canvas.width / CELL) + 1;
    rows = Math.ceil(canvas.height / CELL) + 1;
    cur = new Float32Array(cols * rows);
    prev = new Float32Array(cols * rows);
}

function drop(x, y, radius = 2.4, strength = 5.5) {
    if (!cur) return;
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= radius) cur[ny * cols + nx] += strength * (1 - d / radius);
        }
    }
}

function step() {
    // Sıvı yüzeyi: 2 tamponlu sönümlü dalga denklemi
    for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
            const i = y * cols + x;
            let v = (cur[i - 1] + cur[i + 1] + cur[i - cols] + cur[i + cols]) / 2 - prev[i];
            prev[i] = v * 0.94;
        }
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
}

function isLight() {
    return document.documentElement.hasAttribute('data-theme');
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${CELL - 2}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'middle';
    const light = isLight();
    for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
            const h = cur[y * cols + x];
            const a = Math.abs(h);
            if (a < 0.12) continue;
            const idx = Math.min(RAMP.length - 1, Math.floor(a));
            const ch = RAMP[idx];
            const t = Math.min(1, a / 5);
            ctx.fillStyle = light
                ? `rgba(80, 90, 80, ${(0.12 + t * 0.5).toFixed(3)})`
                : h > 0
                    ? `rgba(230, 182, 103, ${(0.10 + t * 0.55).toFixed(3)})`
                    : `rgba(150, 150, 160, ${(0.08 + t * 0.45).toFixed(3)})`;
            ctx.fillText(ch, x * CELL, y * CELL + CELL / 2);
        }
    }
}

function loop(ts) {
    if (!running) return;
    if (!document.hidden && ts - lastFrame >= 33) {
        lastFrame = ts;
        step();
        render();
    }
    requestAnimationFrame(loop);
}

export function initAsciiRipple() {
    canvas = document.getElementById('ascii-ripple');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    running = true;
    requestAnimationFrame(loop);

    window.addEventListener('resize', resize);

    // İşaretçi düşüşleri: hareket = küçük damla, tıklama = büyük damla
    window.addEventListener('pointermove', (e) => {
        const now = performance.now();
        if (now - lastDrop < 46) return;
        lastDrop = now;
        drop(e.clientX, e.clientY, 1.6, 1.6);
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
        drop(e.clientX, e.clientY, 3.2, 6.5);
    }, { passive: true });

    // Sekme gizliyken simülasyonu durdur
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { running = false; }
        else if (!running) { running = true; requestAnimationFrame(loop); }
    });
}
