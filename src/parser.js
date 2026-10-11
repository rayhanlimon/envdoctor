/**
 * dotenv parser with source locations and duplicate detection.
 * Supports: KEY=VALUE, export KEY=VALUE, quoted values, inline comments
 * (only after unquoted values), line continuations are NOT joined
 * (each physical line is one entry) to keep behavior predictable.
 */

export function parseDotenv(text) {
  const entries = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    let body = raw;
    let exported = false;
    const expMatch = /^\s*export\s+([^\s=]+.*)$/.exec(body);
    if (expMatch) {
      exported = true;
      body = expMatch[1];
    }
    const eq = body.indexOf('=');
    if (eq === -1) {
      entries.push({ key: null, value: null, line: lineNo, raw, invalid: 'missing-=' });
      continue;
    }
    const rawKey = body.slice(0, eq).trim();
    let rawVal = body.slice(eq + 1);
    if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(rawKey)) {
      entries.push({ key: rawKey, value: null, line: lineNo, raw, invalid: 'bad-key' });
      continue;
    }
    rawVal = rawVal.trim();
    let value;
    let quoted = null;
    if (rawVal.startsWith('"') || rawVal.startsWith("'") || rawVal.startsWith('`')) {
      const q = rawVal[0];
      quoted = q;
      const close = findClosingQuote(rawVal, q);
      if (close === -1) {
        entries.push({ key: rawKey, value: null, line: lineNo, raw, invalid: 'unterminated-quote' });
        continue;
      }
      value = rawVal.slice(1, close);
      if (q === '"') value = unescapeDouble(value);
      const rest = rawVal.slice(close + 1).trim();
      if (rest !== '' && !rest.startsWith('#')) {
        entries.push({ key: rawKey, value, line: lineNo, raw, invalid: 'trailing-chars', quoted, exported });
        continue;
      }
    } else {
      // Unquoted: strip inline comment only when preceded by whitespace or at least
      // treat ' #' as comment start. A '#' inside a word (e.g. color #fff in
      // unquoted?) is kept except ' #' pattern.
      const commentIdx = findInlineComment(rawVal);
      if (commentIdx !== -1) rawVal = rawVal.slice(0, commentIdx).trimEnd();
      value = rawVal;
      // unescape \# -> #, \n stays literal in unquoted
      value = value.replace(/\\#/g, '#');
    }
    entries.push({ key: rawKey, value, line: lineNo, raw, quoted, exported });
  }
  return entries;
}

function findClosingQuote(s, q) {
  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    if (q === '"' && c === '\\') { i++; continue; }
    if (c === q) return i;
  }
  return -1;
}

function unescapeDouble(v) {
  return v.replace(/\\(.)/g, (m, ch) => {
    switch (ch) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case '"': return '"';
      case '\\': return '\\';
      default: return m;
    }
  });
}

function findInlineComment(val) {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < val.length; i++) {
    const c = val[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(val[i - 1])) return i;
    }
  }
  return -1;
}
