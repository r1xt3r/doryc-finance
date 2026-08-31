export default function MonthlyClose({ income, spent, debtPaid, saved, language }: { income: number; spent: number; debtPaid: number; saved: number; language: 'en' | 'es' }) {
  const es = language === 'es';
  const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return <article className="monthly-close">
    <span className="monthly-close-icon">✦</span><div><p className="eyebrow">{es ? 'CIERRE DEL MES' : 'MONTHLY CLOSE'}</p><h2>{es ? 'Tu mes, resumido con claridad' : 'Your month, clearly summarized'}</h2><p>{es ? 'Una instantánea de lo que entró, salió y quedó disponible.' : 'A snapshot of what came in, went out and remained available.'}</p></div>
    <div className="monthly-close-stats"><span><small>{es ? 'Ingresos' : 'Income'}</small><strong className="positive">+{money(income)}</strong></span><span><small>{es ? 'Gastos' : 'Spent'}</small><strong>−{money(spent)}</strong></span><span><small>{es ? 'Deuda pagada' : 'Debt paid'}</small><strong>{money(debtPaid)}</strong></span><span><small>{es ? 'Disponible' : 'Available'}</small><strong className={saved >= 0 ? 'positive' : 'negative'}>{money(saved)}</strong></span></div>
  </article>;
}
