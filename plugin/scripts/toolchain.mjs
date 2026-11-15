import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
export function installed(name, override) {
  const cache = path.join(os.homedir(), '.npm/_npx'), candidates = [override];
  try { candidates.push(createRequire(import.meta.url).resolve(name + '/package.json')); } catch { /* An existing cache installation is also supported. */ }
  if (fs.existsSync(cache)) for (const dir of fs.readdirSync(cache).sort()) candidates.push(path.join(cache, dir, 'node_modules', name, 'package.json'));
  const file = candidates.filter(Boolean).find(p => fs.existsSync(p));
  if (!file) throw Error(`An existing ${name} module is required; no automatic installation is performed`);
  return { require: createRequire(file), packageFile: file, root: path.dirname(file), version: JSON.parse(fs.readFileSync(file)).version };
}
