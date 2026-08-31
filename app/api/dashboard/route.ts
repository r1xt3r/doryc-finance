import { createClient } from '../../../lib/supabase/server';
import { isSalary, monthEnd, nextMonthEnd, previousMonthEnd } from '../../../modules/recurring-payments/domain/salarySchedule';
import { normalizeSalarySchedules } from '../../../modules/recurring-payments/application/normalizeSalarySchedules';
import { addMonthsClamped, cardPurchaseDueDate } from '../../../lib/finance';
import { calculateAccountBalances } from '../../../modules/accounts/domain/calculateAccountBalances';

export const dynamic = 'force-dynamic';

type AccountRow = { id: string; name: string; bank: string; account_type: string; starting_balance_cents: number };
type TransactionRow = { id: string; type: 'expense' | 'income' | 'transfer'; description: string; amount_cents: number; transaction_date: string; from_account_id: string | null; to_account_id: string | null; category: string | null; payment_method: string | null; created_at: string };
type RecurringRow = { id: string; name: string; amount_cents: number; next_due_date: string; pay_from_account_id: string; category: string | null; payment_method: string | null; paid_this_cycle: boolean };
type CreditCardRow = { id: string; name: string; bank: string; credit_limit_cents: number; opening_used_cents: number; current_statement_cents: number; annual_effective_rate: number; payment_day: number | null; statement_day: number | null; network: string; pay_from_account_id: string | null };
type CardPurchaseRow = { id: string; credit_card_id: string; description: string; amount_cents: number; purchase_date: string; category: string | null; installment_months: number; installments_paid: number; with_interest: boolean };
type CardPaymentRow = { id: string; credit_card_id: string; from_account_id: string; amount_cents: number; payment_date: string; note: string | null };
type PersonalLoanRow = { id: string; direction: 'i_owe' | 'owed_to_me'; person_name: string; amount_cents: number; paid_cents: number; account_id: string | null; due_date: string | null; note: string | null; status: 'open' | 'settled'; created_at: string | null };
type LoanPaymentRow = { id: string; personal_loan_id: string; account_id: string; amount_cents: number; payment_date: string; entry_type: 'payment' | 'advance' };
type BankLoanRow = { id: string; bank: string; name: string; original_amount_cents: number; outstanding_balance_cents: number; installment_cents: number; next_due_date: string; payment_day: number; total_installments: number; paid_installments: number; annual_rate: number | null; pay_from_account_id: string | null; active: boolean };
const BANK_CARD_RATES: Record<string, number> = { pichincha: 16.77, produbanco: 16.77, pacifico: 16.77, guayaquil: 16.77 };


async function requireUser(authorization?: string | null) {
  const supabase = await createClient(authorization);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    console.error('Dashboard authentication failed:', error?.message || 'No active user');
    return { supabase, user: null };
  }
  return { supabase, user };
}

async function getDashboard(authorization?: string | null) {
  const { supabase, user } = await requireUser(authorization);
  if (!user) return null;
  const [accountQuery, transactionQuery, recurringQuery, cardQuery, cardPurchaseQuery, cardPaymentQuery, personalLoanQuery, loanPaymentQuery, preferenceQuery, bankLoanQuery] = await Promise.all([
    supabase.from('accounts').select('id,name,bank,account_type,starting_balance_cents').eq('active', true).order('created_at'),
    supabase.from('transactions').select('id,type,description,amount_cents,transaction_date,from_account_id,to_account_id,category,payment_method,created_at').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('recurring_payments').select('id,name,amount_cents,next_due_date,pay_from_account_id,category,payment_method,paid_this_cycle').eq('active', true).order('next_due_date'),
    supabase.from('credit_cards').select('id,name,bank,credit_limit_cents,opening_used_cents,current_statement_cents,annual_effective_rate,payment_day,statement_day,network,pay_from_account_id').eq('active', true).order('created_at'),
    supabase.from('credit_card_purchases').select('id,credit_card_id,description,amount_cents,purchase_date,category,installment_months,installments_paid,with_interest').eq('active', true).order('purchase_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('credit_card_payments').select('id,credit_card_id,from_account_id,amount_cents,payment_date,note').order('payment_date', { ascending: false }),
    supabase.from('personal_loans').select('id,direction,person_name,amount_cents,paid_cents,account_id,due_date,note,status,created_at').order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('personal_loan_payments').select('id,personal_loan_id,account_id,amount_cents,payment_date,entry_type').order('payment_date', { ascending: false }),
    supabase.from('user_preferences').select('onboarding_completed').maybeSingle(),
    supabase.from('bank_loans').select('id,bank,name,original_amount_cents,outstanding_balance_cents,installment_cents,next_due_date,payment_day,total_installments,paid_installments,annual_rate,pay_from_account_id,active').eq('active', true).order('next_due_date'),
  ]);
  if (accountQuery.error) throw accountQuery.error;
  if (transactionQuery.error) throw transactionQuery.error;
  if (recurringQuery.error) throw recurringQuery.error;
  const recurringRows = normalizeSalarySchedules(recurringQuery.data as RecurringRow[]);
  let cardRows = cardQuery.data as CreditCardRow[] | null;
  let cardPurchaseRows = cardPurchaseQuery.data as CardPurchaseRow[] | null;
  if (cardQuery.error) console.error('Credit card query failed:', cardQuery.error.message);
  if (cardPurchaseQuery.error) console.error('Card purchase query failed:', cardPurchaseQuery.error.message);
  if (cardQuery.error) {
    const fallback = await supabase.from('credit_cards').select('id,name,bank,credit_limit_cents,opening_used_cents,current_statement_cents,annual_effective_rate,payment_day,network,pay_from_account_id').eq('active', true).order('created_at');
    if (fallback.error) console.error('Credit card fallback failed:', fallback.error.message);
    cardRows = (fallback.data || []).map((card) => ({ ...card, statement_day: null, network: card.network || 'Visa', pay_from_account_id: card.pay_from_account_id || null })) as CreditCardRow[];
  }
  if (cardPurchaseQuery.error) {
    const fallback = await supabase.from('credit_card_purchases').select('id,credit_card_id,description,amount_cents,purchase_date,category,installment_months,with_interest').order('purchase_date', { ascending: false }).order('created_at', { ascending: false });
    if (fallback.error) console.error('Card purchase fallback failed:', fallback.error.message);
    cardPurchaseRows = (fallback.data || []).map((purchase) => ({ ...purchase, installments_paid: 0 })) as CardPurchaseRow[];
  }
  const transactions = transactionQuery.data as TransactionRow[];
  const monthParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const currentMonth = `${monthParts.find((part) => part.type === 'year')?.value}-${monthParts.find((part) => part.type === 'month')?.value}`;
  const cardPayments = cardPaymentQuery.error ? [] : cardPaymentQuery.data as CardPaymentRow[];
  let personalLoans = personalLoanQuery.data as PersonalLoanRow[] | null;
  if (personalLoanQuery.error) {
    console.error('Personal loan query failed:', personalLoanQuery.error.message);
    const fallback = await supabase.from('personal_loans').select('id,direction,person_name,amount_cents,due_date,note,status,created_at').order('due_date', { ascending: true, nullsFirst: false });
    if (fallback.error) console.error('Personal loan fallback failed:', fallback.error.message);
    personalLoans = (fallback.data || []).map((loan) => ({ ...loan, paid_cents: 0, account_id: null })) as PersonalLoanRow[];
  }
  personalLoans ||= [];
  let loanPayments = loanPaymentQuery.data as LoanPaymentRow[] | null;
  if (loanPaymentQuery.error) {
    const fallback = await supabase.from('personal_loan_payments').select('id,personal_loan_id,account_id,amount_cents,payment_date').order('payment_date', { ascending: false });
    loanPayments = (fallback.data || []).map((payment) => ({ ...payment, entry_type: 'payment' })) as LoanPaymentRow[];
  }
  loanPayments ||= [];
  const loanById = new Map(personalLoans.map((loan) => [loan.id, loan]));
  const advancesByLoan = new Map<string, number>();
  for (const payment of loanPayments) {
    if (payment.entry_type === 'advance') advancesByLoan.set(payment.personal_loan_id, (advancesByLoan.get(payment.personal_loan_id) || 0) + payment.amount_cents);
  }
  const balanceByAccount = calculateAccountBalances(accountQuery.data as AccountRow[], transactions, personalLoans, loanPayments);
  const accounts = (accountQuery.data as AccountRow[]).map((account) => ({ id: account.id, name: account.name, bank: account.bank, accountType: account.account_type, startingBalance: account.starting_balance_cents / 100, balance: (balanceByAccount.get(account.id) || 0) / 100 }));
  const debtMovements = [
    ...personalLoans.map((loan) => {
      const amountCents = Math.max(0, loan.amount_cents - (advancesByLoan.get(loan.id) || 0));
      const incoming = loan.direction === 'i_owe';
      return { id: `debt-loan-${loan.id}`, type: incoming ? 'income' as const : 'expense' as const, description: incoming ? `Borrowed from ${loan.person_name}` : `Lent to ${loan.person_name}`, amount_cents: amountCents, transaction_date: loan.created_at?.slice(0, 10) || loan.due_date || new Date().toISOString().slice(0, 10), from_account_id: incoming ? null : loan.account_id, to_account_id: incoming ? loan.account_id : null, category: 'Debt movement', payment_method: 'Personal IOU', created_at: loan.created_at || '', debtMovement: true };
    }).filter((movement) => movement.amount_cents > 0),
    ...loanPayments.filter((payment) => loanById.has(payment.personal_loan_id)).map((payment) => {
      const loan = loanById.get(payment.personal_loan_id)!;
      const incoming = payment.entry_type === 'advance' ? loan.direction === 'i_owe' : loan.direction === 'owed_to_me';
      const description = payment.entry_type === 'advance' ? (incoming ? `Borrowed more from ${loan.person_name}` : `Lent more to ${loan.person_name}`) : (incoming ? `Repayment received from ${loan.person_name}` : `Debt repayment to ${loan.person_name}`);
      return { id: `debt-entry-${payment.id}`, type: incoming ? 'income' as const : 'expense' as const, description, amount_cents: payment.amount_cents, transaction_date: payment.payment_date, from_account_id: incoming ? null : payment.account_id, to_account_id: incoming ? payment.account_id : null, category: 'Debt movement', payment_method: 'Personal IOU', created_at: payment.payment_date, debtMovement: true };
    }),
  ];
  const cashFlowTransactions = [
    ...transactions.map((tx) => ({ ...tx, debtMovement: false })),
    ...debtMovements,
  ].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || b.created_at.localeCompare(a.created_at));
  return {
    name: String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Richard').split(' ')[0],
    accounts,
    transactions: cashFlowTransactions.map((tx) => ({ ...tx, date: tx.transaction_date, amount: tx.amount_cents / 100 })),
    recurring: recurringRows.map((item) => ({ ...item, amount: item.amount_cents / 100, flowType: item.payment_method === 'Recurring Income' ? 'income' : 'expense' })),
    creditCards: (cardRows || []).map((card) => ({
      id: card.id, name: card.name, bank: card.bank, creditLimit: card.credit_limit_cents / 100,
      openingUsed: card.opening_used_cents / 100, currentStatement: card.current_statement_cents / 100,
      annualRate: Number(card.annual_effective_rate), paymentDay: card.payment_day, statementDay: card.statement_day, network: card.network, payFromAccountId: card.pay_from_account_id,
    })),
    personalLoans: personalLoans.map((loan) => ({ id: loan.id, direction: loan.direction, personName: loan.person_name, amount: loan.amount_cents / 100, paid: loan.paid_cents / 100, accountId: loan.account_id, dueDate: loan.due_date, note: loan.note, status: loan.status })),
    personalLoanPayments: loanPayments.map((payment) => ({ id: payment.id, personalLoanId: payment.personal_loan_id, accountId: payment.account_id, amount: payment.amount_cents / 100, date: payment.payment_date, entryType: payment.entry_type || 'payment' })),
    bankLoans: bankLoanQuery.error ? [] : (bankLoanQuery.data as BankLoanRow[]).map((loan) => ({ id: loan.id, bank: loan.bank, name: loan.name, originalAmount: loan.original_amount_cents / 100, outstandingBalance: loan.outstanding_balance_cents / 100, installment: loan.installment_cents / 100, nextDueDate: loan.next_due_date, paymentDay: loan.payment_day, totalInstallments: loan.total_installments, paidInstallments: loan.paid_installments, annualRate: loan.annual_rate === null ? null : Number(loan.annual_rate), payFromAccountId: loan.pay_from_account_id })),
    cardPurchases: (cardPurchaseRows || []).map((purchase) => ({
      id: purchase.id, creditCardId: purchase.credit_card_id, description: purchase.description,
      amount: purchase.amount_cents / 100, date: purchase.purchase_date, category: purchase.category,
      installmentMonths: purchase.installment_months, installmentsPaid: purchase.installments_paid, withInterest: purchase.with_interest,
    })),
    cardPayments: cardPayments.map((payment) => ({ id: payment.id, creditCardId: payment.credit_card_id, fromAccountId: payment.from_account_id, amount: payment.amount_cents / 100, date: payment.payment_date, note: payment.note })),
    onboardingCompleted: Boolean(preferenceQuery.data?.onboarding_completed),
    income: transactions.filter((tx) => tx.type === 'income' && tx.transaction_date.startsWith(currentMonth)).reduce((sum, tx) => sum + tx.amount_cents, 0) / 100,
    spent: transactions.filter((tx) => tx.type === 'expense' && tx.transaction_date.startsWith(currentMonth)).reduce((sum, tx) => sum + tx.amount_cents, 0) / 100,
  };
}

export async function GET(request: Request) {
  try {
    const data = await getDashboard(request.headers.get('authorization'));
    return data ? Response.json(data) : Response.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Unable to load your financial data.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    const { supabase, user } = await requireUser(authorization);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    let validationSnapshot: Awaited<ReturnType<typeof getDashboard>> | undefined;
    async function hasFunds(accountId: string, amountCents: number) {
      const snapshot = validationSnapshot ||= await getDashboard(authorization);
      const account = snapshot?.accounts.find((item) => item.id === accountId);
      return Boolean(account && Math.round(account.balance * 100) >= amountCents);
    }
    const body = await request.json() as Record<string, string>;
    if (body.entity === 'accountUpdate') {
      const balanceCents = Math.round(Number(body.balance || 0) * 100);
      if (!body.id || !body.name?.trim() || !body.bank?.trim() || !body.accountType?.trim() || !Number.isFinite(balanceCents)) return Response.json({ error: 'Complete the account information.' }, { status: 400 });
      const snapshot = await getDashboard(authorization);
      const currentAccount = snapshot?.accounts.find((account) => account.id === body.id);
      if (!currentAccount) return Response.json({ error: 'Account not found.' }, { status: 404 });
      const currentBalanceCents = Math.round(currentAccount.balance * 100);
      const adjustmentCents = balanceCents - currentBalanceCents;
      const { error: updateError } = await supabase.from('accounts').update({ name: body.name.trim(), bank: body.bank.trim(), account_type: body.accountType }).eq('id', body.id);
      if (updateError) throw updateError;
      if (adjustmentCents !== 0) {
        const { error: adjustmentError } = await supabase.from('transactions').insert({ user_id: user.id, type: adjustmentCents > 0 ? 'income' : 'expense', description: 'Balance adjustment', amount_cents: Math.abs(adjustmentCents), transaction_date: new Date().toISOString().slice(0, 10), from_account_id: adjustmentCents < 0 ? body.id : null, to_account_id: adjustmentCents > 0 ? body.id : null, category: 'Balance adjustment', payment_method: 'Manual adjustment' });
        if (adjustmentError) throw adjustmentError;
      }
      return Response.json(await getDashboard(authorization));
    }
    if (body.entity === 'transactionUpdate') {
      const type = body.type?.toLowerCase();
      const amountCents = Math.round(Number(body.amount) * 100);
      if (!body.id || !['expense', 'income', 'transfer'].includes(type) || !body.description?.trim() || amountCents <= 0 || !body.date) return Response.json({ error: 'Complete the movement information.' }, { status: 400 });
      if (type === 'expense' || type === 'transfer') {
        const [{ data: previous }, snapshot] = await Promise.all([
          supabase.from('transactions').select('type,amount_cents,from_account_id,to_account_id').eq('id', body.id).single(),
          getDashboard(authorization),
        ]);
        const source = snapshot?.accounts.find((account) => account.id === body.fromAccountId);
        let availableCents = Math.round((source?.balance || 0) * 100);
        if (previous?.from_account_id === body.fromAccountId && (previous.type === 'expense' || previous.type === 'transfer')) availableCents += previous.amount_cents;
        if (previous?.to_account_id === body.fromAccountId && (previous.type === 'income' || previous.type === 'transfer')) availableCents -= previous.amount_cents;
        if (!source || availableCents < amountCents) return Response.json({ error: 'Insufficient funds in the selected account.' }, { status: 400 });
      }
      const { error: updateError } = await supabase.from('transactions').update({ type, description: body.description.trim(), amount_cents: amountCents, transaction_date: body.date, from_account_id: body.fromAccountId || null, to_account_id: body.toAccountId || null, category: body.category || null, payment_method: body.paymentMethod || null }).eq('id', body.id);
      if (updateError) throw updateError;
      return Response.json(await getDashboard(authorization));
    }
    if (body.entity === 'recurringUpdate') {
      const amountCents = Math.round(Number(body.amount) * 100);
      const flowType = body.flowType === 'income' ? 'income' : 'expense';
      const accountId = flowType === 'income' ? body.toAccountId : body.fromAccountId;
      if (!body.id || !body.description?.trim() || amountCents <= 0 || !body.date || !accountId) return Response.json({ error: 'Complete the recurring payment information.' }, { status: 400 });
      const nextDueDate = flowType === 'income' && (body.category === 'Salary' || /salary|sueldo/i.test(body.description)) ? monthEnd(body.date) : body.date;
      const { error: updateError } = await supabase.from('recurring_payments').update({ name: body.description.trim(), amount_cents: amountCents, next_due_date: nextDueDate, pay_from_account_id: accountId, category: body.category || null, payment_method: flowType === 'income' ? 'Recurring Income' : body.paymentMethod || null }).eq('id', body.id);
      if (updateError) throw updateError;
      return Response.json(await getDashboard(authorization));
    }
    if (body.entity === 'account') {
      const balanceCents = Math.round(Number(body.balance || 0) * 100);
      if (!body.name?.trim() || !body.bank?.trim() || !body.accountType?.trim() || !Number.isFinite(balanceCents)) return Response.json({ error: 'Complete the account information.' }, { status: 400 });
      const { error: insertError } = await supabase.from('accounts').insert({ user_id: user.id, name: body.name.trim(), bank: body.bank.trim(), account_type: body.accountType, starting_balance_cents: balanceCents });
      if (insertError) throw insertError;
      return Response.json(await getDashboard(authorization), { status: 201 });
    }
    if (body.entity === 'bankLoan') {
      const outstandingCents = Math.round(Number(body.outstandingBalance) * 100);
      const installmentCents = Math.round(Number(body.installment) * 100);
      const originalCents = Math.round(Number(body.originalAmount || body.outstandingBalance) * 100);
      const paymentDay = body.nextDueDate ? Number(body.nextDueDate.slice(-2)) : 0;
      if (!body.bank || !body.name?.trim() || outstandingCents < 0 || installmentCents <= 0 || !body.nextDueDate || !paymentDay || !Number(body.totalInstallments)) return Response.json({ error: 'Complete the bank loan information.' }, { status: 400 });
      const { error: insertError } = await supabase.from('bank_loans').insert({ user_id: user.id, bank: body.bank, name: body.name.trim(), original_amount_cents: originalCents, outstanding_balance_cents: outstandingCents, installment_cents: installmentCents, next_due_date: body.nextDueDate, payment_day: paymentDay, total_installments: Number(body.totalInstallments), paid_installments: Number(body.paidInstallments || 0), annual_rate: body.annualRate ? Number(body.annualRate) : null, pay_from_account_id: body.payFromAccountId || null });
      if (insertError) throw insertError;
      return Response.json(await getDashboard(authorization), { status: 201 });
    }
    if (body.entity === 'creditCard') {
      const creditLimitCents = Math.round(Number(body.creditLimit) * 100);
      const usedCents = Math.round(Number(body.openingUsed || 0) * 100);
      const statementCents = Math.round(Number(body.currentStatement || 0) * 100);
      if (!body.name?.trim() || !body.bank?.trim() || creditLimitCents <= 0 || usedCents < 0 || usedCents > creditLimitCents) return Response.json({ error: 'Check the card limit and used balance.' }, { status: 400 });
      const bankKey = body.bank.trim().toLowerCase().replace('banco ', '');
      const bankRate = BANK_CARD_RATES[bankKey] ?? 16.77;
      const { error: insertError } = await supabase.from('credit_cards').insert({ user_id: user.id, name: body.name.trim(), bank: body.bank.trim(), credit_limit_cents: creditLimitCents, opening_used_cents: usedCents, current_statement_cents: statementCents, annual_effective_rate: bankRate, payment_day: Number(body.paymentDay) || null, statement_day: Number(body.statementDay) || null, network: body.network || 'Visa', pay_from_account_id: body.payFromAccountId || null });
      if (insertError) throw insertError;
      return Response.json(await getDashboard(authorization), { status: 201 });
    }
    if (body.entity === 'creditCardStatement') {
      const hasStatementAmount = body.currentStatement !== undefined && body.currentStatement !== '';
      const statementCents = hasStatementAmount ? Math.round(Number(body.currentStatement) * 100) : null;
      if (!body.creditCardId || (statementCents !== null && (!Number.isFinite(statementCents) || statementCents < 0))) return Response.json({ error: 'Enter a valid statement amount.' }, { status: 400 });
      const update: Record<string, string | number | null> = {};
      if (statementCents !== null) update.current_statement_cents = statementCents;
      if (body.payFromAccountId) update.pay_from_account_id = body.payFromAccountId;
      if (body.network) update.network = body.network;
      if (body.paymentDay) update.payment_day = Number(body.paymentDay);
      if (body.statementDay) update.statement_day = Number(body.statementDay);
      if (body.creditLimit) update.credit_limit_cents = Math.round(Number(body.creditLimit) * 100);
      const { error: updateError } = await supabase.from('credit_cards').update(update).eq('id', body.creditCardId);
      if (updateError) throw updateError;
      return Response.json(await getDashboard(authorization));
    }
    if (body.entity === 'personalLoan') {
      const amountCents = Math.round(Number(body.amount) * 100);
      if (!['i_owe', 'owed_to_me'].includes(body.direction) || !body.personName?.trim() || amountCents <= 0) return Response.json({ error: 'Complete the loan information.' }, { status: 400 });
      if (body.direction === 'owed_to_me' && body.accountId && !await hasFunds(body.accountId, amountCents)) return Response.json({ error: 'Insufficient funds in the selected account.' }, { status: 400 });
      const { error: insertError } = await supabase.from('personal_loans').insert({ user_id: user.id, direction: body.direction, person_name: body.personName.trim(), amount_cents: amountCents, account_id: body.accountId || null, due_date: body.dueDate || null, note: body.note?.trim() || null });
      if (insertError) throw insertError;
      return Response.json(await getDashboard(authorization), { status: 201 });
    }
    if (body.entity === 'creditCardPayment') {
      const amountCents = Math.round(Number(body.amount) * 100);
      if (!body.creditCardId || !body.fromAccountId || amountCents <= 0 || !body.date) return Response.json({ error: 'Complete the card payment.' }, { status: 400 });
      const { error: atomicError } = await supabase.rpc('doryc_pay_credit_card', { p_card_id: body.creditCardId, p_account_id: body.fromAccountId, p_amount_cents: amountCents, p_payment_date: body.date, p_note: body.note || null });
      if (!atomicError) return Response.json(await getDashboard(authorization), { status: 201 });
      if (atomicError.code !== 'PGRST202') throw atomicError;
      if (!await hasFunds(body.fromAccountId, amountCents)) return Response.json({ error: 'Insufficient funds in the selected account.' }, { status: 400 });
      const { error: paymentError } = await supabase.from('credit_card_payments').insert({ user_id: user.id, credit_card_id: body.creditCardId, from_account_id: body.fromAccountId, amount_cents: amountCents, payment_date: body.date, note: body.note || null });
      if (paymentError) throw paymentError;
      const { data: card } = await supabase.from('credit_cards').select('current_statement_cents,statement_day,payment_day').eq('id', body.creditCardId).single();
      if (card) {
        await supabase.from('credit_cards').update({ current_statement_cents: Math.max(0, card.current_statement_cents - amountCents) }).eq('id', body.creditCardId);
        if (card.current_statement_cents > 0 && amountCents >= card.current_statement_cents) {
          const { data: installments } = await supabase.from('credit_card_purchases').select('id,purchase_date,installment_months,installments_paid').eq('credit_card_id', body.creditCardId).eq('active', true).gt('installment_months', 1);
          const dueInstallments = (installments || []).filter((item) => item.installments_paid < item.installment_months && addMonthsClamped(cardPurchaseDueDate(item.purchase_date, card.statement_day, card.payment_day), item.installments_paid) <= body.date);
          await Promise.all(dueInstallments.map((item) => supabase.from('credit_card_purchases').update({ installments_paid: item.installments_paid + 1 }).eq('id', item.id)));
        }
      }
      await supabase.from('transactions').insert({ user_id: user.id, type: 'expense', description: body.note || 'Credit card payment', amount_cents: amountCents, transaction_date: body.date, from_account_id: body.fromAccountId, to_account_id: null, category: 'Credit card', payment_method: 'Bank Transfer' });
      return Response.json(await getDashboard(authorization), { status: 201 });
    }
    if (body.entity === 'bankLoanPayment') {
      const amountCents = Math.round(Number(body.amount) * 100);
      if (!body.bankLoanId || !body.fromAccountId || amountCents <= 0 || !body.date) return Response.json({ error: 'Complete the bank loan payment.' }, { status: 400 });
      const { error: atomicError } = await supabase.rpc('doryc_pay_bank_loan', { p_loan_id: body.bankLoanId, p_account_id: body.fromAccountId, p_amount_cents: amountCents, p_payment_date: body.date });
      if (!atomicError) return Response.json(await getDashboard(authorization), { status: 201 });
      if (atomicError.code !== 'PGRST202') throw atomicError;
      if (!await hasFunds(body.fromAccountId, amountCents)) return Response.json({ error: 'Insufficient funds in the selected account.' }, { status: 400 });
      const { data: loan, error: loanError } = await supabase.from('bank_loans').select('name,outstanding_balance_cents,installment_cents,paid_installments,total_installments,next_due_date').eq('id', body.bankLoanId).single();
      if (loanError || !loan) return Response.json({ error: 'Bank loan not found.' }, { status: 404 });
      const paidCents = Math.min(amountCents, loan.outstanding_balance_cents);
      const coversInstallment = paidCents >= Math.min(loan.outstanding_balance_cents, loan.installment_cents);
      const nextDueDate = coversInstallment ? addMonthsClamped(loan.next_due_date) : loan.next_due_date;
      const { error: updateError } = await supabase.from('bank_loans').update({ outstanding_balance_cents: Math.max(0, loan.outstanding_balance_cents - paidCents), paid_installments: coversInstallment ? Math.min(loan.total_installments, loan.paid_installments + 1) : loan.paid_installments, next_due_date: nextDueDate, pay_from_account_id: body.fromAccountId }).eq('id', body.bankLoanId);
      if (updateError) throw updateError;
      const { error: transactionError } = await supabase.from('transactions').insert({ user_id: user.id, type: 'expense', description: `${loan.name} installment`, amount_cents: paidCents, transaction_date: body.date, from_account_id: body.fromAccountId, to_account_id: null, category: 'Loan', payment_method: 'Automatic Debit' });
      if (transactionError) throw transactionError;
      return Response.json(await getDashboard(authorization), { status: 201 });
    }
    if (body.entity === 'personalLoanPayment') {
      const amountCents = Math.round(Number(body.amount) * 100);
      if (!body.personalLoanId || !body.accountId || amountCents <= 0 || !body.date) return Response.json({ error: 'Complete the loan payment.' }, { status: 400 });
      const { error: atomicError } = await supabase.rpc('doryc_pay_personal_loan', { p_loan_id: body.personalLoanId, p_account_id: body.accountId, p_amount_cents: amountCents, p_payment_date: body.date });
      if (!atomicError) return Response.json(await getDashboard(authorization), { status: 201 });
      if (atomicError.code !== 'PGRST202') throw atomicError;
      const { data: loan, error: loanError } = await supabase.from('personal_loans').select('amount_cents,paid_cents').eq('id', body.personalLoanId).single();
      if (loanError || !loan || loan.paid_cents + amountCents > loan.amount_cents) return Response.json({ error: 'Payment exceeds the remaining amount.' }, { status: 400 });
      const { data: loanDirection } = await supabase.from('personal_loans').select('direction').eq('id', body.personalLoanId).single();
      if (loanDirection?.direction === 'i_owe' && !await hasFunds(body.accountId, amountCents)) return Response.json({ error: 'Insufficient funds in the selected account.' }, { status: 400 });
      const { error: paymentError } = await supabase.from('personal_loan_payments').insert({ user_id: user.id, personal_loan_id: body.personalLoanId, account_id: body.accountId, amount_cents: amountCents, payment_date: body.date });
      if (paymentError) throw paymentError;
      const paidCents = loan.paid_cents + amountCents;
      await supabase.from('personal_loans').update({ paid_cents: paidCents, status: paidCents >= loan.amount_cents ? 'settled' : 'open' }).eq('id', body.personalLoanId);
      return Response.json(await getDashboard(authorization), { status: 201 });
    }
    if (body.entity === 'personalLoanIncrease') {
      const amountCents = Math.round(Number(body.amount) * 100);
      if (!body.personalLoanId || amountCents <= 0 || !body.date) return Response.json({ error: 'Complete the additional debt information.' }, { status: 400 });
      const { data: loan, error: loanError } = await supabase.from('personal_loans').select('amount_cents,account_id').eq('id', body.personalLoanId).single();
      const accountId = body.accountId || loan?.account_id;
      if (loanError || !loan || !accountId) return Response.json({ error: 'Select the account involved.' }, { status: 400 });
      const { error: entryError } = await supabase.from('personal_loan_payments').insert({ user_id: user.id, personal_loan_id: body.personalLoanId, account_id: accountId, amount_cents: amountCents, payment_date: body.date, entry_type: 'advance' });
      if (entryError) throw entryError;
      const { error: updateError } = await supabase.from('personal_loans').update({ amount_cents: loan.amount_cents + amountCents, status: 'open' }).eq('id', body.personalLoanId);
      if (updateError) throw updateError;
      return Response.json(await getDashboard(authorization), { status: 201 });
    }
    if (body.entity === 'onboardingComplete') {
      const { error: preferenceError } = await supabase.from('user_preferences').upsert({ user_id: user.id, onboarding_completed: true });
      if (preferenceError && preferenceError.code !== 'PGRST205') throw preferenceError;
      return Response.json(await getDashboard(authorization));
    }
    if (body.entity === 'cardPurchase') {
      const amountCents = Math.round(Number(body.amount) * 100);
      const months = Number(body.installmentMonths || 1);
      const { data: ownedCard } = await supabase.from('credit_cards').select('id').eq('id', body.creditCardId).maybeSingle();
      if (!ownedCard || !body.description?.trim() || amountCents <= 0 || months < 1 || months > 36 || !body.date) return Response.json({ error: 'Complete the card purchase information.' }, { status: 400 });
      const snapshot = await getDashboard(authorization);
      const card = snapshot?.creditCards.find((item) => item.id === body.creditCardId);
      const purchases = snapshot?.cardPurchases.filter((item) => item.creditCardId === body.creditCardId).reduce((sum, item) => sum + item.amount, 0) || 0;
      const payments = snapshot?.cardPayments.filter((item) => item.creditCardId === body.creditCardId).reduce((sum, item) => sum + item.amount, 0) || 0;
      const availableCreditCents = Math.round(((card?.creditLimit || 0) - Math.max(0, (card?.openingUsed || 0) + purchases - payments)) * 100);
      if (!card || availableCreditCents < amountCents) return Response.json({ error: 'Insufficient available credit on this card.' }, { status: 400 });
      const { error: insertError } = await supabase.from('credit_card_purchases').insert({ user_id: user.id, credit_card_id: body.creditCardId, description: body.description.trim(), amount_cents: amountCents, purchase_date: body.date, category: body.category || null, installment_months: months, with_interest: body.withInterest === 'true' });
      if (insertError) throw insertError;
      return Response.json(await getDashboard(authorization), { status: 201 });
    }
    const type = body.type?.toLowerCase();
    const amountCents = Math.round(Number(body.amount) * 100);
    if (!['expense', 'income', 'transfer', 'recurring'].includes(type) || !body.description?.trim() || !Number.isFinite(amountCents) || amountCents <= 0 || !body.date) {
      return Response.json({ error: 'Please complete all required fields.' }, { status: 400 });
    }
    const recurringFlow = body.flowType === 'income' ? 'income' : 'expense';
    const accountIds = [body.fromAccountId, body.toAccountId].filter(Boolean);
    const { data: owned } = await supabase.from('accounts').select('id').in('id', accountIds);
    const ownedIds = new Set((owned || []).map((account) => account.id));
    if ((type === 'expense' || (type === 'recurring' && recurringFlow === 'expense') || type === 'transfer') && !ownedIds.has(body.fromAccountId)) return Response.json({ error: 'Invalid source account.' }, { status: 400 });
    if ((type === 'income' || (type === 'recurring' && recurringFlow === 'income') || type === 'transfer') && !ownedIds.has(body.toAccountId)) return Response.json({ error: 'Invalid destination account.' }, { status: 400 });
    if (type === 'transfer' && body.fromAccountId === body.toAccountId) return Response.json({ error: 'Choose two different accounts.' }, { status: 400 });
    if ((type === 'expense' || type === 'transfer') && !await hasFunds(body.fromAccountId, amountCents)) return Response.json({ error: 'Insufficient funds in the selected account.' }, { status: 400 });

    const recurringDate = recurringFlow === 'income' && (body.category === 'Salary' || /salary|sueldo/i.test(body.description)) ? monthEnd(body.date) : body.date;
    const result = type === 'recurring'
      ? await supabase.from('recurring_payments').insert({ user_id: user.id, name: body.description.trim(), amount_cents: amountCents, next_due_date: recurringDate, pay_from_account_id: recurringFlow === 'income' ? body.toAccountId : body.fromAccountId, category: body.category || null, payment_method: recurringFlow === 'income' ? 'Recurring Income' : body.paymentMethod || null })
      : await supabase.from('transactions').insert({ user_id: user.id, type, description: body.description.trim(), amount_cents: amountCents, transaction_date: body.date, from_account_id: body.fromAccountId || null, to_account_id: body.toAccountId || null, category: body.category || null, payment_method: body.paymentMethod || null });
    if (result.error) throw result.error;
    return Response.json(await getDashboard(authorization), { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'We could not save this entry.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    const { supabase, user } = await requireUser(authorization);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json() as { recurringId?: string; personalLoanId?: string; date?: string; action?: 'pay' | 'undo' | 'settle' | 'detachAccount' };
    if (body.personalLoanId && body.action === 'detachAccount') {
      const { error: detachError } = await supabase.from('personal_loans').update({ account_id: null }).eq('id', body.personalLoanId);
      if (detachError) throw detachError;
      return Response.json(await getDashboard(authorization));
    }
    if (body.personalLoanId && body.action === 'settle') {
      const { error: settleError } = await supabase.from('personal_loans').update({ status: 'settled' }).eq('id', body.personalLoanId);
      if (settleError) throw settleError;
      return Response.json(await getDashboard(authorization));
    }
    if (!body.recurringId || !body.date) return Response.json({ error: 'Missing payment information.' }, { status: 400 });
    const { data: payment, error: paymentError } = await supabase.from('recurring_payments').select('id,name,amount_cents,frequency,next_due_date,pay_from_account_id,category,payment_method').eq('id', body.recurringId).single();
    if (paymentError || !payment) return Response.json({ error: 'Recurring payment not found.' }, { status: 404 });
    const flowType = payment.payment_method === 'Recurring Income' ? 'income' : 'expense';
    const recurringRpc = body.action === 'undo' ? 'doryc_undo_recurring' : 'doryc_record_recurring';
    const recurringArgs = body.action === 'undo' ? { p_recurring_id: payment.id } : { p_recurring_id: payment.id, p_payment_date: body.date };
    const { error: atomicRecurringError } = await supabase.rpc(recurringRpc, recurringArgs);
    if (!atomicRecurringError) return Response.json(await getDashboard(authorization));
    if (atomicRecurringError.code !== 'PGRST202') throw atomicRecurringError;
    if (body.action === 'undo') {
      let latestQuery = supabase.from('transactions').select('id').eq('type', flowType).eq('description', payment.name).eq('amount_cents', payment.amount_cents);
      latestQuery = flowType === 'income' ? latestQuery.eq('to_account_id', payment.pay_from_account_id) : latestQuery.eq('from_account_id', payment.pay_from_account_id);
      const { data: latestTransaction } = await latestQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!latestTransaction) return Response.json({ error: 'The payment transaction could not be found.' }, { status: 404 });
      const { error: deleteError } = await supabase.from('transactions').delete().eq('id', latestTransaction.id);
      if (deleteError) throw deleteError;
      const previousDue = new Date(`${payment.next_due_date}T12:00:00Z`);
      if (isSalary(payment)) previousDue.setTime(new Date(`${previousMonthEnd(payment.next_due_date)}T12:00:00Z`).getTime());
      else if (payment.frequency === 'Weekly') previousDue.setUTCDate(previousDue.getUTCDate() - 7);
      else if (payment.frequency === 'Yearly') previousDue.setUTCFullYear(previousDue.getUTCFullYear() - 1);
      else previousDue.setUTCMonth(previousDue.getUTCMonth() - 1);
      const { error: undoError } = await supabase.from('recurring_payments').update({ paid_this_cycle: false, next_due_date: previousDue.toISOString().slice(0, 10) }).eq('id', payment.id);
      if (undoError) throw undoError;
      return Response.json(await getDashboard(authorization));
    }
    if (flowType === 'expense') {
      const snapshot = await getDashboard(authorization);
      const source = snapshot?.accounts.find((account) => account.id === payment.pay_from_account_id);
      if (!source || Math.round(source.balance * 100) < payment.amount_cents) return Response.json({ error: 'Insufficient funds in the selected account.' }, { status: 400 });
    }
    const { error: transactionError } = await supabase.from('transactions').insert({
      user_id: user.id, type: flowType, description: payment.name, amount_cents: payment.amount_cents,
      transaction_date: body.date, from_account_id: flowType === 'expense' ? payment.pay_from_account_id : null,
      to_account_id: flowType === 'income' ? payment.pay_from_account_id : null,
      category: payment.category || 'Subscriptions', payment_method: payment.payment_method,
    });
    if (transactionError) throw transactionError;
    const nextDue = new Date(`${payment.next_due_date}T12:00:00Z`);
    if (payment.frequency === 'Weekly') nextDue.setUTCDate(nextDue.getUTCDate() + 7);
    else if (payment.frequency === 'Yearly') nextDue.setUTCFullYear(nextDue.getUTCFullYear() + 1);
      else if (isSalary(payment)) {
        const salaryNext = nextMonthEnd(payment.next_due_date);
        nextDue.setTime(new Date(`${salaryNext}T12:00:00Z`).getTime());
      } else nextDue.setUTCMonth(nextDue.getUTCMonth() + 1);
    const { error: updateError } = await supabase.from('recurring_payments').update({ paid_this_cycle: true, next_due_date: nextDue.toISOString().slice(0, 10) }).eq('id', payment.id);
    if (updateError) throw updateError;
    return Response.json(await getDashboard(authorization));
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'We could not mark this payment as paid.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    const { supabase, user } = await requireUser(authorization);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json() as { entity?: string; id?: string };
    if (!body.id || !['creditCard', 'cardPurchase', 'personalLoan', 'loanPayment', 'account', 'transaction', 'bankLoan', 'recurring'].includes(body.entity || '')) return Response.json({ error: 'Invalid deletion request.' }, { status: 400 });
    if (body.entity === 'loanPayment') {
      const { data: entry, error: entryError } = await supabase.from('personal_loan_payments').select('personal_loan_id,amount_cents,entry_type').eq('id', body.id).single();
      if (entryError || !entry) throw entryError || new Error('Loan entry not found.');
      const { data: loan, error: loanError } = await supabase.from('personal_loans').select('amount_cents,paid_cents').eq('id', entry.personal_loan_id).single();
      if (loanError || !loan) throw loanError || new Error('Personal loan not found.');
      if (entry.entry_type === 'advance' && loan.amount_cents - entry.amount_cents < loan.paid_cents) return Response.json({ error: 'This addition cannot be removed because part of it has already been paid.' }, { status: 400 });
      const { error: deleteEntryError } = await supabase.from('personal_loan_payments').delete().eq('id', body.id);
      if (deleteEntryError) throw deleteEntryError;
      const update = entry.entry_type === 'advance'
        ? { amount_cents: loan.amount_cents - entry.amount_cents }
        : { paid_cents: Math.max(0, loan.paid_cents - entry.amount_cents), status: 'open' };
      const { error: updateLoanError } = await supabase.from('personal_loans').update(update).eq('id', entry.personal_loan_id);
      if (updateLoanError) throw updateLoanError;
      return Response.json(await getDashboard(authorization));
    }
    const table = body.entity === 'creditCard' ? 'credit_cards' : body.entity === 'personalLoan' ? 'personal_loans' : body.entity === 'account' ? 'accounts' : body.entity === 'transaction' ? 'transactions' : body.entity === 'bankLoan' ? 'bank_loans' : body.entity === 'recurring' ? 'recurring_payments' : 'credit_card_purchases';
    const { error } = await supabase.from(table).delete().eq('id', body.id);
    if (error) throw error;
    return Response.json(await getDashboard(authorization));
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'We could not delete this credit card.' }, { status: 500 });
  }
}
