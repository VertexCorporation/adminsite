'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function dictionarySource(lang) {
    const directory = path.join(root, 'l10n', lang);
    return fs.readdirSync(directory).filter(name => name.endsWith('.js')).sort()
        .map(name => read(`l10n/${lang}/${name}`).replace(/^export default \{\n/, '').replace(/\n\};\s*$/, ''))
        .join(',\n');
}

// Source-contract checks follow logical features across their module boundaries.
// Browser tests still load the actual module graph and fetch the real fragments.
function readConsoleSource(file) {
    if (file === 'index.html') {
        return read(file).replace(/<template data-fragment="([a-z/-]+)"><\/template>/g,
            (_, name) => read(`partials/${name}.html`));
    }
    if (file === 'js/lang.js') {
        const dictionaries = `const LANG = {\n  tr: {\n${dictionarySource('tr')}\n  },\n  en: {\n${dictionarySource('en')}\n  }\n};\n`;
        const source = read(file);
        return dictionaries + source.slice(source.indexOf('const supportedLang'));
    }
    if (file === 'js/modules/shell.js') return read(file) + '\n' + read('js/ui/surfaces.js');
    if (file === 'js/modules/models.js') {
        return [file, ...['form', 'catalog', 'translations', 'actions', 'constants', 'access']
            .map(name => `js/modules/models/${name}.js`)].map(read).join('\n');
    }
    return read(file);
}

module.exports = {readConsoleSource, dictionarySource};
