import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Structural types only. Bounds, conditionals and evidence checks remain in core/validate.mjs.
const source = new URL('../../skills/evidentloop-review/schema/run.schema.json', import.meta.url);
const target = new URL('../../core/model-output.d.ts', import.meta.url);
const schema = JSON.parse(fs.readFileSync(source, 'utf8'));
function type(node) {
  if (node.$ref) return 'Model' + node.$ref.split('/').at(-1).replace(/^./, c => c.toUpperCase());
  if ('const' in node) return JSON.stringify(node.const);
  if (node.enum) return node.enum.map(v => JSON.stringify(v)).join(' | ');
  if (node.anyOf) return node.anyOf.map(type).join(' | ');
  if (node.type === 'object') return '{ ' + Object.entries(node.properties || {}).map(([key, value]) => JSON.stringify(key) + (node.required?.includes(key) ? '' : '?') + ': ' + type(value) + ';').join(' ') + ' }';
  if (node.type === 'array') return 'Array<' + type(node.items) + '>';
  if (node.type === 'integer') return 'number';
  if (['string', 'number', 'boolean', 'null'].includes(node.type)) return node.type;
  throw Error('Unsupported structural schema node: ' + JSON.stringify(node));
}
const generated = '// Generated from skills/evidentloop-review/schema/run.schema.json; do not edit.\n' +
  Object.entries(schema.$defs).map(([key, value]) => 'export type Model' + key.replace(/^./, c => c.toUpperCase()) + ' = ' + type(value) + ';\n').join('') +
  'export type ModelOutput = ' + type(schema) + ';\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== generated) throw Error('Schema types are stale; run node plugin/scripts/schema-types.mjs');
} else fs.writeFileSync(target, generated);
console.log(JSON.stringify({ schemaTypes: fileURLToPath(target).split('/').at(-1), checked: process.argv.includes('--check') }));
