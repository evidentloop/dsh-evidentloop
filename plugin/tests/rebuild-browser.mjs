import path from 'node:path';import fs from 'node:fs';import {fileURLToPath} from 'node:url';import {installed} from '../scripts/toolchain.mjs';import {browserEntry} from './browser-entry.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=path.resolve(process.argv[2]),rt=installed('react',process.env.REACT_PACKAGE);
const entry=browserEntry(root);fs.writeFileSync(path.join(out,'fixture-entry.jsx'),entry);
await installed('esbuild').require('esbuild').build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root,sourcefile:'fixture-entry.jsx',loader:'jsx'},bundle:true,platform:'browser',format:'esm',alias:{react:rt.root,'react-dom':path.dirname(rt.require.resolve('react-dom/package.json'))},outfile:path.join(out,'fixture-client.js'),logLevel:'silent'});
console.log(JSON.stringify({output:out,synthetic:true,realModelCalls:0}));
