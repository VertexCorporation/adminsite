// js/modules/borderGlow.js

/**
 * BorderGlow (React Bits uyarlaması — vanilla JS): panellerin kenarlarında
 * işaretçiye göre yönlenen mesh-gradient border + dış glow. Tema renkleri
 * kullanılır (altın/sage/slate); yalnızca konumlandırma ve CSS değişkenleri
 * yönetilir, panel içeriğine dokunulmaz.
 */

const GLOW_COLORS = ['#e6b667', '#9dc9a2', '#8fb6d9'];
const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const GRADIENT_KEYS = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function buildGradientVars(colors) {
    const vars = {};
    for (let i = 0; i < 7; i++) {
        const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
        vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`;
    }
    vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`;
    return vars;
}

function getCursorAngle(el, x, y) {
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const dx = x - rect.left - cx, dy = y - rect.top - cy;
    if (dx === 0 && dy === 0) return 0;
    let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    return deg;
}

function getEdgeProximity(el, x, y) {
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const dx = x - rect.left - cx, dy = y - rect.top - cy;
    let kx = Infinity, ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
}

let lastUpdate = 0;

export function initBorderGlow() {
    const vars = buildGradientVars(GLOW_COLORS);

    // Tüm panellere edge-light katmanı ve gradient değişkenlerini ver
    document.querySelectorAll('.panel-card').forEach(card => {
        if (!card.querySelector(':scope > .edge-light')) {
            const span = document.createElement('span');
            span.className = 'edge-light';
            card.appendChild(span);
        }
        Object.entries(vars).forEach(([k, v]) => card.style.setProperty(k, v));
    });

    // Sonradan eklenen paneller ( roles/matrix yeniden render ) için observer
    const mo = new MutationObserver(() => {
        document.querySelectorAll('.panel-card').forEach(card => {
            if (!card.querySelector(':scope > .edge-light')) {
                const span = document.createElement('span');
                span.className = 'edge-light';
                card.appendChild(span);
            }
            Object.entries(vars).forEach(([k, v]) => {
                if (!card.style.getPropertyValue(k)) card.style.setProperty(k, v);
            });
        });
    });
    mo.observe(document.body, { childList: true, subtree: false });

    // İşaretçi takibi: yalnızca hovered panel (tek kart — ucuz)
    document.addEventListener('pointermove', (e) => {
        const now = performance.now();
        if (now - lastUpdate < 33) return;
        lastUpdate = now;
        const card = e.target instanceof Element ? e.target.closest('.panel-card') : null;
        if (!card) return;
        const edge = getEdgeProximity(card, e.clientX, e.clientY);
        const angle = getCursorAngle(card, e.clientX, e.clientY);
        card.style.setProperty('--edge-proximity', (edge * 100).toFixed(3));
        card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`);
    }, { passive: true });
}
