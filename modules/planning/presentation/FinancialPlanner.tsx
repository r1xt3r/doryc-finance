'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { budgetStatus, recommendBudgetAllocation } from '../domain/budgets';

type Transaction = { type: string; description: string; amount: number; date: string; category: string | null; payment_method?: string | null; recurringPaymentId?: string | null; debtMovement?: boolean };
type Account = { id: string; name: string; accountType: string };
type FinancialPlan = { strategy: string; monthly_income_cents: number; personal_allowance_cents: number; surplus_destination: string; savings_account_id: string | null; include_credit_estimate: boolean; savings_role_confirmed: boolean };
type PlanningData = {
  unavailable?: boolean;
  budgets: Array<{ id: string; month: string; category: string; limit_cents: number; mode: string }>;
  goals: Array<{ id: string; name: string; target_cents: number; saved_cents: number; target_date: string | null; color: string }>;
  categories: Array<{ id: string; name: string; icon: string; color: string }>;
  rules: Array<{ id: string; match_text: string; category: string }>;
  reconciliations: unknown[];
  audit: unknown[];
  plan: FinancialPlan | null;
  accountRoles: Array<{ account_id: string; role: string }>;
};

const empty: PlanningData = { budgets: [], goals: [], categories: [], rules: [], reconciliations: [], audit: [], plan: null, accountRoles: [] };
const coreCategories = ['Food', 'Transportation', 'Shopping', 'Personal', 'Entertainment', 'Home', 'Health', 'Insurance'];

export default function FinancialPlanner({ language, transactions, recurringExpenses, income, commitmentBreakdown, accounts, request }: { language: 'en' | 'es'; transactions: Transaction[]; recurringExpenses: Array<{ name: string; amount: number }>; income: number; commitments: number; commitmentBreakdown: { recurring: number; cards: number; loans: number }; accounts: Account[]; request: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const tr = (en: string, es: string) => language === 'es' ? es : en;
  const money = (value: number) => new Intl.NumberFormat(language === 'es' ? 'es-EC' : 'en-US', { style: 'currency', currency: 'USD' }).format(value);
  const [data, setData] = useState<PlanningData>(empty);
  const [tab, setTab] = useState<'plan' | 'budgets'>('plan');
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState(income > 0 ? income.toFixed(2) : '');
  const [editingIncome, setEditingIncome] = useState(false);
  const [personalAllowanceDraft, setPersonalAllowanceDraft] = useState('');
  const [savingsAccountId, setSavingsAccountId] = useState('');
  const [savingsConfirmed, setSavingsConfirmed] = useState(false);
  const [includeCreditEstimate, setIncludeCreditEstimate] = useState(true);
  const month = new Date().toISOString().slice(0, 7);
  const recurringSignatures = useMemo(() => new Set(recurringExpenses.map((payment) => `${payment.name.trim().toLowerCase()}|${payment.amount.toFixed(2)}`)), [recurringExpenses]);
  const recurringMatch = useCallback((entry: Transaction) => Boolean(entry.recurringPaymentId) || recurringSignatures.has(`${entry.description.trim().toLowerCase()}|${entry.amount.toFixed(2)}`), [recurringSignatures]);
  useEffect(() => { request('/api/planning').then((response) => response.json()).then((result: PlanningData) => {
    setData(result);
    if (!result.plan) return;
    setMonthlyIncome((result.plan.monthly_income_cents / 100).toString());
    setPersonalAllowanceDraft((result.plan.personal_allowance_cents / 100).toString());
    setSavingsAccountId(result.plan.savings_account_id || '');
    setSavingsConfirmed(result.plan.savings_role_confirmed);
    setIncludeCreditEstimate(result.plan.include_credit_estimate);
  }).catch(() => setData(empty)); }, [request]);
  const samples = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of transactions.filter((entry) => entry.type === 'expense' && entry.category && !entry.debtMovement && !recurringMatch(entry) && entry.payment_method !== 'Automatic Debit')) {
      const key = `${item.date.slice(0, 7)}|${item.category}`;
      totals.set(key, (totals.get(key) || 0) + item.amount);
    }
    return [...totals].map(([key, amount]) => { const [sampleMonth, category] = key.split('|'); return { month: sampleMonth, category, amount }; });
  }, [transactions, recurringMatch]);
  const includedCommitments = commitmentBreakdown.recurring + commitmentBreakdown.loans + (includeCreditEstimate ? commitmentBreakdown.cards : 0);
  const categories = [...new Set([...coreCategories, ...data.categories.map((item) => item.name)])];
  const spendingBudget = data.plan ? data.plan.personal_allowance_cents / 100 : (Number(personalAllowanceDraft.replace(',', '.')) || 0);
  const recommendedLimits = recommendBudgetAllocation(categories, samples, spendingBudget);
  const spentByCategory = useMemo(() => transactions.filter((item) => item.type === 'expense' && item.date.startsWith(month) && !item.debtMovement && !recurringMatch(item) && item.payment_method !== 'Automatic Debit').reduce((map, item) => map.set(item.category || 'Other', (map.get(item.category || 'Other') || 0) + item.amount), new Map<string, number>()), [transactions, recurringMatch, month]);
  async function save(payload: Record<string, unknown>) { setSaving(true); setFeedback(''); try { const response = await request('/api/planning', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json(); if (!response.ok) { setFeedback(result.error || tr('The information could not be saved.', 'No se pudo guardar la información.')); return false; } setData(result); return true; } catch { setFeedback(tr('Connection failed. Try again.', 'Falló la conexión. Inténtalo nuevamente.')); return false; } finally { setSaving(false); } }
  async function saveDistribution() { await save({ entity: 'budgetDistribution', month, entries: categories.map((category) => ({ category, limit: recommendedLimits.get(category) || 0 })) }); }
  async function submitFinancialPlan(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const saved = await save({ entity: 'financialPlan', strategy: 'prioritize_savings', monthlyIncome: monthlyIncome || income, personalAllowance: personalAllowanceDraft, surplusDestination: 'savings', savingsAccountId, savingsRoleConfirmed: savingsConfirmed, includeCreditEstimate }); if (saved) { setEditingPlan(false); setFeedback(tr('Your plan was created successfully.', 'Tu plan fue creado correctamente.')); } }
  const plannedIncome = (data.plan?.monthly_income_cents || Math.round(income * 100)) / 100;
  const personalAllowance = (data.plan?.personal_allowance_cents || 0) / 100;
  const projectedSavings = Math.max(0, plannedIncome - includedCommitments - personalAllowance);
  const draftIncome = Number((monthlyIncome || (income > 0 ? income.toFixed(2) : '')).replace(',', '.')) || 0;
  const draftAllowance = Number(personalAllowanceDraft.replace(',', '.')) || 0;
  const draftSavings = Math.max(0, draftIncome - includedCommitments - draftAllowance);
  const draftShortfall = Math.max(0, includedCommitments + draftAllowance - draftIncome);
  const canCreatePlan = draftIncome > 0 && draftAllowance >= 0 && draftShortfall === 0 && Boolean(savingsAccountId) && savingsConfirmed && !saving;
  const accountsByBank = accounts.reduce((groups, account) => {
    const normalized = account.name.toLowerCase();
    const bank = normalized.startsWith('pch') ? 'Pichincha' : normalized.startsWith('prd') ? 'Produbanco' : tr('Other accounts', 'Otras cuentas');
    const group = groups.get(bank) || [];
    group.push(account);
    groups.set(bank, group);
    return groups;
  }, new Map<string, Account[]>());
  return <section className="planner-panel panel">
    <div className="section-heading"><div><p className="eyebrow">{tr('FINANCIAL PLAN', 'PLAN FINANCIERO')}</p><h2>{tr('Plan with guidance', 'Planifica con una guía')}</h2><p>{tr('Doryc proposes realistic limits from your activity. You remain in control.', 'Doryc propone límites realistas según tu actividad. Tú mantienes el control.')}</p></div></div>
    {feedback && <div className={`planner-feedback ${data.plan ? 'success' : 'error'}`} role="status">{feedback}</div>}
    <nav className="planner-tabs"><button className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>{tr('Monthly plan', 'Plan mensual')}</button><button className={tab === 'budgets' ? 'active' : ''} onClick={() => setTab('budgets')}>{tr('Spending limits', 'Límites de gasto')}</button></nav>
    {tab === 'plan' && ((!data.plan || editingPlan) ? <form className="financial-plan-wizard" onSubmit={submitFinancialPlan}>
      <header><span><strong>{tr('Let’s organize your month', 'Organicemos tu mes')}</strong><small>{tr('Enter three details. Doryc will calculate the rest and keep it updated.', 'Ingresa tres datos. Doryc calculará el resto y lo mantendrá actualizado.')}</small></span></header>
      <div className="wizard-simple-grid">
        <div className="wizard-fields">
          <label><span>1. {tr('Your monthly income', 'Tu ingreso mensual')}</span><small>{draftIncome > 0 && !editingIncome ? tr('We use the income you already registered in Doryc.', 'Usamos el ingreso que ya registraste en Doryc.') : tr('We could not detect a registered monthly income.', 'No encontramos un ingreso mensual registrado.')}</small>{draftIncome > 0 && !editingIncome ? <div className="detected-income"><span><small>{tr(data.plan ? 'SAVED IN YOUR PLAN' : 'DETECTED FROM YOUR INCOME', data.plan ? 'GUARDADO EN TU PLAN' : 'DETECTADO DE TUS INGRESOS')}</small><strong>{money(draftIncome)}</strong></span><button type="button" onClick={() => { if (!monthlyIncome && income > 0) setMonthlyIncome(income.toFixed(2)); setEditingIncome(true); }}>{tr('Change', 'Cambiar')}</button></div> : <div className="money-field"><b>$</b><input name="monthlyIncome" required autoFocus inputMode="decimal" value={monthlyIncome} onChange={(event) => setMonthlyIncome(event.target.value)} placeholder="1300.00"/></div>}</label>
          <label><span>2. {tr('How much do you want available for the month?', '¿Cuánto quieres dejar disponible para el mes?')}</span><small>{tr('For personal or day-to-day spending after your obligations.', 'Para gastos personales o del día a día después de tus obligaciones.')}</small><div className="money-field"><b>$</b><input name="personalAllowance" required inputMode="decimal" value={personalAllowanceDraft} onChange={(event) => setPersonalAllowanceDraft(event.target.value)} placeholder="200.00"/></div></label>
          <label><span>3. {tr('Where do you keep your savings?', '¿En qué cuenta guardas tus ahorros?')}</span><small>{tr('It will not be counted as money available to spend.', 'No se contará como dinero disponible para gastar.')}</small><select name="savingsAccountId" required value={savingsAccountId} onChange={(event) => { setSavingsAccountId(event.target.value); setSavingsConfirmed(false); }}><option value="" disabled>{tr('Choose your savings account', 'Elige tu cuenta de ahorro')}</option>{[...accountsByBank].map(([bank, bankAccounts]) => <optgroup key={bank} label={bank}>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.accountType}</option>)}</optgroup>)}</select></label>
        </div>
        <aside className={`plan-preview ${draftShortfall ? 'warning' : ''}`}><span>{tr('YOUR MONTH AT A GLANCE', 'ASÍ QUEDARÍA TU MES')}</span><div><small>{tr('Monthly income', 'Ingreso mensual')}</small><strong>{money(draftIncome)}</strong></div><div><small>{tr('Monthly obligations', 'Obligaciones mensuales')}</small><strong>−{money(includedCommitments)}</strong></div><div className="commitment-detail"><small>{tr('Recurring payments', 'Pagos recurrentes')}</small><b>{money(commitmentBreakdown.recurring)}</b><small>{tr('Loan installments', 'Cuotas de préstamos')}</small><b>{money(commitmentBreakdown.loans)}</b><small>{tr('Credit cards', 'Tarjetas de crédito')}</small><b>{includeCreditEstimate ? money(commitmentBreakdown.cards) : tr('Not included', 'No incluidas')}</b></div><div><small>{tr('Money for your month', 'Dinero para tu mes')}</small><strong>−{money(draftAllowance)}</strong></div><hr/><div className="preview-result"><small>{draftShortfall ? tr('Amount missing', 'Dinero faltante') : tr('Estimated savings', 'Ahorro estimado')}</small><strong>{money(draftShortfall || draftSavings)}</strong></div><p>{draftShortfall ? tr('Your income does not yet cover obligations and personal spending. Reduce the monthly amount or review your income.', 'Tu ingreso todavía no cubre los pagos y el dinero personal. Reduce el monto mensual o revisa tu ingreso.') : tr('Doryc will suggest moving this remainder to your savings account.', 'Doryc te sugerirá mover este sobrante a tu cuenta de ahorro.')}</p></aside>
      </div>
      <div className="wizard-confirmations"><label className="wizard-check"><input type="checkbox" name="savingsRoleConfirmed" required checked={savingsConfirmed} onChange={(event) => setSavingsConfirmed(event.target.checked)}/><span>{tr('Yes, this is the account I use for savings.', 'Sí, esta es la cuenta que uso para ahorrar.')}</span></label><label className="wizard-check"><input type="checkbox" name="includeCreditEstimate" checked={includeCreditEstimate} onChange={(event) => setIncludeCreditEstimate(event.target.checked)}/><span>{tr('Also consider my estimated credit card payment each month.', 'También considerar el pago estimado de mi tarjeta cada mes.')}</span></label></div>
      <footer>{editingPlan && <button type="button" className="secondary" onClick={() => setEditingPlan(false)}>{tr('Cancel', 'Cancelar')}</button>}<button disabled={!canCreatePlan}>{saving ? tr('Saving…', 'Guardando…') : data.plan ? tr('Save my plan', 'Guardar mi plan') : tr('Create my plan', 'Crear mi plan')}</button></footer>
    </form> : <div className="monthly-waterfall"><header><span><strong>{tr('Your monthly route', 'Tu ruta mensual')}</strong><small>{tr('Includes recurring payments, cards and active loans.', 'Incluye pagos recurrentes, tarjetas y préstamos activos.')}</small></span><button onClick={() => setEditingPlan(true)}>{tr('Edit answers', 'Editar respuestas')}</button></header><div><span><small>{tr('Income', 'Ingreso')}</small><strong>{money(plannedIncome)}</strong></span><i>→</i><span><small>{tr('Obligations', 'Obligaciones')}</small><strong>−{money(includedCommitments)}</strong></span><i>→</i><span><small>{tr('Personal money', 'Dinero personal')}</small><strong>−{money(personalAllowance)}</strong></span><i>→</i><span className="savings-result"><small>{tr('Projected savings', 'Ahorro proyectado')}</small><strong>{money(projectedSavings)}</strong></span></div></div>)}
    {data.unavailable && <div className="planner-notice">{tr('Planning tools are ready; the database update still needs to be applied.', 'Las herramientas están listas; aún falta aplicar la actualización de base de datos.')}</div>}
    {tab === 'budgets' && <div className="budget-workspace"><div className="spending-budget-summary"><span><small>{tr('YOUR MONTHLY SPENDING MONEY', 'DINERO PARA TUS GASTOS DEL MES')}</small><strong>{money(spendingBudget)}</strong></span><p>{tr('Doryc suggests a flexible distribution based on your activity. These amounts are guides, not restrictions; you can spend less in one category and more in another.', 'Doryc sugiere una distribución flexible según tu actividad. Estos montos son una guía, no una restricción: puedes gastar menos en una categoría y más en otra.')}</p>{spendingBudget > 0 && <button disabled={saving} onClick={saveDistribution}>{data.budgets.some((item) => item.month.startsWith(month)) ? tr('Recalculate this month', 'Recalcular este mes') : tr('Save monthly distribution', 'Guardar distribución mensual')}</button>}</div>{spendingBudget <= 0 ? <p className="planner-empty">{tr('Create your monthly plan first to define how much you want available for spending.', 'Primero crea tu plan mensual para definir cuánto quieres dejar disponible para gastos.')}</p> : <div className="budget-grid">{categories.map((category) => { const stored = data.budgets.find((item) => item.month.startsWith(month) && item.category === category); const recommendation = recommendedLimits.get(category) || 0; const limit = stored ? stored.limit_cents / 100 : recommendation; const spent = spentByCategory.get(category) || 0; const status = budgetStatus(spent, limit); return <article className={`budget-card ${status.tone}`} key={category}><header><span><strong>{category}</strong><small>{stored ? tr('Plan for this month', 'Plan de este mes') : tr('Suggested amount', 'Monto sugerido')}</small></span><b>{money(limit)}</b></header><div className="budget-track"><i style={{ width: `${Math.min(100,status.ratio * 100)}%` }}/></div><div className="budget-card-numbers"><span><small>{tr('Spent', 'Gastado')}</small><strong>{money(spent)}</strong></span><span><small>{tr('Guide remaining', 'Guía restante')}</small><strong className={status.remaining < 0 ? 'negative' : ''}>{money(status.remaining)}</strong></span></div></article>; })}</div>}</div>}
  </section>;
}
