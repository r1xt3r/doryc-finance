export type BalanceAccount = { id: string; starting_balance_cents: number };
export type BalanceTransaction = { type: 'expense' | 'income' | 'transfer'; amount_cents: number; from_account_id: string | null; to_account_id: string | null };
export type BalanceLoan = { id: string; direction: 'i_owe' | 'owed_to_me'; amount_cents: number; account_id: string | null };
export type BalanceLoanEntry = { personal_loan_id: string; account_id: string; amount_cents: number; entry_type: 'payment' | 'advance' };

export function calculateAccountBalances(accounts: BalanceAccount[], transactions: BalanceTransaction[], loans: BalanceLoan[], loanEntries: BalanceLoanEntry[]) {
  const balances = new Map(accounts.map((account) => [account.id, account.starting_balance_cents]));
  const apply = (accountId: string | null, delta: number) => { if (accountId && balances.has(accountId)) balances.set(accountId, (balances.get(accountId) || 0) + delta); };
  for (const transaction of transactions) {
    if (transaction.type === 'income') apply(transaction.to_account_id, transaction.amount_cents);
    if (transaction.type === 'expense') apply(transaction.from_account_id, -transaction.amount_cents);
    if (transaction.type === 'transfer') { apply(transaction.from_account_id, -transaction.amount_cents); apply(transaction.to_account_id, transaction.amount_cents); }
  }
  const loansById = new Map(loans.map((loan) => [loan.id, loan]));
  const advances = new Map<string, number>();
  for (const entry of loanEntries) if (entry.entry_type === 'advance') advances.set(entry.personal_loan_id, (advances.get(entry.personal_loan_id) || 0) + entry.amount_cents);
  for (const loan of loans) { const principal = Math.max(0, loan.amount_cents - (advances.get(loan.id) || 0)); apply(loan.account_id, loan.direction === 'i_owe' ? principal : -principal); }
  for (const entry of loanEntries) { const loan = loansById.get(entry.personal_loan_id); if (!loan) continue; const incoming = entry.entry_type === 'advance' ? loan.direction === 'i_owe' : loan.direction === 'owed_to_me'; apply(entry.account_id, incoming ? entry.amount_cents : -entry.amount_cents); }
  return balances;
}
