import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetStatus, recommendBudgetAllocation, recommendCategoryBudget } from '../modules/planning/domain/budgets.ts';

test('guided budgets become progressively stricter', () => {
  const samples = [{ category: 'Food', amount: 180, month: '2026-06' }, { category: 'Food', amount: 200, month: '2026-07' }];
  const comfortable = recommendCategoryBudget('Food', samples, 700, 'comfortable');
  const balanced = recommendCategoryBudget('Food', samples, 700, 'balanced');
  const saving = recommendCategoryBudget('Food', samples, 700, 'saving');
  assert.ok(comfortable > balanced && balanced > saving);
});

test('budget status warns at 80 percent and flags overspending', () => {
  assert.equal(budgetStatus(80, 100).tone, 'warning');
  assert.equal(budgetStatus(101, 100).tone, 'danger');
  assert.equal(budgetStatus(40, 100).tone, 'healthy');
});

test('category recommendations distribute only the personal monthly spending amount', () => {
  const allocation = recommendBudgetAllocation(['Food', 'Transportation', 'Entertainment'], [
    { category: 'Food', amount: 100, month: '2026-07' },
    { category: 'Transportation', amount: 50, month: '2026-07' },
  ], 200);
  assert.equal([...allocation.values()].reduce((sum, value) => sum + value, 0), 200);
  assert.ok((allocation.get('Food') || 0) > (allocation.get('Transportation') || 0));
});
