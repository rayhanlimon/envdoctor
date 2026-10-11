import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEnvFiles } from '../src/check.js';

test('duplicate keys are errors', () => {
  const r = checkEnvFiles({ envText: 'A=1\nA=2\n' });
  assert.ok(r.issues.some(i => i.rule === 'duplicate-key' && i.level === 'error'));
});

test('example drift both directions', () => {
  const r = checkEnvFiles({ envText: 'A=1\nB=2\n', exampleText: 'A=\nC=\n' });
  assert.ok(r.issues.some(i => i.rule === 'missing-in-env' && i.key === 'C'));
  assert.ok(r.issues.some(i => i.rule === 'undocumented-key' && i.key === 'B'));
});

test('used-but-undefined from code refs', () => {
  const refs = new Map([['NEEDS_ME', { files: new Set(['app.js']), count: 1 }]]);
  const r = checkEnvFiles({ envText: 'OTHER=1\n', codeRefs: refs });
  assert.ok(r.issues.some(i => i.rule === 'used-but-undefined' && i.key === 'NEEDS_ME'));
});

test('empty value warns', () => {
  const r = checkEnvFiles({ envText: 'E=\n' });
  assert.ok(r.issues.some(i => i.rule === 'empty-value'));
});

test('clean env passes', () => {
  const refs = new Map([['A', { files: new Set(['a.js']), count: 1 }]]);
  const r = checkEnvFiles({ envText: 'A=1\n', exampleText: 'A=\n', codeRefs: refs });
  assert.ok(!r.issues.some(i => i.level === 'error'));
});
