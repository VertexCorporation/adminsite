// Shared lifecycle for popovers, drawers, dialogs and transient UI.
// Derive the fallback from computed CSS rather than a second magic timeout.
export const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

function times(value) {
    return value.split(',').map(time => {
        const part = time.trim();
        const number = parseFloat(part);
        return Number.isFinite(number) ? number * (part.endsWith('ms') ? 1 : 1000) : 0;
    });
}

function longest(duration, delay) {
    const durations = times(duration), delays = times(delay);
    return Math.max(0, ...durations.map((time, index) => time + delays[index % delays.length]));
}

export function motionDuration(element) {
    if (reducedMotion() || !element?.isConnected) return 0;
    const style = getComputedStyle(element);
    return Math.max(
        longest(style.transitionDuration, style.transitionDelay),
        longest(style.animationDuration, style.animationDelay)
    );
}

// A late event from an older closing surface must never remove a replacement.
export function afterMotion(element, finish, property = null) {
    if (!element?.isConnected) { finish(); return () => {}; }
    let done = false, timeout;
    const clear = () => {
        element.removeEventListener('transitionend', ended);
        element.removeEventListener('animationend', ended);
        element.removeEventListener('transitioncancel', cancelled);
        element.removeEventListener('animationcancel', cancelled);
        clearTimeout(timeout);
    };
    const complete = () => {
        if (done) return;
        done = true;
        clear();
        finish();
    };
    const ended = event => {
        if (event.target === element && (!property || event.type === 'animationend' || event.propertyName === property)) complete();
    };
    const cancelled = event => {
        if (event.target === element && (!property || event.type === 'animationcancel' || event.propertyName === property)) complete();
    };
    element.addEventListener('transitionend', ended);
    element.addEventListener('animationend', ended);
    element.addEventListener('transitioncancel', cancelled);
    element.addEventListener('animationcancel', cancelled);
    const duration = motionDuration(element);
    if (duration <= 0) queueMicrotask(complete);
    else timeout = setTimeout(complete, duration + 80);
    return () => { if (!done) { done = true; clear(); } };
}
