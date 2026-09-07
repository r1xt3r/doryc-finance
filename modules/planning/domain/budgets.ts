export type BudgetMode = 'comfortable' | 'balanced' | 'saving';
export type ExpenseSample = { category: string; amount: number; month: string };

const MODE_FACTOR: Record<BudgetMode, number> = { comfortable: 1.08, balanced: .95, saving: .82 };
const ESSENTIAL_FLOOR: Record<string, number> = { Food: .2, Transportation: .08, Home: .18, Health: .06, Utilities: .08 };

export function recommendCategoryBudget(category: string, samples: ExpenseSample[], flexibleMoney: number, mode: BudgetMode) {
  const values = samples.filter((sample) => sample.category === category && sample.amount > 0).map((sample) => sample.amount);
  const historical = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : flexibleMoney * (ESSENTIAL_FLOOR[category] || .07);
  const floor = flexibleMoney * (ESSENTIAL_FLOOR[category] || .02);
  return Math.max(0, Math.round(Math.max(floor, historical * MODE_FACTOR[mode]) * 100) / 100);
}

const DEFAULT_SHARE: Record<string, number> = { Food: .28, Transportation: .17, Shopping: .14, Personal: .11, Entertainment: .1, Home: .08, Health: .07, Insurance: .05 };

export function recommendBudgetAllocation(categories: string[], samples: ExpenseSample[], spendingMoney: number) {
  if (!categories.length || spendingMoney <= 0) return new Map(categories.map((category) => [category, 0]));
  const rawWeights = categories.map((category) => {
    const values = samples.filter((sample) => sample.category === category && sample.amount > 0).map((sample) => sample.amount);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : (DEFAULT_SHARE[category] || .04) * spendingMoney;
  });
  const totalWeight = rawWeights.reduce((sum, value) => sum + value, 0) || categories.length;
  let assignedCents = 0;
  return new Map(categories.map((category, index) => {
    const cents = index === categories.length - 1 ? Math.max(0, Math.round(spendingMoney * 100) - assignedCents) : Math.max(0, Math.round(spendingMoney * rawWeights[index] / totalWeight * 100));
    assignedCents += cents;
    return [category, cents / 100];
  }));
}

export function budgetStatus(spent: number, limit: number) {
  const ratio = limit > 0 ? spent / limit : 0;
  return { ratio, remaining: limit - spent, tone: ratio >= 1 ? 'danger' : ratio >= .8 ? 'warning' : 'healthy' } as const;
}
