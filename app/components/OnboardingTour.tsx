'use client';

import { useEffect, useRef, useState } from 'react';
import type { DashboardView } from './DashboardSidebar';

type Step = { view: DashboardView; eyebrow: string; title: string; body: string; tip: string };

export default function OnboardingTour({ language, onNavigate, onClose, onFinish }: { language: 'en' | 'es'; onNavigate: (view: DashboardView) => void; onClose: () => void; onFinish: () => void }) {
  const es = language === 'es';
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const steps: Step[] = es ? [
    { view: 'overview', eyebrow: 'BIENVENIDO A DORYC', title: 'Tu dinero, en un solo lugar', body: 'Este resumen conecta tus saldos, ingresos, compromisos y ahorro potencial. Primero te mostraremos dónde registrar cada dato.', tip: 'Tus datos son privados y cada usuario solo puede ver su propia información.' },
    { view: 'accounts', eyebrow: 'PASO 1 · BASE FINANCIERA', title: 'Empieza por tus cuentas', body: 'Agrega las cuentas bancarias y de ahorro que realmente usas. El saldo inicial es el punto de partida de todos los cálculos.', tip: 'Registra primero cuentas corrientes, débito y ahorros antes de añadir movimientos.' },
    { view: 'payments', eyebrow: 'PASO 2 · PLAN DEL MES', title: 'Programa ingresos y pagos', body: 'Registra tu sueldo como ingreso esperado y añade alquiler, servicios, suscripciones y otros compromisos recurrentes.', tip: 'Doryc actualizará automáticamente las próximas fechas y te avisará qué falta cubrir.' },
    { view: 'credit', eyebrow: 'PASO 3 · DEUDAS BANCARIAS', title: 'Configura tarjetas y préstamos', body: 'Añade límite, saldo utilizado, día de corte, fecha de pago y cuenta de origen. También puedes registrar préstamos bancarios.', tip: 'Después registra cada compra de tarjeta para estimar correctamente el próximo pago.' },
    { view: 'people', eyebrow: 'PASO 4 · ENTRE PERSONAS', title: 'No olvides préstamos personales', body: 'Registra dinero que te prestaron o que tú prestaste, junto con cada abono, para conservar el saldo y el historial.', tip: 'Doryc distingue lo que debes de lo que deben devolverte.' },
    { view: 'activity', eyebrow: 'PASO 5 · DÍA A DÍA', title: 'Registra tus movimientos', body: 'Añade ingresos, gastos y transferencias. Tus gráficas, categorías y alertas se actualizarán con cada movimiento.', tip: 'Una transferencia mueve dinero entre cuentas; no se considera ingreso ni gasto.' },
    { view: 'overview', eyebrow: 'LISTO PARA EMPEZAR', title: 'Completa tus misiones iniciales', body: 'Al terminar este recorrido verás una lista práctica. Doryc marcará cada misión cuando detecte que ya registraste la información necesaria.', tip: 'Puedes repetir este tour cuando quieras desde el botón de Configuración.' },
  ] : [
    { view: 'overview', eyebrow: 'WELCOME TO DORYC', title: 'Your money, in one place', body: 'This overview connects balances, income, commitments and potential savings. First, we will show you where to record each detail.', tip: 'Your data is private and each user can only access their own information.' },
    { view: 'accounts', eyebrow: 'STEP 1 · FINANCIAL BASE', title: 'Start with your accounts', body: 'Add the bank and savings accounts you actually use. Their opening balances are the starting point for every calculation.', tip: 'Set up checking, debit and savings accounts before adding movements.' },
    { view: 'payments', eyebrow: 'STEP 2 · MONTHLY PLAN', title: 'Schedule income and payments', body: 'Record your salary as expected income, then add rent, utilities, subscriptions and other recurring commitments.', tip: 'Doryc advances dates automatically and tells you what still needs funding.' },
    { view: 'credit', eyebrow: 'STEP 3 · BANK DEBT', title: 'Configure cards and loans', body: 'Add the limit, used balance, statement day, payment date and funding account for each card and bank loan.', tip: 'Then record card purchases so the next payment estimate stays accurate.' },
    { view: 'people', eyebrow: 'STEP 4 · BETWEEN PEOPLE', title: 'Remember personal loans', body: 'Track money you borrowed or lent and every payment, preserving the remaining balance and movement history.', tip: 'Doryc separates what you owe from what others owe you.' },
    { view: 'activity', eyebrow: 'STEP 5 · DAILY MONEY', title: 'Record your movements', body: 'Add income, expenses and transfers. Charts, categories and alerts update with every movement.', tip: 'A transfer moves money between accounts; it is not income or an expense.' },
    { view: 'overview', eyebrow: 'READY TO BEGIN', title: 'Complete your setup missions', body: 'After this tour you will see a practical checklist. Doryc completes each mission when it detects the information it needs.', tip: 'You can replay this tour at any time from Settings.' },
  ];
  const step = steps[index];

  useEffect(() => {
    onNavigate(step.view);
    window.setTimeout(() => heading.current?.focus(), 80);
  }, [index, step.view, onNavigate]);

  return <div className="tour-backdrop" role="presentation">
    <section className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-progress" aria-label={`${index + 1} / ${steps.length}`}><i style={{ width: `${(index + 1) / steps.length * 100}%` }} /></div>
      <div className="tour-count"><span>{step.eyebrow}</span><b>{index + 1} / {steps.length}</b></div>
      <h2 id="tour-title" ref={heading} tabIndex={-1}>{step.title}</h2>
      <p>{step.body}</p>
      <aside><span>✦</span><small>{step.tip}</small></aside>
      <div className="tour-actions">
        <button type="button" className="tour-skip" onClick={onClose}>{es ? 'Saltar por ahora' : 'Skip for now'}</button>
        <span>
          {index > 0 && <button type="button" onClick={() => setIndex((value) => value - 1)}>{es ? 'Atrás' : 'Back'}</button>}
          <button type="button" className="tour-primary" onClick={() => index === steps.length - 1 ? onFinish() : setIndex((value) => value + 1)}>{index === steps.length - 1 ? es ? 'Abrir misiones' : 'Open missions' : es ? 'Siguiente' : 'Next'} <b>→</b></button>
        </span>
      </div>
    </section>
  </div>;
}
