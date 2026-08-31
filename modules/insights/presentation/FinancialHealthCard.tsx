import type { FinancialHealth } from '../domain/financialHealth';

export default function FinancialHealthCard({ health, language }: { health: FinancialHealth; language: 'en' | 'es' }) {
  const es = language === 'es';
  const labels: Record<FinancialHealth['label'], string> = { Excellent: es ? 'Excelente' : 'Excellent', Stable: es ? 'Estable' : 'Stable', 'Needs attention': es ? 'Necesita atención' : 'Needs attention', 'At risk': es ? 'En riesgo' : 'At risk' };
  const factorNames: Record<string, string> = es ? { coverage: 'Cobertura mensual', credit: 'Uso de crédito', savings: 'Hábito de ahorro', punctuality: 'Puntualidad' } : { coverage: 'Monthly coverage', credit: 'Credit usage', savings: 'Savings habit', punctuality: 'Punctuality' };
  return <article className={`health-card health-${health.label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="health-score" style={{ '--score': `${health.score * 3.6}deg` } as React.CSSProperties}><span><strong>{health.score}</strong><small>/ 100</small></span></div>
    <div className="health-copy"><p className="eyebrow">{es ? 'SALUD FINANCIERA' : 'FINANCIAL HEALTH'}</p><h2>{labels[health.label]}</h2><p>{es ? 'Una lectura clara de cobertura, crédito, ahorro y puntualidad.' : 'A clear reading of coverage, credit, savings and punctuality.'}</p></div>
    <div className="health-factors">{health.factors.map((factor) => <div key={factor.key}><span><strong>{factorNames[factor.key]}</strong><small>{factor.score}/100</small></span><i><b style={{ width: `${factor.score}%` }} /></i></div>)}</div>
  </article>;
}
