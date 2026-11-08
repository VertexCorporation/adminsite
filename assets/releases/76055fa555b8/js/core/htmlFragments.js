// Resolve against this module so HTML and JavaScript always share a release.
const fragmentRoot = new URL('../../partials/', import.meta.url);

export async function loadHtmlFragments(root = document) {
    const slots = [...root.querySelectorAll('template[data-fragment]')];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const fragments = await Promise.all(slots.map(async slot => {
            const name = slot.dataset.fragment;
            if (!/^[a-z]+(?:\/[a-z-]+)*$/.test(name)) throw new Error('Invalid HTML fragment name.');
            const response = await fetch(new URL(name + '.html', fragmentRoot), {signal: controller.signal});
            if (!response.ok) throw new Error('HTML fragment unavailable: ' + name);
            const template = document.createElement('template');
            template.innerHTML = await response.text();
            if (!template.content.childElementCount || template.content.querySelector('script')) {
                throw new Error('Invalid HTML fragment: ' + name);
            }
            return {slot, content: template.content};
        }));
        // Do not mount a partially fetched application or start its controllers.
        for (const {slot, content} of fragments) slot.replaceWith(content);
    } finally {
        clearTimeout(timeout);
        controller.abort();
    }
}
