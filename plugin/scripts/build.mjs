import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { installed } from './toolchain.mjs';
import { methodVersion } from '../../core/lib/common.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), repo = path.dirname(root);
const tool = installed('esbuild', process.env.ESBUILD_PACKAGE), esbuild = tool.require('esbuild');
const outdir = path.join(root, 'dist'); fs.mkdirSync(outdir, { recursive: true });
const host = await esbuild.build({ absWorkingDir: repo, entryPoints: ['plugin/host/index.ts'], bundle: true, platform: 'node', format: 'esm', target: ['node20'], outfile: path.join(outdir, 'host.mjs'), metafile: true, logLevel: 'silent' });
const client = await esbuild.build({ absWorkingDir: repo, entryPoints: ['plugin/client/index.tsx'], bundle: true, platform: 'browser', format: 'cjs', target: ['chrome120'], external: ['react', 'react-dom'], loader: { '.css': 'text' }, jsx: 'transform', tsconfigRaw: { compilerOptions: { jsx: 'react' } }, outfile: path.join(outdir, 'client.js'), write: false, metafile: true, logLevel: 'silent' });
for (const output of client.outputFiles) {
  if (output.path.endsWith('.js')) fs.writeFileSync(output.path, `window.__ModuleLoader__.load({id:'@evidentloop/dsh-evidentloop',factory:require=>{var module={exports:{}};var exports=module.exports;\n${output.text}\nreturn module.exports;}});\n`);
  else fs.writeFileSync(output.path, output.contents);
}
fs.copyFileSync(path.join(root, 'client/styles.css'), path.join(outdir, 'client.css'));
const sourceMethod = path.join(repo, 'skills/evidentloop-review'), method = methodVersion(sourceMethod);
for (const file of method.files) { const target = path.join(root, 'skills/evidentloop-review', file.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(sourceMethod, file.path), target); }
if (methodVersion(path.join(root, 'skills/evidentloop-review')).promptVersion !== method.promptVersion) throw Error('Packaged method bytes changed');
const inputs = [...new Set([...Object.keys(host.metafile.inputs), ...Object.keys(client.metafile.inputs)])].sort().map(name => ({ path: name, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, name))).digest('hex') }));
fs.writeFileSync(path.join(outdir, 'build-manifest.json'), JSON.stringify({ esbuild: tool.version, coreImported: inputs.filter(i => i.path.startsWith('core/')), inputs, methodFiles: method.files, promptVersion: method.promptVersion, noPrototypeBusinessJs: !inputs.some(i => i.path.startsWith('prototype/src/')) }, null, 2) + '\n');
console.log(JSON.stringify({ esbuild: tool.version, hostBytes: fs.statSync(path.join(outdir, 'host.mjs')).size, clientBytes: fs.statSync(path.join(outdir, 'client.js')).size, methodFiles: method.files.length, promptVersion: method.promptVersion, installedDependencies: 0 }));
