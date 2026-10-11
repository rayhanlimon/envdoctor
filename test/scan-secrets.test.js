import test from 'node:test';
import assert from 'node:assert/strict';
import { scanJS, scanShell } from '../src/scan.js';
import { scanValue, isPlaceholder, shannonEntropy } from '../src/secrets.js';

test('scanJS finds process.env and friends', () => {
  const hits = new Map();
  const add = (n, f) => hits.set(n, (hits.get(n) ?? 0) + 1);
  scanJS('const x = process.env.FOO; const y = process.env["BAR"]; const z = Deno.env.get("DENO_KEY");', 'a.js', add);
  assert.ok(hits.has('FOO')); assert.ok(hits.has('BAR')); assert.ok(hits.has('DENO_KEY'));
});

test('scanShell finds UPPER vars, skips lowercase', () => {
  const hits = new Map();
  const add = (n, f) => hits.set(n, true);
  scanShell('echo $MY_VAR ${OTHER_VAR} $x ${lower}', 'd.sh', add);
  assert.ok(hits.has('MY_VAR')); assert.ok(hits.has('OTHER_VAR'));
  assert.ok(!hits.has('x')); assert.ok(!hits.has('lower'));
});

test('placeholders are not secrets', () => {
  assert.equal(scanValue('API_KEY', 'CHANGEME'), null);
  assert.equal(scanValue('X', ''), null);
  assert.ok(isPlaceholder('your-key-here'));
});

test('known token pattern flagged', () => {
  const f = scanValue('GH', 'ghp_abcdefghijklmnopqrstuvwxyz1234');
  assert.ok(f && f.level === 'error');
});

test('entropy sane', () => {
  assert.ok(shannonEntropy('aaaa') < shannonEntropy('aB3$xZ!9q'));
});
