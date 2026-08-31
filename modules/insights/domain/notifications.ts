export type FinanceNotification = { id: string; tone: 'info' | 'warning' | 'success'; title: string; detail: string; target: 'payments' | 'credit' | 'accounts' };

export function buildFinanceNotifications(input: { fundingNeeded: number; creditUtilization: number; nextDueDays: number | null; potentialSavings: number }): FinanceNotification[] {
  const items: FinanceNotification[] = [];
  if (input.fundingNeeded > 0) items.push({ id: 'funding', tone: 'warning', title: 'Payments need funding', detail: `$${input.fundingNeeded.toFixed(2)} is still needed for scheduled commitments.`, target: 'payments' });
  else items.push({ id: 'covered', tone: 'success', title: 'Commitments are covered', detail: 'Your available money can cover the current plan.', target: 'payments' });
  if (input.creditUtilization > 50) items.push({ id: 'credit', tone: 'warning', title: 'Credit usage is elevated', detail: `${Math.round(input.creditUtilization)}% of your total limit is currently used.`, target: 'credit' });
  if (input.nextDueDays !== null && input.nextDueDays <= 2) items.push({ id: 'due', tone: 'info', title: 'A payment is approaching', detail: input.nextDueDays <= 0 ? 'A commitment is due today or overdue.' : `Your next commitment is due in ${input.nextDueDays} day${input.nextDueDays === 1 ? '' : 's'}.`, target: 'payments' });
  if (input.potentialSavings > 0) items.push({ id: 'savings', tone: 'success', title: 'Savings opportunity', detail: `You could reserve $${input.potentialSavings.toFixed(2)} after current commitments.`, target: 'accounts' });
  return items.slice(0, 4);
}
