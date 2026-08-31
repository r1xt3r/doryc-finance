import { isSalary, monthEnd } from '../domain/salarySchedule';
import type { RecurringPaymentRepository } from './ports/RecurringPaymentRepository';

type SchedulableIncome = { id: string; name: string; category: string | null; payment_method: string | null; next_due_date: string; paid_this_cycle: boolean };

export async function normalizeSalarySchedules<T extends SchedulableIncome>(items: T[], repository: RecurringPaymentRepository) {
  return Promise.all(items.map(async (item) => {
    if (!isSalary(item)) return item;
    const normalized = monthEnd(item.next_due_date, !item.paid_this_cycle);
    if (normalized === item.next_due_date) return item;
    return await repository.updateDueDate(item.id, normalized) ? { ...item, next_due_date: normalized } : item;
  }));
}
