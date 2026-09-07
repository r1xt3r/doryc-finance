'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Goal = { id: string; name: string; target_cents: number; saved_cents: number; target_date: string | null; color: string; account_id: string | null };
type Account = { id: string; name: string; bank: string; balance?: number };
type Editor = 'new' | Goal | null;

function PencilIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>; }
function TrashIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 10v7m4-7v7"/></svg>; }

export default function SavingsGoals({ language, accounts, request }: { language: 'en' | 'es'; accounts: Account[]; request: (input: RequestInfo, init?: RequestInit) => Promise<Response> }) {
  const tr = (en: string, es: string) => language === 'es' ? es : en;
  const money = (value: number) => new Intl.NumberFormat(language === 'es' ? 'es-EC' : 'en-US', { style: 'currency', currency: 'USD' }).format(value);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editor, setEditor] = useState<Editor>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { request('/api/planning').then((response) => response.json()).then((result) => setGoals(result.goals || [])).catch(() => setGoals([])); }, [request]);

  const availableSavings = useMemo(() => accounts.reduce((total, account) => total + Math.max(0, account.balance || 0), 0), [accounts]);
  const totals = useMemo(() => goals.reduce((summary, goal) => ({ target: summary.target + goal.target_cents, complete: summary.complete + (availableSavings * 100 >= goal.target_cents ? 1 : 0) }), { target: 0, complete: 0 }), [goals, availableSavings]);
  const selected = editor && editor !== 'new' ? editor : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    setSaving(true);
    setMessage(null);
    try {
      const response = await request('/api/planning', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: selected ? 'goalUpdate' : 'goal', id: selected?.id, ...form }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save');
      setGoals(result.goals || []);
      formElement.reset();
      setEditor(null);
      setMessage({ tone: 'success', text: selected ? tr('Goal updated.', 'Meta actualizada.') : tr('Goal created successfully.', 'Meta creada correctamente.') });
    } catch {
      setMessage({ tone: 'error', text: tr('We could not save this goal. Check the information and try again.', 'No pudimos guardar esta meta. Revisa la información e inténtalo de nuevo.') });
    } finally { setSaving(false); }
  }

  async function remove(goal: Goal) {
    if (!window.confirm(tr(`Remove “${goal.name}”? Your account balance will not change.`, `¿Eliminar “${goal.name}”? El saldo de tu cuenta no cambiará.`))) return;
    setRemoving(goal.id);
    setMessage(null);
    try {
      const response = await request('/api/planning', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity: 'goalDelete', id: goal.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to remove');
      setGoals(result.goals || []);
      if (selected?.id === goal.id) setEditor(null);
      setMessage({ tone: 'success', text: tr('Goal removed. Your savings balance was not changed.', 'Meta eliminada. El saldo de tus ahorros no cambió.') });
    } catch {
      setMessage({ tone: 'error', text: tr('We could not remove this goal.', 'No pudimos eliminar esta meta.') });
    } finally { setRemoving(''); }
  }

  return <div className="savings-goals-section">
    <div className="savings-goals-heading">
      <span><p className="eyebrow">{tr('SAVINGS GOALS', 'METAS DE AHORRO')}</p><h3>{tr('Turn your savings into something concrete', 'Dale un propósito concreto a tus ahorros')}</h3><small>{tr('Goals organize your progress; they never change the real balance of your accounts.', 'Las metas organizan tu avance; nunca modifican el saldo real de tus cuentas.')}</small></span>
      <button className="goal-primary-action" type="button" onClick={() => { setEditor('new'); setMessage(null); }}>+ {tr('New goal', 'Nueva meta')}</button>
    </div>

    <div className="savings-goal-summary">
      <span><small>{tr('Savings available', 'Ahorro disponible')}</small><strong>{money(availableSavings)}</strong></span>
      <span><small>{tr('Combined target', 'Objetivo total')}</small><strong>{money(totals.target / 100)}</strong></span>
      <span><small>{tr('Overall coverage', 'Cobertura general')}</small><strong>{totals.target ? Math.min(100, Math.round(availableSavings * 100 / totals.target * 100)) : 0}%</strong></span>
      <span><small>{tr('Completed', 'Completadas')}</small><strong>{totals.complete} / {goals.length}</strong></span>
    </div>

    {goals.length > 0 && <p className="savings-pool-note"><span>i</span>{tr('Your savings are shown as one shared fund. The percentage of each goal indicates how much you could cover today; the money has not been assigned or spent.', 'Tus ahorros se muestran como un fondo común. El porcentaje de cada meta indica cuánto podrías cubrir hoy; el dinero no ha sido asignado ni gastado.')}</p>}

    {message && <p className={`savings-goal-message ${message.tone}`} role="status">{message.text}</p>}

    {editor && <form key={selected?.id || 'new'} className="planner-form savings-goal-form" onSubmit={submit}>
      <div className="goal-form-heading"><strong>{selected ? tr('Edit goal', 'Editar meta') : tr('Create a new goal', 'Crear una nueva meta')}</strong><small>{tr('Doryc calculates its coverage automatically from your savings balance.', 'Doryc calcula su cobertura automáticamente usando el saldo de tus ahorros.')}</small></div>
      <label><span>{tr('Goal', 'Meta')}</span><input name="name" required defaultValue={selected?.name || ''} placeholder={tr('Emergency fund', 'Fondo de emergencia')}/></label>
      <label><span>{tr('Target amount', 'Monto objetivo')}</span><input name="target" required inputMode="decimal" defaultValue={selected ? selected.target_cents / 100 : ''} placeholder="0.00"/></label>
      <label><span>{tr('Target date', 'Fecha objetivo')}</span><input name="targetDate" type="date" defaultValue={selected?.target_date || ''}/></label>
      <label><span>{tr('Savings account', 'Cuenta de ahorro')}</span><select name="accountId" defaultValue={selected?.account_id || ''}><option value="">{tr('No linked account', 'Sin cuenta vinculada')}</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.bank} · {account.name}</option>)}</select></label>
      <div className="goal-form-actions"><button className="goal-cancel" type="button" onClick={() => setEditor(null)}>{tr('Cancel', 'Cancelar')}</button><button disabled={saving}>{saving ? tr('Saving…', 'Guardando…') : selected ? tr('Save changes', 'Guardar cambios') : tr('Create goal', 'Crear meta')}</button></div>
    </form>}

    <div className="goal-grid">{goals.map((goal) => {
      const account = accounts.find((item) => item.id === goal.account_id);
      const goalSavings = account ? Math.max(0, account.balance || 0) : availableSavings;
      const goalSavingsCents = goalSavings * 100;
      const progress = goal.target_cents ? goalSavingsCents / goal.target_cents * 100 : 0;
      const remaining = Math.max(0, goal.target_cents - goalSavingsCents);
      return <article className={progress >= 100 ? 'complete' : ''} key={goal.id}>
        <header><span className="goal-symbol">{progress >= 100 ? '✓' : goal.name.slice(0, 1).toUpperCase()}</span><span><strong>{goal.name}</strong><small>{account ? `${account.bank} · ${account.name}` : tr('No linked account', 'Sin cuenta vinculada')}</small></span><div className="goal-card-actions"><button type="button" onClick={() => { setEditor(goal); setMessage(null); }} aria-label={tr('Edit goal', 'Editar meta')} title={tr('Edit', 'Editar')}><PencilIcon /></button><button className="goal-delete" type="button" disabled={removing === goal.id} onClick={() => remove(goal)} aria-label={tr('Delete goal', 'Eliminar meta')} title={tr('Delete', 'Eliminar')}><TrashIcon /></button></div></header>
        <div className="goal-amount"><strong>{money(goalSavings)}</strong><span>{tr('available of', 'disponibles de')} {money(goal.target_cents / 100)}</span></div>
        <div className="goal-progress"><i style={{ width: `${Math.min(100, progress)}%`, background: goal.color }}/></div>
        <footer><span><b>{Math.round(progress)}%</b> {tr('completed', 'completado')}</span><span>{remaining ? `${money(remaining / 100)} ${tr('remaining', 'por completar')}` : tr('Goal reached', 'Meta cumplida')}</span>{goal.target_date && <time dateTime={goal.target_date}>{tr('By', 'Para')} {new Intl.DateTimeFormat(language === 'es' ? 'es-EC' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${goal.target_date}T00:00:00Z`))}</time>}</footer>
      </article>;
    })}{!goals.length && <div className="planner-empty goal-empty"><span>◎</span><strong>{tr('No savings goals yet', 'Aún no tienes metas de ahorro')}</strong><small>{tr('Create one to see how close you are to something important.', 'Crea una para saber qué tan cerca estás de algo importante.')}</small><button type="button" onClick={() => setEditor('new')}>{tr('Create my first goal', 'Crear mi primera meta')}</button></div>}</div>
  </div>;
}
