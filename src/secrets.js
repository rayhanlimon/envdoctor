/**
 * Secret scanner: entropy + known-pattern detection with redaction.
 * Conservative by design: reports candidates with reasons, never prints values.
 */
export const SECRET_PATTERNS = [
  { id: 'aws-access-key', re: /AKIA[0-9A-Z]{16}/ },
  { id: 'github-token', re: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { id: 'slack-token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: 'google-api-key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { id: 'stripe-key', re: /s[kr]_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { id: 'openai-key', re: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/ },
  { id: 'generic-api-key', re: /(?:api[_-]?key|secret|token)\s*[:=]\s*['\"]?[A-Za-z0-9_\-\.]{16,}/i },
];

const OBVIOUS_PLACEHOLDERS = new Set([
  'changeme', 'change-me', 'example', 'test', 'password', 'secret', 'placeholder',
  'your-key-here', 'xxx', 'todo', 'none', 'null', 'undefined', '123456',
]);

export function isPlaceholder(value) {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return true;
  if (OBVIOUS_PLACEHOLDERS.has(v)) return true;
  if (/^(your|my|insert|enter|replace|sample|demo|fake|dummy)[-_ ].*/.test(v)) return true;
  if (/^(test|dev|local|example)([-_].*)?$/.test(v)) return true;
  return false;
}

export function shannonEntropy(s) {
  if (!s) return 0;
  const freq = new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const [, c] of freq) {
    const p = c / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

export function scanValue(key, value) {
  // returns finding or null; never echoes the value
  if (value == null || value === '') return null;
  if (isPlaceholder(value)) return null;
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(value)) {
      return { rule: 'possible-secret', level: 'error', key,
        message: `"${key}" looks like it contains a real secret (${p.id}). Do not commit this file.` };
    }
  }
  const SUSPICIOUS_KEYS = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_KEY|ACCESS_KEY)/i;
  if (SUSPICIOUS_KEYS.test(key) && value.length >= 20 && shannonEntropy(value) >= 4.0) {
    return { rule: 'high-entropy-secret', level: 'warning', key,
      message: `"${key}" has high entropy (${shannonEntropy(value).toFixed(1)} bits) and a sensitive name — verify it is not a production secret.` };
  }
  return null;
}
