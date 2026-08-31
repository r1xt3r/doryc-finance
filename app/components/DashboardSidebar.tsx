import LogoMark from './LogoMark';
import type { Language } from '../../lib/useLanguage';

export type DashboardView = 'overview' | 'accounts' | 'payments' | 'credit' | 'people' | 'activity';

const navigation: Array<[DashboardView, string, string, string]> = [
  ['overview', '⌁', 'Overview', 'Resumen'],
  ['accounts', '▥', 'Accounts', 'Cuentas'],
  ['payments', '◷', 'Payments', 'Pagos'],
  ['credit', '◇', 'Credit & loans', 'Crédito y préstamos'],
  ['people', '↔', 'People', 'Personas'],
  ['activity', '↕', 'Activity', 'Actividad'],
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
