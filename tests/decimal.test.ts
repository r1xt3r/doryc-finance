import test from 'node:test';
import assert from 'node:assert/strict';
import { decimalNumber } from '../lib/decimal.ts';

test('accepts decimal commas used by Spanish iPhone keyboards', () => {
  assert.equal(decimalNumber('12,50'), 12.5);
  assert.equal(decimalNumber('0,45'), 0.45);
});

test('continues accepting decimal points and localized thousands', () => {
  assert.equal(decimalNumber('12.50'), 12.5);
  assert.equal(decimalNumber('1.234,56'), 1234.56);
  assert.equal(decimalNumber('1,234.56'), 1234.56);
});
