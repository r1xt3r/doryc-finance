import { useEffect, useRef } from 'react';
import type { FinanceNotification } from '../domain/notifications';

export default function NotificationCenter({ items, language, onNavigate, open, onToggle, onClose }: { items: FinanceNotification[]; language: 'en' | 'es'; onNavigate: (target: FinanceNotification['target']) => void; open: boolean; onToggle: () => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) onClose(); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, [onClose]);
  return <div className="notification-center" ref={root}><button className="notification-trigger" type="button" aria-label={language === 'es' ? 'Notificaciones financieras' : 'Financial notifications'} aria-expanded={open} onClick={onToggle}>♧{items.length > 0 && <b>{items.length}</b>}</button>{open && <section className="notification-popover"><header><span><p className="eyebrow">DORYC SIGNALS</p><h3>{language === 'es' ? 'Tu atención financiera' : 'Your financial attention'}</h3></span><small>{items.length}</small></header>{items.map((item) => <button type="button" className={item.tone} key={item.id} onClick={() => { onNavigate(item.target); onClose(); }}><i /><span><strong>{item.title}</strong><small>{item.detail}</small></span><b>→</b></button>)}</section>}</div>;
}
