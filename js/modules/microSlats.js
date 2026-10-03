// js/modules/microSlats.js

/**
 * MicroSlats (React Bits uyarlaması — vanilla JS + ogl CDN):
 * giriş ekranı arka planı — #34283f saçtalar, swell dalga preseti,
 * imleç etkileşimli akışkan simülasyonu ve giriş (intro) animasyonu.
 * ogl yüklenemez / WebGL2 yoksa sessizce atlanır (login sade kalır).
 */

const CONTAINER_ID = 'login-slats';
const CDN = 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/src/index.js';
const SWELL = { scale: 1.5, speed: 0.6, direction: 250, chop: 0.55, stretch: 0, glint: 0.7, contrast: 1.25, perspective: 0.55, fog: 0.55 };
const FLUID_SIZE = 96;
const PRESSURE_STEPS = 16;
const SPLAT_FORCE = 6900;
const SPLASH_JETS = 3;
const PIXEL_BUDGET = 4.5e6;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const passVertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fluidVertex = `#version 300 es
in vec2 position;
uniform vec2 uTexel;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
void main() {
  vUv = position * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fluidHead = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
`;

const splatFragment = `${fluidHead}
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius;
void main() {
  vec2 offset = vUv - uPoint;
  offset.x *= uAspect;
  float falloff = exp(-dot(offset, offset) / uRadius);
  fragColor = vec4(texture(uTarget, vUv).xyz + uValue * falloff, 1.0);
}
`;

const vorticityFragment = `${fluidHead}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uSwirl;
uniform float uDt;
void main() {
  float left = texture(uVelocity, vL).y;
  float right = texture(uVelocity, vR).y;
  float top = texture(uVelocity, vT).x;
  float bottom = texture(uVelocity, vB).x;
  float middle = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(top) - abs(bottom), abs(right) - abs(left));
  force = force / (length(force) + 0.0001) * uSwirl * middle;
  force.y = -force.y;
  vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
  fragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}
`;

const divergenceFragment = `${fluidHead}
uniform sampler2D uVelocity;
void main() {
  vec2 middle = texture(uVelocity, vUv).xy;
  float left = vL.x < 0.0 ? -middle.x : texture(uVelocity, vL).x;
  float right = vR.x > 1.0 ? -middle.x : texture(uVelocity, vR).x;
  float top = vT.y > 1.0 ? -middle.y : texture(uVelocity, vT).y;
  float bottom = vB.y < 0.0 ? -middle.y : texture(uVelocity, vB).y;
  fragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
}
`;

const pressureFragment = `${fluidHead}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float left = texture(uPressure, vL).x;
  float right = texture(uPressure, vR).x;
  float top = texture(uPressure, vT).x;
  float bottom = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  fragColor = vec4((left + right + top + bottom - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

const projectFragment = `${fluidHead}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(texture(uPressure, vR).x - texture(uPressure, vL).x, texture(uPressure, vT).y - texture(uPressure, vB).y);
  fragColor = vec4(velocity, 0.0, 1.0);
}
`;

const advectFragment = `${fluidHead}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uFade;
void main() {
  vec2 from = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  fragColor = texture(uSource, from) / (1.0 + uFade * uDt);
}
`;

const scaleFragment = `${fluidHead}
uniform sampler2D uSource;
uniform float uValue;
void main() {
  fragColor = texture(uSource, vUv) * uValue;
}
`;

const fieldFragment = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform vec4 uGrid;
uniform vec2 uOrigin;
uniform vec2 uSlat;
uniform float uTime;
uniform float uScale;
uniform float uDirection;
uniform float uChop;
uniform float uStretch;
uniform float uGlint;
uniform float uContrast;
uniform float uPerspective;
uniform float uFog;
uniform float uIntro;
uniform sampler2D tVelocity;
uniform sampler2D tInk;
uniform vec2 uFluidTexel;
uniform float uFluid;
uniform float uInk;
out vec4 fragColor;

const float TURN[4] = float[4](0.0, -0.95, 0.78, 1.62);
const float LENGTH[4] = float[4](2.6, 1.7, 1.12, 0.76);
const float HEIGHT[4] = float[4](1.0, 0.75, 0.5, 0.3);
const float SHIFT[4] = float[4](0.0, 2.3, 4.1, 1.1);

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  float row = uGrid.y - 1.0 - cell.y;
  vec2 center = uOrigin + vec2(cell.x, row) * uGrid.zw + uSlat * 0.5;
  float v = clamp(center.y / uSize.y, 0.0, 1.0);

  vec2 flow = vec2(0.0);
  float ink = 0.0;
  if (uFluid > 0.5) {
    vec2 fluidUv = clamp(vec2(center.x / uSize.x, 1.0 - center.y / uSize.y), 0.0, 1.0);
    flow = texture(tVelocity, fluidUv).xy * uFluidTexel * uSize;
    ink = texture(tInk, fluidUv).x;
  }

  float horizon = mix(8.0, 0.5, uPerspective);
  float depth = (1.0 + horizon) / (v + horizon);
  vec2 world = vec2((center.x - uSize.x * 0.5) / uSize.y * depth, (depth - 1.0) * horizon * 2.2);
  world -= flow * 0.00018 * depth;
  world /= max(uScale, 0.05);

  float meander = 0.55 * sin(dot(world, vec2(0.23, 0.41)) * 0.9 + uTime * 0.13)
    + 0.3 * sin(dot(world, vec2(-0.37, 0.19)) * 1.4 - uTime * 0.09);

  float steep = uChop * 0.45;
  float height = 0.0;
  float total = 0.0;
  for (int i = 0; i < 4; i++) {
    float angle = uDirection + TURN[i];
    vec2 heading = vec2(cos(angle), sin(angle));
    float k = 6.2831853 / LENGTH[i];
    float omega = sqrt(9.81 * k) * 0.35;
    float theta = k * dot(world, heading) - omega * uTime + SHIFT[i] + meander * (0.6 + 0.3 * float(i));
    height += HEIGHT[i] * (cos(theta) + steep * cos(2.0 * theta));
    total += HEIGHT[i] * (1.0 + steep);
  }
  float level = clamp(0.5 + 0.5 * height / (total * 0.85), 0.0, 1.0);
  float crest = smoothstep(0.6, 1.0, level);
  float glint = crest * crest * uGlint;

  float haze = mix(1.0, 1.0 - uFog, pow(1.0 - v, 1.4));
  float light = (pow(level, uContrast) + glint * 0.8) * haze;
  float glow = 1.0 - exp(-max(ink, 0.0) * uInk * 1.6);
  light = 1.0 - (1.0 - clamp(light, 0.0, 1.0)) * (1.0 - glow);

  float front = uIntro * 1.35;
  float reveal = 1.0 - smoothstep(front - 0.35, front, v);
  float sweep = exp(-pow((v - front + 0.22) / 0.07, 2.0)) * (1.0 - uIntro);
  light = (light + sweep * 0.8) * reveal;
  light = max(light, 0.045 * reveal);
  float span = mix(1.0 - uStretch, 1.0, level) + glow * 0.3;
  span = clamp(span, 0.08, 1.0) * mix(0.1, 1.0, reveal);
  float tint = clamp(max(glint * 1.4, glow * 0.9) + sweep, 0.0, 1.0);
  float lean = clamp(flow.x / 1400.0, -1.0, 1.0) * 0.0 * reveal;

  fragColor = vec4(clamp(light, 0.0, 1.0), span, tint, 0.5 + 0.5 * lean);
}
`;

const slatFragment = `#version 300 es
precision highp float;
uniform sampler2D tField;
uniform vec2 uSize;
uniform float uDpr;
uniform vec4 uGrid;
uniform vec2 uOrigin;
uniform vec2 uSlat;
uniform float uRound;
uniform float uTilt;
uniform vec3 uColor;
uniform vec3 uGlintColor;
uniform vec4 uBackground;
out vec4 fragColor;

float pill(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  vec2 local = p - uOrigin;
  vec2 cell = floor(local / uGrid.zw);
  vec4 background = vec4(uBackground.rgb * uBackground.a, uBackground.a);
  vec4 slat = vec4(0.0);
  for (int dx = -1; dx <= 1; dx++) {
    vec2 neighbour = cell + vec2(float(dx), 0.0);
    if (neighbour.x < 0.0 || neighbour.y < 0.0 || neighbour.x >= uGrid.x || neighbour.y >= uGrid.y) continue;
    vec4 field = texelFetch(tField, ivec2(int(neighbour.x), int(uGrid.y - 1.0 - neighbour.y)), 0);
    vec2 offset = local - neighbour * uGrid.zw - uSlat * 0.5;
    float angle = (field.a - 0.5) * 2.0 * uTilt;
    float c = cos(angle);
    float s = sin(angle);
    vec2 turned = vec2(c * offset.x + s * offset.y, c * offset.y - s * offset.x);
    vec2 halfSize = vec2(uSlat.x * 0.5, uSlat.y * 0.5 * field.g);
    float radius = uRound * min(halfSize.x, halfSize.y);
    float alpha = clamp(0.5 - pill(turned, halfSize, radius) * uDpr, 0.0, 1.0) * field.r;
    if (alpha > slat.a) slat = vec4(mix(uColor, uGlintColor, field.b) * alpha, alpha);
  }
  fragColor = slat + background * (1.0 - slat.a);
}
`;

export function initMicroSlats() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return Promise.resolve(false);

    return import(CDN)
        .then((OGL) => {
            const { Renderer, Program, Mesh, Triangle, RenderTarget, Texture } = OGL;
            const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
            const gl = renderer.gl;
            if (!renderer.isWebgl2) {
                gl.getExtension('WEBGL_lose_context')?.loseContext();
                return false;
            }
            gl.clearColor(0, 0, 0, 0);
            const canvas = gl.canvas;
            canvas.style.display = 'block';
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.setAttribute('aria-hidden', 'true');
            container.appendChild(canvas);

            const geometry = new Triangle(gl);
            const blank = new Texture(gl);
            const floatTargets = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));

            const dispose = (target) => {
                gl.deleteFramebuffer(target.buffer);
                gl.deleteTexture(target.texture.texture);
            };

            let fieldTarget = new RenderTarget(gl, { width: 1, height: 1, depth: false, minFilter: gl.NEAREST, magFilter: gl.NEAREST });

            const settings = {
                color: [0x34 / 255, 0x28 / 255, 0x3f / 255],
                glintColor: [1, 1, 1],
                backgroundColor: [0, 0, 0, 1],
                slatWidth: 10, slatHeight: 25, gap: 3, roundness: 0.75,
                scale: 1.5, speed: 0.6, direction: 250, chop: 0.55, stretch: 0,
                glint: 0.7, contrast: 1.25, perspective: 0.55, fog: 0.55,
                cursorStrength: 1, cursorSize: 40, trail: 1.4,
                intro: true, introDuration: 1.5, paused: false
            };

            const fieldUniforms = {
                uSize: { value: [1, 1] }, uGrid: { value: [1, 1, 1, 1] }, uOrigin: { value: [0, 0] },
                uSlat: { value: [1, 1] }, uTime: { value: 0 }, uScale: { value: 1.5 },
                uDirection: { value: (250 * Math.PI) / 180 }, uChop: { value: 0.55 }, uStretch: { value: 0 },
                uGlint: { value: 0.7 }, uContrast: { value: 1.25 }, uPerspective: { value: 0.55 },
                uFog: { value: 0.55 }, uIntro: { value: 0 },
                tVelocity: { value: blank }, tInk: { value: blank },
                uFluidTexel: { value: [1, 1] }, uFluid: { value: 0 }, uInk: { value: 1 }
            };
            const fieldMesh = new Mesh(gl, { geometry, program: new Program(gl, { vertex: passVertex, fragment: fieldFragment, uniforms: fieldUniforms, depthTest: false, depthWrite: false }) });

            const slatUniforms = {
                tField: { value: fieldTarget.texture }, uSize: { value: [1, 1] }, uDpr: { value: 1 },
                uGrid: { value: [1, 1, 1, 1] }, uOrigin: { value: [0, 0] }, uSlat: { value: [1, 1] },
                uRound: { value: 0.75 }, uTilt: { value: 0 },
                uColor: { value: settings.color }, uGlintColor: { value: settings.glintColor },
                uBackground: { value: settings.backgroundColor }
            };
            const slatMesh = new Mesh(gl, { geometry, program: new Program(gl, { vertex: passVertex, fragment: slatFragment, uniforms: slatUniforms, depthTest: false, depthWrite: false }) });

            const fluidTexel = { value: [1, 1] };
            const fluidPass = (fragment, uniforms) =>
                new Mesh(gl, { geometry, program: new Program(gl, { vertex: fluidVertex, fragment, uniforms: { uTexel: fluidTexel, ...uniforms }, depthTest: false, depthWrite: false }) });
            const splatPass = fluidPass(splatFragment, { uTarget: { value: blank }, uAspect: { value: 1 }, uPoint: { value: [0, 0] }, uValue: { value: [0, 0, 0] }, uRadius: { value: 0.01 } });
            const divergencePass = fluidPass(divergenceFragment, { uVelocity: { value: blank } });
            const pressurePass = fluidPass(pressureFragment, { uPressure: { value: blank }, uDivergence: { value: blank } });
            const projectPass = fluidPass(projectFragment, { uPressure: { value: blank }, uVelocity: { value: blank } });
            const advectPass = fluidPass(advectFragment, { uVelocity: { value: blank }, uSource: { value: blank }, uDt: { value: 0.016 }, uFade: { value: 1 } });
            const scalePass = fluidPass(scaleFragment, { uSource: { value: blank }, uValue: { value: 0 } });

            const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

            let width = 1, height = 1, raf = 0, last = performance.now(), time = 0, introClock = 0;
            let visible = true, alive = true, fluid = null, fluidUntil = 0, fluidDirty = false, splashTurn = 0;
            const splats = [];
            const pointer = { x: 0, y: 0, tracked: false };

            const run = (mesh, target) => renderer.render({ scene: mesh, target, clear: false });

            const floatTarget = (w, h) => new RenderTarget(gl, { width: w, height: h, depth: false, type: gl.HALF_FLOAT, format: gl.RGBA, internalFormat: gl.RGBA16F, minFilter: gl.LINEAR, magFilter: gl.LINEAR });

            const swapPair = (w, h) => ({ read: floatTarget(w, h), write: floatTarget(w, h), swap() { const n = this.read; this.read = this.write; this.write = n; } });

            const disposeFluid = () => {
                if (!fluid) return;
                [fluid.velocity, fluid.ink, fluid.pressure].forEach((pair) => { dispose(pair.read); dispose(pair.write); });
                dispose(fluid.divergence);
                fluid = null;
            };

            const buildFluid = () => {
                if (!floatTargets) return;
                const aspect = width / height;
                const w = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE * aspect : FLUID_SIZE));
                const h = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE : FLUID_SIZE / aspect));
                if (fluid && fluid.width === w && fluid.height === h) return;
                disposeFluid();
                fluid = {
                    width: w, height: h,
                    velocity: swapPair(w, h), ink: swapPair(w, h), pressure: swapPair(w, h),
                    divergence: floatTarget(w, h),
                    fluidTexelValue: [1 / w, 1 / h]
                };
                fluidTexel.value = [1 / w, 1 / h];
            };

            const resize = () => {
                width = Math.max(1, container.clientWidth);
                height = Math.max(1, container.clientHeight);
                renderer.dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (width * height)));
                renderer.setSize(width, height);
                buildFluid();
                start();
            };

            const layout = () => {
                const slatW = clamp(settings.slatWidth, 1, 64);
                const slatH = clamp(settings.slatHeight, 2, 240);
                const gapSize = clamp(settings.gap, 0, 64);
                const pitchX = slatW + gapSize;
                const pitchY = slatH + gapSize;
                const cols = Math.min(2048, Math.ceil((width + gapSize) / pitchX) + 1);
                const rows = Math.min(2048, Math.ceil((height + gapSize) / pitchY) + 1);
                const originX = (width - (cols * pitchX - gapSize)) / 2;
                const originY = (height - (rows * pitchY - gapSize)) / 2;
                if (fieldTarget.width !== cols || fieldTarget.height !== rows) {
                    dispose(fieldTarget);
                    fieldTarget = new RenderTarget(gl, { width: cols, height: rows, depth: false, minFilter: gl.NEAREST, magFilter: gl.NEAREST });
                    slatUniforms.tField.value = fieldTarget.texture;
                }
                return { slatW, slatH, grid: [cols, rows, pitchX, pitchY], origin: [originX, originY] };
            };

            const splat = (pair, point, value, radius) => {
                const u = splatPass.program.uniforms;
                u.uTarget.value = pair.read.texture;
                u.uAspect.value = width / height;
                u.uPoint.value = point;
                u.uValue.value = value;
                u.uRadius.value = radius;
                run(splatPass, pair.write);
                pair.swap();
            };

            const projectPasses = () => {
                divergencePass.program.uniforms.uVelocity.value = fluid.velocity.read.texture;
                run(divergencePass, fluid.divergence);
                scalePass.program.uniforms.uSource.value = fluid.pressure.read.texture;
                scalePass.program.uniforms.uValue.value = 0.8;
                run(scalePass, fluid.pressure.write);
                fluid.pressure.swap();
                pressurePass.program.uniforms.uDivergence.value = fluid.divergence.texture;
                for (let i = 0; i < PRESSURE_STEPS; i++) {
                    pressurePass.program.uniforms.uPressure.value = fluid.pressure.read.texture;
                    run(pressurePass, fluid.pressure.write);
                    fluid.pressure.swap();
                }
                projectPass.program.uniforms.uPressure.value = fluid.pressure.read.texture;
                projectPass.program.uniforms.uVelocity.value = fluid.velocity.read.texture;
                run(projectPass, fluid.velocity.write);
                fluid.velocity.swap();
                const fade = 1 / clamp(settings.trail, 0.1, 10);
                const advect = advectPass.program.uniforms;
                advect.uDt.value = 1 / 60;
                advect.uVelocity.value = fluid.velocity.read.texture;
                advect.uSource.value = fluid.velocity.read.texture;
                advect.uFade.value = fade * 1.4;
                run(advectPass, fluid.velocity.write);
                fluid.velocity.swap();
                advect.uVelocity.value = fluid.velocity.read.texture;
                advect.uSource.value = fluid.ink.read.texture;
                advect.uFade.value = fade;
                run(advectPass, fluid.ink.write);
                fluid.ink.swap();
            };

            const clearFluid = () => {
                scalePass.program.uniforms.uValue.value = 0;
                [fluid.velocity, fluid.ink, fluid.pressure].forEach((pair) => {
                    scalePass.program.uniforms.uSource.value = pair.read.texture;
                    run(scalePass, pair.write);
                    pair.swap();
                });
            };

            const frame = (now) => {
                raf = 0;
                if (!alive) return;
                const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
                last = now;
                if (!settings.paused && !reducedMotion) time += dt * settings.speed;
                introClock = settings.intro && !reducedMotion ? introClock + dt / Math.max(0.2, settings.introDuration) : 1;
                const introLinear = Math.min(introClock, 1);
                const introEase = introLinear < 0.5 ? 4 * introLinear ** 3 : 1 - (-2 * introLinear + 2) ** 3 / 2;

                if (fluid && splats.length) {
                    const radius = Math.pow(clamp(settings.cursorSize, 4, 600) / height, 2) * 0.35;
                    const aspect = width / height;
                    for (const [u, v, du, dv, turn] of splats) {
                        if (turn === null) {
                            splat(fluid.velocity, [u, v], [du * SPLAT_FORCE, dv * SPLAT_FORCE, 0], radius);
                            splat(fluid.ink, [u, v], [0.13, 0, 0], radius);
                            continue;
                        }
                        const jet = radius * 0.55;
                        const reach = Math.sqrt(jet * 0.5) * 1.9;
                        const push = SPLAT_FORCE * 0.08;
                        for (let i = 0; i < SPLASH_JETS; i++) {
                            const angle = turn + (i / SPLASH_JETS) * Math.PI * 2;
                            const dx = Math.cos(angle), dy = Math.sin(angle);
                            const point = [u + (dx * reach) / aspect, v + dy * reach];
                            const spin = [(dx - dy) * Math.SQRT1_2 * push, (dy + dx) * Math.SQRT1_2 * push, 0];
                            splat(fluid.velocity, point, spin, jet);
                            splat(fluid.ink, point, [0.75, 0, 0], jet);
                        }
                        splat(fluid.ink, [u, v], [0.45, 0, 0], radius);
                    }
                    splats.length = 0;
                    fluidDirty = true;
                }
                const fluidActive = fluid !== null && now < fluidUntil;
                if (fluid) {
                    if (fluidActive) projectPasses();
                    else if (fluidDirty) { clearFluid(); fluidDirty = false; }
                }

                const g = layout();
                fieldUniforms.uSize.value = [width, height];
                fieldUniforms.uGrid.value = g.grid;
                fieldUniforms.uOrigin.value = g.origin;
                fieldUniforms.uSlat.value = [g.slatW, g.slatH];
                fieldUniforms.uTime.value = time;
                fieldUniforms.uScale.value = settings.scale;
                fieldUniforms.uDirection.value = (settings.direction * Math.PI) / 180;
                fieldUniforms.uChop.value = clamp(settings.chop, 0, 1.5);
                fieldUniforms.uStretch.value = clamp(settings.stretch, 0, 0.95);
                fieldUniforms.uGlint.value = Math.max(0, settings.glint);
                fieldUniforms.uContrast.value = clamp(settings.contrast, 0.2, 4);
                fieldUniforms.uPerspective.value = clamp(settings.perspective, 0, 1);
                fieldUniforms.uFog.value = clamp(settings.fog, 0, 1);
                fieldUniforms.uIntro.value = introEase;
                fieldUniforms.uFluid.value = fluidActive ? 1 : 0;
                fieldUniforms.tVelocity.value = fluid ? fluid.velocity.read.texture : blank;
                fieldUniforms.tInk.value = fluid ? fluid.ink.read.texture : blank;
                fieldUniforms.uInk.value = clamp(settings.cursorStrength, 0, 3);
                renderer.render({ scene: fieldMesh, target: fieldTarget });

                slatUniforms.uSize.value = [width, height];
                slatUniforms.uDpr.value = renderer.dpr;
                slatUniforms.uGrid.value = g.grid;
                slatUniforms.uOrigin.value = g.origin;
                slatUniforms.uSlat.value = [g.slatW, g.slatH];
                slatUniforms.uTilt.value = 0;
                slatUniforms.uRound.value = clamp(settings.roundness, 0, 1);
                renderer.render({ scene: slatMesh });

                const moving = (!settings.paused && !reducedMotion && settings.speed !== 0) || introClock < 1;
                if (visible && (moving || fluidActive || fluidDirty)) raf = requestAnimationFrame(frame);
            };

            const start = () => {
                if (raf || !visible || !alive) return;
                last = performance.now();
                raf = requestAnimationFrame(frame);
            };

            const locate = (e) => {
                const rect = container.getBoundingClientRect();
                const x = e.clientX - rect.left, y = e.clientY - rect.top;
                const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
                return { x, y, u: x / w, v: 1 - y / h, h, inside: x >= 0 && y >= 0 && x <= w && y <= h };
            };

            const queue = (u, v, du, dv, turn) => {
                if (splats.length > 32) splats.shift();
                splats.push([u, v, du, dv, turn]);
                fluidUntil = performance.now() + Math.max(1.5, settings.trail * 5) * 1000;
                start();
            };

            const onPointerMove = (e) => {
                const spot = locate(e);
                if (!fluid || reducedMotion || !spot.inside) { pointer.tracked = false; return; }
                if (pointer.tracked && (spot.x !== pointer.x || spot.y !== pointer.y)) {
                    queue(spot.u, spot.v, (spot.x - pointer.x) / spot.h, (pointer.y - spot.y) / spot.h, null);
                }
                pointer.x = spot.x; pointer.y = spot.y; pointer.tracked = true;
            };
            const onPointerDown = (e) => {
                const spot = locate(e);
                if (!fluid || reducedMotion || !spot.inside) return;
                splashTurn += 2.39996;
                queue(spot.u, spot.v, 0, 0, splashTurn);
            };

            window.addEventListener('pointermove', onPointerMove, { passive: true });
            window.addEventListener('pointerdown', onPointerDown, { passive: true });

            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(container);
            const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; start(); });
            intersectionObserver.observe(container);

            resize();
            return true;
        })
        .catch((error) => {
            console.warn('[MICRO_SLATS] yüklenemedi:', error?.message || error);
            return false;
        });
}
