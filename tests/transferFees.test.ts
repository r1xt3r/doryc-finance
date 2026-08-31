import test from 'node:test';
import assert from 'node:assert/strict';
import { digitalTransferFeeCents, normalizeBankName } from '../lib/transferFees.ts';

test('normalizes the bank names used by Doryc', () => {
  assert.equal(normalizeBankName('Banco del Pacífico'), 'delpacifico');
  assert.equal(normalizeBankName('Banco Pichincha'), 'pichincha');
});

test('charges 41 cents from Pichincha and Produbanco to another bank', () => {
  assert.equal(digitalTransferFeeCents('Produbanco', 'Banco Pichincha'), 41);
  assert.equal(digitalTransferFeeCents('Banco Pichincha', 'Produbanco'), 41);
  assert.equal(digitalTransferFeeCents('Pacifico', 'Banco Guayaquil'), 41);
  assert.equal(digitalTransferFeeCents('Banco del Pacífico', 'Produbanco'), 41);
});

test('does not charge transfers originating at Banco Guayaquil', () => {
  assert.equal(digitalTransferFeeCents('Banco Guayaquil', 'Banco Pichincha'), 0);
});

test('does not charge transfers within the same bank', () => {
  assert.equal(digitalTransferFeeCents('Produbanco', 'Produbanco'), 0);
});
