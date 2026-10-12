/**
 * Code scanners: find process.env.X references in JS/TS and
 * dollar-VAR / dollar-brace-VAR references in shell/docker text.
 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'vendor', '__pycache__']);
const JS_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const SHELL_FILES = new Set(['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']);
const SHELL_EXTS = new Set(['.sh', '.bash', '.yml', '.yaml']);

export async function collectCodeRefs(projectDir, opts = {}) {
  const refs = new Map();
  const maxBytes = opts.maxBytes ?? 512 * 1024;
  const ignore = new Set([...DEFAULT_IGNORE, ...(opts.ignore ?? [])]);
  function addRef(name, file) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return;
    if (name.length < 2) return; // skip doc placeholders like process.env.X
    let e = refs.get(name);
    if (!e) { e = { files: new Set(), count: 0 }; refs.set(name, e); }
    e.files.add(file);
    e.count++;
  }
  async function walk(dir) {
    let ents;
    try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); }
    catch { return; }
    for (const ent of ents) {
      if (ignore.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { await walk(full); continue; }
      if (!ent.isFile()) continue;
      const base = path.basename(full);
      if (base.startsWith('.env')) continue;
      if (base === '.envdoctor.json') continue;
      const ext = path.extname(full).toLowerCase();
      const isJS = JS_EXTS.has(ext);
      const isShellish = SHELL_EXTS.has(ext) || SHELL_FILES.has(base) || base === 'Dockerfile';
      if (!isJS && !isShellish) continue;
      let stat;
      try { stat = await fs.promises.stat(full); } catch { continue; }
      if (stat.size > maxBytes) continue;
      let text;
      try { text = await fs.promises.readFile(full, 'utf8'); } catch { continue; }
      const rel = path.relative(projectDir, full) || base;
      if (isJS) scanJS(text, rel, addRef);
      if (isShellish) scanShell(text, rel, addRef);
    }
  }
  await walk(projectDir);
  return refs;
}

export function scanJS(text, file, addRef) {
  const patterns = [
    /process\.env(?:\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)|\s*\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\])/g,
    /import\.meta\.env(?:\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)|\s*\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\])/g,
    /Deno\.env\.get\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g,
    /os\.Getenv\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g,
    /getenv\s*\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']/g
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) {
      addRef(m[1] ?? m[2], file);
    }
  }
}

export function scanShell(text, file, addRef) {
  const re = /\$\{?([A-Za-z_][A-Za-z0-9_]*)/g;
  let m;
  const keywords = new Set(['HOME', 'PATH', 'PWD', 'USER', 'SHELL', 'HOSTNAME']);
  while ((m = re.exec(text))) {
    const name = m[1];
    if (keywords.has(name)) continue;
    if (name === name.toUpperCase() && name.length >= 2) addRef(name, file);
  }
}
