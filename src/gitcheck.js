/** git-safety: detect committed .env files and .env in .gitignore. */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function runGit(args, cwd) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd }, (err, stdout) => {
      if (err) return resolve({ ok: false });
      resolve({ ok: true, out: stdout.trim() });
    });
  });
}

export async function gitSafety(projectDir, envBasename = '.env') {
  const findings = [];
  const isRepo = await runGit(['rev-parse', '--is-inside-work-tree'], projectDir);
  if (!isRepo.ok) return { isRepo: false, findings };
  const ls = await runGit(['ls-files', '--', envBasename, '.env.local', '.env.production'], projectDir);
  if (ls.ok && ls.out) {
    for (const f of ls.out.split('\n').filter(Boolean)) {
      findings.push({ rule: 'env-committed', level: 'error',
        message: `"${f}" is tracked by git — .env files with real secrets must not be committed. Remove with: git rm --cached ${f}` });
    }
  }
  let ignoreText = '';
  try { ignoreText = await fs.promises.readFile(path.join(projectDir, '.gitignore'), 'utf8'); }
  catch { /* no gitignore */ }
  const hasEnvIgnore = ignoreText.split(/\r?\n/).some(l => {
    const t = l.trim();
    return t === '.env' || t === '.env*' || t === '*.env' || t.startsWith('.env');
  });
  if (!hasEnvIgnore) {
    findings.push({ rule: 'gitignore-missing-env', level: 'warning',
      message: '.gitignore does not ignore .env — add a ".env*" entry (keeping .env.example tracked).' });
  }
  return { isRepo: true, findings };
}
