'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function dictionarySource(lang) {
    const directory = path.join(root, 'l10n', lang);
    return fs.readdirSync(directory).filter(name=>name.endsWith('.js')).sort().flatMap(name=>{
        const source=read(`l10n/${lang}/${name}`);
        const {nodes}=require('./source-ast.cjs');
        const object=nodes(source,node=>node.type==='ExportDefaultDeclaration')[0].declaration;
        return object.properties.map(property=>JSON.stringify(property.key.value??property.key.name)+': '+JSON.stringify(property.value.value)+',');
    }).join('\n');
}

// Source-contract checks follow logical features across their module boundaries.
// Browser tests still load the actual module graph and fetch the real fragments.
function readConsoleSource(file) {
    if (file === 'index.html') {
        return read(file).replace(/<template data-fragment="([a-z/-]+)">\s*<\/template>/g,
            (_, name) => read(`partials/${name}.html`));
    }
    if (file === 'js/lang.js') {
        const dictionaries = `const LANG = {\n  tr: {\n${dictionarySource('tr')}\n  },\n  en: {\n${dictionarySource('en')}\n  }\n};\n`;
        const source = read(file);
        return dictionaries + source.slice(source.indexOf('const supportedLang'));
    }
    if (file === 'js/modules/shell.js') return read(file) + '\n' + read('js/ui/surfaces.js') + '\n' + read('js/ui/appearance.js') + '\n' + read('js/ui/commandPalette.js');
    if (file === 'js/modules/models.js') {
        return [file, ...['form', 'catalog', 'translations', 'actions', 'constants', 'access']
            .map(name => `js/modules/models/${name}.js`)].map(read).join('\n');
    }
    if (file === 'js/modules/contributors.js') return read(file) + '\n' + read('js/modules/contributors/surfaces.js');
    if (file.endsWith('.css')) { const expand = name => read(name).replace(/@import url\(['"](.+?)['"]\);/g, (_, relative) => expand(path.posix.normalize(path.posix.join(path.posix.dirname(name),relative)))); return expand(file); }
    return read(file);
}

module.exports = {readConsoleSource, dictionarySource};
