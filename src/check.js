/**
 * check.js — compare parsed dotenv entries against code refs + .env.example.
 */
import { parseDotenv } from './parser.js';

export function checkEnvFiles({ envText, exampleText, codeRefs, options = {} }) {
  const issues = [];
  const entries = parseDotenv(envText ?? '');
  const exampleEntries = exampleText != null ? parseDotenv(exampleText) : [];
  const seen = new Map();
  const keyToEntry = new Map();
  const invalidEntries = [];

  for (const e of entries) {
    if (e.invalid || e.key == null) { invalidEntries.push(e); continue; }
    if (seen.has(e.key)) {
      seen.get(e.key).push(e.line);
    } else {
      seen.set(e.key, [e.line]);
      keyToEntry.set(e.key, e);
    }
  }
  for (const [key, lines] of seen) {
    if (lines.length > 1) {
      issues.push({ rule: 'duplicate-key', level: 'error', key, lines,
        message: `Duplicate key "${key}" defined on lines ${lines.join(', ')} (last wins at runtime).` });
    }
  }
  for (const e of invalidEntries) {
    issues.push({ rule: 'invalid-line', level: 'error', line: e.line,
      message: `Line ${e.line} is not a valid KEY=VALUE entry (${e.invalid}). Raw: ${JSON.stringify(e.raw)}` });
  }
  // empty values
  for (const e of entries) {
    if (e.invalid || e.key == null) continue;
    if (e.value === '') {
      issues.push({ rule: 'empty-value', level: 'warning', key: e.key, lines: [e.line],
        message: `"${e.key}" has an empty value (line ${e.line}). Intentional?` });
    }
  }
  // suspicious values: trailing whitespace, unquoted spaces, URLs with creds
  for (const e of entries) {
    if (e.invalid || e.key == null) continue;
    if (/[ \t]+$/.test(e.raw.split('#')[0] ?? '') && !e.quoted) {
      // check raw value part
      const rhs = e.raw.slice(e.raw.indexOf('=') + 1);
      if (/[ \t]+$/.test(rhs)) {
        issues.push({ rule: 'trailing-whitespace', level: 'warning', key: e.key, lines: [e.line],
          message: `"${e.key}" has trailing whitespace in its value (line ${e.line}).` });
      }
    }
    if (e.value != null && e.value.includes(' ') && !e.quoted) {
      issues.push({ rule: 'unquoted-spaces', level: 'warning', key: e.key, lines: [e.line],
        message: `"${e.key}" contains spaces but is not quoted (line ${e.line}). Quote it.` });
    }
  }
  // key naming
  for (const e of entries) {
    if (e.invalid || e.key == null) continue;
    if (e.key !== e.key.toUpperCase() || /[.-]/.test(e.key)) {
      issues.push({ rule: 'key-format', level: 'info', key: e.key, lines: [e.line],
        message: `"${e.key}" is not UPPER_SNAKE_CASE (line ${e.line}).` });
    }
  }
  // .env.example drift
  if (exampleText != null) {
    const exampleKeys = new Set(exampleEntries.filter(e => !e.invalid && e.key).map(e => e.key));
    const envKeys = new Set([...keyToEntry.keys()]);
    for (const k of exampleKeys) {
      if (!envKeys.has(k)) {
        issues.push({ rule: 'missing-in-env', level: 'error', key: k,
          message: `"${k}" is documented in .env.example but missing from .env.` });
      }
    }
    for (const k of envKeys) {
      if (!exampleKeys.has(k)) {
        issues.push({ rule: 'undocumented-key', level: 'warning', key: k,
          message: `"${k}" exists in .env but is not documented in .env.example.` });
      }
    }
  }
  // code refs: used-but-undefined + defined-but-unused
  if (codeRefs) {
    for (const [name] of codeRefs) {
      if (!keyToEntry.has(name)) {
        const files = [...(codeRefs.get(name).files)].slice(0, 5);
        issues.push({ rule: 'used-but-undefined', level: 'error', key: name,
          message: `"${name}" is used in code (${files.join(', ')}) but not defined in .env.` });
      }
    }
    const allowUnused = new Set(options.allowUnused ?? []);
    for (const key of keyToEntry.keys()) {
      if (!codeRefs.has(key) && !allowUnused.has(key)) {
        if (exampleText != null) continue; // example drift already covers it
        issues.push({ rule: 'unused-key', level: 'info', key,
          message: `"${key}" is defined in .env but never referenced in scanned code.` });
      }
    }
  }
  return { entries, exampleEntries, issues };
}

export function summarize(issues) {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.level] = (counts[i.level] ?? 0) + 1;
  return counts;
}

export function formatHuman(result, { envPath, examplePath } = {}) {
  const lines = [];
  const { issues } = result;
  const counts = summarize(issues);
  lines.push(`envdoctor: ${issues.length} finding(s) — ${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} info`);
  if (envPath) lines.push(`  env: ${envPath}`);
  if (examplePath) lines.push(`  example: ${examplePath}`);
  const order = { error: 0, warning: 1, info: 2 };
  const sorted = [...issues].sort((a, b) => (order[a.level] - order[b.level]) || (a.rule < b.rule ? -1 : 1));
  for (const i of sorted) {
    const tag = i.level.toUpperCase().padEnd(7);
    lines.push(`  [${tag}] ${i.rule}: ${i.message}`);
  }
  if (issues.length === 0) lines.push('  OK — no issues found.');
  return lines.join('\n');
}

export function formatJson(result, meta = {}) {
  return JSON.stringify({ ...meta, counts: summarize(result.issues), issues: result.issues }, null, 2);
}

export function hasErrors(result) {
  return result.issues.some(i => i.level === 'error');
}
