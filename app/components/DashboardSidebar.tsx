import LogoMark from './LogoMark';

export type DashboardView = 'overview' | 'accounts' | 'payments' | 'credit' | 'people' | 'activity';

const navigation: Array<[DashboardView, string, string]> = [
  ['overview', '⌁', 'Overview'],
  ['accounts', '▥', 'Accounts'],
  ['payments', '◷', 'Payments'],
  ['credit', '◇', 'Credit & loans'],
  ['people', '↔', 'People'],
  ['activity', '↕', 'Activity'],
];

type Props = {
  activeView: DashboardView;
  name: string;
  paymentCount: number;
  onNavigate: (view: DashboardView) => void;
};

export default function DashboardSidebar({ activeView, name, paymentCount, onNavigate }: Props) {
  return (
    <aside className="sidebar" data-reveal>
      <button className="brand sidebar-brand" type="button" onClick={() => onNavigate('overview')} aria-label="Doryc home"><LogoMark /><span>doryc</span></button>
      <nav className="dashboard-nav" aria-label="Dashboard sections">
        {navigation.map(([view, icon, label]) => <button type="button" className={activeView === view ? 'active' : ''} aria-current={activeView === view ? 'page' : undefined} key={view} onClick={() => onNavigate(view)}><i>{icon}</i><span>{label}</span>{view === 'payments' && paymentCount > 0 && <b>{paymentCount}</b>}</button>)}
      </nav>
      <div className="profile-chip"><span className="avatar">{name.slice(0, 2).toUpperCase()}</span><span><strong>{name}</strong><small>Private workspace</small></span></div>
    </aside>
  );
}
