'use strict';
const {parsers}=require('prettier/plugins/babel');
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const [key,value]of Object.entries(node)){if(['loc','tokens','comments','extra'].includes(key))continue;if(Array.isArray(value))value.forEach(item=>walk(item,visit));else walk(value,visit);}}
function nodes(source,predicate){const result=[];walk(parsers.babel.parse(source,{}),node=>{if(predicate(node))result.push(node);});return result;}
function functionSource(source,name){const node=nodes(source,node=>node.type==='FunctionDeclaration'&&node.id.name===name)[0];if(!node)throw Error('Missing function '+name);return source.slice(node.start,node.end);}
module.exports={nodes,functionSource};
