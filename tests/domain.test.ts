import test from 'node:test';
import assert from 'node:assert/strict';
import { monthEnd, nextMonthEnd, previousMonthEnd, salaryPaymentWindow } from '../modules/recurring-payments/domain/salarySchedule.ts';
import { calculateFinancialHealth } from '../modules/insights/domain/financialHealth.ts';

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
