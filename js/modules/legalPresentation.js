import { reducedMotion } from '../ui/motion.js';
let clearPreview = () => {};
const disclosures = new Map();
export function showLegalPreview(srcdoc, animate = false) {
  clearPreview();
  const old = document.getElementById('legal-preview');
  if (!old) return;
  if (!animate || reducedMotion() || !old.hasAttribute('srcdoc')) {
    old.srcdoc = srcdoc;
    return;
  }
  const next = old.cloneNode(false),
    host = old.parentElement;
  next.removeAttribute('id');
  next.setAttribute('aria-hidden', 'true');
  next.classList.add('legal-preview-frame');
  next.style.opacity = '0';
  host.setAttribute('aria-busy', 'true');
  let disposed = false,
    animations = [];
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    next.onload = null;
    animations.forEach((a) => a.cancel());
    if (next.id === 'legal-preview') {
      old.remove();
      next.style.opacity = '';
    } else next.remove();
    host.removeAttribute('aria-busy');
  };
  clearPreview = cleanup;
  next.onload = () => {
    if (disposed) return;
    old.removeAttribute('id');
    old.setAttribute('aria-hidden', 'true');
    next.id = 'legal-preview';
    next.removeAttribute('aria-hidden');
    animations = [
      old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'both' }),
      next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'both' }),
    ];
    Promise.allSettled(animations.map((a) => a.finished)).then(cleanup);
  };
  next.srcdoc = srcdoc;
  host.append(next);
}
export function mountLegalDisclosures() {
  for (const details of document.querySelectorAll('#legal-detail details')) {
    if (disclosures.has(details)) continue;
    const summary = details.querySelector('summary'),
      body = document.createElement('div');
    body.className = 'legal-disclosure-body';
    const inner = document.createElement('div');
    while (summary.nextSibling) inner.append(summary.nextSibling);
    body.append(inner);
    details.append(body);
    details.classList.add('legal-disclosure');
    let animation = null,
      sequence = 0,
      update = null;
    const observer = new ResizeObserver(() => update?.());
    observer.observe(inner);
    const reset = () => {
      sequence++;
      update = null;
      animation?.cancel();
      animation = null;
      details.open = false;
      details.classList.remove('is-expanded');
      summary.setAttribute('aria-expanded', 'false');
    };
    summary.addEventListener('click', (event) => {
      event.preventDefault();
      const opening = !details.classList.contains('is-expanded'),
        request = ++sequence;
      const from = details.open ? body.getBoundingClientRect().height : 0;
      animation?.cancel();
      details.open = true;
      details.classList.toggle('is-expanded', opening);
      summary.setAttribute('aria-expanded', String(opening));
      const finish = () => {
        if (request !== sequence) return;
        details.open = opening;
        animation = null;
        update = null;
      };
      if (reducedMotion()) {
        finish();
        return;
      }
      const run = (start, end) => {
        const opacity = animation ? Number(getComputedStyle(body).opacity) : opening ? 0 : 1;
        animation?.cancel();
        animation = body.animate(
          [
            { height: start + 'px', opacity },
            { height: end + 'px', opacity: opening ? 1 : 0 },
          ],
          { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' },
        );
        animation.finished.then(finish, () => {});
      };
      update = opening
        ? () => run(body.getBoundingClientRect().height, inner.getBoundingClientRect().height + 18)
        : null;
      run(from, opening ? inner.getBoundingClientRect().height + 18 : 0);
    });
    disclosures.set(details, reset);
  }
}
export function resetLegalPresentation() {
  clearPreview();
  clearPreview = () => {};
  for (const reset of disclosures.values()) reset();
}
export function closeLegalHistory() {
  const details = document.getElementById('legal-history-section');
  disclosures.get(details)?.();
}
