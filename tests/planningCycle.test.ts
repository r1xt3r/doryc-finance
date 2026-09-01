import test from 'node:test';
import assert from 'node:assert/strict';
import { belongsToPlanningWindow, planningMonthKey } from '../lib/planningCycle.ts';

test('keeps planning in the current month through day 18', () => {
  assert.equal(planningMonthKey('2026-09-18'), '2026-09');
});

test('moves planning to the following month on day 19', () => {
  assert.equal(planningMonthKey('2026-09-19'), '2026-10');
  assert.equal(planningMonthKey('2026-12-19'), '2027-01');
});

test('includes overdue commitments but hides dates beyond the planning month', () => {
  assert.equal(belongsToPlanningWindow('2026-08-31', '2026-09'), true);
  assert.equal(belongsToPlanningWindow('2026-09-30', '2026-09'), true);
  assert.equal(belongsToPlanningWindow('2026-10-01', '2026-09'), false);
});
