import fs from 'node:fs';
import path from 'node:path';
import { methodVersion, sha256, normalizeLF } from './common.mjs';
export function freezeMethod(methodRoot, snapshot, bundle) {
  const manifest = methodVersion(methodRoot);
  if (manifest.promptVersion !== snapshot.promptVersion) throw Error('method-version-mismatch');
  const modules = manifest.files.map(item => {
    const bytes = fs.readFileSync(path.join(methodRoot, item.path));
    if (sha256(bytes) !== item.sha256) throw Error('method-changed-during-injection');
    return Object.freeze({ ...item, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) });
  });
  if (snapshot.extensionPrompt) {
    const bytes = fs.readFileSync(path.join(bundle, 'extension.md')), text = bytes.toString('utf8');
    if (normalizeLF(text) !== text || sha256(bytes) !== snapshot.extensionPrompt.sha256 || text !== snapshot.extensionPrompt.text) throw Error('extension-integrity');
    modules.push(Object.freeze({ path: 'bundle/extension.md', sha256: sha256(bytes), text }));
  }
  return Object.freeze(modules);
}
