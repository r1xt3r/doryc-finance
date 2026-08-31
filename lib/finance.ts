export type InstallmentPurchase = {
  amount: number;
  installmentMonths: number;
  installmentsPaid: number;
  withInterest: boolean;
};

export function nextMonthlyDate(day: number | null, today: string) {
  if (!day) return today;
  const current = new Date(`${today}T12:00:00`);
  const targetMonth = current.getMonth() + (day <= current.getDate() ? 1 : 0);
  const lastDay = new Date(current.getFullYear(), targetMonth + 1, 0).getDate();
  const result = new Date(current.getFullYear(), targetMonth, Math.min(day, lastDay), 12);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
}

export function cardPurchaseDueDate(purchaseDate: string, statementDay: number | null, paymentDay: number | null) {
  if (!statementDay || !paymentDay) return purchaseDate;
  const purchase = new Date(`${purchaseDate}T12:00:00`);
  const closingMonth = purchase.getMonth() + (purchase.getDate() > statementDay ? 1 : 0);
  const closingLastDay = new Date(purchase.getFullYear(), closingMonth + 1, 0).getDate();
  const closing = new Date(purchase.getFullYear(), closingMonth, Math.min(statementDay, closingLastDay), 12);
  const dueMonth = closing.getMonth() + (paymentDay <= closing.getDate() ? 1 : 0);
  const dueLastDay = new Date(closing.getFullYear(), dueMonth + 1, 0).getDate();
  const due = new Date(closing.getFullYear(), dueMonth, Math.min(paymentDay, dueLastDay), 12);
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
}

export function estimateCardPayment(currentStatement: number, annualRate: number, purchases: InstallmentPurchase[]) {
  return currentStatement + purchases.reduce((sum, purchase) => {
    if (purchase.installmentMonths <= 1) return sum + purchase.amount;
    if (!purchase.withInterest) return sum + purchase.amount / purchase.installmentMonths;
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    const remainingMonths = Math.max(1, purchase.installmentMonths - (purchase.installmentsPaid || 0));
    const remainingPrincipal = purchase.amount * remainingMonths / purchase.installmentMonths;
    if (monthlyRate <= 0) return sum + remainingPrincipal / remainingMonths;
    return sum + remainingPrincipal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -remainingMonths));
  }, 0);
}
