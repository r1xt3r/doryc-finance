'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { createClient } from '../lib/supabase/client';
import LogoMark from './components/LogoMark';
import DashboardSidebar, { type DashboardView } from './components/DashboardSidebar';
import LanguageSelector from './components/LanguageSelector';
import ExperienceSettings from './components/ExperienceSettings';
import OnboardingTour from './components/OnboardingTour';
import ConfirmDialog from './components/ConfirmDialog';
import { addMonthsClamped, cardPurchaseDueDate, estimateCardPayment, nextMonthlyDate } from '../lib/finance';
import { useLanguage } from '../lib/useLanguage';
import { useExperiencePreferences } from '../lib/useExperiencePreferences';
import { useConfirmDialog } from '../lib/useConfirmDialog';
import { calculateFinancialHealth } from '../modules/insights/domain/financialHealth';
import { buildFinanceNotifications } from '../modules/insights/domain/notifications';
import FinancialHealthCard from '../modules/insights/presentation/FinancialHealthCard';
import NotificationCenter from '../modules/insights/presentation/NotificationCenter';
import MonthlyClose from '../modules/insights/presentation/MonthlyClose';
import MoneyCalendar from '../modules/calendar/presentation/MoneyCalendar';
import { salaryPaymentWindow } from '../modules/recurring-payments/domain/salarySchedule';

type Account = { id: string; name: string; bank: string; accountType: string; startingBalance: number; balance: number };
type Transaction = { id: string; type: 'expense' | 'income' | 'transfer'; description: string; amount: number; date: string; budgetMonth: string; from_account_id: string | null; to_account_id: string | null; category: string | null; payment_method: string | null; debtMovement?: boolean };
type Recurring = { id: string; name: string; amount: number; next_due_date: string; pay_from_account_id: string; category: string | null; payment_method: string | null; paid_this_cycle: number; flowType: 'income' | 'expense' };
type CreditCard = { id: string; name: string; bank: string; creditLimit: number; openingUsed: number; currentStatement: number; annualRate: number; paymentDay: number | null; statementDay: number | null; network: string; payFromAccountId: string | null };
type CardPurchase = { id: string; creditCardId: string; description: string; amount: number; date: string; category: string | null; installmentMonths: number; installmentsPaid: number; withInterest: boolean };
type CardPayment = { id: string; creditCardId: string; fromAccountId: string; amount: number; date: string; note: string | null };
type PersonalLoan = { id: string; direction: 'i_owe' | 'owed_to_me'; personName: string; amount: number; paid: number; accountId: string | null; dueDate: string | null; note: string | null; status: string };
type PersonalLoanPayment = { id: string; personalLoanId: string; accountId: string; amount: number; date: string; entryType: 'payment' | 'advance' };
type BankLoan = { id: string; bank: string; name: string; originalAmount: number; outstandingBalance: number; installment: number; nextDueDate: string; paymentDay: number; totalInstallments: number; paidInstallments: number; annualRate: number | null; payFromAccountId: string | null };
type DashboardData = { name: string; accounts: Account[]; transactions: Transaction[]; recurring: Recurring[]; creditCards: CreditCard[]; cardPurchases: CardPurchase[]; cardPayments: CardPayment[]; personalLoans: PersonalLoan[]; personalLoanPayments: PersonalLoanPayment[]; bankLoans: BankLoan[]; onboardingCompleted: boolean; income: number; spent: number };
type ActionType = 'Expense' | 'Income' | 'Transfer' | 'Recurring';

function PencilIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>; }
function TrashIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 10v7m4-7v7"/></svg>; }
function ChevronIcon({ open = false }: { open?: boolean }) { return <svg className={open ? 'open' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>; }
function PiggyBankIcon() { return <svg className="piggy-bank-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5.3 10.1A6.8 6.8 0 0 1 12 5.5h2.2l2.4-1.8.5 3a6.1 6.1 0 0 1 1.5 2.1H21v4h-2.2a6.8 6.8 0 0 1-2.4 3l.1 2.5h-3l-.5-1.6H9.2l-.7 1.6h-3l.5-3A6.4 6.4 0 0 1 4 11.1"/><path d="M9.5 5.9c.5-1.1 1.6-1.8 3-1.8M13.4 8.5h2.4"/><circle cx="15.6" cy="9.8" r=".6" fill="currentColor" stroke="none"/><path d="M4 11.2c-1.2 0-1.8-.6-1.8-1.4 0-.6.4-1 1-1"/></svg>; }

const initialData: DashboardData = {
  name: '', income: 0, spent: 0, transactions: [], creditCards: [], cardPurchases: [], cardPayments: [], personalLoans: [], personalLoanPayments: [], bankLoans: [], onboardingCompleted: true,
  accounts: [],
  recurring: [],
};

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const formatShortDate = (value: string, locale: string) => new Date(`${value}T12:00:00`).toLocaleDateString(locale, { month: 'short', day: '2-digit' });
function incomeTiming(item: Recurring, language: 'en' | 'es') {
  const locale = language === 'es' ? 'es-EC' : 'en-US';
  const salary = item.category === 'Salary' || /salary|sueldo/i.test(item.name);
  if (!salary) return formatShortDate(item.next_due_date, locale);
  const window = salaryPaymentWindow(item.next_due_date);
  if (!window.flexible) return `${language === 'es' ? 'fin de mes' : 'month end'} · ${formatShortDate(item.next_due_date, locale)}`;
  return `${language === 'es' ? 'ventana de pago' : 'pay window'} · ${formatShortDate(window.earliest, locale)} – ${formatShortDate(window.latest, locale)}`;
}

async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const sessionToken = await new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 4_000);
    createClient().auth.getSession().then((result: { data: { session: { access_token: string } | null } }) => finish(result.data.session?.access_token || null)).catch(() => finish(null));
  });
  const headers = new Headers(init.headers);
  const accessToken = sessionToken || window.sessionStorage.getItem('doryc_access_token');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  const controller = init.signal ? null : new AbortController();
  const timeout = controller ? window.setTimeout(() => controller.abort(), 20_000) : null;
  try {
    const response = await fetch(input, { ...init, headers, signal: init.signal || controller?.signal });
    if (response.status === 401) {
      window.sessionStorage.removeItem('doryc_access_token');
    }
    return response;
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

export default function Home() {
  const root = useRef<HTMLElement>(null);
  const { language, setLanguage } = useLanguage();
  const { preferences, setPreferences } = useExperiencePreferences();
  const confirmDialog = useConfirmDialog();
  const tr = (en: string, es: string) => language === 'es' ? es : en;
  const shortDate = (value: string) => formatShortDate(value, language === 'es' ? 'es-EC' : 'en-US');
  const actionName = (action: ActionType) => ({
    Expense: tr('expense', 'gasto'),
    Income: tr('income', 'ingreso'),
    Transfer: tr('transfer', 'transferencia'),
    Recurring: tr('recurring payment', 'pago recurrente'),
  })[action];
  const newActionTitle = (action: ActionType) => ({
    Expense: tr('New expense', 'Nuevo gasto'),
    Income: tr('New income', 'Nuevo ingreso'),
    Transfer: tr('New transfer', 'Nueva transferencia'),
    Recurring: tr('New recurring payment', 'Nuevo pago recurrente'),
  })[action];
  const transactionDescription = (description: string) =>
    description === 'Comisión por transferencia interbancaria' || description === 'Interbank transfer fee'
      ? tr('Interbank transfer fee', 'Comisión por transferencia interbancaria')
      : description;
  const transactionCategory = (category: string | null) => category === 'Bank fees' ? tr('Bank fees', 'Comisiones bancarias') : category;
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  }, []);
  const [data, setData] = useState(initialData);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [toast, setToast] = useState('');
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [celebrationKind, setCelebrationKind] = useState<'income' | 'expense'>('income');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState('');
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showBalanceDetail, setShowBalanceDetail] = useState(false);
  const [showFundingPlan, setShowFundingPlan] = useState(false);
  const [expandedFundingAccount, setExpandedFundingAccount] = useState<string | null>(null);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<Recurring | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [payingRecurringId, setPayingRecurringId] = useState<string | null>(null);
  const [recurringFlow, setRecurringFlow] = useState<'income' | 'expense'>('expense');
  const [cardModal, setCardModal] = useState<'account' | 'card' | 'purchase' | 'statement' | 'loan' | 'cardPayment' | 'loanPayment' | 'loanIncrease' | 'bankLoan' | null>(null);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [openUtility, setOpenUtility] = useState<'notifications' | 'settings' | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const views: DashboardView[] = ['overview', 'accounts', 'payments', 'credit', 'people', 'activity'];
    const syncView = () => {
      const requested = window.location.hash.slice(1) as DashboardView;
      if (views.includes(requested)) setActiveView(requested);
    };
    syncView();
    window.addEventListener('popstate', syncView);
    return () => window.removeEventListener('popstate', syncView);
  }, []);

  useEffect(() => {
    authenticatedFetch('/api/dashboard', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign('/login');
          return null;
        }
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to load data.');
        return payload;
      })
      .then((payload) => { if (payload) { const needsSetup = !payload.onboardingCompleted; setData(payload); setShowTour(needsSetup && window.localStorage.getItem('doryc_tour_seen') !== 'true'); setShowOnboarding(needsSetup && window.localStorage.getItem('doryc_tour_seen') === 'true' && window.localStorage.getItem('doryc_setup_dismissed') !== 'true'); } })
      .catch(() => setError('We could not connect to your financial data. Check your connection and try again.'))
      .finally(() => setLoading(false));
  }, [loadAttempt]);

  useEffect(() => {
    if (!root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const heading = root.current.querySelector<HTMLElement>('.topbar h1');
    const sidebar = root.current.querySelector<HTMLElement>('.sidebar');
    const brandMark = root.current.querySelector<HTMLElement>('.brand-mark');
    if (!heading || !sidebar || !brandMark) return;
    const animations = [
      animate(sidebar, { opacity: [0, 1], x: [-22, 0], duration: 720, ease: 'outExpo' }),
      animate(root.current.querySelectorAll('.topbar'), { opacity: [0, 1], duration: 180, ease: 'linear' }),
      animate(root.current.querySelectorAll('.topbar .eyebrow,.topbar .icon-button'), { opacity: [0, 1], y: [-10, 0], delay: stagger(90), duration: 520, ease: 'outCubic' }),
      animate(heading, { opacity: [0, 1], y: [22, 0], scale: [.97, 1], duration: 760, ease: 'outExpo' }),
      animate(heading.querySelectorAll('.greeting-word'), { opacity: [0, 1], y: [18, 0], rotate: [-2, 0], delay: stagger(130, { start: 90 }), duration: 820, ease: 'outElastic(1, .65)' }),
      animate(heading.querySelectorAll('.greeting-name'), { color: [{ to: '#ffffff' }, { to: '#bdf477' }, { to: '#ffffff' }], textShadow: [{ to: '0 0 0 rgba(189,244,119,0)' }, { to: '0 0 18px rgba(189,244,119,.34)' }, { to: '0 0 0 rgba(189,244,119,0)' }], duration: 2800, loop: true, loopDelay: 1400, ease: 'inOutSine' }),
      animate(root.current.querySelectorAll('.hero-grid article'), { opacity: [0, 1], y: [28, 0], scale: [.97, 1], delay: stagger(120, { start: 180 }), duration: 760, ease: 'outExpo' }),
      animate(heading, { filter: [{ to: 'drop-shadow(0 0 0 rgba(189,244,119,0))' }, { to: 'drop-shadow(0 4px 13px rgba(189,244,119,.22))' }, { to: 'drop-shadow(0 0 0 rgba(189,244,119,0))' }], duration: 2600, loop: true, loopDelay: 1200, ease: 'inOutSine' }),
    ];
    return () => {
      animations.forEach((animation) => animation.revert());
    };
  }, []);

  useEffect(() => {
    if (!root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const elements = [...root.current.querySelectorAll<HTMLElement>('.savings-panel,.cards-panel,.loans-panel,.activity-panel,.content-grid .panel')];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || (entry.target as HTMLElement).dataset.revealed) return;
        const element = entry.target as HTMLElement;
        element.dataset.revealed = 'true';
        animate(element, {
          y: [48, 0],
          scale: [.985, 1],
          filter: ['blur(7px)', 'blur(0px)'],
          duration: 920,
          ease: 'outExpo',
        });
        observer.unobserve(element);
      });
    }, { threshold: .1, rootMargin: '0px 0px -70px 0px' });
    elements.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      elements.forEach((element) => {
        element.style.opacity = '1';
        element.style.transform = 'none';
        element.style.filter = 'none';
      });
    };
  }, []);

  useEffect(() => {
    if (!root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const visible = root.current.querySelectorAll<HTMLElement>('.dashboard>section:not([hidden]),.dashboard>header');
    const transition = animate(visible, { opacity: [0, 1], y: [15, 0], delay: stagger(55), duration: 520, ease: 'outExpo' });
    return () => { transition.revert(); };
  }, [activeView]);

  useEffect(() => {
    if (!activeAction && !showFundingPlan && !cardModal) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const dialog = document.querySelector<HTMLElement>('.modal-card');
    const focusable = dialog ? [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')] : [];
    focusable[0]?.focus();
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        setActiveAction(null); setShowFundingPlan(false); setCardModal(null); setEditingTransaction(null); setSelectedAccountId('');
        return;
      }
      if (event.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleDialogKeys);
    animate('.modal-card', { opacity: [0, 1], scale: [.96, 1], y: [18, 0], duration: 460, ease: 'outExpo' });
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', handleDialogKeys); previousFocus?.focus(); };
  }, [activeAction, showFundingPlan, cardModal, saving]);

  const availableAccounts = data.accounts.filter((account) => account.name !== 'Produbanco Savings');
  const totalBalance = availableAccounts.reduce((sum, account) => sum + account.balance, 0);
  const availableByBank = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const account of availableAccounts) grouped.set(account.bank, (grouped.get(account.bank) || 0) + account.balance);
    return [...grouped.entries()].map(([bank, balance]) => ({ bank, balance }));
  }, [availableAccounts]);
  const activity = showAllActivity ? data.transactions : data.transactions.slice(0, 5);
  const recurringIncome = data.recurring.filter((item) => item.flowType === 'income');
  const recurringExpenses = data.recurring.filter((item) => item.flowType !== 'income');
  const expectedIncome = recurringIncome.filter((item) => !item.paid_this_cycle || item.next_due_date <= today);
  const receivedThisCycle = recurringIncome.filter((item) => item.paid_this_cycle && item.next_due_date > today);
  const allUpcoming = recurringExpenses;
  const paidThisCycle = recurringExpenses.filter((item) => item.paid_this_cycle && item.next_due_date > today);
  const upcoming = showAllUpcoming ? allUpcoming : allUpcoming.slice(0, 3);
  const accountMap = useMemo(() => new Map(data.accounts.map((account) => [account.id, account.name])), [data.accounts]);
  const pichinchaCheckingId = data.accounts.find((account) => account.bank === 'Pichincha' && account.accountType.toLowerCase() === 'checking')?.id || '';
  const bankLoanAccountId = (loan: BankLoan) => loan.bank === 'Pichincha' && pichinchaCheckingId ? pichinchaCheckingId : loan.payFromAccountId;
  const purchasesByCard = useMemo(() => { const grouped = new Map<string, CardPurchase[]>(); for (const purchase of data.cardPurchases) { const group = grouped.get(purchase.creditCardId); if (group) group.push(purchase); else grouped.set(purchase.creditCardId, [purchase]); } return grouped; }, [data.cardPurchases]);
  const paymentsByCard = useMemo(() => { const grouped = new Map<string, CardPayment[]>(); for (const payment of data.cardPayments || []) { const group = grouped.get(payment.creditCardId); if (group) group.push(payment); else grouped.set(payment.creditCardId, [payment]); } return grouped; }, [data.cardPayments]);
  const cardSummaries = useMemo(() => data.creditCards.map((card) => {
    const purchases = purchasesByCard.get(card.id) || [];
    const payments = paymentsByCard.get(card.id) || [];
    const purchasesTotal = purchases.reduce((sum, purchase) => sum + purchase.amount, 0);
    const paymentsTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const used = Math.max(0, card.openingUsed + purchasesTotal - paymentsTotal);
    const currentStatementDueDate = nextMonthlyDate(card.paymentDay, today);
    const remainingStatement = Math.max(0, card.currentStatement);
    const purchasesWithDueDate = purchases.map((purchase) => ({ ...purchase, dueDate: addMonthsClamped(cardPurchaseDueDate(purchase.date, card.statementDay, card.paymentDay), purchase.installmentMonths > 1 ? purchase.installmentsPaid || 0 : 0) }));
    const candidateDueDates = [...(remainingStatement > 0 ? [currentStatementDueDate] : []), ...purchasesWithDueDate.map((purchase) => purchase.dueDate)].filter((date) => date >= today).sort();
    const nextPaymentDate = candidateDueDates[0] || currentStatementDueDate;
    const purchasesInNextPayment = purchasesWithDueDate.filter((purchase) => purchase.dueDate === nextPaymentDate);
    const estimatedPayment = estimateCardPayment(nextPaymentDate === currentStatementDueDate ? remainingStatement : 0, card.annualRate, purchasesInNextPayment);
    return { card, purchases: purchasesWithDueDate, payments, used, available: Math.max(card.creditLimit - used, 0), estimatedPayment, nextPaymentDate };
  }), [data.creditCards, paymentsByCard, purchasesByCard, today]);
  const fundingPayments = [
    ...allUpcoming.map((payment) => ({ ...payment, kind: 'recurring' as const })),
    ...data.bankLoans.filter((loan) => loan.outstandingBalance > 0 && loan.installment > 0 && bankLoanAccountId(loan)).map((loan) => ({ id: `bank-loan-${loan.id}`, sourceId: loan.id, name: loan.name, amount: Math.min(loan.installment, loan.outstandingBalance), next_due_date: loan.nextDueDate, pay_from_account_id: bankLoanAccountId(loan)!, payment_method: 'Automatic Debit', kind: 'bankLoan' as const })),
    ...cardSummaries.filter(({ card, estimatedPayment }) => estimatedPayment > 0 && card.payFromAccountId).map(({ card, estimatedPayment, nextPaymentDate }) => ({ id: `credit-card-${card.id}`, sourceId: card.id, name: `${card.name} payment`, amount: estimatedPayment, next_due_date: nextPaymentDate, pay_from_account_id: card.payFromAccountId!, payment_method: 'Bank Transfer', kind: 'creditCard' as const })),
  ];
  const fundingByAccount = new Map<string, typeof fundingPayments>();
  for (const payment of fundingPayments) { const group = fundingByAccount.get(payment.pay_from_account_id); if (group) group.push(payment); else fundingByAccount.set(payment.pay_from_account_id, [payment]); }
  const fundingPlan = data.accounts.map((account) => {
    const payments = fundingByAccount.get(account.id) || [];
    const required = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const ready = Math.min(Math.max(account.balance, 0), required);
    const nextDue = payments.map((payment) => payment.next_due_date).sort()[0] || null;
    return { account, payments, required, ready, needed: Math.max(required - Math.max(account.balance, 0), 0), nextDue, paymentCount: payments.length };
  }).filter((item) => item.required > 0);
  const totalReadyForPayments = fundingPlan.reduce((sum, item) => sum + item.ready, 0);
  const totalFundingNeeded = fundingPlan.reduce((sum, item) => sum + item.needed, 0);
  const outstanding = fundingPlan.reduce((sum, item) => sum + item.required, 0);
  const expectedIncomeTotal = expectedIncome.reduce((sum, item) => sum + item.amount, 0);
  const projectedBalance = totalBalance + expectedIncomeTotal - outstanding;
  const availableAfterIncome = Math.max(totalBalance + expectedIncomeTotal, 0);
  const paymentCoverage = outstanding > 0 ? Math.min(100, availableAfterIncome / outstanding * 100) : 100;
  const forecastScale = Math.max(availableAfterIncome, outstanding, Math.abs(projectedBalance), 1);
  const financialTimeline = [
    ...expectedIncome.map((income) => ({ id: `income-${income.id}`, name: income.name, date: income.next_due_date, amount: income.amount, kind: 'Expected income', direction: 'income' as const })),
    ...allUpcoming.map((payment) => ({ id: `recurring-${payment.id}`, name: payment.name, date: payment.next_due_date, amount: payment.amount, kind: payment.payment_method || 'Payment', direction: 'expense' as const })),
    ...data.bankLoans.filter((loan) => loan.outstandingBalance > 0).map((loan) => ({ id: `loan-${loan.id}`, name: loan.name, date: loan.nextDueDate, amount: Math.min(loan.installment, loan.outstandingBalance), kind: 'Automatic Debit', direction: 'expense' as const })),
    ...cardSummaries.filter(({ estimatedPayment }) => estimatedPayment > 0).map(({ card, estimatedPayment, nextPaymentDate }) => ({ id: `card-${card.id}`, name: `${card.name} payment`, date: nextPaymentDate, amount: estimatedPayment, kind: 'Bank Transfer', direction: 'expense' as const })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  const fundingMonth = fundingPlan[0]?.nextDue ? new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(`${fundingPlan[0].nextDue}T12:00:00`)) : 'Upcoming';
  const safetyId = data.accounts.find((account) => account.name === 'Pichincha Safety')?.id || '';
  const debitId = data.accounts.find((account) => account.name === 'Pichincha Debit')?.id || '';
  const savingsAccounts = data.accounts.filter((account) => account.name === 'Produbanco Savings');
  const savingsTotal = savingsAccounts.reduce((sum, account) => sum + account.balance, 0);
  const totalCreditLimit = data.creditCards.reduce((sum, card) => sum + card.creditLimit, 0);
  const totalCreditUsed = cardSummaries.reduce((sum, summary) => sum + summary.used, 0);
  const overdueCount = fundingPayments.filter((payment) => payment.next_due_date < today).length;
  const financialHealth = calculateFinancialHealth({ available: totalBalance, expectedIncome: expectedIncomeTotal, commitments: outstanding, savings: savingsTotal, creditUsed: totalCreditUsed, creditLimit: totalCreditLimit, overdueCount });
  const nextDueDate = fundingPayments.map((payment) => payment.next_due_date).sort()[0] || null;
  const nextDueDays = nextDueDate ? Math.ceil((new Date(`${nextDueDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000) : null;
  const notifications = buildFinanceNotifications({ fundingNeeded: totalFundingNeeded, creditUtilization: totalCreditLimit ? totalCreditUsed / totalCreditLimit * 100 : 0, nextDueDays, potentialSavings: Math.max(projectedBalance, 0) });
  const debtPaidThisMonth = data.personalLoanPayments.filter((payment) => payment.entryType === 'payment' && payment.date.startsWith(today.slice(0, 7))).reduce((sum, payment) => sum + payment.amount, 0) + data.cardPayments.filter((payment) => payment.date.startsWith(today.slice(0, 7))).reduce((sum, payment) => sum + payment.amount, 0);
  const categorySpending = useMemo(() => {
    const month = today.slice(0, 7);
    const totals = new Map<string, { amount: number; count: number }>();
    data.transactions
      .filter((transaction) => transaction.type === 'expense' && !transaction.debtMovement && (transaction.budgetMonth || transaction.date).startsWith(month))
      .forEach((transaction) => {
        const category = transaction.category || 'Other';
        const current = totals.get(category) || { amount: 0, count: 0 };
        totals.set(category, { amount: current.amount + transaction.amount, count: current.count + 1 });
      });
    return [...totals.entries()]
      .map(([category, summary]) => ({ category, ...summary }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 7);
  }, [data.transactions, today]);
  const categoryMax = Math.max(...categorySpending.map((item) => item.amount), 1);
  const ecuadorHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guayaquil', hour: '2-digit', hourCycle: 'h23' }).format(currentTime));
  const greeting = ecuadorHour < 12 ? tr('Good morning', 'Buenos días') : ecuadorHour < 18 ? tr('Good afternoon', 'Buenas tardes') : tr('Good evening', 'Buenas noches');
  const currentDateLabel = new Intl.DateTimeFormat(language === 'es' ? 'es-EC' : 'en-US', { timeZone: 'America/Guayaquil', weekday: 'long', month: 'short', day: 'numeric' }).format(currentTime).toUpperCase();
  const configuredCard = data.creditCards.find((card) => card.payFromAccountId && card.statementDay && card.paymentDay);
  const setupMissions = [
    { title: tr('Bank accounts', 'Cuentas bancarias'), detail: tr('Add the accounts you use and their real balances.', 'Agrega las cuentas que usas y sus saldos reales.'), done: data.accounts.length > 0, action: () => setCardModal('account') },
    { title: tr('Savings space', 'Espacio de ahorro'), detail: tr('Create at least one savings account.', 'Crea al menos una cuenta de ahorros.'), done: savingsAccounts.length > 0, action: () => setCardModal('account') },
    { title: tr('Expected income', 'Ingreso esperado'), detail: tr('Schedule your salary or regular monthly income.', 'Programa tu sueldo o ingreso mensual habitual.'), done: expectedIncome.length > 0, action: () => { setRecurringFlow('income'); setActiveAction('Recurring'); } },
    { title: tr('Monthly payments', 'Pagos mensuales'), detail: tr('Register at least one recurring commitment.', 'Registra al menos un compromiso recurrente.'), done: recurringExpenses.length > 0, action: () => { setRecurringFlow('expense'); setActiveAction('Recurring'); } },
    { title: tr('Credit or debt', 'Crédito o deuda'), detail: tr('Add a card or loan if you currently use one.', 'Agrega una tarjeta o préstamo si actualmente utilizas uno.'), done: data.creditCards.length > 0 || data.bankLoans.length > 0, action: () => setCardModal('card') },
    { title: tr('Billing dates', 'Fechas de facturación'), detail: tr('Choose statement day, payment day and paying account.', 'Elige día de corte, día de pago y cuenta de origen.'), done: data.creditCards.length === 0 || Boolean(configuredCard), action: () => { if (data.creditCards[0]) setSelectedCardId(data.creditCards[0].id); setCardModal(data.creditCards.length ? 'statement' : 'card'); } },
  ];
  const completedMissions = setupMissions.filter((mission) => mission.done).length;
  const viewTitles: Record<DashboardView, string> = language === 'es'
    ? { overview: 'Resumen', accounts: 'Cuentas y ahorros', payments: 'Pagos', credit: 'Crédito y préstamos', people: 'Dinero entre personas', activity: 'Flujo de caja' }
    : { overview: 'Overview', accounts: 'Accounts & savings', payments: 'Payments', credit: 'Credit & loans', people: 'Money between people', activity: 'Cash flow' };
  const navigateTo = useCallback((view: DashboardView) => { setActiveView(view); window.history.pushState(null, '', `#${view}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  const celebrateMoneyIn = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setCelebrationKey((key) => key + 1);
    window.setTimeout(() => setCelebrationKey(0), 2900);
  };
  const celebrateMoneyOut = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setCelebrationKind('expense'); setCelebrationKey((key) => key + 1); window.setTimeout(() => setCelebrationKey(0), 2900);
  };

  useEffect(() => {
    if (!root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rows = root.current.querySelectorAll('.account-row,.payment-row,.activity-row');
    const categories = root.current.querySelectorAll('.category-row');
    const tracks = root.current.querySelectorAll('.category-track i,.progress-track span,.savings-track i,.credit-limit-track i,.bank-loan-track i,.funding-account-track i');
    if (rows.length) animate(rows, { opacity: [0, 1], x: [16, 0], delay: stagger(42), duration: 520, ease: 'outCubic' });
    if (categories.length) animate(categories, { opacity: [0, 1], y: [10, 0], delay: stagger(70), duration: 500, ease: 'outCubic' });
    if (tracks.length) animate(tracks, { scaleX: [0, 1], delay: stagger(75), duration: 850, ease: 'outExpo' });
  }, [activeView, data.accounts, data.transactions, data.recurring, data.creditCards, data.bankLoans]);

  useEffect(() => {
    if (!celebrationKey || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const particles = document.querySelectorAll<HTMLElement>('.money-particle');
    const animations = [...particles].map((particle, index) => animate(particle, {
      opacity: [0, 1, { to: 0, duration: 420 }],
      y: [-90, window.innerHeight + 120],
      x: [0, Number(particle.dataset.drift || 0)],
      rotate: [0, Number(particle.dataset.spin || 360)],
      scale: [.65, Number(particle.dataset.scale || 1)],
      delay: index * 32,
      duration: 1750 + (index % 6) * 135,
      ease: 'inQuad',
    }));
    const toastPulse = animate('.toast', { scale: [.92, 1.04, 1], duration: 620, ease: 'outElastic(1,.55)' });
    return () => { animations.forEach((animation) => animation.revert()); toastPulse.revert(); };
  }, [celebrationKey]);

  useEffect(() => {
    if (!root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const glow = root.current.querySelector<HTMLElement>('.savings-glow');
    const pulse = root.current.querySelector<HTMLElement>('.savings-account>div:first-child>span');
    if (!glow || !pulse) return;
    const glowAnimation = animate(glow, {
      x: ['-120%', '520%'],
      scaleX: [{ to: 1.7, duration: 700 }, { to: .8, duration: 900 }],
      opacity: [{ to: 1, duration: 260 }, { to: .25, duration: 900 }],
      duration: 2600,
      loop: true,
      loopDelay: 450,
      ease: 'inOutSine',
    });
    const pulseAnimation = animate(pulse, {
      boxShadow: [
        '0 0 0 0 rgba(189,244,119,0)',
        '0 0 0 8px rgba(189,244,119,.08)',
        '0 0 0 0 rgba(189,244,119,0)',
      ],
      duration: 2200,
      loop: true,
      ease: 'inOutSine',
    });
    return () => { glowAnimation.revert(); pulseAnimation.revert(); };
  }, [savingsAccounts.length]);

  useEffect(() => {
    if (!showAllUpcoming || !root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = animate(root.current.querySelectorAll('.upcoming-list .payment-row:nth-child(n+4)'), {
      opacity: [0, 1], y: [12, 0], delay: stagger(45), duration: 460, ease: 'outCubic',
    });
    return () => { animation.revert(); };
  }, [showAllUpcoming]);

  async function signOut() {
    await createClient().auth.signOut();
    window.sessionStorage.removeItem('doryc_access_token');
    window.location.assign('/login');
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAction) return;
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.type = activeAction;
    if (editingTransaction) { payload.entity = 'transactionUpdate'; payload.id = editingTransaction.id; }
    if (editingRecurring) { payload.entity = 'recurringUpdate'; payload.id = editingRecurring.id; }
    setSaving(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/dashboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save.');
      setData(result);
      setActiveAction(null);
      setEditingTransaction(null);
      setEditingRecurring(null);
      setToast(editingTransaction ? 'Movement updated' : editingRecurring ? 'Recurring payment updated' : `${activeAction} saved`);
      if (!editingTransaction && activeAction === 'Income') celebrateMoneyIn();
      if (!editingTransaction && activeAction === 'Expense') celebrateMoneyOut();
      window.setTimeout(() => setToast(''), 2400);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save.');
    } finally { setSaving(false); }
  }

  async function deleteTransaction(item: Transaction) {
    if (!await confirmDialog.confirm({ title: tr('Delete movement?', '¿Eliminar movimiento?'), detail: tr(`${item.description} will be removed and the account balance will be recalculated.`, `Se eliminará ${item.description} y se recalculará el saldo de la cuenta.`) })) return;
    const response = await authenticatedFetch('/api/dashboard', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'transaction', id: item.id }) });
    const result = await response.json();
    if (response.ok) { setData(result); setToast('Movement deleted'); window.setTimeout(() => setToast(''), 2400); }
    else setError(result.error || 'Unable to delete this movement.');
  }

  async function deleteAccount(account: Account) {
    if (!await confirmDialog.confirm({ title: tr('Delete account?', '¿Eliminar cuenta?'), detail: tr(`${account.name} can only be deleted when it has no linked movements or payments.`, `${account.name} solo puede eliminarse si no tiene movimientos o pagos vinculados.`) })) return;
    const response = await authenticatedFetch('/api/dashboard', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'account', id: account.id }) });
    const result = await response.json();
    if (response.ok) { setData(result); setToast('Account deleted'); window.setTimeout(() => setToast(''), 2400); }
    else setError('This account is still used by a movement, payment or card. Reassign those records before deleting it.');
  }

  async function deleteBankLoan(loan: BankLoan) {
    if (!await confirmDialog.confirm({ title: tr('Delete bank loan?', '¿Eliminar préstamo bancario?'), detail: tr(`${loan.name} and its planning information will be removed.`, `Se eliminará ${loan.name} y su información de planificación.`) })) return;
    const response = await authenticatedFetch('/api/dashboard', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'bankLoan', id: loan.id }) });
    const result = await response.json();
    if (response.ok) { setData(result); setToast('Bank loan deleted'); window.setTimeout(() => setToast(''), 2400); }
    else setError(result.error || 'Unable to delete this bank loan.');
  }

  async function deleteRecurring(payment: Recurring) {
    if (!await confirmDialog.confirm({ title: tr('Delete recurring entry?', '¿Eliminar registro recurrente?'), detail: tr(`${payment.name} will no longer appear in future plans.`, `${payment.name} dejará de aparecer en los planes futuros.`) })) return;
    const response = await authenticatedFetch('/api/dashboard', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'recurring', id: payment.id }) });
    const result = await response.json();
    if (response.ok) { setData(result); setToast('Recurring payment deleted'); window.setTimeout(() => setToast(''), 2400); }
    else setError(result.error || 'Unable to delete this recurring payment.');
  }

  async function submitCardEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cardModal) return;
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    payload.entity = cardModal === 'account' ? selectedAccountId ? 'accountUpdate' : 'account' : cardModal === 'bankLoan' ? 'bankLoan' : cardModal === 'card' ? 'creditCard' : cardModal === 'statement' ? 'creditCardStatement' : cardModal === 'loan' ? 'personalLoan' : cardModal === 'cardPayment' ? 'creditCardPayment' : cardModal === 'loanPayment' ? 'personalLoanPayment' : cardModal === 'loanIncrease' ? 'personalLoanIncrease' : 'cardPurchase';
    if (cardModal === 'account' && selectedAccountId) payload.id = selectedAccountId;
    setSaving(true); setError('');
    try {
      const response = await authenticatedFetch('/api/dashboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save.');
      const receivedPersonalPayment = cardModal === 'loanPayment' && data.personalLoans.find((loan) => loan.id === selectedCardId)?.direction === 'owed_to_me';
      setData(result); setCardModal(null); setToast(cardModal === 'account' ? selectedAccountId ? 'Account updated' : 'Account added' : cardModal === 'bankLoan' ? 'Bank loan added' : cardModal === 'card' ? 'Credit card added' : cardModal === 'statement' ? 'Statement updated' : cardModal === 'loan' ? 'Personal loan saved' : cardModal === 'cardPayment' ? 'Card payment saved' : cardModal === 'loanPayment' ? 'Loan payment saved' : cardModal === 'loanIncrease' ? 'Additional debt saved' : 'Card purchase saved');
      if (receivedPersonalPayment) celebrateMoneyIn();
      if (cardModal === 'account') setSelectedAccountId('');
      window.setTimeout(() => setToast(''), 2400);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save.'); }
    finally { setSaving(false); }
  }

  async function deleteCreditCard(card: CreditCard) {
    if (!await confirmDialog.confirm({ title: tr('Delete credit card?', '¿Eliminar tarjeta?'), detail: tr(`${card.name} and all its registered purchases will be removed.`, `Se eliminarán ${card.name} y todas sus compras registradas.`) })) return;
    setSaving(true); setError('');
    try {
      const response = await authenticatedFetch('/api/dashboard', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'creditCard', id: card.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete card.');
      setData(result); setToast(`${card.name} deleted`); window.setTimeout(() => setToast(''), 2400);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete card.'); }
    finally { setSaving(false); }
  }

  async function deleteCardPurchase(purchase: CardPurchase) {
    if (!await confirmDialog.confirm({ title: tr('Delete card purchase?', '¿Eliminar compra?'), detail: tr(`${purchase.description} will be removed from the card forecast.`, `${purchase.description} se eliminará del pronóstico de la tarjeta.`) })) return;
    const response = await authenticatedFetch('/api/dashboard', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'cardPurchase', id: purchase.id }) });
    const result = await response.json();
    if (response.ok) { setData(result); setToast('Card purchase deleted'); window.setTimeout(() => setToast(''), 2400); }
    else setError(result.error || 'Unable to delete purchase.');
  }

  async function deletePersonalLoan(loan: PersonalLoan) {
    if (!await confirmDialog.confirm({ title: tr('Delete personal IOU?', '¿Eliminar deuda personal?'), detail: tr(`The balance and history with ${loan.personName} will be removed.`, `Se eliminarán el saldo y el historial con ${loan.personName}.`) })) return;
    const response = await authenticatedFetch('/api/dashboard', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'personalLoan', id: loan.id }) });
    const result = await response.json();
    if (response.ok) { setData(result); setToast('Personal IOU deleted'); window.setTimeout(() => setToast(''), 2400); }
    else setError(result.error || 'Unable to delete this personal IOU.');
  }

  async function deleteLoanPayment(payment: PersonalLoanPayment) {
    if (!await confirmDialog.confirm({ title: tr('Delete movement?', '¿Eliminar movimiento?'), detail: tr(`This ${payment.entryType === 'advance' ? 'debt addition' : 'payment'} of ${money(payment.amount)} will be reversed.`, `Se revertirá este ${payment.entryType === 'advance' ? 'aumento de deuda' : 'pago'} de ${money(payment.amount)}.`) })) return;
    const response = await authenticatedFetch('/api/dashboard', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'loanPayment', id: payment.id }) });
    const result = await response.json();
    if (response.ok) { setData(result); setToast(payment.entryType === 'advance' ? 'Debt addition removed' : 'Payment removed'); window.setTimeout(() => setToast(''), 2400); }
    else setError(result.error || 'Unable to remove this entry.');
  }

  function dismissOnboarding() {
    window.localStorage.setItem('doryc_setup_dismissed', 'true');
    setShowOnboarding(false);
  }

  function startTour() {
    window.localStorage.removeItem('doryc_setup_dismissed');
    setOpenUtility(null);
    setShowOnboarding(false);
    setShowTour(true);
  }

  function finishTour() {
    window.localStorage.setItem('doryc_tour_seen', 'true');
    window.localStorage.removeItem('doryc_setup_dismissed');
    setShowTour(false);
    navigateTo('overview');
    setShowOnboarding(!data.onboardingCompleted);
  }

  function skipTour() {
    window.localStorage.setItem('doryc_tour_seen', 'true');
    setShowTour(false);
    navigateTo('overview');
    setShowOnboarding(!data.onboardingCompleted);
  }

  async function completeOnboarding() {
    if (completedMissions !== setupMissions.length) { dismissOnboarding(); return; }
    window.localStorage.setItem('doryc_setup_dismissed', 'true');
    setShowOnboarding(false);
    try {
      const response = await authenticatedFetch('/api/dashboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'onboardingComplete' }) });
      if (response.ok) setData(await response.json());
    } catch { /* Local preference keeps the guide dismissed until Supabase preferences are available. */ }
  }

  async function markRecurringPaid(payment: Recurring) {
    setPayingRecurringId(payment.id);
    setError('');
    try {
      const response = await authenticatedFetch('/api/dashboard', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recurringId: payment.id, date: today, budgetMonth: payment.next_due_date.slice(0, 7), action: 'pay' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to mark this payment as paid.');
      setData(result);
      setToast(payment.flowType === 'income' ? `${payment.name} received` : `${payment.name} paid`);
      if (payment.flowType === 'income') celebrateMoneyIn();
      window.setTimeout(() => setToast(''), 2400);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to mark this payment as paid.');
    } finally { setPayingRecurringId(null); }
  }

  async function markFundingPaymentPaid(payment: (typeof fundingPayments)[number]) {
    if (payment.kind === 'recurring') return markRecurringPaid(payment);
    setPayingRecurringId(payment.id);
    setError('');
    try {
      const body = payment.kind === 'creditCard'
        ? { entity: 'creditCardPayment', creditCardId: payment.sourceId, fromAccountId: payment.pay_from_account_id, amount: payment.amount, date: today, budgetMonth: payment.next_due_date.slice(0, 7), note: `${payment.name} · Bank Transfer` }
        : { entity: 'bankLoanPayment', bankLoanId: payment.sourceId, fromAccountId: payment.pay_from_account_id, amount: payment.amount, date: today, budgetMonth: payment.next_due_date.slice(0, 7) };
      const response = await authenticatedFetch('/api/dashboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to mark this payment as paid.');
      setData(result);
      setToast(`${payment.name} paid by bank transfer`);
      window.setTimeout(() => setToast(''), 2400);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to mark this payment as paid.');
    } finally { setPayingRecurringId(null); }
  }

  async function undoRecurringPayment(payment: Recurring) {
    setPayingRecurringId(payment.id);
    setError('');
    try {
      const response = await authenticatedFetch('/api/dashboard', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recurringId: payment.id, date: today, action: 'undo' }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to undo this payment.');
      setData(result);
      setToast(`${payment.name} restored`);
      window.setTimeout(() => setToast(''), 2400);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to undo this payment.');
    } finally { setPayingRecurringId(null); }
  }

  return (
    <main ref={root} className={`app-shell ${loading ? 'app-is-loading' : ''}`}>
      {showTour && <OnboardingTour language={language} onNavigate={navigateTo} onClose={skipTour} onFinish={finishTour} />}
      {loading && <section className="app-loading-screen" role="status" aria-live="polite"><LogoMark /><div><p className="eyebrow">DORYC</p><h1>{tr('Bringing your finances together', 'Organizando tus finanzas')}</h1><small>{tr('Connecting securely to your financial home…', 'Conectando de forma segura con tu espacio financiero…')}</small></div><div className="app-loading-progress" aria-hidden="true"><i /></div></section>}
      <DashboardSidebar activeView={activeView} name={data.name} paymentCount={fundingPayments.length} language={language} onNavigate={navigateTo} />

      <section className={`dashboard ${loading ? 'is-loading' : ''}`} id="top" aria-busy={loading}>
        <header className="topbar" data-reveal>
          <div><p className="eyebrow">{activeView === 'overview' ? currentDateLabel : 'DORYC'}</p><h1>{activeView === 'overview' ? <><span className="greeting-word">{greeting},</span>{' '}<span className="greeting-word greeting-name">{loading ? '…' : `${data.name || 'there'}.`}</span></> : viewTitles[activeView]}</h1></div>
          <div className="topbar-actions"><NotificationCenter items={notifications} language={language} onNavigate={navigateTo} open={openUtility === 'notifications'} onToggle={() => setOpenUtility((v) => v === 'notifications' ? null : 'notifications')} onClose={() => setOpenUtility(null)} /><ExperienceSettings value={preferences} language={language} onChange={setPreferences} open={openUtility === 'settings'} onToggle={() => setOpenUtility((v) => v === 'settings' ? null : 'settings')} onStartTour={startTour} /><LanguageSelector language={language} onChange={setLanguage} /><button className="icon-button" type="button" onClick={signOut} aria-label={tr('Sign out', 'Cerrar sesión')} title={tr('Sign out', 'Cerrar sesión')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5H5v14h5"/><path d="M14 8l4 4-4 4m4-4H9"/></svg><span className="button-tooltip">{tr('Sign out', 'Cerrar sesión')}</span></button></div>
        </header>
        {error && !activeAction && <div className="page-error" role="alert"><span><strong>{tr('Connection interrupted', 'Conexión interrumpida')}</strong><small>{error}</small></span><button type="button" onClick={() => { setLoading(true); setError(''); setLoadAttempt((attempt) => attempt + 1); }}>{tr('Try again', 'Reintentar')}</button></div>}

        {showOnboarding && activeView === 'overview' && <section className="onboarding-panel">
          <button type="button" aria-label={tr('Dismiss setup guide', 'Cerrar guía por ahora')} onClick={dismissOnboarding}>×</button>
          <div><p className="eyebrow">{tr('DORYC SETUP MISSIONS', 'MISIONES INICIALES')}</p><h2>{tr('Set up your financial home', 'Prepara tu espacio financiero')}</h2><p>{tr('Complete each mission once. Doryc detects what is already configured.', 'Completa cada misión una vez. Doryc detecta lo que ya configuraste.')}</p><div className="onboarding-progress"><span><i style={{ width: `${completedMissions / setupMissions.length * 100}%` }} /></span><strong>{completedMissions} {tr(`of ${setupMissions.length} complete`, `de ${setupMissions.length} completas`)}</strong></div></div>
          <div className="onboarding-steps">{setupMissions.map((mission, index) => <button type="button" className={mission.done ? 'completed' : ''} key={mission.title} onClick={mission.action}><i>{mission.done ? '✓' : index + 1}</i><strong>{mission.title}</strong><small>{mission.done ? tr('Completed', 'Completada') : mission.detail}</small><b>{mission.done ? tr('Done', 'Lista') : tr('Open →', 'Abrir →')}</b></button>)}</div>
          <div className="onboarding-actions"><small>{completedMissions === setupMissions.length ? tr('Everything is ready.', 'Todo está listo.') : tr('Close this guide and continue later without losing progress.', 'Puedes cerrar la guía y continuar después sin perder el avance.')}</small><button className="onboarding-action" type="button" onClick={completeOnboarding}>{completedMissions === setupMissions.length ? tr('Finish setup ✓', 'Finalizar ✓') : tr('Close for now', 'Cerrar por ahora')}</button></div>
        </section>}

        <section className="hero-grid" id="overview" hidden={activeView !== 'overview'}>
          <article className="balance-card" data-reveal>
            <button className="balance-card-trigger" type="button" onClick={() => setShowBalanceDetail(true)} aria-haspopup="dialog">
              <div className="card-kicker"><span>{tr('Available balance', 'Saldo disponible')}</span><span className="live-dot">{tr('Live', 'En vivo')}</span></div>
              <strong className="balance">{money(totalBalance)}</strong><p>{tr(`Across ${availableByBank.length} banks · ${availableAccounts.length} available accounts`, `En ${availableByBank.length} bancos · ${availableAccounts.length} cuentas disponibles`)}</p>
              <div className="balance-bank-grid">{availableByBank.map(({ bank, balance }) => <span key={bank}><i>{bank.slice(0, 1).toUpperCase()}</i><small>{bank}</small><strong>{money(balance)}</strong></span>)}</div>
              <div className="balance-footer"><span><small>{tr('Income this month', 'Ingresos este mes')}</small><strong>+{money(data.income)}</strong></span><span><small>{tr('Spent this month', 'Gastado este mes')}</small><strong>−{money(data.spent)}</strong></span></div>
              <small className="balance-detail-hint">{tr('View account breakdown', 'Ver detalle por cuentas')} <b>→</b></small>
            </button>
          </article>
          <article className="funding-card" data-reveal>
            <div className="card-kicker"><span>{tr('Funding needed', 'Fondos necesarios')}</span><span>{fundingMonth}</span></div>
            <div className="funding-main"><strong>{money(totalFundingNeeded)}</strong><span>still needed across {fundingPlan.length} accounts</span></div>
            <div className="progress-track"><span style={{ width: `${Math.min(100, totalReadyForPayments / Math.max(outstanding, 1) * 100)}%` }} /></div>
            <div className="funding-meta"><span>{money(totalReadyForPayments)} ready</span><span>{money(outstanding)} scheduled</span></div>
            <button className="funding-plan-button" type="button" onClick={() => setShowFundingPlan(true)}>View account plan <span>→</span></button>
          </article>
        </section>

        {showBalanceDetail && <div className="modal-backdrop balance-detail-backdrop" role="presentation" onMouseDown={() => setShowBalanceDetail(false)}>
          <section className="modal balance-detail-modal" role="dialog" aria-modal="true" aria-labelledby="balance-detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p className="eyebrow">{tr('AVAILABLE MONEY', 'DINERO DISPONIBLE')}</p><h2 id="balance-detail-title">{tr('Balance by account', 'Saldo por cuenta')}</h2></div><button type="button" onClick={() => setShowBalanceDetail(false)} aria-label={tr('Close', 'Cerrar')}>×</button></div>
            <div className="balance-detail-total"><span><small>{tr('Total available', 'Total disponible')}</small><strong>{money(totalBalance)}</strong></span><small>{tr(`${availableAccounts.length} accounts included`, `${availableAccounts.length} cuentas incluidas`)}</small></div>
            <div className="balance-account-list">{availableAccounts.map((account) => {
              const share = totalBalance > 0 ? Math.max(0, account.balance) / totalBalance * 100 : 0;
              return <article key={account.id}><span className="balance-account-icon">{account.bank.slice(0, 1).toUpperCase()}</span><span><strong>{account.name}</strong><small>{account.bank} · {account.accountType}</small><i><b style={{ width: `${Math.min(100, share)}%` }} /></i></span><span><strong>{money(account.balance)}</strong><small>{totalBalance > 0 ? `${share.toFixed(0)}%` : '—'}</small></span></article>;
            })}{availableAccounts.length === 0 && <div className="balance-detail-empty"><strong>{tr('No available accounts yet', 'Aún no hay cuentas disponibles')}</strong><small>{tr('Add your first account to start calculating your balance.', 'Agrega tu primera cuenta para comenzar a calcular el saldo.')}</small></div>}</div>
            <button className="balance-detail-action" type="button" onClick={() => { setShowBalanceDetail(false); navigateTo('accounts'); }}>{tr('Manage accounts', 'Administrar cuentas')} <span>→</span></button>
          </section>
        </div>}

        <section className="overview-links" hidden={activeView !== 'overview'} aria-label="Financial areas">
          <button type="button" onClick={() => navigateTo('accounts')}><span>▥</span><small>Accounts & savings</small><strong>{money(totalBalance + savingsTotal)}</strong><i>→</i></button>
          <button type="button" onClick={() => navigateTo('payments')}><span>◷</span><small>Upcoming payments</small><strong>{money(outstanding)}</strong><i>→</i></button>
          <button type="button" onClick={() => navigateTo('credit')}><span>◇</span><small>Credit & bank loans</small><strong>{data.creditCards.length + data.bankLoans.length} active</strong><i>→</i></button>
          <button type="button" onClick={() => navigateTo('people')}><span>↔</span><small>Money between people</small><strong>{data.personalLoans.filter((loan) => loan.status !== 'settled').length} open</strong><i>→</i></button>
        </section>

        <section className="overview-wellbeing" hidden={activeView !== 'overview'}>
          <FinancialHealthCard health={financialHealth} language={language} />
          <MonthlyClose income={data.income} spent={data.spent} debtPaid={debtPaidThisMonth} saved={projectedBalance} language={language} />
        </section>

        <section className="overview-intelligence" hidden={activeView !== 'overview'}>
          <article className={`financial-pulse ${projectedBalance < 0 ? 'warning' : ''}`}>
            <div className="pulse-heading"><span><p className="eyebrow">MONTHLY FORECAST</p><h2>{projectedBalance >= 0 ? 'This is what you could save.' : 'Your commitments exceed available income.'}</h2></span><i title={tr('Percentage of scheduled commitments covered by available money and expected income', 'Porcentaje de compromisos programados cubiertos con tu saldo e ingresos esperados')}><strong>{paymentCoverage.toFixed(0)}%</strong><small>{tr('commitments covered', 'compromisos cubiertos')}</small></i></div>
            <p className="pulse-message">Starting with <strong>{money(totalBalance)}</strong>, adding expected income and covering {fundingMonth.toLowerCase()} commitments leaves <strong>{money(projectedBalance)}</strong>.</p>
            {expectedIncomeTotal === 0 && <button className="pulse-income-setup" type="button" onClick={() => { setEditingTransaction(null); setRecurringFlow('income'); setActiveAction('Recurring'); }}><span>＋</span><span><strong>Add your expected salary</strong><small>Register the $1,300 you receive at the start of each month.</small></span><b>Set up →</b></button>}
            <div className="cash-forecast" aria-label="Monthly cash forecast">
              <div><span><small>Available now</small><strong>{money(totalBalance)}</strong></span><i className="current" style={{ width: `${Math.max(totalBalance > 0 ? 4 : 0, Math.min(100, totalBalance / forecastScale * 100))}%` }} /></div>
              <div><span><small>Expected income</small><strong>+{money(expectedIncomeTotal)}</strong></span><i className="income" style={{ width: `${Math.max(expectedIncomeTotal > 0 ? 4 : 0, Math.min(100, expectedIncomeTotal / forecastScale * 100))}%` }} /></div>
              <div><span><small>Monthly commitments</small><strong>−{money(outstanding)}</strong></span><i className="commitments" style={{ width: `${Math.max(outstanding > 0 ? 4 : 0, Math.min(100, outstanding / forecastScale * 100))}%` }} /></div>
              <div className={projectedBalance >= 0 ? 'result positive' : 'result negative'}><span><small>{projectedBalance >= 0 ? 'Potential savings' : 'Missing funds'}</small><strong>{money(Math.abs(projectedBalance))}</strong></span><i style={{ width: `${Math.max(Math.abs(projectedBalance) > 0 ? 4 : 0, Math.min(100, Math.abs(projectedBalance) / forecastScale * 100))}%` }} /></div>
            </div>
          </article>
          <article className="financial-calendar">
            <div className="calendar-heading"><span><p className="eyebrow">MONEY CALENDAR</p><h2>Next on your timeline</h2></span><button type="button" onClick={() => navigateTo('payments')}>View all →</button></div>
            {financialTimeline.length ? <MoneyCalendar items={financialTimeline} language={language} /> : <div className="timeline-empty"><strong>{tr('Your calendar is clear', 'Tu calendario está libre')}</strong><small>{tr('New scheduled payments will appear here.', 'Los nuevos pagos programados aparecerán aquí.')}</small></div>}
          </article>
        </section>

        <section className="savings-panel panel" id="savings" data-reveal hidden={activeView !== 'accounts'}>
          <div className="savings-heading"><div><p className="eyebrow">SAVINGS</p><h2>{savingsAccounts.length === 1 ? savingsAccounts[0].name : tr('Savings accounts', 'Cuentas de ahorro')}</h2><p>{savingsAccounts.length === 1 ? `${savingsAccounts[0].bank} · ${tr('Savings account', 'Cuenta de ahorros')}.` : tr('Your dedicated savings accounts.', 'Tus cuentas de ahorro.')}</p></div><div><small>{tr('Total saved', 'Total ahorrado')}</small><strong>{money(savingsTotal)}</strong></div></div>
          <div className="savings-grid">{savingsAccounts.map((account) => {
            const share = savingsTotal > 0 ? account.balance / savingsTotal * 100 : 0;
            return <article className="savings-account" key={account.id}><div><span><PiggyBankIcon /></span><p><strong>{account.name}</strong><small>{account.bank} · Savings</small></p><strong>{money(account.balance)}</strong></div><div className="savings-track"><i style={{ width: `${savingsTotal > 0 ? Math.max(3, share) : 0}%` }} /><b className="savings-glow" aria-hidden="true" /></div><div><small>{share.toFixed(0)}% of savings</small><small>{account.balance > 0 ? 'Earning reserve' : 'Ready for your first deposit'}</small></div></article>;
          })}</div>
        </section>

        <section className="cards-panel panel" data-reveal hidden={activeView !== 'credit'}>
          <div className="section-heading"><div><p className="eyebrow">{tr('CREDIT', 'CRÉDITO')}</p><h2>{tr('Credit cards', 'Tarjetas de crédito')}</h2></div><button type="button" className="text-action" onClick={() => setCardModal('card')}>+ {tr('Add card', 'Agregar tarjeta')}</button></div>
          {cardSummaries.length ? <><div className="credit-card-grid">{cardSummaries.map(({ card, purchases, used, available, estimatedPayment, nextPaymentDate }) => <article className="credit-card" key={card.id}>
            <div className="credit-card-top"><span>{card.bank}</span><strong className={`card-network ${(card.network || (card.name.toLowerCase().includes('mastercard') ? 'Mastercard' : 'Visa')).toLowerCase()}`}>{(card.network || (card.name.toLowerCase().includes('mastercard') ? 'Mastercard' : 'Visa')).toUpperCase()}</strong></div><h3>{card.name}</h3>
            <div className="credit-card-balance"><span><small>Available</small><strong>{money(available)}</strong></span><span><small>Used</small><strong>{money(used)}</strong></span></div>
            <div className="credit-limit-track"><i style={{ width: `${Math.min(100, used / card.creditLimit * 100)}%` }} /></div>
            <div className="credit-card-meta"><span>{money(card.creditLimit)} limit</span><span>{Math.round(used / card.creditLimit * 100)}% used</span></div>
            <div className="credit-next-payment"><span><small>Estimated payment · {shortDate(nextPaymentDate)}</small><strong>{money(estimatedPayment)}</strong></span><span><small>Paid by transfer from</small><strong>{accountMap.get(card.payFromAccountId || '') || 'Select account'}</strong></span></div>
            <div className="credit-card-footer"><small>{purchases.length} purchases · cut day {card.statementDay || '—'} · pay day {card.paymentDay || '—'}</small><span><button type="button" onClick={() => { setSelectedCardId(card.id); setCardModal('cardPayment'); }}>Pay card</button><button type="button" onClick={() => { setSelectedCardId(card.id); setCardModal('statement'); }}>Settings</button><button type="button" onClick={() => { setSelectedCardId(card.id); setCardModal('purchase'); }}>Add purchase</button><button className="danger-mini icon-action" type="button" aria-label={tr(`Delete ${card.name}`, `Eliminar ${card.name}`)} title={tr('Delete', 'Eliminar')} onClick={() => deleteCreditCard(card)}><TrashIcon /></button></span></div>
          </article>)}</div><div className="card-cash-flow"><div><p className="eyebrow">CARD CASH FLOW</p><h3>What is shaping your card payment</h3></div><div className="card-flow-stats"><span className="used-credit-stat"><small>Used credit · current debt</small><strong>{money(cardSummaries.reduce((sum, item) => sum + item.used, 0))}</strong></span><span><small>New purchases</small><strong>{money(data.cardPurchases.reduce((sum, purchase) => sum + purchase.amount, 0))}</strong></span><span><small>Estimated next payment</small><strong>{money(cardSummaries.reduce((sum, item) => sum + item.estimatedPayment, 0))}</strong></span></div>{cardSummaries.some((item) => item.purchases.length) ? <div className="card-purchase-list">{cardSummaries.flatMap((item) => item.purchases).slice(0, 5).map((purchase) => <div key={purchase.id}><span><strong>{purchase.description}</strong><small>{purchase.installmentMonths > 1 ? `Installment ${Math.min((purchase.installmentsPaid || 0) + 1, purchase.installmentMonths)} of ${purchase.installmentMonths}` : 'Current purchase'} · due {shortDate(purchase.dueDate)}</small></span><span className="purchase-actions"><strong>{money(purchase.amount)}</strong><button type="button" onClick={() => deleteCardPurchase(purchase)}>Delete</button></span></div>)}</div> : <p className="card-flow-empty">Your card purchases will appear here and explain the estimated payment.</p>}{(data.cardPayments || []).length > 0 && <div className="card-payment-history"><p>Recent card payments</p>{(data.cardPayments || []).slice(0, 3).map((payment) => <span key={payment.id}><small>{shortDate(payment.date)} · {accountMap.get(payment.fromAccountId)}</small><strong>+{money(payment.amount)} credit freed</strong></span>)}</div>}</div></> : <div className="credit-empty"><span>◇</span><div><strong>No credit cards yet</strong><small>Add your card limit and current used balance to start forecasting payments.</small></div><button type="button" onClick={() => setCardModal('card')}>Add credit card</button></div>}
        </section>

        <section className="bank-loans-panel panel" data-reveal hidden={activeView !== 'credit'}>
          <div className="section-heading"><div><p className="eyebrow">{tr('BANK DEBT', 'DEUDA BANCARIA')}</p><h2>{tr('Loans', 'Préstamos')}</h2></div><button type="button" className="text-action" onClick={() => setCardModal('bankLoan')}>+ {tr('Add loan', 'Agregar préstamo')}</button></div>
          {data.bankLoans.length ? <div className="bank-loan-grid">{data.bankLoans.map((loan) => {
            const progress = Math.min(100, loan.paidInstallments / Math.max(loan.totalInstallments, 1) * 100);
            return <article key={loan.id}><div className="bank-loan-top"><span><small>{loan.bank}</small><strong>{loan.name}</strong></span><button className="danger-mini icon-action" type="button" aria-label={`Delete ${loan.name}`} title="Delete" onClick={() => deleteBankLoan(loan)}><TrashIcon /></button></div><div className="bank-loan-values"><span><small>Outstanding balance</small><strong>{money(loan.outstandingBalance)}</strong></span><span><small>Monthly installment</small><strong>{money(loan.installment)}</strong></span><span><small>Next payment</small><strong>{shortDate(loan.nextDueDate)}</strong></span></div><div className="bank-loan-track"><i style={{ width: `${progress}%` }} /></div><div className="bank-loan-meta"><small>{loan.paidInstallments} of {loan.totalInstallments} installments paid</small><small>Automatic Debit · {accountMap.get(bankLoanAccountId(loan) || '') || `day ${loan.paymentDay}`}</small></div></article>;
          })}</div> : <div className="credit-empty"><span>▤</span><div><strong>No bank loans yet</strong><small>Track the balance, installment and maximum payment date.</small></div><button type="button" onClick={() => setCardModal('bankLoan')}>Add bank loan</button></div>}
        </section>

        <section className="loans-panel panel" data-reveal hidden={activeView !== 'people'}>
          <div className="section-heading"><div><p className="eyebrow">{tr('PERSONAL IOUs', 'DEUDAS PERSONALES')}</p><h2>{tr('Money between people', 'Dinero entre personas')}</h2></div><button type="button" className="text-action" onClick={() => setCardModal('loan')}>+ {tr('Add IOU', 'Agregar deuda')}</button></div>
          {data.personalLoans.length ? <div className="loan-grid">{data.personalLoans.map((loan) => {
            const history = (data.personalLoanPayments || []).filter((payment) => payment.personalLoanId === loan.id);
            return <article className={`${loan.direction} ${loan.status === 'settled' ? 'settled' : ''}`} key={loan.id}><span>{loan.status === 'settled' ? '✓' : loan.direction === 'i_owe' ? '↓' : '↑'}</span><div><small>{loan.status === 'settled' ? 'Settled' : loan.direction === 'i_owe' ? 'I owe' : 'Owed to me'}</small><strong>{loan.personName}</strong><p>{loan.note || (loan.direction === 'i_owe' ? 'Money I need to return' : 'Money they need to return')}</p></div><div><strong>{money(Math.max(loan.amount - loan.paid, 0))}</strong><span className="loan-actions"><button type="button" onClick={() => { setSelectedCardId(loan.id); setCardModal('loanIncrease'); }}>Add debt</button>{loan.status !== 'settled' && <button type="button" onClick={() => { setSelectedCardId(loan.id); setCardModal('loanPayment'); }}>Record payment</button>}<button className="history-toggle" type="button" aria-label={expandedLoanId === loan.id ? 'Hide movement history' : 'Show movement history'} title={expandedLoanId === loan.id ? 'Hide history' : 'Show history'} onClick={() => setExpandedLoanId((current) => current === loan.id ? null : loan.id)}><ChevronIcon open={expandedLoanId === loan.id} />{history.length > 0 && <i>{history.length}</i>}</button><button className="loan-delete icon-action" type="button" aria-label={`Delete IOU with ${loan.personName}`} title="Delete" onClick={() => deletePersonalLoan(loan)}><TrashIcon /></button></span></div>{expandedLoanId === loan.id && <div className="loan-history"><p>Movement history</p>{history.length ? history.slice(0, 8).map((payment) => <span key={payment.id}><small>{shortDate(payment.date)} · {accountMap.get(payment.accountId) || 'Account'}</small><strong>{payment.entryType === 'advance' ? `Added ${money(payment.amount)}` : `${loan.direction === 'i_owe' ? 'You paid ' : 'You received '}${money(payment.amount)}`}</strong><button className="history-delete icon-action" type="button" aria-label="Delete this movement" title="Delete" onClick={() => deleteLoanPayment(payment)}><TrashIcon /></button></span>) : <small>No payments or additional loans recorded yet.</small>}</div>}</article>;
          })}</div> : <div className="credit-empty"><span>↔</span><div><strong>No personal loans pending</strong><small>Record money borrowed from friends or money you lent so it is not forgotten.</small></div><button type="button" onClick={() => setCardModal('loan')}>Add IOU</button></div>}
        </section>

        <section className="activity-panel panel" id="activity" data-reveal hidden={activeView !== 'activity'}>
          <div className="section-heading"><div><p className="eyebrow">{tr('AUGUST', 'AGOSTO')}</p><h2>{tr('Cash flow', 'Flujo de caja')}</h2></div><div className="section-actions"><button type="button" onClick={() => { setEditingTransaction(null); setActiveAction('Expense'); }}>+ {tr('Expense', 'Gasto')}</button><button type="button" onClick={() => { setEditingTransaction(null); setActiveAction('Income'); }}>+ {tr('Income', 'Ingreso')}</button><button type="button" onClick={() => { setEditingTransaction(null); setActiveAction('Transfer'); }}>+ {tr('Transfer', 'Transferencia')}</button></div></div>
          <div className="activity-grid">
            <div className="chart-wrap" aria-label="Monthly spending by category">
              <div className="chart-total"><span>Spent this month</span><strong>{money(data.spent)}</strong></div>
              {categorySpending.length ? <>
                <div className="category-chart">{categorySpending.map((item, index) => {
                  const percentage = data.spent ? (item.amount / data.spent) * 100 : 0;
                  return <div className="category-row" key={item.category}>
                    <div className="category-meta"><span><i>{index + 1}</i><strong>{item.category}</strong><small>{item.count} {item.count === 1 ? 'purchase' : 'purchases'}</small></span><span><strong>{money(item.amount)}</strong><small>{percentage.toFixed(0)}% of spending</small></span></div>
                    <div className="category-track" title={`${item.category}: ${money(item.amount)} (${percentage.toFixed(1)}%)`}><i style={{ width: `${Math.max(4, (item.amount / categoryMax) * 100)}%` }} /></div>
                  </div>;
                })}</div>
                <div className="chart-insight"><span>↗</span><p><strong>{categorySpending[0].category} is your largest category.</strong><small>It represents {((categorySpending[0].amount / data.spent) * 100).toFixed(0)}% of this month&apos;s spending.</small></p></div>
              </> : <div className="chart-empty"><strong>No expenses yet</strong><small>Your category chart will appear after your first expense.</small></div>}
            </div>
            <div className="activity-list">
              {activity.length ? activity.map((item) => {
                const account = item.type === 'income' ? accountMap.get(item.to_account_id || '') : accountMap.get(item.from_account_id || '');
                const prefix = item.type === 'income' ? '+' : item.type === 'transfer' ? '⇄ ' : '−';
                return <div className={`activity-row ${item.debtMovement ? 'debt-movement-row' : ''}`} key={item.id}><span className="activity-bullet">{item.debtMovement ? '↔' : item.description[0]}</span><span><strong>{transactionDescription(item.description)}</strong><small>{item.type === 'transfer' ? `${accountMap.get(item.from_account_id || '')} → ${accountMap.get(item.to_account_id || '')}` : `${transactionCategory(item.category) || item.type} · ${account}`}</small></span><strong className={item.type}>{prefix}{money(item.amount)}</strong>{!item.debtMovement && <span className="row-actions"><button className="icon-action" type="button" aria-label={tr(`Edit ${item.description}`, `Editar ${item.description}`)} title={tr('Edit', 'Editar')} onClick={() => { setEditingTransaction(item); setActiveAction((item.type[0].toUpperCase() + item.type.slice(1)) as ActionType); }}><PencilIcon /></button><button className="danger-mini icon-action" type="button" aria-label={tr(`Delete ${item.description}`, `Eliminar ${item.description}`)} title={tr('Delete', 'Eliminar')} onClick={() => deleteTransaction(item)}><TrashIcon /></button></span>}</div>;
              }) : <div className="empty-state"><strong>No activity yet</strong><small>Your first expense, income or transfer will appear here.</small></div>}
              {data.transactions.length > 5 && <button className="show-all-button" type="button" onClick={() => setShowAllActivity((current) => !current)}>{showAllActivity ? 'Show recent only' : `View all ${data.transactions.length} movements`}</button>}
            </div>
          </div>
        </section>

        <section className="content-grid single-view" hidden={activeView !== 'accounts' && activeView !== 'payments'}>
          <article className="panel" id="accounts" data-reveal hidden={activeView !== 'accounts'}>
            <div className="section-heading"><div><p className="eyebrow">{tr('YOUR MONEY', 'TU DINERO')}</p><h2>{tr('Accounts', 'Cuentas')}</h2></div><div className="section-actions"><span className="live-label">{tr('Live balances', 'Saldos actuales')}</span><button type="button" onClick={() => { setSelectedAccountId(''); setCardModal('account'); }}>+ {tr('Add account', 'Agregar cuenta')}</button></div></div>
            <div className="account-list">{data.accounts.map((account, index) => <div className="account-row" key={account.id}><span className={`account-icon ${['mint', 'violet', 'orange'][index % 3]}`}>{account.name.split(' ')[1]?.[0] || account.name[0]}</span><span><strong>{account.name}</strong><small>{account.accountType}</small></span><strong>{money(account.balance)}</strong><span className="row-actions"><button className="icon-action" type="button" aria-label={`Edit ${account.name}`} title="Edit" onClick={() => { setSelectedAccountId(account.id); setCardModal('account'); }}><PencilIcon /></button><button className="danger-mini icon-action" type="button" aria-label={`Delete ${account.name}`} title="Delete" onClick={() => deleteAccount(account)}><TrashIcon /></button></span></div>)}</div>
          </article>
          <article className="panel" id="plans" data-reveal hidden={activeView !== 'payments'}>
            <div className="section-heading"><div><p className="eyebrow">{tr('MONTHLY PLAN', 'PLAN MENSUAL')}</p><h2>{tr('Income & commitments', 'Ingresos y compromisos')}</h2></div><div className="section-actions"><span className="live-label">{data.recurring.length + data.creditCards.length + data.bankLoans.length} {tr('active', 'activos')}</span><button type="button" onClick={() => { setEditingRecurring(null); setEditingTransaction(null); setRecurringFlow('expense'); setActiveAction('Recurring'); }}>+ {tr('Schedule', 'Programar')}</button></div></div>
            {expectedIncome.length > 0 && <div className="expected-income-list"><p><span>↗</span> {tr('Expected income', 'Ingresos esperados')}</p>{expectedIncome.map((income) => <div key={income.id}><span className="payment-icon income-icon">＋</span><span><strong>{income.name}</strong><small>{incomeTiming(income, language)} · {tr('arrives in', 'llega a')} {accountMap.get(income.pay_from_account_id)}</small></span><strong>+{money(income.amount)}</strong><span className="income-actions"><button type="button" disabled={payingRecurringId === income.id} onClick={() => markRecurringPaid(income)}>{payingRecurringId === income.id ? tr('Saving…', 'Guardando…') : tr('Record received', 'Registrar ingreso')}</button><button className="icon-action" type="button" aria-label={tr(`Edit ${income.name}`, `Editar ${income.name}`)} title={tr('Edit', 'Editar')} onClick={() => { setEditingRecurring(income); setRecurringFlow('income'); setActiveAction('Recurring'); }}><PencilIcon /></button><button className="danger-mini icon-action" type="button" aria-label={`Delete ${income.name}`} title={tr('Delete', 'Eliminar')} onClick={() => deleteRecurring(income)}><TrashIcon /></button></span></div>)}</div>}
            {receivedThisCycle.length > 0 && <div className="paid-cycle received-cycle"><p><span>✓</span> {tr('Income received this cycle', 'Ingresos recibidos este ciclo')}</p>{receivedThisCycle.map((income) => <div key={income.id}><span><strong>{income.name}</strong><small>+{money(income.amount)} · {tr('next', 'próximo')} {shortDate(income.next_due_date)}</small></span><button type="button" disabled={payingRecurringId === income.id} onClick={() => undoRecurringPayment(income)}>{payingRecurringId === income.id ? tr('Restoring…', 'Restaurando…') : tr('Undo', 'Deshacer')}</button></div>)}</div>}
            <div className="upcoming-list">{upcoming.map((payment) => <div className="payment-row editable-payment-row" key={payment.id}><span className="payment-icon">◷</span><span><strong>{payment.name}</strong><small>{shortDate(payment.next_due_date)} · {accountMap.get(payment.pay_from_account_id)}</small></span><strong>−{money(payment.amount)}</strong><span className="row-actions"><button className="icon-action" type="button" aria-label={tr(`Edit ${payment.name}`, `Editar ${payment.name}`)} title={tr('Edit', 'Editar')} onClick={() => { setEditingRecurring(payment); setRecurringFlow('expense'); setActiveAction('Recurring'); }}><PencilIcon /></button><button className="danger-mini icon-action" type="button" aria-label={`Delete ${payment.name}`} title={tr('Delete', 'Eliminar')} onClick={() => deleteRecurring(payment)}><TrashIcon /></button></span></div>)}{data.bankLoans.map((loan) => <div className="payment-row bank-loan-payment-row" key={`loan-${loan.id}`}><span className="payment-icon">▤</span><span><strong>{loan.name}</strong><small>{shortDate(loan.nextDueDate)} · Automatic Debit · {accountMap.get(bankLoanAccountId(loan) || '') || loan.bank}</small></span><strong>−{money(loan.installment)}</strong></div>)}{cardSummaries.map(({ card, estimatedPayment, nextPaymentDate }) => <div className="payment-row card-payment-row" key={`card-${card.id}`}><span className="payment-icon">◇</span><span><strong>{card.name} payment</strong><small>{shortDate(nextPaymentDate)} · Bank Transfer · {accountMap.get(card.payFromAccountId || '') || 'select payment account'}</small></span><strong>−{money(estimatedPayment)}</strong></div>)}{!upcoming.length && !cardSummaries.length && !data.bankLoans.length && <div className="empty-state"><strong>No upcoming payments</strong><small>Add a recurring payment, loan or credit card above.</small></div>}</div>
            {allUpcoming.length > 3 && <button className="show-all-button" type="button" onClick={() => setShowAllUpcoming((visible) => !visible)}>{showAllUpcoming ? 'Show less' : `View all ${allUpcoming.length}`}</button>}
            {paidThisCycle.length > 0 && <div className="paid-cycle"><p><span>✓</span> {tr('Paid this cycle', 'Pagados este ciclo')}</p>{paidThisCycle.map((payment) => <div key={payment.id}><span><strong>{payment.name}</strong><small>{money(payment.amount)} · {tr('next', 'próximo')} {shortDate(payment.next_due_date)}</small></span><button type="button" disabled={payingRecurringId === payment.id} onClick={() => undoRecurringPayment(payment)}>{payingRecurringId === payment.id ? tr('Restoring…', 'Restaurando…') : tr('Undo', 'Deshacer')}</button></div>)}</div>}
          </article>
        </section>

        {showFundingPlan && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => { setShowFundingPlan(false); setExpandedFundingAccount(null); }}>
            <section className="modal-card funding-plan-modal" role="dialog" aria-modal="true" aria-labelledby="funding-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-heading"><div><p className="eyebrow">ACCOUNT FUNDING</p><h2 id="funding-title">What you need, and when</h2></div><button onClick={() => { setShowFundingPlan(false); setExpandedFundingAccount(null); }} aria-label="Close">×</button></div>
              <div className="funding-summary"><span><small>Scheduled</small><strong>{money(outstanding)}</strong></span><span><small>Ready</small><strong>{money(totalReadyForPayments)}</strong></span><span><small>Still needed</small><strong>{money(totalFundingNeeded)}</strong></span></div>
              <div className="funding-account-list">{fundingPlan.map((item) => <article className="funding-account-row" key={item.account.id}>
                <button className="funding-account-toggle" type="button" aria-expanded={expandedFundingAccount === item.account.id} onClick={() => setExpandedFundingAccount((current) => current === item.account.id ? null : item.account.id)}><span className="funding-account-icon">{item.account.name.split(' ')[1]?.[0] || item.account.name[0]}</span><span><strong>{item.account.name}</strong><small>{item.paymentCount} {item.paymentCount === 1 ? 'payment' : 'payments'} · due from {item.nextDue ? shortDate(item.nextDue) : '—'}</small></span><i>⌄</i></button>
                <div className="funding-account-values"><span><small>Balance</small><strong>{money(item.account.balance)}</strong></span><span><small>Required</small><strong>{money(item.required)}</strong></span><span className={item.needed > 0 ? 'needs-funding' : 'funded'}><small>{item.needed > 0 ? 'Add' : 'Covered'}</small><strong>{item.needed > 0 ? money(item.needed) : '✓'}</strong></span></div>
                <div className="funding-account-track"><i style={{ width: `${Math.min(100, item.ready / Math.max(item.required, 1) * 100)}%` }} /></div>
                {expandedFundingAccount === item.account.id && <div className="funding-payment-details">{item.payments.map((payment) => <div key={payment.id}><span><strong>{payment.name}</strong><small>{shortDate(payment.next_due_date)} · {payment.payment_method || 'Bank Transfer'}</small></span><span className="funding-payment-action"><strong>−{money(payment.amount)}</strong><button type="button" disabled={payingRecurringId === payment.id} onClick={() => markFundingPaymentPaid(payment)}>{payingRecurringId === payment.id ? 'Saving…' : 'Mark paid'}</button></span></div>)}</div>}
              </article>)}</div>
            </section>
          </div>
        )}

        {activeAction && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => { if (!saving) { setActiveAction(null); setEditingTransaction(null); setEditingRecurring(null); } }}>
            <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="modal-heading"><div><p className="eyebrow">{editingTransaction || editingRecurring ? tr('ENTRY SETTINGS', 'CONFIGURACIÓN') : tr('QUICK ENTRY', 'REGISTRO RÁPIDO')}</p><h2 id="modal-title">{editingTransaction ? tr('Edit movement', 'Editar movimiento') : editingRecurring ? tr('Edit recurring payment', 'Editar pago recurrente') : newActionTitle(activeAction)}</h2></div><button onClick={() => { setActiveAction(null); setEditingTransaction(null); setEditingRecurring(null); }} aria-label={tr('Close', 'Cerrar')} disabled={saving}>×</button></div>
              <form onSubmit={submitEntry}>
                {activeAction === 'Recurring' && <label><span>Schedule type</span><select name="flowType" value={recurringFlow} onChange={(event) => setRecurringFlow(event.target.value as 'income' | 'expense')}><option value="expense">Recurring expense</option><option value="income">Recurring income</option></select></label>}
                <label><span>{tr('Description', 'Descripción')}</span><input name="description" required autoFocus defaultValue={editingTransaction ? transactionDescription(editingTransaction.description) : editingRecurring?.name || ''} placeholder={activeAction === 'Recurring' && recurringFlow === 'income' ? tr('Monthly salary', 'Sueldo mensual') : activeAction === 'Transfer' ? tr('For example: Transfer to Pichincha', 'Por ejemplo: Transferencia a Pichincha') : tr('What was it for?', '¿Para qué fue?')} /></label>
                <div className="field-row"><label><span>{tr('Amount', 'Monto')}</span><input name="amount" required inputMode="decimal" type="text" defaultValue={editingTransaction?.amount || editingRecurring?.amount || (activeAction === 'Recurring' && recurringFlow === 'income' ? '1300' : '')} placeholder="$0,00" /></label><label><span>{activeAction === 'Recurring' ? recurringFlow === 'income' ? tr('Next income date', 'Próxima fecha de ingreso') : tr('Next due date', 'Próxima fecha de pago') : tr('Movement date', 'Fecha del movimiento')}</span><input name="date" required type="date" defaultValue={editingTransaction?.date || editingRecurring?.next_due_date || today} /></label></div>
                {activeAction !== 'Recurring' && <label><span>{tr('Belongs to month', 'Corresponde al mes')}</span><input name="budgetMonth" required type="month" defaultValue={(editingTransaction?.budgetMonth || today).slice(0, 7)} /><small className="field-help">{tr('The account changes on the movement date; reports use this month.', 'La cuenta cambia en la fecha del movimiento; los reportes utilizan este mes.')}</small></label>}
                {activeAction === 'Income' || (activeAction === 'Recurring' && recurringFlow === 'income') ? (
                  <label><span>{tr('To account', 'Cuenta de destino')}</span><select name="toAccountId" required defaultValue={editingTransaction?.to_account_id || editingRecurring?.pay_from_account_id || ''}><option value="" disabled>{tr('Select destination', 'Selecciona un destino')}</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                ) : (
                  <label><span>{activeAction === 'Recurring' ? tr('Pay from', 'Pagar desde') : tr('From account', 'Cuenta de origen')}</span><select name="fromAccountId" required defaultValue={editingTransaction?.from_account_id || editingRecurring?.pay_from_account_id || (activeAction === 'Transfer' ? safetyId : '')}><option value="" disabled>{tr('Select an account', 'Selecciona una cuenta')}</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {money(account.balance)}</option>)}</select></label>
                )}
                {activeAction === 'Transfer' && <label><span>{tr('To account', 'Cuenta de destino')}</span><select name="toAccountId" required defaultValue={editingTransaction?.to_account_id || debitId}><option value="" disabled>{tr('Select destination', 'Selecciona un destino')}</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}
                {activeAction === 'Income' && <label><span>Income type</span><select name="category" required defaultValue={editingTransaction?.category || ''}><option value="" disabled>Select an income type</option><option>Transfer Received</option><option>Salary</option><option>Interest</option><option>Refund</option><option>Other</option></select></label>}
                {activeAction === 'Recurring' && recurringFlow === 'income' && <input type="hidden" name="category" value="Salary" />}
                {(activeAction === 'Expense' || (activeAction === 'Recurring' && recurringFlow === 'expense')) && <label><span>{tr('Category', 'Categoría')}</span><select name="category" required defaultValue={editingTransaction?.category || editingRecurring?.category || ''}><option value="" disabled>{tr('Select a category', 'Selecciona una categoría')}</option><option>Food</option><option>Transportation</option><option>Shopping</option><option>Personal</option><option>Alcohol</option><option>Entertainment</option><option>Subscriptions</option><option>Utilities</option><option>Home</option><option>Health</option><option>Insurance</option><option>Debt</option><option>Other</option></select></label>}
                {activeAction !== 'Income' && !(activeAction === 'Recurring' && recurringFlow === 'income') && <label><span>{tr('Payment method', 'Método de pago')}</span><select name="paymentMethod" required defaultValue={editingTransaction?.payment_method || editingRecurring?.payment_method || (activeAction === 'Transfer' ? 'Bank Transfer' : '')}><option value="" disabled>{tr('Select a method', 'Selecciona un método')}</option><option>Debit Card</option><option>Bank Transfer</option><option>Deuna</option><option>Automatic Debit</option><option>Cash</option></select></label>}
                {error && <small className="form-error" role="alert">{error}</small>}
                <button className="save-button" type="submit" disabled={saving}>{saving ? tr('Saving…', 'Guardando…') : editingTransaction || editingRecurring ? tr('Save changes', 'Guardar cambios') : `${tr('Save', 'Guardar')} ${actionName(activeAction)}`}</button>
                <small className="demo-note">{tr('Private data — visible only when signed in to your Doryc account.', 'Datos privados — visibles únicamente al iniciar sesión en tu cuenta de Doryc.')}</small>
              </form>
            </section>
          </div>
        )}
        {cardModal && <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && setCardModal(null)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="card-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p className="eyebrow">{cardModal === 'account' ? 'ACCOUNT SETUP' : cardModal === 'bankLoan' ? 'BANK DEBT' : cardModal === 'loan' || cardModal === 'loanPayment' || cardModal === 'loanIncrease' ? 'PERSONAL IOU' : 'CREDIT CONTROL'}</p><h2 id="card-modal-title">{cardModal === 'account' ? selectedAccountId ? 'Edit bank account' : 'Add bank account' : cardModal === 'bankLoan' ? 'Add bank loan' : cardModal === 'card' ? 'Add credit card' : cardModal === 'statement' ? 'Card settings' : cardModal === 'loan' ? 'Track borrowed money' : cardModal === 'loanPayment' ? 'Record loan payment' : cardModal === 'loanIncrease' ? 'Add to existing debt' : cardModal === 'cardPayment' ? 'Pay credit card' : 'New card purchase'}</h2></div><button onClick={() => { setCardModal(null); setSelectedAccountId(''); }} aria-label="Close" disabled={saving}>×</button></div>
            <form onSubmit={submitCardEntry}>
              {cardModal === 'account' ? <>
                <label><span>Account name</span><input name="name" required autoFocus defaultValue={data.accounts.find((account) => account.id === selectedAccountId)?.name || ''} placeholder="Produbanco Savings" /></label>
                <label><span>Bank</span><select name="bank" required defaultValue={data.accounts.find((account) => account.id === selectedAccountId)?.bank || 'Pichincha'}><option>Pichincha</option><option>Produbanco</option><option>Pacifico</option><option>Guayaquil</option></select></label>
                <div className="field-row"><label><span>Account type</span><select name="accountType" required defaultValue={data.accounts.find((account) => account.id === selectedAccountId)?.accountType || 'Savings'}><option>Savings</option><option>Checking</option><option>Debit</option><option>Cash</option></select></label><label><span>Starting balance</span><input name="balance" required type="text" inputMode="decimal" defaultValue={data.accounts.find((account) => account.id === selectedAccountId)?.startingBalance ?? 0} /></label></div>
              </> : cardModal === 'bankLoan' ? <>
                <label><span>Loan name</span><input name="name" required autoFocus placeholder="Pichincha Preciso" /></label>
                <label><span>Bank</span><select name="bank" required defaultValue=""><option value="" disabled>Select bank</option><option>Pichincha</option><option>Produbanco</option><option>Pacifico</option><option>Guayaquil</option></select></label>
                <div className="field-row"><label><span>Outstanding balance</span><input name="outstandingBalance" required type="text" inputMode="decimal" placeholder="2365,14" /></label><label><span>Monthly installment</span><input name="installment" required type="text" inputMode="decimal" placeholder="113,69" /></label></div>
                <label><span>Next payment</span><input name="nextDueDate" required type="date" /></label>
                <div className="field-row"><label><span>Installments paid</span><input name="paidInstallments" required type="number" min="0" placeholder="23" /></label><label><span>Total installments</span><input name="totalInstallments" required type="number" min="1" placeholder="48" /></label></div>
                <label><span>Pay from account (optional)</span><select name="payFromAccountId" defaultValue=""><option value="">Choose later</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
              </> : cardModal === 'card' ? <>
                <label><span>Card name</span><input name="name" required autoFocus placeholder="Visa Gold" /></label>
                <label><span>Bank</span><select name="bank" required defaultValue="Pichincha"><option>Pichincha</option><option>Produbanco</option><option>Pacifico</option><option>Guayaquil</option></select></label>
                <div className="field-row"><label><span>Network</span><select name="network" required defaultValue="Visa"><option>Visa</option><option>Mastercard</option><option>Discover</option><option>Amex</option><option>Other</option></select></label><label><span>Pay from account</span><select name="payFromAccountId" defaultValue=""><option value="">Choose later</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label></div>
                <div className="field-row"><label><span>Credit limit</span><input name="creditLimit" required type="text" inputMode="decimal" placeholder="3300,00" /></label><label><span>Currently used</span><input name="openingUsed" required type="text" inputMode="decimal" placeholder="1340,76" /></label></div>
                <div className="field-row"><label><span>Current statement due (optional)</span><input name="currentStatement" type="text" inputMode="decimal" defaultValue="0" /></label><label><span>Statement day</span><input name="statementDay" type="number" min="1" max="31" placeholder="25" /></label></div><label><span>Payment day</span><input name="paymentDay" type="number" min="1" max="31" placeholder="15" /></label>
                <small className="rate-note">The estimated interest rate is assigned automatically from the selected bank&apos;s current consumer-credit reference.</small>
              </> : cardModal === 'statement' ? <><label><span>Credit card</span><select name="creditCardId" required defaultValue={selectedCardId || data.creditCards[0]?.id || ''}>{data.creditCards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label><label><span>Statement amount due (optional)</span><input name="currentStatement" autoFocus type="text" inputMode="decimal" defaultValue={data.creditCards.find((card) => card.id === selectedCardId)?.currentStatement ?? 0} placeholder="0.00" /></label><div className="field-row"><label><span>Credit limit</span><input name="creditLimit" type="text" inputMode="decimal" defaultValue={data.creditCards.find((card) => card.id === selectedCardId)?.creditLimit} /></label><label><span>Statement day</span><input name="statementDay" type="number" min="1" max="31" defaultValue={data.creditCards.find((card) => card.id === selectedCardId)?.statementDay || ''} /></label></div><div className="field-row"><label><span>Payment day</span><input name="paymentDay" type="number" min="1" max="31" defaultValue={data.creditCards.find((card) => card.id === selectedCardId)?.paymentDay || ''} /></label><label><span>Network</span><select name="network" defaultValue={data.creditCards.find((card) => card.id === selectedCardId)?.network || 'Visa'}><option>Visa</option><option>Mastercard</option><option>Discover</option><option>Amex</option><option>Other</option></select></label></div><label><span>Pay from account</span><select name="payFromAccountId" required defaultValue={data.creditCards.find((card) => card.id === selectedCardId)?.payFromAccountId || ''}><option value="" disabled>Select account</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label></> : cardModal === 'loan' ? <><label><span>Direction</span><select name="direction" required defaultValue="i_owe"><option value="i_owe">Someone lent me money — I owe</option><option value="owed_to_me">I lent money — they owe me</option></select></label><label><span>Person</span><input name="personName" required autoFocus placeholder="Friend or family member" /></label><label><span>Balance impact</span><select name="accountId" defaultValue=""><option value="">Track debt only — do not change an account</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>Money entered/left {account.name}</option>)}</select><small className="field-help">Choose an account only when this loan actually moved money into or out of it.</small></label><div className="field-row"><label><span>Amount</span><input name="amount" required type="text" inputMode="decimal" /></label><label><span>Due date (optional)</span><input name="dueDate" type="date" /></label></div><label><span>Note (optional)</span><input name="note" placeholder="What was the money for?" /></label></> : cardModal === 'cardPayment' ? <><input type="hidden" name="creditCardId" value={selectedCardId} /><label><span>Pay from account</span><select name="fromAccountId" required defaultValue={data.creditCards.find((card) => card.id === selectedCardId)?.payFromAccountId || ''}><option value="" disabled>Select account</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><div className="field-row"><label><span>Amount</span><input name="amount" required autoFocus type="text" inputMode="decimal" defaultValue={data.creditCards.find((card) => card.id === selectedCardId)?.currentStatement || ''} /></label><label><span>Date</span><input name="date" required type="date" defaultValue={today} /></label></div><label><span>Note</span><input name="note" placeholder="Statement payment" /></label></> : cardModal === 'loanPayment' ? <><input type="hidden" name="personalLoanId" value={selectedCardId} /><label><span>Account</span><select name="accountId" required defaultValue={data.personalLoans.find((loan) => loan.id === selectedCardId)?.accountId || ''}><option value="" disabled>Select account</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><div className="field-row"><label><span>Amount</span><input name="amount" required autoFocus type="text" inputMode="decimal" defaultValue={(data.personalLoans.find((loan) => loan.id === selectedCardId)?.amount || 0) - (data.personalLoans.find((loan) => loan.id === selectedCardId)?.paid || 0)} /></label><label><span>Date</span><input name="date" required type="date" defaultValue={today} /></label></div></> : cardModal === 'loanIncrease' ? <><input type="hidden" name="personalLoanId" value={selectedCardId} /><p className="loan-modal-summary">Add more to {data.personalLoans.find((loan) => loan.id === selectedCardId)?.personName}&apos;s existing balance.</p><label><span>Account involved</span><select name="accountId" required defaultValue={data.personalLoans.find((loan) => loan.id === selectedCardId)?.accountId || ''}><option value="" disabled>Select account</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><div className="field-row"><label><span>Additional amount</span><input name="amount" required autoFocus type="text" inputMode="decimal" /></label><label><span>Date</span><input name="date" required type="date" defaultValue={today} /></label></div></> : <>
                <label><span>Credit card</span><select name="creditCardId" required defaultValue={selectedCardId || data.creditCards[0]?.id || ''}>{data.creditCards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>
                <label><span>Description</span><input name="description" required autoFocus placeholder="What did you buy?" /></label>
                <div className="field-row"><label><span>Amount</span><input name="amount" required type="text" inputMode="decimal" /></label><label><span>Date</span><input name="date" required type="date" defaultValue={today} /></label></div>
                <label><span>Category</span><select name="category" required defaultValue=""><option value="" disabled>Select a category</option><option>Food</option><option>Transportation</option><option>Shopping</option><option>Personal</option><option>Health</option><option>Entertainment</option><option>Other</option></select></label>
                <div className="field-row"><label><span>Installments</span><select name="installmentMonths" defaultValue="1"><option value="1">Current — one payment</option><option value="2">2 months</option><option value="3">3 months</option><option value="6">6 months</option><option value="9">9 months</option><option value="12">12 months</option><option value="18">18 months</option><option value="24">24 months</option><option value="36">36 months</option></select></label><label><span>Interest</span><select name="withInterest" defaultValue="false"><option value="false">Without interest</option><option value="true">With interest</option></select></label></div>
              </>}
              {error && <small className="form-error" role="alert">{error}</small>}
              <button className="save-button" type="submit" disabled={saving}>{saving ? 'Saving…' : cardModal === 'account' ? selectedAccountId ? 'Save account changes' : 'Add account' : cardModal === 'bankLoan' ? 'Add bank loan' : cardModal === 'card' ? 'Add credit card' : cardModal === 'statement' ? 'Save card settings' : cardModal === 'loan' ? 'Save personal IOU' : cardModal === 'cardPayment' ? 'Save card payment' : cardModal === 'loanPayment' ? 'Save loan payment' : cardModal === 'loanIncrease' ? 'Add to debt' : 'Save card purchase'}</button>
              <small className="demo-note">Payment values are estimates. Your bank statement remains the final source.</small>
            </form>
          </section>
        </div>}
        {celebrationKey > 0 && <div className={`money-rain ${celebrationKind === 'expense' ? 'expense-rain' : 'income-rain'}`} aria-hidden="true" key={celebrationKey}>{Array.from({ length: 30 }, (_, index) => <i className="money-particle" key={index} data-drift={(index % 2 ? 1 : -1) * (24 + index % 7 * 11)} data-spin={(index % 2 ? 1 : -1) * (220 + index * 19)} data-scale={.72 + index % 5 * .12} style={{ left: `${3 + (index * 31) % 94}%` }}>{celebrationKind === 'expense' ? index % 4 === 0 ? '↓' : index % 3 === 0 ? '−' : '$' : index % 5 === 0 ? '$' : index % 4 === 0 ? '✦' : '¢'}</i>)}</div>}
        {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
      </section>
      <ConfirmDialog request={confirmDialog.request} language={language} onAnswer={confirmDialog.answer} />
    </main>
  );
}
