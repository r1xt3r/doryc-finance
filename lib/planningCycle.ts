export const PLANNING_ROLLOVER_DAY = 19;

export function planningMonthKey(dateValue: string | Date) {
  const date = typeof dateValue === 'string' ? new Date(`${dateValue.slice(0, 10)}T12:00:00`) : new Date(dateValue);
  if (date.getDate() >= PLANNING_ROLLOVER_DAY) date.setMonth(date.getMonth() + 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function belongsToPlanningWindow(dueDate: string, planningMonth: string) {
  return dueDate.slice(0, 7) <= planningMonth;
}
