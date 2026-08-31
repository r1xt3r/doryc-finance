export type FinancialHealthInput = {
  available: number;
  expectedIncome: number;
  commitments: number;
  savings: number;
  creditUsed: number;
  creditLimit: number;
  overdueCount: number;
};

export type FinancialHealth = {
  score: number;
  label: 'Excellent' | 'Stable' | 'Needs attention' | 'At risk';
  factors: Array<{ key: string; score: number; note: string }>;
};

export function calculateFinancialHealth(input: FinancialHealthInput): FinancialHealth {
  const coverage = input.commitments <= 0 ? 100 : Math.min(100, (input.available + input.expectedIncome) / input.commitments * 100);
  const utilization = input.creditLimit <= 0 ? 0 : input.creditUsed / input.creditLimit * 100;
  const creditScore = utilization <= 30 ? 100 : utilization <= 50 ? 78 : utilization <= 75 ? 48 : 20;
  const savingsScore = input.savings > 0 ? 100 : input.available + input.expectedIncome > input.commitments ? 65 : 25;
  const punctuality = Math.max(0, 100 - input.overdueCount * 30);
  const score = Math.round(coverage * .4 + creditScore * .25 + savingsScore * .2 + punctuality * .15);
  const label = score >= 85 ? 'Excellent' : score >= 68 ? 'Stable' : score >= 45 ? 'Needs attention' : 'At risk';
  return { score, label, factors: [
    { key: 'coverage', score: Math.round(coverage), note: 'Monthly commitments covered' },
    { key: 'credit', score: Math.round(creditScore), note: `${Math.round(utilization)}% credit utilization` },
    { key: 'savings', score: Math.round(savingsScore), note: input.savings > 0 ? 'Savings are growing' : 'No savings recorded yet' },
    { key: 'punctuality', score: Math.round(punctuality), note: input.overdueCount ? `${input.overdueCount} overdue commitments` : 'No overdue commitments' },
  ] };
}
