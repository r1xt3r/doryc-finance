import test from 'node:test';
import assert from 'node:assert/strict';
import { monthEnd, nextMonthEnd, previousMonthEnd, salaryPaymentWindow } from '../modules/recurring-payments/domain/salarySchedule.ts';
import { calculateFinancialHealth } from '../modules/insights/domain/financialHealth.ts';
import { calculateAccountBalances } from '../modules/accounts/domain/calculateAccountBalances.ts';

test('salary stays anchored to the real end of each month', () => {
  assert.equal(monthEnd('2026-02-10'), '2026-02-28');
  assert.equal(monthEnd('2028-02-10'), '2028-02-29');
  assert.equal(nextMonthEnd('2026-08-31'), '2026-09-30');
  assert.equal(previousMonthEnd('2026-09-30'), '2026-08-31');
});

test('weekend salary exposes Friday to Monday payment window', () => {
  assert.deepEqual(salaryPaymentWindow('2026-11-30'), { nominal: '2026-11-30', earliest: '2026-11-30', latest: '2026-11-30', flexible: false });
  assert.deepEqual(salaryPaymentWindow('2027-05-30'), { nominal: '2027-05-30', earliest: '2027-05-28', latest: '2027-05-31', flexible: true });
});

test('financial health is explainable and bounded', () => {
  const health = calculateFinancialHealth({ available: 200, expectedIncome: 1300, commitments: 700, savings: 100, creditUsed: 300, creditLimit: 3000, overdueCount: 0 });
  assert.ok(health.score >= 85 && health.score <= 100);
  assert.equal(health.label, 'Excellent');
  assert.equal(health.factors.length, 4);
});

test('a card payment expense affects its account exactly once', () => {
  const balances = calculateAccountBalances([{ id: 'checking', starting_balance_cents: 10000 }], [{ type: 'expense', amount_cents: 2500, from_account_id: 'checking', to_account_id: null }], [], []);
  assert.equal(balances.get('checking'), 7500);
});

test('a transfer subtracts from its source and adds to its destination exactly once', () => {
  const balances = calculateAccountBalances(
    [
      { id: 'pichincha-debit', starting_balance_cents: 20000 },
      { id: 'produbanco-checking', starting_balance_cents: 0 },
    ],
    [{ type: 'transfer', amount_cents: 7470, from_account_id: 'pichincha-debit', to_account_id: 'produbanco-checking' }],
    [],
    [],
  );
  assert.equal(balances.get('pichincha-debit'), 12530);
  assert.equal(balances.get('produbanco-checking'), 7470);
});

test('income and expenses affect only the account explicitly selected', () => {
  const balances = calculateAccountBalances(
    [
      { id: 'debit', starting_balance_cents: 10000 },
      { id: 'checking', starting_balance_cents: 5000 },
    ],
    [
      { type: 'income', amount_cents: 3000, from_account_id: null, to_account_id: 'checking' },
      { type: 'expense', amount_cents: 1200, from_account_id: 'debit', to_account_id: null },
    ],
    [],
    [],
  );
  assert.equal(balances.get('debit'), 8800);
  assert.equal(balances.get('checking'), 8000);
});
