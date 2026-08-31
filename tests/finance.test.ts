import assert from 'node:assert/strict';
import test from 'node:test';
import { addMonthsClamped, cardPurchaseDueDate, estimateCardPayment, nextMonthlyDate } from '../lib/finance.ts';

test('moves a payment day that already passed into the next month', () => {
  assert.equal(nextMonthlyDate(2, '2026-08-30'), '2026-09-02');
});

test('keeps an upcoming payment day in the current month', () => {
  assert.equal(nextMonthlyDate(31, '2026-08-30'), '2026-08-31');
});

test('keeps a payment due today in the current cycle', () => {
  assert.equal(nextMonthlyDate(2, '2026-09-02'), '2026-09-02');
});

test('advances month-end dates without skipping a short month', () => {
  assert.equal(addMonthsClamped('2026-01-31'), '2026-02-28');
  assert.equal(addMonthsClamped('2028-01-31'), '2028-02-29');
});

test('clamps payment dates to the last valid day of a short month', () => {
  assert.equal(nextMonthlyDate(31, '2026-09-30'), '2026-09-30');
  assert.equal(nextMonthlyDate(31, '2026-02-01'), '2026-02-28');
});

test('adds cash purchases and no-interest installments to the statement', () => {
  const payment = estimateCardPayment(100, 16.77, [
    { amount: 60, installmentMonths: 1, installmentsPaid: 0, withInterest: false },
    { amount: 120, installmentMonths: 12, installmentsPaid: 0, withInterest: false },
  ]);
  assert.equal(payment, 170);
});

test('produces a finite positive payment for interest-bearing installments', () => {
  const payment = estimateCardPayment(0, 16.77, [
    { amount: 1200, installmentMonths: 12, installmentsPaid: 3, withInterest: true },
  ]);
  assert.ok(Number.isFinite(payment));
  assert.ok(payment > 0);
});

test('moves a purchase made after statement closing to the following payment cycle', () => {
  assert.equal(cardPurchaseDueDate('2026-08-30', 18, 2), '2026-10-02');
});

test('keeps a purchase before statement closing in the immediate payment cycle', () => {
  assert.equal(cardPurchaseDueDate('2026-08-10', 18, 2), '2026-09-02');
});
