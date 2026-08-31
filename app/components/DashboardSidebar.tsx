import LogoMark from './LogoMark';
import type { Language } from '../../lib/useLanguage';
import type { ReactNode } from 'react';

export type DashboardView = 'overview' | 'accounts' | 'payments' | 'credit' | 'people' | 'activity';

const navigation: Array<[DashboardView, ReactNode, string, string]> = [
  ['overview', <svg key="home" viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4Z"/></svg>, 'Overview', 'Resumen'],
  ['accounts', <svg key="accounts" viewBox="0 0 24 24"><path d="M4 7h16v12H4zM7 10h4m-4 3h7m-7 3h5M6 4h12v3"/></svg>, 'Accounts', 'Cuentas'],
  ['payments', <svg key="payments" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2M9 4V2m6 2V2"/></svg>, 'Payments', 'Pagos'],
  ['credit', <svg key="credit" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18m-14 5h4"/></svg>, 'Credit & loans', 'Crédito y préstamos'],
  ['people', <svg key="people" viewBox="0 0 24 24"><circle cx="8" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 19c.5-3.2 2.2-5 5-5s4.5 1.8 5 5m1-4c2.7-.3 4.5 1 5 3.5"/></svg>, 'People', 'Personas'],
  ['activity', <svg key="activity" viewBox="0 0 24 24"><path d="M4 18V9m5 9V5m6 13v-7m5 7V3"/></svg>, 'Activity', 'Actividad'],
];

type Props = {
  activeView: DashboardView;
  name: string;
  paymentCount: number;
  language: Language;
  onNavigate: (view: DashboardView) => void;
};

export default function DashboardSidebar({ activeView, name, paymentCount, language, onNavigate }: Props) {
  return (
    <aside className="sidebar" data-reveal>
      <button className="brand sidebar-brand" type="button" onClick={() => onNavigate('overview')} aria-label="Doryc home"><LogoMark /><span>doryc</span></button>
      <nav className="dashboard-nav" aria-label={language === 'es' ? 'Secciones del panel' : 'Dashboard sections'}>
        {navigation.map(([view, icon, en, es]) => <button type="button" className={activeView === view ? 'active' : ''} aria-current={activeView === view ? 'page' : undefined} key={view} onClick={() => onNavigate(view)}><i>{icon}</i><span>{language === 'es' ? es : en}</span>{view === 'payments' && paymentCount > 0 && <b>{paymentCount}</b>}</button>)}
      </nav>
      <div className="profile-chip"><span className="avatar">{name.slice(0, 2).toUpperCase()}</span><span><strong>{name}</strong><small>{language === 'es' ? 'Espacio privado' : 'Private workspace'}</small></span></div>
    </aside>
  );
}
