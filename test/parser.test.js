import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDotenv } from '../src/parser.js';

test('parses basic KEY=VALUE', () => {
  const es = parseDotenv('FOO=bar\nBAZ= qux \n');
  assert.equal(es.length, 2);
  assert.equal(es[0].key, 'FOO'); assert.equal(es[0].value, 'bar');
  assert.equal(es[1].value, 'qux');
});

test('skips blanks and comments', () => {
  const es = parseDotenv('# hi\n\nA=1\n');
  assert.equal(es.length, 1); assert.equal(es[0].key, 'A');
});

test('handles export prefix and quotes', () => {
  const es = parseDotenv('export A="hello world"\nB=\'x#y\'\nC=plain # comment\n');
  assert.equal(es[0].exported, true); assert.equal(es[0].value, 'hello world');
  assert.equal(es[1].value, 'x#y');
  assert.equal(es[2].value, 'plain');
});

test('flags invalid lines', () => {
  const es = parseDotenv('NOEQUALS\n1BAD=x\nUNTERMINATED="abc\n');
  assert.ok(es.every(e => e.invalid));
  assert.equal(es[0].invalid, 'missing-=');
  assert.equal(es[1].invalid, 'bad-key');
  assert.equal(es[2].invalid, 'unterminated-quote');
});

test('double-quote escapes', () => {
  const es = parseDotenv('A="a\\n b"\n');
  assert.equal(es[0].value, 'a\n b');
});
