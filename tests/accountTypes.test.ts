import test from 'node:test';
import assert from 'node:assert/strict';
import { isDedicatedSavingsAccount, isSavingsAccountType } from '../lib/accountTypes.ts';

test('recognizes savings accounts independently of their custom name', () => {
  for (const type of ['Savings', 'savings', 'Saving', 'Ahorros', 'AHORRO']) {
    assert.equal(isSavingsAccountType(type), true);
  }
});

test('does not classify checking or debit accounts as savings', () => {
  for (const type of ['Checking', 'Corriente', 'Debit', 'Débito', 'Cash']) {
    assert.equal(isSavingsAccountType(type), false);
  }
});

test('uses only Produbanco savings as the dedicated savings fund', () => {
  assert.equal(isDedicatedSavingsAccount('Produbanco', 'Savings'), true);
  assert.equal(isDedicatedSavingsAccount('Grupo Promerica', 'Ahorros'), true);
  assert.equal(isDedicatedSavingsAccount('Pichincha', 'Savings'), false);
  assert.equal(isDedicatedSavingsAccount('Produbanco', 'Checking'), false);
});
