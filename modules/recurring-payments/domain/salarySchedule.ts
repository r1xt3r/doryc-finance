export type SalaryWindow = { nominal: string; earliest: string; latest: string; flexible: boolean };

function iso(date: Date) { return date.toISOString().slice(0, 10); }

export function monthEnd(value: string, earlyMeansPrevious = false) {
  const date = new Date(`${value}T12:00:00Z`);
  const monthOffset = earlyMeansPrevious && date.getUTCDate() <= 3 ? 0 : 1;
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 0, 12)));
}

export function nextMonthEnd(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0, 12)));
}

export function previousMonthEnd(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0, 12)));
}

export function isSalary(item: { name?: string; category?: string | null; payment_method?: string | null }) {
  return item.payment_method === 'Recurring Income' && (item.category === 'Salary' || /salary|sueldo/i.test(item.name || ''));
}

export function salaryPaymentWindow(value: string): SalaryWindow {
  const nominal = new Date(`${value}T12:00:00Z`);
  const day = nominal.getUTCDay();
  if (day !== 0 && day !== 6) return { nominal: value, earliest: value, latest: value, flexible: false };
  const friday = new Date(nominal);
  friday.setUTCDate(nominal.getUTCDate() - (day === 0 ? 2 : 1));
  const monday = new Date(nominal);
  monday.setUTCDate(nominal.getUTCDate() + (day === 0 ? 1 : 2));
  return { nominal: value, earliest: iso(friday), latest: iso(monday), flexible: true };
}
