import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectCodeRefs } from '../src/scan.js';

test('single-char doc refs like process.env.X are ignored', async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'envdoc-'));
  await fs.promises.writeFile(path.join(dir, 'a.js'), 'const x = process.env.X;\n');
  const refs = await collectCodeRefs(dir);
  assert.ok(!refs.has('X'));
});

test('--ignore skips directories', async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'envdoc-'));
  await fs.promises.mkdir(path.join(dir, 'test'));
  await fs.promises.writeFile(path.join(dir, 'test', 'f.js'), 'const x = process.env.FIXTURE_KEY;\n');
  await fs.promises.writeFile(path.join(dir, 'app.js'), 'const y = process.env.REAL_KEY;\n');
  const refs = await collectCodeRefs(dir, { ignore: ['test'] });
  assert.ok(!refs.has('FIXTURE_KEY'));
  assert.ok(refs.has('REAL_KEY'));
});
